import type {AnalysisVocabularyItem} from '@core/schemas/lesson';

import {
  findVocabularyForWord,
  ipaTokenCount,
  normalizeIpa,
  pairWordsWithIpa,
  wordLookupKey,
} from '../sentenceIpa';

function vocab(word: string): AnalysisVocabularyItem {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    word,
    pos: 'n.',
    ipa: `/${word}/`,
    meaning: `nghĩa ${word}`,
  };
}

describe('sentenceIpa', () => {
  it('turns apostrophe stress marks into the IPA stress mark', () => {
    expect(normalizeIpa("f'ɔɹ  tʌd'eɪz ")).toBe('fˈɔɹ tʌdˈeɪz');
    expect(normalizeIpa("j'ɛstɚd,eɪ")).toBe('jˈɛstɚdˌeɪ');
  });

  it('counts IPA tokens the way the server tokenizes words', () => {
    expect(ipaTokenCount('Yesterday,')).toBe(1);
    expect(ipaTokenCount('"We\'re')).toBe(1);
    expect(ipaTokenCount('ring-toss')).toBe(2);
    expect(ipaTokenCount('U.S.')).toBe(2);
    expect(ipaTokenCount('10')).toBe(0);
    expect(ipaTokenCount('—')).toBe(0);
  });

  it('pairs the screenshot sentence word by word', () => {
    const pairs = pairWordsWithIpa(
      'Yesterday, Coach Ben said, "We\'re having a ring toss game today."',
      "j'ɛstɚd,eɪ k'oʊtʃ b'ɛn s'ɛd w'iɹ h'ævɪŋ ʌ ɹ'ɪŋ t'ɔs g'eɪm tʌd'eɪ",
    );
    expect(pairs?.[0]).toEqual({word: 'Yesterday,', ipa: 'jˈɛstɚdˌeɪ'});
    expect(pairs?.[4]).toEqual({word: '"We\'re', ipa: 'wˈiɹ'});
    expect(pairs?.[10]).toEqual({word: 'today."', ipa: 'tʌdˈeɪ'});
  });

  it('keeps hyphenated words together and skips words without letters', () => {
    expect(
      pairWordsWithIpa('A ring-toss at 10 — fun!', "ʌ ɹ'ɪŋ t'ɔs 'æt f'ʌn"),
    ).toEqual([
      {word: 'A', ipa: 'ʌ'},
      {word: 'ring-toss', ipa: 'ɹˈɪŋ-tˈɔs'},
      {word: 'at', ipa: 'ˈæt'},
      {word: '10', ipa: null},
      {word: '—', ipa: null},
      {word: 'fun!', ipa: 'fˈʌn'},
    ]);
  });

  it('pairs each word with its IPA token when the counts match', () => {
    expect(
      pairWordsWithIpa("We'll play in two teams.", "w'il pl'eɪ ɪn t'u t'imz"),
    ).toEqual([
      {word: "We'll", ipa: 'wˈil'},
      {word: 'play', ipa: 'plˈeɪ'},
      {word: 'in', ipa: 'ɪn'},
      {word: 'two', ipa: 'tˈu'},
      {word: 'teams.', ipa: 'tˈimz'},
    ]);
  });

  it('falls back to one token per written word', () => {
    expect(pairWordsWithIpa('Call 911', "k'ɔl n'aɪn")).toEqual([
      {word: 'Call', ipa: 'kˈɔl'},
      {word: '911', ipa: 'nˈaɪn'},
    ]);
  });

  it('returns null when the counts differ or IPA is missing', () => {
    expect(pairWordsWithIpa('Sentence 1 en.', 'ipa-1')).toBeNull();
    expect(pairWordsWithIpa('Hello there', 'a b c')).toBeNull();
    expect(pairWordsWithIpa('Hello', null)).toBeNull();
    expect(pairWordsWithIpa('', 'a')).toBeNull();
  });

  it('strips surrounding punctuation for lookup', () => {
    expect(wordLookupKey('“Teams.”')).toBe('teams');
    expect(wordLookupKey("today's,")).toBe("today's");
  });

  it('finds exact and inflected vocabulary entries', () => {
    const list = [vocab('against'), vocab('team'), vocab('in')];
    expect(findVocabularyForWord('Against', list)?.word).toBe('against');
    expect(findVocabularyForWord('teams.', list)?.word).toBe('team');
    expect(findVocabularyForWord('into', list)).toBeNull();
    expect(findVocabularyForWord('Rosa', list)).toBeNull();
  });
});
