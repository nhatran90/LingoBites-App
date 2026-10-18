import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {NavigationContainer} from '@react-navigation/native';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import React, {useEffect, useMemo} from 'react';
import {AppState} from 'react-native';

import {
  AccountSwitchGateScreen,
  BootGateScreen,
  OnboardingNameScreen,
  useAccountStore,
} from '@features/account';
import {TtsSpikeScreen} from '@features/audio';
import {
  ComboHistoryScreen,
  ComboSetScreen,
  ComboSetupScreen,
} from '@features/combo';
import {
  CourseLevelsScreen,
  CourseListScreen,
  findNextUnitLesson,
  LevelUnitsScreen,
  UnitLessonsScreen,
  UnitSummativeTaskScreen,
} from '@features/course';
import {HomeScreen} from '@features/home';
import {
  CreateScreen,
  ImageCaptureScreen,
  PasteTextScreen,
} from '@features/input';
import {MomentReviewScreen, SituationInputScreen} from '@features/input';
import {LessonFlowPlayerScreen} from '@features/lesson/flow';
import {
  LessonsHistoryScreen,
  LibraryListScreen,
  VideoHubScreen,
} from '@features/lesson/library';
import {
  CanonicalLessonPlayerScreen,
  ComposeTrackerHost,
  LessonCreationScreen,
} from '@features/lesson/player';
import {
  LearnerOnboardingScreen,
  LearningProfileScreen,
  PlacementResultScreen,
  PlacementTestScreen,
  useLearnerProfileStore,
} from '@features/onboarding';
import {PatternDetailScreen, TenseDetailScreen} from '@features/patternTense';
import {PracticeScreen} from '@features/practice';
import {
  AccountSettingsScreen,
  AppSettingsScreen,
  DataSettingsScreen,
  FeatureStatusScreen,
  OfflineDownloadsScreen,
  PrivacyNoteScreen,
  ProfileScreen,
  ProgressReportScreen,
  SupportAboutScreen,
} from '@features/profile';
import {DailyReviewScreen, ItemReviewScreen} from '@features/review';
import {
  ShadowingLessonPickerScreen,
  ShadowingSessionScreen,
  ShadowingSummaryScreen,
  SpeakingRoomScreen,
} from '@features/speaking/screens/speakingUiPort';
import {TodayScreen} from '@features/today';
import {
  PackLearnScreen,
  QuickKnownCheckScreen,
  WordPackScreen,
  WordPathScreen,
} from '@features/wordPath';

import {AppNavigationProvider} from '@core/navigation';
import {useFeatureFlags} from '@core/release';

import {accountGateRouteForPhase, isLearnerProfilePending} from './accountGate';
import {createAppNavigation, navigationRef} from './appNavigationAdapter';
import {isIngestionRouteEnabled} from './ingestionRouteGate';
import {TabBar} from './TabBar';
import type {
  CoursesStackParamList,
  HomeStackParamList,
  LessonsStackParamList,
  ProfileStackParamList,
  RootStackParamList,
  RootTabParamList,
} from './types';
import {useActivityTracking} from './useActivityTracking';

export type {
  CoursesStackParamList,
  HomeStackParamList,
  LessonsStackParamList,
  ProfileStackParamList,
  RootStackParamList,
  RootTabParamList,
} from './types';

const HomeStack = createNativeStackNavigator<HomeStackParamList>();
const CoursesStack = createNativeStackNavigator<CoursesStackParamList>();
const LessonsStack = createNativeStackNavigator<LessonsStackParamList>();
const ProfileStack = createNativeStackNavigator<ProfileStackParamList>();
const Tab = createBottomTabNavigator<RootTabParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();

const HIDDEN_HEADER = {headerShown: false} as const;

/*
 * Navigation layout (one registration per screen):
 *
 *   RootStack
 *   ├─ Tabs            each tab holds its hub screen
 *   │  ├─ Home         HomeMain
 *   │  ├─ Courses      CourseList + CourseLevels, LevelUnits, UnitLessons,
 *   │  │               UnitSummativeTask (tab bar stays while browsing)
 *   │  ├─ Lessons      LessonsList
 *   │  └─ Profile      ProfileMain + settings pages
 *   └─ task flows      cover the tab bar; back returns to the opening tab
 *      CreateHub, PasteText, ImageCapture, LessonCreation,
 *      CanonicalLessonPlayer, LibraryList, VideoHub,
 *      LessonFlowPlayer, DailyReview, Practice, Today,
 *      SpeakingRoom, ShadowingLessonPicker, ShadowingSession,
 *      ShadowingSummary
 *
 * Features navigate through `useAppNavigation()` (see
 * `appNavigationAdapter.ts`), never by reaching into a parent navigator.
 */

function HomeStackNavigator() {
  return (
    <HomeStack.Navigator>
      <HomeStack.Screen
        component={HomeScreen}
        name="HomeMain"
        options={HIDDEN_HEADER}
      />
    </HomeStack.Navigator>
  );
}

function CoursesStackNavigator() {
  return (
    <CoursesStack.Navigator>
      <CoursesStack.Screen
        component={CourseListScreen}
        name="CourseList"
        options={HIDDEN_HEADER}
      />
      {/* Curriculum: browsed inside the tab, so the tab bar stays. */}
      <CoursesStack.Screen
        component={CourseLevelsScreen}
        name="CourseLevels"
        options={HIDDEN_HEADER}
      />
      <CoursesStack.Screen
        component={LevelUnitsScreen}
        name="LevelUnits"
        options={HIDDEN_HEADER}
      />
      <CoursesStack.Screen
        component={UnitLessonsScreen}
        name="UnitLessons"
        options={HIDDEN_HEADER}
      />
      <CoursesStack.Screen
        component={UnitSummativeTaskScreen}
        name="UnitSummativeTask"
        options={HIDDEN_HEADER}
      />
    </CoursesStack.Navigator>
  );
}

function LessonsStackNavigator() {
  return (
    <LessonsStack.Navigator>
      <LessonsStack.Screen
        component={LessonsHistoryScreen}
        name="LessonsList"
        options={HIDDEN_HEADER}
      />
    </LessonsStack.Navigator>
  );
}

function ProfileStackNavigator() {
  return (
    <ProfileStack.Navigator>
      <ProfileStack.Screen
        component={ProfileScreen}
        name="ProfileMain"
        options={HIDDEN_HEADER}
      />
      <ProfileStack.Screen
        component={AccountSettingsScreen}
        name="AccountSettings"
        options={HIDDEN_HEADER}
      />
      <ProfileStack.Screen
        component={DataSettingsScreen}
        name="DataSettings"
        options={HIDDEN_HEADER}
      />
      <ProfileStack.Screen
        component={OfflineDownloadsScreen}
        name="OfflineDownloads"
        options={HIDDEN_HEADER}
      />
      <ProfileStack.Screen
        component={AppSettingsScreen}
        name="AppSettings"
        options={HIDDEN_HEADER}
      />
      <ProfileStack.Screen
        component={SupportAboutScreen}
        name="SupportAbout"
        options={HIDDEN_HEADER}
      />
      <ProfileStack.Screen
        component={PrivacyNoteScreen}
        name="PrivacyNote"
        options={HIDDEN_HEADER}
      />
      <ProfileStack.Screen
        component={ProgressReportScreen}
        name="ProgressReport"
        options={HIDDEN_HEADER}
      />
      {__DEV__ ? (
        <ProfileStack.Screen
          component={FeatureStatusScreen}
          name="FeatureStatus"
          options={HIDDEN_HEADER}
        />
      ) : null}
      {__DEV__ ? (
        <ProfileStack.Screen
          component={TtsSpikeScreen}
          name="TtsSpike"
          options={HIDDEN_HEADER}
        />
      ) : null}
    </ProfileStack.Navigator>
  );
}

function TabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={HIDDEN_HEADER}
      tabBar={props => <TabBar {...props} />}
    >
      <Tab.Screen
        component={HomeStackNavigator}
        name="Home"
        options={{title: 'Home'}}
      />
      <Tab.Screen
        component={CoursesStackNavigator}
        name="Courses"
        options={{title: 'Courses'}}
      />
      <Tab.Screen
        component={LessonsStackNavigator}
        name="Lessons"
        options={{title: 'Lessons'}}
      />
      <Tab.Screen
        component={ProfileStackNavigator}
        name="Profile"
        options={{title: 'Profile'}}
      />
    </Tab.Navigator>
  );
}

function AuthenticatedRootStack() {
  const {config} = useFeatureFlags();
  const canMount = (route: string) =>
    isIngestionRouteEnabled(route, config.features);

  return (
    <RootStack.Navigator id="RootStack" screenOptions={HIDDEN_HEADER}>
      <RootStack.Screen component={TabNavigator} name="Tabs" />
      {/* Create-lesson flow */}
      <RootStack.Screen component={CreateScreen} name="CreateHub" />
      {canMount('PasteText') && (
        <RootStack.Screen component={PasteTextScreen} name="PasteText" />
      )}
      {canMount('ImageCapture') && (
        <RootStack.Screen component={ImageCaptureScreen} name="ImageCapture" />
      )}
      <RootStack.Screen component={MomentReviewScreen} name="MomentReview" />
      <RootStack.Screen
        component={SituationInputScreen}
        name="SituationInput"
      />
      <RootStack.Screen
        component={LessonCreationScreen}
        name="LessonCreation"
        options={{gestureEnabled: false}}
      />
      {/* Lessons */}
      <RootStack.Screen
        component={CanonicalLessonPlayerScreen}
        name="CanonicalLessonPlayer"
        options={{gestureEnabled: false}}
      />
      <RootStack.Screen
        component={LessonFlowPlayerScreen}
        name="LessonFlowPlayer"
        options={{gestureEnabled: false}}
      />
      <RootStack.Screen component={LibraryListScreen} name="LibraryList" />
      <RootStack.Screen component={VideoHubScreen} name="VideoHub" />
      {/* Phase 2: the learner profile from Profile, and a new placement test */}
      <RootStack.Screen
        component={LearningProfileScreen}
        name="LearningProfile"
      />
      <RootStack.Screen component={PlacementTestScreen} name="PlacementTest" />
      <RootStack.Screen
        component={PlacementResultScreen}
        name="PlacementResult"
      />
      {/* Practice */}
      <RootStack.Screen
        component={DailyReviewScreen}
        name="DailyReview"
        options={{gestureEnabled: false}}
      />
      <RootStack.Screen
        component={ItemReviewScreen}
        name="ItemReview"
        options={{gestureEnabled: false}}
      />
      <RootStack.Screen component={WordPathScreen} name="WordPath" />
      <RootStack.Screen component={WordPackScreen} name="WordPack" />
      <RootStack.Screen
        component={PackLearnScreen}
        name="PackLearn"
        options={{gestureEnabled: false}}
      />
      <RootStack.Screen
        component={QuickKnownCheckScreen}
        name="QuickKnownCheck"
        options={{gestureEnabled: false}}
      />
      <RootStack.Screen component={ComboSetupScreen} name="ComboSetup" />
      <RootStack.Screen component={ComboSetScreen} name="ComboSet" />
      <RootStack.Screen component={ComboHistoryScreen} name="ComboHistory" />
      <RootStack.Screen component={PatternDetailScreen} name="PatternDetail" />
      <RootStack.Screen component={TenseDetailScreen} name="TenseDetail" />
      <RootStack.Screen
        component={PracticeScreen}
        name="Practice"
        options={{gestureEnabled: false}}
      />
      <RootStack.Screen component={TodayScreen} name="Today" />
      <RootStack.Screen component={SpeakingRoomScreen} name="SpeakingRoom" />
      <RootStack.Screen
        component={ShadowingLessonPickerScreen}
        name="ShadowingLessonPicker"
      />
      <RootStack.Screen
        component={ShadowingSessionScreen}
        name="ShadowingSession"
        options={{gestureEnabled: false}}
      />
      <RootStack.Screen
        component={ShadowingSummaryScreen}
        name="ShadowingSummary"
      />
    </RootStack.Navigator>
  );
}

export function AppNavigator() {
  useFeatureFlags();
  const phase = useAccountStore(state => state.phase);
  const boot = useAccountStore(state => state.boot);
  const appNavigation = useMemo(
    () => createAppNavigation(navigationRef, {findNextUnitLesson}),
    [],
  );
  useEffect(() => {
    boot().catch(() => {});
  }, [boot]);
  // Offline mode (#1): an offline session re-checks the Server whenever the
  // app returns to the foreground.
  const revalidate = useAccountStore(state => state.revalidate);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') {
        revalidate().catch(() => {});
      }
    });
    return () => subscription.remove();
  }, [revalidate]);

  const gateRoute = accountGateRouteForPhase(phase);
  const userId = useAccountStore(state => state.user?.id ?? null);
  const onNavigationChange = useActivityTracking(
    gateRoute === 'Tabs' ? userId : null,
  );
  const profileStatus = useLearnerProfileStore(state => state.status);
  const loadProfile = useLearnerProfileStore(state => state.load);
  const resetProfile = useLearnerProfileStore(state => state.reset);
  // Phase 2 (P2.4): a signed-in learner without a profile is onboarded first.
  useEffect(() => {
    if (gateRoute === 'Tabs' && userId) {
      loadProfile(userId).catch(() => {});
    } else {
      resetProfile();
    }
  }, [gateRoute, userId, loadProfile, resetProfile]);

  if (gateRoute === 'Tabs' && profileStatus === 'needed') {
    return (
      <NavigationContainer>
        <RootStack.Navigator id="RootStack" screenOptions={HIDDEN_HEADER}>
          <RootStack.Screen
            component={LearnerOnboardingScreen}
            name="LearnerOnboarding"
          />
          <RootStack.Screen
            component={PlacementTestScreen}
            name="PlacementTest"
          />
          <RootStack.Screen
            component={PlacementResultScreen}
            name="PlacementResult"
          />
        </RootStack.Navigator>
      </NavigationContainer>
    );
  }
  const profileUnknown = isLearnerProfilePending(profileStatus, userId);
  if (gateRoute !== 'Tabs' || profileUnknown) {
    return (
      <NavigationContainer>
        <RootStack.Navigator id="RootStack" screenOptions={HIDDEN_HEADER}>
          {gateRoute === 'Onboarding' ? (
            <RootStack.Screen
              component={OnboardingNameScreen}
              name="Onboarding"
            />
          ) : gateRoute === 'AccountSwitch' ? (
            <RootStack.Screen
              component={AccountSwitchGateScreen}
              name="AccountSwitch"
            />
          ) : (
            <RootStack.Screen component={BootGateScreen} name="BootGate" />
          )}
        </RootStack.Navigator>
      </NavigationContainer>
    );
  }
  return (
    <AppNavigationProvider value={appNavigation}>
      <NavigationContainer
        onReady={onNavigationChange}
        onStateChange={onNavigationChange}
        ref={navigationRef}
      >
        <AuthenticatedRootStack />
        {/* S4.3: running "Học theo 6 bước" requests and their banner. */}
        <ComposeTrackerHost />
      </NavigationContainer>
    </AppNavigationProvider>
  );
}
