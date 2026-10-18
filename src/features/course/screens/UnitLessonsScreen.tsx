import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {
  readLessonCardLocalState,
  useLessonBookmarks,
} from '@features/lesson/library';

import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {
  lessonCardDurationLabel,
  splitLessonTitle,
} from '@ui/components/LessonCard';
import {LibraryCover} from '@ui/components/LibraryCover';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {ShelfSurface} from '@ui/components/ShelfSurface';
import {SkeletonBlock, SkeletonGroup} from '@ui/components/Skeleton';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useAppNavigation} from '@core/navigation';

import {
  CurriculumHeroChrome,
  useHeroScroll,
} from '../components/CurriculumHeroChrome';
import {CurriculumHeroCover} from '../components/CurriculumHeroCover';
import {CurriculumList} from '../components/CurriculumList';
import {
  LessonStep,
  LessonStepSkeleton,
  type LessonStepState,
} from '../components/LessonStep';
import {SummativeMissionCard} from '../components/SummativeMissionCard';
import {UnitProgressRing} from '../components/UnitProgressRing';
import {curriculumGlyph} from '../logic/curriculumCover';
import {useCourseBreadcrumb} from '../logic/useCourseBreadcrumb';
import {useUnitLessons} from '../logic/useCurriculum';
import type {CourseFlowParamList} from './navigationTypes';

type Props = NativeStackScreenProps<CourseFlowParamList, 'UnitLessons'>;

/** Width of the lesson rail (the step dot). */
const RAIL_WIDTH = 36;

/**
 * Lessons of one unit in order (F14), under the unit's cover edge to edge:
 * a "continue" button to the first unlearnt lesson, the lessons as steps on
 * one line, and the unit's summative task as the reward at its end. Each
 * lesson shows its own cover, else the unit's, else a default cover. A
 * curriculum lesson id is the id the regular player loads, so a step opens
 * the same lesson player.
 */
export function UnitLessonsScreen({navigation, route}: Props) {
  const appNavigation = useAppNavigation();
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const {unitId, title, coverUrl, levelCode} = route.params;
  const {state, refresh} = useUnitLessons(unitId);
  const {isBookmarked, toggleBookmark} = useLessonBookmarks();
  const breadcrumb = useCourseBreadcrumb(navigation, route.key);
  const {scrollY, onScroll} = useHeroScroll();
  const [continuePressed, setContinuePressed] = useState(false);
  const screenTitle = title ?? t('course.lessons_title');

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const ready = state.status === 'ready' ? state.data : null;
  // Re-read on every load: a lesson may have been downloaded or started.
  const localState = useMemo(
    () => (ready ? readLessonCardLocalState() : null),
    [ready],
  );
  const nextIndex = ready
    ? ready.lessons.findIndex(lesson => !ready.completedIds.has(lesson.id))
    : -1;
  const nextLesson = ready && nextIndex >= 0 ? ready.lessons[nextIndex] : null;

  const rows = ready
    ? ready.lessons.map((lesson, index) => {
        const completed = ready.completedIds.has(lesson.id);
        const download = localState?.downloads.get(lesson.id);
        const sourceType = download?.sourceType ?? 'admin_text';
        const sentenceCount = download?.sentenceCount ?? null;
        const lessonNumber = t('course.lesson_number', {number: index + 1});
        const split = splitLessonTitle(lesson.title);
        const stepState: LessonStepState = completed
          ? 'done'
          : index === nextIndex
            ? 'current'
            : 'upcoming';
        const onPress = () => appNavigation.openLesson(lesson.id);
        return {
          id: lesson.id,
          title: lesson.title,
          accessibilityHint: t('course.lesson_row_hint'),
          onPress,
          card: (
            <LessonStep
              accessibilityHint={t('course.lesson_row_hint')}
              accessibilityLabel={`${lessonNumber}: ${lesson.title}`}
              bookmarked={isBookmarked(lesson.id)}
              canDo={
                lesson.canDo[0]
                  ? t('course.unit_can_do', {text: lesson.canDo[0]})
                  : split.subtitle
              }
              canDoTestID={
                lesson.canDo[0] ? `unit-lessons-can-do-${lesson.id}` : undefined
              }
              downloaded={localState?.downloadedIds.has(lesson.id)}
              durationLabel={lessonCardDurationLabel({
                estimatedMinutes: lesson.estimatedMinutes,
                sentenceCount,
              })}
              exerciseCount={localState?.activityCounts.get(lesson.id)}
              gap={theme.spacing.md}
              number={index + 1}
              onPress={onPress}
              onToggleBookmark={() =>
                toggleBookmark({
                  lessonId: lesson.id,
                  title: lesson.title,
                  sourceType,
                  sentenceCount: sentenceCount ?? 0,
                  estimatedMinutes: lesson.estimatedMinutes,
                  contextLabel: title ?? null,
                })
              }
              progress={
                completed
                  ? {state: 'completed'}
                  : localState?.progress.get(lesson.id)
              }
              state={stepState}
              testID={`unit-lessons-row-${lesson.id}`}
              thumbnail={
                <LibraryCover
                  fallback="lesson"
                  glyph={curriculumGlyph(lesson.title, title)}
                  hideLevelChip
                  imageUrl={lesson.coverUrl ?? coverUrl}
                  level={levelCode}
                  shape="pack"
                  testID={`unit-lessons-cover-${lesson.id}`}
                />
              }
              title={split.title}
            />
          ),
        };
      })
    : [];

  const hasLessons = ready !== null && ready.lessons.length > 0;
  // While loading, the unit's cover, breadcrumb and title (all known from
  // the route) are drawn at once, so the page keeps its layout.
  const loading = state.status === 'loading';
  const showHero = hasLessons || loading;
  const header = showHero ? (
    <View style={themedStyles.header}>
      <CurriculumHeroCover
        glyph={curriculumGlyph(title)}
        imageUrl={coverUrl}
        level={levelCode}
        scrollY={scrollY}
        testID="unit-lessons-cover"
      >
        <View style={styles.titleRow}>
          <View style={styles.titleCopy}>
            {breadcrumb.length > 0 ? (
              <View accessibilityRole="toolbar" style={styles.crumbs}>
                {breadcrumb.map((crumb, index) => (
                  <React.Fragment key={`${index}-${crumb.label}`}>
                    {index > 0 ? (
                      <AppText color="muted" variant="caption">
                        ›
                      </AppText>
                    ) : null}
                    <Pressable
                      accessibilityHint="Quay thẳng về màn này"
                      accessibilityLabel={crumb.label}
                      accessibilityRole="link"
                      hitSlop={CRUMB_HIT_SLOP}
                      onPress={crumb.onPress}
                      style={styles.crumb}
                      testID={crumb.testID}
                    >
                      <AppText
                        numberOfLines={1}
                        style={themedStyles.crumbText}
                        variant="caption"
                      >
                        {crumb.label}
                      </AppText>
                    </Pressable>
                  </React.Fragment>
                ))}
              </View>
            ) : null}
            <AppText testID="unit-lessons-title" variant="h1">
              {screenTitle}
            </AppText>
          </View>
          {ready ? (
            <UnitProgressRing
              progress={ready.progress}
              testID="unit-lessons-progress"
            />
          ) : (
            <SkeletonGroup>
              <SkeletonBlock height={68} radius={34} width={68} />
            </SkeletonGroup>
          )}
        </View>
        {loading ? (
          <SkeletonGroup>
            <SkeletonBlock height={66} radius={22} />
          </SkeletonGroup>
        ) : null}
        {ready && nextLesson ? (
          <Pressable
            accessibilityHint={t('course.lesson_row_hint')}
            accessibilityLabel={`${t(
              nextIndex === 0 && ready.progress.completed === 0
                ? 'course.start_lesson'
                : 'course.continue_lesson',
              {number: nextIndex + 1},
            )}: ${nextLesson.title}`}
            accessibilityRole="button"
            onPress={() => appNavigation.openLesson(nextLesson.id)}
            onPressIn={() => setContinuePressed(true)}
            onPressOut={() => setContinuePressed(false)}
            testID="unit-lessons-continue"
          >
            <ShelfSurface
              borderRadius={22}
              faceStyle={themedStyles.continueFace}
              isPressed={continuePressed}
              shelfColor={theme.shelf?.accent.color}
              shelfHeight={theme.shelf?.accent.height}
            >
              <View style={themedStyles.play}>
                <MaterialIcon
                  color={theme.colors.text.inverse}
                  name="play_arrow"
                  size={24}
                />
              </View>
              <View style={styles.titleCopy}>
                <AppText style={themedStyles.continueTitle}>
                  {t(
                    nextIndex === 0 && ready.progress.completed === 0
                      ? 'course.start_lesson'
                      : 'course.continue_lesson',
                    {number: nextIndex + 1},
                  )}
                </AppText>
                <AppText numberOfLines={1} style={themedStyles.continueText}>
                  {[
                    splitLessonTitle(nextLesson.title).title,
                    nextLesson.estimatedMinutes
                      ? t('course.lesson_minutes', {
                          count: nextLesson.estimatedMinutes,
                        })
                      : null,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </AppText>
              </View>
            </ShelfSurface>
          </Pressable>
        ) : null}
      </CurriculumHeroCover>
    </View>
  ) : undefined;

  return (
    <AppScreen edges={showHero ? ['left', 'right', 'bottom'] : undefined}>
      {showHero ? null : (
        <ScreenHeader
          breadcrumb={breadcrumb}
          title={screenTitle}
          onBack={() => navigation.goBack()}
        />
      )}
      <CurriculumList
        emptyMessage={t('course.lessons_empty')}
        footer={
          ready ? (
            // PR 16 (B4): the summative task opens after every lesson's practice.
            <SummativeMissionCard
              onPress={() =>
                navigation.navigate('UnitSummativeTask', {unitId, title})
              }
              progress={ready.progress}
              railWidth={RAIL_WIDTH}
              state={ready.summative}
            />
          ) : undefined
        }
        header={header}
        onRetry={refresh}
        onScroll={showHero ? onScroll : undefined}
        rows={rows}
        skeleton={
          <View style={themedStyles.steps}>
            {[1, 2, 3, 4].map(number => (
              <LessonStepSkeleton
                gap={theme.spacing.md}
                key={number}
                number={number}
              />
            ))}
          </View>
        }
        status={state.status}
        testID="unit-lessons"
      />
      {showHero ? (
        <CurriculumHeroChrome
          onBack={() => navigation.goBack()}
          scrollY={scrollY}
          title={screenTitle}
        />
      ) : null}
    </AppScreen>
  );
}

/** Lifts a one-line caption link to the 44px minimum touch target. */
const CRUMB_HIT_SLOP = {top: 14, bottom: 14, left: 4, right: 4};

const styles = StyleSheet.create({
  crumb: {
    flexShrink: 1,
    minWidth: 0,
  },
  crumbs: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginBottom: 2,
  },
  titleCopy: {
    flex: 1,
    minWidth: 0,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
});

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    continueFace: {
      alignItems: 'center',
      backgroundColor: theme.colors.accent,
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
    },
    continueText: {
      color: theme.colors.accentInk,
      fontSize: 13,
      fontWeight: '700',
      lineHeight: 18,
    },
    continueTitle: {
      color: theme.colors.accentInk,
      fontSize: 16,
      fontWeight: '800',
      lineHeight: 21,
    },
    crumbText: {
      color: theme.colors.primary,
      fontWeight: '700',
    },
    header: {
      paddingBottom: theme.spacing.sm,
    },
    steps: {
      gap: theme.spacing.md,
    },
    play: {
      alignItems: 'center',
      backgroundColor: theme.colors.primary,
      borderRadius: 21,
      height: 42,
      justifyContent: 'center',
      width: 42,
    },
  });
}
