import {useCallback, useEffect, useRef, useState} from 'react';
import {AppState} from 'react-native';

import {
  isPronunciationConsentOn,
  loadReadingRecorder,
  type ReadingRecorder,
  setPronunciationConsent,
  shouldAskPronunciationConsent,
} from '@features/speaking';

import {createRequestId} from '@core/api/requestId';
import type {
  PronunciationAttempt,
  PronunciationUnscorableReason,
} from '@core/schemas/pronunciation';
import {PRONUNCIATION_MAX_DURATION_MS} from '@core/schemas/recordings';

import {
  fetchReading,
  submitReading,
  type SubmitReadingFailure,
} from './pronunciationClient';

/**
 * Pronunciation step 3: one practice sheet's flow for one item. Ask for the
 * consent once, record a take (stopped at 15 s), send it, then ask for the
 * scores until they come or 30 s pass. The take stays on the device so the
 * learner can hear it again, and is deleted on the next take, on "try
 * again" and when the sheet closes.
 */

/** Takes shorter than this are not sent (the Server would refuse them too). */
export const MIN_READING_MS = 500;
/** How long to wait between asks for the scores, then the last one repeats. */
export const POLL_DELAYS_MS = [800, 1000, 1500, 2000, 3000];
/** Give up asking after this long; "check again" resumes. */
export const POLL_TIMEOUT_MS = 30_000;

export type PracticeErrorReason =
  /** No recorder on this device, or it failed to start. */
  | 'mic_unavailable'
  /** The microphone permission was refused. */
  | 'mic_denied'
  | 'offline'
  /** The Server does not score this account any more. */
  | 'disabled'
  | 'item_not_found'
  | 'failed'
  /** Sent, but no scores within 30 s: the learner may check again. */
  | 'slow';

export type PracticeState =
  /** The consent question is due. */
  | {phase: 'consent'}
  /** The learner said no: nothing can be recorded until they say yes. */
  | {phase: 'declined'}
  | {phase: 'idle'}
  | {phase: 'recording'}
  | {phase: 'sending'}
  | {phase: 'scoring'}
  | {phase: 'scored'; attempt: PronunciationAttempt}
  | {phase: 'unscorable'; reason: PronunciationUnscorableReason}
  | {phase: 'error'; reason: PracticeErrorReason};

export type PronunciationPractice = {
  state: PracticeState;
  /** A finished take is on the device and can be played back. */
  hasOwnTake: boolean;
  answerConsent: (agreed: boolean) => void;
  start: () => void;
  stop: () => void;
  /** Drop the take and any pending result; back to recording. */
  retry: () => void;
  /** After `slow`: ask for the scores of the same take again. */
  checkAgain: () => void;
  playOwnTake: () => void;
};

export type PracticeDeps = {
  recorder: ReadingRecorder | null;
  submitReading: typeof submitReading;
  fetchReading: typeof fetchReading;
  consent: {
    isOn: () => boolean;
    shouldAsk: () => boolean;
    set: (value: 'on' | 'off') => void;
  };
  now: () => number;
};

function defaultDeps(): PracticeDeps {
  return {
    recorder: loadReadingRecorder(),
    submitReading,
    fetchReading,
    consent: {
      isOn: isPronunciationConsentOn,
      shouldAsk: () => shouldAskPronunciationConsent(),
      set: value => setPronunciationConsent(value),
    },
    now: Date.now,
  };
}

function safely(task: Promise<unknown>): void {
  task.catch(() => undefined);
}

const SUBMIT_ERRORS: Record<
  Exclude<SubmitReadingFailure, 'consent'>,
  PracticeErrorReason
> = {
  disabled: 'disabled',
  item_not_found: 'item_not_found',
  offline: 'offline',
  failed: 'failed',
};

export function usePronunciationPractice(
  itemId: string,
  overrides: Partial<PracticeDeps> = {},
): PronunciationPractice {
  const depsRef = useRef<PracticeDeps>({...defaultDeps(), ...overrides});
  const deps = depsRef.current;

  const restingState = useCallback((): PracticeState => {
    const {consent} = depsRef.current;
    if (consent.isOn()) return {phase: 'idle'};
    return consent.shouldAsk() ? {phase: 'consent'} : {phase: 'declined'};
  }, []);

  const [state, setState] = useState<PracticeState>(restingState);
  const [hasOwnTake, setHasOwnTake] = useState(false);

  /** Bumped to cancel whatever is in flight (a new take, retry, close). */
  const generationRef = useRef(0);
  const mountedRef = useRef(true);
  const fileRef = useRef<string | null>(null);
  const recordingRef = useRef(false);
  const startedAtRef = useRef(0);
  const limitRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const recordingIdRef = useRef<string | null>(null);

  const clearTimers = useCallback(() => {
    if (limitRef.current) clearTimeout(limitRef.current);
    if (pollRef.current) clearTimeout(pollRef.current);
    limitRef.current = null;
    pollRef.current = null;
  }, []);

  /** Deletes the take on the device, stopping the recorder first if needed. */
  const discardTake = useCallback(() => {
    const recorder = depsRef.current.recorder;
    const file = fileRef.current;
    const wasRecording = recordingRef.current;
    fileRef.current = null;
    recordingRef.current = false;
    if (mountedRef.current) setHasOwnTake(false);
    if (!recorder || !file) return;
    safely(
      (wasRecording
        ? recorder.stopRecording(file, startedAtRef.current)
        : recorder.stopPlayback()
      ).then(() => recorder.deleteRecordingFile(file)),
    );
  }, []);

  /** Sets state only for the current generation of a still-open sheet. */
  const settle = useCallback((generation: number, next: PracticeState) => {
    if (mountedRef.current && generation === generationRef.current) {
      setState(next);
    }
  }, []);

  const poll = useCallback(
    (generation: number) => {
      const recordingId = recordingIdRef.current;
      if (!recordingId) return;
      const startedAt = depsRef.current.now();
      const ask = (round: number) => {
        const delay =
          POLL_DELAYS_MS[Math.min(round, POLL_DELAYS_MS.length - 1)]!;
        pollRef.current = setTimeout(() => {
          pollRef.current = null;
          safely(
            depsRef.current.fetchReading(recordingId).then(result => {
              if (generation !== generationRef.current) return;
              if (result.status === 'pending' || result.status === 'offline') {
                if (depsRef.current.now() - startedAt >= POLL_TIMEOUT_MS) {
                  settle(generation, {phase: 'error', reason: 'slow'});
                } else {
                  ask(round + 1);
                }
                return;
              }
              if (result.status === 'disabled') {
                settle(generation, {phase: 'error', reason: 'disabled'});
                return;
              }
              if (result.status === 'not_found') {
                settle(generation, {phase: 'error', reason: 'failed'});
                return;
              }
              const attempt = result.attempt;
              if (attempt.status === 'scored') {
                settle(generation, {phase: 'scored', attempt});
              } else if (
                attempt.status === 'unscorable' &&
                attempt.unscorable_reason
              ) {
                settle(generation, {
                  phase: 'unscorable',
                  reason: attempt.unscorable_reason,
                });
              } else {
                settle(generation, {phase: 'error', reason: 'failed'});
              }
            }),
          );
        }, delay);
      };
      ask(0);
    },
    [settle],
  );

  const send = useCallback(
    async (generation: number, file: string, durationMs: number) => {
      const {recorder} = depsRef.current;
      settle(generation, {phase: 'sending'});
      const read = await recorder!.readRecordingFileForUpload(file);
      if (generation !== generationRef.current) return;
      if (!read.ok) {
        settle(generation, {phase: 'error', reason: 'failed'});
        return;
      }
      const sent = await depsRef.current.submitReading({
        itemId,
        durationMs,
        file: {
          byteSize: read.byteSize,
          sha256: read.sha256,
          binary: read.binary,
        },
      });
      if (generation !== generationRef.current) return;
      if (!sent.ok) {
        settle(
          generation,
          sent.reason === 'consent'
            ? restingState()
            : {phase: 'error', reason: SUBMIT_ERRORS[sent.reason]},
        );
        return;
      }
      recordingIdRef.current = sent.recordingId;
      settle(generation, {phase: 'scoring'});
      poll(generation);
    },
    [itemId, poll, restingState, settle],
  );

  const stop = useCallback(() => {
    const {recorder} = depsRef.current;
    const file = fileRef.current;
    if (!recorder || !file || !recordingRef.current) return;
    if (limitRef.current) clearTimeout(limitRef.current);
    limitRef.current = null;
    recordingRef.current = false;
    const generation = generationRef.current;
    safely(
      recorder.stopRecording(file, startedAtRef.current).then(result => {
        if (generation !== generationRef.current) return;
        if (!result.ok) {
          discardTake();
          settle(generation, {phase: 'error', reason: 'mic_unavailable'});
          return;
        }
        fileRef.current = result.filePath;
        if (mountedRef.current) setHasOwnTake(true);
        if (result.durationMs < MIN_READING_MS) {
          discardTake();
          settle(generation, {phase: 'unscorable', reason: 'too_short'});
          return;
        }
        return send(generation, result.filePath, result.durationMs);
      }),
    );
  }, [discardTake, send, settle]);

  const start = useCallback(() => {
    const {recorder, consent} = depsRef.current;
    if (!consent.isOn()) {
      setState(restingState());
      return;
    }
    if (!recorder) {
      setState({phase: 'error', reason: 'mic_unavailable'});
      return;
    }
    if (recordingRef.current) return;
    generationRef.current += 1;
    const generation = generationRef.current;
    clearTimers();
    discardTake();
    recordingIdRef.current = null;
    safely(
      recorder
        .startRecording('pronunciation', `pronunciation-${createRequestId()}`)
        .then(result => {
          if (generation !== generationRef.current || !mountedRef.current) {
            if (result.ok) {
              safely(
                recorder
                  .stopRecording(result.filePath, depsRef.current.now())
                  .then(() => recorder.deleteRecordingFile(result.filePath)),
              );
            }
            return;
          }
          if (!result.ok) {
            settle(generation, {
              phase: 'error',
              reason:
                result.errorCode === 'PERMISSION_DENIED'
                  ? 'mic_denied'
                  : 'mic_unavailable',
            });
            return;
          }
          fileRef.current = result.filePath;
          startedAtRef.current = depsRef.current.now();
          recordingRef.current = true;
          settle(generation, {phase: 'recording'});
          limitRef.current = setTimeout(
            () => stop(),
            PRONUNCIATION_MAX_DURATION_MS,
          );
        }),
    );
  }, [clearTimers, discardTake, restingState, settle, stop]);

  const retry = useCallback(() => {
    generationRef.current += 1;
    clearTimers();
    discardTake();
    recordingIdRef.current = null;
    setState(restingState());
  }, [clearTimers, discardTake, restingState]);

  const checkAgain = useCallback(() => {
    if (!recordingIdRef.current) return;
    generationRef.current += 1;
    clearTimers();
    setState({phase: 'scoring'});
    poll(generationRef.current);
  }, [clearTimers, poll]);

  const answerConsent = useCallback((agreed: boolean) => {
    depsRef.current.consent.set(agreed ? 'on' : 'off');
    setState(agreed ? {phase: 'idle'} : {phase: 'declined'});
  }, []);

  const playOwnTake = useCallback(() => {
    const {recorder} = depsRef.current;
    const file = fileRef.current;
    if (recorder && file && !recordingRef.current) {
      safely(recorder.playRecording(file));
    }
  }, []);

  // Leaving the app mid-take drops it rather than recording in the background.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      if (next !== 'active' && recordingRef.current) {
        generationRef.current += 1;
        clearTimers();
        discardTake();
        setState(restingState());
      }
    });
    return () => subscription.remove();
  }, [clearTimers, discardTake, restingState]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      clearTimers();
      discardTake();
    };
  }, [clearTimers, discardTake]);

  return {
    state,
    hasOwnTake: hasOwnTake && deps.recorder !== null,
    answerConsent,
    start,
    stop,
    retry,
    checkAgain,
    playOwnTake,
  };
}
