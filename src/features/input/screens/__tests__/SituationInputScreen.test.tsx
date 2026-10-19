import React from 'react';
import {TextInput} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {AppThemeProvider} from '@ui/theme';

import {FeatureFlagProvider} from '@core/release';

import {
  fetchActiveMoments,
  fetchSituations,
  submitMoment,
} from '../../logic/momentClient';
import {SituationInputScreen} from '../SituationInputScreen';

jest.mock('@features/analytics', () => ({trackEvent: jest.fn()}));

jest.mock('@features/lesson/player', () => ({
  dismissCompose: jest.fn(),
  fetchComposeQuota: jest.fn(() =>
    Promise.resolve({ok: true, value: {limit: 1, remaining: 1}}),
  ),
  markComposeSeen: jest.fn(),
  resumeTrackedMoment: jest.fn(),
  setFocusedCompose: jest.fn(),
  trackMoment: jest.fn(),
}));

const mockNavigation = {
  finishCreate: jest.fn(),
  goToTab: jest.fn(),
  openLibrarySection: jest.fn(),
};
jest.mock('@core/navigation', () => ({
  useAppNavigation: () => mockNavigation,
}));

jest.mock('../../logic/momentClient', () => ({
  confirmMoment: jest.fn(),
  fetchActiveMoments: jest.fn(() => Promise.resolve({ok: true, value: []})),
  fetchSituations: jest.fn(),
  submitMoment: jest.fn(() =>
    Promise.resolve({ok: true, value: {moment_request_id: 'req-1'}}),
  ),
}));

type MockProgress = {
  status: Record<string, unknown> | null;
  error: Record<string, unknown> | null;
  polling: boolean;
  waitingNetwork: boolean;
  resume: jest.Mock;
  checkNow: jest.Mock;
};
const idleProgress = (): MockProgress => ({
  status: null,
  error: null,
  polling: false,
  waitingNetwork: false,
  resume: jest.fn(),
  checkNow: jest.fn(),
});
let mockProgress: MockProgress = idleProgress();
jest.mock('../../logic/useMomentProgress', () => ({
  useMomentProgress: (requestId: string | null) =>
    requestId ? mockProgress : idleProgress(),
}));

const REQUEST = '22222222-2222-4222-8222-222222222222';

function failedWith(code: string, compose?: Record<string, unknown>) {
  return {
    contract_version: 1,
    status: 'failed',
    lesson_id: null,
    error: {code, retryable: true},
    ...(compose ? {compose} : {}),
  };
}

const drink = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'order_drink',
  title_vi: 'Gọi đồ uống',
  title_en: 'Order a drink',
  level_code: 'A1',
  goals: ['travel'],
  interests: ['food'],
};

async function renderScreen() {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(
      <FeatureFlagProvider>
        <AppThemeProvider>
          <SituationInputScreen
            navigation={{goBack: jest.fn()} as never}
            route={{key: 'SituationInput', name: 'SituationInput'} as never}
          />
        </AppThemeProvider>
      </FeatureFlagProvider>,
    );
  });
  return tree;
}

function has(tree: ReactTestRenderer.ReactTestRenderer, testID: string) {
  return tree.root.findAll(node => node.props.testID === testID).length > 0;
}

function pressAction(tree: ReactTestRenderer.ReactTestRenderer, key: string) {
  return tree.root
    .find(
      node =>
        node.props.testID === `moment-action-${key}` &&
        typeof node.props.onPress === 'function',
    )
    .props.onPress();
}

function textOf(tree: ReactTestRenderer.ReactTestRenderer): string {
  return tree.root
    .findAll(node => typeof node.type === 'string')
    .flatMap(node => [node.props.children].flat())
    .filter((child): child is string => typeof child === 'string')
    .join(' ');
}

function sendButton(tree: ReactTestRenderer.ReactTestRenderer) {
  return tree.root.find(
    node =>
      node.props.testID === 'moment-send' &&
      typeof node.props.style === 'function',
  );
}

describe('SituationInputScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockProgress = idleProgress();
    jest
      .mocked(fetchSituations)
      .mockResolvedValue({ok: true, value: [drink]} as never);
  });

  it('fills the box with a tapped suggestion instead of creating at once', async () => {
    const tree = await renderScreen();
    expect(sendButton(tree).props.disabled).toBe(true);

    await act(async () => {
      tree.root
        .find(
          node =>
            node.props.testID === 'situation-order_drink' &&
            typeof node.props.onPress === 'function',
        )
        .props.onPress();
    });

    expect(tree.root.findByType(TextInput).props.value).toBe('Gọi đồ uống');
    expect(submitMoment).not.toHaveBeenCalled();
    expect(sendButton(tree).props.disabled).toBe(false);

    await act(async () => {
      sendButton(tree).props.onPress();
    });
    expect(jest.mocked(submitMoment).mock.calls[0][0]).toMatchObject({
      situation_id: drink.id,
    });
  });

  it('sends the edited text as a typed situation', async () => {
    const tree = await renderScreen();
    await act(async () => {
      tree.root
        .find(
          node =>
            node.props.testID === 'situation-order_drink' &&
            typeof node.props.onPress === 'function',
        )
        .props.onPress();
    });
    await act(async () => {
      tree.root
        .findByType(TextInput)
        .props.onChangeText('Gọi đồ uống ít đường, mang đi');
    });
    await act(async () => {
      sendButton(tree).props.onPress();
    });

    const body = jest.mocked(submitMoment).mock.calls[0][0];
    expect(body).toMatchObject({
      situation_note: 'Gọi đồ uống ít đường, mang đi',
    });
    expect(body).not.toHaveProperty('situation_id');
  });

  it('shows the step being built for a moment restored from the server', async () => {
    jest.mocked(fetchActiveMoments).mockResolvedValueOnce({
      ok: true,
      value: [
        {
          id: REQUEST,
          status: 'processing',
          situation_vi: 'Đi khám răng',
          confirm_expires_at: null,
          lesson_id: null,
        },
      ],
    } as never);
    mockProgress = {
      ...idleProgress(),
      polling: true,
      status: {
        contract_version: 1,
        status: 'processing',
        lesson_id: null,
        error: null,
        compose: {stage: 'moment_source'},
      },
    };
    const tree = await renderScreen();

    expect(has(tree, 'moment-building')).toBe(true);
    expect(textOf(tree)).toContain('Đi khám răng');
    expect(textOf(tree)).toContain('Đang tạo câu và giọng đọc');
    expect(has(tree, 'moment-send')).toBe(false);
    await act(async () => {
      pressAction(tree, 'leave');
    });
    expect(mockNavigation.goToTab).toHaveBeenCalledWith('Home');
  });

  it('keeps the wait screen, not a blank one, while the server is unreachable', async () => {
    jest.mocked(fetchActiveMoments).mockResolvedValueOnce({
      ok: true,
      value: [
        {
          id: REQUEST,
          status: 'processing',
          situation_vi: null,
          confirm_expires_at: null,
          lesson_id: null,
        },
      ],
    } as never);
    mockProgress = {...idleProgress(), waitingNetwork: true};
    const tree = await renderScreen();

    expect(has(tree, 'moment-building')).toBe(true);
    expect(textOf(tree)).toContain('Mất kết nối, bài vẫn đang được tạo');
    await act(async () => {
      pressAction(tree, 'check');
    });
    expect(mockProgress.checkNow).toHaveBeenCalled();
  });

  it('retries a system failure with the same situation', async () => {
    const tree = await renderScreen();
    await act(async () => {
      tree.root
        .find(
          node =>
            node.props.testID === 'situation-order_drink' &&
            typeof node.props.onPress === 'function',
        )
        .props.onPress();
    });
    mockProgress = {
      ...idleProgress(),
      status: failedWith('MOMENT_AUTHOR_FAILED'),
    };
    await act(async () => {
      sendButton(tree).props.onPress();
    });

    expect(has(tree, 'moment-failed-system')).toBe(true);
    expect(textOf(tree)).toContain('AI chưa tạo xong bài này');
    expect(textOf(tree)).toContain('Gọi đồ uống');
    await act(async () => {
      pressAction(tree, 'retry');
    });
    expect(submitMoment).toHaveBeenCalledTimes(2);
    expect(jest.mocked(submitMoment).mock.calls[1][0]).toEqual(
      jest.mocked(submitMoment).mock.calls[0][0],
    );
    expect(jest.mocked(submitMoment).mock.calls[1][1]).not.toBe(
      jest.mocked(submitMoment).mock.calls[0][1],
    );
  });

  it('shows the server tip for a vague situation and keeps the text to edit', async () => {
    const tree = await renderScreen();
    await act(async () => {
      tree.root.findByType(TextInput).props.onChangeText('đi khám');
    });
    mockProgress = {
      ...idleProgress(),
      status: failedWith('MOMENT_NOT_SUITABLE', {
        stage: 'moment_author',
        reason_vi: 'Chưa rõ bạn khám gì.',
        suggestion_vi: 'Nói rõ khám răng hay khám mắt.',
      }),
    };
    await act(async () => {
      sendButton(tree).props.onPress();
    });

    expect(has(tree, 'moment-failed-not_suitable')).toBe(true);
    expect(textOf(tree)).toContain('Chưa rõ bạn khám gì.');
    expect(textOf(tree)).toContain('Nói rõ khám răng hay khám mắt.');
    await act(async () => {
      pressAction(tree, 'edit');
    });
    expect(tree.root.findByType(TextInput).props.value).toBe('đi khám');
  });

  it('sends a paused failure to the existing lessons instead of a retry', async () => {
    const tree = await renderScreen();
    await act(async () => {
      tree.root.findByType(TextInput).props.onChangeText('gọi taxi ra sân bay');
    });
    mockProgress = {
      ...idleProgress(),
      status: failedWith('COMPOSE_BUDGET_EXHAUSTED'),
    };
    await act(async () => {
      sendButton(tree).props.onPress();
    });

    expect(has(tree, 'moment-failed-paused')).toBe(true);
    expect(has(tree, 'moment-action-retry')).toBe(false);
    await act(async () => {
      pressAction(tree, 'library');
    });
    expect(mockNavigation.openLibrarySection).toHaveBeenCalledWith('moments');
  });
});
