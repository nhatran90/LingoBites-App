import {listDownloadedLessonSummaries} from '@features/lesson/player';

import type {LessonSentence} from '@core/schemas/lesson';

export type ShadowingSentence = {
  id: string;
  position: number;
  textEn: string;
  textVi: string;
  ipa: string;
  /** `ipa` split over the words of `textEn`, when the server sent one. */
  ipaWords?: (string | null)[] | null;
};

export type ShadowingLessonSnapshot = {
  lessonId: string;
  titleVi: string;
  sentences: ShadowingSentence[];
};

/** Sorts canonical lesson sentences by ascending `position` (FR-004). */
export function orderShadowingSentences(
  sentences: readonly LessonSentence[],
): ShadowingSentence[] {
  return [...sentences]
    .sort((a, b) => a.position - b.position)
    .map(sentence => ({
      id: sentence.id,
      position: sentence.position,
      textEn: sentence.text_en,
      textVi: sentence.text_vi,
      ipa: sentence.ipa,
      ipaWords: sentence.ipa_words ?? null,
    }));
}

/** Loads one downloaded lesson's shadowing sentence snapshot, or null. */
export function loadShadowingLessonSnapshot(
  lessonId: string,
): ShadowingLessonSnapshot | null {
  const lesson = listDownloadedLessonSummaries().find(
    entry => entry.lessonId === lessonId,
  );
  if (!lesson) {
    return null;
  }
  const sentences = orderShadowingSentences(lesson.snapshot.sentences);
  if (sentences.length === 0) {
    return null;
  }
  return {
    lessonId: lesson.lessonId,
    titleVi: lesson.title,
    sentences,
  };
}
