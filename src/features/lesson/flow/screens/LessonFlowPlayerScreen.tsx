import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import {SpeakContext, SpeechNotice, useSpeak} from '@features/audio';
import {getGamificationSnapshot} from '@features/engagement';

import {AppButton} from '@ui/components/AppButton';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {
  HEADER_BUTTON_RADIUS,
  HEADER_BUTTON_SIZE,
  HeaderIconButton,
} from '@ui/components/HeaderIconButton';
import {withAlpha} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {solidOver} from '@ui/theme/colorUtils';
import {getStickerEdge, getStickerFace} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

import {useAppNavigation} from '@core/navigation';
import type {LessonBlock} from '@core/schemas/lesson';
import type {
  LessonAttemptOutcome,
  LessonSupportLevel,
} from '@core/schemas/sync';

import {StudyLabel} from '../../player/components/StudyControls';
import {isLessonNotDownloaded} from '../../player/logic/lessonNotDownloaded';
import {useCanonicalLesson} from '../../player/logic/useCanonicalLesson';
import type {LessonFlowParamList} from '../../player/screens/navigationTypes';
import {
  FlowFooterBar,
  FlowFooterProvider,
  useFlowFooterHost,
} from '../components/FlowFooter';
import {FlowProgressBar} from '../components/FlowProgressBar';
import {LessonMap} from '../components/LessonMap';
import {StepResult} from '../components/StepResult';
import {hasRelatedReview, StepReview} from '../components/StepReview';
import {StepView} from '../components/StepView';
import {flowActivity, flowItems} from '../logic/flowContent';
import {useNoSpeaking} from '../logic/noSpeaking';
import {
  blocksOfStep,
  type FlowStep,
  isFlowLesson,
} from '../logic/practiceCompletion';
import {useLessonFlow} from '../logic/useLessonFlow';

type Props = NativeStackScreenProps<LessonFlowParamList, 'LessonFlowPlayer'>;

const STEP_LABEL_KEYS: Record<FlowStep, string> = {
  1: 'lessonFlow.step_1',
  2: 'lessonFlow.step_2',
  3: 'lessonFlow.step_3',
  4: 'lessonFlow.step_4',
  5: 'lessonFlow.step_5',
  6: 'lessonFlow.step_6',
};

/**
 * PR 10: a curriculum lesson run step by step, 1 → 6 (decision G1). Opens
 * where the learner left off; every finished activity block is stored as one
 * attempt and synced. Works on the downloaded snapshot, offline included.
 *
 * IGNORE_TAB_BAR_CLEARANCE: a root-stack screen, drawn above the tab bar.
 */
export function LessonFlowPlayerScreen({navigation, route}: Props) {
  const {lessonId} = route.params;
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const scrollRef = useRef<ScrollView>(null);
  const {state, open} = useCanonicalLesson(lessonId);
  const appNavigation = useAppNavigation();
  const snapshot = state.status === 'ready' ? state.snapshot : null;
  const runnable = snapshot !== null && isFlowLesson(snapshot);
  const flow = useLessonFlow(lessonId, runnable ? snapshot : null);
  const noSpeaking = useNoSpeaking();
  const items = useMemo(
    () => (snapshot ? flowItems(snapshot) : new Map()),
    [snapshot],
  );

  useEffect(() => {
    open();
  }, [open]);

  /** Step 1 with nothing to review is skipped (redesign: no empty screen). */
  const reviewSkipped = useMemo(
    () => (snapshot && runnable ? !hasRelatedReview(snapshot) : false),
    [snapshot, runnable],
  );
  const skippedSteps = useMemo(
    () => new Set<number>(reviewSkipped ? [1] : []),
    [reviewSkipped],
  );

  // A curriculum lesson knows its unit: step 6 offers the next lesson.
  const unit = snapshot?.unit ?? null;
  const unitTarget = useMemo(
    () =>
      unit ? {unitId: unit.unit_id, title: unit.unit_title, lessonId} : null,
    [unit, lessonId],
  );

  const goTo = flow.goTo;
  /** Redesign: the lesson map, shown once before anything was done. */
  const [showMap, setShowMap] = useState(false);
  const [streakDays] = useState(readStreakDays);
  const footer = useFlowFooterHost();
  const openStep = useCallback(
    (step: FlowStep) => {
      setShowMap(false);
      goTo(step);
      scrollRef.current?.scrollTo({y: 0, animated: false});
    },
    [goTo],
  );

  // A new lesson opens on its map; step 1 with nothing to review is skipped.
  const firstStepChecked = useRef(false);
  useEffect(() => {
    if (firstStepChecked.current || flow.step === null) return;
    firstStepChecked.current = true;
    if (flow.attempts.length === 0) setShowMap(true);
    if (flow.step === 1 && reviewSkipped) goTo(2);
  }, [flow.step, flow.attempts.length, reviewSkipped, goTo]);

  const {speak: handleSpeak, notice: speechNotice} = useSpeak();

  const finishActivity = flow.finishActivity;
  const handleFinished = useCallback(
    (
      block: LessonBlock,
      outcome: LessonAttemptOutcome,
      supportLevel: LessonSupportLevel,
      durationMs: number,
      graded?: {attemptId: string; recordingClientId?: string},
    ) => finishActivity({block, outcome, supportLevel, durationMs, graded}),
    [finishActivity],
  );

  /** Steps 2–5 whose activities all have an attempt. */
  const doneSteps = useMemo(() => {
    const done = new Set<number>();
    if (!snapshot) return done;
    const attempted = new Set(flow.attempts.map(attempt => attempt.blockId));
    for (const step of [2, 3, 4, 5]) {
      const activities = snapshot.blocks.filter(
        block => block.step === step && flowActivity(block) !== null,
      );
      if (
        activities.length > 0 &&
        activities.every(block => attempted.has(block.id))
      ) {
        done.add(step);
      }
    }
    return done;
  }, [snapshot, flow.attempts]);

  const renderBody = () => {
    if (state.status === 'idle' || state.status === 'loading') {
      return (
        <View style={themedStyles.centered}>
          <ActivityIndicator
            color={theme.colors.primary}
            size="large"
            testID="lesson-flow-loading"
          />
        </View>
      );
    }
    if (state.status !== 'ready') {
      return (
        <View style={themedStyles.centered}>
          <AppText color="secondary" testID="lesson-flow-unavailable">
            {state.status === 'contract-mismatch'
              ? t('lessonPlayer.update_app')
              : isLessonNotDownloaded(state)
                ? t('lessonPlayer.not_downloaded')
                : t('lessonFlow.unavailable')}
          </AppText>
          {state.status === 'error' ? (
            <AppButton
              accessibilityHint={t('lessonPlayer.retry_load_hint')}
              onPress={open}
              testID="lesson-flow-retry"
              title={t('common.retry')}
              variant="secondary"
            />
          ) : null}
        </View>
      );
    }
    if (!snapshot || !runnable) {
      return (
        <AppText color="secondary" testID="lesson-flow-not-curriculum">
          {t('lessonFlow.not_curriculum')}
        </AppText>
      );
    }
    const step = flow.step;
    if (step === null) return null;
    if (showMap) {
      return (
        <LessonMap
          nextStep={step}
          onOpenStep={openStep}
          skippedSteps={skippedSteps}
          snapshot={snapshot}
        />
      );
    }
    return (
      <>
        {step <= 5 ? (
          <View style={themedStyles.title}>
            <StudyLabel
              color={HERO_PALETTE.coralShelf}
              testID="lesson-flow-step-title"
            >
              {t(STEP_LABEL_KEYS[step])}
            </StudyLabel>
            {!(step === 1 && reviewSkipped) ? (
              <AppText
                color="secondary"
                testID="lesson-flow-coach"
                variant="body"
              >
                {t(`lessonFlow.coach_step_${step}`)}
              </AppText>
            ) : null}
          </View>
        ) : null}
        {step >= 3 && step <= 5 && noSpeaking.active ? (
          <View
            style={themedStyles.noSpeaking}
            testID="lesson-flow-no-speaking"
          >
            <AppText style={themedStyles.noSpeakingText} variant="label">
              {t('lessonFlow.no_speaking_active')}
            </AppText>
            <Pressable
              accessibilityHint={t('lessonFlow.can_speak_again_hint')}
              accessibilityRole="button"
              onPress={noSpeaking.stop}
              style={({pressed}) => [
                themedStyles.noSpeakingButton,
                pressed ? themedStyles.pressed : null,
              ]}
              testID="lesson-flow-can-speak"
            >
              <AppText style={themedStyles.noSpeakingText} variant="label">
                {t('lessonFlow.can_speak_again')}
              </AppText>
            </Pressable>
          </View>
        ) : null}
        {step === 1 ? (
          <StepReview
            onOpenLesson={appNavigation.openLesson}
            onSpeakText={handleSpeak}
            snapshot={snapshot}
          />
        ) : null}
        {step === 6 ? (
          <StepResult
            attempts={flow.attempts}
            onBackToUnit={
              unitTarget
                ? () => appNavigation.closeLessonToUnit(unitTarget)
                : undefined
            }
            onClose={navigation.goBack}
            onNextLesson={
              unitTarget
                ? () => appNavigation.openNextUnitLesson(unitTarget)
                : undefined
            }
            onOpenStep={openStep}
            practiceDone={flow.practiceDone}
            practiceRemaining={flow.practiceRemaining}
            snapshot={snapshot}
            streakDays={streakDays}
          />
        ) : step === 1 && blocksOfStep(snapshot, 1).length === 0 ? null : (
          <StepView
            attempts={flow.attempts}
            key={step}
            items={items}
            onFinished={handleFinished}
            onOpenStep={next => openStep(next as FlowStep)}
            speakingOff={noSpeaking.active}
            onSpeakText={handleSpeak}
            snapshot={snapshot}
            step={step}
          />
        )}
      </>
    );
  };

  const shownStep = state.status === 'ready' && runnable ? flow.step : null;

  const defaultAction =
    shownStep === null
      ? null
      : showMap
        ? {
            title: t('lessonFlow.map_start'),
            hint: t('lessonFlow.map_start_hint'),
            testID: 'lesson-flow-map-start',
            onPress: () => openStep(shownStep),
          }
        : shownStep < 6
          ? {
              title: t('lessonFlow.continue'),
              hint: t('lessonFlow.next_step_hint'),
              testID: 'lesson-flow-next',
              onPress: () => openStep((shownStep + 1) as FlowStep),
            }
          : null;
  // A practice panel on a card hides the bar: it has its own buttons.
  const footerAction =
    !showMap && footer.hidden
      ? null
      : (!showMap && footer.action) || defaultAction;

  return (
    <AppScreen>
      <FlowFooterProvider register={footer.register}>
        {shownStep !== null && showMap ? (
          <View style={themedStyles.header}>
            <HeaderIconButton
              accessibilityHint={t('lessonFlow.close_lesson_hint')}
              accessibilityLabel={t('lessonFlow.close_lesson')}
              icon="close"
              onPress={appNavigation.closeLesson}
              testID="lesson-flow-close"
            />
            <AppText
              color="secondary"
              numberOfLines={1}
              style={themedStyles.flex}
              variant="label"
            >
              {unit?.unit_title ?? t('lessonFlow.map_lesson')}
            </AppText>
            {streakDays ? (
              <View style={themedStyles.streak} testID="lesson-flow-map-streak">
                <MaterialIcon
                  color={theme.colors.onTertiaryContainer}
                  name="local_fire_department"
                  size={18}
                />
                <AppText style={themedStyles.streakText} variant="label">
                  {t('lessonFlow.map_streak_short', {count: streakDays})}
                </AppText>
              </View>
            ) : null}
          </View>
        ) : (
          <View style={themedStyles.header}>
            <HeaderIconButton
              accessibilityHint={t('lessonFlow.close_lesson_hint')}
              accessibilityLabel={t('lessonFlow.close_lesson')}
              icon="close"
              onPress={appNavigation.closeLesson}
              testID="lesson-flow-close"
            />
            {shownStep !== null ? (
              <>
                <FlowProgressBar
                  doneSteps={doneSteps}
                  onSelect={openStep}
                  skippedSteps={skippedSteps}
                  step={shownStep}
                />
                {shownStep >= 3 && shownStep <= 5 ? (
                  <Pressable
                    accessibilityHint={
                      noSpeaking.active
                        ? t('lessonFlow.can_speak_again_hint')
                        : t('lessonFlow.no_speaking_hint')
                    }
                    accessibilityLabel={t('lessonFlow.no_speaking')}
                    accessibilityRole="switch"
                    accessibilityState={{checked: noSpeaking.active}}
                    onPress={
                      noSpeaking.active ? noSpeaking.stop : noSpeaking.start
                    }
                    style={({pressed}) => [
                      themedStyles.speakToggle,
                      noSpeaking.active ? themedStyles.speakToggleOn : null,
                      pressed ? themedStyles.pressed : null,
                    ]}
                    testID="lesson-flow-cannot-speak"
                  >
                    <MaterialIcon
                      color={
                        noSpeaking.active
                          ? HERO_PALETTE.coralShelf
                          : theme.colors.primary
                      }
                      name="mic"
                      size={20}
                    />
                    {noSpeaking.active ? (
                      <View style={themedStyles.speakSlash} />
                    ) : null}
                  </Pressable>
                ) : null}
              </>
            ) : (
              <AppText numberOfLines={1} style={themedStyles.flex} variant="h3">
                {t('lessonFlow.title')}
              </AppText>
            )}
          </View>
        )}
        {speechNotice ? (
          <View style={themedStyles.speechNotice}>
            <SpeechNotice
              notice={speechNotice}
              testID="lesson-flow-speech-notice"
            />
          </View>
        ) : null}
        <ScrollView
          contentContainerStyle={themedStyles.content}
          ref={scrollRef}
          showsVerticalScrollIndicator={false}
          style={themedStyles.scroll}
          testID="lesson-flow-screen"
        >
          <SpeakContext.Provider value={handleSpeak}>
            {renderBody()}
          </SpeakContext.Provider>
        </ScrollView>
        {footerAction ? <FlowFooterBar action={footerAction} /> : null}
      </FlowFooterProvider>
    </AppScreen>
  );
}

function readStreakDays(): number | null {
  try {
    return getGamificationSnapshot().currentStreak;
  } catch {
    return null;
  }
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    centered: {
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.xl,
    },
    content: {
      gap: theme.spacing.lg,
      paddingBottom: theme.spacing.xl,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
    },
    speechNotice: {
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
    },
    flex: {
      flex: 1,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.sm,
      paddingRight: theme.gutter,
      paddingTop: theme.spacing.xs,
    },
    noSpeaking: {
      alignItems: 'center',
      backgroundColor: withAlpha(HERO_PALETTE.coral, 0.16),
      borderRadius: 16,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    noSpeakingText: {
      color: theme.colors.text.primary,
      flexShrink: 1,
    },
    noSpeakingButton: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    speakToggle: {
      alignItems: 'center',
      backgroundColor: theme.colors.accentSoft,
      borderRadius: HEADER_BUTTON_RADIUS,
      height: HEADER_BUTTON_SIZE,
      justifyContent: 'center',
      width: HEADER_BUTTON_SIZE,
      ...getStickerEdge(3, withAlpha(theme.colors.primary, 0.3)),
    },
    speakToggleOn: {
      backgroundColor: solidOver(
        withAlpha(HERO_PALETTE.coral, 0.18),
        theme.colors.surface,
      ),
      ...getStickerEdge(3, HERO_PALETTE.coralRing),
    },
    speakSlash: {
      backgroundColor: HERO_PALETTE.coralShelf,
      borderRadius: 1,
      height: 2.5,
      position: 'absolute',
      transform: [{rotate: '45deg'}],
      width: 24,
    },
    title: {
      gap: 2,
    },
    streak: {
      alignItems: 'center',
      backgroundColor: theme.colors.tertiaryFixed,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: theme.spacing.xs,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
      ...getStickerFace(theme, 0),
    },
    streakText: {
      color: theme.colors.onTertiaryContainer,
      fontWeight: theme.typography.weight.bold,
    },
    scroll: {
      flex: 1,
    },
  });
}
