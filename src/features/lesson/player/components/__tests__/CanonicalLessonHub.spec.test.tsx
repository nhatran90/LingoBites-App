import fs from 'node:fs';
import path from 'node:path';

import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';
import {
  type LessonSnapshot,
  LessonSnapshotResponseSchema,
} from '@core/schemas/lesson';

import {CanonicalLessonHub} from '../CanonicalLessonHub';

const PREREQUISITE_ID = '22222222-2222-4222-8222-222222222299';

function specSnapshot(): LessonSnapshot {
  const raw = JSON.parse(
    fs.readFileSync(
      path.join(
        __dirname,
        '../../../../../core/schemas/__tests__/fixtures',
        'valid-lesson-snapshot-with-spec-response.json',
      ),
      'utf8',
    ),
  );
  return LessonSnapshotResponseSchema.parse(raw).lesson;
}

function render(
  snapshot: LessonSnapshot,
  handlers: {
    onOpenSection?: jest.Mock;
    onOpenLesson?: jest.Mock;
  } = {},
) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <CanonicalLessonHub
            analyses={{}}
            onOpenLesson={handlers.onOpenLesson}
            onOpenSection={handlers.onOpenSection ?? jest.fn()}
            snapshot={snapshot}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

const byTestId = (tree: ReactTestRenderer.ReactTestRenderer, id: string) =>
  tree.root.findAll(node => node.props.testID === id);

function collectText(node: ReactTestRenderer.ReactTestInstance): string {
  return node.children
    .map(child => (typeof child === 'string' ? child : collectText(child)))
    .join('');
}

/** Text under the outermost host element carrying the test id. */
const textOf = (tree: ReactTestRenderer.ReactTestRenderer, id: string) => {
  const host = byTestId(tree, id).find(node => typeof node.type === 'string');
  return host ? collectText(host) : '';
};

const pressable = (tree: ReactTestRenderer.ReactTestRenderer, id: string) =>
  byTestId(tree, id).find(node => typeof node.props.onPress === 'function');

describe('CanonicalLessonHub with a lesson specification', () => {
  it('shows what the learner will be able to do and in which situation', () => {
    const tree = render(specSnapshot());
    expect(byTestId(tree, 'lesson-outcome-card').length).toBeGreaterThan(0);
    expect(textOf(tree, 'lesson-outcome-can-do-0')).toBe(
      'Tự gọi một đồ uống kèm cỡ bằng mẫu "Can I have…?".',
    );
    expect(textOf(tree, 'lesson-outcome-situation')).toBe(
      'khách nói với người bán ở quán cà phê để gọi đồ uống',
    );
    // The length sits on the hero card.
    expect(textOf(tree, 'lesson-hero-meta-schedule')).toBe('10 phút');
  });

  it('opens a prerequisite lesson from the outcome card', () => {
    const lesson = specSnapshot();
    const onOpenLesson = jest.fn();
    const tree = render(
      {
        ...lesson,
        spec: {
          ...lesson.spec!,
          audience: 'kids',
          prerequisites: [
            {lessonId: PREREQUISITE_ID, code: 'A1-L00', title: 'Chào hỏi'},
          ].map(p => ({lesson_id: p.lessonId, code: p.code, title: p.title})),
        },
      },
      {onOpenLesson},
    );
    act(() =>
      pressable(
        tree,
        `lesson-outcome-prerequisite-${PREREQUISITE_ID}`,
      )!.props.onPress(),
    );
    expect(onOpenLesson).toHaveBeenCalledWith(PREREQUISITE_ID);
    expect(byTestId(tree, 'canonical-hub-audience')[0]!.props.label).toBe(
      'Trẻ em',
    );
  });

  it('lists words & phrases and patterns instead of grammar', () => {
    const onOpenSection = jest.fn();
    const tree = render(specSnapshot(), {onOpenSection});
    expect(byTestId(tree, 'canonical-hub-explore-grammar')).toHaveLength(0);
    // Words & phrases have their own tab, not an explore row.
    expect(byTestId(tree, 'canonical-hub-explore-vocabulary')).toHaveLength(0);
    // A lesson without sentences has no "Học từng câu" row.
    expect(byTestId(tree, 'canonical-hub-explore-sentences')).toHaveLength(0);
    expect(textOf(tree, 'lesson-content-tab-words')).toContain('Từ & cụm');
    expect(textOf(tree, 'canonical-hub-explore-patterns')).toContain(
      '1 mẫu câu',
    );
    expect(byTestId(tree, 'canonical-hub-explore-pronunciation')).toHaveLength(
      0,
    );
    act(() =>
      pressable(tree, 'canonical-hub-explore-patterns')!.props.onPress(),
    );
    expect(onOpenSection).toHaveBeenCalledWith('patterns');
  });

  it('keeps the learner lesson rows and hides the outcome card', () => {
    const lesson = specSnapshot();
    const tree = render({
      ...lesson,
      origin: 'learner',
      spec: null,
      lesson_items: [],
      tasks: [],
    });
    expect(byTestId(tree, 'lesson-outcome-card')).toHaveLength(0);
    expect(textOf(tree, 'canonical-hub-explore-grammar')).toContain(
      'Ngữ pháp trong ngữ cảnh',
    );
    // No sentence to read or analyse: those rows are left out.
    expect(byTestId(tree, 'canonical-hub-explore-sentences')).toHaveLength(0);
    expect(byTestId(tree, 'canonical-hub-explore-vocabulary')).toHaveLength(0);
    expect(byTestId(tree, 'canonical-hub-explore-patterns')).toHaveLength(0);
  });
});
