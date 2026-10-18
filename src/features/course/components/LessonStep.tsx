import React, {useMemo, useState} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import type {LessonCardProgress} from '@ui/components/LessonCard';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {SaveToggle} from '@ui/components/SaveToggle';
import {SkeletonBlock} from '@ui/components/Skeleton';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {CurriculumSurface} from './CurriculumSurface';
import {RouteLine} from './RouteLine';

/** Where a lesson stands in its unit. */
export type LessonStepState = 'done' | 'current' | 'upcoming';

const DOT = 36;

type Props = {
  number: number;
  title: string;
  /** What the learner will be able to do, e.g. "Bạn sẽ: …". */
  canDo?: string | null;
  canDoTestID?: string;
  /** Square picture, e.g. a `LibraryCover`. */
  thumbnail: React.ReactNode;
  state: LessonStepState;
  durationLabel?: string | null;
  downloaded?: boolean;
  progress?: LessonCardProgress | null;
  exerciseCount?: number | null;
  bookmarked: boolean;
  onToggleBookmark: () => void;
  onPress: () => void;
  /** Gap to the next step, so the line reaches it. */
  gap: number;
  accessibilityLabel: string;
  accessibilityHint: string;
  testID: string;
};

type Tag = {
  key: string;
  icon: HandoffIconName;
  label: string;
  tone: 'plain' | 'ok' | 'coral';
};

/**
 * One lesson as a step of its unit: a numbered dot on the unit's line
 * (ticked once learnt, lit on the lesson to take next) and the lesson card
 * with its picture, what it teaches and its status tags.
 */
export function LessonStep({
  number,
  title,
  canDo,
  canDoTestID,
  thumbnail,
  state,
  durationLabel,
  downloaded,
  progress,
  exerciseCount,
  bookmarked,
  onToggleBookmark,
  onPress,
  gap,
  accessibilityLabel,
  accessibilityHint,
  testID,
}: Props) {
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [pressed, setPressed] = useState(false);
  const tags = buildTags({
    durationLabel,
    downloaded,
    progress,
    exerciseCount,
  });

  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <View
          style={[
            themedStyles.dot,
            state === 'done' && themedStyles.dotDone,
            state === 'current' && themedStyles.dotCurrent,
          ]}
        >
          {state === 'done' ? (
            <MaterialIcon
              color={theme.colors.text.inverse}
              name="check_circle"
              size={22}
            />
          ) : (
            <AppText
              style={[
                themedStyles.dotText,
                state === 'current' && themedStyles.dotTextCurrent,
              ]}
            >
              {number}
            </AppText>
          )}
        </View>
        <RouteLine done={state === 'done'} overhang={gap} />
      </View>
      <View style={styles.card}>
        <CurriculumSurface
          faceStyle={styles.face}
          highlighted={state === 'current'}
          pressed={pressed}
        >
          <Pressable
            accessibilityHint={accessibilityHint}
            accessibilityLabel={accessibilityLabel}
            accessibilityRole="button"
            onPress={onPress}
            onPressIn={() => setPressed(true)}
            onPressOut={() => setPressed(false)}
            style={styles.body}
            testID={testID}
          >
            <View style={themedStyles.thumb}>{thumbnail}</View>
            <View style={styles.copy}>
              <AppText numberOfLines={2} style={styles.title} variant="label">
                {title}
              </AppText>
              {canDo ? (
                <AppText
                  color="secondary"
                  numberOfLines={2}
                  testID={canDoTestID}
                  variant="caption"
                >
                  {canDo}
                </AppText>
              ) : null}
              {tags.length > 0 ? (
                <View style={styles.tags}>
                  {tags.map(tag => (
                    <View
                      key={tag.key}
                      style={[
                        themedStyles.tag,
                        tag.tone === 'ok' && themedStyles.tagOk,
                        tag.tone === 'coral' && themedStyles.tagCoral,
                      ]}
                      testID={`${testID}-chip-${tag.key}`}
                    >
                      <MaterialIcon
                        color={tagColor(theme, tag.tone)}
                        name={tag.icon}
                        size={13}
                      />
                      <AppText
                        style={[
                          themedStyles.tagText,
                          {color: tagColor(theme, tag.tone)},
                        ]}
                      >
                        {tag.label}
                      </AppText>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          </Pressable>
          <SaveToggle
            hitSlop={4}
            onPress={onToggleBookmark}
            raised="row"
            saved={bookmarked}
            style={styles.bookmark}
            testID={`${testID}-bookmark`}
          />
        </CurriculumSurface>
      </View>
    </View>
  );
}

/**
 * A lesson step while the unit loads: its numbered dot and line, and a card
 * with a picture block and placeholder lines. Place inside a
 * `SkeletonGroup`.
 */
export function LessonStepSkeleton({
  number,
  gap,
}: {
  number: number;
  gap: number;
}) {
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <View style={themedStyles.dot}>
          <AppText style={themedStyles.dotText}>{number}</AppText>
        </View>
        <RouteLine overhang={gap} />
      </View>
      <View style={styles.card}>
        <CurriculumSurface faceStyle={styles.face}>
          <View style={styles.body}>
            <SkeletonBlock height={58} radius={16} width={58} />
            <View style={styles.skeletonCopy}>
              <SkeletonBlock height={14} width="75%" />
              <SkeletonBlock height={11} width="90%" />
              <SkeletonBlock
                height={20}
                radius={theme.radius.pill}
                style={styles.skeletonTag}
                width={72}
              />
            </View>
          </View>
        </CurriculumSurface>
      </View>
    </View>
  );
}

function buildTags({
  durationLabel,
  downloaded,
  progress,
  exerciseCount,
}: Pick<
  Props,
  'durationLabel' | 'downloaded' | 'progress' | 'exerciseCount'
>): Tag[] {
  const tags: Tag[] = [];
  if (progress) {
    tags.push({
      key: 'progress',
      icon: progress.state === 'completed' ? 'check_circle' : 'timer',
      label:
        progress.label ??
        (progress.state === 'completed' ? 'Đã học' : 'Đang học'),
      tone: progress.state === 'completed' ? 'ok' : 'plain',
    });
  } else if (durationLabel) {
    tags.push({
      key: 'duration',
      icon: 'schedule',
      label: durationLabel,
      tone: 'plain',
    });
  }
  if (exerciseCount != null && exerciseCount > 0) {
    tags.push({
      key: 'exercises',
      icon: 'rule',
      label: `${exerciseCount} bài tập`,
      tone: 'coral',
    });
  }
  if (downloaded) {
    tags.push({
      key: 'downloaded',
      icon: 'smartphone',
      label: 'Đã tải',
      tone: 'ok',
    });
  }
  return tags;
}

function tagColor(theme: AppTheme, tone: Tag['tone']) {
  if (tone === 'ok') return theme.colors.accentInk;
  if (tone === 'coral') return theme.colors.secondary;
  return theme.colors.text.muted;
}

const styles = StyleSheet.create({
  body: {
    flex: 1,
    flexDirection: 'row',
    gap: 12,
    minWidth: 0,
  },
  bookmark: {
    alignSelf: 'flex-start',
  },
  card: {
    flex: 1,
    minWidth: 0,
  },
  copy: {
    flex: 1,
    gap: 3,
    minWidth: 0,
  },
  face: {
    flexDirection: 'row',
    gap: 8,
    padding: 12,
  },
  rail: {
    alignItems: 'center',
    paddingTop: 14,
    width: DOT,
  },
  row: {
    flexDirection: 'row',
    gap: 12,
  },
  skeletonCopy: {
    flex: 1,
    gap: 6,
    minWidth: 0,
    paddingTop: 2,
  },
  skeletonTag: {
    marginTop: 2,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 4,
  },
  title: {
    fontSize: 16,
    lineHeight: 21,
  },
});

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    dot: {
      alignItems: 'center',
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.outlineVariant,
      borderRadius: DOT / 2,
      borderWidth: 2,
      height: DOT,
      justifyContent: 'center',
      width: DOT,
    },
    dotCurrent: {
      backgroundColor: theme.colors.accent,
      borderColor: theme.colors.accentSoft,
      borderWidth: 3,
    },
    dotDone: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    dotText: {
      color: theme.colors.text.muted,
      fontSize: 14,
      fontWeight: '800',
      lineHeight: 18,
    },
    dotTextCurrent: {
      color: theme.colors.accentInk,
    },
    tag: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: 4,
      paddingHorizontal: 8,
      paddingVertical: 3,
    },
    tagCoral: {
      backgroundColor: theme.colors.secondarySoft,
    },
    tagOk: {
      backgroundColor: theme.colors.accentSoft,
    },
    tagText: {
      fontSize: 11.5,
      fontWeight: '700',
      lineHeight: 15,
    },
    thumb: {
      borderRadius: 16,
      height: 58,
      overflow: 'hidden',
      width: 58,
    },
  });
}
