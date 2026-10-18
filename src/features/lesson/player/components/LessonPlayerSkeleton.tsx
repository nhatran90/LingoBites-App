import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {SkeletonBlock, SkeletonGroup} from '@ui/components/Skeleton';
import {type AppTheme, useAppTheme} from '@ui/theme';

/**
 * The lesson page while it loads: a block for the lesson's card, its row of
 * section tabs and a few sentence cards, in place of a lone spinner. Screen
 * readers hear one "loading" label.
 */
export function LessonPlayerSkeleton({testID}: {testID: string}) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <View
      accessibilityHint={t('lessonPlayer.loading_hint')}
      accessibilityLabel={t('lessonPlayer.loading')}
      accessibilityRole="progressbar"
      accessible
      testID={testID}
    >
      <SkeletonGroup style={themedStyles.group}>
        <View style={themedStyles.hero}>
          <SkeletonBlock height={12} width="45%" />
          <SkeletonBlock height={20} width="75%" />
          <View style={styles.row}>
            {[56, 64, 56].map((width, index) => (
              <SkeletonBlock
                height={22}
                key={index}
                radius={theme.radius.pill}
                width={width}
              />
            ))}
          </View>
        </View>
        <View style={styles.row}>
          {[0, 1, 2].map(index => (
            <SkeletonBlock
              height={34}
              key={index}
              radius={theme.radius.pill}
              style={styles.tab}
            />
          ))}
        </View>
        {[0, 1, 2, 3].map(index => (
          <View key={index} style={themedStyles.sentence}>
            <SkeletonBlock height={14} width="85%" />
            <SkeletonBlock height={12} width="60%" />
          </View>
        ))}
      </SkeletonGroup>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 8,
  },
  tab: {
    flex: 1,
  },
});

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    group: {
      gap: theme.spacing.md,
    },
    hero: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      gap: 10,
      padding: theme.spacing.lg,
    },
    sentence: {
      backgroundColor: theme.components.card.background,
      borderRadius: theme.radius.md,
      gap: 8,
      padding: theme.spacing.md,
    },
  });
}
