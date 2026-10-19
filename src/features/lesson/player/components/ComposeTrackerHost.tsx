import React, {useContext, useEffect, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {AppState, StyleSheet, View} from 'react-native';
import {SafeAreaInsetsContext} from 'react-native-safe-area-context';

import {ActionIconButton} from '@ui/components/ActionIconButton';
import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useOptionalAppNavigation} from '@core/navigation';

import {
  dismissCompose,
  hydrateComposeTracker,
  markComposeSeen,
  pollRunningComposes,
  useComposeTracker,
} from '../logic/composeTracker';

/** Wait design §3.2: with the sheet closed and the App in front, every 5 s. */
export const COMPOSE_BACKGROUND_POLL_MS = 5_000;

/**
 * Mounted once for a signed-in learner. Restores the stored compose requests,
 * polls the running ones while the App is in front (paused in the
 * background, checked at once on return), and shows a banner when one
 * finished out of sight: "Bài 6 bước đã sẵn sàng · Mở" (W5, no push).
 */
export function ComposeTrackerHost() {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const topInset = useContext(SafeAreaInsetsContext)?.top ?? 0;
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const navigation = useOptionalAppNavigation();
  const anyRunning = useComposeTracker(state =>
    state.entries.some(entry => entry.status === 'running'),
  );
  const unseen = useComposeTracker(
    state =>
      state.entries.find(
        entry =>
          entry.status !== 'running' &&
          !entry.seen &&
          entry.requestId !== state.focusedRequestId,
      ) ?? null,
  );

  useEffect(() => {
    hydrateComposeTracker().catch(() => {});
  }, []);

  useEffect(() => {
    if (!anyRunning) return undefined;
    let handle: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (handle === null) {
        handle = setInterval(() => {
          pollRunningComposes().catch(() => {});
        }, COMPOSE_BACKGROUND_POLL_MS);
      }
    };
    const stop = () => {
      if (handle !== null) clearInterval(handle);
      handle = null;
    };
    if (AppState.currentState !== 'background') start();
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') {
        pollRunningComposes().catch(() => {});
        start();
      } else if (next === 'background') {
        stop();
      }
    });
    return () => {
      stop();
      subscription.remove();
    };
  }, [anyRunning]);

  if (!unseen) return null;
  const ready = unseen.status === 'succeeded' && unseen.lessonId !== null;
  const moment = unseen.kind === 'moment';
  const heading = moment
    ? ready
      ? t('moment.card_ready')
      : t('moment.card_failed')
    : ready
      ? t('compose.ready_title')
      : t('compose.card_failed');
  return (
    <View
      accessibilityLiveRegion="polite"
      pointerEvents="box-none"
      style={[styles.wrap, {top: topInset + theme.spacing.sm}]}
      testID="compose-banner"
    >
      <View style={styles.banner}>
        <View style={styles.text}>
          <AppText variant="label">{heading}</AppText>
          {unseen.sourceTitle ? (
            <AppText color="secondary" numberOfLines={1} variant="caption">
              {unseen.sourceTitle}
            </AppText>
          ) : null}
        </View>
        {ready && navigation ? (
          <AppButton
            onPress={() => {
              markComposeSeen(unseen.requestId);
              navigation.openLesson(unseen.lessonId!);
            }}
            testID="compose-banner-open"
            title={t('compose.open')}
            variant="primary"
          />
        ) : null}
        {!ready && moment && navigation ? (
          <AppButton
            onPress={() => {
              markComposeSeen(unseen.requestId);
              navigation.startCreate({
                kind: 'situation',
                requestId: unseen.requestId,
              });
            }}
            testID="compose-banner-view"
            title={t('moment.banner_view')}
            variant="primary"
          />
        ) : null}
        <ActionIconButton
          accessibilityHint={t('compose.dismiss_hint')}
          accessibilityLabel={t('compose.dismiss')}
          icon="close"
          onPress={() =>
            ready
              ? markComposeSeen(unseen.requestId)
              : dismissCompose(unseen.requestId)
          }
          testID="compose-banner-dismiss"
        />
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    banner: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.primary,
      borderRadius: theme.radius.lg,
      borderWidth: 1,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      padding: theme.spacing.sm,
    },
    text: {
      flex: 1,
      gap: 2,
    },
    wrap: {
      left: theme.gutter,
      position: 'absolute',
      right: theme.gutter,
    },
  });
}
