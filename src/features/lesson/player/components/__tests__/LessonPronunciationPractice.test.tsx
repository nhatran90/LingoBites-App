import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {useLearnerProfileStore} from '@features/onboarding';
import {resetPronunciationAvailabilityForTests} from '@features/pronunciation';

import {AppThemeProvider} from '@ui/theme';

import {getAppConfig} from '@core/api/appConfig';
import {
  FeatureFlagProvider,
  getReleaseConfig,
  type ReleaseConfig,
} from '@core/release';

import type {LessonPronunciationEntry} from '../../logic/lessonHubContent';
import {LessonPronunciationSection} from '../LessonPronunciationSection';

jest.mock('@core/api/appConfig', () => ({
  getAppConfig: jest.fn(),
}));

/** Pronunciation step 3: "Luyện phát âm" on each item, only where offered. */
const ENTRY: LessonPronunciationEntry = {
  key: 'pronunciation:ship',
  itemId: '00000000-0000-4000-8000-000000000081',
  text: 'ship',
  meaningVi: 'con tàu',
  focus: '/ɪ/ ngắn',
  focusIpa: '/ɪ/',
  tipVi: 'Đọc ngắn và gọn.',
  minimalPairs: [['ship', 'sheep']],
  examples: [],
};
const ID = `lesson-pronunciation-${ENTRY.key}`;

function serverSays(enabled: boolean) {
  (global as {fetch?: unknown}).fetch = jest.fn(async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      capabilities: {youtube: {enabled: true}, pronunciation: {enabled}},
    }),
  }));
}

async function render(releaseConfig?: ReleaseConfig) {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider releaseConfig={releaseConfig}>
        <AppThemeProvider>
          <LessonPronunciationSection
            entries={[ENTRY]}
            onSpeakText={jest.fn()}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

const find = (tree: ReactTestRenderer.ReactTestRenderer, id: string) =>
  tree.root.findAll(node => node.props.testID === id);

const originalFetch = global.fetch;

beforeEach(() => {
  resetPronunciationAvailabilityForTests();
  (getAppConfig as jest.Mock).mockReturnValue({
    apiBaseUrl: 'https://api.lingobites.app',
  });
  useLearnerProfileStore.setState({profile: null});
});

afterEach(() => {
  global.fetch = originalFetch;
});

describe('LessonPronunciationSection practice', () => {
  it('offers practice when the Server scores pronunciation, and opens the sheet', async () => {
    serverSays(true);
    const tree = await render();
    const button = find(tree, `${ID}-practice`).find(
      node => typeof node.props.onPress === 'function',
    );
    expect(button).toBeDefined();
    expect(find(tree, 'pronunciation-sheet')).toHaveLength(0);

    await act(async () => button!.props.onPress());
    expect(find(tree, 'pronunciation-sheet').length).toBeGreaterThan(0);
    expect(JSON.stringify(tree.toJSON())).toContain('Luyện phát âm');

    await act(async () =>
      find(tree, 'pronunciation-sheet-close')
        .find(node => typeof node.props.onPress === 'function')!
        .props.onPress(),
    );
    expect(find(tree, 'pronunciation-sheet')).toHaveLength(0);
  });

  it('hides practice when the Server does not score it', async () => {
    serverSays(false);
    const tree = await render();
    expect(find(tree, `${ID}-practice`)).toHaveLength(0);
    // Listening to the pairs still works.
    expect(find(tree, `${ID}-pair-0-a`).length).toBeGreaterThan(0);
  });

  it('hides practice from kids (A11)', async () => {
    serverSays(true);
    useLearnerProfileStore.setState({
      profile: {
        ageGroup: 'kids',
      } as never,
    });
    const tree = await render();
    expect(find(tree, `${ID}-practice`)).toHaveLength(0);
  });

  it('hides practice when the app release turns it off', async () => {
    serverSays(true);
    const production = getReleaseConfig('production');
    const tree = await render({
      ...production,
      features: {...production.features, pronunciationSupport: false},
    });
    expect(find(tree, `${ID}-practice`)).toHaveLength(0);
  });
});
