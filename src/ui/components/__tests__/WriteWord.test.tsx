import React from 'react';

import {
  byTestId,
  has,
  press,
  renderWithTheme,
  textOf,
} from '@test/support/lessonFlow';

import {canWriteWord, WriteWordButton} from '../WriteWordButton';
import {WriteWordPanel} from '../WriteWordPanel';

function labelOf(tree: ReturnType<typeof renderWithTheme>) {
  return byTestId(tree, 'b').find(
    node => typeof node.props.accessibilityLabel === 'string',
  )?.props.accessibilityLabel;
}

describe('Viết từ', () => {
  it('writes words and short phrases, never pattern frames or long sentences', () => {
    expect(canWriteWord('decision')).toBe(true);
    expect(canWriteWord('take away')).toBe(true);
    expect(canWriteWord('Can I have a {size} {drink}?')).toBe(false);
    expect(canWriteWord('one two three four five six seven eight nine')).toBe(
      false,
    );
    expect(canWriteWord('…')).toBe(false);
  });

  it('labels a word and a phrase "Viết từ" alike', () => {
    const word = renderWithTheme(
      <WriteWordButton onPress={jest.fn()} testID="b" text="borrow" />,
    );
    expect(labelOf(word)).toBe('Viết từ');
    const phrase = renderWithTheme(
      <WriteWordButton onPress={jest.fn()} testID="b" text="take away" />,
    );
    expect(labelOf(phrase)).toBe('Viết từ');
  });

  it('offers word tiles for a phrase and shows the answer when wrong', () => {
    const onDone = jest.fn();
    const tree = renderWithTheme(
      <WriteWordPanel
        meaningVi="mang đi"
        onDone={onDone}
        testID="w"
        word="take away"
      />,
    );
    expect(has(tree, 'w-input-mode-words')).toBe(true);
    press(tree, 'w-input-key-t');
    press(tree, 'w-check');
    expect(textOf(tree, 'w-verdict')).toBe('Chưa đúng. Đáp án: take away');
    press(tree, 'w-done');
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('cancels back to the card before checking', () => {
    const onDone = jest.fn();
    const tree = renderWithTheme(
      <WriteWordPanel
        meaningVi="mượn"
        onDone={onDone}
        testID="w"
        word="borrow"
      />,
    );
    expect(has(tree, 'w-input-mode-words')).toBe(false);
    press(tree, 'w-cancel');
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});
