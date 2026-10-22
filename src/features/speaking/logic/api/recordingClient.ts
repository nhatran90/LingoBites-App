import {getAppConfig} from '@core/api/appConfig';
import {
  authenticatedFetch,
  type AuthenticatedFetchOptions,
  UploadSendPreconditionError,
} from '@core/api/authenticatedFetch';
import {createTimeoutSignal} from '@core/api/timeout';
import type {
  CreateLessonTaskRecordingRequest,
  CreatePronunciationRecordingRequest,
  CreateRecordingRequest,
  CreateRecordingSuccessResponse,
} from '@core/schemas/recordings';

import {
  isEvaluationConsentOn,
  isPronunciationConsentOn,
  isRecordingUploadConsentOn,
} from '../upload/recordingConsent';

export const RECORDING_UPLOAD_MIME = 'audio/mp4';

export const RECORDING_UPLOAD_CONSENT_WITHDRAWN =
  'RECORDING_UPLOAD_CONSENT_WITHDRAWN';

export type CreateRecordingResult =
  | {ok: true; data: CreateRecordingSuccessResponse; status: number}
  | {
      ok: false;
      errorCode: string;
      message: string;
      retryable: boolean;
      httpStatus?: number;
    };

export type UploadBinaryResult =
  | {ok: true; status: number}
  | {
      ok: false;
      errorCode: string;
      message: string;
      retryable: boolean;
      httpStatus?: number;
    };

export type RecordingClientOptions = {
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  expectedUserId?: string;
  /**
   * PR 14: which consent gates the send. Spoken task answers go out under
   * the grading consent, pronunciation readings (step 3) under the
   * pronunciation consent; every other recording under the upload consent.
   */
  consent?: 'upload' | 'evaluation' | 'pronunciation';
};

export class RecordingUploadUrlError extends Error {
  readonly code = 'UPLOAD_URL_ORIGIN_MISMATCH';

  constructor(message = 'Upload URL origin does not match API base URL') {
    super(message);
    this.name = 'RecordingUploadUrlError';
  }
}

/** Joins a relative upload path with `apiBaseUrl`; rejects cross-origin absolute URLs. */
export function joinRecordingUploadUrl(
  apiBaseUrl: string,
  uploadUrl: string,
): string {
  const trimmedBase = apiBaseUrl.replace(/\/+$/, '');
  if (/^https?:\/\//i.test(uploadUrl)) {
    const baseOrigin = new URL(trimmedBase).origin;
    const uploadOrigin = new URL(uploadUrl).origin;
    if (uploadOrigin !== baseOrigin) {
      throw new RecordingUploadUrlError();
    }
    return uploadUrl;
  }
  const path = uploadUrl.startsWith('/') ? uploadUrl : `/${uploadUrl}`;
  return `${trimmedBase}${path}`;
}

type ApiErrorBody = {
  error?: {code?: string; message?: string};
};

async function readApiErrorCode(response: Response): Promise<string | null> {
  try {
    const body = (await response.clone().json()) as ApiErrorBody;
    const code = body.error?.code;
    return typeof code === 'string' && code.length > 0 ? code : null;
  } catch {
    return null;
  }
}

function isPermanentCreateFailure(
  status: number,
  apiCode: string | null,
): boolean {
  if (status === 400 || status === 413 || status === 422) {
    return true;
  }
  if (status === 409 && apiCode === 'RECORDING_IDEMPOTENCY_CONFLICT') {
    return true;
  }
  return false;
}

function isPermanentUploadFailure(
  status: number,
  apiCode: string | null,
): boolean {
  if (status === 400 || status === 413 || status === 422) {
    return true;
  }
  if (
    status === 409 &&
    (apiCode === 'RECORDING_IDEMPOTENCY_CONFLICT' ||
      apiCode === 'RECORDING_PURGED')
  ) {
    return true;
  }
  if (status === 409 && apiCode === 'RECORDING_ALREADY_COMPLETED') {
    return false;
  }
  return false;
}

function isRetryableHttpStatus(status: number): boolean {
  return status >= 500 || status === 429 || status === 404;
}

function recordingAuthenticatedFetchOptions(
  options: RecordingClientOptions,
): AuthenticatedFetchOptions {
  const auth: AuthenticatedFetchOptions = {
    beforeSend: () =>
      options.consent === 'evaluation'
        ? isEvaluationConsentOn()
        : options.consent === 'pronunciation'
          ? isPronunciationConsentOn()
          : isRecordingUploadConsentOn(),
  };
  if (options.expectedUserId !== undefined) {
    auth.expectedUserId = options.expectedUserId;
  }
  return auth;
}

function consentWithdrawnResult(): {
  ok: false;
  errorCode: string;
  message: string;
  retryable: false;
} {
  return {
    ok: false,
    errorCode: RECORDING_UPLOAD_CONSENT_WITHDRAWN,
    message: 'Recording upload consent is not on',
    retryable: false,
  };
}

export async function createRecordingMetadata(
  request:
    | CreateRecordingRequest
    | CreateLessonTaskRecordingRequest
    | CreatePronunciationRecordingRequest,
  options: RecordingClientOptions = {},
): Promise<CreateRecordingResult> {
  const {apiBaseUrl} = getAppConfig();
  const timeout = createTimeoutSignal(15000, options.signal);
  const signal = timeout.signal;

  try {
    const response = await authenticatedFetch(
      `${apiBaseUrl.replace(/\/+$/, '')}/v1/recordings`,
      {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
        signal,
      },
      options.fetchImpl,
      recordingAuthenticatedFetchOptions(options),
    );
    timeout.cleanup();
    const apiCode = response.ok ? null : await readApiErrorCode(response);
    if (!response.ok) {
      const permanent = isPermanentCreateFailure(response.status, apiCode);
      return {
        ok: false,
        errorCode: apiCode ?? `HTTP_${response.status}`,
        message: `Create metadata failed: ${response.status}`,
        retryable: !permanent && isRetryableHttpStatus(response.status),
        httpStatus: response.status,
      };
    }
    const data = (await response.json()) as CreateRecordingSuccessResponse;
    return {ok: true, data, status: response.status};
  } catch (error) {
    timeout.cleanup();
    if (error instanceof UploadSendPreconditionError) {
      return consentWithdrawnResult();
    }
    if (error instanceof RecordingUploadUrlError) {
      return {
        ok: false,
        errorCode: error.code,
        message: error.message,
        retryable: false,
      };
    }
    return {
      ok: false,
      errorCode: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
      retryable: true,
    };
  }
}

export async function uploadRecordingBinary(
  uploadUrl: string,
  contentType: string,
  binaryData: Blob | ArrayBuffer,
  options: RecordingClientOptions = {},
): Promise<UploadBinaryResult> {
  const {apiBaseUrl} = getAppConfig();
  let resolvedUrl: string;
  try {
    resolvedUrl = joinRecordingUploadUrl(apiBaseUrl, uploadUrl);
  } catch (error) {
    if (error instanceof RecordingUploadUrlError) {
      return {
        ok: false,
        errorCode: error.code,
        message: error.message,
        retryable: false,
      };
    }
    throw error;
  }

  const timeout = createTimeoutSignal(60000, options.signal);
  const signal = timeout.signal;
  // The global fetch is expo/fetch, which sends a Blob body with the Blob's
  // own type as Content-Type, over the header below. A file read on iOS has
  // a type other than `audio/mp4`, which the Server refuses
  // (RECORDING_MIME_MISMATCH), so the Blob is given the upload type.
  const body =
    binaryData instanceof Blob && binaryData.type !== contentType
      ? binaryData.slice(0, binaryData.size, contentType)
      : binaryData;

  try {
    const response = await authenticatedFetch(
      resolvedUrl,
      {
        method: 'PUT',
        headers: {
          'Content-Type': contentType,
        },
        body,
        signal,
      },
      options.fetchImpl,
      recordingAuthenticatedFetchOptions(options),
    );
    timeout.cleanup();
    const apiCode = response.ok ? null : await readApiErrorCode(response);
    if (response.ok) {
      return {ok: true, status: response.status};
    }
    if (response.status === 409 && apiCode === 'RECORDING_ALREADY_COMPLETED') {
      return {ok: true, status: response.status};
    }
    const permanent = isPermanentUploadFailure(response.status, apiCode);
    return {
      ok: false,
      errorCode: apiCode ?? `HTTP_${response.status}`,
      message: `Upload failed: ${response.status}`,
      retryable: !permanent && isRetryableHttpStatus(response.status),
      httpStatus: response.status,
    };
  } catch (error) {
    timeout.cleanup();
    if (error instanceof UploadSendPreconditionError) {
      return consentWithdrawnResult();
    }
    return {
      ok: false,
      errorCode: 'NETWORK_ERROR',
      message: error instanceof Error ? error.message : 'Unknown error',
      retryable: true,
    };
  }
}
