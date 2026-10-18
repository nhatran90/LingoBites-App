import React, {useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ActivityIndicator, Pressable, StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';

import {PRONUNCIATION_MAX_DURATION_MS} from '@core/schemas/recordings';

import {isSentence, type ReadingTarget} from '../logic/readingTarget';
import {unscorableKey} from '../logic/scoreBands';
import {
  type PracticeDeps,
  type PronunciationPractice,
  usePronunciationPractice,
} from '../logic/usePronunciationPractice';
import {PronunciationConsentPrompt} from './PronunciationConsentPrompt';
import {SpeakResult} from './SpeakResult';

/** Slow reading of a word, as the lesson's "listen slowly". */
const SLOW_RATE = 0.3;

export type SpeakWordPanelProps = {
  /** The card's word or sentence, read aloud and scored. */
  text: string;
  ipa?: string | null;
  meaningVi?: string | null;
  target: ReadingTarget;
  /** Back to the card (the take on the device is deleted). */
  onDone: () => void;
  /** Reads text aloud (the screen's TTS); omitted = no listen buttons. */
  onSpeak?: (text: string, rate?: number) => void;
  /** Prefix of the panel's testIDs. */
  testID?: string;
  /** Tests only: stand-ins for the recorder, the Server and the consent. */
  deps?: Partial<PracticeDeps>;
};

/**
 * "Nói từ" on a pack or review card: read the card aloud, have Azure score
 * it, see which sounds to fix, try again. Practice only, like "Viết từ":
 * nothing here is scheduled or counted as a review answer. Leaving the
 * panel stops any take or wait and deletes the recording on the device.
 */
export function SpeakWordPanel({
  text,
  ipa = null,
  meaningVi = null,
  target,
  onDone,
  onSpeak,
  testID = 'speak-word',
  deps,
}: SpeakWordPanelProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const practice = usePronunciationPractice(target, deps);
  const {state} = practice;
  const sentence = isSentence(text);
  const elapsed = useElapsedSeconds(state.phase === 'recording');
  const scored = state.phase === 'scored';
  const listenModel = onSpeak ? () => onSpeak(text) : undefined;

  return (
    <View style={styles.container} testID={`${testID}-panel`}>
      <View style={styles.card}>
        {scored ? (
          <SpeakResult
            attempt={state.attempt}
            onListenSlow={
              onSpeak ? word => onSpeak(word, SLOW_RATE) : undefined
            }
          />
        ) : (
          <View style={styles.model}>
            <AppText color="secondary" style={styles.start} variant="label">
              {t(sentence ? 'speakWord.title_sentence' : 'speakWord.title')}
            </AppText>
            <AppText style={styles.text} testID={`${testID}-text`}>
              {text}
            </AppText>
            {ipa || meaningVi ? (
              <AppText color="muted">
                {[ipa, meaningVi].filter(Boolean).join(' · ')}
              </AppText>
            ) : null}
            {listenModel ? (
              <AppButton
                accessibilityHint={t('pronunciation.listen_model_hint')}
                iconLeft="volume_up"
                onPress={listenModel}
                testID={`${testID}-listen`}
                title={t('pronunciation.listen_model')}
                variant="outline"
              />
            ) : null}
          </View>
        )}
      </View>

      <Body
        elapsed={elapsed}
        listenModel={listenModel}
        onDone={onDone}
        practice={practice}
        styles={styles}
        testID={testID}
      />
    </View>
  );
}

function Body({
  practice,
  elapsed,
  listenModel,
  onDone,
  styles,
  testID,
}: {
  practice: PronunciationPractice;
  elapsed: number;
  listenModel?: () => void;
  onDone: () => void;
  styles: ReturnType<typeof makeStyles>;
  testID: string;
}) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const {state} = practice;
  const cancel = (
    <AppButton
      accessibilityHint={t('speakWord.cancel_hint')}
      onPress={onDone}
      testID={`${testID}-cancel`}
      title={t('speakWord.cancel')}
      variant="secondary"
    />
  );

  switch (state.phase) {
    case 'consent':
      return (
        <>
          <PronunciationConsentPrompt onAnswer={practice.answerConsent} />
          {cancel}
        </>
      );
    case 'declined':
      return (
        <View style={styles.block} testID={`${testID}-declined`}>
          <AppText color="secondary">
            {t('pronunciation.declined_body')}
          </AppText>
          <AppButton
            accessibilityHint={t('pronunciation.declined_agree')}
            onPress={() => practice.answerConsent(true)}
            title={t('pronunciation.declined_agree')}
            variant="outline"
          />
          {cancel}
        </View>
      );
    case 'idle':
    case 'recording': {
      const recording = state.phase === 'recording';
      const coral = theme.components.button['secondary-coral'];
      const edge = theme.shelf?.coral;
      return (
        <View style={styles.block}>
          <View style={styles.recorder}>
            <Pressable
              accessibilityHint={t(
                recording
                  ? 'pronunciation.record_stop_hint'
                  : 'pronunciation.record_start_hint',
              )}
              accessibilityLabel={t(
                recording
                  ? 'pronunciation.record_stop'
                  : 'pronunciation.record_start',
              )}
              accessibilityRole="button"
              onPress={recording ? practice.stop : practice.start}
              style={({pressed}) => [
                styles.mic,
                {
                  backgroundColor: recording
                    ? coral?.background
                    : theme.colors.primary,
                },
                getStickerEdge(
                  pressed ? 2 : 6,
                  recording
                    ? (edge?.color ?? theme.colors.secondary)
                    : theme.colors.primaryPressed,
                ),
              ]}
              testID={recording ? `${testID}-stop` : `${testID}-record`}
            >
              {recording ? (
                <View
                  style={[
                    styles.stopSquare,
                    {backgroundColor: coral?.text ?? theme.colors.text.inverse},
                  ]}
                />
              ) : (
                <MaterialIcon
                  color={theme.colors.text.inverse}
                  name="mic"
                  size={40}
                />
              )}
            </Pressable>
            <AppText
              style={recording ? {color: theme.colors.secondary} : null}
              variant="h3"
            >
              {recording
                ? `${clock(elapsed)} / ${clock(PRONUNCIATION_MAX_DURATION_MS / 1000)}`
                : t('pronunciation.record_start')}
            </AppText>
            <AppText color="secondary" variant="label">
              {recording
                ? t('speakWord.record_stop_send')
                : t('pronunciation.record_prompt')}
            </AppText>
          </View>
          {cancel}
        </View>
      );
    }
    case 'sending':
    case 'scoring':
      return (
        <View style={styles.block}>
          <View style={styles.recorder} testID={`${testID}-scoring`}>
            <ActivityIndicator color={theme.colors.primary} />
            <AppText color="secondary">{t('pronunciation.scoring')}</AppText>
          </View>
          {cancel}
        </View>
      );
    case 'scored':
      return (
        <AfterActions
          listenModel={listenModel}
          onDone={onDone}
          practice={practice}
          styles={styles}
          testID={testID}
        />
      );
    case 'unscorable':
      return (
        <View style={styles.block} testID={`${testID}-unscorable`}>
          <AppText>{t(unscorableKey(state.reason))}</AppText>
          <AfterActions
            listenModel={listenModel}
            onDone={onDone}
            practice={practice}
            styles={styles}
            testID={testID}
          />
        </View>
      );
    case 'error': {
      const final =
        state.reason === 'disabled' || state.reason === 'item_not_found';
      return (
        <View style={styles.block} testID={`${testID}-error-${state.reason}`}>
          <View style={styles.notice}>
            <MaterialIcon
              color={theme.colors.danger}
              name={state.reason === 'offline' ? 'cloud_off' : 'warning'}
              size={20}
            />
            <AppText style={styles.flex}>
              {t(`pronunciation.error_${state.reason}`)}
            </AppText>
          </View>
          {state.reason === 'slow' ? (
            <AppButton
              accessibilityHint={t('pronunciation.check_again_hint')}
              iconLeft="refresh"
              onPress={practice.checkAgain}
              title={t('pronunciation.check_again')}
            />
          ) : null}
          {final ? (
            cancel
          ) : (
            <AfterActions
              listenModel={listenModel}
              onDone={onDone}
              practice={practice}
              styles={styles}
              testID={testID}
            />
          )}
        </View>
      );
    }
  }
}

function AfterActions({
  practice,
  listenModel,
  onDone,
  styles,
  testID,
}: {
  practice: PronunciationPractice;
  listenModel?: () => void;
  onDone: () => void;
  styles: ReturnType<typeof makeStyles>;
  testID: string;
}) {
  const {t} = useTranslation();
  return (
    <View style={styles.block}>
      {listenModel || practice.hasOwnTake ? (
        <View style={styles.row}>
          {listenModel ? (
            <AppButton
              accessibilityHint={t('pronunciation.listen_model_hint')}
              iconLeft="volume_up"
              onPress={listenModel}
              style={styles.flex}
              testID={`${testID}-listen-model`}
              title={t('pronunciation.listen_model')}
              variant="outline"
            />
          ) : null}
          {practice.hasOwnTake ? (
            <AppButton
              accessibilityHint={t('pronunciation.play_own_hint')}
              iconLeft="play_arrow"
              onPress={practice.playOwnTake}
              style={styles.flex}
              testID={`${testID}-play-own`}
              title={t('speakWord.play_own')}
              variant="outline"
            />
          ) : null}
        </View>
      ) : null}
      <AppButton
        accessibilityHint={t('pronunciation.retry_hint')}
        iconLeft="mic"
        onPress={practice.retry}
        testID={`${testID}-retry`}
        title={t('pronunciation.retry')}
        variant="primary-accent"
      />
      <AppButton
        accessibilityHint={t('speakWord.done_hint')}
        onPress={onDone}
        testID={`${testID}-done`}
        title={t('speakWord.done')}
        variant="secondary"
      />
    </View>
  );
}

function clock(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
}

/** Whole seconds since `running` turned on; 0 while off. */
function useElapsedSeconds(running: boolean): number {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    setSeconds(0);
    if (!running) return;
    const startedAt = Date.now();
    const timer = setInterval(() => {
      setSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);
    return () => clearInterval(timer);
  }, [running]);
  return seconds;
}

function makeStyles(theme: AppTheme) {
  const {colors, spacing} = theme;
  return StyleSheet.create({
    container: {
      gap: spacing.md,
    },
    card: {
      backgroundColor: colors.surface,
      borderRadius: theme.radius.xl,
      padding: spacing.lg,
      ...getStickerEdge(6, colors.outlineVariant),
    },
    model: {
      alignItems: 'center',
      gap: spacing.sm,
    },
    start: {
      alignSelf: 'flex-start',
    },
    text: {
      color: colors.text.primary,
      fontSize: 32,
      fontWeight: '800',
      textAlign: 'center',
    },
    block: {
      gap: spacing.md,
    },
    row: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    flex: {
      flex: 1,
    },
    recorder: {
      alignItems: 'center',
      gap: spacing.sm,
      paddingVertical: spacing.md,
    },
    mic: {
      alignItems: 'center',
      borderRadius: 999,
      height: 112,
      justifyContent: 'center',
      width: 112,
    },
    stopSquare: {
      borderRadius: 10,
      height: 36,
      width: 36,
    },
    notice: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.sm,
    },
  });
}
