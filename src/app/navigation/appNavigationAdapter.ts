import {
  CommonActions,
  createNavigationContainerRef,
  type NavigationContainerRefWithCurrent,
} from '@react-navigation/native';

import type {
  AppNavigation,
  CourseTarget,
  CreateEntry,
  LessonUnitTarget,
} from '@core/navigation';

import type {RootStackParamList} from './types';

/**
 * The single place that maps app navigation intents to route names
 * (`AppNavigation` port in `@core/navigation`). Everything goes through the
 * root container ref, so the result never depends on which tab or stack the
 * caller is rendered in.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

export type RootNavigationRef = Pick<
  NavigationContainerRefWithCurrent<RootStackParamList>,
  'isReady' | 'navigate' | 'dispatch' | 'getRootState' | 'canGoBack' | 'goBack'
>;

type RootRouteName = keyof RootStackParamList;

/** Root routes that belong to the create-lesson flow. */
export const CREATE_FLOW_ROUTES: ReadonlySet<string> = new Set([
  'CreateHub',
  'PasteText',
  'ImageCapture',
  'MomentReview',
  'SituationInput',
  'LessonCreation',
]);

/** Root routes that show one lesson (its hub and its six-step player). */
export const LESSON_ROUTES: ReadonlySet<string> = new Set([
  'CanonicalLessonPlayer',
  'LessonFlowPlayer',
]);

/**
 * Finds the lesson after `lessonId` in its unit; null on the last lesson or
 * when the unit cannot load. Injected so the adapter stays free of data code.
 */
export type FindNextUnitLesson = (
  unitId: string,
  lessonId: string,
) => Promise<string | null>;

export type AppNavigationDeps = {
  findNextUnitLesson?: FindNextUnitLesson;
};

function newSubmissionId(kind: string): string {
  return `create-${kind}-${Date.now()}`;
}

export function createAppNavigation(
  ref: RootNavigationRef = navigationRef,
  deps: AppNavigationDeps = {},
): AppNavigation {
  const navigate = <RouteName extends RootRouteName>(
    name: RouteName,
    params: RootStackParamList[RouteName],
  ) => {
    if (ref.isReady()) {
      // The container ref's overloads cannot be called with a generic route
      // name; the signature above keeps every call site type-checked.
      (ref.navigate as (route: string, routeParams?: object) => void)(
        name,
        params,
      );
    }
  };

  const startCreate = (entry: CreateEntry) => {
    switch (entry.kind) {
      case 'paste':
        navigate('PasteText', undefined);
        return;
      case 'camera':
      case 'gallery':
        navigate('ImageCapture', {sourceType: entry.kind});
        return;
      case 'situation':
        navigate('SituationInput', {
          imageText: entry.imageText,
          requestId: entry.requestId,
        });
        return;
      case 'youtube':
        navigate('LessonCreation', {
          submissionId: entry.submissionId ?? newSubmissionId('youtube'),
          initialSource: 'youtube',
        });
        return;
      case 'text':
      case 'ocr':
        navigate('LessonCreation', {
          submissionId: entry.submissionId ?? newSubmissionId(entry.kind),
          initialSource: entry.kind,
          initialText: entry.text,
        });
        return;
    }
  };

  // Curriculum screens live in the Courses tab's stack, so the tab bar stays
  // and tapping the Courses tab again returns to the course list.
  const openCourse = (target?: CourseTarget) => {
    if (!target) {
      navigate('Tabs', {screen: 'Courses', params: {screen: 'CourseList'}});
      return;
    }
    switch (target.kind) {
      case 'course':
        navigate('Tabs', {
          screen: 'Courses',
          params: {
            screen: 'CourseLevels',
            params: {
              courseSlug: target.courseSlug,
              title: target.title,
              coverUrl: target.coverUrl,
            },
            initial: false,
          },
        });
        return;
      case 'level':
        navigate('Tabs', {
          screen: 'Courses',
          params: {
            screen: 'LevelUnits',
            params: {levelId: target.levelId, title: target.title},
            initial: false,
          },
        });
        return;
      case 'unit':
        navigate('Tabs', {
          screen: 'Courses',
          params: {
            screen: 'UnitLessons',
            params: {unitId: target.unitId, title: target.title},
            initial: false,
          },
        });
        return;
    }
  };

  /**
   * Replaces the lesson screens on top of the root stack with `extra`
   * (none: back to the screen that opened the lesson).
   */
  const replaceLessonRoutes = (
    extra: {name: 'CanonicalLessonPlayer'; params: {lessonId: string}}[],
  ) => {
    if (!ref.isReady()) {
      return;
    }
    const state = ref.getRootState();
    if (!state) {
      return;
    }
    let firstLessonIndex = state.routes.length;
    while (
      firstLessonIndex > 1 &&
      LESSON_ROUTES.has(state.routes[firstLessonIndex - 1].name)
    ) {
      firstLessonIndex -= 1;
    }
    if (firstLessonIndex === state.routes.length && extra.length === 0) {
      return;
    }
    const routes = [...state.routes.slice(0, firstLessonIndex), ...extra];
    ref.dispatch(
      CommonActions.reset({
        ...state,
        routes,
        index: routes.length - 1,
      } as Parameters<typeof CommonActions.reset>[0]),
    );
  };

  const closeLessonToUnit = (target: LessonUnitTarget) => {
    replaceLessonRoutes([]);
    openCourse({kind: 'unit', unitId: target.unitId, title: target.title});
  };

  const openNextUnitLesson = (target: LessonUnitTarget) => {
    const find = deps.findNextUnitLesson;
    if (!find) {
      closeLessonToUnit(target);
      return;
    }
    find(target.unitId, target.lessonId)
      .catch(() => null)
      .then(nextId => {
        if (nextId) {
          replaceLessonRoutes([
            {name: 'CanonicalLessonPlayer', params: {lessonId: nextId}},
          ]);
        } else {
          closeLessonToUnit(target);
        }
      });
  };

  const finishCreate = (lessonId: string) => {
    if (!ref.isReady()) {
      return;
    }
    const state = ref.getRootState();
    if (!state) {
      return;
    }
    const firstFlowIndex = state.routes.findIndex(route =>
      CREATE_FLOW_ROUTES.has(route.name),
    );
    const kept =
      firstFlowIndex === -1
        ? state.routes
        : state.routes.slice(0, firstFlowIndex);
    const routes = [
      ...kept,
      {name: 'CanonicalLessonPlayer' as const, params: {lessonId}},
    ];
    ref.dispatch(
      CommonActions.reset({
        ...state,
        routes,
        index: routes.length - 1,
      } as Parameters<typeof CommonActions.reset>[0]),
    );
  };

  return {
    openLesson: lessonId => navigate('CanonicalLessonPlayer', {lessonId}),
    openLessonFlow: (lessonId, options) =>
      navigate('LessonFlowPlayer', {lessonId, showMap: options?.showMap}),
    closeLesson: () => replaceLessonRoutes([]),
    closeLessonToUnit,
    openNextUnitLesson,
    openLibrarySection: section => navigate('LibraryList', {section}),
    openVideoHub: () => navigate('VideoHub', undefined),
    openCourse,
    openCreate: () => navigate('CreateHub', undefined),
    startCreate,
    finishCreate,
    openReview: () => navigate('DailyReview', undefined),
    openItemReview: () => navigate('ItemReview', undefined),
    openWordPath: () => navigate('WordPath', undefined),
    openWordPack: packId => navigate('WordPack', {packId}),
    openPackLearn: packId => navigate('PackLearn', {packId}),
    openQuickKnownCheck: packId => navigate('QuickKnownCheck', {packId}),
    openComboSetup: (itemCode, grammarCode) =>
      navigate(
        'ComboSetup',
        grammarCode ? {itemCode, grammarCode} : {itemCode},
      ),
    openComboSet: (setId, created) =>
      navigate('ComboSet', created ? {setId, created} : {setId}),
    openComboHistory: () => navigate('ComboHistory', undefined),
    openPatternDetail: itemCode => navigate('PatternDetail', {itemCode}),
    openTenseDetail: itemCode => navigate('TenseDetail', {itemCode}),
    openPractice: lessonId => navigate('Practice', {lessonId}),
    openToday: target => navigate('Today', target),
    openSpeakingRoom: () => navigate('SpeakingRoom', undefined),
    openLearningProfile: () => navigate('LearningProfile', undefined),
    openPronunciationSettings: () =>
      navigate('PronunciationSettings', undefined),
    openShadowing: target =>
      target
        ? navigate('ShadowingSession', target)
        : navigate('ShadowingLessonPicker', undefined),
    goToTab: tab => navigate('Tabs', {screen: tab}),
    goBack: () => {
      if (ref.isReady() && ref.canGoBack()) {
        ref.goBack();
      }
    },
  };
}
