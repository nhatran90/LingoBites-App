import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
  AccessibilityInfo,
  ActivityIndicator,
  Animated,
  Easing,
  StyleSheet,
  View,
} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

import {MomentSituationChip} from './MomentSituationChip';

/** The server's moment steps (`compose.stage` on a moment's status), in order. */
const STEPS: Array<{stage: string; key: string; icon: HandoffIconName}> = [
  {stage: 'moment_author', key: 'author', icon: 'edit'},
  {stage: 'moment_source', key: 'source', icon: 'volume_up'},
  {stage: 'moment_compose', key: 'compose', icon: 'auto_stories'},
];
/** How full the bar is while each step runs (the bar never claims "done"). */
const STEP_FILL = [0.18, 0.5, 0.8];

/** A queued moment, or a server without the stage, reads as the first step. */
export function momentStepIndex(stage: string | null | undefined): number {
  const index = STEPS.findIndex(step => step.stage === stage);
  return index < 0 ? 0 : index;
}

type Props = {
  situation: string | null;
  stage: string | null | undefined;
  /** The last poll could not reach the server; the moment still runs there. */
  waitingNetwork: boolean;
};

/**
 * E3 wait screen: the situation being built, the three real steps of a moment
 * (dialogue, sentences and audio, six-step lesson), roughly how long it takes,
 * and that leaving is fine. Motion stops when the learner reduces motion.
 */
export function MomentBuildingCard({situation, stage, waitingNetwork}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const current = momentStepIndex(stage);
  const reduceMotion = useReduceMotion();

  const fill = useRef(new Animated.Value(STEP_FILL[current])).current;
  useEffect(() => {
    if (reduceMotion) {
      fill.setValue(STEP_FILL[current]);
      return;
    }
    Animated.timing(fill, {
      toValue: STEP_FILL[current],
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [current, fill, reduceMotion]);

  const title = waitingNetwork
    ? t('moment.wait_offline_title')
    : t(`moment.wait_title_${STEPS[current].key}`);
  const subtitle = waitingNetwork
    ? t('moment.wait_offline_body')
    : t('moment.wait_eta');

  return (
    <View style={styles.wrap} testID="moment-building">
      {situation ? <MomentSituationChip title={situation} /> : null}
      <View style={styles.stage}>
        {current === 0 && !waitingNetwork ? (
          <ChatPreview reduceMotion={reduceMotion} />
        ) : null}
        <View
          accessibilityLiveRegion="polite"
          accessible
          style={styles.heading}
        >
          <AppText testID="moment-building-title" variant="h3">
            {title}
          </AppText>
          <AppText color="muted" variant="caption">
            {subtitle}
          </AppText>
        </View>
        <View style={styles.track}>
          <Animated.View
            style={[
              styles.fill,
              {
                width: fill.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
        <View>
          {STEPS.map((step, index) => {
            const done = index < current;
            const now = index === current;
            return (
              <View
                key={step.stage}
                accessible
                style={styles.step}
                testID={`moment-step-${step.key}`}
              >
                <View
                  style={[
                    styles.stepIcon,
                    done ? styles.stepIconDone : null,
                    now ? styles.stepIconNow : null,
                  ]}
                >
                  {done ? (
                    <MaterialIcon
                      color={theme.colors.surface}
                      name="check"
                      size={16}
                    />
                  ) : now && !waitingNetwork ? (
                    <ActivityIndicator color={theme.colors.ink} size="small" />
                  ) : (
                    <MaterialIcon
                      color={now ? theme.colors.ink : theme.colors.text.muted}
                      name={step.icon}
                      size={15}
                    />
                  )}
                </View>
                <AppText
                  color={done || now ? 'primary' : 'muted'}
                  style={styles.stepText}
                >
                  {t(`moment.wait_step_${step.key}`)}
                </AppText>
                {done ? (
                  <AppText color="muted" variant="caption">
                    {t('moment.wait_step_done')}
                  </AppText>
                ) : null}
              </View>
            );
          })}
        </View>
      </View>
      {waitingNetwork ? null : (
        <View style={styles.note}>
          <MaterialIcon
            color={HERO_PALETTE.sunShelf}
            name="notifications"
            size={18}
          />
          <AppText style={styles.noteText} variant="caption">
            {t('moment.wait_note')}
          </AppText>
        </View>
      )}
    </View>
  );
}

/** Wordless chat bubbles appearing one by one: "a dialogue is being written". */
function ChatPreview({reduceMotion}: {reduceMotion: boolean}) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const bubbles = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (reduceMotion) {
      bubbles.forEach(value => value.setValue(1));
      return undefined;
    }
    const appear = (value: Animated.Value) =>
      Animated.timing(value, {
        toValue: 1,
        duration: 380,
        easing: Easing.out(Easing.quad),
        useNativeDriver: true,
      });
    const loop = Animated.loop(
      Animated.sequence([
        Animated.stagger(700, bubbles.map(appear)),
        Animated.delay(1400),
        Animated.parallel(
          bubbles.map(value =>
            Animated.timing(value, {
              toValue: 0,
              duration: 260,
              useNativeDriver: true,
            }),
          ),
        ),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [bubbles, reduceMotion]);

  const rows = [
    {side: 'left' as const, width: '62%' as const},
    {side: 'right' as const, width: '54%' as const},
    {side: 'left' as const, width: '38%' as const},
  ];
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={styles.chat}
    >
      {rows.map((row, index) => (
        <Animated.View
          key={index}
          style={[
            styles.bubble,
            row.side === 'left' ? styles.bubbleLeft : styles.bubbleRight,
            {
              width: row.width,
              opacity: bubbles[index],
              transform: [
                {
                  translateY: bubbles[index].interpolate({
                    inputRange: [0, 1],
                    outputRange: [6, 0],
                  }),
                },
              ],
            },
          ]}
        >
          <View
            style={[
              styles.line,
              row.side === 'right' ? styles.lineRight : null,
            ]}
          />
          {index < 2 ? (
            <View
              style={[
                styles.line,
                styles.lineShort,
                row.side === 'right' ? styles.lineRight : null,
              ]}
            />
          ) : null}
        </Animated.View>
      ))}
    </View>
  );
}

function useReduceMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled?.()
      .then(value => {
        if (alive) setReduce(value);
      })
      .catch(() => {});
    const subscription = AccessibilityInfo.addEventListener?.(
      'reduceMotionChanged',
      setReduce,
    );
    return () => {
      alive = false;
      subscription?.remove();
    };
  }, []);
  return reduce;
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    wrap: {gap: 14},
    stage: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      gap: 14,
      padding: 16,
      ...getStickerEdge(5, theme.colors.surfaceHigh),
    },
    heading: {gap: 2},
    chat: {gap: 8, paddingBottom: 2, paddingTop: 4},
    bubble: {
      borderRadius: 16,
      gap: 6,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    bubbleLeft: {
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.surfaceMuted,
      borderBottomLeftRadius: 5,
    },
    bubbleRight: {
      alignSelf: 'flex-end',
      backgroundColor: theme.colors.accentSoft,
      borderBottomRightRadius: 5,
    },
    line: {
      backgroundColor: theme.colors.surfaceHigh,
      borderRadius: 4,
      height: 7,
      width: '100%',
    },
    lineShort: {width: '60%'},
    lineRight: {backgroundColor: theme.colors.primary, opacity: 0.25},
    track: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.pill,
      height: 8,
      overflow: 'hidden',
    },
    fill: {
      backgroundColor: theme.colors.primary,
      borderRadius: theme.radius.pill,
      height: '100%',
    },
    step: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      minHeight: 40,
    },
    stepIcon: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: 13,
      height: 26,
      justifyContent: 'center',
      width: 26,
    },
    stepIconDone: {backgroundColor: theme.colors.primary},
    stepIconNow: {backgroundColor: HERO_PALETTE.sun},
    stepText: {flex: 1, fontSize: 14.5, fontWeight: '600'},
    note: {
      alignItems: 'flex-start',
      backgroundColor: theme.colors.tertiarySoft,
      borderRadius: 16,
      flexDirection: 'row',
      gap: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    noteText: {color: theme.colors.text.secondary, flex: 1},
  });
}
