import fs from 'node:fs';
import path from 'node:path';

import type {
  CatalogItem,
  LessonAnalysis,
  LessonItemEntry,
  LessonSnapshot,
} from '@core/schemas/lesson';
import {LessonSnapshotResponseSchema} from '@core/schemas/lesson';

import {
  collectLessonGrammar,
  collectLessonListening,
  collectLessonOutcome,
  collectLessonPatterns,
  collectLessonPronunciation,
  collectLessonTense,
  collectLessonVocabulary,
  lessonHubSections,
  mergeAnalyses,
  sortedSentences,
} from '../lessonHubContent';

const SCHEMA_FIXTURES = path.join(
  __dirname,
  '../../../../../core/schemas/__tests__/fixtures',
);
const ITEM_FIXTURES = path.join(
  __dirname,
  '../../../../../core/learning/__tests__/fixtures/items',
);

function specSnapshot(): LessonSnapshot {
  const raw = JSON.parse(
    fs.readFileSync(
      path.join(
        SCHEMA_FIXTURES,
        'valid-lesson-snapshot-with-spec-response.json',
      ),
      'utf8',
    ),
  );
  return LessonSnapshotResponseSchema.parse(raw).lesson;
}

/** A shared item fixture (admin shape) as the snapshot carries it. */
function fixtureItem(name: string): CatalogItem {
  const raw = JSON.parse(
    fs.readFileSync(path.join(ITEM_FIXTURES, `${name}.json`), 'utf8'),
  );
  return {
    id: raw.id,
    code: raw.code,
    kind: raw.kind,
    text: raw.text,
    meaning_vi: raw.meaning_vi,
    ipa: raw.ipa,
    part_of_speech: raw.part_of_speech,
    note_vi: raw.note_vi,
    audience: raw.audience,
    payload: raw.payload,
    audio: null,
    image: null,
    examples: raw.examples.map(
      (example: {text_en: string; text_vi: string; audience: string}) => ({
        text_en: example.text_en,
        text_vi: example.text_vi,
        audience: example.audience,
        audio: null,
      }),
    ),
    variants: raw.variants.map((variant: {text: string; note_vi: string}) => ({
      text: variant.text,
      note_vi: variant.note_vi,
    })),
    errors: raw.errors.map(
      ({id: _id, position: _position, ...error}: Record<string, unknown>) =>
        error,
    ),
  };
}

function lessonEntry(
  item: CatalogItem,
  position: number,
  role: LessonItemEntry['role'] = 'required',
): LessonItemEntry {
  return {role, introduction: 'new', position, item};
}

const S1 = '11111111-1111-4111-8111-111111111101';
const S2 = '11111111-1111-4111-8111-111111111102';

function analysis(
  sentenceId: string,
  words: string[],
  grammar: string[],
): LessonAnalysis {
  return {
    sentence_id: sentenceId,
    vocabulary: words.map((word, index) => ({
      id: `${sentenceId}-v${index}`,
      word,
      pos: 'verb',
      ipa: 'ipa',
      meaning: `nghĩa ${word}`,
    })),
    grammar: grammar.map((name, index) => ({
      id: `${sentenceId}-g${index}`,
      name,
      description: `mô tả ${name}`,
      formula: 'S + V',
      analysis: `dùng ${name} ở câu này`,
    })),
    created_at: '2026-10-01T00:00:00.000Z',
  };
}

const snapshot: LessonSnapshot = {
  id: '33333333-3333-4333-8333-333333333301',
  slug: 'morning',
  title: 'Morning routine',
  description: '',
  origin: 'learner',
  source_type: 'learner_text',
  content_revision: 1,
  unit: null,
  youtube: null,
  sentences: [
    {
      id: S2,
      position: 1,
      text_en: 'Then I make coffee.',
      text_vi: 'Sau đó tôi pha cà phê.',
      ipa: 'ipa-2',
      start_ms: null,
      end_ms: null,
    },
    {
      id: S1,
      position: 0,
      text_en: 'I wake up at six.',
      text_vi: 'Tôi thức dậy lúc sáu giờ.',
      ipa: 'ipa-1',
      start_ms: null,
      end_ms: null,
    },
  ],
  blocks: [],
  analyses: {},
};

describe('lessonHubContent', () => {
  it('orders sentences by position', () => {
    expect(sortedSentences(snapshot).map(s => s.id)).toEqual([S1, S2]);
  });

  it('lets late analyses override stored ones without mutating either', () => {
    const stored = {[S1]: analysis(S1, ['old'], [])};
    const late = {[S1]: analysis(S1, ['new'], [])};
    const merged = mergeAnalyses(stored, late);
    expect(merged[S1].vocabulary[0].word).toBe('new');
    expect(stored[S1].vocabulary[0].word).toBe('old');
  });

  it('lists analysis words in sentence order, deduplicated', () => {
    const entries = collectLessonVocabulary(snapshot, {
      [S2]: analysis(S2, ['coffee', 'make'], []),
      [S1]: analysis(S1, ['wake up', 'Coffee'], []),
    });
    expect(entries.map(entry => entry.word)).toEqual([
      'wake up',
      'Coffee',
      'make',
    ]);
    expect(entries[0]).toMatchObject({
      key: 'phrase:wake up',
      meaning: 'nghĩa wake up',
      ipa: 'ipa',
    });
  });

  it('reads the catalog words and phrases of a curriculum lesson', () => {
    const catalogItem = (
      n: number,
      kind: 'word' | 'pattern',
      code: string,
      text: string,
      meaning: string,
      ipa: string | null,
    ): LessonItemEntry => ({
      role: 'required',
      introduction: 'new',
      position: n,
      item: {
        id: `44444444-4444-4444-8444-44444444440${n}`,
        code,
        kind,
        text,
        meaning_vi: meaning,
        ipa,
        part_of_speech: null,
        note_vi: null,
        audience: 'all',
        payload: {},
        audio: null,
        image: null,
        examples: [],
        variants: [],
        errors: [],
      },
    });
    const entries = collectLessonVocabulary(
      {
        ...snapshot,
        lesson_items: [
          catalogItem(
            1,
            'pattern',
            'pattern:can-i-have',
            'Can I have a {x}?',
            'Cho tôi',
            null,
          ),
          catalogItem(0, 'word', 'word:brew', 'brew', 'pha', 'bruː'),
        ],
      },
      {[S1]: analysis(S1, ['ignored'], [])},
    );
    expect(entries).toEqual([
      {
        key: 'word:brew',
        itemId: '44444444-4444-4444-8444-444444444400',
        word: 'brew',
        meaning: 'pha',
        ipa: 'bruː',
        pos: null,
        role: 'required',
        introduction: 'new',
      },
    ]);
  });

  it('lists analysis grammar once, with the sentence it was found in', () => {
    const entries = collectLessonGrammar(snapshot, {
      [S2]: analysis(S2, [], ['Present simple']),
      [S1]: analysis(S1, [], ['present simple', 'Adverb of time']),
    });
    expect(entries.map(entry => entry.name)).toEqual([
      'present simple',
      'Adverb of time',
    ]);
    expect(entries[1]).toMatchObject({
      inText: 'dùng Adverb of time ở câu này',
      examples: [{en: 'I wake up at six.', vi: 'Tôi thức dậy lúc sáu giờ.'}],
    });
  });

  describe('curriculum lesson items', () => {
    it('reads the lesson outcome from the spec', () => {
      expect(collectLessonOutcome(specSnapshot())).toEqual({
        canDo: ['Tự gọi một đồ uống kèm cỡ bằng mẫu "Can I have…?".'],
        situation: {
          speaker: 'khách',
          listener: 'người bán',
          place: 'quán cà phê',
          purpose: 'gọi đồ uống',
        },
        estimatedMinutes: 10,
        audience: 'all',
        prerequisites: [],
      });
    });

    it('has no outcome without a spec or a can-do', () => {
      const lesson = specSnapshot();
      expect(collectLessonOutcome({...lesson, spec: null})).toBeNull();
      expect(
        collectLessonOutcome({...lesson, spec: {...lesson.spec!, can_do: []}}),
      ).toBeNull();
      expect(collectLessonOutcome(snapshot)).toBeNull();
    });

    it('lists required words before extended ones', () => {
      const lesson: LessonSnapshot = {
        ...snapshot,
        lesson_items: [
          lessonEntry(fixtureItem('word-coffee'), 0, 'extended'),
          lessonEntry(fixtureItem('phrase-orange-juice'), 1, 'required'),
        ],
      };
      expect(
        collectLessonVocabulary(lesson, {}).map(e => [e.key, e.role]),
      ).toEqual([
        ['phrase:orange juice', 'required'],
        ['word:coffee', 'extended'],
      ]);
    });

    it('builds a pattern with slot choices from values and item refs', () => {
      const [pattern] = collectLessonPatterns(specSnapshot());
      expect(pattern).toMatchObject({
        key: 'pattern:can-i-have',
        frame: 'Can I have a {size} {drink}, please?',
        role: 'required',
        introduction: 'new',
      });
      expect(pattern!.segments.map(segment => segment.type)).toEqual([
        'text',
        'slot',
        'text',
        'slot',
        'text',
      ]);
      expect(pattern!.slots).toEqual([
        {name: 'size', labelVi: 'cỡ', choices: ['small', 'medium', 'large']},
        {
          name: 'drink',
          labelVi: 'đồ uống',
          choices: ['coffee', 'tea', 'milk', 'orange juice'],
        },
      ]);
      expect(pattern!.variants).toHaveLength(2);
      expect(pattern!.errors).toHaveLength(3);
      expect(pattern!.examples).toHaveLength(1);
    });

    it('resolves refs missing from the lesson by their code body', () => {
      const lesson: LessonSnapshot = {
        ...snapshot,
        lesson_items: [lessonEntry(fixtureItem('pattern-can-i-have'), 0)],
      };
      const [pattern] = collectLessonPatterns(lesson);
      expect(pattern!.slots[1]!.choices).toEqual(['coffee', 'orange juice']);
      expect(pattern!.errors.some(error => error.tolerated)).toBe(true);
    });

    it('skips a pattern whose payload does not match its frame', () => {
      const broken = {
        ...fixtureItem('pattern-can-i-have'),
        text: 'Can I have a {colour}?',
      };
      expect(
        collectLessonPatterns({
          ...snapshot,
          lesson_items: [lessonEntry(broken, 0)],
        }),
      ).toEqual([]);
    });

    it('keeps the examples meant for the lesson audience', () => {
      const item = fixtureItem('pattern-can-i-have');
      const withExamples: CatalogItem = {
        ...item,
        examples: [
          {text_en: 'all', text_vi: 'tất cả', audience: 'all', audio: null},
          {text_en: 'kids', text_vi: 'trẻ em', audience: 'kids', audio: null},
          {
            text_en: 'adults',
            text_vi: 'người lớn',
            audience: 'adults',
            audio: null,
          },
        ],
      };
      const lesson = specSnapshot();
      const kidsLesson: LessonSnapshot = {
        ...lesson,
        spec: {...lesson.spec!, audience: 'kids'},
        lesson_items: [lessonEntry(withExamples, 0)],
      };
      expect(
        collectLessonPatterns(kidsLesson)[0]!.examples.map(e => e.en),
      ).toEqual(['all', 'kids']);
    });

    it('reads pronunciation and listening items', () => {
      const lesson: LessonSnapshot = {
        ...snapshot,
        lesson_items: [
          lessonEntry(fixtureItem('pronunciation-final-t'), 0),
          lessonEntry(fixtureItem('listening-what-size'), 1),
        ],
      };
      expect(collectLessonPronunciation(lesson)).toEqual([
        {
          key: 'pronunciation:final-t',
          itemId: fixtureItem('pronunciation-final-t').id,
          text: 'Final /t/',
          meaningVi: 'Âm /t/ ở cuối từ',
          focus: '/t/ cuối từ',
          focusIpa: '/t/',
          tipVi: 'Chạm đầu lưỡi sau răng trên và bật nhẹ, đừng nuốt mất âm.',
          minimalPairs: [
            ['eight', 'ate'],
            ['light', 'lie'],
          ],
          examples: [],
        },
      ]);
      expect(collectLessonListening(lesson)).toEqual([
        {
          key: 'listening:what-size-would-you-like',
          text: 'What size would you like?',
          meaningVi: 'Bạn muốn cỡ nào?',
          questionEn: 'What size would you like?',
          questionVi: 'Bạn muốn cỡ nào?',
          answer: 'A large one, please.',
        },
      ]);
    });

    it('picks the explore rows by lesson kind', () => {
      expect(lessonHubSections(specSnapshot(), {})).toEqual([
        {section: 'sentences', count: 0},
        {section: 'vocabulary', count: 4},
        {section: 'patterns', count: 1},
      ]);
      expect(
        lessonHubSections(snapshot, {
          [S1]: analysis(S1, ['wake up'], ['Present simple']),
        }).map(row => row.section),
      ).toEqual(['sentences', 'vocabulary', 'grammar']);
    });
  });
});

describe('collectLessonTense', () => {
  const item = (
    position: number,
    kind: CatalogItem['kind'],
    code: string,
    payload: Record<string, unknown> = {},
  ): LessonItemEntry => ({
    role: 'required',
    introduction: 'new',
    position,
    item: {
      id: `55555555-5555-4555-8555-55555555550${position}`,
      code,
      kind,
      text: code.split(':')[1]!,
      meaning_vi: `nghĩa ${code}`,
      ipa: null,
      part_of_speech: null,
      note_vi: null,
      audience: 'all',
      payload,
      audio: null,
      image: null,
      examples: [],
      variants: [],
      errors: [],
    },
  });
  const tensePayload = {
    family: 'tense',
    forms: {affirmative: 'S + V(s/es)', negative: 'n', question: 'q'},
  };

  it('is null without a grammar item', () => {
    expect(
      collectLessonTense({
        ...specSnapshot(),
        lesson_items: [item(0, 'word', 'word:tea')],
      }),
    ).toBeNull();
  });

  it('reads the grammar item and practises on the first pattern that takes a tense', () => {
    expect(
      collectLessonTense({
        ...specSnapshot(),
        lesson_items: [
          item(3, 'pattern', 'pattern:open', {}),
          item(0, 'word', 'word:tea'),
          item(1, 'grammar', 'grammar:present-simple', tensePayload),
          item(2, 'pattern', 'pattern:locked', {tense_mode: 'locked'}),
        ],
      }),
    ).toEqual({
      code: 'grammar:present-simple',
      name: 'present-simple',
      meaningVi: 'nghĩa grammar:present-simple',
      payload: tensePayload,
      practiceItemCode: 'pattern:open',
    });
  });

  it('falls back to the first word, then to nothing', () => {
    const base = specSnapshot();
    expect(
      collectLessonTense({
        ...base,
        lesson_items: [
          item(0, 'grammar', 'grammar:past-simple', tensePayload),
          item(1, 'pattern', 'pattern:locked', {tense_mode: 'locked'}),
          item(2, 'phrase', 'phrase:wake up'),
        ],
      })?.practiceItemCode,
    ).toBe('phrase:wake up');
    expect(
      collectLessonTense({
        ...base,
        lesson_items: [item(0, 'grammar', 'grammar:past-simple', tensePayload)],
      })?.practiceItemCode,
    ).toBeNull();
  });
});
