import {listDownloadedLessonSummaries} from '@features/lesson/player';

import type {LessonCardProgress} from '@ui/components/LessonCard';

import type {LessonSnapshot, LessonSourceType} from '@core/schemas/lesson';
import {
  listCompletedLessons,
  listInProgressLessonIds,
} from '@core/sync/lessonProgress';

export {lessonContextLabel} from '@ui/components/LessonCard';
export {
  useLessonBookmarks,
  useSavedLessons,
} from '@core/sync/useLessonBookmarks';
export type {UseLessonBookmarksResult} from '@core/sync/useLessonBookmarks';

/**
 * What this phone knows about lessons, read once per list so each card does
 * not hit the database: which lessons are downloaded, how far the learner got,
 * and how many exercises a downloaded lesson carries.
 */
export type LessonDownloadInfo = {
  sourceType: LessonSourceType;
  sentenceCount: number;
  /** The video a YouTube lesson was made from, for its thumbnail. */
  youtubeVideoId?: string | null;
};

export type LessonCardLocalState = {
  downloadedIds: ReadonlySet<string>;
  activityCounts: ReadonlyMap<string, number>;
  /** Source type, sentence count and YouTube video of downloaded lessons. */
  downloads: ReadonlyMap<string, LessonDownloadInfo>;
  progress: ReadonlyMap<string, LessonCardProgress>;
};

export const EMPTY_LESSON_CARD_STATE: LessonCardLocalState = {
  downloadedIds: new Set(),
  activityCounts: new Map(),
  downloads: new Map(),
  progress: new Map(),
};

export function activityCountOf(snapshot: LessonSnapshot): number {
  return snapshot.blocks.filter(block => block.type === 'activity').length;
}

export function readLessonCardLocalState(): LessonCardLocalState {
  // Each part fails alone (a database not open yet, in tests or on first
  // render) and then shows no status for that part.
  const downloadedIds = new Set<string>();
  const activityCounts = new Map<string, number>();
  const downloads = new Map<string, LessonDownloadInfo>();
  try {
    for (const summary of listDownloadedLessonSummaries()) {
      downloadedIds.add(summary.lessonId);
      activityCounts.set(summary.lessonId, activityCountOf(summary.snapshot));
      downloads.set(summary.lessonId, {
        sourceType: summary.snapshot.source_type,
        sentenceCount: summary.snapshot.sentences.length,
        youtubeVideoId: summary.snapshot.youtube?.video_id ?? null,
      });
    }
  } catch {
    downloadedIds.clear();
  }
  return {
    downloadedIds,
    activityCounts,
    downloads,
    progress: readLessonProgress(),
  };
}

/** How far the learner got in each lesson; empty when it cannot be read. */
export function readLessonProgress(): ReadonlyMap<string, LessonCardProgress> {
  const progress = new Map<string, LessonCardProgress>();
  try {
    for (const lessonId of listInProgressLessonIds()) {
      progress.set(lessonId, {state: 'in_progress'});
    }
    for (const row of listCompletedLessons()) {
      progress.set(row.lessonId, {state: 'completed'});
    }
  } catch {
    progress.clear();
  }
  return progress;
}
