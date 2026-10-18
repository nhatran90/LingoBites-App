import {useFocusEffect} from '@react-navigation/native';
import React, {useCallback} from 'react';
import {useTranslation} from 'react-i18next';
import {View} from 'react-native';

import {LibraryCover} from '@ui/components/LibraryCover';
import {useAppTheme} from '@ui/theme';

import type {CourseUnit} from '../logic/courseClient';
import {curriculumGlyph} from '../logic/curriculumCover';
import {useLevelUnits} from '../logic/useCurriculum';
import type {HeroScrollHandler} from './CurriculumHeroChrome';
import {CurriculumList} from './CurriculumList';
import {RouteFinish} from './RouteFinish';
import {
  type UnitRouteState,
  UnitRouteStop,
  UnitRouteStopSkeleton,
} from './UnitRouteStop';

type Props = {
  levelId: string;
  /** The level code (e.g. A1): colours the units' default covers. */
  levelCode?: string;
  /** Shown above the units (e.g. the course screen's level switcher). */
  header?: React.ReactElement;
  onOpenUnit: (unit: CourseUnit) => void;
  onScroll?: HeroScrollHandler;
  testID: string;
};

/** Width of the route rail (the unit's round cover). */
const RAIL_WIDTH = 72;

/**
 * Units of one level as a route (F14): each unit's round cover (else a
 * default cover in the level colour) ringed by its completed lessons, joined
 * to the next unit, ending in a finish flag. The first unfinished unit is
 * outlined as the one to take next. Re-counted on focus, so finishing a
 * lesson updates the route on back.
 */
export function LevelUnitList({
  levelId,
  levelCode,
  header,
  onOpenUnit,
  onScroll,
  testID,
}: Props) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const {state, refresh} = useLevelUnits(levelId);

  useFocusEffect(
    useCallback(() => {
      refresh();
    }, [refresh]),
  );

  const units = state.status === 'ready' ? state.data : [];
  const isDone = (index: number) => {
    const progress = units[index].progress;
    return Boolean(
      progress && progress.total > 0 && progress.completed >= progress.total,
    );
  };
  const currentIndex = units.findIndex((_, index) => !isDone(index));
  const rows = units.map(({unit, progress}, index) => {
    const routeState: UnitRouteState = isDone(index)
      ? 'done'
      : index === currentIndex
        ? 'current'
        : 'upcoming';
    const onPress = () => onOpenUnit(unit);
    return {
      id: unit.id,
      title: unit.title,
      accessibilityHint: t('course.unit_row_hint'),
      onPress,
      card: (
        <UnitRouteStop
          accessibilityHint={t('course.unit_row_hint')}
          cover={
            <LibraryCover
              fallback="course"
              glyph={curriculumGlyph(unit.title, unit.canDo[0])}
              hideLevelChip
              imageUrl={unit.coverUrl}
              level={levelCode}
              shape="pack"
              testID={`unit-cover-${unit.id}`}
            />
          }
          coverTestID={`${testID}-thumbnail-${unit.id}`}
          // The unit's first can-do says what it is for; else its blurb.
          description={
            unit.canDo[0]
              ? t('course.unit_can_do', {text: unit.canDo[0]})
              : unit.description
          }
          gap={theme.spacing.md}
          number={index + 1}
          onPress={onPress}
          progress={progress}
          progressTestID={`unit-progress-${unit.id}`}
          state={routeState}
          testID={`${testID}-row-${unit.id}`}
          title={unit.title}
        />
      ),
    };
  });

  return (
    <CurriculumList
      emptyMessage={t('course.units_empty')}
      footer={
        <RouteFinish
          body={t('course.route_finish_body', {count: units.length})}
          railWidth={RAIL_WIDTH}
          testID={`${testID}-finish`}
          title={
            levelCode
              ? t('course.route_finish_title', {level: levelCode})
              : t('course.route_finish_title_plain')
          }
        />
      }
      header={header}
      onRetry={refresh}
      onScroll={onScroll}
      rows={rows}
      skeleton={<UnitRouteSkeleton />}
      status={state.status}
      testID={testID}
    />
  );
}

/** Placeholder route stops while a level's units load. */
export function UnitRouteSkeleton() {
  const {theme} = useAppTheme();
  return (
    <View style={{gap: theme.spacing.md}}>
      {[0, 1, 2].map(index => (
        <UnitRouteStopSkeleton gap={theme.spacing.md} key={index} />
      ))}
    </View>
  );
}
