import React from 'react';
import {Alert, Linking, Text} from 'react-native';
import ReactTestRenderer from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {SupportAboutScreen} from '../SupportAboutScreen';

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
const mockClearAllLocalDataWithFiles = jest.fn(async () => ({
  ok: true,
  dbCleared: true,
  failedFilePaths: [],
}));
const mockClearSpeakingLocalData = jest.fn(async () => ({
  ok: true,
  dbCleared: true,
  failedFilePaths: [],
}));

jest.mock('@core/localData', () => ({
  clearAllLocalDataWithFiles: () => mockClearAllLocalDataWithFiles(),
  clearSpeakingLocalData: () => mockClearSpeakingLocalData(),
}));

jest.mock('@core/api/appConfig', () => ({
  getSupportEmail: () => 'support@lingobites.app',
  getAppVersion: () => '1.2.3',
  getAppConfig: () => ({apiBaseUrl: 'https://test.lingobites.app'}),
}));

const navigation = {
  navigate: mockNavigate,
  goBack: mockGoBack,
} as unknown as React.ComponentProps<typeof SupportAboutScreen>['navigation'];

const route = {
  key: 'SupportAbout',
  name: 'SupportAbout',
  params: undefined,
} as React.ComponentProps<typeof SupportAboutScreen>['route'];

function renderScreen() {
  return ReactTestRenderer.create(
    <FeatureFlagProvider>
      <AppThemeProvider>
        <SupportAboutScreen navigation={navigation} route={route} />
      </AppThemeProvider>
    </FeatureFlagProvider>,
  );
}

function findPressableByLabel(
  root: ReactTestRenderer.ReactTestInstance,
  label: string,
) {
  const textNode = root
    .findAllByType(Text)
    .find(node => node.props.children === label);

  let current = textNode?.parent;
  while (current && typeof current.props.onPress !== 'function') {
    current = current.parent;
  }

  return current;
}

describe('SupportAboutScreen', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    mockGoBack.mockReset();
    mockClearAllLocalDataWithFiles.mockReset();
    mockClearSpeakingLocalData.mockReset();
    mockClearAllLocalDataWithFiles.mockResolvedValue({
      ok: true,
      dbCleared: true,
      failedFilePaths: [],
    });
    mockClearSpeakingLocalData.mockResolvedValue({
      ok: true,
      dbCleared: true,
      failedFilePaths: [],
    });
    jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined as never);
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows developer entries in dev builds', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });

    const text = JSON.stringify(tree!.toJSON());
    expect(text).toContain('Tính năng hệ thống');
    expect(text).toContain('Demo native TTS');
  });

  it('hides developer entries on production builds', async () => {
    const originalDev = (globalThis as {__DEV__?: boolean}).__DEV__;
    (globalThis as {__DEV__?: boolean}).__DEV__ = false;
    try {
      let tree!: ReactTestRenderer.ReactTestRenderer;

      await ReactTestRenderer.act(async () => {
        tree = renderScreen();
      });

      const text = JSON.stringify(tree!.toJSON());
      expect(text).not.toContain('Tính năng hệ thống');
      expect(text).not.toContain('Demo native TTS');
      expect(text).not.toContain('FeatureStatus');
      expect(text).not.toContain('TtsSpike');
      expect(text).not.toContain('UnifiedLessonsPreview');
    } finally {
      (globalThis as {__DEV__?: boolean}).__DEV__ = originalDev;
    }
  });

  it('opens privacy detail screen (FR-SET-004)', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });

    const privacyLink = findPressableByLabel(tree!.root, 'Quyền riêng tư');

    await ReactTestRenderer.act(async () => {
      privacyLink?.props.onPress();
    });

    expect(mockNavigate).toHaveBeenCalledWith('PrivacyNote');
  });

  it('opens support mailto from help row', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;

    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });

    const supportLink = findPressableByLabel(tree!.root, 'Trợ giúp & góp ý');

    await ReactTestRenderer.act(async () => {
      supportLink?.props.onPress();
    });

    expect(Linking.openURL).toHaveBeenCalledWith(
      expect.stringContaining('mailto:support@lingobites.app'),
    );
  });

  it('shows the app version', async () => {
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await ReactTestRenderer.act(async () => {
      tree = renderScreen();
    });
    const text = JSON.stringify(tree!.toJSON());
    expect(text).toContain('Phiên bản');
    // The build's version (env), not package.json's 0.0.1.
    expect(text).toContain('1.2.3');
  });
});
