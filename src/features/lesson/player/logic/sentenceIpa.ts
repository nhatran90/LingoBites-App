import type {AnalysisVocabularyItem} from '@core/schemas/lesson';

/**
 * IPA display helpers for the YouTube study card.
 *
 * Stored IPA marks primary stress with an ASCII apostrophe (`t'ɔs`) and
 * secondary stress with a comma (`d,eɪ`); the cards show the standard marks
 * (`tˈɔs`, `dˌeɪ`) and pair each word with its own transcription so it can
 * sit right under the word. The whole-sentence IPA line is never shown.
 */

export type WordWithIpa = {
  word: string;
  ipa: string | null;
};

/** Standard stress marks and single spaces; transcription is unchanged. */
export function normalizeIpa(ipa: string): string {
  return ipa
    .replace(/['’]/g, 'ˈ')
    .replace(/,/g, 'ˌ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Sentence split into words as written (punctuation stays on the word). */
export function splitSentenceWords(text: string): string[] {
  const trimmed = text.trim();
  return trimmed.length === 0 ? [] : trimmed.split(/\s+/);
}

/**
 * How many IPA tokens the server wrote for one written word. Mirrors the
 * server's `tokenizeForIpa` (`[a-z']+` on the lower-cased text): "10" and
 * "—" get none, "ring-toss" and "U.S." get two.
 */
export function ipaTokenCount(word: string): number {
  return word.toLowerCase().match(/[a-z']+/g)?.length ?? 0;
}

/**
 * Each word with its own IPA, or null when the sentence IPA cannot be
 * split over the words (then no IPA is shown at all). Words the server
 * gave several tokens keep them together ("ring-toss" -> "ɹˈɪŋ-tˈɔs");
 * words it skipped ("10", "—") get null.
 */
export function pairWordsWithIpa(
  text: string,
  ipa: string | null | undefined,
): WordWithIpa[] | null {
  const words = splitSentenceWords(text);
  const tokens = ipa ? normalizeIpa(ipa).split(' ').filter(Boolean) : [];
  if (words.length === 0 || tokens.length === 0) {
    return null;
  }
  const counts = words.map(ipaTokenCount);
  if (counts.reduce((sum, count) => sum + count, 0) === tokens.length) {
    let next = 0;
    return words.map((word, index) => {
      const own = tokens.slice(next, next + counts[index]);
      next += counts[index];
      return {
        word,
        ipa: own.length === 0 ? null : own.join(word.includes('-') ? '-' : ' '),
      };
    });
  }
  // IPA written one token per word (older or hand-edited lessons).
  if (words.length === tokens.length) {
    return words.map((word, index) => ({word, ipa: tokens[index]}));
  }
  return null;
}

/** Lower-case word without the punctuation around it ("Teams." -> "teams"). */
export function wordLookupKey(word: string): string {
  return word
    .toLowerCase()
    .replace(/’/g, "'")
    .replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

/**
 * The analysed vocabulary entry for a tapped word: an exact match first,
 * else an entry the word is an inflection of ("teams" -> "team").
 */
export function findVocabularyForWord(
  word: string,
  vocabulary: readonly AnalysisVocabularyItem[],
): AnalysisVocabularyItem | null {
  const key = wordLookupKey(word);
  if (key.length === 0) return null;
  const exact = vocabulary.find(item => wordLookupKey(item.word) === key);
  if (exact) return exact;
  return (
    vocabulary.find(item => {
      const base = wordLookupKey(item.word);
      return (
        base.length >= 3 &&
        key.startsWith(base) &&
        key.length - base.length <= 3
      );
    }) ?? null
  );
}

/** The word as written, without the punctuation around it ("Teams." -> "Teams"). */
export function bareWord(word: string): string {
  return word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, '');
}

/** IPA without wrapping slashes or brackets ("/tim/" -> "tim"). */
export function stripIpaDelimiters(ipa: string): string {
  return ipa.trim().replace(/^[/[]+|[/\]]+$/g, '');
}
