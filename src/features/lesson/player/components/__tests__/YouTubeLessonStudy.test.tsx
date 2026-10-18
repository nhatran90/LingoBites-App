import React from 'react';
import {Modal} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {MaterialIcon} from '@ui/components/MaterialIcon';
import {AppThemeProvider} from '@ui/theme';

import vi from '@core/i18n/vi.json';
import {FeatureFlagProvider} from '@core/release';
import type {LessonAnalysis, LessonSnapshot} from '@core/schemas/lesson';

import {makeTestReleaseConfig, THEME_UI_FLAGS} from '@test/support';

import {YouTubeLessonStudy} from '../YouTubeLessonStudy';

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
    // One IPA token per written word, so it shows under each word.
    ipa: `ipa-${position} w'ʌn 'ɛn`,
    start_ms: cues ? cues.start : null,
    end_ms: cues ? cues.end : null,
  };
}

function snapshotWithSentenceCount(count: number): LessonSnapshot {
  const items = Array.from({length: count}, (_, index) =>
    sentence(`11111111-1111-4111-8111-11111111110${index + 1}`, index, {
      start: index * 2000,
      end: index * 2000 + 2000,
    }),
  );
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
    sentences: items,
    blocks: [],
    analyses: {},
  };
}

async function renderStudy(
  props: Partial<React.ComponentProps<typeof YouTubeLessonStudy>> = {},
) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  const snapshot = props.snapshot ?? snapshotWithSentenceCount(3);
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

/** "Câu x/y" now lives on the sentence progress strip's label. */
function sentenceIndicator(root: ReactTestRenderer.ReactTestInstance) {
  return root.findAll(
    node =>
      node.props.testID === 'youtube-study-progress' &&
      typeof node.props.accessibilityLabel === 'string',
  )[0].props.accessibilityLabel as string;
}

describe('YouTubeLessonStudy', () => {
  it('shows sentence indicator and three cards (AC-005 S1)', async () => {
    const tree = await renderStudy();
    expect(sentenceIndicator(tree.root)).toBe(
      vi.lessonPlayer.sentence_counter
        .replace('{{index}}', '1')
        .replace('{{total}}', '3'),
    );
    const cardIds = new Set(
      tree.root
        .findAll(
          node =>
            typeof node.props.testID === 'string' &&
            node.props.testID.startsWith('canonical-sentence-'),
        )
        .map(node => node.props.testID as string),
    );
    expect(cardIds.size).toBe(3);
  });

  it('moves indicator on next and disables prev on first card (AC-005 S2)', async () => {
    const tree = await renderStudy();
    const prevInitial = tree.root.findByProps({testID: 'youtube-cards-prev'});
    expect(prevInitial.props.disabled).toBe(true);
    pressByTestId(tree.root, 'youtube-cards-next');
    expect(sentenceIndicator(tree.root)).toContain('2/3');
    expect(
      tree.root.findByProps({testID: 'youtube-cards-prev'}).props.disabled,
    ).toBe(false);
    pressByTestId(tree.root, 'youtube-cards-next');
    pressByTestId(tree.root, 'youtube-cards-next');
    expect(
      tree.root.findByProps({testID: 'youtube-cards-next'}).props.disabled,
    ).toBe(true);
  });

  it('does not render a subtitle overlay on the video frame (AC-008 S1)', async () => {
    const tree = await renderStudy({playbackPositionMs: 2500});
    expect(
      tree.root.findAll(node => node.props.testID === 'youtube-video-overlay'),
    ).toHaveLength(0);
  });

  it('renders sentence progress for the current card (AC-006 S2)', async () => {
    const tree = await renderStudy();
    expect(
      tree.root.findByProps({testID: 'youtube-study-progress'}),
    ).toBeDefined();
    expect(
      tree.root.findAll(node => node.props.testID === 'youtube-cards-position'),
    ).toHaveLength(0);
  });

  it('calls onSeek on card tap without seeking video (AC-005 S5)', async () => {
    const onSeek = jest.fn();
    const tree = await renderStudy({onSeek, playbackPositionMs: 0});
    const cue = tree.root.findByProps({
      testID: 'youtube-cue-11111111-1111-4111-8111-111111111102',
    });
    await act(async () => {
      cue.props.onPress();
    });
    expect(onSeek).toHaveBeenCalledWith(2000);
  });

  it('shows empty cards message when there are no sentences (AC-005 S7)', async () => {
    const tree = await renderStudy({
      snapshot: snapshotWithSentenceCount(0),
    });
    expect(
      tree.root.findByProps({testID: 'youtube-cards-empty'}),
    ).toBeDefined();
    expect(
      tree.root.findByProps({testID: 'youtube-cards-prev'}).props.disabled,
    ).toBe(true);
  });

  it('renders unavailable notice and retry (AC-011 S1)', async () => {
    const onRetryVideo = jest.fn();
    const tree = await renderStudy({
      videoAvailable: false,
      onRetryVideo,
    });
    expect(
      tree.root.findByProps({testID: 'youtube-timeline-unavailable'}),
    ).toBeDefined();
    pressByTestId(tree.root, 'youtube-video-retry');
    expect(onRetryVideo).toHaveBeenCalledTimes(1);
  });

  it('highlights active cue testID for E-013 (AC-013)', async () => {
    const tree = await renderStudy({playbackPositionMs: 500});
    expect(
      tree.root.findByProps({
        testID: 'youtube-cue-11111111-1111-4111-8111-111111111101-active',
      }),
    ).toBeDefined();
  });

  it('shows translation and IPA on first render (AC-006)', async () => {
    const tree = await renderStudy();
    expect(tree.root.findByProps({children: 'Câu 1 vi.'})).toBeDefined();
    expect(tree.root.findByProps({children: 'ipa-1'})).toBeDefined();
  });

  it('hides translation and IPA when the header toggles are off (AC-006, AC-007)', async () => {
    const tree = await renderStudy({showTranslation: false, showIpa: false});
    expect(
      tree.root.findAll(node => node.props.children === 'Câu 1 vi.'),
    ).toHaveLength(0);
    expect(
      tree.root.findAll(node => node.props.children === 'ipa-1'),
    ).toHaveLength(0);
  });

  it('pauses the video when a card is tapped', async () => {
    const onPauseVideo = jest.fn();
    const tree = await renderStudy({onPauseVideo});
    pressByTestId(
      tree.root,
      'youtube-cue-11111111-1111-4111-8111-111111111102',
    );
    expect(onPauseVideo).toHaveBeenCalledTimes(1);
  });

  it('follows the video cue while playing and stops after manual navigation', async () => {
    const tree = await renderStudy({videoPlaying: true, playbackPositionMs: 0});
    const indicator = () => sentenceIndicator(tree.root) as string;
    expect(indicator()).toContain('1/3');
    const rerender = async (positionMs: number) => {
      await act(async () => {
        tree.update(
          <FeatureFlagProvider
            releaseConfig={makeTestReleaseConfig(THEME_UI_FLAGS)}
          >
            <AppThemeProvider>
              <YouTubeLessonStudy
                snapshot={snapshotWithSentenceCount(3)}
                analyses={{}}
                playbackPositionMs={positionMs}
                videoAvailable
                videoPlaying
                videoSlot={<React.Fragment />}
              />
            </AppThemeProvider>
          </FeatureFlagProvider>,
        );
      });
    };
    await rerender(2500);
    expect(indicator()).toContain('2/3');
    pressByTestId(tree.root, 'youtube-cards-prev');
    expect(indicator()).toContain('1/3');
    await rerender(4500);
    expect(indicator()).toContain('1/3');
  });

  it('does not render snapshot metadata fields as text (AC-008 S3)', async () => {
    const tree = await renderStudy();
    const texts = tree.root
      .findAll(node => typeof node.props.children === 'string')
      .map(node => node.props.children as string);
    expect(texts).not.toContain('learner');
    expect(texts).not.toContain('youtube');
    expect(texts).not.toContain('3');
  });

  it('lists the six-step lessons of a public video and opens one', async () => {
    const onOpenVideoLesson = jest.fn();
    const lessonId = '44444444-4444-4444-8444-444444444401';
    const tree = await renderStudy({
      onOpenVideoLesson,
      videoLessons: [
        {
          id: lessonId,
          title: 'Order a coffee · Gọi cà phê',
          description: '',
          origin: 'admin',
          source_type: 'youtube',
          content_revision: 1,
          sentence_count: 4,
          youtube_video_id: 'dQw4w9WgXcQ',
          unit: {
            course_id: '55555555-5555-4555-8555-555555555501',
            course_title: 'English',
            level_id: '55555555-5555-4555-8555-555555555502',
            level_title: 'A1',
            unit_id: '55555555-5555-4555-8555-555555555503',
            unit_title: 'Daily life',
            unit_position: 1,
            lesson_position: 1,
          },
          updated_at: '2026-10-01T00:00:00.000Z',
          estimated_minutes: 10,
          activity_count: 6,
        },
      ],
    });
    const texts = tree.root
      .findAll(node => typeof node.props.children === 'string')
      .map(node => node.props.children as string);
    expect(texts).toContain(vi.youtube.study.video_lessons_title);
    pressByTestId(tree.root, `youtube-video-lesson-${lessonId}`);
    expect(onOpenVideoLesson).toHaveBeenCalledWith(lessonId);
  });

  it('shows no lesson list while a video has no six-step lesson', async () => {
    const tree = await renderStudy({
      onOpenVideoLesson: jest.fn(),
      videoLessons: [],
    });
    expect(
      tree.root.findAll(node => node.props.testID === 'youtube-video-lessons'),
    ).toHaveLength(0);
  });

  it('uses distinct testIDs for transcript open control and sheet (AC-009)', async () => {
    const tree = await renderStudy();
    pressByTestId(tree.root, 'youtube-open-transcript');
    const openControls = tree.root.findAll(
      node =>
        node.props.testID === 'youtube-open-transcript' &&
        node.props.accessibilityRole === 'button',
    );
    expect(openControls.length).toBeGreaterThan(0);
    const sheetModals = tree.root
      .findAllByType(Modal)
      .filter(modal => modal.props.testID === 'youtube-sheet-transcript');
    expect(sheetModals).toHaveLength(1);
  });
  describe('listening controls and word lookup', () => {
    const firstId = '11111111-1111-4111-8111-111111111101';

    function pairedSnapshot(): LessonSnapshot {
      const snapshot = snapshotWithSentenceCount(3);
      snapshot.sentences[0] = {
        ...snapshot.sentences[0],
        text_en: 'We drink coffee.',
        ipa: "w'i dɹ'ɪŋk k'ɒfi",
      };
      return snapshot;
    }

    const coffeeAnalysis: LessonAnalysis = {
      sentence_id: firstId,
      vocabulary: [
        {
          id: '22222222-2222-4222-8222-222222222201',
          word: 'coffee',
          pos: 'noun',
          ipa: '/ˈkɒfi/',
          meaning: 'cà phê',
        },
      ],
      grammar: [
        {
          id: '22222222-2222-4222-8222-222222222202',
          name: 'Present simple',
          description: 'Habitual actions',
          formula: 'S + V',
          analysis: 'Used for routines',
        },
      ],
      created_at: '2026-10-01T00:00:00.000Z',
    };

    async function rerenderStudy(
      tree: ReactTestRenderer.ReactTestRenderer,
      props: Partial<React.ComponentProps<typeof YouTubeLessonStudy>>,
    ) {
      await act(async () => {
        tree.update(
          <FeatureFlagProvider
            releaseConfig={makeTestReleaseConfig(THEME_UI_FLAGS)}
          >
            <AppThemeProvider>
              <YouTubeLessonStudy
                snapshot={snapshotWithSentenceCount(3)}
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
    }

    it('plays a paused video from the toolbar', async () => {
      const onPlayVideo = jest.fn();
      const onPauseVideo = jest.fn();
      const tree = await renderStudy({onPlayVideo, onPauseVideo});
      const [button] = tree.root.findAll(
        node => node.props.testID === 'youtube-toggle-play',
      );
      expect(button.findByType(MaterialIcon).props.name).toBe('play_arrow');
      pressByTestId(tree.root, 'youtube-toggle-play');
      expect(onPlayVideo).toHaveBeenCalledTimes(1);
      expect(onPauseVideo).not.toHaveBeenCalled();
    });

    it('pauses a playing video from the toolbar', async () => {
      const onPlayVideo = jest.fn();
      const onPauseVideo = jest.fn();
      const tree = await renderStudy({
        onPlayVideo,
        onPauseVideo,
        videoPlaying: true,
      });
      const [button] = tree.root.findAll(
        node => node.props.testID === 'youtube-toggle-play',
      );
      expect(button.findByType(MaterialIcon).props.name).toBe('pause');
      pressByTestId(tree.root, 'youtube-toggle-play');
      expect(onPauseVideo).toHaveBeenCalledTimes(1);
      expect(onPlayVideo).not.toHaveBeenCalled();
    });

    it('replays the current sentence from its start and plays', async () => {
      const onSeek = jest.fn();
      const onPlayVideo = jest.fn();
      const tree = await renderStudy({onSeek, onPlayVideo});
      pressByTestId(tree.root, 'youtube-cards-next');
      pressByTestId(tree.root, 'youtube-replay-sentence');
      expect(onSeek).toHaveBeenLastCalledWith(2000);
      expect(onPlayVideo).toHaveBeenCalledTimes(1);
    });

    it('seeks back to the sentence start once its end is reached while looping', async () => {
      const onSeek = jest.fn();
      const base = {
        onSeek,
        sentenceRepeat: 'infinite' as const,
        videoPlaying: true,
      };
      const tree = await renderStudy({...base, playbackPositionMs: 500});
      expect(onSeek).not.toHaveBeenCalled();
      await rerenderStudy(tree, {...base, playbackPositionMs: 1900});
      expect(onSeek).toHaveBeenCalledTimes(1);
      expect(onSeek).toHaveBeenCalledWith(0);
      // A late poll past the end must not send a second seek.
      await rerenderStudy(tree, {...base, playbackPositionMs: 2100});
      expect(onSeek).toHaveBeenCalledTimes(1);
      expect(sentenceIndicator(tree.root)).toContain('1/3');
      // Back inside the sentence, the next pass loops again.
      await rerenderStudy(tree, {...base, playbackPositionMs: 300});
      await rerenderStudy(tree, {...base, playbackPositionMs: 1950});
      expect(onSeek).toHaveBeenCalledTimes(2);
    });

    it('repeats the chosen number of times, then follows the video on', async () => {
      const onSeek = jest.fn();
      const base = {onSeek, sentenceRepeat: 1 as const, videoPlaying: true};
      const tree = await renderStudy({...base, playbackPositionMs: 500});
      await rerenderStudy(tree, {...base, playbackPositionMs: 1900});
      expect(onSeek).toHaveBeenCalledTimes(1);
      expect(onSeek).toHaveBeenLastCalledWith(0);
      // The second pass is the last one: no seek, and the card moves on.
      await rerenderStudy(tree, {...base, playbackPositionMs: 300});
      await rerenderStudy(tree, {...base, playbackPositionMs: 1950});
      expect(onSeek).toHaveBeenCalledTimes(1);
      await rerenderStudy(tree, {...base, playbackPositionMs: 2500});
      expect(sentenceIndicator(tree.root)).toContain('2/3');
      // The next sentence repeats once too.
      await rerenderStudy(tree, {...base, playbackPositionMs: 3950});
      expect(onSeek).toHaveBeenCalledTimes(2);
      expect(onSeek).toHaveBeenLastCalledWith(2000);
    });

    it('does not loop when the loop option is off', async () => {
      const onSeek = jest.fn();
      const tree = await renderStudy({onSeek, videoPlaying: true});
      await rerenderStudy(tree, {
        onSeek,
        videoPlaying: true,
        playbackPositionMs: 2500,
      });
      expect(onSeek).not.toHaveBeenCalled();
      expect(sentenceIndicator(tree.root)).toContain('2/3');
    });

    it('shows the speed and cycles it from the toolbar', async () => {
      const onCyclePlaybackRate = jest.fn();
      const tree = await renderStudy({
        playbackRate: 0.75,
        onCyclePlaybackRate,
      });
      const pill = tree.root
        .findAll(node => node.props.testID === 'youtube-playback-rate')
        .find(node => typeof node.props.onPress === 'function');
      expect(pill?.props.accessibilityLabel).toBe(
        vi.youtube.study.playback_rate_a11y.replace('{{rate}}', '0.75'),
      );
      expect(
        tree.root.findAllByProps({children: '0.75×'}).length,
      ).toBeGreaterThan(0);
      pressByTestId(tree.root, 'youtube-playback-rate');
      expect(onCyclePlaybackRate).toHaveBeenCalledTimes(1);
    });

    it('jumps to a sentence from the progress strip', async () => {
      const onSeek = jest.fn();
      const tree = await renderStudy({onSeek});
      const strip = tree.root
        .findAll(node => node.props.testID === 'youtube-study-progress')
        .find(node => typeof node.props.onLayout === 'function');
      await act(async () => {
        strip?.props.onLayout({nativeEvent: {layout: {width: 300}}});
      });
      // The strip maps the tap position to a sentence.
      const pressable = tree.root
        .findAll(node => node.props.testID === 'youtube-study-progress')
        .find(node => typeof node.props.onPress === 'function');
      act(() => {
        pressable?.props.onPress({nativeEvent: {locationX: 250}});
      });
      expect(onSeek).toHaveBeenLastCalledWith(4000);
      expect(sentenceIndicator(tree.root)).toContain('3/3');
    });

    it('puts IPA under each word when the IPA pairs with the words', async () => {
      const tree = await renderStudy({
        snapshot: pairedSnapshot(),
        showIpa: true,
      });
      expect(
        tree.root.findAllByProps({children: 'kˈɒfi'}).length,
      ).toBeGreaterThan(0);
      expect(
        tree.root.findAll(node => node.props.children === "w'i dɹ'ɪŋk k'ɒfi"),
      ).toHaveLength(0);
      // Hidden by default.
      const hidden = await renderStudy({
        snapshot: pairedSnapshot(),
        showIpa: false,
      });
      expect(hidden.root.findAllByProps({children: 'kˈɒfi'})).toHaveLength(0);
    });

    it('keeps vocabulary and grammar chips out of the card', async () => {
      const tree = await renderStudy({
        snapshot: pairedSnapshot(),
        analyses: {[firstId]: coffeeAnalysis},
      });
      expect(
        tree.root.findAll(node => node.props.children === 'Present simple'),
      ).toHaveLength(0);
    });

    it('opens a word bubble with IPA, meaning and save for an analysed word', async () => {
      const onPauseVideo = jest.fn();
      const onToggle = jest.fn();
      const tree = await renderStudy({
        snapshot: pairedSnapshot(),
        analyses: {[firstId]: coffeeAnalysis},
        onPauseVideo,
        vocabularySave: {isSaved: () => false, onToggle},
      });
      pressByTestId(tree.root, `youtube-word-${firstId}-2`);
      expect(onPauseVideo).toHaveBeenCalledTimes(1);
      expect(
        tree.root.findByProps({testID: 'youtube-word-bubble-word'}).props
          .children,
      ).toBe('coffee');
      expect(
        tree.root.findByProps({testID: 'youtube-word-bubble-ipa'}).props
          .children,
      ).toBe('/ˈkɒfi/');
      expect(
        tree.root.findAllByProps({children: 'noun'}).length,
      ).toBeGreaterThan(0);
      expect(
        tree.root.findByProps({testID: 'youtube-word-bubble-meaning'}).props
          .children,
      ).toBe('cà phê');
      pressByTestId(tree.root, 'youtube-word-bubble-save');
      expect(onToggle).toHaveBeenCalledWith(coffeeAnalysis.vocabulary[0]);
      pressByTestId(tree.root, 'youtube-word-bubble-close');
      expect(
        tree.root.findAll(node => node.props.testID === 'youtube-word-bubble'),
      ).toHaveLength(0);
    });

    it('shows the paired IPA for a word without analysis', async () => {
      const tree = await renderStudy({snapshot: pairedSnapshot()});
      pressByTestId(tree.root, `youtube-word-${firstId}-1`);
      expect(
        tree.root.findByProps({testID: 'youtube-word-bubble-word'}).props
          .children,
      ).toBe('drink');
      expect(
        tree.root.findByProps({testID: 'youtube-word-bubble-ipa'}).props
          .children,
      ).toBe('/dɹˈɪŋk/');
      expect(
        tree.root.findAll(
          node => node.props.testID === 'youtube-word-bubble-save',
        ),
      ).toHaveLength(0);
    });
  });
});
