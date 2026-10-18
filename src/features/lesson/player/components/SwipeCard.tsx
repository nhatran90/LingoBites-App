import React, {useEffect, useMemo, useRef} from 'react';
import {
  Animated,
  PanResponder,
  type StyleProp,
  useWindowDimensions,
  type ViewStyle,
} from 'react-native';
import {useReducedMotion} from 'react-native-reanimated';

import {useStudyScrollLock} from './StudyControls';

const SWIPE_THRESHOLD = 70;
const SWIPE_VELOCITY = 0.6;
const DURATION = 180;

type Props = {
  children: React.ReactNode;
  canPrevious: boolean;
  canNext: boolean;
  onPrevious: () => void;
  onNext: () => void;
  style?: StyleProp<ViewStyle>;
  /** The sideways offset, when the parent animates other cards with it. */
  drag?: Animated.Value;
  testID?: string;
};

/**
 * A card that follows a sideways drag: past the threshold it flies off, the
 * page changes (left = next, right = previous) and the new card slides in
 * from the other side. Taps still reach the card's buttons (the pan only
 * claims clear horizontal drags) and vertical drags scroll the page. Once the
 * card has the drag, the study page stops scrolling until it is let go, so a
 * slanted swipe never moves the card and the page together.
 * Screen readers move with the page's own previous / next buttons.
 */
export function SwipeCard({
  children,
  canPrevious,
  canNext,
  onPrevious,
  onNext,
  style,
  drag,
  testID,
}: Props) {
  const {width} = useWindowDimensions();
  const reduceMotion = useReducedMotion();
  const own = useRef(new Animated.Value(0)).current;
  const x = drag ?? own;
  const lockScroll = useStudyScrollLock();

  // The responder is created once; read the latest values through a ref.
  const latest = useRef({
    canPrevious,
    canNext,
    onPrevious,
    onNext,
    width,
    lockScroll,
  });
  latest.current = {
    canPrevious,
    canNext,
    onPrevious,
    onNext,
    width,
    lockScroll,
  };
  const motion = useRef(reduceMotion);
  motion.current = reduceMotion;

  // Stop a running slide (and give the page its scroll back) when the card goes away.
  useEffect(
    () => () => {
      x.stopAnimation();
      latest.current.lockScroll(false);
    },
    [x],
  );

  const panResponder = useMemo(() => {
    const release = () => latest.current.lockScroll(false);
    const settle = () => {
      release();
      Animated.spring(x, {
        toValue: 0,
        useNativeDriver: true,
        bounciness: 6,
      }).start();
    };
    const go = (direction: 1 | -1) => {
      const {onNext: next, onPrevious: previous, width: w} = latest.current;
      release();
      const change = direction === 1 ? next : previous;
      if (motion.current) {
        x.setValue(0);
        change();
        return;
      }
      Animated.timing(x, {
        toValue: -direction * w,
        duration: DURATION,
        useNativeDriver: true,
      }).start(() => {
        change();
        x.setValue(direction * w);
        Animated.timing(x, {
          toValue: 0,
          duration: DURATION,
          useNativeDriver: true,
        }).start();
      });
    };
    return PanResponder.create({
      onMoveShouldSetPanResponder: (_e, g) =>
        Math.abs(g.dx) > 10 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderGrant: () => {
        x.stopAnimation();
        latest.current.lockScroll(true);
      },
      onPanResponderMove: (_e, g) => {
        const {canNext: hasNext, canPrevious: hasPrevious} = latest.current;
        // Resist past the first or last page.
        const blocked = (g.dx < 0 && !hasNext) || (g.dx > 0 && !hasPrevious);
        x.setValue(blocked ? g.dx / 4 : g.dx);
      },
      onPanResponderRelease: (_e, g) => {
        const {canNext: hasNext, canPrevious: hasPrevious} = latest.current;
        const commit =
          Math.abs(g.dx) > SWIPE_THRESHOLD ||
          (Math.abs(g.vx) > SWIPE_VELOCITY && Math.abs(g.dx) > 20);
        if (commit && g.dx < 0 && hasNext) go(1);
        else if (commit && g.dx > 0 && hasPrevious) go(-1);
        else settle();
      },
      // Keep the drag once it started, so the page does not scroll away.
      onPanResponderTerminationRequest: () => false,
      onPanResponderTerminate: settle,
    });
  }, [x]);

  const rotate = x.interpolate({
    inputRange: [-width, 0, width],
    outputRange: ['-8deg', '0deg', '8deg'],
  });

  return (
    <Animated.View
      {...panResponder.panHandlers}
      style={[style, {transform: [{translateX: x}, {rotate}]}]}
      testID={testID}
    >
      {children}
    </Animated.View>
  );
}
