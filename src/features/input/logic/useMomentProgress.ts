import {useCallback, useEffect, useRef, useState} from 'react';

import {trackEvent} from '@features/analytics';
import {
  type CanonicalLessonError,
  fetchLessonCreationStatus,
} from '@features/lesson/player';

import type {LessonCreationStatusResponse} from '@core/schemas/lesson';

const POLL_MS = 1000;
/** After a failed poll: wait longer each time, then keep trying every 10 s. */
export const MOMENT_RETRY_DELAYS_MS = [2000, 5000, 10_000] as const;
const TERMINAL = new Set(['succeeded', 'failed']);
/** Poll failures that another try cannot fix. */
const FATAL_POLL_ERRORS = new Set([
  'not-found',
  'gone',
  'auth-error',
  'contract-mismatch',
]);

/**
 * E3: follows one moment request. Polls once a second while it runs, stops at
 * "awaiting_confirmation" (the learner answers, then `resume` polls again) and at
 * the end. Every poll reads the server, so the state survives an app restart.
 * A poll that cannot reach the server keeps the last status and tries again
 * (`waitingNetwork`); only an answer another try cannot change stops it.
 */
export function useMomentProgress(requestId: string | null) {
  const [status, setStatus] = useState<LessonCreationStatusResponse | null>(
    null,
  );
  const [error, setError] = useState<CanonicalLessonError | null>(null);
  const [polling, setPolling] = useState(false);
  const [waitingNetwork, setWaitingNetwork] = useState(false);
  // Bumped by `checkNow` to restart the loop at once.
  const [kick, setKick] = useState(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setPolling(false);
  }, []);

  const resume = useCallback(() => {
    if (!requestId) return;
    setPolling(true);
    setError(null);
  }, [requestId]);

  /** "Kiểm tra lại": poll now instead of waiting for the next retry. */
  const checkNow = useCallback(() => {
    if (!requestId) return;
    setPolling(true);
    setKick(value => value + 1);
  }, [requestId]);

  useEffect(() => {
    setWaitingNetwork(false);
    if (!requestId) {
      setStatus(null);
      return undefined;
    }
    setStatus(null);
    resume();
    return stop;
  }, [requestId, resume, stop]);

  useEffect(() => {
    if (!requestId || !polling) return undefined;
    let cancelled = false;
    let failures = 0;
    const tick = async () => {
      const result = await fetchLessonCreationStatus(requestId);
      if (cancelled) return;
      if (!result.ok) {
        if (FATAL_POLL_ERRORS.has(result.kind)) {
          setError(result);
          setWaitingNetwork(false);
          stop();
          return;
        }
        setWaitingNetwork(true);
        const delay =
          MOMENT_RETRY_DELAYS_MS[
            Math.min(failures, MOMENT_RETRY_DELAYS_MS.length - 1)
          ];
        failures += 1;
        timer.current = setTimeout(tick, delay);
        return;
      }
      failures = 0;
      setWaitingNetwork(false);
      setError(null);
      setStatus(result.value);
      const next = result.value.status;
      if (next === 'succeeded') {
        trackEvent('moment_lesson_ready', {});
      }
      if (TERMINAL.has(next) || next === 'awaiting_confirmation') {
        stop();
        return;
      }
      timer.current = setTimeout(tick, POLL_MS);
    };
    tick();
    return () => {
      cancelled = true;
      if (timer.current) clearTimeout(timer.current);
    };
  }, [requestId, polling, kick, stop]);

  return {status, error, polling, waitingNetwork, resume, checkNow};
}
