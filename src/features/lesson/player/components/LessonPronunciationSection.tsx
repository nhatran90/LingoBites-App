import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {
  type PracticeItem,
  PronunciationPracticeSheet,
  usePronunciationAvailable,
} from '@features/pronunciation';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {solidOver} from '@ui/theme/colorUtils';
import {getStickerEdge} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

import type {LessonPronunciationEntry} from '../logic/lessonHubContent';
import {isQuizablePair} from '../logic/minimalPairQuiz';
import {MinimalPairQuiz} from './MinimalPairQuiz';
import {SpeakSquare, studyCardStyle, StudyLabel} from './StudyControls';

export type LessonPronunciationSectionProps = {
  entries: LessonPronunciationEntry[];
  /** Speaks a word or sentence (TTS); omitted = no play buttons. */
  onSpeakText?: (text: string) => void;
};

/**
 * "Phát âm": per point, the focus sound in a big tile, a Vietnamese tip,
 * minimal pairs as two tiles to tap and hear, and a listen-and-choose quiz
 * on those pairs. Pronunciation step 3: where the Server scores
 * pronunciation, "Luyện phát âm" opens a sheet to record the item and see
 * its scores word by word.
 */
export function LessonPronunciationSection({
  entries,
  onSpeakText,
}: LessonPronunciationSectionProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const canPractise = usePronunciationAvailable();
  const [practising, setPractising] = useState<PracticeItem | null>(null);
  if (entries.length === 0) {
    return (
      <View testID="lesson-pronunciation-empty" style={styles.empty}>
        <AppText color="secondary">
          {t('lessonPlayer.pronunciation_empty')}
        </AppText>
      </View>
    );
  }
  return (
    <View testID="lesson-pronunciation-section" style={styles.list}>
      {entries.map((entry, entryIndex) => {
        const testID = `lesson-pronunciation-${entry.key}`;
        const sound = entry.focusIpa ?? entry.focus;
        const tile = (word: string, id: string) => {
          const body = <AppText style={styles.pairWord}>{word}</AppText>;
          return onSpeakText ? (
            <Pressable
              accessibilityHint={t('lessonPlayer.pattern_speak_hint')}
              accessibilityLabel={t('lessonPlayer.pattern_speak', {
                text: word,
              })}
              accessibilityRole="button"
              onPress={() => onSpeakText(word)}
              style={({pressed}) => [
                styles.pairTile,
                pressed ? styles.pressed : null,
              ]}
              testID={id}
            >
              <MaterialIcon
                color={theme.colors.onSecondaryContainer}
                name="volume_up"
                size={16}
              />
              {body}
            </Pressable>
          ) : (
            <View style={styles.pairTile}>{body}</View>
          );
        };
        return (
          <View key={entry.key} style={styles.card} testID={testID}>
            <View style={styles.head}>
              <View style={styles.sound}>
                <AppText
                  adjustsFontSizeToFit
                  numberOfLines={1}
                  style={[
                    styles.soundText,
                    sound.length > 3 ? styles.soundTextSmall : null,
                  ]}
                >
                  {sound}
                </AppText>
              </View>
              <View style={styles.headText}>
                <StudyLabel color={HERO_PALETTE.coralShelf}>
                  {t('lessonPlayer.pronunciation_point', {
                    index: entryIndex + 1,
                    label: t('lessonPlayer.pronunciation_focus'),
                  })}
                </StudyLabel>
                <AppText style={styles.word}>{entry.text}</AppText>
                <AppText color="muted" variant="caption">
                  {entry.focusIpa && entry.focusIpa !== entry.focus
                    ? `${entry.focus} · ${entry.meaningVi}`
                    : entry.meaningVi}
                </AppText>
              </View>
              {onSpeakText ? (
                <SpeakSquare
                  accessibilityHint={t('lessonPlayer.pattern_speak_hint')}
                  accessibilityLabel={t('lessonPlayer.pattern_speak', {
                    text: entry.text,
                  })}
                  onPress={() => onSpeakText(entry.text)}
                  testID={`${testID}-speak`}
                />
              ) : null}
            </View>

            {canPractise ? (
              <AppButton
                accessibilityHint={t('pronunciation.practice_hint', {
                  text: entry.text,
                })}
                iconLeft="mic"
                onPress={() =>
                  setPractising({itemId: entry.itemId, text: entry.text})
                }
                testID={`${testID}-practice`}
                title={t('pronunciation.practice_button')}
                variant="secondary"
              />
            ) : null}

            <View style={styles.tip}>
              <MaterialIcon
                color={theme.colors.onTertiaryContainer}
                name="tips_and_updates"
                size={18}
              />
              <AppText style={styles.tipText}>
                <AppText style={styles.tipLabel}>
                  {`${t('lessonPlayer.pronunciation_tip')}  `}
                </AppText>
                {entry.tipVi}
              </AppText>
            </View>

            {entry.minimalPairs.length > 0 ? (
              <View style={styles.block}>
                <StudyLabel>
                  {onSpeakText
                    ? t('lessonPlayer.pronunciation_pairs_tap')
                    : t('lessonPlayer.pronunciation_pairs')}
                </StudyLabel>
                {entry.minimalPairs.map(([first, second], index) => (
                  <View key={`${first}-${second}`} style={styles.pair}>
                    {tile(first, `${testID}-pair-${index}-a`)}
                    <AppText color="muted" style={styles.vs}>
                      vs
                    </AppText>
                    {tile(second, `${testID}-pair-${index}-b`)}
                  </View>
                ))}
              </View>
            ) : null}

            {onSpeakText && entry.minimalPairs.some(isQuizablePair) ? (
              <MinimalPairQuiz
                onSpeakText={onSpeakText}
                pairs={entry.minimalPairs}
                testID={`${testID}-quiz`}
              />
            ) : null}

            {entry.examples.length > 0 ? (
              <View style={styles.block}>
                <StudyLabel>{t('lessonPlayer.pattern_examples')}</StudyLabel>
                {entry.examples.map((example, index) => (
                  <View key={`${index}-${example.en}`} style={styles.pair}>
                    <View style={styles.example}>
                      <AppText variant="bodyLg">{example.en}</AppText>
                      <AppText color="secondary">{example.vi}</AppText>
                    </View>
                    {onSpeakText ? (
                      <SpeakSquare
                        accessibilityHint={t('lessonPlayer.pattern_speak_hint')}
                        accessibilityLabel={t('lessonPlayer.pattern_speak', {
                          text: example.en,
                        })}
                        onPress={() => onSpeakText(example.en)}
                        testID={`${testID}-example-${index}`}
                      />
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        );
      })}
      <PronunciationPracticeSheet
        item={practising}
        onClose={() => setPractising(null)}
        onSpeakText={onSpeakText}
      />
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    empty: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
    },
    list: {
      gap: 16,
    },
    card: {
      ...studyCardStyle(theme),
      gap: 12,
      padding: 16,
    },
    head: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 12,
    },
    sound: {
      alignItems: 'center',
      backgroundColor: HERO_PALETTE.coral,
      borderRadius: 20,
      height: 60,
      justifyContent: 'center',
      paddingHorizontal: 6,
      width: 60,
      ...getStickerEdge(4, HERO_PALETTE.coralShelf),
    },
    soundText: {
      color: HERO_PALETTE.white,
      fontSize: 26,
      fontWeight: '700',
    },
    soundTextSmall: {
      fontSize: 18,
    },
    headText: {
      flex: 1,
      gap: 1,
    },
    word: {
      color: theme.colors.text.primary,
      fontSize: 22,
      fontWeight: '800',
    },
    tip: {
      backgroundColor: theme.colors.tertiarySoft,
      borderRadius: 16,
      flexDirection: 'row',
      gap: 10,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    tipText: {
      color: theme.colors.text.primary,
      flex: 1,
      fontSize: 14,
      lineHeight: 20,
    },
    tipLabel: {
      color: theme.colors.onTertiaryContainer,
      fontWeight: '800',
    },
    block: {
      gap: 8,
    },
    pair: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    pairTile: {
      alignItems: 'center',
      backgroundColor: solidOver(
        theme.colors.secondarySoft,
        theme.colors.surface,
      ),
      borderRadius: 16,
      flex: 1,
      flexDirection: 'row',
      gap: 6,
      justifyContent: 'center',
      minHeight: 52,
      paddingHorizontal: 8,
      ...getStickerEdge(3, HERO_PALETTE.coralRing),
    },
    pairWord: {
      color: theme.colors.onSecondaryContainer,
      fontSize: 17,
      fontWeight: '800',
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    vs: {
      fontSize: 12,
      fontWeight: '700',
    },
    example: {
      flex: 1,
      gap: 2,
    },
  });
}
