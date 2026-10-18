import {
  createRecordingMetadata,
  RECORDING_UPLOAD_CONSENT_WITHDRAWN,
  RECORDING_UPLOAD_MIME,
  uploadRecordingBinary,
} from '@features/speaking';

import {getAppConfig} from '@core/api/appConfig';
import {authenticatedFetch} from '@core/api/authenticatedFetch';
import {createRequestId} from '@core/api/requestId';
import {createTimeoutSignal} from '@core/api/timeout';
import {
  type PronunciationAttempt,
  PronunciationAttemptResponseSchema,
  PronunciationCapabilitySchema,
} from '@core/schemas/pronunciation';
import {PRONUNCIATION_MAX_DURATION_MS} from '@core/schemas/recordings';

/**
 * Pronunciation step 3: the Server side of a reading. The learner waits for
 * the result, so a reading is sent at once and never queued: without a
 * network it is simply not scored. The audio goes out only under the
 * pronunciation consent, checked again right before each request.
 */

const TIMEOUT_MS = 15_000;

function url(path: string): string {
  return `${getAppConfig().apiBaseUrl.replace(/\/+$/, '')}${path}`;
}

/**
 * Whether the Server scores pronunciation now (flag on, ffmpeg present).
 * The endpoint is public, so this is a plain `fetch`, like the YouTube
 * probe. Fail-closed: any problem reads as `false`.
 */
export async function fetchPronunciationEnabled(
  signal?: AbortSignal,
  fetchImpl: typeof fetch = fetch,
): Promise<boolean> {
  try {
    const response = await fetchImpl(url('/v1/capabilities'), {
      headers: {Accept: 'application/json'},
      signal,
    });
    if (!response.ok) return false;
    const parsed = PronunciationCapabilitySchema.safeParse(
      await response.json(),
    );
    return parsed.success
      ? parsed.data.capabilities.pronunciation.enabled
      : false;
  } catch {
    return false;
  }
}

/** The bytes of a finished reading, as `readRecordingFileForUpload` gives them. */
export type ReadingFile = {
  byteSize: number;
  sha256: string;
  binary: Blob | ArrayBuffer;
};

export type SubmitReadingFailure =
  /** The learner withdrew the consent: nothing was sent. */
  | 'consent'
  /** The Server does not score this account (flag off, or a kid). */
  | 'disabled'
  /** The item is gone or no longer published. */
  | 'item_not_found'
  /** No network: try again once online. */
  | 'offline'
  /** Anything else the Server refused or failed on. */
  | 'failed';

export type SubmitReadingResult =
  {ok: true; recordingId: string} | {ok: false; reason: SubmitReadingFailure};

function failureOf(errorCode: string): SubmitReadingFailure {
  switch (errorCode) {
    case RECORDING_UPLOAD_CONSENT_WITHDRAWN:
      return 'consent';
    case 'PRONUNCIATION_DISABLED':
      return 'disabled';
    case 'PRONUNCIATION_ITEM_NOT_FOUND':
      return 'item_not_found';
    case 'NETWORK_ERROR':
      return 'offline';
    default:
      return 'failed';
  }
}

/** Creates the reading on the Server and uploads its audio. */
export async function submitReading(
  input: {itemId: string; durationMs: number; file: ReadingFile},
  options: {fetchImpl?: typeof fetch; signal?: AbortSignal} = {},
): Promise<SubmitReadingResult> {
  const clientOptions = {
    consent: 'pronunciation' as const,
    fetchImpl: options.fetchImpl,
    signal: options.signal,
  };
  const created = await createRecordingMetadata(
    {
      client_recording_id: createRequestId(),
      mode: 'pronunciation',
      item_id: input.itemId,
      duration_ms: Math.min(
        PRONUNCIATION_MAX_DURATION_MS,
        Math.max(1, Math.round(input.durationMs)),
      ),
      mime_type: RECORDING_UPLOAD_MIME,
      byte_size: input.file.byteSize,
      sha256: input.file.sha256,
    },
    clientOptions,
  );
  if (!created.ok) return {ok: false, reason: failureOf(created.errorCode)};
  const uploaded = await uploadRecordingBinary(
    created.data.upload.url,
    created.data.upload.content_type || RECORDING_UPLOAD_MIME,
    input.file.binary,
    clientOptions,
  );
  if (!uploaded.ok) return {ok: false, reason: failureOf(uploaded.errorCode)};
  return {ok: true, recordingId: created.data.recording.recording_id};
}

export type FetchReadingResult =
  /** Uploaded but not scored yet: ask again shortly. */
  | {status: 'pending'}
  /** A final result: scored, unscorable or failed. */
  | {status: 'done'; attempt: PronunciationAttempt}
  /** No such reading for this learner. */
  | {status: 'not_found'}
  /** The Server stopped scoring pronunciation. */
  | {status: 'disabled'}
  | {status: 'offline'};

export async function fetchReading(
  recordingId: string,
  options: {fetchImpl?: typeof fetch; signal?: AbortSignal} = {},
): Promise<FetchReadingResult> {
  const timeout = createTimeoutSignal(TIMEOUT_MS, options.signal);
  try {
    const response = await authenticatedFetch(
      url(`/v1/pronunciation/attempts/${encodeURIComponent(recordingId)}`),
      {
        method: 'GET',
        headers: {Accept: 'application/json'},
        signal: timeout.signal,
      },
      options.fetchImpl,
    );
    if (response.status === 404) return {status: 'not_found'};
    if (response.status === 403) return {status: 'disabled'};
    if (!response.ok) return {status: 'offline'};
    const parsed = PronunciationAttemptResponseSchema.safeParse(
      await response.json(),
    );
    if (!parsed.success) return {status: 'offline'};
    const attempt = parsed.data.attempt;
    return attempt.status === 'pending'
      ? {status: 'pending'}
      : {status: 'done', attempt};
  } catch {
    return {status: 'offline'};
  } finally {
    timeout.cleanup();
  }
}
