import * as RNFS from '@dr.pogodin/react-native-fs';

import {getDatabase} from '@core/db/database';
/**
 * Canonical lesson download repository (LING-149 TASK-007, AD-005/AD-007).
 *
 * Each download is one atomic SQLite row (`lesson_downloads`): the whole
 * snapshot body is validated with the strict zod mirror before the single
 * `INSERT OR REPLACE`, so a truncated or invalid body leaves the prior row
 * untouched. Readers load exactly one row. Analyses fetched after the
 * download are never merged into the row (FR-016: "at download time").
 *
 * Media-block files are staged first into
 * `lesson-media/<lessonId>/<revision>/`; the row commit is the commit point,
 * and older revision directories plus orphans are swept after the commit and
 * at startup. A kill during the media fetch therefore leaves the prior copy
 * readable (INV-007).
 *
 * Deletion happens only on a positive `gone` from an HTTP 200 revisions
 * response (AD-007): network errors, 401 and 5xx keep the copy. Callers must
 * pass through `fetchLessonRevisions` success values; this module never
 * deletes on a transport failure.
 */
import type {DatabaseConnection} from '@core/db/sqlite';
import {
  type LessonSnapshot,
  LessonSnapshotResponseSchema,
  parseLessonSnapshotResponse,
} from '@core/schemas/lesson';

import type {LessonDownloadStatus} from './canonicalLessonClient';

export const LESSON_MEDIA_ROOT_SEGMENT = 'lesson-media';

export type LessonDownloadRecord = {
  lessonId: string;
  contentRevision: number;
  /** Higher-than-stored revision seen by the status check ("có bản mới"). */
  serverRevision: number | null;
  contractVersion: number;
  snapshot: LessonSnapshot;
  mediaDir: string | null;
  downloadedAt: string;
};

export class InvalidLessonSnapshotError extends Error {
  constructor(message = 'Lesson snapshot response failed validation.') {
    super(message);
    this.name = 'InvalidLessonSnapshotError';
  }
}

type LessonDownloadRow = {
  lesson_id: string;
  content_revision: number;
  server_revision: number | null;
  contract_version: number;
  snapshot_json: string;
  media_dir: string | null;
  downloaded_at: string;
};

function firstRow<T>(result: {
  rows?: {length?: number; item: (index: number) => unknown} | null;
}): T | null {
  return (result.rows?.item(0) as T | undefined) ?? null;
}

function mapRow(row: LessonDownloadRow): LessonDownloadRecord | null {
  // The row stores the snapshot response body verbatim (AD-005); parse the
  // full body so a version drift surfaces instead of a half-parsed lesson.
  const parsed = LessonSnapshotResponseSchema.safeParse(
    JSON.parse(row.snapshot_json) as unknown,
  );
  if (!parsed.success) return null;
  if (parsed.data.lesson.id !== row.lesson_id) return null;
  return {
    lessonId: row.lesson_id,
    contentRevision: row.content_revision,
    serverRevision: row.server_revision,
    contractVersion: row.contract_version,
    snapshot: parsed.data.lesson,
    mediaDir: row.media_dir,
    downloadedAt: row.downloaded_at,
  };
}

/** Read exactly one stored row; `null` when absent or unparseable. */
export function getLessonDownload(
  lessonId: string,
  db: DatabaseConnection = getDatabase(),
): LessonDownloadRecord | null {
  const row = firstRow<LessonDownloadRow>(
    db.execute('SELECT * FROM lesson_downloads WHERE lesson_id = ? LIMIT 1;', [
      lessonId,
    ]),
  );
  if (!row) return null;
  try {
    return mapRow(row);
  } catch {
    return null;
  }
}

/**
 * Parsing a snapshot (JSON + strict zod over every sentence) is the costly
 * part of listing downloads, and the Library lists them on each open. A row
 * only changes through a re-download (new `downloaded_at`/revision), so the
 * parsed record is reused while that stamp is unchanged, and the snapshot
 * body is only read for rows whose stamp changed.
 */
const parsedRowCache = new Map<
  string,
  {stamp: string; record: LessonDownloadRecord | null}
>();

/** Every column but the snapshot body, plus the body's length. */
type LessonDownloadStampRow = {
  lesson_id: string;
  content_revision: number;
  server_revision: number | null;
  media_dir: string | null;
  downloaded_at: string;
  snapshot_length: number;
};

function listLessonDownloadStampRows(
  db: DatabaseConnection,
): LessonDownloadStampRow[] {
  const result = db.execute(
    `SELECT lesson_id, content_revision, server_revision, media_dir,
            downloaded_at, length(snapshot_json) AS snapshot_length
       FROM lesson_downloads ORDER BY downloaded_at DESC;`,
  );
  const rows: LessonDownloadStampRow[] = [];
  for (let index = 0; index < (result.rows?.length ?? 0); index += 1) {
    const row = result.rows?.item(index) as LessonDownloadStampRow | undefined;
    if (row) rows.push(row);
  }
  return rows;
}

function stampOf(row: LessonDownloadStampRow): string {
  return `${row.content_revision}|${row.server_revision}|${row.media_dir}|${row.downloaded_at}|${row.snapshot_length}`;
}

/** Every stored download, newest first. Unparseable rows are skipped. */
export function listLessonDownloads(
  db: DatabaseConnection = getDatabase(),
): LessonDownloadRecord[] {
  const records: LessonDownloadRecord[] = [];
  const seen = new Set<string>();
  for (const stampRow of listLessonDownloadStampRows(db)) {
    seen.add(stampRow.lesson_id);
    const stamp = stampOf(stampRow);
    const hit = parsedRowCache.get(stampRow.lesson_id);
    if (hit && hit.stamp === stamp) {
      if (hit.record) records.push(hit.record);
      continue;
    }
    let record: LessonDownloadRecord | null = null;
    try {
      const row = firstRow<LessonDownloadRow>(
        db.execute(
          'SELECT * FROM lesson_downloads WHERE lesson_id = ? LIMIT 1;',
          [stampRow.lesson_id],
        ),
      );
      record = row ? mapRow(row) : null;
    } catch {
      // Skip a corrupt row without breaking the catalog.
    }
    parsedRowCache.set(stampRow.lesson_id, {stamp, record});
    if (record) records.push(record);
  }
  parsedRowCache.forEach((_, id) => {
    if (!seen.has(id)) parsedRowCache.delete(id);
  });
  return records;
}

/**
 * Changes whenever a download is added, re-downloaded, marked for update or
 * removed, without reading any snapshot body.
 */
export function getLessonDownloadsSignature(
  db: DatabaseConnection = getDatabase(),
): string {
  return listLessonDownloadStampRows(db)
    .map(row => `${row.lesson_id}:${stampOf(row)}`)
    .sort()
    .join(',');
}

export type LessonDownloadKind = {
  lessonId: string;
  origin: string | null;
  sourceType: string | null;
};

/**
 * Origin and source type of every download, read inside SQLite so counting
 * lessons per Library section never loads the snapshot bodies.
 */
export function listLessonDownloadKinds(
  db: DatabaseConnection = getDatabase(),
): LessonDownloadKind[] {
  const result = db.execute(
    `SELECT lesson_id,
            json_extract(snapshot_json, '$.lesson.origin') AS origin,
            json_extract(snapshot_json, '$.lesson.source_type') AS source_type
       FROM lesson_downloads;`,
  );
  const kinds: LessonDownloadKind[] = [];
  for (let index = 0; index < (result.rows?.length ?? 0); index += 1) {
    const row = result.rows?.item(index) as
      | {lesson_id: string; origin: string | null; source_type: string | null}
      | undefined;
    if (!row) continue;
    kinds.push({
      lessonId: row.lesson_id,
      origin: row.origin,
      sourceType: row.source_type,
    });
  }
  return kinds;
}

/** What a lesson card shows about a download, without its snapshot body. */
export type LessonDownloadCard = {
  lessonId: string;
  downloadedAt: string;
  title: string;
  description: string;
  origin: LessonSnapshot['origin'];
  sourceType: LessonSnapshot['source_type'];
  generated: boolean;
  unit: LessonSnapshot['unit'];
  sentenceCount: number;
  activityCount: number;
  youtubeVideoId: string | null;
  youtubeDurationMs: number | null;
};

type LessonDownloadCardRow = {
  lesson_id: string;
  downloaded_at: string;
  title: string | null;
  description: string | null;
  origin: string | null;
  source_type: string | null;
  generated: number | null;
  unit_json: string | null;
  sentence_count: number | null;
  activity_count: number | null;
  youtube_video_id: string | null;
  youtube_duration_ms: number | null;
};

/**
 * The card fields of every download, oldest first (the order of
 * `listDownloadedLessonSummaries`), read inside SQLite: listing the Library's
 * cards never parses or validates the snapshot bodies on the JS thread.
 * Rows whose body is not JSON or names another lesson are skipped.
 */
export function listLessonDownloadCards(
  db: DatabaseConnection = getDatabase(),
): LessonDownloadCard[] {
  const result = db.execute(
    `SELECT d.lesson_id, d.downloaded_at,
            json_extract(d.snapshot_json, '$.lesson.title') AS title,
            json_extract(d.snapshot_json, '$.lesson.description') AS description,
            json_extract(d.snapshot_json, '$.lesson.origin') AS origin,
            json_extract(d.snapshot_json, '$.lesson.source_type') AS source_type,
            json_extract(d.snapshot_json, '$.lesson.generated') AS generated,
            json_extract(d.snapshot_json, '$.lesson.unit') AS unit_json,
            json_array_length(d.snapshot_json, '$.lesson.sentences')
              AS sentence_count,
            (SELECT count(*)
               FROM json_each(d.snapshot_json, '$.lesson.blocks')
              WHERE json_extract(value, '$.type') = 'activity')
              AS activity_count,
            json_extract(d.snapshot_json, '$.lesson.youtube.video_id')
              AS youtube_video_id,
            json_extract(d.snapshot_json, '$.lesson.youtube.duration_ms')
              AS youtube_duration_ms
       FROM lesson_downloads d
      WHERE json_valid(d.snapshot_json)
        AND json_extract(d.snapshot_json, '$.lesson.id') = d.lesson_id
      ORDER BY d.downloaded_at ASC;`,
  );
  const cards: LessonDownloadCard[] = [];
  for (let index = 0; index < (result.rows?.length ?? 0); index += 1) {
    const row = result.rows?.item(index) as LessonDownloadCardRow | undefined;
    if (!row || !row.origin || !row.source_type) continue;
    cards.push({
      lessonId: row.lesson_id,
      downloadedAt: row.downloaded_at,
      title: row.title ?? '',
      description: row.description ?? '',
      origin: row.origin as LessonDownloadCard['origin'],
      sourceType: row.source_type as LessonDownloadCard['sourceType'],
      generated: row.generated === 1,
      unit: row.unit_json
        ? (JSON.parse(row.unit_json) as LessonDownloadCard['unit'])
        : null,
      sentenceCount: row.sentence_count ?? 0,
      activityCount: row.activity_count ?? 0,
      youtubeVideoId: row.youtube_video_id,
      youtubeDurationMs: row.youtube_duration_ms,
    });
  }
  return cards;
}

export type SaveLessonSnapshotInput = {
  /** Raw `GET /api/v1/lessons/:id` body; validated before any write. */
  body: unknown;
  /** Relative media dir staged before the commit (or null when no media). */
  mediaDir?: string | null;
  now?: string;
};

/**
 * Validate the whole body, then write it with one `INSERT OR REPLACE`
 * statement. Throws `InvalidLessonSnapshotError` before touching the table,
 * so the old copy survives a failed redownload.
 */
export function saveLessonSnapshotBody(
  input: SaveLessonSnapshotInput,
  db: DatabaseConnection = getDatabase(),
): LessonDownloadRecord {
  const parsed = parseLessonSnapshotResponse(input.body);
  if (!parsed.ok) {
    throw new InvalidLessonSnapshotError(parsed.message);
  }
  const snapshot = parsed.response.lesson;
  const now = input.now ?? new Date().toISOString();
  const mediaDir = input.mediaDir ?? null;
  db.execute(
    `INSERT OR REPLACE INTO lesson_downloads (
      lesson_id, content_revision, server_revision, contract_version,
      snapshot_json, media_dir, downloaded_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?);`,
    [
      snapshot.id,
      snapshot.content_revision,
      null,
      parsed.response.contract_version,
      JSON.stringify(input.body),
      mediaDir,
      now,
    ],
  );
  const stored = getLessonDownload(snapshot.id, db);
  if (!stored) {
    throw new InvalidLessonSnapshotError(
      'Downloaded snapshot is not readable.',
    );
  }
  return stored;
}

export type RevisionApplication = {
  removed: string[];
  markedUpdate: string[];
};

/**
 * Apply an HTTP 200 revisions response (AD-007): `gone` removes the download
 * (row only; media sweeping is the caller's `sweepLessonMedia` step), a
 * higher `content_revision` sets the `server_revision` update marker, an
 * equal revision clears it. Callers must only pass success values from
 * `fetchLessonRevisions` — never a transport failure.
 */
export function applyLessonRevisionStates(
  states: LessonDownloadStatus[],
  db: DatabaseConnection = getDatabase(),
): RevisionApplication {
  const removed: string[] = [];
  const markedUpdate: string[] = [];
  for (const state of states) {
    if (state.state === 'gone') {
      db.execute('DELETE FROM lesson_downloads WHERE lesson_id = ?;', [
        state.lessonId,
      ]);
      removed.push(state.lessonId);
      continue;
    }
    if (state.contentRevision === null) continue;
    const row = firstRow<LessonDownloadRow>(
      db.execute(
        'SELECT * FROM lesson_downloads WHERE lesson_id = ? LIMIT 1;',
        [state.lessonId],
      ),
    );
    if (!row) continue;
    if (state.contentRevision > row.content_revision) {
      db.execute(
        'UPDATE lesson_downloads SET server_revision = ? WHERE lesson_id = ?;',
        [state.contentRevision, state.lessonId],
      );
      markedUpdate.push(state.lessonId);
    } else if (
      state.contentRevision <= row.content_revision &&
      row.server_revision !== null
    ) {
      db.execute(
        'UPDATE lesson_downloads SET server_revision = NULL WHERE lesson_id = ?;',
        [state.lessonId],
      );
    }
  }
  return {removed, markedUpdate};
}

/** Remove one download row. Media sweeping stays with `sweepLessonMedia`. */
export function removeLessonDownload(
  lessonId: string,
  db: DatabaseConnection = getDatabase(),
): void {
  db.execute('DELETE FROM lesson_downloads WHERE lesson_id = ?;', [lessonId]);
}

/**
 * Point the stored row at media staged after the row was written (the
 * learner tapped "Tải để học offline"). Only applies while the row still holds
 * `revision`, so media of an older revision never lands on a newer copy.
 * Returns whether the row was updated.
 */
export function setLessonMediaDir(
  lessonId: string,
  revision: number,
  mediaDir: string | null,
  db: DatabaseConnection = getDatabase(),
): boolean {
  const result = db.execute(
    'UPDATE lesson_downloads SET media_dir = ? WHERE lesson_id = ? AND content_revision = ?;',
    [mediaDir, lessonId, revision],
  );
  return (result.rowsAffected ?? 0) > 0;
}

/** The stored row's media dir, without parsing the snapshot. */
export function getLessonMediaDir(
  lessonId: string,
  db: DatabaseConnection = getDatabase(),
): string | null {
  const row = firstRow<{media_dir: string | null}>(
    db.execute(
      'SELECT media_dir FROM lesson_downloads WHERE lesson_id = ? LIMIT 1;',
      [lessonId],
    ),
  );
  return row?.media_dir ?? null;
}

/**
 * Forget one lesson's media; the lesson text stays. The files go with the
 * next `sweepLessonMedia`.
 */
export function removeLessonMedia(
  lessonId: string,
  db: DatabaseConnection = getDatabase(),
): void {
  db.execute(
    'UPDATE lesson_downloads SET media_dir = NULL WHERE lesson_id = ?;',
    [lessonId],
  );
}

/** Forget every lesson's media; the lesson texts stay. */
export function removeAllLessonMedia(
  db: DatabaseConnection = getDatabase(),
): void {
  db.execute(
    'UPDATE lesson_downloads SET media_dir = NULL WHERE media_dir IS NOT NULL;',
  );
}

export type LessonMediaDownload = {
  lessonId: string;
  title: string;
  mediaDir: string;
};

/** Lessons whose media is on the device, newest first. */
export function listLessonMediaDownloads(
  db: DatabaseConnection = getDatabase(),
): LessonMediaDownload[] {
  const result = db.execute(
    `SELECT lesson_id, media_dir,
            json_extract(snapshot_json, '$.lesson.title') AS title
       FROM lesson_downloads
      WHERE media_dir IS NOT NULL
      ORDER BY downloaded_at DESC;`,
  );
  const rows: LessonMediaDownload[] = [];
  for (let index = 0; index < (result.rows?.length ?? 0); index += 1) {
    const row = result.rows?.item(index) as
      {lesson_id: string; media_dir: string; title: string | null} | undefined;
    if (!row) continue;
    rows.push({
      lessonId: row.lesson_id,
      title: row.title ?? '',
      mediaDir: row.media_dir,
    });
  }
  return rows;
}

/**
 * Relative media directory for one staged revision, e.g.
 * `lesson-media/<lessonId>/<revision>`.
 */
export function lessonMediaDirFor(lessonId: string, revision: number): string {
  return `${LESSON_MEDIA_ROOT_SEGMENT}/${lessonId}/${revision}`;
}

export type LessonMediaFileSystem = {
  documentDir: () => string | null;
  mkdir: (path: string) => Promise<void>;
  unlink: (path: string) => Promise<void>;
  exists: (path: string) => Promise<boolean>;
  readdir: (path: string) => Promise<string[]>;
  /** Total bytes of the files directly in `path` (0 when unreadable). */
  dirSize?: (path: string) => Promise<number>;
  downloadFile: (url: string, destPath: string) => Promise<void>;
};

function deviceDocumentDir(): string | null {
  try {
    const base =
      typeof RNFS.DocumentDirectoryPath === 'string' &&
      RNFS.DocumentDirectoryPath.length > 0
        ? RNFS.DocumentDirectoryPath
        : null;
    return base;
  } catch {
    return null;
  }
}

async function defaultDownloadFile(
  url: string,
  destPath: string,
): Promise<void> {
  const result = await RNFS.downloadFile({fromUrl: url, toFile: destPath})
    .promise;
  if (result.statusCode < 200 || result.statusCode >= 300) {
    throw new Error(`Media download failed with HTTP ${result.statusCode}.`);
  }
}

async function defaultExists(path: string): Promise<boolean> {
  try {
    return await RNFS.exists(path);
  } catch {
    return false;
  }
}

async function defaultReaddir(path: string): Promise<string[]> {
  try {
    const entries = (await RNFS.readDir(path)) as Array<{name: string}>;
    return entries.map(entry => entry.name);
  } catch {
    return [];
  }
}

async function defaultDirSize(path: string): Promise<number> {
  try {
    const entries = (await RNFS.readDir(path)) as Array<{
      size: number | string;
      isFile: () => boolean;
    }>;
    return entries.reduce(
      (total, entry) => (entry.isFile() ? total + Number(entry.size) : total),
      0,
    );
  } catch {
    return 0;
  }
}

/** Production file-system binding (RNFS); tests inject a fake. */
export const defaultLessonMediaFileSystem: LessonMediaFileSystem = {
  documentDir: deviceDocumentDir,
  mkdir: async path => {
    await RNFS.mkdir(path);
  },
  unlink: async path => {
    await RNFS.unlink(path);
  },
  exists: defaultExists,
  readdir: defaultReaddir,
  dirSize: defaultDirSize,
  downloadFile: defaultDownloadFile,
};

/**
 * Stage media-block remote URLs into `lesson-media/<lessonId>/<revision>/`
 * before the row commit. Throws on the first failure, leaving the prior
 * download row untouched; partial staged files are swept by
 * `sweepLessonMedia`.
 */
export async function stageLessonMedia(
  lessonId: string,
  revision: number,
  remoteUrls: string[],
  fs: LessonMediaFileSystem = defaultLessonMediaFileSystem,
): Promise<string | null> {
  if (remoteUrls.length === 0) return null;
  const base = fs.documentDir();
  if (!base) return null;
  const relativeDir = lessonMediaDirFor(lessonId, revision);
  const absoluteDir = `${base}/${relativeDir}`;
  await fs.mkdir(absoluteDir);
  for (let index = 0; index < remoteUrls.length; index += 1) {
    const url = remoteUrls[index];
    await fs.downloadFile(url, `${absoluteDir}/media-${index}`);
  }
  return relativeDir;
}

/**
 * Sweep media directories that no download row references, plus revision
 * directories older than the stored row. Runs after every commit and at
 * startup. Never touches the directory of the currently stored revision.
 */
export async function sweepLessonMedia(
  db: DatabaseConnection = getDatabase(),
  fs: LessonMediaFileSystem = defaultLessonMediaFileSystem,
): Promise<{removed: string[]}> {
  const base = fs.documentDir();
  if (!base) return {removed: []};
  const referenced = new Set(
    listLessonDownloads(db)
      .map(record => record.mediaDir)
      .filter((dir): dir is string => dir !== null),
  );
  const root = `${base}/${LESSON_MEDIA_ROOT_SEGMENT}`;
  if (!(await fs.exists(root))) return {removed: []};
  const removed: string[] = [];
  const lessonIds = await fs.readdir(root);
  for (const lessonId of lessonIds) {
    const lessonDir = `${root}/${lessonId}`;
    let revisions: string[];
    try {
      revisions = await fs.readdir(lessonDir);
    } catch {
      continue;
    }
    for (const revision of revisions) {
      const relative = `${LESSON_MEDIA_ROOT_SEGMENT}/${lessonId}/${revision}`;
      if (!referenced.has(relative)) {
        try {
          await fs.unlink(`${base}/${relative}`);
          removed.push(relative);
        } catch {
          // Best-effort sweep; a locked file must not break startup.
        }
      }
    }
  }
  return {removed};
}

/** Bytes used by one lesson's staged media (0 when unknown). */
export async function lessonMediaSizeBytes(
  mediaDir: string,
  fs: LessonMediaFileSystem = defaultLessonMediaFileSystem,
): Promise<number> {
  const base = fs.documentDir();
  if (!base || !fs.dirSize) return 0;
  return fs.dirSize(`${base}/${mediaDir}`);
}
