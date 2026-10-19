import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {resetPronunciationAvailabilityForTests} from '@features/pronunciation';
import {setPronunciationConsent} from '@features/speaking';

import {AppThemeProvider} from '@ui/theme';

import {getAppConfig} from '@core/api/appConfig';
import type {QuizQuestion} from '@core/learning/packQuiz';
import {FeatureFlagProvider} from '@core/release';
import type {CatalogItem} from '@core/schemas/lesson';

import {makeTestReleaseConfig, THEME_UI_FLAGS} from '@test/support';
import {mockAppNavigation} from '@test/support/appNavigationMock';
import {has, press, renderWithTheme, textOf} from '@test/support/lessonFlow';

import {learnWordPack} from '../../logic/wordPathClient';
import {PackLearnScreen} from '../PackLearnScreen';
import {QuickKnownCheckScreen} from '../QuickKnownCheckScreen';

/** Vocab path P5: the quick known check and the learn session send the right words to the Server. */

jest.mock('../../logic/wordPathClient', () => ({
  learnWordPack: jest.fn(),
}));

jest.mock('@core/api/appConfig', () => ({
  getAppConfig: jest.fn(),
}));

/** What `/v1/capabilities` answers about pronunciation scoring. */
function serverScores(enabled: boolean) {
  (global as {fetch?: unknown}).fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      capabilities: {youtube: {enabled: true}, pronunciation: {enabled}},
    }),
  }));
}

async function flush() {
  await act(async () => undefined);
}

const mockLearn = learnWordPack as jest.MockedFunction<typeof learnWordPack>;

function word(code: string, meaning: string): CatalogItem {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    code,
    kind: 'word',
    text: code.slice(code.indexOf(':') + 1),
    meaning_vi: meaning,
    ipa: null,
    part_of_speech: null,
    note_vi: null,
    audience: 'all',
    payload: {},
    audio: null,
    image: null,
    examples: [],
    variants: [],
    errors: [],
  };
}

const coffee = word('word:coffee', 'cà phê');
const tea = word('word:tea', 'trà');

/** The button whose title is this text, pressed. */
function pressTitle(tree: ReactTestRenderer.ReactTestRenderer, title: string) {
  const node = tree.root.findAll(
    instance =>
      instance.props.title === title &&
      typeof instance.props.onPress === 'function',
  )[0];
  expect(node).toBeDefined();
  act(() => {
    node!.props.onPress();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockLearn.mockResolvedValue({
    ok: true,
    value: {
      request_id: 'r',
      status: 'success',
      enrolled: 1,
      already_scheduled: 0,
    },
  });
});

describe('QuickKnownCheckScreen', () => {
  it('sends the words answered right both times as known', async () => {
    const questions: QuizQuestion[] = [
      {
        itemCode: 'word:coffee',
        prompt: 'coffee',
        options: ['cà phê', 'trà', 'nước'],
        answerIndex: 0,
      },
      {
        itemCode: 'word:tea',
        prompt: 'tea',
        options: ['nước', 'trà', 'sữa'],
        answerIndex: 1,
      },
      {
        itemCode: 'word:coffee',
        prompt: 'coffee',
        options: ['cà phê', 'sữa', 'nước'],
        answerIndex: 0,
      },
      {
        itemCode: 'word:tea',
        prompt: 'tea',
        options: ['trà', 'sữa', 'nước'],
        answerIndex: 1,
      },
    ];
    const tree = renderWithTheme(
      <QuickKnownCheckScreen
        questions={questions}
        route={{params: {packId: 'pack-1'}}}
      />,
    );
    // coffee: right, right. tea: wrong, then right, so only coffee is known.
    press(tree, 'quick-check-option-0');
    press(tree, 'quick-check-next');
    press(tree, 'quick-check-option-0');
    press(tree, 'quick-check-next');
    press(tree, 'quick-check-option-0');
    press(tree, 'quick-check-next');
    press(tree, 'quick-check-option-0');

    expect(has(tree, 'quick-check-done')).toBe(true);
    await act(async () => {
      press(tree, 'quick-check-save');
    });
    expect(mockLearn).toHaveBeenCalledWith('pack-1', {
      itemCodes: ['word:coffee'],
      mode: 'known',
    });
  });
});

describe('PackLearnScreen', () => {
  it('writes the word from its meaning, then goes back to the same card', () => {
    const tree = renderWithTheme(
      <PackLearnScreen
        items={[coffee, tea]}
        route={{params: {packId: 'pack-2'}}}
      />,
    );
    press(tree, 'pack-learn-practice-write');
    expect(textOf(tree, 'pack-learn-write-meaning')).toBe('cà phê');
    expect(has(tree, 'pack-learn-next-card')).toBe(false);
    for (const key of coffee.text.split('')) {
      press(tree, `pack-learn-write-input-key-${key}`);
    }
    press(tree, 'pack-learn-write-check');
    expect(textOf(tree, 'pack-learn-write-verdict')).toBe('Chính xác!');
    press(tree, 'pack-learn-write-done');
    expect(has(tree, `pack-learn-card-${coffee.code}`)).toBe(true);
    expect(mockLearn).not.toHaveBeenCalled();
  });

  it('learns the words answered right in the recognition pass', async () => {
    const tree = renderWithTheme(
      <PackLearnScreen
        items={[coffee, tea]}
        route={{params: {packId: 'pack-2'}}}
      />,
    );
    press(tree, 'pack-learn-next-card');
    press(tree, 'pack-learn-next-card');

    // The questions come in a random order: answer each with the meaning of the word it asks.
    for (const index of [0, 1]) {
      const card = textOf(tree, `pack-learn-question-${index}`);
      const asked = card.includes(coffee.text) ? coffee : tea;
      pressTitle(tree, asked.meaning_vi);
      press(tree, 'pack-learn-next-question');
    }

    // The save resolves after the last answer; let it finish inside act.
    await act(async () => {
      await Promise.resolve();
    });
    expect(has(tree, 'pack-learn-done')).toBe(true);
    expect(mockLearn).toHaveBeenCalledTimes(1);
    const [packId, body] = mockLearn.mock.calls[0]!;
    expect(packId).toBe('pack-2');
    expect(body.mode).toBe('learn');
    expect([...body.itemCodes].sort()).toEqual(['word:coffee', 'word:tea']);
  });
});

describe('PackLearnScreen "Nói từ"', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    resetPronunciationAvailabilityForTests();
    (getAppConfig as jest.Mock).mockReturnValue({
      apiBaseUrl: 'https://api.lingobites.app',
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    setPronunciationConsent('off');
  });

  function renderPack() {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      tree = ReactTestRenderer.create(
        <FeatureFlagProvider
          releaseConfig={makeTestReleaseConfig({
            ...THEME_UI_FLAGS,
            pronunciationSupport: true,
          })}
        >
          <AppThemeProvider>
            <PackLearnScreen
              items={[coffee, tea]}
              route={{params: {packId: 'pack-2'}}}
            />
          </AppThemeProvider>
        </FeatureFlagProvider>,
      );
    });
    return tree;
  }

  it('is locked until scoring is turned on, and leads to Settings', async () => {
    serverScores(true);
    setPronunciationConsent('off');
    const tree = renderPack();
    await flush();
    expect(has(tree, 'pack-learn-practice-speak-locked')).toBe(true);
    press(tree, 'pack-learn-practice-speak');
    expect(mockAppNavigation.openPronunciationSettings).toHaveBeenCalledTimes(
      1,
    );
    expect(has(tree, 'pack-learn-speak-panel')).toBe(false);

    // Turned on in Settings: the button unlocks without leaving the card.
    act(() => setPronunciationConsent('on'));
    expect(has(tree, 'pack-learn-practice-speak-locked')).toBe(false);
  });

  it('opens the reading panel in place of the card, and goes back to it', async () => {
    serverScores(true);
    setPronunciationConsent('on');
    const tree = renderPack();
    await flush();
    press(tree, 'pack-learn-practice-speak');
    expect(has(tree, 'pack-learn-speak-panel')).toBe(true);
    expect(textOf(tree, 'pack-learn-speak-text')).toBe('coffee');
    expect(has(tree, 'pack-learn-next-card')).toBe(false);
    press(tree, 'pack-learn-speak-cancel');
    expect(has(tree, `pack-learn-card-${coffee.code}`)).toBe(true);
    expect(mockLearn).not.toHaveBeenCalled();
  });

  it('is not offered where the Server does not score pronunciation', async () => {
    serverScores(false);
    setPronunciationConsent('on');
    const tree = renderPack();
    await flush();
    expect(has(tree, 'pack-learn-practice-speak')).toBe(false);
  });
});
