import {getAppConfig} from '@core/api/appConfig';
import {authenticatedFetch} from '@core/api/authenticatedFetch';

import {
  createRecordingMetadata,
  joinRecordingUploadUrl,
  RECORDING_UPLOAD_MIME,
  RecordingUploadUrlError,
  uploadRecordingBinary,
} from '../recordingClient';

jest.mock('@core/api/appConfig', () => ({
  getAppConfig: jest.fn(),
}));

jest.mock('@core/api/authenticatedFetch', () => ({
  authenticatedFetch: jest.fn(),
}));

const mockedConfig = getAppConfig as jest.Mock;
const mockedAuthFetch = authenticatedFetch as jest.Mock;

const baseRequest = {
  mime_type: RECORDING_UPLOAD_MIME,
  byte_size: 100,
  sha256: 'a'.repeat(64),
  client_recording_id: '11111111-1111-4111-8111-111111111111',
  lesson_id: '22222222-2222-4222-8222-222222222222',
  sentence_id: '33333333-3333-4333-8333-333333333333',
  mode: 'shadowing' as const,
  duration_ms: 1200,
};

describe('joinRecordingUploadUrl', () => {
  it('joins a relative path with apiBaseUrl', () => {
    expect(
      joinRecordingUploadUrl(
        'https://api.lingobites.app/',
        '/v1/recordings/rec/content',
      ),
    ).toBe('https://api.lingobites.app/v1/recordings/rec/content');
  });

  it('rejects an absolute URL on a different origin', () => {
    expect(() =>
      joinRecordingUploadUrl(
        'https://api.lingobites.app',
        'https://evil.example/upload',
      ),
    ).toThrow(RecordingUploadUrlError);
  });
});

describe('recordingClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedConfig.mockReturnValue({apiBaseUrl: 'https://api.lingobites.app'});
  });

  it('POST uses audio/mp4 and joins the PUT upload URL with apiBaseUrl', async () => {
    mockedAuthFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({
          request_id: 'req',
          status: 'success',
          recording: {recording_id: 'rec-1'},
          upload: {
            method: 'PUT',
            url: '/v1/recordings/rec-1/content',
            content_type: RECORDING_UPLOAD_MIME,
          },
        }),
      })
      .mockResolvedValueOnce({ok: true, status: 200});

    const createResult = await createRecordingMetadata(baseRequest, {
      expectedUserId: 'user-1',
    });
    expect(createResult.ok).toBe(true);
    expect(mockedAuthFetch.mock.calls[0][0]).toBe(
      'https://api.lingobites.app/v1/recordings',
    );
    expect(JSON.parse(mockedAuthFetch.mock.calls[0][1].body as string)).toEqual(
      baseRequest,
    );

    const blob = new ArrayBuffer(8);
    const uploadResult = await uploadRecordingBinary(
      '/v1/recordings/rec-1/content',
      RECORDING_UPLOAD_MIME,
      blob,
      {expectedUserId: 'user-1'},
    );
    expect(uploadResult.ok).toBe(true);
    expect(mockedAuthFetch.mock.calls[1][0]).toBe(
      'https://api.lingobites.app/v1/recordings/rec-1/content',
    );
    expect(mockedAuthFetch.mock.calls[1][1].headers['Content-Type']).toBe(
      RECORDING_UPLOAD_MIME,
    );
  });

  it('sends a Blob typed as the upload MIME (expo/fetch uses the Blob type)', async () => {
    mockedConfig.mockReturnValue({apiBaseUrl: 'https://api.lingobites.app'});
    mockedAuthFetch.mockResolvedValueOnce({ok: true, status: 200});

    const fileBlob = new Blob(['12345678']).slice(0, 8, 'audio/x-m4a');
    const result = await uploadRecordingBinary(
      '/v1/recordings/rec-1/content',
      RECORDING_UPLOAD_MIME,
      fileBlob,
    );

    expect(result.ok).toBe(true);
    const sent = mockedAuthFetch.mock.calls[0][1].body as Blob;
    expect(sent.type).toBe(RECORDING_UPLOAD_MIME);
    expect(sent.size).toBe(8);
  });

  it('marks 400 create failures as non-retryable', async () => {
    mockedAuthFetch.mockResolvedValue({
      ok: false,
      status: 400,
      clone: () => ({
        json: async () => ({error: {code: 'VALIDATION_RECORDING'}}),
      }),
      json: async () => ({error: {code: 'VALIDATION_RECORDING'}}),
    });

    const result = await createRecordingMetadata(baseRequest);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryable).toBe(false);
    }
  });
});
