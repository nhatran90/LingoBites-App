/**
 * Vocab path P6: the pattern library and the tense map kept on the device.
 * Item content goes to `catalog_items` (source `library`, so review and the
 * detail screens read it offline); the levels, tags, filters and grid places,
 * which a catalog item does not carry, go to one `app_settings` row each. No
 * schema change.
 */
import {readCatalogItems, saveCatalogItems} from '@core/db/catalogItems';
import {getDatabase, withTransaction} from '@core/db/database';
import type {CatalogItem} from '@core/schemas/lesson';
import {getItemMemory} from '@core/sync/learningOutcomes';

import type {PatternLibrary, TenseLibrary} from './libraryClient';
import type {LibraryFilter, LibraryPattern, LibraryTense} from './libraryModel';

const PATTERNS_KEY = 'library_patterns_v1';
const TENSES_KEY = 'library_tenses_v1';
export const LIBRARY_SOURCE = 'library';

type PatternIndex = {
  patterns: Array<{code: string; cefrLevel: string | null; tags: string[]}>;
  functions: LibraryFilter[];
  exams: LibraryFilter[];
  savedAt: string;
};

type TenseIndex = {
  tenses: Array<{
    code: string;
    time: string | null;
    aspect: string | null;
    /** Missing in lists kept before pictures came. */
    imageUrl?: string | null;
  }>;
  savedAt: string;
};

function writeSetting(key: string, value: unknown, at: string): void {
  getDatabase().execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    [key, JSON.stringify(value), at],
  );
}

function readSetting<T>(key: string): T | null {
  const row = getDatabase()
    .execute('SELECT value FROM app_settings WHERE key = ? LIMIT 1;', [key])
    .rows?.item(0) as {value?: string} | undefined;
  if (!row?.value) return null;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return null;
  }
}

export function savePatternLibrary(library: PatternLibrary, now: Date): void {
  const at = now.toISOString();
  const db = getDatabase();
  withTransaction(db, () => {
    saveCatalogItems(
      library.patterns.map(entry => entry.item),
      LIBRARY_SOURCE,
      at,
    );
    writeSetting(
      PATTERNS_KEY,
      {
        patterns: library.patterns.map(entry => ({
          code: entry.item.code,
          cefrLevel: entry.cefr_level,
          tags: entry.tags,
        })),
        functions: library.functions.map(entry => ({
          code: entry.code,
          labelVi: entry.label_vi,
        })),
        exams: library.exams.map(entry => ({
          code: entry.code,
          labelVi: entry.label_vi,
        })),
        savedAt: at,
      } satisfies PatternIndex,
      at,
    );
  });
}

export function saveTenseLibrary(library: TenseLibrary, now: Date): void {
  const at = now.toISOString();
  const db = getDatabase();
  withTransaction(db, () => {
    saveCatalogItems(
      library.tenses.map(entry => entry.item),
      LIBRARY_SOURCE,
      at,
    );
    writeSetting(
      TENSES_KEY,
      {
        tenses: library.tenses.map(entry => ({
          code: entry.item.code,
          time: entry.time,
          aspect: entry.aspect,
          imageUrl: entry.image_url ?? null,
        })),
        savedAt: at,
      } satisfies TenseIndex,
      at,
    );
  });
}

export type StoredPatterns = {
  patterns: LibraryPattern[];
  functions: LibraryFilter[];
  exams: LibraryFilter[];
};

/** The patterns kept on the device, or null before the first download. */
export function readPatternLibrary(): StoredPatterns | null {
  const index = readSetting<PatternIndex>(PATTERNS_KEY);
  if (!index) return null;
  const items = readCatalogItems(index.patterns.map(entry => entry.code));
  return {
    patterns: index.patterns.flatMap(entry => {
      const item = items.get(entry.code);
      return item ? [{item, cefrLevel: entry.cefrLevel, tags: entry.tags}] : [];
    }),
    functions: index.functions,
    exams: index.exams,
  };
}

/** The tenses kept on the device, or null before the first download. */
export function readTenseLibrary(): LibraryTense[] | null {
  const index = readSetting<TenseIndex>(TENSES_KEY);
  if (!index) return null;
  const items = readCatalogItems(index.tenses.map(entry => entry.code));
  return index.tenses.flatMap(entry => {
    const item = items.get(entry.code);
    return item
      ? [
          {
            item,
            time: entry.time,
            aspect: entry.aspect,
            imageUrl: entry.imageUrl ?? null,
          },
        ]
      : [];
  });
}

/** The picture of one kept tense, or null. */
export function readTenseImageUrl(code: string): string | null {
  const index = readSetting<TenseIndex>(TENSES_KEY);
  return index?.tenses.find(entry => entry.code === code)?.imageUrl ?? null;
}

/** Keeps learned items' content on the device, so review can ask them offline. */
export function saveLearnedItems(
  items: readonly CatalogItem[],
  now: Date,
): void {
  if (items.length === 0) return;
  const db = getDatabase();
  withTransaction(db, () =>
    saveCatalogItems(items, LIBRARY_SOURCE, now.toISOString()),
  );
}

/** One item's review schedule on the device, or null when it is not scheduled. */
export function memoryOf(
  itemCode: string,
): {stage: number; stableAt: string | null} | null {
  try {
    const memory = getItemMemory(itemCode);
    return memory ? {stage: memory.stage, stableAt: memory.stableAt} : null;
  } catch {
    return null;
  }
}
