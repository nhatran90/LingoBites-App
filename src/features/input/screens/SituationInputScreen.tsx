import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, TextInput, View} from 'react-native';

import {trackEvent} from '@features/analytics';
import {
  dismissCompose,
  fetchComposeQuota,
  markComposeSeen,
  resumeTrackedMoment,
  setFocusedCompose,
  trackMoment,
} from '@features/lesson/player';
import {useLearnerProfileStore} from '@features/onboarding';

import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {ErrorCard} from '@ui/components/ErrorCard';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {PrimaryActionButton} from '@ui/components/PrimaryActionButton';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {StickerButton} from '@ui/components/StickerButton';
import {StickerFooter} from '@ui/components/StickerFooter';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

import {useIsOffline} from '@core/api/connectivity';
import {createRequestId} from '@core/api/requestId';
import {useAppNavigation} from '@core/navigation';

import {MomentBuildingCard} from '../components/MomentBuildingCard';
import {MomentFailureCard} from '../components/MomentFailureCard';
import {
  confirmMoment,
  fetchActiveMoments,
  fetchSituations,
  type MomentStartBody,
  type Situation,
  submitMoment,
} from '../logic/momentClient';
import {
  momentFailureCopy,
  type MomentFailureKind,
  momentFailureMessage,
} from '../logic/momentMessages';
import {situationIcon} from '../logic/situationIcon';
import {useMomentProgress} from '../logic/useMomentProgress';
import type {CreateFlowParamList} from './navigationTypes';

type Props = NativeStackScreenProps<CreateFlowParamList, 'SituationInput'>;

type FooterAction = {
  key: string;
  label: string;
  hint: string;
  icon: HandoffIconName;
  onPress: () => void;
};

/**
 * E3 (P2–P6): pick a situation or describe one, then follow the moment on this
 * screen. A typed situation shows what the AI understood and waits for "Đúng"
 * before the lesson is built (plan A). Also restores a moment still running.
 */
export function SituationInputScreen({navigation, route}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const appNavigation = useAppNavigation();
  const offline = useIsOffline();
  const floatingClearance = useFloatingTabBarClearance();
  const profile = useLearnerProfileStore(state => state.profile);
  const kids = profile?.ageGroup === 'kids';
  const level = profile?.levelCode === 'A2' ? 'A2' : 'A1';
  const imageText = route.params?.imageText;

  const [situations, setSituations] = useState<Situation[]>([]);
  const [typed, setTyped] = useState('');
  const [picked, setPicked] = useState<Situation | null>(null);
  const [focused, setFocused] = useState(false);
  const scrollRef = useRef<ScrollView>(null);
  const inputRef = useRef<TextInput>(null);
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [requestId, setRequestId] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [quota, setQuota] = useState<{limit: number; remaining: number} | null>(
    null,
  );
  // What the wait and failure states show, and what "Thử lại" sends again.
  const [situationLabel, setSituationLabel] = useState<string | null>(null);
  const [lastBody, setLastBody] = useState<MomentStartBody | null>(null);
  const progress = useMomentProgress(requestId);
  const status = progress.status;

  // The moment on screen gets no banner of its own; a finished one counts as seen.
  useEffect(() => {
    if (!requestId) return undefined;
    setFocusedCompose(requestId);
    return () => setFocusedCompose(null);
  }, [requestId]);
  useEffect(() => {
    if (
      requestId &&
      (status?.status === 'succeeded' || status?.status === 'failed')
    ) {
      markComposeSeen(requestId);
    }
  }, [requestId, status?.status]);
  useEffect(() => {
    if (status?.situation_vi) setSituationLabel(status.situation_vi);
  }, [status?.situation_vi]);
  // The server no longer knows this moment (another account): back to the form.
  useEffect(() => {
    if (progress.error?.kind === 'not-found') setRequestId(null);
  }, [progress.error]);

  // E4: a describe moment started on the review screen is followed here.
  useEffect(() => {
    if (route.params?.requestId) setRequestId(route.params.requestId);
  }, [route.params?.requestId]);

  const refreshQuota = useCallback(() => {
    fetchComposeQuota().then(result => {
      if (result.ok) {
        setQuota({
          limit: result.value.limit,
          remaining: result.value.remaining,
        });
      }
    });
  }, []);

  useEffect(() => {
    if (kids) return;
    fetchSituations(level).then(result => {
      if (result.ok) setSituations(result.value);
    });
    refreshQuota();
    fetchActiveMoments().then(result => {
      if (result.ok && result.value[0]) {
        setRequestId(result.value[0].id);
        setSituationLabel(result.value[0].situation_vi);
      }
    });
  }, [kids, level, refreshQuota]);

  // The count changes once a moment ends (a credit is used only on success).
  const finished =
    status?.status === 'succeeded' || status?.status === 'failed';
  useEffect(() => {
    if (!kids && finished) refreshQuota();
  }, [kids, finished, refreshQuota]);

  const outOfQuota = quota !== null && quota.remaining === 0;
  const showInput = !kids && !status?.status && !requestId;
  // A tapped suggestion fills the box; it is sent as that situation only
  // while the text is still exactly its title, otherwise as typed text.
  const pickedNow = picked !== null && typed.trim() === picked.title_vi;
  const canSend =
    !offline && !outOfQuota && (pickedNow || typed.trim().length >= 3);

  function pick(situation: Situation) {
    setPicked(situation);
    setTyped(situation.title_vi);
    scrollRef.current?.scrollTo({y: 0, animated: true});
  }

  function send() {
    if (!canSend) return;
    if (pickedNow && picked) {
      start({situation_id: picked.id}, picked.title_vi);
      return;
    }
    start({situation_note: typed.trim()}, typed.trim());
  }

  async function start(
    body: {situation_id?: string; situation_note?: string},
    label: string,
  ) {
    if (offline) return;
    setSubmitError(null);
    const full: MomentStartBody = {
      intent: 'use',
      level,
      ...body,
      ...(imageText ? {image_text: imageText} : {}),
    };
    const result = await submitMoment(full, createRequestId());
    if (!result.ok) {
      trackEvent('moment_rejected', {
        code: result.errorCode ?? 'unknown',
        stage: 'submit',
      });
      setSubmitError(momentFailureMessage(result.errorCode, t, quota?.limit));
      if (result.errorCode === 'COMPOSE_LIMIT_REACHED') refreshQuota();
      return;
    }
    setLastBody(full);
    setSituationLabel(label);
    setRequestId(result.value.moment_request_id);
    trackMoment({
      requestId: result.value.moment_request_id,
      situationVi: label,
    });
  }

  /** "Thử lại tình huống này": the same situation, as a new request. */
  async function retrySame() {
    if (!lastBody || offline) return;
    const previous = requestId;
    setSubmitError(null);
    const result = await submitMoment(lastBody, createRequestId());
    if (!result.ok) {
      trackEvent('moment_rejected', {
        code: result.errorCode ?? 'unknown',
        stage: 'retry',
      });
      setSubmitError(momentFailureMessage(result.errorCode, t, quota?.limit));
      if (result.errorCode === 'COMPOSE_LIMIT_REACHED') refreshQuota();
      return;
    }
    if (previous) dismissCompose(previous);
    setRequestId(result.value.moment_request_id);
    trackMoment({
      requestId: result.value.moment_request_id,
      situationVi: situationLabel,
    });
  }

  /** Back to the form; `keepText` keeps what the learner typed to edit it. */
  function backToForm(keepText: boolean) {
    if (requestId) dismissCompose(requestId);
    setRequestId(null);
    setSubmitError(null);
    if (keepText) {
      if (!typed.trim() && situationLabel) setTyped(situationLabel);
      setTimeout(() => inputRef.current?.focus(), 50);
    } else {
      setTyped('');
      setPicked(null);
    }
  }

  async function answer(accept: boolean) {
    if (!requestId) return;
    const result = await confirmMoment(requestId, accept);
    if (!result.ok) {
      setSubmitError(momentFailureMessage(result.errorCode, t, quota?.limit));
      return;
    }
    if (!accept) {
      dismissCompose(requestId);
      setRequestId(null);
      return;
    }
    resumeTrackedMoment(requestId);
    progress.resume();
  }

  const failedStatus = !kids && status?.status === 'failed';
  const fatalPoll =
    !kids && !!progress.error && progress.error.kind !== 'not-found';
  const failureCode = failedStatus
    ? status?.error?.code
    : fatalPoll
      ? progress.error?.errorCode
      : undefined;
  const failure =
    failedStatus || fatalPoll
      ? momentFailureCopy(failureCode, t, quota?.limit)
      : null;
  const building =
    !kids &&
    requestId !== null &&
    failure === null &&
    status?.status !== 'succeeded' &&
    status?.status !== 'awaiting_confirmation';

  function failureActions(kind: MomentFailureKind): FooterAction[] {
    const home: FooterAction = {
      key: 'home',
      label: t('moment.go_home'),
      hint: t('moment.go_home_hint'),
      icon: 'home',
      onPress: () => appNavigation.goToTab('Home'),
    };
    const pickOther: FooterAction = {
      key: 'pick-other',
      label: t('moment.pick_other'),
      hint: t('moment.pick_other_hint'),
      icon: 'edit',
      onPress: () => backToForm(false),
    };
    switch (kind) {
      case 'system':
        return lastBody
          ? [
              {
                key: 'retry',
                label: t('moment.retry_same'),
                hint: t('moment.retry_same_hint'),
                icon: 'refresh',
                onPress: retrySame,
              },
              pickOther,
            ]
          : [pickOther, home];
      case 'not_suitable':
        return [
          {
            key: 'edit',
            label: t('moment.edit_and_resend'),
            hint: t('moment.edit_and_resend_hint'),
            icon: 'edit',
            onPress: () => backToForm(true),
          },
        ];
      case 'paused':
        return [
          {
            key: 'library',
            label: t('moment.see_moments'),
            hint: t('moment.see_moments_hint'),
            icon: 'auto_stories',
            onPress: () => appNavigation.openLibrarySection('moments'),
          },
          home,
        ];
      case 'limit':
        return [home];
      case 'cancelled':
        return [
          {
            key: 'new',
            label: t('moment.start_new'),
            hint: t('moment.start_new_hint'),
            icon: 'add',
            onPress: () => backToForm(true),
          },
        ];
      default:
        return [pickOther];
    }
  }

  const footerActions: FooterAction[] = failure
    ? failureActions(failure.kind)
    : building
      ? progress.waitingNetwork
        ? [
            {
              key: 'check',
              label: t('moment.check_again'),
              hint: t('moment.check_again_hint'),
              icon: 'refresh',
              onPress: progress.checkNow,
            },
            {
              key: 'home',
              label: t('moment.go_home'),
              hint: t('moment.go_home_hint'),
              icon: 'home',
              onPress: () => appNavigation.goToTab('Home'),
            },
          ]
        : [
            {
              key: 'leave',
              label: t('moment.wait_leave'),
              hint: t('moment.wait_leave_hint'),
              icon: 'home',
              onPress: () => appNavigation.goToTab('Home'),
            },
          ]
      : [];
  // While waiting, leaving is the only action, so it is the lighter button.
  const firstTone = building && !progress.waitingNetwork ? 'ghost' : 'coral';

  const titleKey = 'moment.title';
  return (
    <AppScreen>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        rightAction={
          showInput && quota !== null ? (
            <View
              style={[
                themedStyles.quota,
                outOfQuota ? themedStyles.quotaOut : null,
              ]}
              testID="moment-quota"
            >
              <MaterialIcon
                color={outOfQuota ? HERO_PALETTE.coralShelf : theme.colors.ink}
                name="bolt"
                size={15}
              />
              <AppText
                style={[
                  themedStyles.quotaText,
                  outOfQuota ? themedStyles.quotaTextOut : null,
                ]}
              >
                {outOfQuota
                  ? t('moment.quota_chip_none')
                  : t('moment.quota_chip', {
                      count: quota.remaining,
                      limit: quota.limit,
                    })}
              </AppText>
            </View>
          ) : undefined
        }
        title={t(titleKey)}
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom:
              showInput || footerActions.length > 0
                ? theme.spacing.lg
                : floatingClearance,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        ref={scrollRef}
      >
        {kids ? (
          <AppText color="secondary">{t('moment.kids_blocked')}</AppText>
        ) : null}

        {!kids && status?.status === 'awaiting_confirmation' ? (
          <View style={styles.card} testID="moment-confirm">
            <AppText variant="label">{t('moment.understood_title')}</AppText>
            <AppText variant="h3">{status.situation_vi ?? ''}</AppText>
            <PrimaryActionButton
              accessibilityHint={t('moment.confirm_yes_hint')}
              accessibilityLabel={t('moment.confirm_yes')}
              label={t('moment.confirm_yes')}
              onPress={() => answer(true)}
            />
            <Pressable
              accessibilityHint={t('moment.confirm_edit_hint')}
              accessibilityLabel={t('moment.confirm_edit')}
              accessibilityRole="button"
              onPress={() => answer(false)}
              style={styles.linkRow}
            >
              <AppText style={{color: theme.colors.primary, fontWeight: '600'}}>
                {t('moment.confirm_edit')}
              </AppText>
            </Pressable>
          </View>
        ) : null}

        {building ? (
          <MomentBuildingCard
            situation={situationLabel}
            stage={status?.compose?.stage}
            waitingNetwork={progress.waitingNetwork}
          />
        ) : null}

        {!kids && status?.status === 'succeeded' && status.lesson_id ? (
          <PrimaryActionButton
            accessibilityHint={t('moment.open_lesson_hint')}
            accessibilityLabel={t('moment.open_lesson')}
            label={t('moment.open_lesson')}
            onPress={() => appNavigation.finishCreate(status.lesson_id!)}
          />
        ) : null}

        {failure ? (
          <MomentFailureCard
            kind={failure.kind}
            message={failure.message}
            reason={status?.compose?.reason_vi}
            reference={
              failureCode && requestId
                ? t('moment.fail_code', {
                    code: failureCode,
                    ref: requestId.slice(0, 4),
                  })
                : null
            }
            situation={situationLabel}
            suggestion={status?.compose?.suggestion_vi}
            title={failure.title}
          />
        ) : null}

        {showInput ? (
          <>
            {outOfQuota ? (
              <View style={themedStyles.limit} testID="moment-limit">
                <MaterialIcon
                  color={HERO_PALETTE.coralShelf}
                  name="schedule"
                  size={19}
                />
                <AppText style={themedStyles.limitText} variant="label">
                  {t('moment.limit_reached', {limit: quota.limit})}
                </AppText>
              </View>
            ) : null}

            <View
              style={[themedStyles.own, outOfQuota ? styles.dimmed : null]}
              testID="moment-own"
            >
              <View style={styles.ownTop}>
                <View style={themedStyles.ownIcon}>
                  <MaterialIcon
                    color={theme.colors.ink}
                    name="edit"
                    size={19}
                  />
                </View>
                <View style={styles.grow}>
                  <AppText variant="h3">{t('moment.own_title')}</AppText>
                  <AppText style={themedStyles.ownSub} variant="caption">
                    {t('moment.own_subtitle')}
                  </AppText>
                </View>
              </View>
              <View
                style={[
                  themedStyles.field,
                  focused ? themedStyles.fieldFocused : null,
                ]}
              >
                <TextInput
                  accessibilityHint={t('moment.send_hint')}
                  accessibilityLabel={t('moment.own_title')}
                  editable={!outOfQuota}
                  multiline
                  onBlur={() => setFocused(false)}
                  onChangeText={setTyped}
                  onFocus={() => setFocused(true)}
                  placeholder={t('moment.typed_placeholder')}
                  placeholderTextColor={theme.colors.text.muted}
                  ref={inputRef}
                  style={themedStyles.input}
                  testID="moment-typed"
                  value={typed}
                />
                <View style={styles.fieldBar}>
                  <AppText color="muted" style={styles.grow} variant="caption">
                    {pickedNow ? t('moment.own_picked') : t('moment.own_hint')}
                  </AppText>
                  {typed.length > 0 ? (
                    <Pressable
                      accessibilityHint={t('moment.own_clear_a11y')}
                      accessibilityLabel={t('moment.own_clear')}
                      accessibilityRole="button"
                      hitSlop={CLEAR_HIT_SLOP}
                      onPress={() => {
                        setTyped('');
                        inputRef.current?.focus();
                      }}
                      style={styles.clear}
                      testID="moment-typed-clear"
                    >
                      <MaterialIcon
                        color={theme.colors.text.muted}
                        name="close"
                        size={15}
                      />
                      <AppText color="muted" variant="caption">
                        {t('moment.own_clear')}
                      </AppText>
                    </Pressable>
                  ) : null}
                </View>
              </View>
            </View>

            <AppText style={styles.sectionTitle} variant="h3">
              {t('moment.suggestions_title')}
            </AppText>
            {situations.length === 0 ? (
              <AppText color="secondary">
                {t('moment.situations_empty')}
              </AppText>
            ) : (
              <View
                style={[themedStyles.list, outOfQuota ? styles.dimmed : null]}
              >
                {situations.map((situation, index) => {
                  const selected = pickedNow && picked?.id === situation.id;
                  return (
                    <Pressable
                      key={situation.id}
                      accessibilityHint={t('moment.situation_pick_hint')}
                      accessibilityLabel={situation.title_vi}
                      accessibilityRole="button"
                      accessibilityState={{
                        disabled: outOfQuota,
                        selected,
                      }}
                      disabled={outOfQuota}
                      onPress={() => pick(situation)}
                      style={({pressed}) => [
                        styles.row,
                        index > 0 ? themedStyles.rowDivider : null,
                        selected ? themedStyles.rowSelected : null,
                        pressed && !selected ? themedStyles.rowPressed : null,
                      ]}
                      testID={`situation-${situation.code}`}
                    >
                      <View
                        style={[
                          themedStyles.rowIcon,
                          selected ? themedStyles.rowIconSelected : null,
                        ]}
                      >
                        <MaterialIcon
                          color={theme.colors.primary}
                          name={situationIcon(situation)}
                          size={17}
                        />
                      </View>
                      <AppText
                        style={[
                          themedStyles.rowText,
                          selected ? themedStyles.rowTextSelected : null,
                        ]}
                      >
                        {situation.title_vi}
                      </AppText>
                      <MaterialIcon
                        color={
                          selected
                            ? theme.colors.primary
                            : theme.colors.outlineVariant
                        }
                        name={selected ? 'check_circle' : 'chevron_right'}
                        size={selected ? 20 : 18}
                      />
                    </Pressable>
                  );
                })}
              </View>
            )}
          </>
        ) : null}

        {submitError ? <ErrorCard message={submitError} /> : null}
        {offline ? (
          <AppText color="secondary">{t('moment.offline')}</AppText>
        ) : null}
      </ScrollView>
      {!showInput && footerActions.length > 0 ? (
        <StickerFooter>
          {footerActions.map((action, index) => (
            <StickerButton
              key={action.key}
              accessibilityHint={action.hint}
              icon={action.icon}
              label={action.label}
              onPress={action.onPress}
              testID={`moment-action-${action.key}`}
              tone={index === 0 ? firstTone : 'ghost'}
            />
          ))}
        </StickerFooter>
      ) : null}
      {showInput ? (
        <StickerFooter>
          <StickerButton
            accessibilityHint={t('moment.send_hint')}
            disabled={!canSend}
            icon="auto_stories"
            label={t('moment.send')}
            onPress={send}
            testID="moment-send"
          />
        </StickerFooter>
      ) : null}
    </AppScreen>
  );
}

/** Lifts the small "Xóa" link to the 44px minimum touch target. */
const CLEAR_HIT_SLOP = {top: 10, bottom: 10, left: 8, right: 8};

const styles = StyleSheet.create({
  content: {gap: 14, padding: 16},
  card: {gap: 12, padding: 16, borderRadius: 18, borderWidth: 2},
  linkRow: {alignItems: 'center', minHeight: 44, justifyContent: 'center'},
  grow: {flex: 1},
  dimmed: {opacity: 0.5},
  ownTop: {alignItems: 'center', flexDirection: 'row', gap: 10},
  fieldBar: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 30,
  },
  clear: {alignItems: 'center', flexDirection: 'row', gap: 4},
  sectionTitle: {marginTop: 6, paddingHorizontal: 4},
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
});

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    quota: {
      alignItems: 'center',
      backgroundColor: HERO_PALETTE.sun,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: 5,
      paddingHorizontal: 11,
      paddingVertical: 7,
      ...getStickerEdge(2, HERO_PALETTE.sunShelf),
    },
    quotaOut: {
      backgroundColor: theme.colors.secondarySoft,
      ...getStickerEdge(2, HERO_PALETTE.coralRing),
    },
    quotaText: {
      color: theme.colors.ink,
      fontSize: 12.5,
      fontWeight: '800',
    },
    quotaTextOut: {
      color: theme.colors.onSecondaryContainer,
    },
    limit: {
      alignItems: 'flex-start',
      backgroundColor: theme.colors.secondarySoft,
      borderRadius: 18,
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    limitText: {
      color: theme.colors.onSecondaryContainer,
      flex: 1,
    },
    own: {
      backgroundColor: theme.colors.tertiarySoft,
      borderRadius: theme.radius.lg,
      gap: 12,
      padding: 14,
      ...getStickerEdge(5, theme.colors.tertiaryBorder),
    },
    ownIcon: {
      alignItems: 'center',
      backgroundColor: HERO_PALETTE.sun,
      borderRadius: 13,
      height: 38,
      justifyContent: 'center',
      width: 38,
      ...getStickerEdge(3, HERO_PALETTE.sunShelf),
    },
    ownSub: {
      color: theme.colors.onTertiaryContainer,
    },
    field: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.surface,
      borderRadius: 18,
      borderWidth: 2,
      paddingBottom: 4,
      paddingHorizontal: 12,
      paddingTop: 10,
    },
    fieldFocused: {
      borderColor: HERO_PALETTE.sunShelf,
    },
    input: {
      color: theme.colors.text.primary,
      fontFamily: theme.typography.fontFamily.primary,
      fontSize: 16,
      fontWeight: '600',
      lineHeight: 23,
      minHeight: 112,
      padding: 0,
      textAlignVertical: 'top',
    },
    list: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.lg,
      overflow: 'hidden',
      ...getStickerEdge(4, theme.colors.surfaceHigh),
    },
    rowDivider: {
      borderTopColor: theme.colors.surfaceMuted,
      borderTopWidth: 1.5,
    },
    rowPressed: {
      backgroundColor: theme.colors.surfaceMuted,
    },
    rowSelected: {
      backgroundColor: theme.colors.accentSoft,
    },
    rowIcon: {
      alignItems: 'center',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: 11,
      height: 34,
      justifyContent: 'center',
      width: 34,
    },
    rowIconSelected: {
      backgroundColor: theme.colors.surface,
    },
    rowText: {
      flex: 1,
      fontSize: 15,
      fontWeight: '600',
    },
    rowTextSelected: {
      color: theme.colors.accentInk,
    },
  });
}
