import React, {useEffect, useMemo, useRef, useState} from 'react';
import {
  type AccessibilityActionEvent,
  type AccessibilityActionInfo,
  AccessibilityInfo,
  Animated,
  PanResponder,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {CARD_HEIGHT, CARD_SHELF_HEIGHT} from '@ui/components/ToneCard';
import {type AppTheme, useAppTheme} from '@ui/theme';

/** How many cards show behind the top one. */
const DEPTH = 2;
/** How much of each card behind shows under the one in front. */
const PEEK = 10;
/** How much narrower each card behind gets. */
const SCALE_STEP = 0.05;
const SWIPE_THRESHOLD = 80;
const SWIPE_VELOCITY = 0.6;
/** How far a swiped card flies, as a share of the stack's width. */
const FLY = 1.15;

/** Lets screen readers move through the stack from the top card. */
export interface StackCardA11y {
  accessibilityActions: AccessibilityActionInfo[];
  onAccessibilityAction: (event: AccessibilityActionEvent) => void;
}

export interface PackStackProps<T> {
  items: readonly T[];
  keyOf: (item: T) => string;
  /** Draws one card; `a11y` goes on the card's button. */
  renderCard: (item: T, index: number, a11y: StackCardA11y) => React.ReactNode;
  /** Swiping on past the last card, e.g. to open the full list. */
  onPastEnd: () => void;
  /** Items left out of the stack, shown as "+29" after the dots. */
  moreCount?: number;
  /** Height of one card with its shelf; defaults to a tone card's. */
  cardHeight?: number;
  testID?: string;
}

/**
 * Cards piled on top of each other, the next ones peeking out below. Swipe
 * left for the next card and right to bring the last one back; swiping on
 * past the last card calls `onPastEnd`. Taps still reach the top card (the
 * pan only claims clear horizontal drags), and vertical drags scroll the
 * page.
 */
export function PackStack<T>({
  items,
  keyOf,
  renderCard,
  onPastEnd,
  moreCount = 0,
  cardHeight = CARD_HEIGHT + CARD_SHELF_HEIGHT,
  testID = 'pack-stack',
}: PackStackProps<T>) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const {width: windowWidth} = useWindowDimensions();
  const [stackWidth, setStackWidth] = useState(windowWidth);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [index, setIndex] = useState(0);
  // Where the stack is, in cards: 1.4 is 40% of the way from card 2 to 3.
  const position = useRef(new Animated.Value(0)).current;
  const count = items.length;
  const lastIndex = Math.max(count - 1, 0);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const sub = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      setReduceMotion,
    );
    return () => sub.remove();
  }, []);

  // Fewer packs after a reload: stay on the last one there is.
  useEffect(() => {
    if (index > lastIndex) {
      setIndex(lastIndex);
      position.setValue(lastIndex);
    }
  }, [index, lastIndex, position]);

  // The responder is created once; read the latest values through a ref.
  const latest = useRef({index, count, onPastEnd, reduceMotion, stackWidth});
  latest.current = {index, count, onPastEnd, reduceMotion, stackWidth};

  const actions = useMemo(() => {
    const animateTo = (value: number, done?: () => void) => {
      if (latest.current.reduceMotion) {
        position.setValue(value);
        done?.();
        return;
      }
      Animated.timing(position, {
        toValue: value,
        duration: 220,
        useNativeDriver: true,
      }).start(({finished}) => finished && done?.());
    };
    const goTo = (target: number) => {
      latest.current.index = target;
      setIndex(target);
      animateTo(target);
    };
    const pastEnd = () => {
      const last = latest.current.count - 1;
      // The top card flies off, then comes back under the pushed screen.
      animateTo(latest.current.count, () => {
        latest.current.onPastEnd();
        position.setValue(last);
      });
    };
    return {
      settle: () => animateTo(latest.current.index),
      next: () => {
        const {index: at, count: total} = latest.current;
        if (at < total - 1) goTo(at + 1);
        else pastEnd();
      },
      previous: () => {
        const at = latest.current.index;
        if (at > 0) goTo(at - 1);
        else animateTo(0);
      },
    };
  }, [position]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_e, g) =>
          latest.current.count > 0 &&
          Math.abs(g.dx) > 10 &&
          Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
        onPanResponderGrant: () => position.stopAnimation(),
        onPanResponderMove: (_e, g) => {
          const {index: at, count: total, stackWidth: w} = latest.current;
          const next = at - g.dx / Math.max(w, 1);
          position.setValue(
            Math.min(
              Math.max(next, Math.max(at - 1, 0)),
              Math.min(at + 1, total),
            ),
          );
        },
        onPanResponderRelease: (_e, g) => {
          const commit =
            Math.abs(g.dx) > SWIPE_THRESHOLD ||
            (Math.abs(g.vx) > SWIPE_VELOCITY && Math.abs(g.dx) > 20);
          if (!commit) actions.settle();
          else if (g.dx < 0) actions.next();
          else actions.previous();
        },
        // Keep the drag once it started, so the page does not scroll away.
        onPanResponderTerminationRequest: () => false,
        onPanResponderTerminate: () => actions.settle(),
      }),
    [actions, position],
  );

  const a11y: StackCardA11y = {
    accessibilityActions: [
      {
        name: 'next',
        label: index < lastIndex ? 'Gói sau' : 'Xem tất cả gói',
      },
      ...(index > 0 ? [{name: 'previous', label: 'Gói trước'}] : []),
    ],
    onAccessibilityAction: event => {
      if (event.nativeEvent.actionName === 'next') {
        if (index < lastIndex) {
          AccessibilityInfo.announceForAccessibility(
            `Gói ${index + 2} trên ${count}`,
          );
        }
        actions.next();
      } else if (event.nativeEvent.actionName === 'previous') {
        AccessibilityInfo.announceForAccessibility(
          `Gói ${index} trên ${count}`,
        );
        actions.previous();
      }
    },
  };

  const peeking = Math.min(lastIndex, DEPTH);
  const fly = -stackWidth * FLY;

  return (
    <View style={styles.wrap} testID={testID}>
      <View
        {...panResponder.panHandlers}
        onLayout={event => setStackWidth(event.nativeEvent.layout.width)}
        style={{height: cardHeight + peeking * PEEK}}
        testID={`${testID}-cards`}
      >
        {/* Drawn last to first, so the earlier cards sit on top. */}
        {items
          .map((item, k) => {
            const isTop = k === index;
            const along = (from: number, to: number, out: [number, number]) =>
              position.interpolate({
                inputRange: [from, to],
                outputRange: out,
                extrapolate: 'clamp',
              });
            return (
              <Animated.View
                accessibilityElementsHidden={!isTop}
                importantForAccessibility={
                  isTop ? 'auto' : 'no-hide-descendants'
                }
                key={keyOf(item)}
                pointerEvents={isTop ? 'auto' : 'none'}
                style={[
                  styles.card,
                  {
                    opacity: along(k - DEPTH - 1, k - DEPTH, [0, 1]),
                    transform: [
                      {translateX: along(k, k + 1, [0, fly])},
                      {translateY: along(k - DEPTH, k, [DEPTH * PEEK, 0])},
                      {
                        rotate: position.interpolate({
                          inputRange: [k, k + 1],
                          outputRange: ['0deg', '-10deg'],
                          extrapolate: 'clamp',
                        }),
                      },
                      {
                        scale: along(k - DEPTH, k, [1 - DEPTH * SCALE_STEP, 1]),
                      },
                    ],
                  },
                ]}
                testID={`${testID}-card-${k}`}
              >
                {renderCard(item, k, a11y)}
              </Animated.View>
            );
          })
          .reverse()}
      </View>
      {count > 1 || moreCount > 0 ? (
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.dots}
        >
          {items.map((item, k) => (
            <View
              key={keyOf(item)}
              style={[styles.dot, k === index && styles.dotOn]}
              testID={k === index ? `${testID}-dot-on` : undefined}
            />
          ))}
          {moreCount > 0 ? (
            <AppText
              color="secondary"
              style={styles.more}
              testID={`${testID}-more`}
            >
              {`+${moreCount}`}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    wrap: {
      gap: theme.spacing.sm,
    },
    card: {
      left: 0,
      position: 'absolute',
      right: 0,
      top: 0,
      // Cards behind shrink toward their bottom edge, which peeks out.
      transformOrigin: 'bottom',
    },
    dots: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'center',
    },
    dot: {
      backgroundColor: theme.colors.outlineVariant,
      borderRadius: 4,
      height: 7,
      width: 7,
    },
    dotOn: {
      backgroundColor: theme.colors.primary,
      width: 20,
    },
    more: {
      fontSize: 11.5,
      fontWeight: '700',
      marginLeft: 4,
    },
  });
}
