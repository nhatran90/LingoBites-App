import {
  type FrameSegment,
  isWordLearningItem,
  learningItemsFromSnapshot,
  type ListeningPayload,
  parseFrame,
  parseItemCode,
  parseItemPayload,
  type PatternPayload,
  type PronunciationPayload,
} from '@core/learning';
import type {
  Audience,
  CatalogItem,
  LessonAnalysis,
  LessonBlock,
  LessonItemEntry,
  LessonSentence,
  LessonSituation,
  LessonSnapshot,
} from '@core/schemas/lesson';

export type LessonItemRole = LessonItemEntry['role'];
export type LessonItemIntroduction = LessonItemEntry['introduction'];

/** One vocabulary row in the lesson hub / vocabulary section. */
export type LessonVocabularyEntry = {
  /** Catalog item code: the flashcard identity. */
  key: string;
  itemId: string | null;
  word: string;
  meaning: string;
  ipa: string | null;
  pos: string | null;
  /** Catalog lessons only; null for learner-made lessons. */
  role: LessonItemRole | null;
  introduction: LessonItemIntroduction | null;
};

/** "Sau bài này bạn sẽ…": the lesson specification shown on the hub. */
export type LessonOutcome = {
  canDo: string[];
  situation: LessonSituation | null;
  estimatedMinutes: number | null;
  audience: Audience;
  prerequisites: {lessonId: string; code: string | null; title: string}[];
};

export type LessonExampleEntry = {en: string; vi: string};

export type LessonPatternSlotEntry = {
  name: string;
  labelVi: string;
  /** Plain values first, then the referenced items' text, in stored order. */
  choices: string[];
};

export type LessonPatternEntry = {
  key: string;
  itemId: string;
  /** The raw frame: `Can I have a {size} {drink}, please?`. */
  frame: string;
  meaningVi: string;
  noteVi: string | null;
  role: LessonItemRole;
  introduction: LessonItemIntroduction;
  segments: FrameSegment[];
  slots: LessonPatternSlotEntry[];
  variants: {text: string; noteVi: string | null}[];
  errors: {
    code: string;
    descriptionVi: string;
    feedbackVi: string;
    tolerated: boolean;
    wrongExample: string | null;
    rightExample: string | null;
  }[];
  examples: LessonExampleEntry[];
};

export type LessonPronunciationEntry = {
  key: string;
  /** The catalog item id, which pronunciation scoring (step 3) is sent with. */
  itemId: string;
  text: string;
  meaningVi: string;
  focus: string;
  focusIpa: string | null;
  tipVi: string;
  minimalPairs: [string, string][];
  examples: LessonExampleEntry[];
};

export type LessonListeningEntry = {
  key: string;
  /** What the learner listens to (read aloud with TTS until item audio ships). */
  text: string;
  meaningVi: string;
  questionEn: string;
  questionVi: string | null;
  answer: string;
};

export type LessonHubSection =
  | 'sentences'
  | 'vocabulary'
  | 'grammar'
  | 'patterns'
  | 'pronunciation'
  | 'listening';

export type LessonHubSectionRow = {section: LessonHubSection; count: number};

/** One grammar card in the lesson hub / grammar section. */
export type LessonGrammarEntry = {
  key: string;
  name: string;
  nameVi: string | null;
  formula: string | null;
  explanation: string | null;
  /** Sentence-level analysis of how the point is used in this lesson. */
  inText: string | null;
  examples: {en: string; vi: string | null}[];
};

export function sortedSentences(snapshot: LessonSnapshot): LessonSentence[] {
  return [...snapshot.sentences].sort((a, b) => a.position - b.position);
}

export function sortedBlocks(snapshot: LessonSnapshot): LessonBlock[] {
  return [...snapshot.blocks].sort((a, b) => a.position - b.position);
}

/**
 * Stored analyses plus the ones fetched after download, keyed by sentence.
 * Display-only: the merged map is never written back to storage (AD-005).
 */
export function mergeAnalyses(
  stored: Record<string, LessonAnalysis>,
  late?: Record<string, LessonAnalysis>,
): Record<string, LessonAnalysis> {
  return {...stored, ...late};
}

/**
 * Lesson-level vocabulary: the words and phrases among the lesson's learning
 * items (catalog items of a curriculum lesson, else the analysed words) in
 * lesson order, required before extended. Duplicate words (case-insensitive)
 * keep the first occurrence.
 */
export function collectLessonVocabulary(
  snapshot: LessonSnapshot,
  analyses: Record<string, LessonAnalysis>,
): LessonVocabularyEntry[] {
  const seen = new Set<string>();
  const result: LessonVocabularyEntry[] = [];
  learningItemsFromSnapshot(snapshot, analyses)
    .filter(isWordLearningItem)
    .forEach(item => {
      const id = item.word.toLowerCase();
      if (seen.has(id)) return;
      seen.add(id);
      result.push({
        key: item.itemKey,
        itemId: item.itemId,
        word: item.word,
        meaning: item.meaningVi,
        ipa: item.ipa,
        pos: item.pos,
        role: item.role,
        introduction: item.introduction,
      });
    });
  // Required items first, then extended ones; lesson order within each group.
  return result
    .map((entry, index) => ({entry, index}))
    .sort(
      (a, b) =>
        roleRank(a.entry.role) - roleRank(b.entry.role) || a.index - b.index,
    )
    .map(({entry}) => entry);
}

function roleRank(role: LessonItemRole | null): number {
  return role === 'extended' ? 1 : 0;
}

/**
 * Lesson-level grammar from the per-sentence analyses (learner-made lessons).
 * Curriculum lessons teach sentence patterns as items instead
 * (`collectLessonPatterns`).
 */
export function collectLessonGrammar(
  snapshot: LessonSnapshot,
  analyses: Record<string, LessonAnalysis>,
): LessonGrammarEntry[] {
  const byName = new Map<string, LessonGrammarEntry>();
  const result: LessonGrammarEntry[] = [];
  sortedSentences(snapshot).forEach(sentence => {
    analyses[sentence.id]?.grammar.forEach(item => {
      if (byName.has(item.name.toLowerCase())) return;
      const entry: LessonGrammarEntry = {
        key: item.id,
        name: item.name,
        nameVi: null,
        formula: item.formula,
        explanation: item.description,
        inText: item.analysis,
        examples: [{en: sentence.text_en, vi: sentence.text_vi}],
      };
      byName.set(item.name.toLowerCase(), entry);
      result.push(entry);
    });
  });
  return result;
}

/** The lesson specification for the hub card; null without a can-do. */
export function collectLessonOutcome(
  snapshot: LessonSnapshot,
): LessonOutcome | null {
  const spec = snapshot.spec;
  if (!spec) return null;
  const canDo = spec.can_do.map(line => line.trim()).filter(Boolean);
  if (canDo.length === 0) return null;
  return {
    canDo,
    situation: spec.situation,
    estimatedMinutes: spec.estimated_minutes,
    audience: spec.audience,
    prerequisites: spec.prerequisites.map(prerequisite => ({
      lessonId: prerequisite.lesson_id,
      code: prerequisite.code,
      title: prerequisite.title,
    })),
  };
}

function sortedLessonItems(snapshot: LessonSnapshot): LessonItemEntry[] {
  return [...(snapshot.lesson_items ?? [])].sort(
    (a, b) => a.position - b.position,
  );
}

function lessonAudience(snapshot: LessonSnapshot): Audience {
  return snapshot.spec?.audience ?? 'all';
}

/** Examples for this lesson's audience (`all` examples always stay). */
function examplesFor(
  item: CatalogItem,
  audience: Audience,
): LessonExampleEntry[] {
  return item.examples
    .filter(
      example =>
        audience === 'all' ||
        example.audience === 'all' ||
        example.audience === audience,
    )
    .map(example => ({en: example.text_en, vi: example.text_vi}));
}

/**
 * Display text of an item code: the lesson's item with that code, else the
 * code body (`word:orange juice` → `orange juice`); null when malformed.
 */
function refResolver(
  snapshot: LessonSnapshot,
): (code: string) => string | null {
  const byCode = new Map(
    (snapshot.lesson_items ?? []).map(entry => [entry.item.code, entry.item]),
  );
  return code => {
    const item = byCode.get(code);
    if (item) return item.text;
    return parseItemCode(code)?.body ?? null;
  };
}

/** Lesson items of one kind whose payload is valid, with that payload. */
function itemsOfKind<P>(
  snapshot: LessonSnapshot,
  kind: CatalogItem['kind'],
): {entry: LessonItemEntry; payload: P}[] {
  return sortedLessonItems(snapshot).flatMap(entry => {
    if (entry.item.kind !== kind) return [];
    const parsed = parseItemPayload(kind, entry.item.text, entry.item.payload);
    return parsed.ok ? [{entry, payload: parsed.payload as P}] : [];
  });
}

/** Sentence patterns of a curriculum lesson; malformed ones are skipped. */
export function collectLessonPatterns(
  snapshot: LessonSnapshot,
): LessonPatternEntry[] {
  const resolve = refResolver(snapshot);
  const audience = lessonAudience(snapshot);
  return itemsOfKind<PatternPayload>(snapshot, 'pattern').flatMap(
    ({entry, payload}) => {
      const {item} = entry;
      const frame = parseFrame(item.text);
      if (!frame.ok) return [];
      const slots = frame.slotNames.map(name => {
        const slot = payload.slots[name]!;
        const refs = (slot.item_refs ?? [])
          .map(resolve)
          .filter((value): value is string => value !== null);
        return {
          name,
          labelVi: slot.label_vi,
          choices: [...(slot.values ?? []), ...refs],
        };
      });
      if (slots.some(slot => slot.choices.length === 0)) return [];
      return [
        {
          key: item.code,
          itemId: item.id,
          frame: item.text,
          meaningVi: item.meaning_vi,
          noteVi: item.note_vi,
          role: entry.role,
          introduction: entry.introduction,
          segments: frame.segments,
          slots,
          variants: item.variants.map(variant => ({
            text: variant.text,
            noteVi: variant.note_vi,
          })),
          errors: item.errors.map(error => ({
            code: error.code,
            descriptionVi: error.description_vi,
            feedbackVi: error.feedback_vi,
            tolerated: error.severity === 'tolerated',
            wrongExample: error.wrong_example,
            rightExample: error.right_example,
          })),
          examples: examplesFor(item, audience),
        },
      ];
    },
  );
}

/**
 * The lesson's tense (vocab path P6, design B): its one grammar item, which
 * the Server keeps `required` and at most one per lesson.
 */
export type LessonTenseEntry = {
  code: string;
  name: string;
  meaningVi: string;
  /** The raw payload; `tenseInfo` of `@features/patternTense` reads it. */
  payload: Record<string, unknown>;
  /**
   * What "Luyện câu" builds a combo set on: the first pattern that takes a
   * tense, else the first word or phrase; null when the lesson has neither.
   */
  practiceItemCode: string | null;
};

function takesTense(entry: LessonItemEntry): boolean {
  return entry.item.payload.tense_mode !== 'locked';
}

export function collectLessonTense(
  snapshot: LessonSnapshot,
): LessonTenseEntry | null {
  const items = sortedLessonItems(snapshot);
  const grammar = items.find(entry => entry.item.kind === 'grammar');
  if (!grammar) return null;
  const practice =
    items.find(entry => entry.item.kind === 'pattern' && takesTense(entry)) ??
    items.find(
      entry => entry.item.kind === 'word' || entry.item.kind === 'phrase',
    );
  return {
    code: grammar.item.code,
    name: grammar.item.text,
    meaningVi: grammar.item.meaning_vi,
    payload: grammar.item.payload,
    practiceItemCode: practice?.item.code ?? null,
  };
}

/** Pronunciation points of a curriculum lesson. */
export function collectLessonPronunciation(
  snapshot: LessonSnapshot,
): LessonPronunciationEntry[] {
  const audience = lessonAudience(snapshot);
  return itemsOfKind<PronunciationPayload>(snapshot, 'pronunciation').map(
    ({entry, payload}) => ({
      key: entry.item.code,
      itemId: entry.item.id,
      text: entry.item.text,
      meaningVi: entry.item.meaning_vi,
      focus: payload.focus,
      focusIpa: payload.focus_ipa ?? null,
      tipVi: payload.tip_vi,
      minimalPairs: payload.minimal_pairs,
      examples: examplesFor(entry.item, audience),
    }),
  );
}

/** Listening items of a curriculum lesson. */
export function collectLessonListening(
  snapshot: LessonSnapshot,
): LessonListeningEntry[] {
  const resolve = refResolver(snapshot);
  return itemsOfKind<ListeningPayload>(snapshot, 'listening').flatMap(
    ({entry, payload}) => {
      const answer =
        payload.answer_text ??
        (payload.answer_item_refs ?? [])
          .map(resolve)
          .filter((value): value is string => value !== null)
          .join(', ');
      if (!answer) return [];
      return [
        {
          key: entry.item.code,
          text: entry.item.text,
          meaningVi: entry.item.meaning_vi,
          questionEn: payload.question_en,
          questionVi: payload.question_vi ?? null,
          answer,
        },
      ];
    },
  );
}

/**
 * "Khám phá bài học" rows. A lesson with catalog items shows sentences,
 * words & phrases and, when present, patterns, pronunciation and listening;
 * a learner-made lesson keeps sentences, vocabulary and analysis grammar.
 */
export function lessonHubSections(
  snapshot: LessonSnapshot,
  analyses: Record<string, LessonAnalysis>,
): LessonHubSectionRow[] {
  const rows: LessonHubSectionRow[] = [
    {section: 'sentences', count: snapshot.sentences.length},
    {
      section: 'vocabulary',
      count: collectLessonVocabulary(snapshot, analyses).length,
    },
  ];
  if ((snapshot.lesson_items ?? []).length === 0) {
    rows.push({
      section: 'grammar',
      count: collectLessonGrammar(snapshot, analyses).length,
    });
    return rows;
  }
  const optional: LessonHubSectionRow[] = [
    {section: 'patterns', count: collectLessonPatterns(snapshot).length},
    {
      section: 'pronunciation',
      count: collectLessonPronunciation(snapshot).length,
    },
    {section: 'listening', count: collectLessonListening(snapshot).length},
  ];
  return [...rows, ...optional.filter(row => row.count > 0)];
}
