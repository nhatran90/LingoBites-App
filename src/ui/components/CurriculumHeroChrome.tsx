import React, {useContext, useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import Animated, {
  type SharedValue,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import {SafeAreaInsetsContext} from 'react-native-safe-area-context';

import {AppText} from '@ui/components/AppText';
import {
  HEADER_BUTTON_SIZE,
  HeaderIconButton,
} from '@ui/components/HeaderIconButton';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {HERO_HEIGHT} from './CurriculumHeroCover';

const BAR_HEIGHT = 56;

/**
 * The list's scroll offset on the UI thread; pass `onScroll` to the list and
 * `scrollY` to `CurriculumHeroCover` and `CurriculumHeroChrome`.
 */
export function useHeroScroll() {
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler(event => {
    scrollY.value = event.contentOffset.y;
  });
  return {scrollY, onScroll};
}

/** `onScroll` from `useHeroScroll`, for an animated list. */
export type HeroScrollHandler = ReturnType<typeof useHeroScroll>['onScroll'];

type Props = {
  title: string;
  onBack: () => void;
  /**
   * The list's scroll offset (`useHeroScroll`): once the hero has scrolled
   * away, a solid bar with the title fades in behind the button.
   */
  scrollY: SharedValue<number>;
  backLabel?: string;
  /** Shown at the top right over the picture, e.g. the streak. */
  rightAccessory?: React.ReactNode;
};

/**
 * The back button floating over a curriculum hero picture, and the bar that
 * fades in with the screen title once the picture has scrolled away.
 */
export function CurriculumHeroChrome({
  title,
  onBack,
  scrollY,
  backLabel = 'Quay lại',
  rightAccessory,
}: Props) {
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const topInset = useContext(SafeAreaInsetsContext)?.top ?? 0;
  const barStyle = useAnimatedStyle(() => ({
    opacity: withTiming(scrollY.value > HERO_HEIGHT - BAR_HEIGHT ? 1 : 0, {
      duration: 150,
    }),
  }));

  return (
    <View pointerEvents="box-none" style={styles.overlay}>
      <Animated.View
        pointerEvents="none"
        style={[
          themedStyles.bar,
          {height: topInset + BAR_HEIGHT, paddingTop: topInset},
          barStyle,
        ]}
        testID="curriculum-hero-bar"
      >
        <AppText color="primary" numberOfLines={1} variant="h3">
          {title}
        </AppText>
      </Animated.View>
      <View style={[themedStyles.back, {top: topInset + 8}]}>
        <HeaderIconButton
          accessibilityHint="Về màn trước"
          accessibilityLabel={backLabel}
          icon="arrow_back"
          onPress={onBack}
          testID="screen-header-back"
        />
      </View>
      {rightAccessory ? (
        <View style={[themedStyles.right, {top: topInset + 8}]}>
          {rightAccessory}
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    back: {
      left: theme.gutter,
      position: 'absolute',
    },
    right: {
      position: 'absolute',
      right: theme.gutter,
    },
    bar: {
      backgroundColor: theme.colors.background,
      borderBottomColor: theme.colors.outlineVariant,
      borderBottomWidth: StyleSheet.hairlineWidth,
      justifyContent: 'center',
      paddingLeft: theme.gutter + HEADER_BUTTON_SIZE + theme.spacing.md,
      paddingRight: theme.gutter,
    },
  });
}

const styles = StyleSheet.create({
  overlay: {
    left: 0,
    position: 'absolute',
    right: 0,
    top: 0,
  },
});
