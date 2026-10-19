import {useFocusEffect} from '@react-navigation/native';
import {useCallback, useMemo, useState} from 'react';

import type {LessonSnapshot} from '@core/schemas/lesson';
import {
  type LessonActivityAttemptRow,
  listLessonActivityAttempts,
} from '@core/sync/activityAttempts';

import {hasRelatedReview} from '../components/StepReview';
import {
  type FlowStep,
  isFlowLesson,
  practiceCompleted,
  resumeStep,
} from './practiceCompletion';

export type FlowEntry =
  | {available: false}
  | {
      available: true;
      /** Where the player opens; `null` before anything was done. */
      resumeAt: FlowStep | null;
      practiceDone: boolean;
      /** Step 1 has nothing to review: the lesson starts at step 2. */
      reviewSkipped: boolean;
    };

function readAttempts(lessonId: string): LessonActivityAttemptRow[] {
  try {
    return listLessonActivityAttempts(lessonId);
  } catch {
    return [];
  }
}

/**
 * What the lesson hub needs to offer the six-step player (decision G1):
 * whether the lesson runs in it, where "continue" opens and whether the
 * practice part is done. Attempts are re-read whenever the hub is focused.
 */
export function useFlowEntry(
  lessonId: string,
  snapshot: LessonSnapshot | null,
): FlowEntry {
  const [attempts, setAttempts] = useState<LessonActivityAttemptRow[]>(() =>
    readAttempts(lessonId),
  );
  useFocusEffect(
    useCallback(() => {
      setAttempts(readAttempts(lessonId));
    }, [lessonId]),
  );
  return useMemo(() => {
    if (!snapshot || !isFlowLesson(snapshot)) return {available: false};
    return {
      available: true,
      resumeAt: attempts.length > 0 ? resumeStep(snapshot, attempts) : null,
      practiceDone: practiceCompleted(snapshot, attempts),
      reviewSkipped: !hasRelatedReview(snapshot),
    };
  }, [snapshot, attempts]);
}
