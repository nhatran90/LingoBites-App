import React from 'react';
import {FlatList} from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';
import type {LessonSentence} from '@core/schemas/lesson';

import {makeTestReleaseConfig, THEME_UI_FLAGS} from '@test/support';

import {YouTubeSentenceCarousel} from '../YouTubeSentenceCarousel';

beforeAll(() => {
  jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(false);
});

function sentence(
  id: string,
  position: number,
  cues?: {start: number; end: number},
): LessonSentence {
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

const sentences = [
  sentence('11111111-1111-4111-8111-111111111101', 0, {
    start: 0,
    end: 2000,
  }),
  sentence('11111111-1111-4111-8111-111111111102', 1, {
    start: 2000,
    end: 5000,
  }),
  sentence('11111111-1111-4111-8111-111111111103', 2, {
    start: 5000,
    end: 8000,
  }),
];

async function layoutCarousel(
  tree: ReactTestRenderer.ReactTestRenderer,
  width = 360,
) {
  const carousel = tree.root.findByProps({testID: 'youtube-sentence-carousel'});
  await act(async () => {
    carousel.props.onLayout({
      nativeEvent: {layout: {width, height: 400, x: 0, y: 0}},
    });
  });
}

async function renderCarousel(
  props: Partial<React.ComponentProps<typeof YouTubeSentenceCarousel>> = {},
) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  const onIndexChange = jest.fn();
  const onSeek = jest.fn();
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider
        releaseConfig={makeTestReleaseConfig(THEME_UI_FLAGS)}
      >
        <AppThemeProvider>
          <YouTubeSentenceCarousel
            sentences={sentences}
            currentIndex={0}
            onIndexChange={onIndexChange}
            activeIndex={0}
            showTranslation
            showIpa
            analyses={{}}
            onSeek={onSeek}
            {...props}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return {tree, onIndexChange, onSeek};
}

describe('YouTubeSentenceCarousel', () => {
  it('renders a card per sentence in order', async () => {
    const {tree} = await renderCarousel();
    await layoutCarousel(tree);
    for (const item of sentences) {
      expect(
        tree.root.findByProps({testID: `canonical-sentence-${item.id}`}),
      ).toBeDefined();
    }
  });

  it('calls onSeek when a card with start_ms is pressed', async () => {
    const onSeek = jest.fn();
    const {tree} = await renderCarousel({onSeek});
    await layoutCarousel(tree);
    const cue = tree.root.findByProps({
      testID: 'youtube-cue-11111111-1111-4111-8111-111111111102',
    });
    await act(async () => {
      cue.props.onPress();
    });
    expect(onSeek).toHaveBeenCalledWith(2000);
  });

  it('does not issue a non-animated scroll right after an animated one (CR-001)', async () => {
    const scrollToIndexSpy = jest.spyOn(FlatList.prototype, 'scrollToIndex');
    const onScrollAnimationConsumed = jest.fn();
    const {tree} = await renderCarousel({
      currentIndex: 0,
      scrollAnimated: false,
      onScrollAnimationConsumed,
    });
    await layoutCarousel(tree);
    scrollToIndexSpy.mockClear();

    await act(async () => {
      tree.update(
        <FeatureFlagProvider
          releaseConfig={makeTestReleaseConfig(THEME_UI_FLAGS)}
        >
          <AppThemeProvider>
            <YouTubeSentenceCarousel
              sentences={sentences}
              currentIndex={1}
              onIndexChange={jest.fn()}
              activeIndex={0}
              showTranslation
              showIpa
              analyses={{}}
              scrollAnimated
              onScrollAnimationConsumed={onScrollAnimationConsumed}
            />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    });

    const animatedCalls = scrollToIndexSpy.mock.calls.filter(
      ([opts]) => opts.animated === true,
    );
    const instantCalls = scrollToIndexSpy.mock.calls.filter(
      ([opts]) => opts.animated === false,
    );
    expect(animatedCalls.length).toBe(1);
    expect(instantCalls.length).toBe(0);
    expect(onScrollAnimationConsumed).toHaveBeenCalledTimes(1);
    scrollToIndexSpy.mockRestore();
  });

  it('hides translation and IPA when toggles are off', async () => {
    const {tree} = await renderCarousel({
      showTranslation: false,
      showIpa: false,
    });
    await layoutCarousel(tree);
    const card = tree.root.findByProps({
      testID: 'youtube-cue-text-11111111-1111-4111-8111-111111111101',
    });
    expect(card).toBeDefined();
    const ipaNodes = tree.root.findAll(
      node =>
        typeof node.props.children === 'string' &&
        node.props.children.startsWith('ipa-'),
    );
    expect(ipaNodes).toHaveLength(0);
  });

  it('never falls back to a whole-sentence IPA line', async () => {
    // "Sentence 0 en." has 3 words but its IPA has 1 token: no pairing.
    const {tree} = await renderCarousel({showIpa: true});
    await layoutCarousel(tree);
    const ipaNodes = tree.root.findAll(
      node =>
        typeof node.props.children === 'string' &&
        node.props.children.startsWith('ipa-'),
    );
    expect(ipaNodes).toHaveLength(0);
  });
});
