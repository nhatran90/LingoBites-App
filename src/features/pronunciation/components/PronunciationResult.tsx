import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {
  PronunciationAttempt,
  PronunciationWord,
} from '@core/schemas/pronunciation';

import {
  addedWordCount,
  bandOf,
  referenceWords,
  type ScoreBand,
  summaryKey,
  type WordMark,
  wordMark,
} from '../logic/scoreBands';

/**
 * Pronunciation step 3: the scores of one reading. The overall score and a
 * one-line comment on top, then the sentence word by word: each word is
 * coloured by its band (and underlined when it needs work, so colour is
 * never the only cue); tapping one lists its sounds. Words the learner left
 * out are struck through; added words are only counted, as the Server never
 * sends what the learner said.
 */
export function PronunciationResult({
  attempt,
}: {
  attempt: PronunciationAttempt;
}) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [openIndex, setOpenIndex] = useState<number | null>(null);
  const words = referenceWords(attempt.words);
  const added = addedWordCount(attempt.words);
  const scores = attempt.scores;
  const overall = scores?.pron ?? scores?.accuracy ?? null;
  const open = openIndex === null ? null : (words[openIndex] ?? null);

  return (
    <View style={styles.body} testID="pronunciation-result">
      <View style={styles.summary}>
        <View
          accessibilityHint={t(summaryKey(overall))}
          accessibilityLabel={t('pronunciation.score_a11y', {
            score: overall ?? 0,
          })}
          accessible
          style={[styles.score, bandFill(theme, bandOf(overall))]}
          testID="pronunciation-result-score"
        >
          <AppText style={styles.scoreText}>{overall ?? '–'}</AppText>
        </View>
        <View style={styles.summaryText}>
          <AppText color="secondary" variant="caption">
            {t('pronunciation.score_label')}
          </AppText>
          <AppText testID="pronunciation-result-summary" variant="label">
            {t(summaryKey(overall))}
          </AppText>
          {scores ? (
            <AppText color="muted" variant="caption">
              {t('pronunciation.detail_scores', {
                accuracy: scores.accuracy ?? '–',
                fluency: scores.fluency ?? '–',
                completeness: scores.completeness ?? '–',
              })}
            </AppText>
          ) : null}
        </View>
      </View>

      <AppText color="muted" variant="caption">
        {t('pronunciation.words_hint')}
      </AppText>
      <View style={styles.words}>
        {words.map((word, index) => {
          const mark = wordMark(word);
          const label = word.text ?? '';
          return (
            <Pressable
              accessibilityHint={t('pronunciation.words_hint')}
              accessibilityLabel={
                mark === 'omitted'
                  ? t('pronunciation.word_omitted_a11y', {word: label})
                  : t('pronunciation.word_a11y', {
                      word: label,
                      score: word.accuracy ?? 0,
                    })
              }
              accessibilityRole="button"
              accessibilityState={{expanded: openIndex === index}}
              key={`${index}-${label}`}
              onPress={() =>
                setOpenIndex(current => (current === index ? null : index))
              }
              style={[
                styles.word,
                wordFill(theme, mark),
                openIndex === index ? styles.wordOpen : null,
              ]}
              testID={`pronunciation-word-${index}`}
            >
              <AppText
                style={[
                  styles.wordText,
                  mark === 'omitted' ? styles.omittedText : null,
                  mark === 'poor' ? styles.poorText : null,
                ]}
                testID={`pronunciation-word-${index}-${mark}`}
              >
                {label}
              </AppText>
              {mark === 'omitted' ? (
                <AppText color="muted" variant="caption">
                  {t('pronunciation.word_omitted')}
                </AppText>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {open ? <Sounds styles={styles} word={open} /> : null}

      {added > 0 ? (
        <AppText color="secondary" testID="pronunciation-result-added">
          {t('pronunciation.added_words', {count: added})}
        </AppText>
      ) : null}
    </View>
  );
}

function Sounds({
  word,
  styles,
}: {
  word: PronunciationWord;
  styles: ReturnType<typeof makeStyles>;
}) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  if (word.phonemes.length === 0) return null;
  return (
    <View style={styles.sounds} testID="pronunciation-sounds">
      <AppText variant="label">
        {t('pronunciation.sounds_title', {word: word.text ?? ''})}
      </AppText>
      <View style={styles.soundRow}>
        {word.phonemes.map((phoneme, index) => {
          const band = bandOf(phoneme.accuracy) ?? 'poor';
          return (
            <View
              accessibilityHint={t('pronunciation.sounds_title', {
                word: word.text ?? '',
              })}
              accessibilityLabel={t('pronunciation.sound_a11y', {
                ipa: phoneme.ipa,
                score: phoneme.accuracy ?? 0,
              })}
              accessible
              key={`${index}-${phoneme.ipa}`}
              style={[styles.sound, bandFill(theme, band)]}
              testID={`pronunciation-sound-${index}-${band}`}
            >
              <AppText style={styles.soundIpa}>{phoneme.ipa}</AppText>
              <AppText variant="caption">{phoneme.accuracy ?? '–'}</AppText>
            </View>
          );
        })}
      </View>
    </View>
  );
}

/** Background and border of a band; the app's quiz colours (good = accent). */
function bandFill(theme: AppTheme, band: ScoreBand | null) {
  switch (band) {
    case 'good':
      return {
        backgroundColor: theme.colors.accentSoft,
        borderColor: theme.colors.accent,
      };
    case 'fair':
      return {
        backgroundColor: theme.colors.tertiarySoft,
        borderColor: theme.colors.tertiaryBorder,
      };
    case 'poor':
      return {
        backgroundColor: theme.colors.secondarySoft,
        borderColor: theme.colors.secondaryContainer,
      };
    default:
      return {
        backgroundColor: theme.colors.surfaceMuted,
        borderColor: theme.colors.outlineVariant,
      };
  }
}

function wordFill(theme: AppTheme, mark: WordMark) {
  return mark === 'omitted'
    ? {
        backgroundColor: theme.colors.surfaceMuted,
        borderColor: theme.colors.outlineVariant,
      }
    : bandFill(theme, mark);
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    body: {
      gap: theme.spacing.md,
    },
    summary: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    score: {
      alignItems: 'center',
      borderRadius: 36,
      borderWidth: 3,
      height: 72,
      justifyContent: 'center',
      width: 72,
    },
    scoreText: {
      color: theme.colors.text.primary,
      fontSize: 28,
      fontWeight: '800',
    },
    summaryText: {
      flex: 1,
      gap: 2,
    },
    words: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    word: {
      alignItems: 'center',
      borderRadius: theme.radius.md,
      borderWidth: 2,
      minHeight: 44,
      justifyContent: 'center',
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.xs,
    },
    wordOpen: {
      borderColor: theme.colors.primary,
    },
    wordText: {
      color: theme.colors.text.primary,
      fontSize: 18,
      fontWeight: '700',
    },
    omittedText: {
      color: theme.colors.text.muted,
      textDecorationLine: 'line-through',
    },
    poorText: {
      textDecorationLine: 'underline',
      textDecorationStyle: 'solid',
    },
    sounds: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
    },
    soundRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    sound: {
      alignItems: 'center',
      borderRadius: theme.radius.md,
      borderWidth: 2,
      minWidth: 48,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: theme.spacing.xs,
    },
    soundIpa: {
      color: theme.colors.text.primary,
      fontSize: 20,
      fontWeight: '700',
    },
  });
}
