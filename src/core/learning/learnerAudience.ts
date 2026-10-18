/**
 * Phase 2 (P2.4, decisions C2 and G5): the signed-in learner's age group, set
 * by onboarding and read by the curriculum screens. Children do not see
 * content marked for adults; everyone else sees everything. Kept here so the
 * course and onboarding features do not import each other.
 */
import {useSyncExternalStore} from 'react';

export type LearnerAgeGroup = 'kids' | 'adults';
export type ContentAudience = 'all' | 'kids' | 'adults';

let ageGroup: LearnerAgeGroup | null = null;
const listeners = new Set<() => void>();

export function setLearnerAgeGroup(value: LearnerAgeGroup | null): void {
  ageGroup = value;
  listeners.forEach(fn => fn());
}

export function getLearnerAgeGroup(): LearnerAgeGroup | null {
  return ageGroup;
}

export function subscribeLearnerAgeGroup(callback: () => void): () => void {
  listeners.add(callback);
  return () => {
    listeners.delete(callback);
  };
}

export function useLearnerAgeGroup(): LearnerAgeGroup | null {
  return useSyncExternalStore(
    subscribeLearnerAgeGroup,
    getLearnerAgeGroup,
    getLearnerAgeGroup,
  );
}

/** Whether content for `audience` is shown to the current learner. */
export function isAudienceVisible(
  audience: ContentAudience,
  learner: LearnerAgeGroup | null = ageGroup,
): boolean {
  return !(learner === 'kids' && audience === 'adults');
}
