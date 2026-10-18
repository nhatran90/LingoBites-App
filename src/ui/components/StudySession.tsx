/**
 * Shared pieces of the study sessions (learn a pack, quick check, reviews):
 * a compact header with a progress bar, the question card, its answer
 * options and the line saying whether the answer was right.
 */
import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {type AppTheme, useAppTheme} from '../theme';
import {ActionIconButton} from './ActionIconButton';
import {AppProgressBar} from './AppProgressBar';
import {AppText} from './AppText';
import {HeaderIconButton} from './HeaderIconButton';
import {MaterialIcon} from './MaterialIcon';

type HeaderProps = {
  current: number;
  total: number;
  /** Screen-reader text of the bar ("Thẻ 1/12"). */
  progressLabel: string;
  onClose: () => void;
  /** The session is over: every step reads as done, none as current. */
  complete?: boolean;
  /** Screen-reader name and hint of the close button; the pack's by default. */
  closeLabel?: string;
  closeHint?: string;
  closeTestID?: string;
  testID?: string;
};

/** [✕] [██████░░░░░░░░] 1/12 */
export function SessionHeader({
  current,
  total,
  progressLabel,
  onClose,
  complete = false,
  closeLabel,
  closeHint,
  closeTestID = 'screen-header-back',
  testID = 'screen-header',
}: HeaderProps) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.header} testID={testID}>
      <HeaderIconButton
        accessibilityHint={closeHint ?? t('packQuiz.close_hint')}
        accessibilityLabel={closeLabel ?? t('packQuiz.close')}
        icon="close"
        onPress={onClose}
        testID={closeTestID}
      />
      <AppProgressBar
        accessibilityValue={{text: progressLabel}}
        count={`${current}/${total}`}
        current={
          !complete && current > 0 && current <= total ? current - 1 : undefined
        }
        done={complete ? total : Math.max(0, current - 1)}
        style={styles.progress}
        testID="pack-session-progress"
        total={total}
      />
    </View>
  );
}

type StepsProps = {labels: string[]; active: number};

/** The steps of a session as pills, the current one filled. */
export function SessionSteps({labels, active}: StepsProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.steps}>
      {labels.map((label, index) => (
        <View
          key={label}
          style={[styles.step, index === active && styles.stepOn]}
        >
          <AppText
            style={[styles.stepText, index === active && styles.stepTextOn]}
          >
            {label}
          </AppText>
        </View>
      ))}
    </View>
  );
}

type QuestionProps = {
  prompt: string;
  options: string[];
  answerIndex: number;
  chosen: number | null;
  onChoose: (option: number) => void;
  onSpeak: () => void;
  /** Prefix of the option testIDs: `${optionTestID}-${index}`. */
  optionTestID: string;
  /** Put on the card's own view, so tests read the prompt from it. */
  containerTestID: string;
};

/** "Từ này nghĩa là gì?", the word, then options A, B, C and the verdict. */
export function StudyQuestion({
  prompt,
  options,
  answerIndex,
  chosen,
  onChoose,
  onSpeak,
  optionTestID,
  containerTestID,
}: QuestionProps) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const answered = chosen !== null;
  const right = chosen === answerIndex;
  return (
    <View style={styles.question} testID={containerTestID}>
      <View style={styles.promptCard}>
        <AppText style={styles.ask}>{t('packQuiz.ask')}</AppText>
        <View style={styles.promptRow}>
          <AppText adjustsFontSizeToFit numberOfLines={2} style={styles.prompt}>
            {prompt}
          </AppText>
          <ActionIconButton
            accessibilityHint={t('packQuiz.speak_hint')}
            accessibilityLabel={t('packQuiz.speak')}
            icon="volume_up"
            onPress={onSpeak}
          />
        </View>
      </View>
      <View style={styles.options}>
        {options.map((option, index) => (
          <PackOption
            key={`${index}-${option}`}
            letter={String.fromCharCode(65 + index)}
            onPress={() => onChoose(index)}
            state={
              !answered
                ? 'idle'
                : index === answerIndex
                  ? 'right'
                  : index === chosen
                    ? 'wrong'
                    : 'dim'
            }
            testID={`${optionTestID}-${index}`}
            title={option}
          />
        ))}
      </View>
      {answered ? (
        <View
          accessibilityLiveRegion="polite"
          style={[
            styles.verdict,
            right ? styles.verdictRight : styles.verdictWrong,
          ]}
        >
          <AppText
            style={[
              styles.verdictText,
              right ? styles.verdictTextRight : styles.verdictTextWrong,
            ]}
          >
            {right
              ? t('packQuiz.right')
              : t('packQuiz.wrong', {answer: options[answerIndex] ?? ''})}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

type OptionState = 'idle' | 'right' | 'wrong' | 'dim';

type OptionProps = {
  title: string;
  letter: string;
  state: OptionState;
  onPress: () => void;
  testID: string;
};

function PackOption({title, letter, state, onPress, testID}: OptionProps) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const mark =
    state === 'right' ? 'check_circle' : state === 'wrong' ? 'close' : null;
  return (
    <Pressable
      accessibilityHint={t('packQuiz.option_hint')}
      accessibilityLabel={title}
      accessibilityRole="button"
      accessibilityState={{
        disabled: state !== 'idle',
        selected: state === 'right' || state === 'wrong',
      }}
      onPress={onPress}
      style={({pressed}) => [
        styles.option,
        state === 'right' && styles.optionRight,
        state === 'wrong' && styles.optionWrong,
        state === 'dim' && styles.optionDim,
        pressed && state === 'idle' && styles.optionPressed,
      ]}
      testID={testID}
    >
      <View
        style={[
          styles.letter,
          state === 'right' && styles.letterRight,
          state === 'wrong' && styles.letterWrong,
        ]}
      >
        <AppText
          style={[
            styles.letterText,
            (state === 'right' || state === 'wrong') && styles.letterTextOn,
          ]}
        >
          {letter}
        </AppText>
      </View>
      <AppText style={styles.optionText}>{title}</AppText>
      {mark ? (
        <MaterialIcon
          color={state === 'right' ? theme.colors.primary : theme.colors.danger}
          name={mark}
          size={22}
        />
      ) : null}
    </Pressable>
  );
}

function makeStyles(theme: AppTheme) {
  const edge = theme.shelf?.surface.color ?? theme.colors.border;
  return StyleSheet.create({
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    progress: {
      flex: 1,
    },
    steps: {
      flexDirection: 'row',
      gap: 6,
    },
    step: {
      backgroundColor: theme.colors.surface,
      borderBottomColor: edge,
      borderBottomWidth: 2,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    stepOn: {
      backgroundColor: theme.colors.primary,
      borderBottomColor: theme.colors.primaryPressed,
    },
    stepText: {
      color: theme.colors.text.muted,
      fontSize: 11.5,
      fontWeight: '700',
    },
    stepTextOn: {
      color: theme.colors.text.inverse,
    },
    question: {
      gap: 14,
    },
    promptCard: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderBottomColor: edge,
      borderBottomWidth: 6,
      borderRadius: 26,
      gap: 6,
      paddingHorizontal: 18,
      paddingVertical: 18,
    },
    ask: {
      color: theme.colors.text.muted,
      fontSize: 13,
      fontWeight: '700',
    },
    promptRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      justifyContent: 'center',
      maxWidth: '100%',
    },
    prompt: {
      color: theme.colors.text.primary,
      flexShrink: 1,
      fontSize: 34,
      fontWeight: '800',
      lineHeight: 40,
      textAlign: 'center',
    },
    options: {
      gap: 10,
    },
    option: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderBottomColor: edge,
      borderBottomWidth: 4,
      borderColor: theme.colors.surface,
      borderRadius: 18,
      borderWidth: 2,
      flexDirection: 'row',
      gap: 12,
      minHeight: 56,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    optionPressed: {
      opacity: theme.states.pressedOpacity,
    },
    // The bottom edge takes the state colour too, or it stays beige under
    // a coloured outline.
    optionRight: {
      backgroundColor: theme.colors.accentSoft,
      borderBottomColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    optionWrong: {
      backgroundColor: theme.colors.secondarySoft,
      borderBottomColor: theme.colors.danger,
      borderColor: theme.colors.danger,
    },
    optionDim: {
      opacity: 0.55,
    },
    letter: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: 10,
      height: 30,
      justifyContent: 'center',
      width: 30,
    },
    letterRight: {
      backgroundColor: theme.colors.primary,
    },
    letterWrong: {
      backgroundColor: theme.colors.danger,
    },
    letterText: {
      color: theme.colors.text.muted,
      fontSize: 13,
      fontWeight: '800',
    },
    letterTextOn: {
      color: theme.colors.text.inverse,
    },
    optionText: {
      color: theme.colors.text.primary,
      flex: 1,
      fontSize: 16,
      fontWeight: '700',
    },
    verdict: {
      borderRadius: 16,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    verdictRight: {
      backgroundColor: theme.colors.accentSoft,
    },
    verdictWrong: {
      backgroundColor: theme.colors.secondarySoft,
    },
    verdictText: {
      fontSize: 14,
      fontWeight: '700',
    },
    verdictTextRight: {
      color: theme.colors.primary,
    },
    verdictTextWrong: {
      color: theme.colors.danger,
    },
  });
}
