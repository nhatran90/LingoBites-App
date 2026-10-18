import type {PronunciationWord} from '@core/schemas/pronunciation';

import {
  addedWordCount,
  bandOf,
  referenceWords,
  summaryKey,
  unscorableKey,
  wordMark,
} from '../scoreBands';

function word(
  accuracy: number | null,
  error: PronunciationWord['error'] = 'none',
): PronunciationWord {
  return {
    text: error === 'insertion' ? null : 'ship',
    accuracy,
    error,
    phonemes: [],
  };
}

describe('scoreBands', () => {
  it('bands scores at 80 and 60', () => {
    expect(bandOf(100)).toBe('good');
    expect(bandOf(80)).toBe('good');
    expect(bandOf(79)).toBe('fair');
    expect(bandOf(60)).toBe('fair');
    expect(bandOf(59)).toBe('poor');
    expect(bandOf(0)).toBe('poor');
    expect(bandOf(null)).toBeNull();
  });

  it('marks words by band, a skipped word as omitted', () => {
    expect(wordMark(word(95))).toBe('good');
    expect(wordMark(word(65))).toBe('fair');
    expect(wordMark(word(30, 'mispronunciation'))).toBe('poor');
    expect(wordMark(word(0, 'omission'))).toBe('omitted');
    expect(wordMark(word(null))).toBe('poor');
    // A word Azure calls mispronounced is never shown as good.
    expect(wordMark(word(85, 'mispronunciation'))).toBe('fair');
  });

  it('keeps added words out of the sentence and counts them', () => {
    const words = [
      word(90),
      word(0, 'insertion'),
      word(70),
      word(0, 'insertion'),
    ];
    expect(referenceWords(words)).toHaveLength(2);
    expect(addedWordCount(words)).toBe(2);
    expect(addedWordCount([word(90)])).toBe(0);
  });

  it('names the i18n keys of the comment and of an unscorable reading', () => {
    expect(summaryKey(92)).toBe('pronunciation.summary_good');
    expect(summaryKey(70)).toBe('pronunciation.summary_fair');
    expect(summaryKey(40)).toBe('pronunciation.summary_poor');
    expect(summaryKey(null)).toBe('pronunciation.summary_poor');
    expect(unscorableKey('no_speech')).toBe(
      'pronunciation.unscorable_no_speech',
    );
  });
});
