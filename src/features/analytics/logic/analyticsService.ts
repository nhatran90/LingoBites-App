import {Platform} from 'react-native';

import {getAppVersion} from '@core/api/appConfig';
import {getOrCreateAnonymousUserId} from '@core/db/anonymousUserId';

import {createConsoleAnalyticsAdapter} from './adapters/ConsoleAnalyticsAdapter';
import type {
  AnalyticsAdapter,
  AnalyticsEventName,
  AnalyticsProperties,
  ImageSizeCategory,
} from './types';

let adapter: AnalyticsAdapter = createConsoleAnalyticsAdapter();

export function setAnalyticsAdapter(nextAdapter: AnalyticsAdapter): void {
  adapter = nextAdapter;
}

export function resetAnalyticsAdapter(): void {
  adapter = createConsoleAnalyticsAdapter();
}

export function trackEvent(
  event: AnalyticsEventName,
  properties?: AnalyticsProperties,
): void {
  adapter.track(event, properties);
}

export function trackAppOpened(): void {
  let userId: string | undefined;
  try {
    userId = getOrCreateAnonymousUserId();
  } catch {
    userId = undefined;
  }

  trackEvent('app_opened', {
    user_id: userId,
    app_version: getAppVersion(),
    platform: Platform.OS,
  });
}

export function getImageSizeCategory(
  width?: number,
  height?: number,
): ImageSizeCategory {
  const pixels = (width ?? 0) * (height ?? 0);
  if (pixels <= 0) {
    return 'medium';
  }
  if (pixels < 500_000) {
    return 'small';
  }
  if (pixels < 2_000_000) {
    return 'medium';
  }
  return 'large';
}
