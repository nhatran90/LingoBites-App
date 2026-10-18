import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';
import Svg, {Circle} from 'react-native-svg';

import {AppText} from '@ui/components/AppText';
import {SkeletonBlock} from '@ui/components/Skeleton';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {type UnitProgress, unitProgressRatio} from '../logic/unitProgress';
import {CurriculumSurface} from './CurriculumSurface';
import {RouteLine} from './RouteLine';
import {UnitProgressBar} from './UnitProgressBar';

/** Where a unit stands on its level's route. */
export type UnitRouteState = 'done' | 'current' | 'upcoming';

const NODE = 72;
const RING = 4;

type Props = {
  number: number;
  title: string;
  description?: string;
  /** The unit's cover, e.g. a `LibraryCover` (shape `pack`). */
  cover: React.ReactNode;
  /** Null when the unit's lessons could not be loaded. */
  progress: UnitProgress | null;
  state: UnitRouteState;
  /** Gap to the next stop, so the route line reaches it. */
  gap: number;
  accessibilityHint: string;
  onPress: () => void;
  testID: string;
  progressTestID: string;
  coverTestID: string;
};

/**
 * One unit as a stop on its level's route: a round cover ringed by its
 * lesson progress, the line on to the next unit, and the unit card. The
 * unit to take next is outlined.
 */
export function UnitRouteStop({
  number,
  title,
  description,
  cover,
  progress,
  state,
  gap,
  accessibilityHint,
  onPress,
  testID,
  progressTestID,
  coverTestID,
}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [pressed, setPressed] = useState(false);
  const ratio = progress ? unitProgressRatio(progress) : 0;
  const radius = (NODE - RING) / 2;
  const circumference = 2 * Math.PI * radius;
  const chip = stateChip(state, progress, t);

  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <View style={styles.node}>
          <Svg height={NODE} style={StyleSheet.absoluteFill} width={NODE}>
            <Circle
              cx={NODE / 2}
              cy={NODE / 2}
              fill="none"
              r={radius}
              stroke={theme.colors.surfaceHigh}
              strokeWidth={RING}
            />
            {ratio > 0 ? (
              <Circle
                cx={NODE / 2}
                cy={NODE / 2}
                fill="none"
                origin={`${NODE / 2}, ${NODE / 2}`}
                r={radius}
                rotation={-90}
                stroke={theme.colors.primary}
                strokeDasharray={`${circumference} ${circumference}`}
                strokeDashoffset={circumference * (1 - ratio)}
                strokeLinecap="round"
                strokeWidth={RING}
              />
            ) : null}
          </Svg>
          <View style={themedStyles.cover} testID={coverTestID}>
            {cover}
          </View>
          <View
            style={[
              themedStyles.badge,
              state === 'current' && themedStyles.badgeCurrent,
            ]}
          >
            <AppText
              style={[
                themedStyles.badgeText,
                state === 'current' && themedStyles.badgeTextCurrent,
              ]}
            >
              {number}
            </AppText>
          </View>
        </View>
        <RouteLine done={state === 'done'} overhang={gap} />
      </View>
      <Pressable
        accessibilityHint={accessibilityHint}
        accessibilityLabel={title}
        accessibilityRole="button"
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        style={styles.card}
        testID={testID}
      >
        <CurriculumSurface
          faceStyle={styles.face}
          highlighted={state === 'current'}
          pressed={pressed}
        >
          <View style={styles.eyebrowRow}>
            <AppText color="muted" style={styles.eyebrow} variant="caption">
              {t('course.unit_number', {number})}
            </AppText>
            {chip ? (
              <View
                style={[
                  themedStyles.chip,
                  chip.tone === 'done' && themedStyles.chipDone,
                  chip.tone === 'current' && themedStyles.chipCurrent,
                ]}
              >
                <AppText
                  style={[
                    themedStyles.chipText,
                    chip.tone === 'done' && themedStyles.chipTextDone,
                    chip.tone === 'current' && themedStyles.chipTextCurrent,
                  ]}
                >
                  {chip.label}
                </AppText>
              </View>
            ) : null}
          </View>
          <AppText numberOfLines={2} variant="h3">
            {title}
          </AppText>
          {description && description.trim().length > 0 ? (
            <AppText
              color="secondary"
              ellipsizeMode="tail"
              numberOfLines={2}
              variant="label"
            >
              {description}
            </AppText>
          ) : null}
          {progress ? (
            <UnitProgressBar progress={progress} testID={progressTestID} />
          ) : null}
        </CurriculumSurface>
      </Pressable>
    </View>
  );
}

/**
 * A unit stop while the level loads: a round cover block on the route line
 * and a card with placeholder lines. Place inside a `SkeletonGroup`.
 */
export function UnitRouteStopSkeleton({gap}: {gap: number}) {
  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <SkeletonBlock height={NODE} radius={NODE / 2} width={NODE} />
        <RouteLine overhang={gap} />
      </View>
      <View style={styles.card}>
        <CurriculumSurface faceStyle={styles.skeletonFace}>
          <SkeletonBlock height={11} width="30%" />
          <SkeletonBlock height={16} width="80%" />
          <SkeletonBlock height={12} width="95%" />
          <SkeletonBlock height={8} radius={4} style={styles.skeletonBar} />
        </CurriculumSurface>
      </View>
    </View>
  );
}

type Chip = {label: string; tone: 'done' | 'current'};

function stateChip(
  state: UnitRouteState,
  progress: UnitProgress | null,
  t: (key: string, options?: Record<string, unknown>) => string,
): Chip | null {
  if (state === 'done') {
    return {label: t('course.unit_state_done'), tone: 'done'};
  }
  if (state === 'current') {
    return {
      label:
        progress && progress.completed > 0
          ? t('course.unit_state_current')
          : t('course.unit_state_next'),
      tone: 'current',
    };
  }
  return null;
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
  },
  eyebrow: {
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  eyebrowRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'space-between',
  },
  face: {
    gap: 4,
  },
  node: {
    alignItems: 'center',
    height: NODE,
    justifyContent: 'center',
    width: NODE,
  },
  rail: {
    alignItems: 'center',
    width: NODE,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  skeletonBar: {
    marginTop: 4,
  },
  skeletonFace: {
    gap: 8,
  },
});

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    badge: {
      alignItems: 'center',
      backgroundColor: theme.colors.text.primary,
      borderColor: theme.colors.background,
      borderRadius: 14,
      borderWidth: 3,
      bottom: -2,
      height: 28,
      justifyContent: 'center',
      position: 'absolute',
      right: -2,
      width: 28,
    },
    badgeCurrent: {
      backgroundColor: theme.colors.accent,
    },
    badgeText: {
      color: theme.colors.background,
      fontSize: 12,
      fontWeight: '800',
      lineHeight: 16,
    },
    badgeTextCurrent: {
      color: theme.colors.accentInk,
    },
    chip: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 9,
      paddingVertical: 3,
    },
    chipCurrent: {
      backgroundColor: theme.colors.accentSoft,
    },
    chipDone: {
      backgroundColor: theme.colors.primary,
    },
    chipText: {
      color: theme.colors.text.muted,
      fontSize: 11,
      fontWeight: '700',
      lineHeight: 15,
    },
    chipTextCurrent: {
      color: theme.colors.accentInk,
    },
    chipTextDone: {
      color: theme.colors.text.inverse,
    },
    cover: {
      borderColor: theme.colors.background,
      borderRadius: (NODE - RING * 2) / 2,
      borderWidth: 2,
      height: NODE - RING * 2,
      overflow: 'hidden',
      width: NODE - RING * 2,
    },
  });
}
