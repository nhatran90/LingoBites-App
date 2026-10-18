import React from 'react';
import {ScrollView, Text} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {StudyPage} from '../StudyControls';
import {SwipeCard} from '../SwipeCard';

/** A touch history with one finger at (x, y), as the responder system passes it. */
function touchEvent(x: number, y: number, time: number) {
  const touch = {
    touchActive: true,
    startPageX: 0,
    startPageY: 0,
    startTimeStamp: 0,
    currentPageX: x,
    currentPageY: y,
    currentTimeStamp: time,
    previousPageX: 0,
    previousPageY: 0,
    previousTimeStamp: 0,
  };
  return {
    nativeEvent: {pageX: x, pageY: y, timestamp: time, touches: [touch]},
    touchHistory: {
      numberActiveTouches: 1,
      indexOfSingleActiveTouch: 0,
      mostRecentTimeStamp: time,
      touchBank: [touch],
    },
  };
}

function render() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <StudyPage footer={null} pageKey="a">
            <SwipeCard
              canNext
              canPrevious={false}
              onNext={jest.fn()}
              onPrevious={jest.fn()}
              testID="card"
            >
              <Text>card</Text>
            </SwipeCard>
          </StudyPage>
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

const scrollEnabled = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.findByType(ScrollView).props.scrollEnabled;

const card = (tree: ReactTestRenderer.ReactTestRenderer) =>
  tree.root.find(
    node =>
      node.props.testID === 'card' &&
      typeof node.props.onResponderGrant === 'function',
  );

it('stops the page scrolling while the card is dragged', () => {
  const tree = render();
  expect(scrollEnabled(tree)).toBe(true);

  act(() => card(tree).props.onResponderGrant(touchEvent(0, 0, 1)));
  expect(scrollEnabled(tree)).toBe(false);

  act(() => card(tree).props.onResponderRelease(touchEvent(10, 0, 2)));
  expect(scrollEnabled(tree)).toBe(true);
});

it('gives the scroll back when the drag is taken away', () => {
  const tree = render();
  act(() => card(tree).props.onResponderGrant(touchEvent(0, 0, 1)));
  act(() => card(tree).props.onResponderTerminate(touchEvent(0, 0, 2)));
  expect(scrollEnabled(tree)).toBe(true);
});
