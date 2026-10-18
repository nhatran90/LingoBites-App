import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';

import type {
  PronunciationAttempt,
  PronunciationWord,
} from '@core/schemas/pronunciation';

import {
  addedWordCount,
  bandOf,
  referenceWords,
  type ScoreBand,
  soundsToFix,
  weakestSound,
  type WordMark,
  wordMark,
} from '../logic/scoreBands';

type Props = {
  attempt: PronunciationAttempt;
  /** Reads a word slowly (the screen's TTS); omitted = no listen button. */
  onListenSlow?: (word: string) => void;
};

/**
 * The scores of a card read aloud, made to be read at a glance: the overall
 * score and a short verdict, then the one sound to fix first, then each
 * sound in reading order as a bar with a word label (Tốt / Khá / Cần sửa),
 * so the learner never has to interpret a number. A sentence shows its
 * words as chips first; tapping one lists that word's sounds.
 */
export function SpeakResult({attempt, onListenSlow}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const words = referenceWords(attempt.words);
  const weakest = weakestSound(attempt.words);
  const sentence = words.length > 1;
  const [openIndex, setOpenIndex] = useState(weakest?.wordIndex ?? 0);
  const open = words[openIndex] ?? null;
  const overall = attempt.scores?.pron ?? attempt.scores?.accuracy ?? null;
  const band = bandOf(overall);
  const added = addedWordCount(attempt.words);

  return (
    <View style={styles.body} testID="speak-result">
      <View style={styles.summary}>
        <View
          accessibilityHint={t('speakWord.words_hint')}
          accessibilityLabel={t('pronunciation.score_a11y', {
            score: overall ?? 0,
          })}
          accessible
          style={[styles.ring, {borderColor: ringColor(theme, band)}]}
          testID={`speak-result-score-${band ?? 'none'}`}
        >
          <AppText style={[styles.ringText, {color: inkOf(theme, band)}]}>
            {overall ?? '–'}
          </AppText>
        </View>
        <View style={styles.flex}>
          {sentence ? (
            <AppText variant="label">
              {t(`speakWord.band_${band ?? 'poor'}`)}
            </AppText>
          ) : (
            <AppText style={styles.wordTitle}>{words[0]?.text ?? ''}</AppText>
          )}
          <AppText color="secondary" testID="speak-result-summary">
            {summaryLine(t, words, sentence, band)}
          </AppText>
        </View>
      </View>

      {weakest ? (
        <View
          style={[styles.weakest, fillOf(theme, weakest.band)]}
          testID="speak-result-weakest"
        >
          <View style={styles.weakestIpa}>
            <AppText
              style={[styles.ipaBig, {color: inkOf(theme, weakest.band)}]}
            >
              {`/${weakest.ipa}/`}
            </AppText>
          </View>
          <View style={styles.flex}>
            <AppText
              style={{color: inkOf(theme, weakest.band)}}
              variant="label"
            >
              {t(
                weakest.band === 'poor'
                  ? 'speakWord.weakest_title'
                  : 'speakWord.weakest_title_fair',
              )}
            </AppText>
            <AppText
              style={{color: inkOf(theme, weakest.band)}}
              variant="caption"
            >
              {sentence
                ? t('speakWord.weakest_in_word', {
                    word: weakest.word,
                    score: weakest.accuracy,
                  })
                : t('speakWord.weakest_score', {score: weakest.accuracy})}
            </AppText>
          </View>
          {onListenSlow ? (
            <Pressable
              accessibilityHint={t('speakWord.listen_slow_hint')}
              accessibilityLabel={t('speakWord.listen_slow', {
                word: weakest.word,
              })}
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => onListenSlow(weakest.word)}
              style={styles.listen}
              testID="speak-result-listen-slow"
            >
              <MaterialIcon
                color={inkOf(theme, weakest.band)}
                name="volume_up"
                size={22}
              />
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {sentence ? (
        <View style={styles.block}>
          <AppText color="secondary" variant="caption">
            {t('speakWord.words_hint')}
          </AppText>
          <View style={styles.chips}>
            {words.map((word, index) => (
              <WordChip
                key={`${index}-${word.text ?? ''}`}
                index={index}
                onPress={() => setOpenIndex(index)}
                open={index === openIndex}
                styles={styles}
                word={word}
              />
            ))}
          </View>
        </View>
      ) : null}

      {open ? (
        <SoundRows sentence={sentence} styles={styles} word={open} />
      ) : null}

      {added > 0 ? (
        <AppText color="secondary" testID="speak-result-added">
          {t('pronunciation.added_words', {count: added})}
        </AppText>
      ) : null}
    </View>
  );
}

function summaryLine(
  t: (key: string, options?: Record<string, unknown>) => string,
  words: PronunciationWord[],
  sentence: boolean,
  band: ScoreBand | null,
): string {
  if (!sentence) {
    const count = words[0] ? soundsToFix(words[0]) : 0;
    return count > 0
      ? `${t(`speakWord.band_${band ?? 'poor'}`)} ${t('speakWord.sounds_to_fix', {count})}`
      : t('pronunciation.summary_good');
  }
  const marks = words.map(wordMark);
  const toFix = marks.filter(mark => mark === 'poor').length;
  const omitted = marks.filter(mark => mark === 'omitted').length;
  const parts = [
    toFix > 0 ? t('speakWord.words_to_fix', {count: toFix}) : null,
    omitted > 0 ? t('speakWord.words_omitted', {count: omitted}) : null,
  ].filter(Boolean);
  return parts.length > 0
    ? `${parts.join(', ')}.`
    : t('speakWord.words_all_good');
}

function WordChip({
  word,
  index,
  open,
  onPress,
  styles,
}: {
  word: PronunciationWord;
  index: number;
  open: boolean;
  onPress: () => void;
  styles: ReturnType<typeof makeStyles>;
}) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const mark = wordMark(word);
  const text = word.text ?? '';
  const omitted = mark === 'omitted';
  return (
    <Pressable
      accessibilityHint={t('speakWord.words_hint')}
      accessibilityLabel={
        omitted
          ? t('pronunciation.word_omitted_a11y', {word: text})
          : t('pronunciation.word_a11y', {
              word: text,
              score: word.accuracy ?? 0,
            })
      }
      accessibilityRole="button"
      accessibilityState={{selected: open}}
      onPress={onPress}
      style={[
        styles.chip,
        omitted ? styles.chipOmitted : chipFill(theme, mark),
        open ? {borderColor: inkOf(theme, omitted ? null : mark)} : null,
      ]}
      testID={`speak-word-${index}-${mark}`}
    >
      <AppText
        style={[
          styles.chipText,
          {color: omitted ? theme.colors.text.muted : inkOf(theme, mark)},
          omitted ? styles.struck : null,
          mark === 'poor' ? styles.underline : null,
        ]}
      >
        {text}
      </AppText>
      <AppText
        style={[
          styles.chipLabel,
          {color: omitted ? theme.colors.text.muted : inkOf(theme, mark)},
        ]}
      >
        {omitted ? t('pronunciation.word_omitted') : labelOf(t, mark)}
      </AppText>
    </Pressable>
  );
}

function SoundRows({
  word,
  sentence,
  styles,
}: {
  word: PronunciationWord;
  sentence: boolean;
  styles: ReturnType<typeof makeStyles>;
}) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const text = word.text ?? '';
  if (word.error === 'omission') {
    return (
      <View style={styles.sounds} testID="speak-sounds-omitted">
        <AppText color="secondary">
          {t('speakWord.word_not_read', {word: text})}
        </AppText>
      </View>
    );
  }
  if (word.phonemes.length === 0) return null;
  return (
    <View style={sentence ? styles.sounds : styles.block} testID="speak-sounds">
      <AppText color="secondary" variant="label">
        {sentence
          ? t('pronunciation.sounds_title', {word: text})
          : t('speakWord.sounds_in_order')}
      </AppText>
      {word.phonemes.map((phoneme, index) => {
        const band = bandOf(phoneme.accuracy) ?? 'poor';
        return (
          <View
            accessibilityHint={t('speakWord.sounds_in_order')}
            accessibilityLabel={t('pronunciation.sound_a11y', {
              ipa: phoneme.ipa,
              score: phoneme.accuracy ?? 0,
            })}
            accessible
            key={`${index}-${phoneme.ipa}`}
            style={[
              styles.soundRow,
              band === 'poor' ? styles.soundRowPoor : null,
            ]}
            testID={`speak-sound-${index}-${band}`}
          >
            <AppText
              style={[
                styles.soundIpa,
                band === 'poor' ? {color: inkOf(theme, band)} : null,
                band === 'poor' ? styles.underline : null,
              ]}
            >
              {`/${phoneme.ipa}/`}
            </AppText>
            <View style={styles.track}>
              <View
                style={[
                  styles.fill,
                  {
                    backgroundColor: barColor(theme, band),
                    width: `${Math.max(4, phoneme.accuracy ?? 0)}%`,
                  },
                ]}
              />
            </View>
            <AppText style={[styles.soundLabel, {color: inkOf(theme, band)}]}>
              {labelOf(t, band)}
            </AppText>
          </View>
        );
      })}
    </View>
  );
}

function labelOf(
  t: (key: string) => string,
  mark: WordMark | ScoreBand,
): string {
  switch (mark) {
    case 'good':
      return `✓ ${t('speakWord.label_good')}`;
    case 'fair':
      return t('speakWord.label_fair');
    case 'poor':
      return `! ${t('speakWord.label_poor')}`;
    default:
      return t('pronunciation.word_omitted');
  }
}

/** Text colour of a band: the app's quiz colours (good = accent). */
function inkOf(theme: AppTheme, band: WordMark | ScoreBand | null): string {
  switch (band) {
    case 'good':
      return theme.colors.accentInk;
    case 'fair':
      return theme.colors.onTertiaryContainer;
    case 'poor':
      return theme.colors.secondary;
    default:
      return theme.colors.text.secondary;
  }
}

function fillOf(theme: AppTheme, band: ScoreBand) {
  return {
    backgroundColor:
      band === 'good'
        ? theme.colors.accentSoft
        : band === 'fair'
          ? theme.colors.tertiarySoft
          : theme.colors.secondarySoft,
  };
}

function chipFill(theme: AppTheme, mark: WordMark) {
  return mark === 'omitted' ? {} : fillOf(theme, mark);
}

function ringColor(theme: AppTheme, band: ScoreBand | null): string {
  switch (band) {
    case 'good':
      return theme.colors.accent;
    case 'fair':
      return theme.colors.tertiaryContainer;
    case 'poor':
      return theme.colors.secondaryContainer;
    default:
      return theme.colors.outlineVariant;
  }
}

function barColor(theme: AppTheme, band: ScoreBand): string {
  switch (band) {
    case 'good':
      return theme.colors.accent;
    case 'fair':
      return theme.colors.tertiaryContainer;
    default:
      return theme.colors.secondary;
  }
}

function makeStyles(theme: AppTheme) {
  const {colors, spacing} = theme;
  return StyleSheet.create({
    body: {
      gap: spacing.md,
    },
    block: {
      gap: spacing.sm,
    },
    flex: {
      flex: 1,
      gap: 2,
    },
    summary: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: spacing.md,
    },
    ring: {
      alignItems: 'center',
      borderRadius: 36,
      borderWidth: 6,
      height: 72,
      justifyContent: 'center',
      width: 72,
    },
    ringText: {
      fontSize: 26,
      fontWeight: '800',
    },
    wordTitle: {
      color: colors.text.primary,
      fontSize: 26,
      fontWeight: '800',
    },
    weakest: {
      alignItems: 'center',
      borderRadius: theme.radius.md,
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.md,
    },
    weakestIpa: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: theme.radius.sm,
      justifyContent: 'center',
      minHeight: 44,
      minWidth: 52,
      paddingHorizontal: spacing.sm,
    },
    ipaBig: {
      fontSize: 22,
      fontWeight: '800',
    },
    listen: {
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 22,
      height: 44,
      justifyContent: 'center',
      width: 44,
      ...getStickerEdge(4, colors.outlineVariant),
    },
    chips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      alignItems: 'center',
      borderColor: colors.surface,
      borderRadius: 16,
      borderWidth: 3,
      justifyContent: 'center',
      minHeight: 52,
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
    },
    chipOmitted: {
      backgroundColor: colors.surfaceMuted,
      borderColor: colors.outline,
      borderStyle: 'dashed',
      borderWidth: 2,
    },
    chipText: {
      fontSize: 18,
      fontWeight: '800',
    },
    chipLabel: {
      fontSize: 11,
      fontWeight: '800',
    },
    struck: {
      textDecorationLine: 'line-through',
    },
    underline: {
      textDecorationLine: 'underline',
    },
    sounds: {
      backgroundColor: colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      gap: spacing.xs,
      padding: spacing.md,
    },
    soundRow: {
      alignItems: 'center',
      borderRadius: theme.radius.sm,
      flexDirection: 'row',
      gap: spacing.sm,
      minHeight: 34,
      paddingHorizontal: spacing.xs,
    },
    soundRowPoor: {
      backgroundColor: colors.secondarySoft,
    },
    soundIpa: {
      color: colors.text.primary,
      fontSize: 18,
      fontWeight: '800',
      minWidth: 48,
      textAlign: 'center',
    },
    track: {
      backgroundColor: colors.surfaceContainer,
      borderRadius: 5,
      flex: 1,
      height: 10,
      overflow: 'hidden',
    },
    fill: {
      borderRadius: 5,
      height: '100%',
    },
    soundLabel: {
      fontSize: 13,
      fontWeight: '800',
      minWidth: 72,
      textAlign: 'right',
    },
  });
}
