import {
  canSpeakText,
  cardReadingTarget,
  isSentence,
  readingTargetKey,
} from '../readingTarget';

const ITEM_ID = '44444444-4444-4444-8444-444444444444';

describe('canSpeakText', () => {
  it('takes plain words and sentences the Server can score', () => {
    expect(canSpeakText('schedule')).toBe(true);
    expect(canSpeakText("Could you send me the report? I'm late.")).toBe(true);
    expect(canSpeakText('e-mail')).toBe(true);
  });

  it('refuses pattern slots, markup, empty and over-long text', () => {
    expect(canSpeakText('I {verb} every day')).toBe(false);
    expect(canSpeakText('he/she')).toBe(false);
    expect(canSpeakText('<b>hi</b>')).toBe(false);
    expect(canSpeakText('   ')).toBe(false);
    expect(canSpeakText('123')).toBe(false);
    expect(canSpeakText('a'.repeat(121))).toBe(false);
  });
});

describe('cardReadingTarget', () => {
  it('reads a pack card from its item', () => {
    expect(
      cardReadingTarget({
        place: 'pack',
        text: 'schedule',
        itemId: ITEM_ID,
        kind: 'word',
      }),
    ).toEqual({source: 'pack', itemId: ITEM_ID});
  });

  it('counts phrases and patterns under the sentence review', () => {
    expect(
      cardReadingTarget({
        place: 'review',
        text: 'See you soon',
        itemId: ITEM_ID,
        kind: 'phrase',
      }),
    ).toEqual({source: 'review_sentence', itemId: ITEM_ID});
    expect(
      cardReadingTarget({
        place: 'review',
        text: 'thorough',
        itemId: ITEM_ID,
        kind: 'word',
      }),
    ).toEqual({source: 'review_word', itemId: ITEM_ID});
  });

  it('sends a saved word without an item by its own text', () => {
    expect(
      cardReadingTarget({
        place: 'review',
        text: ' thorough ',
        itemId: null,
        kind: 'vocab',
      }),
    ).toEqual({source: 'review_word', referenceText: 'thorough'});
    expect(
      cardReadingTarget({
        place: 'review',
        text: 'thorough',
        itemId: 'vocab:thorough',
        kind: null,
      }),
    ).toEqual({source: 'review_word', referenceText: 'thorough'});
  });

  it('offers nothing for a card that cannot be read aloud', () => {
    expect(
      cardReadingTarget({
        place: 'pack',
        text: 'I {verb} every day',
        itemId: ITEM_ID,
        kind: 'pattern',
      }),
    ).toBeNull();
  });
});

describe('isSentence and readingTargetKey', () => {
  it('tells a word from a sentence', () => {
    expect(isSentence('schedule')).toBe(false);
    expect(isSentence('look after')).toBe(true);
  });

  it('keys a target by its place and what is read', () => {
    expect(readingTargetKey({source: 'pack', itemId: ITEM_ID})).toBe(
      `pack:item:${ITEM_ID}`,
    );
    expect(
      readingTargetKey({source: 'review_word', referenceText: 'thorough'}),
    ).toBe('review_word:text:thorough');
  });
});
