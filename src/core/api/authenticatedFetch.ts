import {Platform} from 'react-native';

import {
  assertSyncDrainOwnershipUnchanged,
  SyncOwnershipChangedError,
} from '@core/sync/syncDrainOwnership';

import {createAuthClient} from '../auth/authClient';
import {ensureValidSession} from '../auth/authSession';
import {getAppVersion} from './appConfig';
import {trackReachability} from './connectivity';
import {getDeviceHeaders} from './deviceHeaders';

function mergeHeaders(
  initHeaders?: any,
  extra?: Record<string, string>,
): Record<string, string> {
  const result: Record<string, string> = {};
  if (initHeaders) {
    if (Array.isArray(initHeaders)) {
      initHeaders.forEach(([key, value]) => {
        result[key] = value;
      });
    } else if (typeof (initHeaders as any).forEach === 'function') {
      (initHeaders as any).forEach((value: string, key: string) => {
        result[key] = value;
      });
    } else {
      Object.assign(result, initHeaders);
    }
  }
  if (extra) {
    Object.assign(result, extra);
  }
  // The Server's version rules (`app.versions`) are per platform: the
  // minimum it still serves, and from which version grammar items show.
  const appVersion = getAppVersion();
  if (appVersion) {
    result['X-App-Version'] = appVersion;
    result['X-App-Platform'] = Platform.OS;
  }
  Object.assign(result, getDeviceHeaders());
  return result;
}

export type AuthenticatedFetchOptions = {
  /** When set, aborts before sending unless the active session matches this user. */
  expectedUserId?: string;
  /** Evaluated immediately before each `fetch` (including a 401 retry). */
  beforeSend?: () => boolean | Promise<boolean>;
};

export class UploadSendPreconditionError extends Error {
  readonly code = 'UPLOAD_SEND_PRECONDITION_FAILED';

  constructor() {
    super('UPLOAD_SEND_PRECONDITION_FAILED');
    this.name = 'UploadSendPreconditionError';
  }
}

async function assertSendPreconditions(
  options?: AuthenticatedFetchOptions,
): Promise<void> {
  if (!options?.beforeSend) {
    return;
  }
  const allowed = await options.beforeSend();
  if (!allowed) {
    throw new UploadSendPreconditionError();
  }
}

export async function authenticatedFetch(
  url: string,
  init?: RequestInit,
  fetchImpl: typeof fetch = fetch,
  options?: AuthenticatedFetchOptions,
): Promise<Response> {
  const authClient = createAuthClient({fetchImpl});

  let sessionResult = await ensureValidSession({client: authClient});

  if (options?.expectedUserId !== undefined) {
    if (
      sessionResult.status !== 'valid' ||
      sessionResult.userId !== options.expectedUserId
    ) {
      throw new SyncOwnershipChangedError();
    }
  }

  if (!(await assertSyncDrainOwnershipUnchanged())) {
    throw new SyncOwnershipChangedError();
  }

  let accessToken =
    sessionResult.status === 'valid'
      ? sessionResult.session.access_token
      : null;

  const headers = mergeHeaders(
    init?.headers,
    accessToken ? {Authorization: `Bearer ${accessToken}`} : undefined,
  );

  await assertSendPreconditions(options);
  let response = await trackReachability<Response>(
    fetchImpl(url, {...init, headers}),
    init?.signal,
  );

  if (response?.status === 401 && sessionResult.status === 'valid') {
    sessionResult = await ensureValidSession({
      client: authClient,
      forceRefresh: true,
    });
    if (options?.expectedUserId !== undefined) {
      if (
        sessionResult.status !== 'valid' ||
        sessionResult.userId !== options.expectedUserId
      ) {
        throw new SyncOwnershipChangedError();
      }
    }
    if (!(await assertSyncDrainOwnershipUnchanged())) {
      throw new SyncOwnershipChangedError();
    }
    if (sessionResult.status === 'valid') {
      const retryHeaders = mergeHeaders(init?.headers, {
        Authorization: `Bearer ${sessionResult.session.access_token}`,
      });
      await assertSendPreconditions(options);
      response = await trackReachability<Response>(
        fetchImpl(url, {...init, headers: retryHeaders}),
        init?.signal,
      );
    }
  }

  return response;
}
