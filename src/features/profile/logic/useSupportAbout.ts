import type {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useCallback} from 'react';
import {useTranslation} from 'react-i18next';
import {Linking} from 'react-native';

import {getAppVersion, getSupportEmail} from '@core/api/appConfig';

import type {ProfileStackParamList} from '../screens/navigationTypes';

export type SupportAboutNavigation = NativeStackNavigationProp<
  ProfileStackParamList,
  'SupportAbout'
>;

export function useSupportAbout(navigation: SupportAboutNavigation) {
  const {t} = useTranslation();
  const supportEmail = getSupportEmail();
  // The build's store version, not package.json (which stays 0.0.1).
  const appVersion = getAppVersion() || '—';

  function handleSupport() {
    const subject = encodeURIComponent('LingoBites — Góp ý / báo lỗi');
    Linking.openURL(`mailto:${supportEmail}?subject=${subject}`);
  }

  const openPrivacyNote = useCallback(() => {
    navigation.navigate('PrivacyNote');
  }, [navigation]);

  const openFeatureStatus = useCallback(() => {
    navigation.navigate('FeatureStatus');
  }, [navigation]);

  const openTtsSpike = useCallback(() => {
    navigation.navigate('TtsSpike');
  }, [navigation]);

  return {
    appVersion,
    handleSupport,
    openFeatureStatus,
    openPrivacyNote,
    openTtsSpike,
    t,
  };
}
