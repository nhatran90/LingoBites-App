import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {withAlpha} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ProgressRing} from '@ui/components/ProgressRing';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {solidOver} from '@ui/theme/colorUtils';
import {getStickerEdge} from '@ui/theme/hardShadow';

export type ItemReviewResult = {
  code: string;
  text: string;
  meaning: string;
  result: 'correct' | 'incorrect';
};

type Props = {
  results: ItemReviewResult[];
  /** XP the round earned; null for a practice round or when nothing was saved. */
  xpEarned: number | null;
  /** A round of the forgotten items again, not sent to the schedule. */
  practice: boolean;
};

/**
 * The end of an item review: how much was remembered (the same ring and
 * stat tiles as the daily review's summary), then each item with its result.
 */
export function ItemReviewSummary({results, xpEarned, practice}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const remembered = results.filter(entry => entry.result === 'correct').length;
  const forgot = results.length - remembered;
  const accuracy = results.length > 0 ? remembered / results.length : 0;
  const percent = Math.round(accuracy * 100);
  const headline =
    percent >= 80
      ? t('review.summary_great')
      : percent >= 50
        ? t('review.summary_good')
        : t('review.summary_keep');

  return (
    <View style={styles.container} testID="item-review-done">
      <View style={styles.hero}>
        <ProgressRing
          accessibilityLabel={t('review.summary_accuracy_a11y', {percent})}
          caption={t('review.summary_accuracy')}
          progress={accuracy}
          size={128}
          strokeWidth={12}
          testID="item-review-accuracy"
          value={`${percent}%`}
        />
        <AppText style={styles.center} variant="h2">
          {headline}
        </AppText>
        <AppText color="secondary" style={styles.center}>
          {practice
            ? t('itemReview.practice_subtitle', {count: results.length})
            : t('itemReview.summary_subtitle', {count: results.length})}
        </AppText>
        {xpEarned != null && xpEarned > 0 ? (
          <View style={styles.xpPill}>
            <MaterialIcon color={theme.colors.primary} name="bolt" size={16} />
            <AppText style={styles.xpText} testID="item-review-xp">
              {t('review.summary_xp', {xp: xpEarned})}
            </AppText>
          </View>
        ) : null}
      </View>

      <View style={styles.stats}>
        <Stat
          color={theme.colors.text.primary}
          label={t('review.summary_reviewed_label')}
          valueTestID="item-review-reviewed-count"
          value={results.length}
        />
        <Stat
          color={theme.colors.primary}
          label={t('review.summary_remembered_label')}
          valueTestID="item-review-remembered-count"
          value={remembered}
        />
        <Stat
          color={theme.colors.danger}
          label={t('review.summary_forgot_label')}
          valueTestID="item-review-forgot-count"
          value={forgot}
        />
      </View>

      {results.length > 0 ? (
        <View style={styles.listBlock}>
          <AppText style={styles.listTitle}>
            {t('itemReview.reviewed_list').toUpperCase()}
          </AppText>
          <View style={styles.list}>
            {results.map((entry, position) => (
              <View
                accessible
                accessibilityLabel={`${entry.text}, ${entry.meaning}: ${
                  entry.result === 'correct'
                    ? t('itemReview.remembered')
                    : t('itemReview.forgot')
                }`}
                key={`${entry.code}-${position}`}
                style={[styles.row, position > 0 ? styles.rowDivider : null]}
                testID={`item-review-result-${entry.code}`}
              >
                <View style={styles.rowText}>
                  <AppText numberOfLines={1} style={styles.rowWord}>
                    {entry.text}
                  </AppText>
                  <AppText
                    color="secondary"
                    numberOfLines={1}
                    variant="caption"
                  >
                    {entry.meaning}
                  </AppText>
                </View>
                <ResultChip correct={entry.result === 'correct'} />
              </View>
            ))}
          </View>
        </View>
      ) : null}
    </View>
  );
}

function Stat({
  label,
  value,
  color,
  valueTestID,
}: {
  label: string;
  value: number;
  color: string;
  valueTestID: string;
}) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      style={styles.stat}
    >
      <AppText style={[styles.statValue, {color}]} testID={valueTestID}>
        {value}
      </AppText>
      <AppText color="secondary" style={styles.center} variant="label">
        {label}
      </AppText>
    </View>
  );
}

function ResultChip({correct}: {correct: boolean}) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const color = correct ? theme.colors.primary : theme.colors.danger;
  return (
    <View
      style={[
        styles.chip,
        {
          backgroundColor: correct
            ? theme.colors.accentSoft
            : solidOver(
                withAlpha(theme.colors.danger, 0.12),
                theme.colors.surface,
              ),
        },
      ]}
    >
      <MaterialIcon
        color={color}
        name={correct ? 'check' : 'refresh'}
        size={14}
      />
      <AppText style={[styles.chipText, {color}]}>
        {correct ? t('itemReview.remembered') : t('itemReview.forgot')}
      </AppText>
    </View>
  );
}

/** A white sticker block: thin warm border, a step-darker raised edge. */
function sticker(theme: AppTheme, edge: number) {
  const line = theme.colors.surfaceHigh;
  const shelf = solidOver(withAlpha(theme.colors.ink, 0.12), line);
  return {
    backgroundColor: theme.colors.surface,
    borderWidth: 1.5,
    borderColor: line,
    ...getStickerEdge(edge, shelf),
    borderTopColor: line,
    borderLeftColor: line,
    borderRightColor: line,
  } as const;
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.md,
    },
    hero: {
      ...sticker(theme, 6),
      alignItems: 'center',
      borderRadius: 28,
      gap: 6,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.lg,
    },
    center: {
      textAlign: 'center',
    },
    xpPill: {
      alignItems: 'center',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: 4,
      marginTop: 4,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    xpText: {
      color: theme.colors.primary,
      fontSize: 13,
      fontWeight: '700',
    },
    stats: {
      flexDirection: 'row',
      gap: 8,
    },
    stat: {
      ...sticker(theme, 4),
      alignItems: 'center',
      borderRadius: 20,
      flex: 1,
      paddingHorizontal: 6,
      paddingVertical: 10,
    },
    statValue: {
      fontSize: 24,
      fontVariant: ['tabular-nums'],
      fontWeight: '800',
      lineHeight: 30,
    },
    listBlock: {
      gap: 8,
    },
    listTitle: {
      color: theme.colors.text.muted,
      fontSize: 12,
      fontWeight: '800',
      letterSpacing: 1,
      paddingHorizontal: 4,
    },
    list: {
      ...sticker(theme, 4),
      borderRadius: 20,
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 11,
    },
    rowDivider: {
      borderTopColor: theme.colors.surfaceMuted,
      borderTopWidth: 1,
    },
    rowText: {
      flex: 1,
      minWidth: 0,
    },
    rowWord: {
      fontSize: 15,
      fontWeight: '700',
    },
    chip: {
      alignItems: 'center',
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: 3,
      paddingHorizontal: 10,
      paddingVertical: 3,
    },
    chipText: {
      fontSize: 12,
      fontWeight: '700',
    },
  });
}
