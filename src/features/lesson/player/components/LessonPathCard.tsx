/**
 * LessonPathCard — "Lộ trình" on the lesson hub: the lesson flow's parts as
 * a row of dots (done, current, still to do) with their names underneath,
 * and what comes next.
 *
 *   (✓)━━(2)──(3)──(4)──(5)──(6)
 *   Ôn  Nghe hiểu  Luyện …
 *   [ Tiếp theo: Nghe hiểu · 3 hoạt động ]
 */
import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerFace} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

export type LessonPathStep = {
  step: number;
  /** Short name under the dot, e.g. "Nghe hiểu". */
  label: string;
};

type Props = {
  /** The parts shown, in order; numbered 1… as shown, not by `step`. */
  steps: LessonPathStep[];
  /** The part the learner is on; every earlier part counts as done. */
  current: number;
  /** Every part is done: all dots filled, no "next" line. */
  finished: boolean;
  /** Activities in the current part; 0 hides the count. */
  nextActivities: number;
  /** A line under "next", e.g. why the review part is left out. */
  note?: string | null;
  onOpen: () => void;
};

export function LessonPathCard({
  steps,
  current,
  finished,
  nextActivities,
  note,
  onOpen,
}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const doneCount = finished
    ? steps.length
    : steps.filter(item => item.step < current).length;
  const next = steps.find(item => item.step === current);

  return (
    <View style={styles.section} testID="lesson-path">
      <View style={styles.header}>
        <AppText variant="h3">{t('lessonPlayer.path_title')}</AppText>
        <Pressable
          accessibilityHint={t('lessonPlayer.path_details_hint')}
          accessibilityRole="button"
          hitSlop={8}
          onPress={onOpen}
          testID="lesson-path-details"
        >
          <AppText color="primary" variant="label">
            {t('lessonPlayer.path_details')}
          </AppText>
        </Pressable>
      </View>
      <View style={styles.card}>
        <View
          accessibilityLabel={t('lessonPlayer.path_a11y', {
            done: doneCount,
            total: steps.length,
          })}
          accessible
          style={styles.dots}
        >
          {steps.map((item, index) => {
            const done = finished || item.step < current;
            const now = !finished && item.step === current;
            return (
              <React.Fragment key={item.step}>
                {index > 0 ? (
                  <View style={[styles.link, done ? styles.linkDone : null]} />
                ) : null}
                <View
                  style={[
                    styles.dot,
                    done ? styles.dotDone : null,
                    now ? styles.dotNow : null,
                  ]}
                  testID={`lesson-path-step-${item.step}${
                    done ? '-done' : now ? '-current' : ''
                  }`}
                >
                  <AppText
                    style={[
                      styles.dotText,
                      done || now ? styles.dotTextOn : null,
                    ]}
                  >
                    {done ? '✓' : index + 1}
                  </AppText>
                </View>
              </React.Fragment>
            );
          })}
        </View>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={styles.labels}
        >
          {steps.map(item => (
            <AppText
              key={item.step}
              numberOfLines={2}
              style={[
                styles.label,
                !finished && item.step === current ? styles.labelNow : null,
              ]}
            >
              {item.label}
            </AppText>
          ))}
        </View>
        <View
          style={[styles.next, finished ? styles.nextDone : null]}
          testID="lesson-path-next"
        >
          <AppText style={[styles.nextTitle, finished && styles.doneText]}>
            {finished || !next
              ? t('lessonPlayer.path_done')
              : t('lessonPlayer.path_next', {label: next.label})}
          </AppText>
          {!finished && nextActivities > 0 ? (
            <AppText style={styles.nextSub}>
              {t('lessonPlayer.path_next_activities', {
                count: nextActivities,
              })}
            </AppText>
          ) : null}
        </View>
        {note ? (
          <AppText
            color="secondary"
            style={styles.note}
            testID="lesson-path-note"
            variant="caption"
          >
            {note}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const DOT = 30;

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    section: {
      gap: theme.spacing.sm,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 22,
      gap: 8,
      padding: 14,
      ...getStickerFace(theme, 4),
    },
    dots: {
      alignItems: 'center',
      flexDirection: 'row',
    },
    dot: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceContainer,
      borderColor: theme.colors.outlineVariant,
      borderRadius: DOT / 2,
      borderWidth: 2,
      height: DOT,
      justifyContent: 'center',
      width: DOT,
    },
    dotDone: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    dotNow: {
      backgroundColor: HERO_PALETTE.coral,
      borderColor: HERO_PALETTE.coralRing,
      borderWidth: 4,
    },
    dotText: {
      color: theme.colors.text.muted,
      fontSize: 13,
      fontWeight: '800',
    },
    dotTextOn: {
      color: HERO_PALETTE.white,
    },
    link: {
      backgroundColor: theme.colors.outlineVariant,
      borderRadius: 2,
      flex: 1,
      height: 3,
    },
    linkDone: {
      backgroundColor: theme.colors.primary,
    },
    labels: {
      flexDirection: 'row',
      gap: 2,
    },
    label: {
      color: theme.colors.text.muted,
      flex: 1,
      fontSize: 10.5,
      fontWeight: '700',
      lineHeight: 13,
      textAlign: 'center',
    },
    labelNow: {
      color: HERO_PALETTE.coralShelf,
    },
    next: {
      backgroundColor: theme.colors.secondarySoft,
      borderRadius: 14,
      gap: 1,
      marginTop: 4,
      paddingHorizontal: 12,
      paddingVertical: 9,
    },
    note: {
      paddingHorizontal: 4,
    },
    nextDone: {
      backgroundColor: theme.colors.accentSoft,
    },
    nextTitle: {
      color: theme.colors.onSecondaryContainer,
      fontSize: 14,
      fontWeight: '800',
    },
    doneText: {
      color: theme.colors.primary,
    },
    nextSub: {
      color: theme.colors.onSecondaryContainer,
      fontSize: 12.5,
      fontWeight: '600',
    },
  });
}
