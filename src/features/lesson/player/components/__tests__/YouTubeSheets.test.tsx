import React from 'react';
import {FlatList, Modal, View} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import vi from '@core/i18n/vi.json';
import {FeatureFlagProvider} from '@core/release';
import type {LessonAnalysis, LessonSnapshot} from '@core/schemas/lesson';

import {makeTestReleaseConfig, THEME_UI_FLAGS} from '@test/support';

import {YouTubeLessonStudy} from '../YouTubeLessonStudy';
import {YouTubeTranscriptSheet} from '../YouTubeTranscriptSheet';

const S1 = '11111111-1111-4111-8111-111111111101';
const S2 = '11111111-1111-4111-8111-111111111102';
const S3 = '11111111-1111-4111-8111-111111111103';

function sentence(
  id: string,
  position: number,
  cues?: {start: number; end: number},
) {
  return {
    id,
    position,
    text_en: `Sentence ${position} en.`,
    text_vi: `Câu ${position} vi.`,
    ipa: `ipa-${position}`,
    start_ms: cues ? cues.start : null,
    end_ms: cues ? cues.end : null,
  };
}

function analysisFor(sentenceId: string): LessonAnalysis {
  return {
    sentence_id: sentenceId,
    vocabulary: [
      {
        id: `${sentenceId}-v0`,
        word: 'coffee',
        pos: 'noun',
        ipa: 'ˈkɒfi',
        meaning: 'cà phê',
      },
    ],
    grammar: [
      {
        id: `${sentenceId}-g0`,
        name: 'Present simple',
        description: 'Habitual actions',
        formula: 'S + V',
        analysis: 'Used for routines',
      },
    ],
    created_at: '2026-10-01T00:00:00.000Z',
  };
}

function snapshotWithThreeSentences(): LessonSnapshot {
  return {
    id: '33333333-3333-4333-8333-333333333301',
    slug: 'yt-lesson',
    title: 'How to order coffee in English',
    description: '',
    origin: 'learner',
    source_type: 'youtube',
    content_revision: 3,
    unit: null,
    youtube: {video_id: 'dQw4w9WgXcQ', duration_ms: 60000},
    sentences: [
      sentence(S1, 0, {start: 0, end: 2000}),
      sentence(S2, 1, {start: 2000, end: 4000}),
      sentence(S3, 2, {start: 9000, end: 11000}),
    ],
    blocks: [],
    analyses: {},
  };
}

async function renderStudy(
  props: Partial<React.ComponentProps<typeof YouTubeLessonStudy>> = {},
) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  const snapshot = props.snapshot ?? snapshotWithThreeSentences();
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig(THEME_UI_FLAGS)}
      >
        <AppThemeProvider>
          <YouTubeLessonStudy
            snapshot={snapshot}
            analyses={{}}
            playbackPositionMs={0}
            videoAvailable
            videoPlaying={false}
            videoSlot={<React.Fragment />}
            {...props}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

function pressByTestId(
  root: ReactTestRenderer.ReactTestInstance,
  testID: string,
) {
  const target = root
    .findAll(node => node.props.testID === testID)
    .find(node => typeof node.props.onPress === 'function');
  if (!target) {
    throw new Error(`No pressable for ${testID}`);
  }
  act(() => {
    target.props.onPress();
  });
}

function visibleModal(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAllByType(Modal).find(modal => modal.props.visible);
}

/** "Câu x/y" now lives on the sentence progress strip's label. */
function sentenceIndicator(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAll(
    node =>
      node.props.testID === 'youtube-study-progress' &&
      typeof node.props.accessibilityLabel === 'string',
  )[0].props.accessibilityLabel as string;
}

describe('YouTube sheets (AC-006, AC-008)', () => {
  it('shows stored analysis vocab and grammar in the sheet (AC-006 S1)', async () => {
    const tree = await renderStudy({
      analyses: {[S1]: analysisFor(S1)},
    });
    pressByTestId(tree.root, `youtube-open-analysis-${S1}`);
    expect(visibleModal(tree.root)?.props.visible).toBe(true);
    expect(
      tree.root.findByProps({testID: `analysis-vocab-${S1}-v0`}),
    ).toBeDefined();
    expect(
      tree.root.findByProps({testID: `analysis-grammar-${S1}-g0`}),
    ).toBeDefined();
  });

  it('requests analysis from the card CTA in one tap (AC-009 S1)', async () => {
    const onRequestAnalysis = jest.fn();
    const tree = await renderStudy({onRequestAnalysis});
    pressByTestId(tree.root, `youtube-open-analysis-${S1}`);
    expect(onRequestAnalysis).toHaveBeenCalledTimes(1);
    expect(onRequestAnalysis).toHaveBeenCalledWith(S1);
    expect(
      tree.root.findByProps({testID: 'youtube-sheet-analysis'}),
    ).toBeDefined();
  });

  it('renders loading state in the analysis sheet (AC-006 S3)', async () => {
    const tree = await renderStudy({
      analysisStates: {[S1]: {status: 'loading'}},
    });
    pressByTestId(tree.root, `youtube-open-analysis-${S1}`);
    expect(
      tree.root.findByProps({testID: `analysis-loading-${S1}`}),
    ).toBeDefined();
  });

  it('updates to ready analysis while the sheet stays open (AC-006 S4)', async () => {
    const tree = await renderStudy({
      analysisStates: {[S1]: {status: 'loading'}},
    });
    pressByTestId(tree.root, `youtube-open-analysis-${S1}`);
    await act(async () => {
      tree.update(
        <FeatureFlagProvider
          releaseConfig={makeTestReleaseConfig(THEME_UI_FLAGS)}
        >
          <AppThemeProvider>
            <YouTubeLessonStudy
              snapshot={snapshotWithThreeSentences()}
              analyses={{[S1]: analysisFor(S1)}}
              playbackPositionMs={0}
              videoAvailable
              videoPlaying={false}
              videoSlot={<React.Fragment />}
            />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    });
    expect(visibleModal(tree.root)?.props.visible).toBe(true);
    expect(
      tree.root.findByProps({testID: `analysis-ready-${S1}`}),
    ).toBeDefined();
  });

  it('keeps the video slot mounted and preserves card index on close (AC-006 S5)', async () => {
    function VideoSlot() {
      return <View testID="mock-video-slot" />;
    }
    const tree = await renderStudy({
      videoSlot: <VideoSlot />,
    });
    expect(tree.root.findByProps({testID: 'mock-video-slot'})).toBeDefined();
    pressByTestId(tree.root, 'youtube-cards-next');
    pressByTestId(tree.root, `youtube-open-analysis-${S2}`);
    expect(tree.root.findByProps({testID: 'mock-video-slot'})).toBeDefined();
    pressByTestId(tree.root, 'youtube-sheet-close');
    expect(visibleModal(tree.root)).toBeUndefined();
    expect(sentenceIndicator(tree.root)).toContain('2/3');
    expect(tree.root.findByProps({testID: 'mock-video-slot'})).toBeDefined();
  });

  it('lists transcript rows with timestamps and optional VI (AC-008 S1)', async () => {
    const tree = await renderStudy();
    pressByTestId(tree.root, 'youtube-open-transcript');
    expect(
      tree.root.findByProps({testID: `youtube-transcript-row-${S1}`}),
    ).toBeDefined();
    expect(
      tree.root.findByProps({testID: `youtube-transcript-row-${S3}`}),
    ).toBeDefined();
    const row = tree.root.findByProps({testID: `youtube-transcript-row-${S1}`});
    expect(row).toBeDefined();
  });

  it('marks only the active cue row selected (AC-008 S2)', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    const sentences = snapshotWithThreeSentences().sentences;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <FeatureFlagProvider
          releaseConfig={makeTestReleaseConfig(THEME_UI_FLAGS)}
        >
          <AppThemeProvider>
            <YouTubeTranscriptSheet
              activeIndex={0}
              currentIndex={0}
              onClose={jest.fn()}
              onSelectSentence={jest.fn()}
              sentences={sentences}
              showTranslation
              videoPlaying
              visible
            />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    });
    const activeRow = tree.root.findByProps({
      testID: `youtube-transcript-row-${S1}`,
    });
    const inactiveRow = tree.root.findByProps({
      testID: `youtube-transcript-row-${S2}`,
    });
    expect(activeRow.props.accessibilityState?.selected).toBe(true);
    expect(inactiveRow.props.accessibilityState?.selected).toBe(false);
  });

  it('never shows a whole-sentence IPA line in the transcript', async () => {
    const sentences = snapshotWithThreeSentences().sentences;
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <FeatureFlagProvider
          releaseConfig={makeTestReleaseConfig(THEME_UI_FLAGS)}
        >
          <AppThemeProvider>
            <YouTubeTranscriptSheet
              activeIndex={0}
              currentIndex={0}
              onClose={jest.fn()}
              onSelectSentence={jest.fn()}
              sentences={sentences}
              showTranslation
              videoPlaying
              visible
            />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    });
    expect(
      tree.root.findAll(
        node =>
          typeof node.props.children === 'string' &&
          node.props.children === sentences[0].ipa,
      ),
    ).toHaveLength(0);
  });

  it('saves a transcript line with ♥ without seeking to it', async () => {
    const sentences = snapshotWithThreeSentences().sentences;
    const toggle = jest.fn();
    const onSelectSentence = jest.fn();
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <FeatureFlagProvider
          releaseConfig={makeTestReleaseConfig(THEME_UI_FLAGS)}
        >
          <AppThemeProvider>
            <YouTubeTranscriptSheet
              activeIndex={0}
              currentIndex={0}
              onClose={jest.fn()}
              onSelectSentence={onSelectSentence}
              sentenceSave={{
                isSaved: id => id === S2,
                toggle,
                savedCount: 1,
              }}
              sentences={sentences}
              showTranslation
              videoPlaying
              visible
            />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    });
    const heart = (id: string) =>
      tree.root
        .findAll(node => node.props.testID === `youtube-transcript-save-${id}`)
        .find(node => typeof node.props.onPress === 'function');
    expect(heart(S1)?.props.accessibilityLabel).toBe(
      vi.youtube.study.save_sentence_a11y,
    );
    expect(heart(S2)?.props.accessibilityLabel).toBe(
      vi.youtube.study.unsave_sentence_a11y,
    );
    act(() => heart(S1)?.props.onPress());
    expect(toggle).toHaveBeenCalledWith(sentences[0]);
    expect(onSelectSentence).not.toHaveBeenCalled();
  });

  it('highlights the study card row when video is paused (AC-002 S2)', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    const sentences = snapshotWithThreeSentences().sentences;
    await act(async () => {
      tree = ReactTestRenderer.create(
        <FeatureFlagProvider
          releaseConfig={makeTestReleaseConfig(THEME_UI_FLAGS)}
        >
          <AppThemeProvider>
            <YouTubeTranscriptSheet
              activeIndex={0}
              currentIndex={2}
              onClose={jest.fn()}
              onSelectSentence={jest.fn()}
              sentences={sentences}
              showTranslation
              videoPlaying={false}
              visible
            />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    });
    const cardRow = tree.root.findByProps({
      testID: `youtube-transcript-row-${S3}`,
    });
    expect(cardRow.props.accessibilityState?.selected).toBe(true);
  });

  it('scrolls to the study card on open when paused (AC-008 S3)', async () => {
    const tree = await renderStudy({
      playbackPositionMs: 9500,
      videoPlaying: false,
    });
    pressByTestId(tree.root, 'youtube-open-transcript');
    const list = tree.root.findByProps({testID: 'youtube-transcript-list'});
    expect(list.props.initialScrollIndex).toBe(0);
  });

  it('scrolls to the active cue on open while playing (AC-008 S3)', async () => {
    const tree = await renderStudy({
      playbackPositionMs: 9500,
      videoPlaying: true,
    });
    pressByTestId(tree.root, 'youtube-open-transcript');
    const list = tree.root.findByProps({testID: 'youtube-transcript-list'});
    expect(list.props.initialScrollIndex).toBe(2);
  });

  it('selects card and seeks from a transcript row (AC-008 S4)', async () => {
    const onSeek = jest.fn();
    const tree = await renderStudy({onSeek});
    pressByTestId(tree.root, 'youtube-open-transcript');
    const row = tree.root.findByProps({testID: `youtube-transcript-row-${S3}`});
    await act(async () => {
      row.props.onPress();
    });
    expect(onSeek).toHaveBeenCalledWith(9000);
    expect(sentenceIndicator(tree.root)).toContain('3/3');
  });

  it('does not log nested VirtualizedList errors when transcript opens in Modal', async () => {
    const errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const tree = await renderStudy();
    pressByTestId(tree.root, 'youtube-open-transcript');
    expect(tree.root.findAllByType(FlatList).length).toBeGreaterThan(0);
    const nestedListErrors = errorSpy.mock.calls.filter(args =>
      String(args[0]).includes('VirtualizedLists should never be nested'),
    );
    expect(nestedListErrors).toHaveLength(0);
    errorSpy.mockRestore();
  });
});
