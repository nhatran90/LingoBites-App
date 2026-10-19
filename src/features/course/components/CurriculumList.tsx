import React, {useMemo, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';
import Animated from 'react-native-reanimated';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import type {HeroScrollHandler} from '@ui/components/CurriculumHeroChrome';
import {
  GRID_TILE_GAP,
  GridTile,
  gridTileToneAt,
  useGridTileWidth,
} from '@ui/components/GridTile';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {Medallion} from '@ui/components/Medallion';
import {
  SkeletonBlock,
  SkeletonGroup,
  skeletonRevealEntering,
} from '@ui/components/Skeleton';
import {type AppTheme, useAppTheme} from '@ui/theme';

export type CurriculumRow = {
  id: string;
  title: string;
  description?: string;
  /** Small label above the title (level code, lesson number). */
  eyebrow?: string;
  /** Extra content under the description (progress bar, completed mark). */
  footer?: React.ReactNode;
  /** Locked (paid) content the user has not unlocked. */
  locked?: boolean;
  accessibilityHint: string;
  onPress: () => void;
  /** Replaces the default list card (e.g. a `LessonCard` for lessons). */
  card?: React.ReactElement;
  /** Wide picture above the copy (course cards), e.g. a `LibraryCover`. */
  cover?: React.ReactNode;
  /** Square picture left of the copy (unit cards), e.g. a `LibraryCover`. */
  thumbnail?: React.ReactNode;
};

/** Rows past the first screen mount on scroll and should not animate. */
const REVEAL_ROWS = 10;

type Props = {
  status: 'loading' | 'error' | 'ready';
  rows: CurriculumRow[];
  emptyMessage: string;
  onRetry: () => void;
  /** Prefix for list/row test ids, e.g. `course-list`. */
  testID: string;
  header?: React.ReactElement;
  /** Shown after the cards (e.g. the end of a unit route). */
  footer?: React.ReactElement;
  /** Scroll position, e.g. for `useHeroScroll`. */
  onScroll?: HeroScrollHandler;
  /** `grid`: two-column tiles (course list); `list`: one card per row. */
  layout?: 'list' | 'grid';
  /** Placeholder rows shown under the header while loading. */
  skeleton?: React.ReactElement;
};

/**
 * One list layout for every curriculum level (courses, levels, units,
 * lessons): the header with placeholder rows while loading, retryable
 * error, empty state, then cards. Cards that replace placeholders rise
 * into place one after another.
 */
export function CurriculumList({
  status,
  rows,
  emptyMessage,
  onRetry,
  testID,
  header,
  footer,
  onScroll,
  layout = 'list',
  skeleton,
}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const floatingClearance = useFloatingTabBarClearance();
  const tileWidth = useGridTileWidth();
  const isGrid = layout === 'grid';
  // Only cards that replace placeholders animate in; a list that was ready
  // from the start (or is refreshed) stays still.
  const revealRef = useRef(status === 'loading');
  if (status === 'loading') revealRef.current = true;
  const reveal = revealRef.current;

  if (status === 'error') {
    return (
      <View style={themedStyles.errorBox}>
        <AppText color="danger" testID={`${testID}-error`}>
          {t('course.load_failed')}
        </AppText>
        <AppButton
          accessibilityHint={t('course.retry_hint')}
          onPress={onRetry}
          testID={`${testID}-retry`}
          title={t('common.retry')}
          variant="secondary"
        />
      </View>
    );
  }

  return (
    <Animated.FlatList
      testID={testID}
      data={rows}
      keyExtractor={item => item.id}
      ListHeaderComponent={header}
      ListFooterComponent={rows.length > 0 ? footer : undefined}
      onScroll={onScroll}
      scrollEventThrottle={onScroll ? 16 : undefined}
      ListEmptyComponent={
        status === 'loading' ? (
          <SkeletonGroup testID={`${testID}-loading`}>
            {skeleton ?? <CurriculumCardsSkeleton />}
          </SkeletonGroup>
        ) : (
          <View style={themedStyles.empty}>
            <Medallion label="🎓" />
            <AppText
              color="secondary"
              style={styles.centered}
              testID={`${testID}-empty`}
            >
              {emptyMessage}
            </AppText>
          </View>
        )
      }
      numColumns={isGrid ? 2 : 1}
      columnWrapperStyle={isGrid ? {gap: GRID_TILE_GAP} : undefined}
      renderItem={({item, index}) => (
        <Animated.View
          entering={
            reveal && index < REVEAL_ROWS
              ? skeletonRevealEntering(index)
              : undefined
          }
        >
          {item.card && !isGrid ? (
            item.card
          ) : isGrid ? (
            <GridTile
              icon="menu_book"
              title={item.title}
              subtitle={item.description?.trim() || undefined}
              meta={item.eyebrow}
              locked={item.locked}
              tone={gridTileToneAt(index)}
              width={tileWidth}
              accessibilityHint={item.accessibilityHint}
              onPress={item.onPress}
              testID={`${testID}-row-${item.id}`}
            />
          ) : (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={item.title}
              accessibilityHint={item.accessibilityHint}
              testID={`${testID}-row-${item.id}`}
              onPress={item.onPress}
            >
              <AppCard>
                {item.cover ? (
                  <View
                    style={themedStyles.cover}
                    testID={`${testID}-cover-${item.id}`}
                  >
                    {item.cover}
                  </View>
                ) : null}
                <View style={styles.cardRow}>
                  {item.thumbnail ? (
                    <View
                      style={themedStyles.thumbnail}
                      testID={`${testID}-thumbnail-${item.id}`}
                    >
                      {item.thumbnail}
                    </View>
                  ) : null}
                  <View style={styles.cardContent}>
                    {item.eyebrow ? (
                      <AppText color="secondary" variant="caption">
                        {item.eyebrow}
                      </AppText>
                    ) : null}
                    <View style={styles.titleRow}>
                      <AppText
                        style={styles.titleText}
                        variant={item.cover ? 'h2' : 'h3'}
                      >
                        {item.title}
                      </AppText>
                      {item.locked ? (
                        <MaterialIcon
                          color={theme.colors.text.secondary}
                          name="lock"
                          size={18}
                        />
                      ) : null}
                    </View>
                    {item.description && item.description.trim().length > 0 ? (
                      <AppText
                        color="secondary"
                        ellipsizeMode="tail"
                        numberOfLines={2}
                        variant="label"
                      >
                        {item.description}
                      </AppText>
                    ) : null}
                    {item.footer}
                  </View>
                </View>
              </AppCard>
            </Pressable>
          )}
        </Animated.View>
      )}
      contentContainerStyle={[
        themedStyles.list,
        {paddingBottom: floatingClearance},
      ]}
    />
  );
}

/** Default placeholders: three plain cards with a title and two lines. */
function CurriculumCardsSkeleton() {
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={themedStyles.skeleton}>
      {[0, 1, 2].map(index => (
        <View key={index} style={themedStyles.skeletonCard}>
          <SkeletonBlock height={12} width="30%" />
          <SkeletonBlock height={16} width="70%" />
          <SkeletonBlock height={12} width="90%" />
        </View>
      ))}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    // Course pictures run to the card's edges, under its rounded top.
    cover: {
      borderTopLeftRadius: theme.components.card.radius,
      borderTopRightRadius: theme.components.card.radius,
      marginBottom: theme.spacing.md,
      marginHorizontal: -theme.components.card.padding,
      marginTop: -theme.components.card.padding,
      overflow: 'hidden',
    },
    thumbnail: {
      alignSelf: 'flex-start',
      borderRadius: 14,
      overflow: 'hidden',
      width: 96,
    },
    empty: {
      alignItems: 'center',
      gap: theme.spacing.md,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.xl,
    },
    errorBox: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      gap: theme.spacing.md,
      margin: theme.gutter,
      padding: theme.spacing.lg,
    },
    list: {
      gap: theme.spacing.md,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
    },
    skeleton: {
      gap: theme.spacing.md,
    },
    skeletonCard: {
      backgroundColor: theme.components.card.background,
      borderRadius: theme.components.card.radius,
      gap: 8,
      padding: theme.components.card.padding,
    },
  });
}

const styles = StyleSheet.create({
  cardRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cardContent: {
    flex: 1,
    gap: 6,
    minWidth: 0,
  },
  titleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  titleText: {
    flexShrink: 1,
  },
  centered: {
    textAlign: 'center',
  },
});
