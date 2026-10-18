import React from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import type {PracticeSegmentView} from '@features/lesson/flow';
import {formatCueTimestamp} from '@features/lesson/player';

import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {useAppTheme} from '@ui/theme';

export type PracticeSegmentListProps = {
  segments: readonly PracticeSegmentView[];
  /** The segment just practised, marked as current. */
  currentIndex: number | null;
  onPick: (index: number) => void;
};

/**
 * Plan "practice segments": every segment of a long lesson with its first
 * sentence (and video span, K7), whether it was practised, and whether it
 * has enough to practise (K5). Picking one starts its run.
 */
export function PracticeSegmentList({
  segments,
  currentIndex,
  onPick,
}: PracticeSegmentListProps) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();

  return (
    <View style={{gap: theme.spacing.sm}} testID="practice-segment-list">
      {segments.map(segment => {
        const name = t('practice.segment_name', {number: segment.index + 1});
        const span =
          segment.startMs !== null && segment.endMs !== null
            ? `${formatCueTimestamp(segment.startMs)} – ${formatCueTimestamp(
                segment.endMs,
              )}`
            : null;
        const status = !segment.available
          ? t('practice.segment_thin')
          : segment.index === currentIndex
            ? t('practice.segment_current')
            : segment.practicedAt !== null
              ? t('practice.segment_done')
              : null;
        return (
          <Pressable
            accessibilityHint={
              segment.available ? t('practice.segment_pick_hint') : undefined
            }
            accessibilityLabel={[name, span, status].filter(Boolean).join(', ')}
            accessibilityRole="button"
            accessibilityState={{disabled: !segment.available}}
            disabled={!segment.available}
            key={segment.index}
            onPress={() => onPick(segment.index)}
            style={!segment.available ? styles.thin : undefined}
            testID={`practice-segment-${segment.index}`}
          >
            <AppCard>
              <View style={styles.header}>
                <AppText variant="label">
                  {span ? `${name} · ${span}` : name}
                </AppText>
                {status ? (
                  <AppText color="secondary" variant="caption">
                    {segment.practicedAt !== null && segment.available
                      ? `✓ ${status}`
                      : status}
                  </AppText>
                ) : null}
              </View>
              <AppText color="secondary" numberOfLines={2}>
                {segment.firstSentenceEn}
              </AppText>
            </AppCard>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  thin: {
    opacity: 0.5,
  },
});
