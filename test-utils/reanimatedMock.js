/**
 * Minimal synchronous Jest mock for react-native-reanimated.
 *
 * The official `react-native-reanimated/mock` cannot be used here: it points
 * at the library's TypeScript sources, which Jest does not transform inside
 * node_modules (see jest.config.js / @react-native/jest-preset). Instead this
 * mock reproduces the documented Jest semantics — shared values are plain
 * `{value}` objects, `withTiming`/`withSpring` resolve to their target
 * immediately, and `useAnimatedStyle` evaluates its callback on every render.
 *
 * Keep this in sync with the Reanimated surface actually used in src:
 * Animated.View, Animated.FlatList, Easing, interpolateColor,
 * useAnimatedScrollHandler, useAnimatedStyle, useReducedMotion,
 * useSharedValue, withTiming, withRepeat, cancelAnimation, interpolate and
 * the FadeIn/FadeOut/FadeInDown layout animations. Extend only when a
 * component needs more.
 */
const React = require('react');
const {View, Text, Image, ScrollView, FlatList} = require('react-native');

const Easing = {
  linear: t => t,
  ease: t => t,
  quad: t => t * t,
  cubic: t => t * t * t,
  in: easing => easing,
  out: easing => easing,
  inOut: easing => easing,
};

const ReduceMotion = {
  System: 'system',
  Never: 'never',
  Always: 'always',
};

function useSharedValue(init) {
  // Like the real hook, the same object must survive re-renders — otherwise
  // values assigned in effects would be lost on the next render and animated
  // styles could never be asserted. (The official mock returns a fresh
  // object per render, which breaks exactly this.)
  const ref = React.useRef(null);
  if (ref.current === null) {
    ref.current = {value: init};
  }
  return ref.current;
}

function useAnimatedStyle(updater) {
  return updater();
}

/** Runs the worklet on the JS thread with the scroll event's payload. */
function useAnimatedScrollHandler(handler) {
  const onScroll = typeof handler === 'function' ? handler : handler.onScroll;
  return event => onScroll?.(event.nativeEvent);
}

function useReducedMotion() {
  return false;
}

function withTiming(toValue) {
  return toValue;
}

function withSpring(toValue) {
  return toValue;
}

/** Tracks animation sequences (I2/I8 HomeHeroCard). */
const withSequenceCalls = [];

function withSequence(...animations) {
  withSequenceCalls.push(animations);
  return animations.length > 0 ? animations[animations.length - 1] : 0;
}

function clearWithSequenceCalls() {
  withSequenceCalls.length = 0;
}

function withDelay(_, animation) {
  return animation;
}

function withRepeat(animation) {
  return animation;
}

function cancelAnimation() {}

/** Linear interpolation, clamped like Extrapolation.CLAMP. */
function interpolate(value, inputRange, outputRange) {
  const [x0, x1] = [inputRange[0], inputRange[inputRange.length - 1]];
  const [y0, y1] = [outputRange[0], outputRange[outputRange.length - 1]];
  if (x1 === x0) {
    return y0;
  }
  const t = Math.min(1, Math.max(0, (value - x0) / (x1 - x0)));
  return y0 + (y1 - y0) * t;
}

/**
 * Layout animations (`entering` / `exiting`) do nothing in Jest: a builder
 * whose chain methods all return the builder itself.
 */
function layoutAnimation() {
  const builder = {};
  for (const name of [
    'delay',
    'duration',
    'easing',
    'reduceMotion',
    'springify',
    'withCallback',
    'withInitialValues',
  ]) {
    builder[name] = () => builder;
  }
  return builder;
}

const FadeIn = layoutAnimation();
const FadeOut = layoutAnimation();
const FadeInDown = layoutAnimation();

function createAnimatedComponent(Component) {
  return Component;
}

function interpolateColor(value, inputRange, outputRange) {
  if (inputRange.length === 0) {
    return outputRange[0] ?? '';
  }
  if (value <= inputRange[0]) {
    return outputRange[0];
  }
  const last = inputRange.length - 1;
  if (value >= inputRange[last]) {
    return outputRange[last];
  }
  for (let i = 0; i < last; i += 1) {
    if (value >= inputRange[i] && value <= inputRange[i + 1]) {
      const span = inputRange[i + 1] - inputRange[i];
      const t = span === 0 ? 0 : (value - inputRange[i]) / span;
      return t < 0.5 ? outputRange[i] : outputRange[i + 1];
    }
  }
  return outputRange[last];
}

module.exports = {
  __esModule: true,
  default: {
    View,
    Text,
    Image,
    ScrollView,
    FlatList,
    createAnimatedComponent,
  },
  View,
  Text,
  Image,
  ScrollView,
  FlatList,
  createAnimatedComponent,
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  cancelAnimation,
  interpolate,
  interpolateColor,
  ReduceMotion,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  clearWithSequenceCalls,
  withSequenceCalls,
};
