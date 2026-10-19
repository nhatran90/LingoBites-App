import React from 'react';
import {StyleSheet} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {CurriculumHeroCover, HERO_HEIGHT} from '../CurriculumHeroCover';

/** The animated picture box: the first view with the hero's height. */
function pictureTransform(renderer: ReactTestRenderer.ReactTestRenderer) {
  const box = renderer.root.findAll(
    node =>
      typeof node.type === 'string' &&
      StyleSheet.flatten(node.props.style)?.height === HERO_HEIGHT,
  )[0];
  return StyleSheet.flatten(box.props.style).transform;
}

function render(scrollY: number) {
  let renderer!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    renderer = ReactTestRenderer.create(
      <FeatureFlagProvider releaseConfig={{releaseName: 'test', features: {}}}>
        <AppThemeProvider>
          <CurriculumHeroCover
            glyph="book"
            scrollY={{value: scrollY} as never}
            testID="hero"
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return renderer;
}

describe('CurriculumHeroCover', () => {
  it('pins the picture and grows it when pulled past the top', () => {
    expect(pictureTransform(render(-90))).toEqual([
      {translateY: -90},
      {scale: (HERO_HEIGHT + 90) / HERO_HEIGHT},
    ]);
  });

  it('lags the picture behind the list as it scrolls up', () => {
    expect(pictureTransform(render(100))).toEqual([
      {translateY: 40},
      {scale: 1},
    ]);
  });

  it('stops the parallax once the picture is covered', () => {
    expect(pictureTransform(render(HERO_HEIGHT * 3))).toEqual([
      {translateY: HERO_HEIGHT * 0.4},
      {scale: 1},
    ]);
  });
});
