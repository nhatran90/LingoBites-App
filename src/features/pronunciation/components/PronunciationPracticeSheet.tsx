import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Modal, Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {ReadingTarget} from '../logic/readingTarget';
import type {PracticeDeps} from '../logic/usePronunciationPractice';
import {SpeakWordPanel} from './SpeakWordPanel';

export type PracticeItem = {
  itemId: string;
  text: string;
  ipa?: string | null;
};

export type PronunciationPracticeSheetProps = {
  /** The item to practise; null keeps the sheet closed. */
  item: PracticeItem | null;
  onClose: () => void;
  /** Reads the model aloud (the screen's TTS), slowly with a rate; omitted = no listen buttons. */
  onSpeakText?: (text: string, rate?: number) => void;
  /** Tests only: stand-ins for the recorder, the Server and the consent. */
  deps?: Partial<PracticeDeps>;
};

/**
 * Pronunciation step 3: the practice sheet over the lesson. Inside is the
 * same "Đọc từ" panel as on word cards (recorder, scores, retry), reading
 * the lesson's pronunciation item. The flow only lives while the sheet is
 * open, so closing it stops any take or wait and deletes the recording on
 * the device.
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
  const itemId = item?.itemId ?? null;
  const target = useMemo<ReadingTarget | null>(
    () => (itemId ? {source: 'lesson', itemId} : null),
    [itemId],
  );
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
      {item && target ? (
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
            <SpeakWordPanel
              deps={deps}
              doneLabel={t('pronunciation.close')}
              ipa={item.ipa ?? null}
              key={item.itemId}
              onDone={onClose}
              onSpeak={onSpeakText}
              target={target}
              testID="pronunciation"
              text={item.text}
            />
          </ScrollView>
        </View>
      ) : null}
    </Modal>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    backdrop: {
      backgroundColor: theme.colors.overlay,
      flex: 1,
    },
    sheet: {
      backgroundColor: theme.colors.background,
      borderTopLeftRadius: theme.radius.xl,
      borderTopRightRadius: theme.radius.xl,
      maxHeight: '90%',
      paddingTop: theme.spacing.lg,
    },
    header: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
      paddingHorizontal: theme.spacing.lg,
    },
    content: {
      padding: theme.spacing.lg,
      paddingBottom: theme.spacing.xxl,
    },
  });
}
