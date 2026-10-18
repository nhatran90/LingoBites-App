import {setPronunciationConsent} from '@features/speaking';

import {getAppConfig} from '@core/api/appConfig';
import {
  authenticatedFetch,
  type AuthenticatedFetchOptions,
  UploadSendPreconditionError,
} from '@core/api/authenticatedFetch';
import {resetDatabaseForTests} from '@core/db/database';
import {runMigrations} from '@core/db/migrations';

import {openRealSqlite} from '@test/support/adversarial/realSqlite';

import {
  fetchPronunciationEnabled,
  fetchReading,
  submitReading,
} from '../pronunciationClient';

jest.mock('@core/api/appConfig', () => ({
  getAppConfig: jest.fn(),
}));

jest.mock('@core/api/authenticatedFetch', () => {
  const actual = jest.requireActual('@core/api/authenticatedFetch');
  return {...actual, authenticatedFetch: jest.fn()};
});

const mockedConfig = getAppConfig as jest.Mock;
const mockedAuthFetch = authenticatedFetch as jest.Mock;

const API = 'https://api.lingobites.app';
const ITEM_ID = '44444444-4444-4444-8444-444444444444';
const LESSON_TARGET = {source: 'lesson', itemId: ITEM_ID} as const;
const RECORDING_ID = '55555555-5555-4555-8555-555555555555';
const FILE = {
  byteSize: 2048,
  sha256: 'b'.repeat(64),
  binary: new ArrayBuffer(8),
};

/** A scored reading, as the Server's step-2 tests return it. */
const SCORED = {
  request_id: 'req',
  status: 'success',
  attempt: {
    recording_id: RECORDING_ID,
    item_id: ITEM_ID,
    status: 'scored',
    unscorable_reason: null,
    reference_text: 'The ship is big',
    scores: {
      pron: 78,
      accuracy: 71,
      fluency: 88,
      completeness: 100,
      prosody: null,
    },
    words: [
      {
        text: 'ship',
        accuracy: 42,
        error: 'mispronunciation',
        phonemes: [
          {ipa: 'ʃ', accuracy: 88},
          {ipa: 'ɪ', accuracy: 13},
        ],
      },
      {text: null, accuracy: 0, error: 'insertion', phonemes: []},
    ],
    created_at: '2026-10-18T03:00:00.000Z',
  },
};

function jsonResponse(status: number, body: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    clone() {
      return this;
    },
  };
}

const CREATED = jsonResponse(201, {
  request_id: 'req',
  status: 'success',
  recording: {recording_id: RECORDING_ID},
  upload: {
    method: 'PUT',
    url: `/v1/recordings/${RECORDING_ID}/content`,
    content_type: 'audio/mp4',
  },
});

beforeEach(() => {
  jest.clearAllMocks();
  mockedConfig.mockReturnValue({apiBaseUrl: API});
  const db = openRealSqlite(':memory:');
  runMigrations(db);
  resetDatabaseForTests(db);
});

afterEach(() => {
  resetDatabaseForTests(null);
});

describe('fetchPronunciationEnabled', () => {
  it('reads the public capability and fails closed', async () => {
    const fetchImpl = jest.fn().mockResolvedValue(
      jsonResponse(200, {
        capabilities: {
          youtube: {enabled: true},
          pronunciation: {enabled: true},
        },
      }),
    );
    await expect(
      fetchPronunciationEnabled(
        undefined,
        fetchImpl as unknown as typeof fetch,
      ),
    ).resolves.toBe(true);
    expect(fetchImpl.mock.calls[0][0]).toBe(`${API}/v1/capabilities`);

    for (const respond of [
      // A Server from before step 2 has no pronunciation block.
      () =>
        Promise.resolve(
          jsonResponse(200, {capabilities: {youtube: {enabled: true}}}),
        ),
      () => Promise.resolve(jsonResponse(503, {})),
      () => Promise.reject(new TypeError('Network request failed')),
    ]) {
      await expect(
        fetchPronunciationEnabled(
          undefined,
          jest.fn(respond) as unknown as typeof fetch,
        ),
      ).resolves.toBe(false);
    }
  });
});

describe('submitReading', () => {
  it('creates a pronunciation recording and uploads it under the pronunciation consent', async () => {
    mockedAuthFetch
      .mockResolvedValueOnce(CREATED)
      .mockResolvedValueOnce({ok: true, status: 200});

    const result = await submitReading({
      target: {source: 'lesson', itemId: ITEM_ID},
      durationMs: 3210.6,
      file: FILE,
    });

    expect(result).toEqual({ok: true, recordingId: RECORDING_ID});
    const [createUrl, createInit, , createAuth] = mockedAuthFetch.mock.calls[0];
    expect(createUrl).toBe(`${API}/v1/recordings`);
    const body = JSON.parse(createInit.body as string);
    expect(body).toEqual({
      client_recording_id: expect.stringMatching(/^[0-9a-f-]{36}$/),
      mode: 'pronunciation',
      source: 'lesson',
      item_id: ITEM_ID,
      duration_ms: 3211,
      mime_type: 'audio/mp4',
      byte_size: 2048,
      sha256: 'b'.repeat(64),
    });
    expect(mockedAuthFetch.mock.calls[1][0]).toBe(
      `${API}/v1/recordings/${RECORDING_ID}/content`,
    );

    // Each request checks the pronunciation consent right before it goes.
    const gate = (createAuth as AuthenticatedFetchOptions).beforeSend!;
    expect(await gate()).toBe(false);
    setPronunciationConsent('on');
    expect(await gate()).toBe(true);
    const uploadGate = (
      mockedAuthFetch.mock.calls[1][3] as AuthenticatedFetchOptions
    ).beforeSend!;
    setPronunciationConsent('off');
    expect(await uploadGate()).toBe(false);
  });

  it('sends a saved word by its own text, under its source', async () => {
    mockedAuthFetch
      .mockResolvedValueOnce(CREATED)
      .mockResolvedValueOnce({ok: true, status: 200});
    await submitReading({
      target: {source: 'review_word', referenceText: 'thorough'},
      durationMs: 1200,
      file: FILE,
    });
    const body = JSON.parse(mockedAuthFetch.mock.calls[0][1].body as string);
    expect(body.source).toBe('review_word');
    expect(body.reference_text).toBe('thorough');
    expect(body).not.toHaveProperty('item_id');
  });

  it('keeps the duration within what the Server accepts', async () => {
    mockedAuthFetch
      .mockResolvedValueOnce(CREATED)
      .mockResolvedValueOnce({ok: true, status: 200});
    await submitReading({
      target: LESSON_TARGET,
      durationMs: 15_400,
      file: FILE,
    });
    expect(
      JSON.parse(mockedAuthFetch.mock.calls[0][1].body as string).duration_ms,
    ).toBe(15_000);
  });

  it('names why a reading was not sent', async () => {
    const cases: Array<[() => Promise<unknown>, string]> = [
      [
        () =>
          Promise.resolve(
            jsonResponse(403, {error: {code: 'PRONUNCIATION_DISABLED'}}),
          ),
        'disabled',
      ],
      [
        () =>
          Promise.resolve(
            jsonResponse(404, {error: {code: 'PRONUNCIATION_ITEM_NOT_FOUND'}}),
          ),
        'item_not_found',
      ],
      [() => Promise.reject(new UploadSendPreconditionError()), 'consent'],
      [
        () => Promise.reject(new TypeError('Network request failed')),
        'offline',
      ],
      [() => Promise.resolve(jsonResponse(500, {})), 'failed'],
    ];
    for (const [respond, reason] of cases) {
      mockedAuthFetch.mockReset();
      mockedAuthFetch.mockImplementationOnce(respond);
      await expect(
        submitReading({target: LESSON_TARGET, durationMs: 2000, file: FILE}),
      ).resolves.toEqual({ok: false, reason});
      expect(mockedAuthFetch).toHaveBeenCalledTimes(1);
    }

    // The upload can fail on its own too.
    mockedAuthFetch.mockReset();
    mockedAuthFetch
      .mockResolvedValueOnce(CREATED)
      .mockRejectedValueOnce(new TypeError('Network request failed'));
    await expect(
      submitReading({target: LESSON_TARGET, durationMs: 2000, file: FILE}),
    ).resolves.toEqual({ok: false, reason: 'offline'});
  });
});

describe('fetchReading', () => {
  it('returns a final result, or pending while it is scored', async () => {
    mockedAuthFetch.mockResolvedValueOnce(jsonResponse(200, SCORED));
    const done = await fetchReading(RECORDING_ID);
    expect(mockedAuthFetch.mock.calls[0][0]).toBe(
      `${API}/v1/pronunciation/attempts/${RECORDING_ID}`,
    );
    expect(done).toEqual({status: 'done', attempt: SCORED.attempt});

    mockedAuthFetch.mockResolvedValueOnce(
      jsonResponse(200, {
        ...SCORED,
        attempt: {
          ...SCORED.attempt,
          status: 'pending',
          reference_text: null,
          scores: null,
          words: [],
          created_at: null,
        },
      }),
    );
    await expect(fetchReading(RECORDING_ID)).resolves.toEqual({
      status: 'pending',
    });
  });

  it('tells missing, disabled and unreachable apart', async () => {
    const cases: Array<[() => Promise<unknown>, string]> = [
      [() => Promise.resolve(jsonResponse(404, {})), 'not_found'],
      [() => Promise.resolve(jsonResponse(403, {})), 'disabled'],
      [() => Promise.resolve(jsonResponse(502, {})), 'offline'],
      // A body the app cannot read is treated like no answer.
      [
        () => Promise.resolve(jsonResponse(200, {attempt: {status: 'odd'}})),
        'offline',
      ],
      [
        () => Promise.reject(new TypeError('Network request failed')),
        'offline',
      ],
    ];
    for (const [respond, status] of cases) {
      mockedAuthFetch.mockImplementationOnce(respond);
      await expect(fetchReading(RECORDING_ID)).resolves.toEqual({status});
    }
  });
});
