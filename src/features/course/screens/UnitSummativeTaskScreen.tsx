import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {ScrollView, StyleSheet} from 'react-native';

import {SpeakContext, SpeechNotice, useSpeak} from '@features/audio';
import {SummativeTaskView} from '@features/lesson/flow';

import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {ErrorCard} from '@ui/components/ErrorCard';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useSummativeTask} from '../logic/summativeTask';
import {useCourseBreadcrumb} from '../logic/useCourseBreadcrumb';
import type {CourseFlowParamList} from './navigationTypes';

type Props = NativeStackScreenProps<CourseFlowParamList, 'UnitSummativeTask'>;

/**
 * PR 16 (B4, G3–G6): the unit's summative task, opened from the unit's
 * lessons once every lesson's practice is complete.
 * Lives in the Courses tab, so the content clears the floating tab bar.
 */
export function UnitSummativeTaskScreen({navigation, route}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const {unitId, title} = route.params;
  const {state, refresh} = useSummativeTask(unitId);
  const breadcrumb = useCourseBreadcrumb(navigation, route.key);
  const floatingClearance = useFloatingTabBarClearance();
  const {speak, notice} = useSpeak();

  return (
    <AppScreen>
      <ScreenHeader
        breadcrumb={breadcrumb}
        onBack={() => navigation.goBack()}
        title={title ?? t('summativeTask.title')}
      />
      <ScrollView
        contentContainerStyle={[
          themedStyles.container,
          {paddingBottom: floatingClearance},
        ]}
      >
        {state.status === 'loading' ? (
          <AppText color="secondary" testID="unit-summative-loading">
            {t('summativeTask.loading')}
          </AppText>
        ) : null}
        {state.status === 'none' ? (
          <AppText color="secondary" testID="unit-summative-none">
            {t('summativeTask.none')}
          </AppText>
        ) : null}
        {state.status === 'error' ? (
          <ErrorCard
            message={t('summativeTask.load_failed')}
            onRetry={refresh}
          />
        ) : null}
        {state.status === 'ready' ? (
          <SpeakContext.Provider value={speak}>
            <SpeechNotice notice={notice} />
            <SummativeTaskView task={state.task} />
          </SpeakContext.Provider>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.md,
      padding: theme.spacing.md,
    },
  });
}
