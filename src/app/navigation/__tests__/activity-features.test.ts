import {ACTIVITY_FEATURES} from '@core/analytics/activityTracker';

import {activityFeatureForRoute} from '../activityFeatures';
import {ROOT_FLOW_ROUTES, ROOT_INGESTION_ROUTES} from '../rootStackRoutes';

describe('activityFeatureForRoute', () => {
  it('maps screens to their app area', () => {
    expect(activityFeatureForRoute('CanonicalLessonPlayer')).toBe('lesson');
    expect(activityFeatureForRoute('ShadowingSession')).toBe('shadowing');
    expect(activityFeatureForRoute('ProfileMain')).toBe('profile');
  });

  it('counts unknown or missing screens as other', () => {
    expect(activityFeatureForRoute('SomethingNew')).toBe('other');
    expect(activityFeatureForRoute(undefined)).toBe('other');
  });

  it('gives every root task flow a real area', () => {
    for (const route of [...ROOT_FLOW_ROUTES, ...ROOT_INGESTION_ROUTES]) {
      const feature = activityFeatureForRoute(route);
      expect(ACTIVITY_FEATURES).toContain(feature);
      expect(feature).not.toBe('other');
    }
  });
});
