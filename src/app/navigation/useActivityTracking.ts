import AsyncStorage from '@react-native-async-storage/async-storage';
import {useCallback, useEffect} from 'react';
import {AppState} from 'react-native';

import {sendActivityReport} from '@core/analytics/activityClient';
import {ActivityTracker} from '@core/analytics/activityTracker';

import {activityFeatureForRoute} from './activityFeatures';
import {navigationRef} from './appNavigationAdapter';

const tracker = new ActivityTracker({
  storage: AsyncStorage,
  send: days => sendActivityReport(days),
});

/**
 * Counts time per app area for the signed-in learner (see ActivityTracker)
 * and reports it when the app goes to the background. Returns the handler
 * for the authenticated NavigationContainer's `onReady` / `onStateChange`.
 */
export function useActivityTracking(userId: string | null): () => void {
  useEffect(() => {
    if (!userId) {
      return;
    }
    // Totals left from an earlier launch go out once the session is up.
    tracker
      .start(userId)
      .then(() => tracker.flush())
      .catch(() => {});
    const subscription = AppState.addEventListener('change', next => {
      if (next === 'active') {
        tracker.resume();
      } else if (next === 'background') {
        tracker.pause().catch(() => {});
      }
    });
    return () => {
      subscription.remove();
      tracker.stop().catch(() => {});
    };
  }, [userId]);

  return useCallback(() => {
    tracker.enter(
      activityFeatureForRoute(navigationRef.getCurrentRoute()?.name),
    );
  }, []);
}
