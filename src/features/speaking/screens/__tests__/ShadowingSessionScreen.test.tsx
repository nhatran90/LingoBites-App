import React from 'react';
import {Alert} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {SHADOWING_SELF_CHECK_ITEMS} from '../../components/shadowing/SelfCheckList';
import {ShadowingSessionScreen} from '../ShadowingSessionScreen';

const LESSON_ID = '11111111-1111-4111-8111-111111111111';
const SENTENCE_ID = '22222222-2222-4222-8222-222222222221';

const mockSession: {
  lesson: {lessonId: string; titleVi: string; sentences: unknown[]};
  sentence: {
    id: string;
    position: number;
    textEn: string;
    textVi: string;
    ipa: string;
  };
  sentenceIndex: number;
  sentenceCount: number;
  sessionState: 'idle' | 'recording' | 'recorded' | 'saving';
  elapsedMs: number;
  take: {takeId: string; filePath: string; durationMs: number} | null;
  selfCheck: {fullSentence: boolean; keyWords: boolean; rhythm: boolean};
  hasUnsavedProgress: boolean;
  playNormalSample: jest.Mock;
  playSlowSample: jest.Mock;
  startRecordingTake: jest.Mock;
  stopRecordingTake: jest.Mock;
  reRecord: jest.Mock;
  playMyTake: jest.Mock;
  skipSentence: jest.Mock;
  saveAndContinue: jest.Mock;
  setSelfCheckItem: jest.Mock;
  discardUnsavedTake: jest.Mock;
} = {
  lesson: {
    lessonId: LESSON_ID,
    titleVi: 'Bài',
    sentences: [],
  },
  sentence: {
    id: SENTENCE_ID,
    position: 0,
    textEn: 'Hello',
    textVi: 'Xin chào',
    ipa: '/həˈloʊ/',
  },
  sentenceIndex: 1,
  sentenceCount: 3,
  sessionState: 'idle' as const,
  elapsedMs: 0,
  take: null,
  selfCheck: {fullSentence: false, keyWords: false, rhythm: false},
  hasUnsavedProgress: false,
  playNormalSample: jest.fn(),
  playSlowSample: jest.fn(),
  startRecordingTake: jest.fn(),
  stopRecordingTake: jest.fn(),
  reRecord: jest.fn(),
  playMyTake: jest.fn(),
  skipSentence: jest.fn(),
  saveAndContinue: jest.fn(),
  setSelfCheckItem: jest.fn(),
  discardUnsavedTake: jest.fn().mockResolvedValue(undefined),
};

jest.mock('../../logic/shadowing/useShadowingSession', () => ({
  useShadowingSession: () => mockSession,
  formatShadowingElapsed: (ms: number) => {
    const s = Math.floor(ms / 1000);
    return `00:${String(s).padStart(2, '0')}`;
  },
}));

jest.mock('../../logic/upload/recordingConsent', () => ({
  isRecordingUploadConsentOn: () => false,
}));

jest.mock('../../logic/recordingService', () => ({
  requestMicrophonePermission: jest.fn(),
}));

function renderScreen() {
  const navigation = {goBack: jest.fn(), navigate: jest.fn()};
  let tree!: ReactTestRenderer.ReactTestRenderer;
  act(() => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider releaseConfig={{releaseName: 'test', features: {}}}>
        <AppThemeProvider>
          <ShadowingSessionScreen
            navigation={navigation as never}
            route={{params: {lessonId: LESSON_ID}} as never}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return {tree, navigation};
}

function pressByTestId(
  root: ReactTestRenderer.ReactTestInstance,
  testID: string,
) {
  const target = root
    .findAll(node => node.props.testID === testID)
    .find(node => typeof node.props.onPress === 'function');
  if (!target) {
    throw new Error(`No pressable for ${testID}`);
  }
  act(() => {
    target.props.onPress();
  });
}

describe('ShadowingSessionScreen', () => {
  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    jest.clearAllMocks();
    mockSession.sessionState = 'idle';
    mockSession.take = null;
    mockSession.hasUnsavedProgress = false;
    mockSession.selfCheck = {
      fullSentence: false,
      keyWords: false,
      rhythm: false,
    };
  });

  it('AC-005 S1: shows sentence texts and Câu x/n', () => {
    const {tree} = renderScreen();
    const root = tree.root;
    const progress = root.findByProps({testID: 'pack-session-progress'});
    expect(progress.props.accessibilityValue.text).toBe('Câu 2/3');
    expect(
      root.findByProps({testID: 'shadowing-text-en', accessible: true}).props
        .accessibilityLabel,
    ).toBe('Hello');
    expect(
      root.findByProps({testID: 'shadowing-text-en-ipa-0'}).props.children,
    ).toBe('/həˈloʊ/');
    expect(root.findByProps({testID: 'shadowing-text-vi'}).props.children).toBe(
      'Xin chào',
    );
  });

  it('AC-009 S1: S5 shows three unticked self-check items', () => {
    mockSession.sessionState = 'recorded';
    mockSession.take = {
      takeId: 'take-1',
      filePath: '/tmp/a.m4a',
      durationMs: 1200,
    };
    const {tree} = renderScreen();
    for (const item of SHADOWING_SELF_CHECK_ITEMS) {
      const row = tree.root.findByProps({
        testID: `shadowing-self-check-${item.key}`,
      });
      expect(row.props.accessibilityState.checked).toBe(false);
      expect(
        tree.root.findAll(
          node =>
            node.props?.children === item.label ||
            (Array.isArray(node.props?.children) &&
              node.props.children.includes(item.label)),
        ).length,
      ).toBeGreaterThan(0);
    }
  });

  it('AC-012 S2: closing without unsaved take does not show a dialog', () => {
    const {tree, navigation} = renderScreen();
    pressByTestId(tree.root, 'shadowing-close');
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(navigation.goBack).toHaveBeenCalled();
  });

  it('AC-012 S1: closing with unsaved take confirms and discards', async () => {
    mockSession.sessionState = 'recorded';
    mockSession.take = {
      takeId: 'take-1',
      filePath: '/tmp/unsaved.m4a',
      durationMs: 900,
    };
    mockSession.hasUnsavedProgress = true;
    const {tree, navigation} = renderScreen();
    pressByTestId(tree.root, 'shadowing-close');
    expect(Alert.alert).toHaveBeenCalled();
    const buttons = (Alert.alert as jest.Mock).mock.calls[0][2] as {
      onPress?: () => void;
    }[];
    await act(async () => {
      buttons[1]?.onPress?.();
    });
    expect(mockSession.discardUnsavedTake).toHaveBeenCalled();
    expect(navigation.goBack).toHaveBeenCalled();
  });
});
