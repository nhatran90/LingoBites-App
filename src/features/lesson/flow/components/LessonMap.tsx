import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import type {SharedValue} from 'react-native-reanimated';
import Svg, {Path} from 'react-native-svg';

import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {CurriculumHeroCover} from '@ui/components/CurriculumHeroCover';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {SectionHeader} from '@ui/components/SectionHeader';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerFace} from '@ui/theme/hardShadow';

import {itemCardIds, type LessonSnapshot} from '@core/schemas/lesson';

import {LessonOutcomeCard} from '../../player/components/LessonOutcomeCard';
import {collectLessonOutcome} from '../../player/logic/lessonHubContent';
import {flowActivity} from '../logic/flowContent';
import {
  blocksOfStep,
  FLOW_STEPS,
  type FlowStep,
} from '../logic/practiceCompletion';

export type LessonMapProps = {
  snapshot: LessonSnapshot;
  /** The lesson's cover picture; null shows the default cover. */
  coverUrl?: string | null;
  /** The screen's scroll offset, for the cover's parallax. */
  scrollY?: SharedValue<number>;
  /** The step "Bắt đầu học" opens (2 when step 1 is skipped). */
  nextStep: FlowStep;
  /** Steps with nothing to do (an empty step 1): left off the path. */
  skippedSteps: ReadonlySet<number>;
  onOpenStep: (step: FlowStep) => void;
};

/** One picture per step, on this map and on the lesson page's path. */
export const FLOW_STEP_ICONS: Record<FlowStep, HandoffIconName> = {
  1: 'history_edu',
  2: 'hearing',
  3: 'mic',
  4: 'repeat',
  5: 'record_voice_over',
  6: 'emoji_events',
};

/** Centre of each stop: x as a share of the width, y in px. */
const STOP_X = [0.26, 0.68, 0.3, 0.68, 0.3, 0.68];
const ROW = 88;
const TOP = 44;
const NODE = 60;
const NEXT_NODE = 74;
const HALO = 92;
const LABEL_WIDTH = 168;

/**
 * Redesign: the lesson's cover, goal and steps as a winding path, opened
 * from "Xem chi tiết" on the lesson page. Each stop opens its step; a
 * skipped step has no stop.
 */
export function LessonMap({
  snapshot,
  coverUrl,
  scrollY,
  nextStep,
  skippedSteps,
  onOpenStep,
}: LessonMapProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const window = useWindowDimensions();
  // Measured on layout; the window width stands in until then.
  const [measured, setMeasured] = useState(0);
  const width = measured || window.width - theme.gutter * 2;
  const spec = snapshot.spec;
  const level = spec?.code?.split('-')[0] ?? null;
  const outcome = useMemo(() => collectLessonOutcome(snapshot), [snapshot]);
  const activityCount = useMemo(
    () => snapshot.blocks.filter(block => flowActivity(block) !== null).length,
    [snapshot],
  );

  const steps = FLOW_STEPS.filter(
    step => step === nextStep || !skippedSteps.has(step),
  );
  const pathHeight = TOP + ROW * (steps.length - 1) + 52;

  const describe = (step: FlowStep): string => {
    if (step === 1) return t('lessonFlow.map_review');
    if (step === 6) return t('lessonFlow.map_result');
    const blocks = blocksOfStep(snapshot, step);
    const activities = blocks.filter(block => flowActivity(block) !== null);
    if (activities.length > 0) {
      return t('lessonFlow.map_activities', {count: activities.length});
    }
    const cards = blocks.reduce(
      (total, block) => total + itemCardIds(block).length,
      0,
    );
    return cards > 0
      ? t('lessonFlow.map_cards', {count: cards})
      : t('lessonFlow.map_read');
  };

  const centers = steps.map((_, index) => ({
    x: STOP_X[index]! * width,
    y: TOP + index * ROW,
  }));
  const segment = (from: number, to: number) =>
    centers
      .slice(from, to + 1)
      .map((point, index, points) => {
        if (index === 0) return `M ${point.x} ${point.y}`;
        const previous = points[index - 1]!;
        const middle = (previous.y + point.y) / 2;
        return `C ${previous.x} ${middle}, ${point.x} ${middle}, ${point.x} ${point.y}`;
      })
      .join(' ');
  const nextIndex = steps.indexOf(nextStep);

  return (
    <View style={themedStyles.container} testID="lesson-flow-map">
      <CurriculumHeroCover
        glyph="book"
        imageUrl={coverUrl}
        level={level}
        scrollY={scrollY}
        testID="lesson-flow-map-cover"
      >
        <View style={themedStyles.titleBlock}>
          {snapshot.unit ? (
            <AppText
              numberOfLines={1}
              style={themedStyles.crumb}
              variant="caption"
            >
              {snapshot.unit.unit_title}
            </AppText>
          ) : null}
          <AppText variant="h1">{snapshot.title}</AppText>
        </View>
        <View style={themedStyles.pills}>
          {spec?.estimated_minutes ? (
            <Chip
              label={t('lessonFlow.map_minutes', {
                count: spec.estimated_minutes,
              })}
            />
          ) : null}
          {activityCount > 0 ? (
            <Chip
              label={t('lessonFlow.map_activities', {count: activityCount})}
            />
          ) : null}
          {level ? <Chip label={level} /> : null}
        </View>
      </CurriculumHeroCover>

      {outcome ? (
        <View testID="lesson-flow-map-goal">
          <LessonOutcomeCard outcome={outcome} />
        </View>
      ) : null}

      <SectionHeader title={t('lessonPlayer.path_title')} />

      <View
        onLayout={(event: LayoutChangeEvent) =>
          setMeasured(event.nativeEvent.layout.width)
        }
        style={{height: pathHeight}}
      >
        {width > 0 ? (
          <Svg
            height={pathHeight}
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            width={width}
          >
            <Path
              d={segment(0, centers.length - 1)}
              fill="none"
              stroke={theme.colors.outlineVariant}
              strokeDasharray="2 12"
              strokeLinecap="round"
              strokeWidth={5}
            />
            {nextIndex > 0 ? (
              <Path
                d={segment(0, nextIndex)}
                fill="none"
                stroke={theme.colors.accent}
                strokeLinecap="round"
                strokeWidth={5}
              />
            ) : null}
          </Svg>
        ) : null}
        {width > 0
          ? steps.map((step, index) => {
              const center = centers[index]!;
              const next = step === nextStep;
              const last = step === 6;
              const size = next ? NEXT_NODE : NODE;
              const onLeft = STOP_X[index]! < 0.5;
              const label = t(`lessonFlow.step_${step}`);
              return (
                <React.Fragment key={step}>
                  {next ? (
                    <View
                      pointerEvents="none"
                      style={[
                        themedStyles.halo,
                        {left: center.x - HALO / 2, top: center.y - HALO / 2},
                      ]}
                    />
                  ) : null}
                  <Pressable
                    accessibilityHint={t('lessonFlow.step_chip_hint')}
                    accessibilityLabel={`${label}. ${describe(step)}`}
                    accessibilityRole="button"
                    onPress={() => onOpenStep(step)}
                    style={[
                      themedStyles.node,
                      {
                        borderRadius: size / 2,
                        height: size,
                        left: center.x - size / 2,
                        top: center.y - size / 2,
                        width: size,
                      },
                      next
                        ? themedStyles.nodeNext
                        : last
                          ? themedStyles.nodeLast
                          : themedStyles.nodeUpcoming,
                    ]}
                    testID={`lesson-flow-step-${step}`}
                  >
                    <MaterialIcon
                      color={
                        next ? theme.colors.accentInk : theme.colors.text.muted
                      }
                      name={FLOW_STEP_ICONS[step]}
                      size={next ? 32 : 26}
                    />
                  </Pressable>
                  <View
                    pointerEvents="none"
                    style={[
                      themedStyles.label,
                      onLeft ? null : themedStyles.labelRight,
                      {
                        left: onLeft
                          ? center.x + HALO / 2 + 4
                          : center.x - HALO / 2 - 4 - LABEL_WIDTH,
                      },
                      {top: center.y - (next ? 34 : 22)},
                    ]}
                  >
                    {next ? (
                      <View style={themedStyles.nextTag}>
                        <AppText
                          style={themedStyles.nextTagText}
                          variant="caption"
                        >
                          {t('lessonFlow.map_next')}
                        </AppText>
                      </View>
                    ) : null}
                    <AppText
                      color={next ? 'primary' : 'secondary'}
                      numberOfLines={1}
                      style={[
                        themedStyles.labelTitle,
                        onLeft ? null : themedStyles.right,
                      ]}
                      variant={next ? 'h3' : 'body'}
                    >
                      {label}
                    </AppText>
                    <AppText
                      color="muted"
                      numberOfLines={1}
                      style={onLeft ? null : themedStyles.right}
                      variant="caption"
                    >
                      {describe(step)}
                    </AppText>
                  </View>
                </React.Fragment>
              );
            })
          : null}
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  const {colors} = theme;
  return StyleSheet.create({
    container: {
      gap: theme.spacing.md,
    },
    crumb: {
      color: colors.primary,
      fontWeight: theme.typography.weight.bold,
    },
    halo: {
      borderColor: colors.accent,
      borderRadius: HALO / 2,
      borderWidth: 3,
      height: HALO,
      position: 'absolute',
      width: HALO,
    },
    label: {
      gap: 2,
      position: 'absolute',
      width: LABEL_WIDTH,
    },
    labelRight: {
      alignItems: 'flex-end',
    },
    labelTitle: {
      fontWeight: theme.typography.weight.bold,
    },
    nextTag: {
      backgroundColor: colors.ink,
      borderRadius: theme.radius.pill,
      paddingHorizontal: theme.spacing.sm,
      paddingVertical: 2,
    },
    nextTagText: {
      color: colors.tertiaryFixed,
      fontWeight: theme.typography.weight.bold,
      letterSpacing: 0.6,
    },
    node: {
      alignItems: 'center',
      justifyContent: 'center',
      position: 'absolute',
    },
    nodeLast: {
      backgroundColor: colors.tertiaryFixed,
      borderRadius: 20,
      borderColor: colors.outlineVariant,
      borderWidth: 2,
      transform: [{rotate: '8deg'}],
    },
    nodeNext: {
      backgroundColor: colors.accent,
      ...getStickerFace(theme, 5),
    },
    nodeUpcoming: {
      backgroundColor: colors.surface,
      borderColor: colors.outlineVariant,
      borderWidth: 2,
    },
    pills: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
    right: {
      textAlign: 'right',
    },
    titleBlock: {
      gap: theme.spacing.xs,
    },
  });
}
