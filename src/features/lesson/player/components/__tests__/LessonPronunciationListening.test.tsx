import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import type {
  LessonListeningEntry,
  LessonPronunciationEntry,
} from '../../logic/lessonHubContent';
import {LessonListeningSection} from '../LessonListeningSection';
import {LessonPronunciationSection} from '../LessonPronunciationSection';

const PRONUNCIATION: LessonPronunciationEntry = {
  key: 'pronunciation:final-t',
  itemId: '00000000-0000-4000-8000-000000000071',
  text: 'Final /t/',
  meaningVi: 'Âm /t/ ở cuối từ',
  focus: '/t/ cuối từ',
  focusIpa: '/t/',
  tipVi: 'Bật nhẹ âm /t/.',
  minimalPairs: [['eight', 'ate']],
  examples: [{en: 'I want a hot tea.', vi: 'Tôi muốn một trà nóng.'}],
};

const LISTENING: LessonListeningEntry = {
  key: 'listening:what-size-would-you-like',
  text: 'What size would you like?',
  meaningVi: 'Bạn muốn cỡ nào?',
  questionEn: 'What does the seller ask about?',
  questionVi: 'Người bán hỏi về điều gì?',
  answer: 'The size',
};

function render(element: React.ReactElement) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>{element}</AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

const byTestId = (tree: ReactTestRenderer.ReactTestRenderer, id: string) =>
  tree.root.findAll(node => node.props.testID === id);

const pressable = (tree: ReactTestRenderer.ReactTestRenderer, id: string) =>
  byTestId(tree, id).find(node => typeof node.props.onPress === 'function')!;

describe('LessonPronunciationSection', () => {
  it('plays each word of a minimal pair and the examples', () => {
    const onSpeakText = jest.fn();
    const tree = render(
      <LessonPronunciationSection
        entries={[PRONUNCIATION]}
        onSpeakText={onSpeakText}
      />,
    );
    const id = `lesson-pronunciation-${PRONUNCIATION.key}`;
    act(() => pressable(tree, `${id}-pair-0-a`).props.onPress());
    act(() => pressable(tree, `${id}-pair-0-b`).props.onPress());
    act(() => pressable(tree, `${id}-example-0`).props.onPress());
    expect(onSpeakText.mock.calls).toEqual([
      ['eight'],
      ['ate'],
      ['I want a hot tea.'],
    ]);
    expect(JSON.stringify(tree.toJSON())).toContain('Bật nhẹ âm /t/.');
  });

  it('quizzes the pair: the played word is the correct choice', () => {
    const onSpeakText = jest.fn();
    const tree = render(
      <LessonPronunciationSection
        entries={[PRONUNCIATION]}
        onSpeakText={onSpeakText}
      />,
    );
    const quizId = `lesson-pronunciation-${PRONUNCIATION.key}-quiz`;
    act(() => pressable(tree, `${quizId}-listen`).props.onPress());
    const heard = onSpeakText.mock.calls.at(-1)?.[0];
    expect(['eight', 'ate']).toContain(heard);

    const options = [0, 1].map(index =>
      pressable(tree, `${quizId}-option-${index}`),
    );
    const wrong = options.find(
      option => option.props.accessibilityLabel !== heard,
    )!;
    act(() => wrong.props.onPress());
    expect(JSON.stringify(tree.toJSON())).toContain('Chưa đúng');

    act(() => pressable(tree, `${quizId}-next`).props.onPress());
    act(() => pressable(tree, `${quizId}-listen`).props.onPress());
    const nextHeard = onSpeakText.mock.calls.at(-1)?.[0];
    const right = [0, 1]
      .map(index => pressable(tree, `${quizId}-option-${index}`))
      .find(option => option.props.accessibilityLabel === nextHeard)!;
    act(() => right.props.onPress());
    expect(JSON.stringify(tree.toJSON())).toContain('Đúng rồi.');
  });

  it('hides the quiz when the screen cannot speak', () => {
    const tree = render(
      <LessonPronunciationSection entries={[PRONUNCIATION]} />,
    );
    expect(
      byTestId(tree, `lesson-pronunciation-${PRONUNCIATION.key}-quiz`),
    ).toHaveLength(0);
  });

  it('shows an empty state', () => {
    const tree = render(<LessonPronunciationSection entries={[]} />);
    expect(byTestId(tree, 'lesson-pronunciation-empty').length).toBeGreaterThan(
      0,
    );
  });
});

describe('LessonListeningSection', () => {
  it('plays the text and reveals the answer with the transcript', () => {
    const onSpeakText = jest.fn();
    const tree = render(
      <LessonListeningSection
        entries={[LISTENING]}
        onSpeakText={onSpeakText}
      />,
    );
    const id = `lesson-listening-${LISTENING.key}`;
    act(() => pressable(tree, `${id}-play`).props.onPress());
    expect(onSpeakText).toHaveBeenCalledWith('What size would you like?');
    expect(byTestId(tree, `${id}-answer`)).toHaveLength(0);
    expect(JSON.stringify(tree.toJSON())).not.toContain('The size');

    act(() => pressable(tree, `${id}-reveal`).props.onPress());
    expect(byTestId(tree, `${id}-answer`).length).toBeGreaterThan(0);
    expect(JSON.stringify(tree.toJSON())).toContain('The size');
  });

  it('moves to the next question from the bottom button once revealed', () => {
    const second: LessonListeningEntry = {
      ...LISTENING,
      key: 'listening:second',
      questionEn: 'Second question?',
    };
    const onFinish = jest.fn();
    const tree = render(
      <LessonListeningSection
        entries={[LISTENING, second]}
        onFinish={onFinish}
      />,
    );
    const first = `lesson-listening-${LISTENING.key}`;
    expect(byTestId(tree, 'lesson-listening-next')).toHaveLength(0);
    act(() => pressable(tree, `${first}-reveal`).props.onPress());
    act(() => pressable(tree, 'lesson-listening-next').props.onPress());
    expect(byTestId(tree, first)).toHaveLength(0);
    expect(JSON.stringify(tree.toJSON())).toContain('Second question?');
    act(() =>
      pressable(tree, `lesson-listening-${second.key}-reveal`).props.onPress(),
    );
    act(() => pressable(tree, 'lesson-listening-done').props.onPress());
    expect(onFinish).toHaveBeenCalledTimes(1);
  });

  it('shows an empty state', () => {
    const tree = render(<LessonListeningSection entries={[]} />);
    expect(byTestId(tree, 'lesson-listening-empty').length).toBeGreaterThan(0);
  });
});
