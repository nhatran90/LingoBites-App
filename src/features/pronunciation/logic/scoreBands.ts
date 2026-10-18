import type {
  PronunciationUnscorableReason,
  PronunciationWord,
} from '@core/schemas/pronunciation';

/**
 * Pronunciation step 3: how a score reads to the learner. The thresholds
 * are a first guess, to be tuned with real readings in step 4.
 */

/** From this score a word or reading is good (green). */
export const GOOD_SCORE = 80;
/** From this score, below good, it is fair (amber); below it, poor (red). */
export const FAIR_SCORE = 60;

export type ScoreBand = 'good' | 'fair' | 'poor';

/** The band of a 0–100 score; null when there is no score. */
export function bandOf(score: number | null): ScoreBand | null {
  if (score === null) return null;
  if (score >= GOOD_SCORE) return 'good';
  if (score >= FAIR_SCORE) return 'fair';
  return 'poor';
}

/** How one reference word is shown: by its band, or as not read. */
export type WordMark = ScoreBand | 'omitted';

export function wordMark(word: PronunciationWord): WordMark {
  if (word.error === 'omission') return 'omitted';
  // A mispronounced word is never shown as good, whatever its score.
  const band = bandOf(word.accuracy) ?? 'poor';
  return word.error === 'mispronunciation' && band === 'good' ? 'fair' : band;
}

/** The reference words to show, in order; added words are counted apart. */
export function referenceWords(
  words: readonly PronunciationWord[],
): PronunciationWord[] {
  return words.filter(word => word.error !== 'insertion');
}

/** How many words the learner said that are not in the reference. */
export function addedWordCount(words: readonly PronunciationWord[]): number {
  return words.filter(word => word.error === 'insertion').length;
}

/** The i18n key of the one-line comment under the overall score. */
export function summaryKey(score: number | null): string {
  switch (bandOf(score)) {
    case 'good':
      return 'pronunciation.summary_good';
    case 'fair':
      return 'pronunciation.summary_fair';
    default:
      return 'pronunciation.summary_poor';
  }
}

/** The i18n key that says why a reading could not be scored. */
export function unscorableKey(reason: PronunciationUnscorableReason): string {
  return `pronunciation.unscorable_${reason}`;
}

/** The weakest sound of a reading: where to look first. */
export type WeakestSound = {
  /** Index among `referenceWords`. */
  wordIndex: number;
  word: string;
  ipa: string;
  accuracy: number;
  band: ScoreBand;
};

/**
 * The lowest-scored sound across the words read, or null when every sound
 * is good (or none has a score). Words left out have no sounds to compare.
 */
export function weakestSound(
  words: readonly PronunciationWord[],
): WeakestSound | null {
  let weakest: WeakestSound | null = null;
  referenceWords(words).forEach((word, wordIndex) => {
    if (word.error === 'omission') return;
    for (const phoneme of word.phonemes) {
      if (phoneme.accuracy === null) continue;
      if (weakest === null || phoneme.accuracy < weakest.accuracy) {
        weakest = {
          wordIndex,
          word: word.text ?? '',
          ipa: phoneme.ipa,
          accuracy: phoneme.accuracy,
          band: bandOf(phoneme.accuracy)!,
        };
      }
    }
  });
  const found = weakest as WeakestSound | null;
  return found && found.band !== 'good' ? found : null;
}

/** How many sounds of one word are below good. */
export function soundsToFix(word: PronunciationWord): number {
  return word.phonemes.filter(
    phoneme => (bandOf(phoneme.accuracy) ?? 'poor') !== 'good',
  ).length;
}
