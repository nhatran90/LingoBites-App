/**
 * What a reading is scored against, and where it was made. The lesson's
 * pronunciation section reads a pronunciation item; pack and review cards
 * read their word, phrase or pattern item, or, for a saved word without
 * one, its own text. Each place has its own daily limit on the Server.
 */

export type ReadingSource =
  'lesson' | 'pack' | 'review_word' | 'review_sentence';

export type ReadingTarget =
  | {source: ReadingSource; itemId: string}
  | {source: ReadingSource; referenceText: string};

/** Server `PRONUNCIATION_REFERENCE_TEXT_MAX`. */
export const REFERENCE_TEXT_MAX = 120;

const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * A card text the Server can score: short, plain letters and punctuation
 * (Server `PronunciationReferenceTextSchema`), and no pattern slots.
 */
export function canSpeakText(text: string): boolean {
  const trimmed = text.trim();
  return (
    trimmed.length > 0 &&
    trimmed.length <= REFERENCE_TEXT_MAX &&
    /^[\p{L}\p{N}\s'’.,!?;:-]+$/u.test(trimmed) &&
    /\p{L}/u.test(trimmed)
  );
}

/** One word reads "Nói từ"; anything longer is a sentence ("Nói câu"). */
export function isSentence(text: string): boolean {
  return text.trim().split(/\s+/).length > 1;
}

/**
 * The target of a pack or review card, or null when it cannot be read
 * aloud for scoring. Phrases and patterns count under the sentence review.
 */
export function cardReadingTarget(card: {
  place: 'pack' | 'review';
  text: string;
  itemId: string | null;
  kind: string | null;
}): ReadingTarget | null {
  if (!canSpeakText(card.text)) return null;
  const source: ReadingSource =
    card.place === 'pack'
      ? 'pack'
      : card.kind === 'phrase' || card.kind === 'pattern'
        ? 'review_sentence'
        : 'review_word';
  return card.itemId && GUID.test(card.itemId)
    ? {source, itemId: card.itemId}
    : {source, referenceText: card.text.trim()};
}

/** A key that changes with the target, for resetting a practice. */
export function readingTargetKey(target: ReadingTarget): string {
  return 'itemId' in target
    ? `${target.source}:item:${target.itemId}`
    : `${target.source}:text:${target.referenceText}`;
}
