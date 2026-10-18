import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

import {
  openRealSqlite,
  type RealSqliteConnection,
} from '@test/support/adversarial/realSqlite';

import {
  applyLessonRevisionStates,
  getLessonDownload,
  getLessonDownloadsSignature,
  getLessonMediaDir,
  InvalidLessonSnapshotError,
  lessonMediaDirFor,
  type LessonMediaFileSystem,
  lessonMediaSizeBytes,
  listLessonDownloadCards,
  listLessonDownloadKinds,
  listLessonDownloads,
  listLessonMediaDownloads,
  removeAllLessonMedia,
  removeLessonMedia,
  saveLessonSnapshotBody,
  setLessonMediaDir,
  stageLessonMedia,
  sweepLessonMedia,
} from '../canonicalDownloadRepository';

const SNAPSHOT_FIXTURE_PATH = path.join(
  __dirname,
  '..',
  '..',
  '..',
  '..',
  '..',
  'core',
  'schemas',
  '__tests__',
  'fixtures',
  'valid-lesson-snapshot-response.json',
);

function loadSnapshotBody(): Record<string, unknown> {
  return JSON.parse(fs.readFileSync(SNAPSHOT_FIXTURE_PATH, 'utf8')) as Record<
    string,
    unknown
  >;
}

function bodyWithRevision(body: Record<string, unknown>, revision: number) {
  const next = JSON.parse(JSON.stringify(body)) as {
    contract_version: number;
    lesson: {id: string; content_revision: number};
  };
  next.lesson.content_revision = revision;
  return next;
}

function lessonIdOf(body: Record<string, unknown>): string {
  return (body as {lesson: {id: string}}).lesson.id;
}

/** In-memory fake of the media file system (kill = thrown download). */
function makeFakeFs(options: {failOnUrl?: string} = {}): {
  fs: LessonMediaFileSystem;
  files: Map<string, string>;
} {
  const files = new Map<string, string>();
  const fsImpl: LessonMediaFileSystem = {
    documentDir: () => '/fake-documents',
    mkdir: async () => {},
    unlink: async target => {
      for (const key of [...files.keys()]) {
        if (key === target || key.startsWith(`${target}/`)) {
          files.delete(key);
        }
      }
    },
    exists: async target =>
      [...files.keys()].some(
        key => key === target || key.startsWith(`${target}/`),
      ),
    readdir: async target => {
      const prefix = `${target}/`;
      const names = new Set<string>();
      for (const key of files.keys()) {
        if (key.startsWith(prefix)) {
          names.add(key.slice(prefix.length).split('/')[0]);
        }
      }
      return [...names];
    },
    downloadFile: async (url, destPath) => {
      if (options.failOnUrl && url === options.failOnUrl) {
        throw new Error('killed during media fetch');
      }
      files.set(destPath, `bytes-for:${url}`);
    },
  };
  return {fs: fsImpl, files};
}

let dir: string;
let dbFile: string;
let connection: RealSqliteConnection;

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'lingo-canonical-download-'));
  dbFile = path.join(dir, 'lingobites.sqlite');
  connection = openRealSqlite(dbFile);
  resetDatabaseForTests(connection);
  runMigrations(getDatabase());
});

afterEach(() => {
  resetDatabaseForTests(null);
  connection.close();
  fs.rmSync(dir, {recursive: true, force: true});
});

describe('canonical download repository (real SQLite, INV-007)', () => {
  it('stores a valid snapshot as one readable row', () => {
    const body = loadSnapshotBody();
    const stored = saveLessonSnapshotBody({body}, getDatabase());
    expect(stored.lessonId).toBe(lessonIdOf(body));
    expect(stored.contentRevision).toBe(
      (body as {lesson: {content_revision: number}}).lesson.content_revision,
    );
    expect(stored.serverRevision).toBeNull();
    const read = getLessonDownload(stored.lessonId, getDatabase());
    expect(read?.snapshot.sentences).toHaveLength(
      (body as {lesson: {sentences: unknown[]}}).lesson.sentences.length,
    );
    // Stored analyses are the download-time analyses only (AD-005).
    expect(read?.snapshot.analyses).toEqual(
      (body as {lesson: {analyses: unknown}}).lesson.analyses,
    );
  });

  it('an invalid body leaves the prior row untouched', () => {
    const body = loadSnapshotBody();
    const lessonId = lessonIdOf(body);
    const stored = saveLessonSnapshotBody({body}, getDatabase());
    expect(() =>
      saveLessonSnapshotBody({body: {contract_version: 1}}, getDatabase()),
    ).toThrow(InvalidLessonSnapshotError);
    const kept = getLessonDownload(lessonId, getDatabase());
    expect(kept?.contentRevision).toBe(stored.contentRevision);
    expect(kept?.snapshot.sentences).toHaveLength(
      stored.snapshot.sentences.length,
    );
  });

  it('a truncated body (sentence missing IPA) leaves the prior row untouched', () => {
    const body = loadSnapshotBody();
    const lessonId = lessonIdOf(body);
    const before = saveLessonSnapshotBody({body}, getDatabase());
    const truncated = JSON.parse(JSON.stringify(body)) as {
      lesson: {sentences: Array<Record<string, unknown>>};
    };
    delete truncated.lesson.sentences[0].ipa;
    expect(() =>
      saveLessonSnapshotBody({body: truncated}, getDatabase()),
    ).toThrow(InvalidLessonSnapshotError);
    const kept = getLessonDownload(lessonId, getDatabase());
    expect(kept?.contentRevision).toBe(before.contentRevision);
  });

  it('a valid replacement changes the revision atomically', () => {
    const body = loadSnapshotBody();
    const lessonId = lessonIdOf(body);
    saveLessonSnapshotBody({body}, getDatabase());
    const replacement = bodyWithRevision(body, 9);
    const stored = saveLessonSnapshotBody({body: replacement}, getDatabase());
    expect(stored.contentRevision).toBe(9);
    expect(listLessonDownloads(getDatabase())).toHaveLength(1);
    expect(
      getLessonDownload(lessonId, getDatabase())?.snapshot.content_revision,
    ).toBe(9);
  });

  it('lists each download kind without parsing the body', () => {
    const body = loadSnapshotBody();
    saveLessonSnapshotBody({body}, getDatabase());
    expect(listLessonDownloadKinds(getDatabase())).toEqual([
      {lessonId: lessonIdOf(body), origin: 'admin', sourceType: 'admin_text'},
    ]);
  });

  it('lists the card fields of each download without parsing the body', () => {
    const lesson = loadSnapshotBody();
    const video = JSON.parse(JSON.stringify(lesson)) as {
      lesson: Record<string, unknown>;
    };
    video.lesson.id = '33333333-3333-4333-8333-333333333399';
    video.lesson.origin = 'learner';
    video.lesson.source_type = 'youtube';
    video.lesson.unit = null;
    video.lesson.generated = true;
    video.lesson.youtube = {video_id: 'abc123', duration_ms: 272000};
    saveLessonSnapshotBody(
      {body: lesson, now: '2026-10-01T00:00:00.000Z'},
      getDatabase(),
    );
    saveLessonSnapshotBody(
      {body: video, now: '2026-10-02T00:00:00.000Z'},
      getDatabase(),
    );
    // A body that is not JSON is skipped, as the full read skips it.
    getDatabase().execute(
      `INSERT INTO lesson_downloads (lesson_id, content_revision,
         server_revision, contract_version, snapshot_json, media_dir,
         downloaded_at)
       VALUES ('broken', 1, NULL, 1, '{not json', NULL, '2026-10-03');`,
    );

    const cards = listLessonDownloadCards(getDatabase());
    // Same lessons, order and values as reading the whole snapshots.
    const records = listLessonDownloads(getDatabase()).slice().reverse();
    expect(cards.map(card => card.lessonId)).toEqual(
      records.map(record => record.lessonId),
    );
    cards.forEach((card, index) => {
      const {snapshot, downloadedAt} = records[index]!;
      expect(card).toEqual({
        lessonId: snapshot.id,
        downloadedAt,
        title: snapshot.title,
        description: snapshot.description,
        origin: snapshot.origin,
        sourceType: snapshot.source_type,
        generated: snapshot.generated === true,
        unit: snapshot.unit,
        sentenceCount: snapshot.sentences.length,
        activityCount: snapshot.blocks.filter(
          block => block.type === 'activity',
        ).length,
        youtubeVideoId: snapshot.youtube?.video_id ?? null,
        youtubeDurationMs: snapshot.youtube?.duration_ms ?? null,
      });
    });
    expect(cards[1]).toMatchObject({
      sourceType: 'youtube',
      generated: true,
      youtubeVideoId: 'abc123',
      youtubeDurationMs: 272000,
    });
  });

  it('changes the signature only when a download changes', () => {
    const body = loadSnapshotBody();
    const lessonId = lessonIdOf(body);
    const empty = getLessonDownloadsSignature(getDatabase());
    saveLessonSnapshotBody(
      {body, now: '2026-10-01T00:00:00.000Z'},
      getDatabase(),
    );
    const saved = getLessonDownloadsSignature(getDatabase());
    expect(saved).not.toBe(empty);
    expect(getLessonDownloadsSignature(getDatabase())).toBe(saved);

    applyLessonRevisionStates(
      [{lessonId, state: 'current', contentRevision: 99}],
      getDatabase(),
    );
    expect(getLessonDownloadsSignature(getDatabase())).not.toBe(saved);
  });

  it('re-reads a download only after it was re-downloaded', () => {
    const body = loadSnapshotBody();
    saveLessonSnapshotBody(
      {body, now: '2026-10-01T00:00:00.000Z'},
      getDatabase(),
    );
    const first = listLessonDownloads(getDatabase())[0];
    expect(listLessonDownloads(getDatabase())[0]).toBe(first);

    saveLessonSnapshotBody(
      {body: bodyWithRevision(body, 9), now: '2026-10-02T00:00:00.000Z'},
      getDatabase(),
    );
    const next = listLessonDownloads(getDatabase())[0];
    expect(next).not.toBe(first);
    expect(next.contentRevision).toBe(9);
  });

  it('a kill during the media fetch leaves the prior copy readable', async () => {
    const body = loadSnapshotBody();
    const lessonId = lessonIdOf(body);
    saveLessonSnapshotBody({body}, getDatabase());
    const {fs: fakeFs} = makeFakeFs({
      failOnUrl: 'https://cdn.example/audio.mp3',
    });
    await expect(
      stageLessonMedia(lessonId, 4, ['https://cdn.example/audio.mp3'], fakeFs),
    ).rejects.toThrow('killed during media fetch');
    // The row commit never ran: the prior copy is still readable.
    const kept = getLessonDownload(lessonId, getDatabase());
    expect(kept?.snapshot.sentences.length).toBeGreaterThan(0);
  });

  it('staged media commits with the row and sweeps the older revision', async () => {
    const body = loadSnapshotBody();
    const lessonId = lessonIdOf(body);
    const {fs: fakeFs, files} = makeFakeFs();
    const first = await stageLessonMedia(
      lessonId,
      3,
      ['https://cdn.example/a.mp3'],
      fakeFs,
    );
    saveLessonSnapshotBody({body, mediaDir: first}, getDatabase());
    const second = await stageLessonMedia(
      lessonId,
      4,
      ['https://cdn.example/b.mp3'],
      fakeFs,
    );
    saveLessonSnapshotBody(
      {
        body: bodyWithRevision(body, 4),
        mediaDir: second,
      },
      getDatabase(),
    );
    const swept = await sweepLessonMedia(getDatabase(), fakeFs);
    expect(swept.removed).toContain(lessonMediaDirFor(lessonId, 3));
    expect(swept.removed).not.toContain(lessonMediaDirFor(lessonId, 4));
    expect([...files.keys()].some(key => key.includes('/4/'))).toBe(true);
  });

  it('removes the copy only on a positive gone, never on transport failure', () => {
    const body = loadSnapshotBody();
    const lessonId = lessonIdOf(body);
    saveLessonSnapshotBody({body}, getDatabase());
    // A higher revision only sets the update marker ("có bản mới").
    const marked = applyLessonRevisionStates(
      [{lessonId, state: 'current', contentRevision: 99}],
      getDatabase(),
    );
    expect(marked.markedUpdate).toEqual([lessonId]);
    expect(getLessonDownload(lessonId, getDatabase())?.serverRevision).toBe(99);
    // An equal revision clears the marker.
    applyLessonRevisionStates(
      [{lessonId, state: 'current', contentRevision: 3}],
      getDatabase(),
    );
    expect(
      getLessonDownload(lessonId, getDatabase())?.serverRevision,
    ).toBeNull();
    // Positive gone removes the row (HTTP 200 is enforced by the client:
    // transport failures surface as client errors, never as states).
    const removed = applyLessonRevisionStates(
      [{lessonId, state: 'gone'}],
      getDatabase(),
    );
    expect(removed.removed).toEqual([lessonId]);
    expect(getLessonDownload(lessonId, getDatabase())).toBeNull();
  });
});

describe('learner-managed lesson media (offline download consent)', () => {
  it('attaches media staged after the row and lists it with the title', async () => {
    const body = loadSnapshotBody();
    const lessonId = lessonIdOf(body);
    saveLessonSnapshotBody({body}, getDatabase());
    const {fs: fakeFs} = makeFakeFs();
    const staged = await stageLessonMedia(
      lessonId,
      3,
      ['https://cdn.example/a.mp3'],
      fakeFs,
    );
    expect(setLessonMediaDir(lessonId, 3, staged, getDatabase())).toBe(true);
    expect(getLessonMediaDir(lessonId, getDatabase())).toBe(staged);
    // The parsed-row cache sees the new media dir.
    expect(listLessonDownloads(getDatabase())[0].mediaDir).toBe(staged);
    expect(listLessonMediaDownloads(getDatabase())).toEqual([
      {lessonId, title: 'Morning routine', mediaDir: staged},
    ]);
  });

  it('never attaches media of another revision', () => {
    const body = loadSnapshotBody();
    const lessonId = lessonIdOf(body);
    saveLessonSnapshotBody({body}, getDatabase());
    expect(
      setLessonMediaDir(
        lessonId,
        99,
        lessonMediaDirFor(lessonId, 99),
        getDatabase(),
      ),
    ).toBe(false);
    expect(getLessonMediaDir(lessonId, getDatabase())).toBeNull();
  });

  it('removing media keeps the lesson text and sweeps the files', async () => {
    const body = loadSnapshotBody();
    const lessonId = lessonIdOf(body);
    const {fs: fakeFs, files} = makeFakeFs();
    const staged = await stageLessonMedia(
      lessonId,
      3,
      ['https://cdn.example/a.mp3'],
      fakeFs,
    );
    saveLessonSnapshotBody({body, mediaDir: staged}, getDatabase());
    removeLessonMedia(lessonId, getDatabase());
    await sweepLessonMedia(getDatabase(), fakeFs);
    expect(files.size).toBe(0);
    expect(getLessonDownload(lessonId, getDatabase())?.mediaDir).toBeNull();
    expect(
      getLessonDownload(lessonId, getDatabase())?.snapshot.sentences.length,
    ).toBeGreaterThan(0);
    expect(listLessonMediaDownloads(getDatabase())).toEqual([]);
  });

  it('removing all media keeps every lesson text', async () => {
    const body = loadSnapshotBody();
    const {fs: fakeFs} = makeFakeFs();
    const staged = await stageLessonMedia(
      lessonIdOf(body),
      3,
      ['https://cdn.example/a.mp3'],
      fakeFs,
    );
    saveLessonSnapshotBody({body, mediaDir: staged}, getDatabase());
    removeAllLessonMedia(getDatabase());
    expect(listLessonMediaDownloads(getDatabase())).toEqual([]);
    expect(listLessonDownloads(getDatabase())).toHaveLength(1);
  });

  it('measures a media dir through the file system', async () => {
    const {fs: fakeFs} = makeFakeFs();
    const sized: LessonMediaFileSystem = {
      ...fakeFs,
      dirSize: async target =>
        target === '/fake-documents/lesson-media/x/3' ? 2048 : 0,
    };
    await expect(lessonMediaSizeBytes('lesson-media/x/3', sized)).resolves.toBe(
      2048,
    );
    await expect(
      lessonMediaSizeBytes('lesson-media/x/3', fakeFs),
    ).resolves.toBe(0);
  });
});
