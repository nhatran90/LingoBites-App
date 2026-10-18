import React, {useState} from 'react';
import {StyleSheet} from 'react-native';
import {act} from 'react-test-renderer';

import {type AppTheme, useAppTheme} from '@ui/theme';

import {byTestId, press, renderWithTheme} from '@test/support/lessonFlow';

import {
  TileComposer,
  type TileComposerProps,
  type TileMode,
} from '../TileComposer';

type Harness = Partial<TileComposerProps> & {initialMode?: TileMode};

let latest = '';
let activeTheme!: AppTheme;

function ThemeProbe() {
  activeTheme = useAppTheme().theme;
  return null;
}

function Composer({initialMode = 'letters', ...props}: Harness) {
  const [value, setValue] = useState('');
  const [mode, setMode] = useState<TileMode>(initialMode);
  latest = value;
  return (
    <TileComposer
      answer="I want tea"
      mode={mode}
      onChangeText={setValue}
      onModeChange={setMode}
      testID="composer"
      value={value}
      {...props}
    />
  );
}

function render(props: Harness = {}) {
  return renderWithTheme(
    <>
      <ThemeProbe />
      <Composer {...props} />
    </>,
  );
}

function stageStyle(tree: ReturnType<typeof render>) {
  const stage = byTestId(tree, 'composer-stage').find(
    node => node.props.style !== undefined,
  );
  return StyleSheet.flatten(stage?.props.style);
}

describe('TileComposer', () => {
  it('writes with letter tiles, a space and delete', () => {
    const tree = render();
    press(tree, 'composer-key-i');
    press(tree, 'composer-space');
    press(tree, 'composer-key-w');
    press(tree, 'composer-key-a');
    expect(latest).toBe('i wa');
    press(tree, 'composer-delete');
    expect(latest).toBe('i w');
  });

  it('never starts with or doubles a space', () => {
    const tree = render();
    press(tree, 'composer-space');
    press(tree, 'composer-key-i');
    press(tree, 'composer-space');
    press(tree, 'composer-space');
    expect(latest).toBe('i ');
  });

  it('holds delete to remove the whole word', () => {
    const tree = render();
    for (const key of ['i', 'space', 't', 'e', 'a']) {
      press(tree, key === 'space' ? 'composer-space' : `composer-key-${key}`);
    }
    const del = byTestId(tree, 'composer-delete').find(
      node => typeof node.props.onLongPress === 'function',
    )!;
    act(() => del.props.onLongPress());
    expect(latest).toBe('i ');
  });

  it('removes a word tapped in the stage', () => {
    const tree = render({initialMode: 'words'});
    for (const word of ['i', 'want', 'tea']) {
      const tile = tree.root.findAll(
        node =>
          typeof node.props.testID === 'string' &&
          node.props.testID.startsWith('composer-word-') &&
          node.props.label === word &&
          typeof node.props.onPress === 'function',
      )[0]!;
      act(() => tile.props.onPress());
    }
    expect(latest).toBe('i want tea');
    press(tree, 'composer-picked-1');
    expect(latest).toBe('i tea');
  });

  it('capitalises the start of a sentence on the full keyboard', () => {
    const tree = render({initialMode: 'keyboard'});
    press(tree, 'composer-key-h');
    press(tree, 'composer-key-i');
    press(tree, 'composer-key-.');
    press(tree, 'composer-space');
    press(tree, 'composer-key-o');
    expect(latest).toBe('Hi. O');
  });

  it('reports the bulb hint', () => {
    const onHint = jest.fn();
    const tree = render({onHint});
    press(tree, 'composer-bulb');
    expect(onHint).toHaveBeenCalledTimes(1);
    act(() => tree.unmount());
  });

  it('switches mode', () => {
    const tree = render();
    press(tree, 'composer-mode-keyboard');
    expect(byTestId(tree, 'composer-key-q').length).toBeGreaterThan(0);
  });

  it('offers only the keyboard without an answer', () => {
    const tree = render({answer: null, initialMode: 'letters'});
    expect(byTestId(tree, 'composer-mode-words')).toHaveLength(0);
    expect(byTestId(tree, 'composer-key-z').length).toBeGreaterThan(0);
  });

  it("marks a right answer in the theme's right colors, not the coral ones", () => {
    const right = stageStyle(render({status: 'right', editable: false}));
    expect(right.borderColor).toBe(activeTheme.colors.primary);
    expect(right.backgroundColor).toBe(activeTheme.colors.accentSoft);
    const wrong = stageStyle(render({status: 'wrong', editable: false}));
    expect(wrong.borderColor).toBe(activeTheme.colors.danger);
  });
});
