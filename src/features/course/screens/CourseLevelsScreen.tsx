import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback, useEffect, useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {SkeletonBlock, SkeletonGroup} from '@ui/components/Skeleton';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {
  CurriculumHeroChrome,
  useHeroScroll,
} from '../components/CurriculumHeroChrome';
import {CurriculumHeroCover} from '../components/CurriculumHeroCover';
import {CurriculumList} from '../components/CurriculumList';
import {levelName, LevelPassSwitcher} from '../components/LevelPassSwitcher';
import {LevelUnitList, UnitRouteSkeleton} from '../components/LevelUnitList';
import {curriculumGlyph} from '../logic/curriculumCover';
import {useCourseLevels} from '../logic/useCurriculum';
import type {CourseFlowParamList} from './navigationTypes';

type Props = NativeStackScreenProps<CourseFlowParamList, 'CourseLevels'>;

/**
 * One course (F14): its cover (the level's, else the course's) edge to edge,
 * its levels as boarding passes, then the chosen level's units as a route,
 * so a unit is one tap from the course instead of a separate level screen.
 * The chosen level is kept in the route, so back from a unit keeps it.
 */
export function CourseLevelsScreen({navigation, route}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const {courseSlug, title, levelId, coverUrl} = route.params;
  const {state, refresh} = useCourseLevels(courseSlug);
  const {scrollY, onScroll} = useHeroScroll();
  const screenTitle = title ?? t('course.levels_title');

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const levels = state.status === 'ready' ? state.data : [];
  const selected =
    levels.find(level => level.id === levelId) ?? levels[0] ?? null;

  // Keep the shown level in the route: deeper screens read its code for
  // their breadcrumb, and it survives going back.
  useEffect(() => {
    if (
      selected &&
      (selected.id !== levelId || selected.code !== route.params.levelCode)
    ) {
      navigation.setParams({levelId: selected.id, levelCode: selected.code});
    }
  }, [navigation, selected, levelId, route.params.levelCode]);

  const heroUrl = selected?.coverUrl ?? coverUrl ?? null;
  const header = selected ? (
    <View style={themedStyles.header}>
      <CurriculumHeroCover
        glyph={curriculumGlyph(title, selected.title, selected.description)}
        imageUrl={heroUrl}
        level={selected.code}
        scrollY={scrollY}
        testID="course-levels-cover"
      >
        <AppText testID="course-levels-title" variant="h1">
          {screenTitle}
        </AppText>
        {levels.length > 1 ? (
          <LevelPassSwitcher
            accessibilityHint={t('course.level_switch_hint')}
            levels={levels}
            onSelect={level =>
              navigation.setParams({
                levelId: level.id,
                levelCode: level.code,
              })
            }
            selectedId={selected.id}
            testID="course-levels-switcher"
          />
        ) : (
          <AppText color="secondary" variant="label">
            {selected.code} · {levelName(selected)}
          </AppText>
        )}
        {selected.description.trim().length > 0 ? (
          <AppText
            color="secondary"
            testID="course-levels-description"
            variant="label"
          >
            {selected.description}
          </AppText>
        ) : null}
      </CurriculumHeroCover>
    </View>
  ) : undefined;

  // While the levels load, the course's own cover and title (passed from
  // the card just tapped) are already on screen; only the rest waits.
  if (!selected && state.status === 'loading') {
    return (
      <AppScreen edges={['left', 'right', 'bottom']}>
        <CurriculumList
          emptyMessage={t('course.levels_empty')}
          header={
            <View style={themedStyles.header}>
              <CurriculumHeroCover
                glyph={curriculumGlyph(title)}
                imageUrl={coverUrl}
                scrollY={scrollY}
                testID="course-levels-cover"
              >
                <AppText testID="course-levels-title" variant="h1">
                  {screenTitle}
                </AppText>
                <SkeletonGroup style={themedStyles.headerSkeleton}>
                  <View style={themedStyles.passesSkeleton}>
                    {[0, 1, 2].map(index => (
                      <SkeletonBlock
                        height={52}
                        key={index}
                        radius={theme.radius.md}
                        style={themedStyles.passSkeleton}
                      />
                    ))}
                  </View>
                  <SkeletonBlock height={12} width="80%" />
                </SkeletonGroup>
              </CurriculumHeroCover>
            </View>
          }
          onRetry={refresh}
          onScroll={onScroll}
          rows={[]}
          skeleton={<UnitRouteSkeleton />}
          status="loading"
          testID="course-levels"
        />
        <CurriculumHeroChrome
          onBack={() => navigation.goBack()}
          scrollY={scrollY}
          title={screenTitle}
        />
      </AppScreen>
    );
  }

  if (!selected) {
    return (
      <AppScreen>
        <ScreenHeader title={screenTitle} onBack={() => navigation.goBack()} />
        <CurriculumList
          emptyMessage={t('course.levels_empty')}
          onRetry={refresh}
          rows={[]}
          status={state.status}
          testID="course-levels"
        />
      </AppScreen>
    );
  }

  // The level's picture runs up under the status bar.
  return (
    <AppScreen edges={['left', 'right', 'bottom']}>
      <LevelUnitList
        // A new level starts from its own loading state, never the old list.
        key={selected.id}
        header={header}
        levelCode={selected.code}
        levelId={selected.id}
        onOpenUnit={unit =>
          navigation.push('UnitLessons', {
            unitId: unit.id,
            title: unit.title,
            coverUrl: unit.coverUrl ?? heroUrl,
            levelCode: selected.code,
          })
        }
        onScroll={onScroll}
        testID="course-levels-units"
      />
      <CurriculumHeroChrome
        onBack={() => navigation.goBack()}
        scrollY={scrollY}
        title={screenTitle}
      />
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    header: {
      paddingBottom: theme.spacing.sm,
    },
    headerSkeleton: {
      gap: theme.spacing.sm,
    },
    passSkeleton: {
      flex: 1,
    },
    passesSkeleton: {
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
  });
}
