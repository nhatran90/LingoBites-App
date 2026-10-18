import React, {useMemo} from 'react';
import {type StyleProp, StyleSheet, type TextStyle, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {pairWordsWithIpa, splitSentenceWords} from '../logic/sentenceIpa';

export type InterlinearSentenceProps = {
  text: string;
  /** Sentence IPA as stored; shown word by word, never as one line. */
  ipa: string | null | undefined;
  /** Hide the IPA and show only the words. */
  hideIpa?: boolean;
  /** Words lit so far (-1: none), e.g. while a sample plays. */
  highlightedWords?: number;
  wordStyle?: StyleProp<TextStyle>;
  litStyle?: StyleProp<TextStyle>;
  accessibilityHint?: string;
  testID?: string;
};

/**
 * A sentence with each word's IPA right under it. When the sentence IPA
 * cannot be split over the words, only the words are shown.
 */
export function InterlinearSentence({
  text,
  ipa,
  hideIpa = false,
  highlightedWords = -1,
  wordStyle,
  litStyle,
  accessibilityHint,
  testID,
}: InterlinearSentenceProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const pairs = useMemo(
    () => (hideIpa ? null : pairWordsWithIpa(text, ipa)),
    [hideIpa, ipa, text],
  );
  const words = useMemo(
    () => pairs ?? splitSentenceWords(text).map(word => ({word, ipa: null})),
    [pairs, text],
  );

  return (
    <View
      accessibilityHint={accessibilityHint}
      accessibilityLabel={text}
      accessible
      style={[styles.words, pairs ? styles.wordsInterlinear : null]}
      testID={testID}
    >
      {words.map((entry, index) => (
        <View key={`${index}-${entry.word}`} style={styles.word}>
          <AppText
            style={[wordStyle, index <= highlightedWords ? litStyle : null]}
          >
            {entry.word}
          </AppText>
          {entry.ipa ? (
            <AppText
              style={styles.wordIpa}
              testID={testID ? `${testID}-ipa-${index}` : undefined}
              variant="caption"
            >
              {entry.ipa}
            </AppText>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    word: {
      alignItems: 'center',
    },
    wordIpa: {
      color: theme.colors.primary,
      opacity: 0.85,
    },
    words: {
      columnGap: 6,
      flexDirection: 'row',
      flexWrap: 'wrap',
      rowGap: 2,
    },
    wordsInterlinear: {
      columnGap: theme.spacing.sm,
      rowGap: theme.spacing.sm,
    },
  });
}
