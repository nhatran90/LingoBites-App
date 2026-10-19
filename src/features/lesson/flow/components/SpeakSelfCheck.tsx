import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {useScreenSpeak} from '@features/audio';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonSupportLevel} from '@core/schemas/sync';

import {studyCardStyle} from '../../player/components/StudyControls';
import type {EntryResult} from '../logic/activityOutcome';
import type {HintStep} from '../logic/hints';
import {useSelfCheckRecorder} from '../logic/useSelfCheckRecorder';
import {HintLadder} from './HintLadder';
import {SLOW_TTS_RATE} from './ListenCardDeck';
import {RecorderControls} from './RecorderControls';
import {SoftButton} from './SoftButton';

export type SpeakSelfCheckProps = {
  /** The model sentence (spoken with TTS, shown when revealed). */
  model: string;
  /** Redesign: the model's Vietnamese, shown under it (listen and repeat). */
  meaning?: string;
  /**
   * `null`: the model is the content (listen and repeat): its text shows and
   * "Nghe câu mẫu" is free. A ladder: the model only comes through the hints
   * (PR 11 G3), which raise the support level.
   */
  hints: readonly HintStep[] | null;
  onReport: (result: EntryResult, support: LessonSupportLevel) => void;
};

/**
 * Speaking in Stage 2: hear the model, record yourself and listen back, then
 * judge it (decision G4). The judging question comes once there is a take;
 * without a microphone it shows straight away and only the record buttons go
 * away. The model sits on a white card with two light listen buttons; the
 * result shows in the player's bottom sheet (EntrySequence).
 */
export function SpeakSelfCheck({
  model,
  meaning,
  hints,
  onReport,
}: SpeakSelfCheckProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const speak = useScreenSpeak();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [support, setSupport] = useState<LessonSupportLevel>('none');
  const [judged, setJudged] = useState<EntryResult | null>(null);
  const recorder = useSelfCheckRecorder();
  // Judge once there is a take to compare (or no microphone at all).
  const canJudge =
    recorder.state === 'recorded' || recorder.state === 'unavailable';

  const judge = (result: EntryResult) => {
    if (judged) return;
    setJudged(result);
    onReport(result, support);
  };

  return (
    <View style={themedStyles.container}>
      {hints === null ? (
        <View style={themedStyles.model}>
          <AppText testID="lesson-flow-model-sentence" variant="h1">
            {model}
          </AppText>
          {meaning ? (
            <AppText
              color="secondary"
              testID="lesson-flow-prompt"
              variant="bodyLg"
            >
              {meaning}
            </AppText>
          ) : null}
          <View style={themedStyles.listenRow}>
            <SoftButton
              accessibilityHint={t('lessonFlow.listen_model_hint')}
              icon="volume_up"
              label={t('lessonFlow.listen_model')}
              onPress={() => {
                speak(model);
              }}
              testID="lesson-flow-listen-model"
            />
            <SoftButton
              accessibilityHint={t('lessonFlow.listen_slow_hint')}
              icon="volume_up"
              label={t('listen.slow_labelled')}
              onPress={() => {
                speak(model, SLOW_TTS_RATE);
              }}
              testID="lesson-flow-listen-model-slow"
            />
          </View>
        </View>
      ) : (
        <HintLadder
          disabled={judged !== null}
          onSupportChange={setSupport}
          steps={hints}
        />
      )}
      <RecorderControls recorder={recorder} />
      {judged === null && canJudge ? (
        <View style={themedStyles.judge}>
          <AppText style={themedStyles.question} variant="h3">
            {t('lessonFlow.self_check_question')}
          </AppText>
          <View style={themedStyles.row}>
            <Pressable
              accessibilityHint={t('lessonFlow.self_pass_hint')}
              accessibilityLabel={t('lessonFlow.self_pass')}
              accessibilityRole="button"
              onPress={() => judge('first_try')}
              style={({pressed}) => [
                themedStyles.pick,
                pressed ? themedStyles.pressed : null,
              ]}
              testID="lesson-flow-self-pass"
            >
              <MaterialIcon
                color={theme.colors.primary}
                name="check_circle"
                size={18}
              />
              <AppText style={themedStyles.pickText}>
                {t('lessonFlow.self_pass')}
              </AppText>
            </Pressable>
            <Pressable
              accessibilityHint={t('lessonFlow.self_fail_hint')}
              accessibilityLabel={t('lessonFlow.self_fail')}
              accessibilityRole="button"
              onPress={() => judge('not_yet')}
              style={({pressed}) => [
                themedStyles.pick,
                pressed ? themedStyles.pressed : null,
              ]}
              testID="lesson-flow-self-fail"
            >
              <AppText style={themedStyles.pickText}>
                {t('lessonFlow.self_fail')}
              </AppText>
            </Pressable>
          </View>
        </View>
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  const {colors} = theme;
  return StyleSheet.create({
    container: {
      gap: theme.spacing.md,
    },
    judge: {
      ...studyCardStyle(theme),
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
    },
    listenRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
      marginTop: theme.spacing.xs,
    },
    model: {
      ...studyCardStyle(theme),
      gap: theme.spacing.sm,
      padding: theme.spacing.lg,
    },
    pick: {
      alignItems: 'center',
      backgroundColor: colors.surfaceMuted,
      borderRadius: 16,
      flex: 1,
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'center',
      minHeight: 48,
      paddingHorizontal: theme.spacing.sm,
    },
    pickText: {
      color: colors.text.primary,
      fontSize: 15,
      fontWeight: '700',
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    question: {
      textAlign: 'center',
    },
    row: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
  });
}
