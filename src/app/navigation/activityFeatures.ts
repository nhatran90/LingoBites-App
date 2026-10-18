import type {ActivityFeature} from '@core/analytics/activityTracker';

/**
 * Which app area a focused screen counts under for usage reporting. Keep the
 * area names in step with the Server's `ACTIVITY_FEATURES`
 * (`src/modules/activity/model/activity.ts`). A screen missing here counts
 * as `other`.
 */
const ROUTE_FEATURES: Record<string, ActivityFeature> = {
  HomeMain: 'home',
  Today: 'home',
  CourseList: 'courses',
  CourseLevels: 'courses',
  LevelUnits: 'courses',
  UnitLessons: 'courses',
  UnitSummativeTask: 'courses',
  LessonsList: 'lesson',
  CanonicalLessonPlayer: 'lesson',
  LessonFlowPlayer: 'lesson',
  CreateHub: 'create',
  LessonCreation: 'create',
  PasteText: 'create',
  ImageCapture: 'create',
  MomentReview: 'create',
  SituationInput: 'create',
  LibraryList: 'library',
  VideoHub: 'video',
  DailyReview: 'review',
  ItemReview: 'review',
  WordPath: 'words',
  WordPack: 'words',
  PackLearn: 'words',
  QuickKnownCheck: 'words',
  ComboSetup: 'combo',
  ComboSet: 'combo',
  ComboHistory: 'combo',
  PatternDetail: 'grammar',
  TenseDetail: 'grammar',
  Practice: 'practice',
  SpeakingRoom: 'speaking',
  ShadowingLessonPicker: 'shadowing',
  ShadowingSession: 'shadowing',
  ShadowingSummary: 'shadowing',
  ProfileMain: 'profile',
  AccountSettings: 'profile',
  DataSettings: 'profile',
  OfflineDownloads: 'profile',
  AppSettings: 'profile',
  SupportAbout: 'profile',
  PrivacyNote: 'profile',
  ProgressReport: 'profile',
  LearningProfile: 'profile',
  PronunciationSettings: 'profile',
};

export function activityFeatureForRoute(
  routeName: string | undefined,
): ActivityFeature {
  return (routeName && ROUTE_FEATURES[routeName]) || 'other';
}
