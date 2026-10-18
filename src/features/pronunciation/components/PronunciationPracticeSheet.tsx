import React, {useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {unscorableKey} from '../logic/scoreBands';
import {
  type PracticeDeps,
  usePronunciationPractice,
} from '../logic/usePronunciationPractice';
import {PronunciationConsentPrompt} from './PronunciationConsentPrompt';
import {PronunciationResult} from './PronunciationResult';

export type PracticeItem = {
  itemId: string;
  text: string;
  ipa?: string | null;
};

export type PronunciationPracticeSheetProps = {
  /** The item to practise; null keeps the sheet closed. */
  item: PracticeItem | null;
  onClose: () => void;
  /** Reads the model aloud (the screen's TTS); omitted = no listen button. */
  onSpeakText?: (text: string) => void;
  /** Tests only: stand-ins for the recorder, the Server and the consent. */
  deps?: Partial<PracticeDeps>;
};

/**
 * Pronunciation step 3: the practice sheet over the lesson. The flow only
 * lives while the sheet is open, so closing it stops any take or wait and
 * deletes the recording on the device.
 */
export function PronunciationPracticeSheet({
  item,
  onClose,
  onSpeakText,
  deps,
}: PronunciationPracticeSheetProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <Modal
      animationType="slide"
      onRequestClose={onClose}
      transparent
      visible={item !== null}
    >
      <Pressable
        accessibilityHint={t('pronunciation.close')}
        accessibilityLabel={t('pronunciation.close')}
        onPress={onClose}
        style={styles.backdrop}
        testID="pronunciation-sheet-backdrop"
      />
      {item ? (
        <View style={styles.sheet} testID="pronunciation-sheet">
          <View style={styles.header}>
            <AppText variant="h3">{t('pronunciation.sheet_title')}</AppText>
            <Pressable
              accessibilityHint={t('pronunciation.close')}
              accessibilityLabel={t('pronunciation.close')}
              accessibilityRole="button"
              hitSlop={12}
              onPress={onClose}
              testID="pronunciation-sheet-close"
            >
              <MaterialIcon
                color={theme.colors.text.secondary}
                name="close"
                size={24}
              />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.content}>
            <View style={styles.model}>
              <View style={styles.modelText}>
                <AppText style={styles.reference}>{item.text}</AppText>
                {item.ipa ? <AppText color="muted">{item.ipa}</AppText> : null}
              </View>
              {onSpeakText ? (
                <AppButton
                  accessibilityHint={t('pronunciation.listen_model_hint')}
                  iconLeft="volume_up"
                  onPress={() => onSpeakText(item.text)}
                  testID="pronunciation-listen-model"
                  title={t('pronunciation.listen_model')}
                  variant="outline"
                />
              ) : null}
            </View>
            <PracticeBody
              deps={deps}
              key={item.itemId}
              styles={styles}
              itemId={item.itemId}
            />
          </ScrollView>
        </View>
      ) : null}
    </Modal>
  );
}

function PracticeBody({
  itemId,
  deps,
  styles,
}: {
  itemId: string;
  deps?: Partial<PracticeDeps>;
  styles: ReturnType<typeof makeStyles>;
}) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const target = useMemo(() => ({source: 'lesson' as const, itemId}), [itemId]);
  const practice = usePronunciationPractice(target, deps);
  const {state} = practice;
  const elapsed = useElapsedSeconds(state.phase === 'recording');

  switch (state.phase) {
    case 'consent':
      return <PronunciationConsentPrompt onAnswer={practice.answerConsent} />;
    case 'declined':
      return (
        <View style={styles.block} testID="pronunciation-declined">
          <AppText color="secondary">
            {t('pronunciation.declined_body')}
          </AppText>
          <AppButton
            accessibilityHint={t('pronunciation.declined_agree')}
            onPress={() => practice.answerConsent(true)}
            testID="pronunciation-declined-agree"
            title={t('pronunciation.declined_agree')}
            variant="outline"
          />
        </View>
      );
    case 'idle':
    case 'recording': {
      const recording = state.phase === 'recording';
      return (
        <View style={styles.recorder}>
          <AppText color="secondary">
            {recording
              ? t('pronunciation.record_elapsed', {seconds: elapsed})
              : t('pronunciation.record_prompt')}
          </AppText>
          <Pressable
            accessibilityHint={
              recording
                ? t('pronunciation.record_stop_hint')
                : t('pronunciation.record_start_hint')
            }
            accessibilityLabel={
              recording
                ? t('pronunciation.record_stop')
                : t('pronunciation.record_start')
            }
            accessibilityRole="button"
            onPress={recording ? practice.stop : practice.start}
            style={[styles.mic, recording ? styles.micActive : null]}
            testID={
              recording ? 'pronunciation-record-stop' : 'pronunciation-record'
            }
          >
            <MaterialIcon
              color={theme.colors.text.inverse}
              name="mic"
              size={36}
            />
          </Pressable>
          <AppText variant="label">
            {recording
              ? t('pronunciation.record_stop')
              : t('pronunciation.record_start')}
          </AppText>
        </View>
      );
    }
    case 'sending':
    case 'scoring':
      return (
        <View style={styles.recorder} testID="pronunciation-scoring">
          <ActivityIndicator color={theme.colors.primary} />
          <AppText color="secondary">{t('pronunciation.scoring')}</AppText>
        </View>
      );
    case 'scored':
      return (
        <View style={styles.block}>
          <PronunciationResult attempt={state.attempt} />
          <AfterActions practice={practice} styles={styles} />
        </View>
      );
    case 'unscorable':
      return (
        <View style={styles.block} testID="pronunciation-unscorable">
          <AppText>{t(unscorableKey(state.reason))}</AppText>
          <AfterActions practice={practice} styles={styles} />
        </View>
      );
    case 'error':
      return (
        <View
          style={styles.block}
          testID={`pronunciation-error-${state.reason}`}
        >
          <View style={styles.notice}>
            <MaterialIcon
              color={theme.colors.danger}
              name={state.reason === 'offline' ? 'cloud_off' : 'warning'}
              size={20}
            />
            <AppText style={styles.noticeText}>
              {t(`pronunciation.error_${state.reason}`)}
            </AppText>
          </View>
          {state.reason === 'slow' ? (
            <AppButton
              accessibilityHint={t('pronunciation.check_again_hint')}
              iconLeft="refresh"
              onPress={practice.checkAgain}
              testID="pronunciation-check-again"
              title={t('pronunciation.check_again')}
            />
          ) : null}
          {state.reason === 'disabled' ||
          state.reason === 'item_not_found' ? null : (
            <AfterActions practice={practice} styles={styles} />
          )}
        </View>
      );
  }
}

function AfterActions({
  practice,
  styles,
}: {
  practice: ReturnType<typeof usePronunciationPractice>;
  styles: ReturnType<typeof makeStyles>;
}) {
  const {t} = useTranslation();
  return (
    <View style={styles.actions}>
      {practice.hasOwnTake ? (
        <AppButton
          accessibilityHint={t('pronunciation.play_own_hint')}
          iconLeft="play_arrow"
          onPress={practice.playOwnTake}
          testID="pronunciation-play-own"
          title={t('pronunciation.play_own')}
          variant="outline"
        />
      ) : null}
      <AppButton
        accessibilityHint={t('pronunciation.retry_hint')}
        iconLeft="replay"
        onPress={practice.retry}
        testID="pronunciation-retry"
        title={t('pronunciation.retry')}
      />
    </View>
  );
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
  return StyleSheet.create({
    backdrop: {
      backgroundColor: theme.colors.overlay,
      flex: 1,
    },
    sheet: {
      backgroundColor: theme.colors.surface,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      maxHeight: '85%',
      paddingTop: theme.spacing.lg,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.lg,
    },
    content: {
      gap: theme.spacing.lg,
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.xxl,
    },
    model: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    modelText: {
      flex: 1,
      gap: 2,
    },
    reference: {
      color: theme.colors.text.primary,
      fontSize: 22,
      fontWeight: '800',
    },
    block: {
      gap: theme.spacing.md,
    },
    recorder: {
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingVertical: theme.spacing.md,
    },
    mic: {
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
      borderRadius: 44,
      height: 88,
      justifyContent: 'center',
      width: 88,
    },
    micActive: {
      backgroundColor: theme.colors.danger,
    },
    notice: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    noticeText: {
      flex: 1,
    },
    actions: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
  });
}
