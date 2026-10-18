import fs from 'node:fs';
import path from 'node:path';

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {
  getDueFlashcards,
  listAllBookmarkedGrammar,
  listFlashcards,
} from '@features/review';

import {AppThemeProvider} from '@ui/theme';

import {DB_NAME} from '@core/db/constants';
import {getDatabase, resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';
import {openDatabase as openSqlite} from '@core/db/sqlite';
import {FeatureFlagProvider} from '@core/release';
import {
  type LessonSnapshot,
  LessonSnapshotResponseSchema,
} from '@core/schemas/lesson';

import {makeTestReleaseConfig, THEME_UI_FLAGS} from '@test/support';

import {__resetMockDatabases} from '../../../../../../test-utils/sqliteMock';
import {CanonicalLessonPlayerScreen} from '../CanonicalLessonPlayerScreen';

const LESSON_ID = '33333333-3333-4333-8333-333333333301';
const S1 = '11111111-1111-4111-8111-111111111101';
const WORD_ID = '55555555-5555-4555-8555-555555555501';
const GRAMMAR_ID = '66666666-6666-4666-8666-666666666601';
/** The vocabulary list keys a word by its item code; analyses by their id. */
const WORD_KEY = 'phrase:wake up';

jest.mock('@features/audio', () => ({
  speak: () => Promise.resolve({ok: true}),
  useSpeak: () => ({speak: () => undefined, notice: null}),
}));

const snapshot: LessonSnapshot = {
  id: LESSON_ID,
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
      id: S1,
      position: 0,
      text_en: 'I wake up early.',
      text_vi: 'Tôi thức dậy sớm.',
      ipa: 'aɪ weɪk ʌp ˈɝli',
      start_ms: null,
      end_ms: null,
    },
  ],
  blocks: [],
  analyses: {
    [S1]: {
      sentence_id: S1,
      vocabulary: [
        {
          id: WORD_ID,
          word: 'wake up',
          pos: 'verb',
          ipa: 'weɪk ʌp',
          meaning: 'thức dậy',
        },
      ],
      grammar: [
        {
          id: GRAMMAR_ID,
          name: 'Present simple',
          description: 'Diễn tả thói quen.',
          formula: 'S + V(s/es)',
          analysis: 'Thói quen hằng ngày.',
        },
      ],
      created_at: '2026-10-01T00:00:00.000Z',
    },
  },
};

function curriculumSnapshot(): LessonSnapshot {
  const raw = JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        '../../../../../core/schemas/__tests__/fixtures',
        'valid-lesson-snapshot-with-spec-response.json',
      ),
      'utf8',
    ),
  );
  return {...LessonSnapshotResponseSchema.parse(raw).lesson, id: LESSON_ID};
}

const PATTERN_KEY = 'pattern:can-i-have';

const mockLesson = {
  state: {
    status: 'ready',
    snapshot,
    offline: false,
    hasUpdate: false,
  } as {status: string; snapshot: LessonSnapshot; [key: string]: unknown},
  open: jest.fn(),
  checkForUpdate: jest.fn(),
  requestAnalysis: jest.fn(),
};

jest.mock('../../logic/useCanonicalLesson', () => ({
  useCanonicalLesson: () => mockLesson,
}));

jest.mock('../../logic/useLessonCompletion', () => ({
  useLessonCompletion: () => ({
    state: 'unfinished',
    complete: jest.fn(),
    markStarted: jest.fn(),
  }),
}));

let activeRenderers: ReactTestRenderer.ReactTestRenderer[] = [];

function renderScreen() {
  const navigation = {
    navigate: jest.fn(),
    goBack: jest.fn(),
    addListener: jest.fn(() => jest.fn()),
  };
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig(THEME_UI_FLAGS)}
      >
        <AppThemeProvider>
          <CanonicalLessonPlayerScreen
            navigation={navigation as never}
            route={{params: {lessonId: LESSON_ID}} as never}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  activeRenderers.push(tree);
  return tree;
}

/** Words open from the hub's word tab; the other sections from their row. */
const WORD_SECTIONS = ['Từ vựng chính', 'Từ & cụm'];

function openSection(tree: ReactTestRenderer.ReactTestRenderer, title: string) {
  const row = tree.root
    .findAll(node => typeof node.props.onPress === 'function')
    .find(node =>
      WORD_SECTIONS.includes(title)
        ? node.props.testID === 'lesson-content-words-all'
        : node.props.title === title,
    );
  act(() => {
    row!.props.onPress();
  });
}

function pressable(tree: ReactTestRenderer.ReactTestRenderer, testID: string) {
  const node = tree.root
    .findAll(candidate => candidate.props.testID === testID)
    .find(candidate => typeof candidate.props.onPress === 'function');
  if (!node) throw new Error(`No pressable found for ${testID}`);
  return node;
}

function label(tree: ReactTestRenderer.ReactTestRenderer, testID: string) {
  return tree.root
    .findAll(candidate => candidate.props.testID === testID)
    .map(candidate => candidate.props.accessibilityLabel)
    .find(value => typeof value === 'string');
}

describe('CanonicalLessonPlayerScreen save actions', () => {
  afterEach(async () => {
    await act(async () => {
      for (const tree of activeRenderers) {
        tree.unmount();
      }
      activeRenderers = [];
    });
  });

  beforeEach(() => {
    __resetMockDatabases();
    resetDatabaseForTests(openSqlite({name: DB_NAME}));
    runMigrations(getDatabase());
    mockLesson.state = {
      status: 'ready',
      snapshot,
      offline: false,
      hasUpdate: false,
    };
  });

  it('"Lưu thẻ" saves a flashcard that is due in review and stays saved on reopen', () => {
    const tree = renderScreen();
    openSection(tree, 'Từ vựng chính');
    const button = pressable(tree, `lesson-vocabulary-save-${WORD_KEY}`);
    expect(label(tree, `lesson-vocabulary-save-${WORD_KEY}`)).toBe('Lưu thẻ');

    act(() => {
      button.props.onPress();
    });

    expect(label(tree, `lesson-vocabulary-save-${WORD_KEY}`)).toBe('Đã lưu');
    expect(listFlashcards({lessonId: LESSON_ID})).toEqual([
      expect.objectContaining({word: 'wake up', meaningVi: 'thức dậy'}),
    ]);
    expect(getDueFlashcards()).toHaveLength(1);

    act(() => tree.unmount());
    const reopened = renderScreen();
    openSection(reopened, 'Từ vựng chính');
    expect(label(reopened, `lesson-vocabulary-save-${WORD_KEY}`)).toBe(
      'Đã lưu',
    );
  });

  it('a second press on "Đã lưu" removes the card', () => {
    const tree = renderScreen();
    openSection(tree, 'Từ vựng chính');
    act(() => {
      pressable(tree, `lesson-vocabulary-save-${WORD_KEY}`).props.onPress();
    });
    act(() => {
      pressable(tree, `lesson-vocabulary-save-${WORD_KEY}`).props.onPress();
    });
    expect(listFlashcards({lessonId: LESSON_ID})).toHaveLength(0);
  });

  it('"Đánh dấu" bookmarks a grammar point and stays saved on reopen', () => {
    const tree = renderScreen();
    openSection(tree, 'Ngữ pháp trong ngữ cảnh');
    const button = pressable(tree, `lesson-grammar-save-${GRAMMAR_ID}`);
    expect(label(tree, `lesson-grammar-save-${GRAMMAR_ID}`)).toBe('Đánh dấu');

    act(() => {
      button.props.onPress();
    });

    expect(listAllBookmarkedGrammar()).toEqual([
      expect.objectContaining({
        lessonId: LESSON_ID,
        grammarId: GRAMMAR_ID,
      }),
    ]);

    act(() => tree.unmount());
    const reopened = renderScreen();
    openSection(reopened, 'Ngữ pháp trong ngữ cảnh');
    expect(label(reopened, `lesson-grammar-save-${GRAMMAR_ID}`)).toBe('Đã lưu');
  });

  it('the sentence analysis word shares the saved state', () => {
    const tree = renderScreen();
    openSection(tree, 'Từ vựng chính');
    act(() => {
      pressable(tree, `lesson-vocabulary-save-${WORD_KEY}`).props.onPress();
    });
    act(() => tree.unmount());

    const reopened = renderScreen();
    act(() => {
      pressable(reopened, 'canonical-hub-start').props.onPress();
    });
    expect(label(reopened, `analysis-save-${WORD_ID}`)).toBe('Đã lưu');
  });

  it('saves a sentence pattern as a pattern flashcard and unsaves it', () => {
    mockLesson.state = {...mockLesson.state, snapshot: curriculumSnapshot()};
    const tree = renderScreen();
    openSection(tree, 'Mẫu câu');
    const saveId = `lesson-pattern-${PATTERN_KEY}-save`;
    expect(label(tree, saveId)).toBe('Lưu thẻ');

    act(() => {
      pressable(tree, saveId).props.onPress();
    });

    expect(label(tree, saveId)).toBe('Đã lưu');
    expect(listFlashcards({lessonId: LESSON_ID})).toEqual([
      expect.objectContaining({
        itemKey: PATTERN_KEY,
        kind: 'pattern',
        word: 'Can I have a {size} {drink}, please?',
        example: 'Can I have a large coffee, please?',
      }),
    ]);

    act(() => tree.unmount());
    const reopened = renderScreen();
    openSection(reopened, 'Mẫu câu');
    expect(label(reopened, saveId)).toBe('Đã lưu');
    act(() => {
      pressable(reopened, saveId).props.onPress();
    });
    expect(listFlashcards({lessonId: LESSON_ID})).toHaveLength(0);
  });

  it('marks a catalog word saved by its item code', () => {
    mockLesson.state = {...mockLesson.state, snapshot: curriculumSnapshot()};
    const tree = renderScreen();
    openSection(tree, 'Từ & cụm');
    act(() => {
      pressable(tree, 'lesson-vocabulary-save-word:coffee').props.onPress();
    });
    expect(label(tree, 'lesson-vocabulary-save-word:coffee')).toBe('Đã lưu');
    // One flashcard at a time: move on to the next word.
    act(() => {
      pressable(tree, 'lesson-vocabulary-next').props.onPress();
    });
    expect(label(tree, 'lesson-vocabulary-save-word:tea')).toBe('Lưu thẻ');
  });
});
