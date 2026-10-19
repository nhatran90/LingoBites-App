import React from 'react';
import {StyleSheet, View} from 'react-native';

import {WriteWordButton} from '@ui/components/WriteWordButton';

import type {WordPractice} from '../logic/useWordPractice';
import {SpeakWordButton} from './SpeakWordButton';

type Props = {
  practice: WordPractice;
  /** Prefix of the testIDs: `<testID>-write` and `<testID>-speak`. */
  testID: string;
};

/**
 * The practice row under a word card: "Viết từ" and "Đọc từ" side by side,
 * or the one the card offers across the row. Nothing while a practice is
 * open or when the card offers neither.
 */
export function WordPracticeBar({practice, testID}: Props) {
  const {card} = practice;
  if (!card || practice.practising) return null;
  if (!practice.canWrite && !practice.canSpeak) return null;
  return (
    <View style={styles.row} testID={testID}>
      {practice.canWrite ? (
        <WriteWordButton
          onPress={practice.openWrite}
          testID={`${testID}-write`}
          text={card.text}
        />
      ) : null}
      {practice.canSpeak ? (
        <SpeakWordButton
          locked={practice.speakLocked}
          onPress={practice.openSpeak}
          testID={`${testID}-speak`}
          text={card.text}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 12,
  },
});
