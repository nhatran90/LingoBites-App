import Config from 'react-native-config';
import DeviceInfo from 'react-native-device-info';

import {SyncOwnershipChangedError} from '@core/sync/syncDrainOwnership';

import {ensureValidSession} from '../../auth/authSession';
import {authenticatedFetch} from '../authenticatedFetch';
import {resetDeviceHeadersForTests} from '../deviceHeaders';

jest.mock('../../auth/authClient', () => ({
  createAuthClient: jest.fn(() => ({})),
}));

jest.mock('../../auth/authSession', () => ({
  ensureValidSession: jest.fn(),
}));

jest.mock('@core/sync/syncDrainOwnership', () => {
  const actual = jest.requireActual('@core/sync/syncDrainOwnership');
  return {
    ...actual,
    assertSyncDrainOwnershipUnchanged: jest.fn().mockResolvedValue(true),
  };
});

const mockedEnsure = ensureValidSession as jest.Mock;

describe('authenticatedFetch expectedUserId guard', () => {
  const fetchImpl = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    fetchImpl.mockResolvedValue({status: 200, ok: true});
  });

  it('sends zero requests when there is no valid session', async () => {
    mockedEnsure.mockResolvedValue({status: 'no-session'});

    await expect(
      authenticatedFetch(
        'https://api.test/v1/recordings',
        {method: 'POST'},
        fetchImpl,
        {expectedUserId: 'user-1'},
      ),
    ).rejects.toBeInstanceOf(SyncOwnershipChangedError);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends zero requests when the session user does not match expectedUserId', async () => {
    mockedEnsure.mockResolvedValue({
      status: 'valid',
      userId: 'other-user',
      session: {access_token: 'token'},
    });

    await expect(
      authenticatedFetch(
        'https://api.test/v1/recordings',
        {method: 'POST'},
        fetchImpl,
        {expectedUserId: 'user-1'},
      ),
    ).rejects.toBeInstanceOf(SyncOwnershipChangedError);

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it('sends the request when the session user matches expectedUserId', async () => {
    mockedEnsure.mockResolvedValue({
      status: 'valid',
      userId: 'user-1',
      session: {access_token: 'token'},
    });

    await authenticatedFetch(
      'https://api.test/v1/recordings',
      {method: 'POST'},
      fetchImpl,
      {expectedUserId: 'user-1'},
    );

    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(fetchImpl.mock.calls[0][1].headers.Authorization).toBe(
      'Bearer token',
    );
  });
});

describe('authenticatedFetch app version header', () => {
  const fetchImpl = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    fetchImpl.mockResolvedValue({status: 200, ok: true});
    mockedEnsure.mockResolvedValue({
      status: 'valid',
      userId: 'user-1',
      session: {access_token: 'token'},
    });
  });

  it('sends the store version and platform', async () => {
    await authenticatedFetch(
      'https://api.test/v1/library/tenses',
      {method: 'GET'},
      fetchImpl,
    );

    const headers = fetchImpl.mock.calls[0][1].headers;
    expect(headers['X-App-Version']).toBe('1.0.1');
    expect(headers['X-App-Platform']).toBe('ios');
  });

  it('sends the OS version and device model', async () => {
    resetDeviceHeadersForTests();
    (DeviceInfo.getSystemVersion as jest.Mock).mockReturnValueOnce('18.1');
    (DeviceInfo.getModel as jest.Mock).mockReturnValueOnce('iPhone 15');
    await authenticatedFetch(
      'https://api.test/v1/library/tenses',
      {method: 'GET'},
      fetchImpl,
    );

    const headers = fetchImpl.mock.calls[0][1].headers;
    expect(headers['X-OS-Version']).toBe('18.1');
    expect(headers['X-Device-Model']).toBe('iPhone 15');
  });

  it('leaves the header out when the version is not set', async () => {
    const mockedConfig = Config as jest.Mocked<typeof Config>;
    const saved = mockedConfig.IOS_APP_VERSION_NAME;
    mockedConfig.IOS_APP_VERSION_NAME = '';
    try {
      await authenticatedFetch(
        'https://api.test/v1/library/tenses',
        {method: 'GET'},
        fetchImpl,
      );
    } finally {
      mockedConfig.IOS_APP_VERSION_NAME = saved;
    }

    const headers = fetchImpl.mock.calls[0][1].headers;
    expect(headers).not.toHaveProperty('X-App-Version');
    expect(headers).not.toHaveProperty('X-App-Platform');
  });
});
