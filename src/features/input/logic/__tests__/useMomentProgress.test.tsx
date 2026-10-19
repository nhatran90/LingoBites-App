import React from 'react';
import ReactTestRenderer, {act} from 'react-test-renderer';

import {fetchLessonCreationStatus} from '@features/lesson/player';

import {useMomentProgress} from '../useMomentProgress';

jest.mock('@features/analytics', () => ({trackEvent: jest.fn()}));
jest.mock('@features/lesson/player', () => ({
  fetchLessonCreationStatus: jest.fn(),
}));

const REQUEST = '22222222-2222-4222-8222-222222222222';
const running = {
  ok: true,
  value: {
    contract_version: 1,
    status: 'processing',
    lesson_id: null,
    error: null,
  },
};
const offline = {
  ok: false,
  kind: 'network-error',
  errorCode: 'NETWORK',
  message: 'offline',
  retryable: true,
};

let latest: ReturnType<typeof useMomentProgress>;
function Probe() {
  latest = useMomentProgress(REQUEST);
  return null;
}

describe('useMomentProgress', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.mocked(fetchLessonCreationStatus).mockReset();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('keeps the last status and tries again when a poll cannot reach the server', async () => {
    jest
      .mocked(fetchLessonCreationStatus)
      .mockResolvedValueOnce(running as never)
      .mockResolvedValueOnce(offline as never)
      .mockResolvedValueOnce(running as never);
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(<Probe />);
    });
    expect(latest.status?.status).toBe('processing');

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });
    expect(latest.waitingNetwork).toBe(true);
    expect(latest.status?.status).toBe('processing');
    expect(latest.polling).toBe(true);

    await act(async () => {
      jest.advanceTimersByTime(2000);
    });
    expect(fetchLessonCreationStatus).toHaveBeenCalledTimes(3);
    expect(latest.waitingNetwork).toBe(false);
    tree.unmount();
  });

  it('stops when the server no longer knows the request', async () => {
    jest.mocked(fetchLessonCreationStatus).mockResolvedValueOnce({
      ...offline,
      kind: 'not-found',
      retryable: false,
    } as never);
    let tree!: ReactTestRenderer.ReactTestRenderer;
    await act(async () => {
      tree = ReactTestRenderer.create(<Probe />);
    });
    expect(latest.error?.kind).toBe('not-found');
    expect(latest.polling).toBe(false);
    await act(async () => {
      jest.advanceTimersByTime(20_000);
    });
    expect(fetchLessonCreationStatus).toHaveBeenCalledTimes(1);
    tree.unmount();
  });
});
