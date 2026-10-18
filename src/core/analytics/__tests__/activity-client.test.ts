import {ensureValidSession} from '@core/auth/authSession';

import {sendActivityReport} from '../activityClient';

jest.mock('@core/auth/authClient', () => ({
  createAuthClient: jest.fn(() => ({})),
}));

jest.mock('@core/auth/authSession', () => ({
  ensureValidSession: jest.fn(),
}));

const mockedEnsure = ensureValidSession as jest.Mock;

function response(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {get: () => null},
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

describe('sendActivityReport', () => {
  beforeEach(() => {
    mockedEnsure.mockResolvedValue({
      status: 'valid',
      userId: 'user-1',
      session: {access_token: 'token'},
    });
  });

  it('posts the days and resolves true once stored', async () => {
    const fetchImpl = jest.fn(async () =>
      response(200, {request_id: 'r', status: 'success', accepted_days: 1}),
    );
    const days = [
      {
        day: '2026-10-18',
        features: [{feature: 'lesson' as const, opens: 1, active_seconds: 60}],
      },
    ];

    await expect(sendActivityReport(days, fetchImpl)).resolves.toBe(true);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toMatch(/\/v1\/me\/activity$/);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({days});
  });

  it('resolves false when the Server refuses', async () => {
    const fetchImpl = jest.fn(async () =>
      response(400, {
        request_id: 'r',
        status: 'failed',
        error: {code: 'VALIDATION_ERROR', message: 'bad'},
      }),
    );
    await expect(sendActivityReport([], fetchImpl)).resolves.toBe(false);
  });
});
