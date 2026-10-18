import React, {
  createContext,
  useContext,
  useEffect,
  useId,
  useState,
} from 'react';
import {
  type DimensionValue,
  type LayoutChangeEvent,
  type StyleProp,
  StyleSheet,
  View,
  type ViewStyle,
} from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, {Defs, LinearGradient, Rect, Stop} from 'react-native-svg';

import {useAppTheme} from '../theme';

/** A load that ends sooner than this never shows its skeleton. */
const APPEAR_DELAY_MS = 150;
const APPEAR_MS = 200;
const FADE_OUT_MS = 140;
/** One pass of the light across a block. */
const SHIMMER_MS = 1300;
/** Content rises this far into place when it replaces a skeleton. */
const RISE_PX = 8;
const RISE_MS = 320;
const RISE_STAGGER_MS = 45;
/** Rows past this index arrive together (they are usually off screen). */
const RISE_MAX_STAGGERED = 6;

/** Shared shimmer clock: every block of one group sweeps in step. */
const ShimmerContext = createContext<SharedValue<number> | null>(null);

type GroupProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  testID?: string;
};

/**
 * Wraps the placeholder blocks of one loading screen: they fade in only
 * after a short delay (so a fast load never flashes) and fade out as the
 * content arrives. A soft light sweeps across every block in step; with
 * Reduce Motion the blocks stay still.
 */
export function SkeletonGroup({children, style, testID}: GroupProps) {
  const reducedMotion = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reducedMotion) return;
    progress.value = withRepeat(
      withTiming(1, {duration: SHIMMER_MS, easing: Easing.inOut(Easing.ease)}),
      -1,
      false,
    );
    return () => cancelAnimation(progress);
  }, [progress, reducedMotion]);

  return (
    <ShimmerContext.Provider value={reducedMotion ? null : progress}>
      <Animated.View
        accessibilityElementsHidden
        entering={FadeIn.delay(APPEAR_DELAY_MS).duration(APPEAR_MS)}
        exiting={FadeOut.duration(FADE_OUT_MS)}
        importantForAccessibility="no-hide-descendants"
        style={style}
        testID={testID}
      >
        {children}
      </Animated.View>
    </ShimmerContext.Provider>
  );
}

type BlockProps = {
  /** Stretches across its column when left out. */
  width?: DimensionValue;
  height: number;
  radius?: number;
  /** Block colour, e.g. a tint of a coloured card; else the theme's. */
  color?: string;
  style?: StyleProp<ViewStyle>;
};

/** One placeholder shape standing in for text, a picture or a button. */
export function SkeletonBlock({
  width,
  height,
  radius = 8,
  color,
  style,
}: BlockProps) {
  const {theme} = useAppTheme();
  const progress = useContext(ShimmerContext);
  const [blockWidth, setBlockWidth] = useState(0);
  const onLayout = (event: LayoutChangeEvent) =>
    setBlockWidth(event.nativeEvent.layout.width);

  return (
    <View
      onLayout={progress ? onLayout : undefined}
      style={[
        styles.block,
        {
          backgroundColor: color ?? theme.colors.surfaceContainer,
          borderRadius: radius,
          height,
          width,
        },
        style,
      ]}
    >
      {progress && blockWidth > 0 ? (
        <Shine
          color={theme.colors.overlayLight}
          height={height}
          progress={progress}
          width={blockWidth}
        />
      ) : null}
    </View>
  );
}

function Shine({
  color,
  height,
  progress,
  width,
}: {
  color: string;
  height: number;
  progress: SharedValue<number>;
  width: number;
}) {
  // Gradient ids must be unique per drawing.
  const gradientId = `skeletonShine${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const sweep = useAnimatedStyle(() => ({
    transform: [
      {translateX: interpolate(progress.value, [0, 1], [-width, width])},
    ],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[StyleSheet.absoluteFill, sweep]}
    >
      <Svg height={height} width={width}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" x2="1" y1="0" y2="0">
            <Stop offset="0" stopColor={color} stopOpacity={0} />
            <Stop offset="0.5" stopColor={color} stopOpacity={1} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect fill={`url(#${gradientId})`} height="100%" width="100%" />
      </Svg>
    </Animated.View>
  );
}

/**
 * Entering animation for the row at `index` when real content replaces a
 * skeleton: a short fade and rise, each row a beat after the one above.
 * Reanimated skips it when Reduce Motion is on.
 */
export function skeletonRevealEntering(index: number) {
  return FadeInDown.withInitialValues({
    opacity: 0,
    transform: [{translateY: RISE_PX}],
  })
    .duration(RISE_MS)
    .delay(Math.min(index, RISE_MAX_STAGGERED) * RISE_STAGGER_MS)
    .easing(Easing.out(Easing.cubic));
}

const styles = StyleSheet.create({
  block: {
    overflow: 'hidden',
  },
});
