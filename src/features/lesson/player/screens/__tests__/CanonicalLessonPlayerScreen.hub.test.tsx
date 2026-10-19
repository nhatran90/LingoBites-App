import fs from 'node:fs';
import path from 'node:path';

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';
import {
  type LessonSnapshot,
  LessonSnapshotResponseSchema,
} from '@core/schemas/lesson';

import {
  makeTestReleaseConfig,
  mockAppNavigation,
  THEME_UI_FLAGS,
} from '@test/support';
import {seedSnapshot} from '@test/support/lessonFlow';

import {
  requestComposeSheet,
  useComposeTracker,
} from '../../logic/composeTracker';
import {CanonicalLessonPlayerScreen} from '../CanonicalLessonPlayerScreen';

const LESSON_ID = '33333333-3333-4333-8333-333333333301';
const S1 = '11111111-1111-4111-8111-111111111101';

const mockSpeak = jest.fn(() => Promise.resolve({ok: true}));
jest.mock('@features/audio', () => ({
  speak: (...args: unknown[]) => mockSpeak(...(args as [])),
  useSpeak: () => ({
    speak: (...args: unknown[]) => mockSpeak(...(args as [])),
    notice: null,
  }),
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
  sentences: [0, 1, 2, 3].map(position => ({
    id: `11111111-1111-4111-8111-11111111110${position + 1}`,
    position,
    text_en: `Sentence ${position} en.`,
    text_vi: `Câu ${position} vi.`,
    ipa: `ipa-${position}`,
    start_ms: null,
    end_ms: null,
  })),
  blocks: [],
  analyses: {
    [S1]: {
      sentence_id: S1,
      vocabulary: [
        {
          id: '55555555-5555-4555-8555-555555555501',
          word: 'wake up',
          pos: 'verb',
          ipa: 'weɪk ʌp',
          meaning: 'thức dậy',
        },
      ],
      grammar: [],
      created_at: '2026-10-01T00:00:00.000Z',
    },
  },
};

/**
 * A non-flow lesson that is not the learner's own keeps the sentence study
 * and the one-tap "complete" (only learner lessons get the practice run).
 */
const adminSnapshot: LessonSnapshot = {
  ...snapshot,
  origin: 'admin',
  source_type: 'admin_text',
};

const ready = (lesson: LessonSnapshot) => ({
  status: 'ready',
  snapshot: lesson,
  offline: false,
  hasUpdate: false,
});

let mockState: {status: string; [key: string]: unknown} = {
  status: 'ready',
  snapshot,
  offline: false,
  hasUpdate: false,
};
const mockOpen = jest.fn();

jest.mock('../../logic/useCanonicalLesson', () => ({
  useCanonicalLesson: () => ({
    state: mockState,
    open: mockOpen,
    checkForUpdate: jest.fn(),
    requestAnalysis: jest.fn(),
  }),
}));

let mockShouldAskMedia = false;
const mockSetMediaConsent = jest.fn();
const mockPostponeMediaConsent = jest.fn();

jest.mock('../../logic/mediaDownloadConsent', () => ({
  shouldAskMediaDownloadConsent: () => mockShouldAskMedia,
  setMediaDownloadConsent: (value: string) => mockSetMediaConsent(value),
  postponeMediaDownloadConsent: () => mockPostponeMediaConsent(),
}));

let mockMediaStatus = 'none';
const mockDownloadMedia = jest.fn();

jest.mock('../../logic/useLessonMediaDownload', () => ({
  useLessonMediaDownload: () => ({
    status: mockMediaStatus,
    download: mockDownloadMedia,
    remove: jest.fn(),
  }),
}));

const mockComposeSheet = jest.fn((_props: Record<string, unknown>) => null);
jest.mock('../../components/ComposeSheet', () => ({
  ComposeSheet: (props: Record<string, unknown>) => mockComposeSheet(props),
}));

let mockCompletionState: 'unfinished' | 'finished' | 'error' = 'unfinished';
const mockCompleteLesson = jest.fn();

const mockMarkStarted = jest.fn();

jest.mock('../../logic/useLessonCompletion', () => ({
  useLessonCompletion: () => ({
    state: mockCompletionState,
    complete: mockCompleteLesson,
    markStarted: mockMarkStarted,
  }),
}));

// Plan "practice segments": null reads the device store as usual.
let mockSegmentViews: unknown[] | null = null;
jest.mock('../../../flow/logic/practiceSegments', () => {
  const actual = jest.requireActual('../../../flow/logic/practiceSegments');
  return {
    ...actual,
    practiceSegmentViews: (lesson: unknown) =>
      mockSegmentViews ?? actual.practiceSegmentViews(lesson),
  };
});

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
  return {tree, navigation};
}

function pressable(tree: ReactTestRenderer.ReactTestRenderer, testID: string) {
  const node = tree.root
    .findAll(candidate => candidate.props.testID === testID)
    .find(candidate => typeof candidate.props.onPress === 'function');
  if (!node) throw new Error(`No pressable found for ${testID}`);
  return node;
}

function has(tree: ReactTestRenderer.ReactTestRenderer, testID: string) {
  return tree.root.findAll(node => node.props.testID === testID).length > 0;
}

describe('CanonicalLessonPlayerScreen lesson hub', () => {
  afterEach(async () => {
    await act(async () => {
      for (const tree of activeRenderers) {
        tree.unmount();
      }
      activeRenderers = [];
    });
  });

  beforeEach(() => {
    mockState = {status: 'ready', snapshot, offline: false, hasUpdate: false};
    mockCompletionState = 'unfinished';
    mockSpeak.mockClear();
    mockOpen.mockClear();
    mockCompleteLesson.mockClear();
    mockShouldAskMedia = false;
    mockMediaStatus = 'none';
    mockSetMediaConsent.mockClear();
    mockPostponeMediaConsent.mockClear();
    mockDownloadMedia.mockClear();
    mockSegmentViews = null;
  });

  it('asks before downloading lesson media and downloads on "Tự động tải"', () => {
    mockShouldAskMedia = true;
    mockMediaStatus = 'missing';
    const {tree} = renderScreen();
    expect(tree.root.findByProps({testID: 'media-consent-sheet'})).toBeTruthy();
    act(() => {
      pressable(tree, 'media-consent-auto').props.onPress();
    });
    expect(mockSetMediaConsent).toHaveBeenCalledWith('auto');
    expect(mockDownloadMedia).toHaveBeenCalledTimes(1);
  });

  it('"Để sau" postpones without downloading', () => {
    mockShouldAskMedia = true;
    mockMediaStatus = 'missing';
    const {tree} = renderScreen();
    act(() => {
      pressable(tree, 'media-consent-later').props.onPress();
    });
    expect(mockPostponeMediaConsent).toHaveBeenCalledTimes(1);
    expect(mockSetMediaConsent).not.toHaveBeenCalled();
    expect(mockDownloadMedia).not.toHaveBeenCalled();
  });

  it('offers the learner-driven media download on the hub', () => {
    mockMediaStatus = 'missing';
    const {tree} = renderScreen();
    act(() => {
      pressable(tree, 'lesson-media-download').props.onPress();
    });
    expect(mockDownloadMedia).toHaveBeenCalledTimes(1);
  });

  it('hides the media card for a lesson without media', () => {
    const {tree} = renderScreen();
    expect(has(tree, 'lesson-media-card')).toBe(false);
  });

  it('opens a text lesson on the hub without the retry action', () => {
    const {tree} = renderScreen();
    expect(has(tree, 'canonical-lesson-hub')).toBe(true);
    expect(has(tree, 'lesson-content')).toBe(true);
    expect(has(tree, 'canonical-player')).toBe(false);
    expect(has(tree, 'canonical-player-retry')).toBe(false);
    // F5: opening a ready lesson records its start for Home "Học tiếp".
    expect(mockMarkStarted).toHaveBeenCalled();
  });

  it('lists the sentences under their tab with a Vietnamese switch', () => {
    const {tree} = renderScreen();
    const text = () => JSON.stringify(tree.toJSON());
    expect(text()).not.toContain('Sentence 0 en.');
    act(() => {
      pressable(tree, 'lesson-content-tab-sentences').props.onPress();
    });
    expect(text()).toContain('Sentence 0 en.');
    expect(text()).toContain('Sentence 3 en.');
    expect(text()).not.toContain('Câu 3 vi.');
    act(() => {
      tree.root
        .findByProps({testID: 'lesson-content-vi-toggle'})
        .props.onValueChange(true);
    });
    expect(text()).toContain('Câu 3 vi.');
    expect(text()).toContain('Sentence 3 en.');
  });

  it('"Bắt đầu học" shows the sentence study and back returns to the hub', () => {
    mockState = ready(adminSnapshot);
    const {tree, navigation} = renderScreen();
    act(() => {
      pressable(tree, 'canonical-hub-start').props.onPress();
    });
    expect(has(tree, 'canonical-player')).toBe(true);
    expect(has(tree, 'canonical-lesson-hub')).toBe(false);
    expect(navigation.addListener).toHaveBeenCalledWith(
      'beforeRemove',
      expect.any(Function),
    );

    const header = tree.root
      .findAll(node => typeof node.props.onBack === 'function')
      .at(0);
    act(() => {
      header!.props.onBack();
    });
    expect(has(tree, 'canonical-lesson-hub')).toBe(true);
    expect(navigation.goBack).not.toHaveBeenCalled();
  });

  it('closes the whole lesson from a section in one tap', () => {
    mockState = ready(adminSnapshot);
    const {tree, navigation} = renderScreen();
    expect(has(tree, 'canonical-close-lesson')).toBe(false);
    act(() => {
      pressable(tree, 'canonical-hub-start').props.onPress();
    });
    act(() => {
      pressable(tree, 'canonical-close-lesson').props.onPress();
    });
    expect(mockAppNavigation.closeLesson).toHaveBeenCalled();

    // Back gestures from a section return to the hub; closing (a reset) leaves.
    const calls = navigation.addListener.mock.calls as unknown as [
      string,
      (event: object) => void,
    ][];
    const onBeforeRemove = calls
      .filter(([name]) => name === 'beforeRemove')
      .at(-1)![1];
    const resetEvent = {
      data: {action: {type: 'RESET'}},
      preventDefault: jest.fn(),
    };
    onBeforeRemove(resetEvent);
    expect(resetEvent.preventDefault).not.toHaveBeenCalled();
    const backEvent = {
      data: {action: {type: 'GO_BACK'}},
      preventDefault: jest.fn(),
    };
    act(() => onBeforeRemove(backEvent));
    expect(backEvent.preventDefault).toHaveBeenCalled();
  });

  it('speaks a sentence with the en-US voice', () => {
    mockState = ready(adminSnapshot);
    const {tree} = renderScreen();
    act(() => {
      pressable(tree, 'canonical-hub-start').props.onPress();
    });
    act(() => {
      pressable(tree, `canonical-speak-${S1}`).props.onPress();
    });
    expect(mockSpeak).toHaveBeenCalledWith('Sentence 0 en.');
  });

  it('lists stored analysis words in the vocabulary section', () => {
    const {tree} = renderScreen();
    // The hub's word tab lists them too and opens the full section.
    expect(has(tree, 'lesson-content-word-phrase:wake up')).toBe(true);
    act(() => {
      pressable(tree, 'lesson-content-words-all').props.onPress();
    });
    expect(
      // The list keys a word by its item code (PR 5).
      has(tree, 'lesson-vocabulary-phrase:wake up'),
    ).toBe(true);
  });

  it('opens the pattern section of a curriculum lesson and speaks it', () => {
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
    const curriculum = LessonSnapshotResponseSchema.parse(raw).lesson;
    mockState = {
      status: 'ready',
      snapshot: curriculum,
      offline: false,
      hasUpdate: false,
    };
    const {tree} = renderScreen();
    expect(has(tree, 'lesson-outcome-card')).toBe(true);
    act(() => {
      pressable(tree, 'canonical-hub-explore-patterns').props.onPress();
    });
    expect(has(tree, 'lesson-pattern-section')).toBe(true);
    expect(
      tree.root.findAll(node => node.props.title === 'Mẫu câu').length,
    ).toBeGreaterThan(0);
    act(() => {
      pressable(
        tree,
        'lesson-pattern-pattern:can-i-have-speak',
      ).props.onPress();
    });
    expect(mockSpeak).toHaveBeenCalledWith(
      'Can I have a small coffee, please?',
    );
    const header = tree.root
      .findAll(node => typeof node.props.onBack === 'function')
      .at(0);
    act(() => {
      header!.props.onBack();
    });
    expect(has(tree, 'canonical-lesson-hub')).toBe(true);
  });

  it('shows retry only for a load error', () => {
    mockState = {status: 'error', error: {message: 'Lesson failed to load.'}};
    const {tree} = renderScreen();
    act(() => {
      pressable(tree, 'canonical-player-retry').props.onPress();
    });
    expect(mockOpen).toHaveBeenCalled();
  });

  it('shows "Hoàn thành bài" on the hub and wires the completion action', () => {
    mockState = ready(adminSnapshot);
    const {tree} = renderScreen();
    expect(has(tree, 'canonical-hub-complete')).toBe(true);
    act(() => {
      pressable(tree, 'canonical-hub-complete').props.onPress();
    });
    expect(mockCompleteLesson).toHaveBeenCalledTimes(1);
  });

  it('shows "Đã hoàn thành" instead of the action when finished (AC-003 S3)', () => {
    mockCompletionState = 'finished';
    const {tree} = renderScreen();
    expect(has(tree, 'canonical-hub-completed')).toBe(true);
    expect(has(tree, 'canonical-hub-complete')).toBe(false);
  });

  it('shows the error copy and keeps the action after a failed write (AC-004 S1)', () => {
    mockCompletionState = 'error';
    mockState = ready(adminSnapshot);
    const {tree} = renderScreen();
    expect(has(tree, 'canonical-hub-complete-error')).toBe(true);
    expect(has(tree, 'canonical-hub-complete')).toBe(true);
  });

  it('starts the practice run of a learner lesson instead of a one-tap complete', () => {
    const {tree} = renderScreen();
    expect(has(tree, 'canonical-hub-start')).toBe(false);
    expect(has(tree, 'canonical-hub-complete')).toBe(false);
    // The run replaces the separate quick-practice row.
    expect(has(tree, 'canonical-hub-practice')).toBe(false);
    const start = pressable(tree, 'canonical-hub-start-practice');
    expect(start.props.label).toBe('Bắt đầu luyện');
    act(() => {
      start.props.onPress();
    });
    expect(mockAppNavigation.openPractice).toHaveBeenCalledWith(LESSON_ID);
  });

  it('offers to practise a finished learner lesson again', () => {
    mockCompletionState = 'finished';
    const {tree} = renderScreen();
    expect(has(tree, 'canonical-hub-completed')).toBe(true);
    expect(pressable(tree, 'canonical-hub-start-practice').props.label).toBe(
      'Luyện lại',
    );
  });

  it('continues a long learner lesson at its next segment', () => {
    const view = (index: number, practicedAt: string | null) => ({
      index,
      sentenceIds: [],
      firstSentenceEn: '',
      startMs: null,
      endMs: null,
      available: true,
      practicedAt,
    });
    mockSegmentViews = [
      view(0, '2026-10-11T08:00:00.000Z'),
      view(1, null),
      view(2, null),
    ];
    const {tree} = renderScreen();
    expect(pressable(tree, 'canonical-hub-start-practice').props.label).toBe(
      'Luyện tiếp · đoạn 2/3',
    );
  });

  it('keeps the one-tap complete for a learner lesson too small to practise (D5)', () => {
    mockState = ready({
      ...snapshot,
      sentences: snapshot.sentences.slice(0, 1),
      analyses: {},
    });
    const {tree} = renderScreen();
    expect(has(tree, 'canonical-hub-start-practice')).toBe(false);
    expect(has(tree, 'canonical-hub-start')).toBe(true);
    expect(has(tree, 'canonical-hub-complete')).toBe(true);
  });

  it('opens the compose sheet with the sentences the practice suggested (plan C)', () => {
    const picks = snapshot.sentences.slice(0, 3).map(sentence => sentence.id);
    requestComposeSheet(LESSON_ID, picks);
    renderScreen();
    const props = mockComposeSheet.mock.calls.at(-1)![0];
    expect(props.visible).toBe(true);
    expect(props.initialPicks).toEqual(picks);
    // The request is used once.
    expect(useComposeTracker.getState()).toMatchObject({
      sheetLessonId: null,
      sheetPicks: null,
    });
  });

  it('starts the six-step player for a curriculum lesson (PR 10)', () => {
    mockState = {
      status: 'ready',
      snapshot: seedSnapshot(),
      offline: false,
      hasUpdate: false,
    };
    const {tree} = renderScreen();
    expect(has(tree, 'canonical-hub-start')).toBe(false);
    // G6: no manual "complete" for a curriculum lesson.
    expect(has(tree, 'canonical-hub-complete')).toBe(false);
    // The button names the part to start, not a step number. Nothing to
    // review: the lesson starts at "Nghe hiểu" and the path leaves step 1 out.
    expect(pressable(tree, 'canonical-hub-start-flow').props.label).toBe(
      'Bắt đầu · Nghe hiểu',
    );
    expect(has(tree, 'lesson-path-step-2-current')).toBe(true);
    expect(has(tree, 'lesson-path-step-1')).toBe(false);
    expect(has(tree, 'lesson-path-note')).toBe(true);
    act(() => {
      pressable(tree, 'canonical-hub-start-flow').props.onPress();
    });
    expect(mockAppNavigation.openLessonFlow).toHaveBeenCalledWith(LESSON_ID);
    act(() => {
      pressable(tree, 'lesson-path-details').props.onPress();
    });
    expect(mockAppNavigation.openLessonFlow).toHaveBeenCalledTimes(2);
  });
});
