import {jest} from '@jest/globals';
import React from 'react';
import {AppState, type AppStateStatus} from 'react-native';
import ReactTestRenderer, {act} from 'react-test-renderer';

import type {ReadingRecorder} from '@features/speaking';

import type {PronunciationAttempt} from '@core/schemas/pronunciation';

import type {
  FetchReadingResult,
  SubmitReadingResult,
} from '../pronunciationClient';
import {
  POLL_TIMEOUT_MS,
  type PracticeDeps,
  type PronunciationPractice,
  usePronunciationPractice,
} from '../usePronunciationPractice';

const ITEM_ID = '44444444-4444-4444-8444-444444444444';
const RECORDING_ID = '55555555-5555-4555-8555-555555555555';

const SCORED: PronunciationAttempt = {
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
    {text: 'ship', accuracy: 42, error: 'mispronunciation', phonemes: []},
  ],
  created_at: '2026-10-18T03:00:00.000Z',
};

/** A recorder that writes nothing: each take is a new path, of `nextMs`. */
function fakeRecorder() {
  let take = 0;
  const recorder = {
    nextMs: 2400,
    startRecording: jest.fn(async (_mode: string, _recordingId: string) => {
      take += 1;
      return {ok: true as const, filePath: `/recordings/take-${take}.m4a`};
    }),
    stopRecording: jest.fn(async (filePath: string) => ({
      ok: true as const,
      filePath,
      durationMs: recorder.nextMs,
    })),
    playRecording: jest.fn(async () => ({ok: true as const})),
    stopPlayback: jest.fn(async () => undefined),
    deleteRecordingFile: jest.fn(async () => undefined),
    readRecordingFileForUpload: jest.fn(async () => ({
      ok: true as const,
      byteSize: 2048,
      sha256: 'b'.repeat(64),
      binary: new ArrayBuffer(8),
    })),
  };
  return recorder;
}

type Fakes = {
  recorder: ReturnType<typeof fakeRecorder>;
  consent: 'on' | 'off' | 'undecided';
  submitReading: jest.Mock<() => Promise<SubmitReadingResult>>;
  fetchReading: jest.Mock<() => Promise<FetchReadingResult>>;
};

let latest: PronunciationPractice;
let fakes: Fakes;
let appStateListener: ((state: AppStateStatus) => void) | null;

function Probe({deps}: {deps: Partial<PracticeDeps>}) {
  latest = usePronunciationPractice(ITEM_ID, deps);
  return null;
}

async function mount() {
  const deps: Partial<PracticeDeps> = {
    recorder: fakes.recorder as unknown as ReadingRecorder,
    submitReading:
      fakes.submitReading as unknown as PracticeDeps['submitReading'],
    fetchReading: fakes.fetchReading as unknown as PracticeDeps['fetchReading'],
    consent: {
      isOn: () => fakes.consent === 'on',
      shouldAsk: () => fakes.consent === 'undecided',
      set: value => {
        fakes.consent = value;
      },
    },
  };
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await act(async () => {
    tree = ReactTestRenderer.create(<Probe deps={deps} />);
  });
  return tree;
}

/** Runs timers and the promises they start. */
async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
  await act(async () => undefined);
}

async function recordAndSend() {
  await act(async () => latest.start());
  expect(latest.state).toEqual({phase: 'recording'});
  await act(async () => latest.stop());
}

beforeEach(() => {
  jest.useFakeTimers();
  appStateListener = null;
  jest
    .spyOn(AppState, 'addEventListener')
    .mockImplementation((_type, listener) => {
      appStateListener = listener as (state: AppStateStatus) => void;
      return {remove: () => undefined} as ReturnType<
        typeof AppState.addEventListener
      >;
    });
  fakes = {
    recorder: fakeRecorder(),
    consent: 'on',
    submitReading: jest.fn(async () => ({
      ok: true as const,
      recordingId: RECORDING_ID,
    })),
    fetchReading: jest.fn(async () => ({status: 'pending' as const})),
  };
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

describe('usePronunciationPractice', () => {
  it('asks for the consent first; a no keeps the recorder off', async () => {
    fakes.consent = 'undecided';
    await mount();
    expect(latest.state).toEqual({phase: 'consent'});

    await act(async () => latest.answerConsent(false));
    expect(fakes.consent).toBe('off');
    expect(latest.state).toEqual({phase: 'declined'});
    await act(async () => latest.start());
    expect(fakes.recorder.startRecording).not.toHaveBeenCalled();

    await act(async () => latest.answerConsent(true));
    expect(latest.state).toEqual({phase: 'idle'});
  });

  it('records, sends and shows the scores; the take can be heard again', async () => {
    fakes.fetchReading
      .mockResolvedValueOnce({status: 'pending'})
      .mockResolvedValueOnce({status: 'done', attempt: SCORED});
    await mount();
    expect(latest.state).toEqual({phase: 'idle'});

    await recordAndSend();
    expect(fakes.recorder.startRecording).toHaveBeenCalledWith(
      'pronunciation',
      expect.stringMatching(/^pronunciation-/),
    );
    expect(fakes.submitReading).toHaveBeenCalledWith({
      itemId: ITEM_ID,
      durationMs: 2400,
      file: {byteSize: 2048, sha256: 'b'.repeat(64), binary: expect.anything()},
    });
    expect(latest.state).toEqual({phase: 'scoring'});

    await advance(800);
    expect(latest.state).toEqual({phase: 'scoring'});
    await advance(1000);
    expect(latest.state).toEqual({phase: 'scored', attempt: SCORED});
    expect(fakes.fetchReading).toHaveBeenCalledWith(RECORDING_ID);

    expect(latest.hasOwnTake).toBe(true);
    await act(async () => latest.playOwnTake());
    expect(fakes.recorder.playRecording).toHaveBeenCalledWith(
      '/recordings/take-1.m4a',
    );
    expect(fakes.recorder.deleteRecordingFile).not.toHaveBeenCalled();
  });

  it('stops on its own at 15 seconds', async () => {
    await mount();
    await act(async () => latest.start());
    await advance(14_999);
    expect(fakes.recorder.stopRecording).not.toHaveBeenCalled();
    await advance(1);
    expect(fakes.recorder.stopRecording).toHaveBeenCalledTimes(1);
    expect(latest.state).toEqual({phase: 'scoring'});
  });

  it('does not send a take under half a second', async () => {
    fakes.recorder.nextMs = 300;
    await mount();
    await recordAndSend();
    expect(latest.state).toEqual({phase: 'unscorable', reason: 'too_short'});
    expect(fakes.submitReading).not.toHaveBeenCalled();
    expect(fakes.recorder.deleteRecordingFile).toHaveBeenCalledWith(
      '/recordings/take-1.m4a',
    );
    expect(latest.hasOwnTake).toBe(false);
  });

  it('gives up after 30 seconds, and checks the same take again on request', async () => {
    await mount();
    await recordAndSend();
    await advance(POLL_TIMEOUT_MS + 3000);
    expect(latest.state).toEqual({phase: 'error', reason: 'slow'});
    const asked = fakes.fetchReading.mock.calls.length;

    fakes.fetchReading.mockResolvedValueOnce({status: 'done', attempt: SCORED});
    await act(async () => latest.checkAgain());
    expect(latest.state).toEqual({phase: 'scoring'});
    await advance(800);
    expect(latest.state).toEqual({phase: 'scored', attempt: SCORED});
    expect(fakes.fetchReading.mock.calls.length).toBe(asked + 1);
    expect(fakes.submitReading).toHaveBeenCalledTimes(1);
  });

  it('shows why the Server could not score the take', async () => {
    const cases: Array<[FetchReadingResult, unknown]> = [
      [
        {
          status: 'done',
          attempt: {
            ...SCORED,
            status: 'unscorable',
            unscorable_reason: 'no_speech',
            scores: null,
            words: [],
          },
        },
        {phase: 'unscorable', reason: 'no_speech'},
      ],
      [
        {status: 'done', attempt: {...SCORED, status: 'failed', scores: null}},
        {phase: 'error', reason: 'failed'},
      ],
      [{status: 'not_found'}, {phase: 'error', reason: 'failed'}],
      [{status: 'disabled'}, {phase: 'error', reason: 'disabled'}],
    ];
    for (const [answer, expected] of cases) {
      fakes.fetchReading.mockReset();
      fakes.fetchReading.mockResolvedValueOnce(answer);
      const tree = await mount();
      await recordAndSend();
      await advance(800);
      expect(latest.state).toEqual(expected);
      await act(async () => tree.unmount());
    }
  });

  it('names why the take was not sent; a withdrawn consent goes back to asking', async () => {
    const cases: Array<[SubmitReadingResult, unknown]> = [
      [
        {ok: false, reason: 'offline'},
        {phase: 'error', reason: 'offline'},
      ],
      [
        {ok: false, reason: 'disabled'},
        {phase: 'error', reason: 'disabled'},
      ],
      [
        {ok: false, reason: 'item_not_found'},
        {phase: 'error', reason: 'item_not_found'},
      ],
      [
        {ok: false, reason: 'failed'},
        {phase: 'error', reason: 'failed'},
      ],
    ];
    for (const [answer, expected] of cases) {
      fakes.submitReading.mockResolvedValueOnce(answer);
      const tree = await mount();
      await recordAndSend();
      expect(latest.state).toEqual(expected);
      expect(fakes.fetchReading).not.toHaveBeenCalled();
      await act(async () => tree.unmount());
    }

    // Withdrawn in Settings while the take was on its way.
    fakes.submitReading.mockImplementationOnce(async () => {
      fakes.consent = 'off';
      return {ok: false, reason: 'consent'};
    });
    await mount();
    await recordAndSend();
    expect(latest.state).toEqual({phase: 'declined'});
  });

  it('reports a refused microphone', async () => {
    fakes.recorder.startRecording.mockResolvedValueOnce({
      ok: false,
      errorCode: 'PERMISSION_DENIED',
      message: 'denied',
    } as never);
    await mount();
    await act(async () => latest.start());
    expect(latest.state).toEqual({phase: 'error', reason: 'mic_denied'});
  });

  it('try again drops the take and the pending result', async () => {
    await mount();
    await recordAndSend();
    await act(async () => latest.retry());
    expect(latest.state).toEqual({phase: 'idle'});
    expect(fakes.recorder.deleteRecordingFile).toHaveBeenCalledWith(
      '/recordings/take-1.m4a',
    );
    await advance(POLL_TIMEOUT_MS);
    expect(fakes.fetchReading).not.toHaveBeenCalled();

    await act(async () => latest.start());
    expect(fakes.recorder.startRecording).toHaveBeenCalledTimes(2);
    const ids = fakes.recorder.startRecording.mock.calls.map(call => call[1]);
    expect(ids[0]).not.toBe(ids[1]);
  });

  it('closing the sheet stops asking and deletes the take', async () => {
    const tree = await mount();
    await recordAndSend();
    await act(async () => tree.unmount());
    await advance(POLL_TIMEOUT_MS);
    expect(fakes.fetchReading).not.toHaveBeenCalled();
    expect(fakes.recorder.deleteRecordingFile).toHaveBeenCalledWith(
      '/recordings/take-1.m4a',
    );
  });

  it('closing mid-take stops the recorder before deleting the file', async () => {
    const tree = await mount();
    await act(async () => latest.start());
    await act(async () => tree.unmount());
    expect(fakes.recorder.stopRecording).toHaveBeenCalledTimes(1);
    expect(fakes.recorder.deleteRecordingFile).toHaveBeenCalledWith(
      '/recordings/take-1.m4a',
    );
    expect(fakes.submitReading).not.toHaveBeenCalled();
  });

  it('leaving the app mid-take drops it', async () => {
    await mount();
    await act(async () => latest.start());
    await act(async () => appStateListener?.('background'));
    expect(latest.state).toEqual({phase: 'idle'});
    expect(fakes.recorder.deleteRecordingFile).toHaveBeenCalledWith(
      '/recordings/take-1.m4a',
    );
    await advance(15_000);
    expect(fakes.submitReading).not.toHaveBeenCalled();
  });
});
