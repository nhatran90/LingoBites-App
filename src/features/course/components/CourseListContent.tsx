import {useFocusEffect} from '@react-navigation/native';
import React, {useCallback} from 'react';
import {useTranslation} from 'react-i18next';
import {View} from 'react-native';

import {showToast} from '@ui/components/toast';
import {useAppTheme} from '@ui/theme';

import {useAppNavigation} from '@core/navigation';

import {curriculumGlyph} from '../logic/curriculumCover';
import {useCourses} from '../logic/useCurriculum';
import {CourseCard, CourseCardSkeleton, courseCardToneAt} from './CourseCard';
import {CurriculumList} from './CurriculumList';

/**
 * Published courses, each a short coloured card with its cover (the admin's picture, else a
 * default cover with a topic icon); a row opens the course's levels. Shared by the Library
 * "Khóa học" segment and the course list screen. Without published content
 * it shows the empty state.
 */
export function CourseListContent({
  header,
}: {
  /** Shown above the courses, e.g. the Courses tab's title. */
  header?: React.ReactElement;
} = {}) {
  const navigation = useAppNavigation();
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const {state, refresh} = useCourses();

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const rows =
    state.status === 'ready'
      ? state.data.map((course, index) => {
          const accessibilityHint = course.unlocked
            ? t('course.course_row_hint')
            : t('course.course_locked_hint');
          const onPress = () => {
            if (!course.unlocked) {
              showToast(t('course.course_locked_message'));
              return;
            }
            navigation.openCourse({
              kind: 'course',
              courseSlug: course.slug,
              title: course.title,
              coverUrl: course.coverUrl,
            });
          };
          return {
            id: course.id,
            title: course.title,
            description: course.description,
            locked: !course.unlocked,
            accessibilityHint,
            onPress,
            card: (
              <CourseCard
                accessibilityHint={accessibilityHint}
                actionLabel={
                  course.unlocked
                    ? t('course.course_start')
                    : t('course.course_locked_action')
                }
                coverTestID={`course-cover-${course.id}`}
                description={course.description}
                glyph={curriculumGlyph(course.title, course.description)}
                gutter={theme.gutter}
                imageUrl={course.coverUrl}
                locked={!course.unlocked}
                onPress={onPress}
                testID={`course-list-row-${course.id}`}
                title={course.title}
                tone={courseCardToneAt(index)}
              />
            ),
          };
        })
      : [];

  return (
    <CurriculumList
      emptyMessage={t('course.courses_empty')}
      header={header}
      onRetry={refresh}
      rows={rows}
      skeleton={
        <View style={{gap: theme.spacing.md}}>
          {[0, 1, 2].map(index => (
            <CourseCardSkeleton
              gutter={theme.gutter}
              key={index}
              tone={courseCardToneAt(index)}
            />
          ))}
        </View>
      }
      status={state.status}
      testID="course-list"
    />
  );
}
