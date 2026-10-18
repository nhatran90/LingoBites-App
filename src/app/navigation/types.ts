import type {NavigatorScreenParams} from '@react-navigation/native';

import type {
  AccountSwitchRouteParams,
  BootGateRouteParams,
  OnboardingRouteParams,
} from '@features/account';
import type {ComboSetRouteParams, ComboSetupRouteParams} from '@features/combo';
import type {CoursesStackParamList} from '@features/course';
import type {HomeStackParamList} from '@features/home';
import type {
  CreateHubRouteParams,
  ImageCaptureRouteParams,
  MomentReviewRouteParams,
  PasteTextRouteParams,
  SituationInputRouteParams,
} from '@features/input';
import type {
  LessonsStackParamList,
  LibraryListRouteParams,
  VideoHubRouteParams,
} from '@features/lesson/library';
import type {
  CanonicalLessonPlayerRouteParams,
  LessonCreationRouteParams,
  LessonFlowPlayerRouteParams,
} from '@features/lesson/player';
import type {
  LearnerOnboardingRouteParams,
  LearningProfileRouteParams,
  PlacementResultRouteParams,
  PlacementTestRouteParams,
} from '@features/onboarding';
import type {
  PatternDetailRouteParams,
  TenseDetailRouteParams,
} from '@features/patternTense';
import type {PracticeRouteParams} from '@features/practice';
import type {ProfileStackParamList} from '@features/profile';
import type {PronunciationSettingsRouteParams} from '@features/pronunciation';
import type {
  DailyReviewRouteParams,
  ItemReviewRouteParams,
} from '@features/review';
import type {
  ShadowingLessonPickerRouteParams,
  ShadowingSessionRouteParams,
  ShadowingSummaryRouteParams,
  SpeakingRoomRouteParams,
} from '@features/speaking';
import type {TodayRouteParams} from '@features/today';
import type {
  PackLearnRouteParams,
  QuickKnownCheckRouteParams,
  WordPackRouteParams,
} from '@features/wordPath';

export type {
  CoursesStackParamList,
  HomeStackParamList,
  LessonsStackParamList,
  ProfileStackParamList,
};

/** Each tab holds only its hub screen (plus Profile's settings pages). */
export type RootTabParamList = {
  Home: NavigatorScreenParams<HomeStackParamList> | undefined;
  Courses: NavigatorScreenParams<CoursesStackParamList> | undefined;
  Lessons: NavigatorScreenParams<LessonsStackParamList> | undefined;
  Profile: NavigatorScreenParams<ProfileStackParamList> | undefined;
};

/**
 * Root stack: the tabs plus every task flow, each registered exactly once.
 * Flow screens cover the tab bar, and back returns to the opening tab.
 */
export type RootStackParamList = {
  Tabs: NavigatorScreenParams<RootTabParamList> | undefined;
  BootGate: BootGateRouteParams;
  Onboarding: OnboardingRouteParams;
  AccountSwitch: AccountSwitchRouteParams;
  // Phase 2: learner profile and placement test
  LearnerOnboarding: LearnerOnboardingRouteParams;
  LearningProfile: LearningProfileRouteParams;
  PlacementTest: PlacementTestRouteParams;
  PlacementResult: PlacementResultRouteParams;
  // Create-lesson flow
  CreateHub: CreateHubRouteParams;
  PasteText: PasteTextRouteParams;
  ImageCapture: ImageCaptureRouteParams;
  MomentReview: MomentReviewRouteParams;
  SituationInput: SituationInputRouteParams;
  LessonCreation: LessonCreationRouteParams;
  // Lessons
  CanonicalLessonPlayer: CanonicalLessonPlayerRouteParams;
  LessonFlowPlayer: LessonFlowPlayerRouteParams;
  LibraryList: LibraryListRouteParams;
  VideoHub: VideoHubRouteParams;
  // Practice
  DailyReview: DailyReviewRouteParams;
  ItemReview: ItemReviewRouteParams;
  WordPath: undefined;
  WordPack: WordPackRouteParams;
  PackLearn: PackLearnRouteParams;
  QuickKnownCheck: QuickKnownCheckRouteParams;
  ComboSetup: ComboSetupRouteParams;
  ComboSet: ComboSetRouteParams;
  ComboHistory: undefined;
  PatternDetail: PatternDetailRouteParams;
  TenseDetail: TenseDetailRouteParams;
  Practice: PracticeRouteParams;
  Today: TodayRouteParams;
  SpeakingRoom: SpeakingRoomRouteParams;
  ShadowingLessonPicker: ShadowingLessonPickerRouteParams;
  ShadowingSession: ShadowingSessionRouteParams;
  ShadowingSummary: ShadowingSummaryRouteParams;
  PronunciationSettings: PronunciationSettingsRouteParams;
};
