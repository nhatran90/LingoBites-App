import {useCallback, useEffect, useRef, useState} from 'react';

import {useAccountStore} from '@features/account';

import {getLearnerAgeGroup, isAudienceVisible} from '@core/learning';

import {
  type Course,
  type CourseClientError,
  type CourseLevel,
  type CourseResult,
  type CourseUnit,
  type CurriculumLesson,
  fetchCourseEntitlements,
  fetchCourseLevels,
  fetchCourses,
  fetchLevelUnits,
  fetchUnitLessons,
} from './courseClient';
import {
  countUnitProgress,
  readCompletedLessonIds,
  readPassedLessonIds,
  readSummativeState,
  type SummativeState,
  type UnitProgress,
} from './unitProgress';

export type CurriculumState<T> =
  | {status: 'loading'}
  | {status: 'ready'; data: T}
  | {status: 'error'; error: CourseClientError};

/**
 * Lists already loaded in this app session, so opening the same course or
 * unit again shows it at once while it refreshes. Keyed by account and age
 * group, so another learner never sees them.
 */
const sessionCache = new Map<string, unknown>();

function sessionCacheKey(key: string): string {
  const userId = useAccountStore.getState().user?.id ?? '';
  return `${userId}|${getLearnerAgeGroup() ?? ''}|${key}`;
}

export function clearCurriculumCacheForTests(): void {
  sessionCache.clear();
}

/**
 * Loads one curriculum list. `refresh` aborts the previous request, so a
 * screen re-focused while loading never shows a stale answer. A list loaded
 * earlier in the session is shown at once and refreshed in place.
 */
function useCurriculumLoader<T>(
  cacheKey: string,
  load: (signal: AbortSignal) => Promise<CourseResult<T>>,
) {
  const [state, setState] = useState<CurriculumState<T>>(() => {
    const scopedKey = sessionCacheKey(cacheKey);
    return sessionCache.has(scopedKey)
      ? {status: 'ready', data: sessionCache.get(scopedKey) as T}
      : {status: 'loading'};
  });
  const controllerRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setState(previous =>
      previous.status === 'ready' ? previous : {status: 'loading'},
    );
    const scopedKey = sessionCacheKey(cacheKey);
    const result = await load(controller.signal);
    if (controller.signal.aborted) return;
    if (result.ok) sessionCache.set(scopedKey, result.value);
    setState(
      result.ok
        ? {status: 'ready', data: result.value}
        : {status: 'error', error: result},
    );
  }, [cacheKey, load]);

  useEffect(() => () => controllerRef.current?.abort(), []);

  return {state, refresh};
}

/**
 * Published courses (Library "Khóa học" segment, course list screen).
 * Courses for adults are left out for a child's profile (G5), as units are.
 */
export type CourseWithAccess = Course & {unlocked: boolean};

export function useCourses() {
  const load = useCallback(
    async (signal: AbortSignal): Promise<CourseResult<CourseWithAccess[]>> => {
      const fetched = await fetchCourses({signal});
      if (!fetched.ok) return fetched;
      const courses = {
        ...fetched,
        value: fetched.value.filter(course =>
          isAudienceVisible(course.audience),
        ),
      };
      const needsEntitlements = courses.value.some(course => course.isLocked);
      // A failed entitlement lookup keeps locked courses locked; it must not
      // hide the whole list.
      const entitled = needsEntitlements
        ? await fetchCourseEntitlements({signal})
        : null;
      const entitledIds = entitled?.ok ? entitled.value : [];
      return {
        ok: true,
        value: courses.value.map(course => ({
          ...course,
          unlocked: !course.isLocked || entitledIds.includes(course.id),
        })),
      };
    },
    [],
  );
  return useCurriculumLoader<CourseWithAccess[]>('courses', load);
}

/** Levels of one course. */
export function useCourseLevels(courseSlug: string) {
  const load = useCallback(
    (signal: AbortSignal) => fetchCourseLevels(courseSlug, {signal}),
    [courseSlug],
  );
  return useCurriculumLoader<CourseLevel[]>(`levels:${courseSlug}`, load);
}

export type UnitWithProgress = {
  unit: CourseUnit;
  /** Null when the unit's lessons could not be loaded. */
  progress: UnitProgress | null;
};

/**
 * Units of one level, each with its completed-lesson count. Lessons of every
 * unit load in parallel; one failed unit only hides its own progress bar.
 * Units for adults are left out for a child's profile (Phase 2, G5).
 */
export function useLevelUnits(levelId: string) {
  const load = useCallback(
    async (signal: AbortSignal): Promise<CourseResult<UnitWithProgress[]>> => {
      const fetched = await fetchLevelUnits(levelId, {signal});
      if (!fetched.ok) return fetched;
      // Phase 2 (G5): children do not see units marked for adults.
      const units = {
        ...fetched,
        value: fetched.value.filter(unit => isAudienceVisible(unit.audience)),
      };
      const lessonLists = await Promise.all(
        units.value.map(unit => fetchUnitLessons(unit.id, {signal})),
      );
      const completedIds = readCompletedLessonIds();
      const passedIds = readPassedLessonIds();
      return {
        ok: true,
        value: units.value.map((unit, index) => {
          const lessons = lessonLists[index];
          return {
            unit,
            progress: lessons.ok
              ? countUnitProgress(
                  lessons.value.map(lesson => lesson.id),
                  completedIds,
                  passedIds,
                )
              : null,
          };
        }),
      };
    },
    [levelId],
  );
  return useCurriculumLoader<UnitWithProgress[]>(`units:${levelId}`, load);
}

export type UnitLessons = {
  lessons: CurriculumLesson[];
  completedIds: ReadonlySet<string>;
  /** Lessons the Server counts as passed (PR 16). */
  passedIds: ReadonlySet<string>;
  progress: UnitProgress;
  /** Whether the unit's summative task is open (decision B4). */
  summative: SummativeState;
};

/** Lessons of one unit plus which of them are completed on this device. */
export function useUnitLessons(unitId: string) {
  const load = useCallback(
    async (signal: AbortSignal): Promise<CourseResult<UnitLessons>> => {
      const lessons = await fetchUnitLessons(unitId, {signal});
      if (!lessons.ok) return lessons;
      const completedIds = readCompletedLessonIds();
      const passedIds = readPassedLessonIds();
      const lessonIds = lessons.value.map(lesson => lesson.id);
      return {
        ok: true,
        value: {
          lessons: lessons.value,
          completedIds,
          passedIds,
          progress: countUnitProgress(lessonIds, completedIds, passedIds),
          summative: readSummativeState(unitId, lessonIds, completedIds),
        },
      };
    },
    [unitId],
  );
  return useCurriculumLoader<UnitLessons>(`lessons:${unitId}`, load);
}
