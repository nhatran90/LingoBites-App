import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {ActionIconButton} from '@ui/components/ActionIconButton';
import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useOptionalAppNavigation} from '@core/navigation';

import {
  type ComposeEntry,
  dismissCompose,
  markComposeSeen,
  requestComposeSheet,
  useComposeTracker,
} from '../logic/composeTracker';

/**
 * Wait design §3.2: "Đang tạo bài" cards at the top of the learner's own
 * lessons and of Today. A running request shows its stage; tapping it opens
 * the source lesson with the progress sheet. A failure nobody has seen stays
 * until it is dismissed.
 */
export function ComposeRequestCards({testID = 'compose-cards'}) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const navigation = useOptionalAppNavigation();
  const all = useComposeTracker(state => state.entries);
  const entries = useMemo(
    () =>
      all.filter(
        entry =>
          entry.status === 'running' ||
          entry.status === 'awaiting' ||
          (entry.status === 'failed' && !entry.seen) ||
          (entry.kind === 'moment' &&
            entry.status === 'succeeded' &&
            !entry.seen),
      ),
    [all],
  );
  if (entries.length === 0) return null;

  const open = (entry: ComposeEntry) => {
    if (!navigation) return;
    if (entry.kind === 'moment') {
      // A moment opens its lesson when ready, otherwise the screen that follows it
      // (waiting, confirming, or why it failed).
      if (entry.status === 'succeeded' && entry.lessonId) {
        markComposeSeen(entry.requestId);
        navigation.openLesson(entry.lessonId);
      } else {
        navigation.startCreate({kind: 'situation', requestId: entry.requestId});
      }
      return;
    }
    requestComposeSheet(entry.sourceLessonId);
    navigation.openLesson(entry.sourceLessonId);
  };

  return (
    <View style={styles.list} testID={testID}>
      {entries.map(entry => {
        const running = entry.status === 'running';
        const isMoment = entry.kind === 'moment';
        const stage = entry.waitingNetwork
          ? t('compose.waiting_network')
          : t(`compose.stage_${entry.progress?.stage ?? 'queued'}`, {
              defaultValue: t('compose.stage_queued'),
            });
        const heading = isMoment
          ? t(
              entry.status === 'awaiting'
                ? 'moment.card_awaiting'
                : entry.status === 'succeeded'
                  ? 'moment.card_ready'
                  : entry.status === 'failed'
                    ? 'moment.card_failed'
                    : 'moment.card_running',
            )
          : running
            ? t('compose.card_running')
            : t('compose.card_failed');
        const detail = isMoment
          ? (entry.sourceTitle ?? t('moment.card_default_title'))
          : t('compose.card_detail', {
              title: entry.sourceTitle ?? '',
              count: entry.sentenceIds.length,
              stage: running ? stage : t('compose.repick'),
            });
        return (
          <View key={entry.requestId} style={styles.card}>
            <Pressable
              accessibilityHint={t('compose.card_open_hint')}
              accessibilityRole="button"
              onPress={() => open(entry)}
              style={styles.main}
              testID={`compose-card-${entry.requestId}`}
            >
              <MaterialIcon
                color={running ? theme.colors.primary : theme.colors.danger}
                name={running ? 'auto_awesome' : 'warning'}
                size={22}
              />
              <View style={styles.text}>
                <AppText variant="label">{heading}</AppText>
                <AppText color="secondary" numberOfLines={2} variant="caption">
                  {isMoment && running ? `${detail} · ${stage}` : detail}
                </AppText>
              </View>
            </Pressable>
            {running ? null : (
              <ActionIconButton
                accessibilityHint={t('compose.dismiss_hint')}
                accessibilityLabel={t('compose.dismiss')}
                icon="close"
                onPress={() => dismissCompose(entry.requestId)}
                testID={`compose-card-dismiss-${entry.requestId}`}
              />
            )}
          </View>
        );
      })}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.outlineVariant,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      padding: theme.spacing.sm,
    },
    list: {
      gap: theme.spacing.sm,
    },
    main: {
      alignItems: 'center',
      flex: 1,
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    text: {
      flex: 1,
      gap: 2,
    },
  });
}
