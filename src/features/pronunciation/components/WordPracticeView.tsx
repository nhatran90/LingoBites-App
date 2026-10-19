import React from 'react';

import {WriteWordPanel} from '@ui/components/WriteWordPanel';

import type {WordPractice} from '../logic/useWordPractice';
import {SpeakWordPanel} from './SpeakWordPanel';

type Props = {
  practice: WordPractice;
  /** After the practice closes ("Huỷ", "Xem lại thẻ"); the card shows again. */
  onDone?: () => void;
  /** Reads text aloud (the screen's TTS); omitted = no listen buttons. */
  onSpeak?: (text: string, rate?: number) => void;
  /** Prefix of the panels' testIDs: `<testID>-write`, `<testID>-speak`. */
  testID: string;
};

/**
 * The open practice of a word card, in place of the card: the "Viết từ"
 * tile keyboard or the "Đọc từ" recorder. Nothing while the card shows.
 */
export function WordPracticeView({practice, onDone, onSpeak, testID}: Props) {
  const {card} = practice;
  if (!card) return null;
  const done = () => {
    practice.close();
    onDone?.();
  };
  if (practice.mode === 'write') {
    return (
      <WriteWordPanel
        ipa={card.ipa}
        key={card.key}
        meaningVi={card.meaningVi ?? ''}
        onDone={done}
        testID={`${testID}-write`}
        word={card.text}
      />
    );
  }
  if (practice.mode === 'speak' && practice.speakTarget) {
    return (
      <SpeakWordPanel
        ipa={card.ipa}
        key={card.key}
        meaningVi={card.meaningVi}
        onDone={done}
        onSpeak={onSpeak}
        target={practice.speakTarget}
        testID={`${testID}-speak`}
        text={card.text}
      />
    );
  }
  return null;
}
