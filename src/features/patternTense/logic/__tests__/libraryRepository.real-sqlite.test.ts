import {readCatalogItems} from '@core/db/catalogItems';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';
import {catalogItem} from '@test/support/catalogItemFixture';

import {
  memoryOf,
  readPatternLibrary,
  readTenseImageUrl,
  readTenseLibrary,
  saveLearnedItems,
  savePatternLibrary,
  saveTenseLibrary,
} from '../libraryRepository';

/** Vocab path P6: the pattern library and the tense map are kept on the device and read back offline. */

const NOW = new Date('2026-10-16T08:00:00.000Z');

beforeEach(() => {
  const db = openRealSqlite();
  resetDatabaseForTests(db);
  runMigrations(db);
});

afterEach(() => {
  resetDatabaseForTests(null);
});

test('nothing is kept before the first download', () => {
  expect(readPatternLibrary()).toBeNull();
  expect(readTenseLibrary()).toBeNull();
});

test('the pattern library is kept with its levels, tags and filters', () => {
  const worth = catalogItem('pattern:worth', 'pattern', 'It is worth {x}');
  savePatternLibrary(
    {
      request_id: 'r',
      status: 'success',
      patterns: [{item: worth, cefr_level: 'B2', tags: ['function:emphasis']}],
      functions: [{code: 'function:emphasis', label_vi: 'Nhấn mạnh'}],
      exams: [{code: 'exam:ielts-writing', label_vi: 'IELTS'}],
    },
    NOW,
  );
  expect(readPatternLibrary()).toEqual({
    patterns: [{item: worth, cefrLevel: 'B2', tags: ['function:emphasis']}],
    functions: [{code: 'function:emphasis', labelVi: 'Nhấn mạnh'}],
    exams: [{code: 'exam:ielts-writing', labelVi: 'IELTS'}],
  });
  expect(readCatalogItems(['pattern:worth']).get('pattern:worth')).toEqual(
    worth,
  );
});

test('the tense map is kept with each tense place; a newer download replaces it', () => {
  const past = catalogItem('grammar:past-simple', 'grammar', 'Past simple');
  const save = (
    tenses: Array<{
      item: typeof past;
      time: string;
      aspect: string;
      image_url?: string | null;
    }>,
  ) => saveTenseLibrary({request_id: 'r', status: 'success', tenses}, NOW);
  save([
    {
      item: past,
      time: 'past',
      aspect: 'simple',
      image_url: 'https://media.example.test/past.png',
    },
  ]);
  expect(readTenseLibrary()).toEqual([
    {
      item: past,
      time: 'past',
      aspect: 'simple',
      imageUrl: 'https://media.example.test/past.png',
    },
  ]);
  expect(readTenseImageUrl('grammar:past-simple')).toBe(
    'https://media.example.test/past.png',
  );
  save([]);
  expect(readTenseLibrary()).toEqual([]);
});

test('learned items are kept for review and their schedule is read by code', () => {
  const tense = catalogItem(
    'grammar:present-perfect',
    'grammar',
    'Present perfect',
  );
  saveLearnedItems([tense], NOW);
  expect(readCatalogItems([tense.code]).get(tense.code)).toEqual(tense);
  expect(memoryOf(tense.code)).toBeNull();
  getDatabase().execute(
    `INSERT INTO item_memory (item_code, stage, due_at, stable_at, last_result, last_reviewed_at, updated_at)
     VALUES (?, 3, ?, NULL, 'correct', ?, ?);`,
    [tense.code, NOW.toISOString(), NOW.toISOString(), NOW.toISOString()],
  );
  expect(memoryOf(tense.code)).toEqual({stage: 3, stableAt: null});
});
