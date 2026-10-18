import React from 'react';
import {act} from 'react-test-renderer';

import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {CatalogItemSchema} from '@core/schemas/lesson';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';
import {
  byTestId,
  has,
  press,
  renderWithTheme,
  textOf,
} from '@test/support/lessonFlow';

import type {ItemReviewQueue} from '../../logic/itemReview';
import {ItemReviewScreen} from '../ItemReviewScreen';

jest.mock('@features/audio', () =>
  require('@test/support/audioModuleMock').audioModuleMock(
    jest.fn(() => Promise.resolve({ok: true})),
  ),
);
const mockRequestSync = jest.fn();
const mockSentenceSets = jest.fn();
jest.mock('@features/combo', () => ({
  listComboSentenceSetsFor: (code: string) => mockSentenceSets(code),
}));
jest.mock('@features/sync', () => ({requestSync: () => mockRequestSync()}));

/** PR 16 (G9): the item review screen. */
const TEA_ID = '11111111-1111-4111-8111-111111111101';
const MILK_ID = '11111111-1111-4111-8111-111111111102';

function item(id: string, code: string, text: string, meaning: string) {
  return CatalogItemSchema.parse({
    id,
    code,
    kind: 'word',
    text,
    meaning_vi: meaning,
    ipa: null,
    part_of_speech: null,
    note_vi: null,
    audience: 'all',
    payload: {},
    audio: null,
    image: null,
    examples: [],
    variants: [],
    errors: [],
  });
}

const memory = (code: string, stage = 2) => ({
  itemCode: code,
  stage,
  dueAt: '2026-10-01T00:00:00.000Z',
  stableAt: null,
  lastResult: null,
  lastReviewedAt: null,
});

const queue: ItemReviewQueue = {
  items: [
    {memory: memory('word:tea'), item: item(TEA_ID, 'word:tea', 'tea', 'trà')},
    {
      memory: memory('word:milk'),
      item: item(MILK_ID, 'word:milk', 'milk', 'sữa'),
    },
  ],
  missing: 1,
  doneToday: 0,
};

beforeEach(() => {
  const db = openRealSqlite();
  resetDatabaseForTests(db);
  runMigrations(db);
  mockRequestSync.mockClear();
  mockSentenceSets.mockReset();
  mockSentenceSets.mockReturnValue([]);
});

afterEach(() => {
  resetDatabaseForTests(null);
});

it('walks through the items and records each answer', () => {
  const goBack = jest.fn();
  const tree = renderWithTheme(
    <ItemReviewScreen navigation={{goBack}} queue={queue} />,
  );
  expect(textOf(tree, 'item-review-missing')).toBe(
    '1 từ cần tải lại bài để ôn',
  );
  expect(textOf(tree, 'item-review-meaning')).toBe('Chạm để xem nghĩa');
  press(tree, 'item-review-reveal');
  expect(textOf(tree, 'item-review-meaning')).toBe('trà');
  press(tree, 'item-review-remembered');
  expect(has(tree, 'item-review-card-word:milk')).toBe(true);
  expect(textOf(tree, 'item-review-meaning')).toBe('Chạm để xem nghĩa');
  press(tree, 'item-review-forgot');

  expect(textOf(tree, 'item-review-reviewed-count')).toBe('2');
  expect(textOf(tree, 'item-review-remembered-count')).toBe('1');
  expect(textOf(tree, 'item-review-forgot-count')).toBe('1');
  expect(has(tree, 'item-review-result-word:milk')).toBe(true);
  expect(textOf(tree, 'item-review-xp')).toBe('+9 XP hôm nay');
  expect(mockRequestSync).toHaveBeenCalledTimes(2);
  const rows = getDatabase().execute(
    `SELECT item_key, result, session_id FROM activity_attempts
      WHERE kind = 'review' ORDER BY occurred_at, item_key;`,
  ).rows?._array;
  expect(rows?.map(row => [row.item_key, row.result])).toEqual([
    ['word:tea', 'correct'],
    ['word:milk', 'incorrect'],
  ]);
  expect(rows?.[0]?.session_id).toBe(rows?.[1]?.session_id);
  press(tree, 'item-review-back');
  expect(goBack).toHaveBeenCalled();
});

it('practises the forgotten items again without recording them', () => {
  const tree = renderWithTheme(<ItemReviewScreen queue={queue} />);
  press(tree, 'item-review-remembered');
  press(tree, 'item-review-forgot');
  expect(byTestId(tree, 'item-review-practice')[0]?.props.title).toBe(
    'Ôn lại 1 từ chưa nhớ',
  );
  press(tree, 'item-review-practice');
  expect(has(tree, 'item-review-card-word:milk')).toBe(true);
  press(tree, 'item-review-remembered');

  expect(textOf(tree, 'item-review-reviewed-count')).toBe('1');
  expect(textOf(tree, 'item-review-remembered-count')).toBe('1');
  expect(has(tree, 'item-review-practice')).toBe(false);
  expect(has(tree, 'item-review-xp')).toBe(false);
  const rows = getDatabase().execute(
    `SELECT item_key FROM activity_attempts WHERE kind = 'review';`,
  ).rows?._array;
  expect(rows).toHaveLength(2);
  expect(mockRequestSync).toHaveBeenCalledTimes(2);
});

it('says when nothing is due', () => {
  const tree = renderWithTheme(
    <ItemReviewScreen queue={{items: [], missing: 0, doneToday: 3}} />,
  );
  expect(textOf(tree, 'item-review-done')).toContain(
    'Hôm nay không còn từ nào cần ôn.',
  );
});

/** Vocab path P5: a card below stage 2 is asked by recognition; one wrong many times is compared first. */
describe('item review tiers', () => {
  const recognitionQueue: ItemReviewQueue = {
    items: [
      {
        memory: memory('word:tea', 0),
        item: item(TEA_ID, 'word:tea', 'tea', 'trà'),
      },
      {
        memory: memory('word:milk', 0),
        item: item(MILK_ID, 'word:milk', 'milk', 'sữa'),
      },
    ],
    missing: 0,
    doneToday: 0,
  };

  it('asks a new card by choosing its meaning, and records the pick', () => {
    const tree = renderWithTheme(<ItemReviewScreen queue={recognitionQueue} />);
    expect(has(tree, 'item-review-question-word:tea')).toBe(true);
    const shown = [0, 1, 2].filter(i => has(tree, `item-review-option-${i}`));
    const options = shown.map(
      i =>
        tree.root.findAll(
          node =>
            node.props.testID === `item-review-option-${i}` &&
            typeof node.props.title === 'string',
        )[0]!.props.title as string,
    );
    expect(options).toContain('trà');
    const correct = options.indexOf('trà');
    press(tree, `item-review-option-${correct}`);
    expect(has(tree, 'item-review-next')).toBe(true);
    press(tree, 'item-review-next');
    const rows = getDatabase().execute(
      `SELECT item_key, result FROM activity_attempts WHERE kind = 'review';`,
    ).rows?._array;
    expect(rows?.map(row => [row.item_key, row.result])).toEqual([
      ['word:tea', 'correct'],
    ]);
  });

  it('shows the comparison card first when the card has lapsed four times', () => {
    getDatabase().execute(
      `INSERT INTO item_memory (item_code, stage, due_at, updated_at, lapses)
       VALUES ('word:tea', 2, '2026-10-01T00:00:00.000Z', 'x', 4);`,
    );
    const tree = renderWithTheme(
      <ItemReviewScreen
        queue={{
          items: [
            {
              memory: memory('word:tea', 2),
              item: item(TEA_ID, 'word:tea', 'tea', 'trà'),
            },
          ],
          missing: 0,
          doneToday: 0,
        }}
      />,
    );
    expect(has(tree, 'item-review-compare-word:tea')).toBe(true);
    expect(has(tree, 'item-review-card-word:tea')).toBe(false);
    press(tree, 'item-review-compare-ok');
    expect(has(tree, 'item-review-card-word:tea')).toBe(true);
  });
});

/** Vocab path P6: from stage 4 a card is a written exercise from the learner's combo sentences. */
describe('stage 4 written review', () => {
  const stage4: ItemReviewQueue = {
    items: [
      {
        memory: memory('word:play', 4),
        item: item(TEA_ID, 'word:play', 'play', 'chơi'),
      },
    ],
    missing: 0,
    doneToday: 0,
  };
  const comboSentence = (
    id: string,
    group: string,
    subject: string,
    tokens: Array<[string, string]>,
  ) => ({
    id,
    position: 0,
    batch: 1,
    subject_group: group,
    subject_text: subject,
    polarity: 'affirmative',
    text_en: `${tokens.map(([t]) => t).join(' ')}.`,
    text_vi: `câu ${id}`,
    tokens: tokens.map(([t, role]) => ({t, ipa: null, role})),
  });
  const recorded = () =>
    getDatabase()
      .execute(
        `SELECT item_key, result FROM activity_attempts WHERE kind = 'review';`,
      )
      .rows?._array.map(row => [row.item_key, row.result]);

  it('asks for the words in order and records the check once', () => {
    mockSentenceSets.mockReturnValue([
      [
        comboSentence('s1', 'i', 'I', [
          ['i', 'subject'],
          ['play', 'verb'],
          ['football', 'other'],
          ['here', 'other'],
        ]),
      ],
    ]);
    const tree = renderWithTheme(<ItemReviewScreen queue={stage4} />);
    expect(mockSentenceSets).toHaveBeenCalledWith('word:play');
    expect(has(tree, 'item-review-apply-order')).toBe(true);
    expect(textOf(tree, 'item-review-apply-prompt')).toBe('câu s1');
    // Tap the shuffled words in the sentence's order.
    for (const word of ['i', 'play', 'football', 'here']) {
      const chip = tree.root.findAll(
        node =>
          typeof node.props.testID === 'string' &&
          node.props.testID.startsWith('item-review-apply-word-') &&
          node.props.label === word &&
          typeof node.props.onPress === 'function',
      )[0]!;
      act(() => chip.props.onPress());
    }
    press(tree, 'item-review-apply-check');
    expect(textOf(tree, 'item-review-apply-answer')).toBe(
      'i play football here.',
    );
    expect(recorded()).toEqual([['word:play', 'correct']]);
    press(tree, 'item-review-next');
    expect(textOf(tree, 'item-review-remembered-count')).toBe('1');
    expect(textOf(tree, 'item-review-forgot-count')).toBe('0');
    expect(has(tree, 'item-review-practice')).toBe(false);
  });

  it('asks for the verb with another subject and grades a wrong one', () => {
    mockSentenceSets.mockReturnValue([
      [
        comboSentence('a', 'i', 'I', [
          ['i', 'subject'],
          ['play', 'verb'],
        ]),
        comboSentence('b', 'he_she', 'She', [
          ['she', 'subject'],
          ['plays', 'verb'],
        ]),
      ],
    ]);
    const tree = renderWithTheme(<ItemReviewScreen queue={stage4} />);
    expect(has(tree, 'item-review-apply-swap')).toBe(true);
    const input = tree.root.findAll(
      node =>
        node.props.testID === 'item-review-apply-input' &&
        typeof node.props.onChangeText === 'function',
    )[0]!;
    act(() => input.props.onChangeText('play'));
    press(tree, 'item-review-apply-check');
    expect(has(tree, 'item-review-apply-verdict')).toBe(true);
    expect(recorded()).toHaveLength(1);
    expect(recorded()![0]![1]).toBe(
      textOf(tree, 'item-review-apply-model') === 'i play.'
        ? 'incorrect'
        : 'correct',
    );
  });

  it('asks a stage-4 card by recall when no opened set gives an exercise', () => {
    const tree = renderWithTheme(<ItemReviewScreen queue={stage4} />);
    expect(has(tree, 'item-review-card-word:play')).toBe(true);
    expect(has(tree, 'item-review-apply-order')).toBe(false);
  });
});
