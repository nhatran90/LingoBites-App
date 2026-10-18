/**
 * Vocab path P6: the pattern library's filters and the tense map's grid,
 * without storage or network.
 */
import type {CatalogItem} from '@core/schemas/lesson';

export type LibraryFilter = {code: string; labelVi: string};

export type LibraryPattern = {
  item: CatalogItem;
  cefrLevel: string | null;
  tags: string[];
};

export type LibraryTense = {
  item: CatalogItem;
  time: string | null;
  aspect: string | null;
  /** Picture drawn behind the tense's tile; a default face without one. */
  imageUrl?: string | null;
};

export type PatternQuery = {
  text: string;
  functionCode: string | null;
  cefrLevel: string | null;
  examCode: string | null;
};

const fold = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\u0111/g, 'd');

/** Patterns matching the text (frame or meaning) and every chosen filter. */
export function filterPatterns(
  patterns: readonly LibraryPattern[],
  query: PatternQuery,
): LibraryPattern[] {
  const text = fold(query.text.trim());
  return patterns.filter(
    pattern =>
      (text === '' ||
        fold(pattern.item.text).includes(text) ||
        fold(pattern.item.meaning_vi).includes(text)) &&
      (query.functionCode === null ||
        pattern.tags.includes(query.functionCode)) &&
      (query.examCode === null || pattern.tags.includes(query.examCode)) &&
      (query.cefrLevel === null || pattern.cefrLevel === query.cefrLevel),
  );
}

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

/** The levels the patterns use, in CEFR order. */
export function patternLevels(patterns: readonly LibraryPattern[]): string[] {
  const levels = new Set(
    patterns
      .map(pattern => pattern.cefrLevel)
      .filter((level): level is string => level !== null),
  );
  return CEFR_ORDER.filter(level => levels.has(level));
}

/** Function labels of a pattern, in the order of the filter list. */
export function functionLabels(
  pattern: LibraryPattern,
  functions: readonly LibraryFilter[],
): string[] {
  return functions
    .filter(entry => pattern.tags.includes(entry.code))
    .map(entry => entry.labelVi);
}

export const TENSE_TIMES = ['past', 'present', 'future'] as const;
export const TENSE_ASPECTS = [
  'simple',
  'continuous',
  'perfect',
  'perfect_continuous',
] as const;

export type TenseGrid = {
  /** `cells[time][aspect]`: the tense in that cell, or null. */
  cells: Array<Array<LibraryTense | null>>;
  /** Tenses outside the 3 × 4 grid (e.g. be going to). */
  others: LibraryTense[];
};

/** Lays the tenses on the time × aspect grid; anything else goes below it. */
export function tenseGrid(tenses: readonly LibraryTense[]): TenseGrid {
  const cells = TENSE_TIMES.map(() =>
    TENSE_ASPECTS.map(() => null as LibraryTense | null),
  );
  const others: LibraryTense[] = [];
  for (const tense of tenses) {
    const row = TENSE_TIMES.indexOf(tense.time as (typeof TENSE_TIMES)[number]);
    const column = TENSE_ASPECTS.indexOf(
      tense.aspect as (typeof TENSE_ASPECTS)[number],
    );
    if (row < 0 || column < 0 || cells[row]![column]) {
      others.push(tense);
    } else {
      cells[row]![column] = tense;
    }
  }
  return {cells, others};
}

/** How well a tense is remembered, for its colour on the map. */
export type MemoryLevel = 'new' | 'started' | 'recalling' | 'stable';

export function memoryLevel(
  memory: {stage: number; stableAt: string | null} | null,
): MemoryLevel {
  if (!memory) return 'new';
  if (memory.stableAt || memory.stage >= 4) return 'stable';
  return memory.stage >= 2 ? 'recalling' : 'started';
}

/** The parts of a tense payload the detail shows; anything missing is left out. */
export type TenseInfo = {
  forms: {affirmative: string; negative: string; question: string} | null;
  signals: string[];
  usesVi: string[];
  contrastWith: string[];
};

const strings = (value: unknown): string[] =>
  Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string')
    : [];

export function tenseInfo(payload: Record<string, unknown>): TenseInfo {
  const forms = payload.forms as Record<string, unknown> | undefined;
  const hasForms =
    typeof forms?.affirmative === 'string' &&
    typeof forms?.negative === 'string' &&
    typeof forms?.question === 'string';
  return {
    forms: hasForms
      ? {
          affirmative: forms!.affirmative as string,
          negative: forms!.negative as string,
          question: forms!.question as string,
        }
      : null,
    signals: strings(payload.signals),
    usesVi: strings(payload.uses_vi),
    contrastWith: strings(payload.contrast_with),
  };
}
