import React, {useMemo, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {FlatList, Pressable, StyleSheet, View} from 'react-native';
import Animated from 'react-native-reanimated';

import {ComposeRequestCards} from '@features/lesson/player';

import {AppText} from '@ui/components/AppText';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {
  lessonCardDurationLabel,
  type LessonCardKind,
  lessonCardKind,
  type LessonCardProgress,
  splitLessonTitle,
} from '@ui/components/LessonCard';
import type {CoverGlyph} from '@ui/components/LibraryCover';
import {SkeletonGroup, skeletonRevealEntering} from '@ui/components/Skeleton';
import {ToneCardSkeleton} from '@ui/components/ToneCard';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useAppNavigation} from '@core/navigation';
import {useFeatureEnabled} from '@core/release';
import type {LessonSourceType} from '@core/schemas/lesson';

import {downloadedVideoCoverUrl} from '../../logic/catalogCover';
import type {LibraryLessonCardView} from '../../logic/lesson';
import {useLessonBookmarks} from '../../logic/lessonCardData';
import {useCreatedLessons} from '../../logic/useCreatedLessons';
import {useRefreshOnRefocus} from '../../logic/useLibrarySegments';
import {type CardAction, ToneCard} from '../ExploreCards';
import {LibraryEmptyState} from '../LibraryEmptyState';
import {LibraryShelf} from '../LibraryShelf';
import {cardToneAt} from '../libraryTones';
import {ActionTile} from '../ToneTiles';

/** Placeholder cards while the lessons are read. */
const SKELETON_CARDS = 3;
/** Rows past this many arrive without the rise (they are off screen). */
const REVEAL_ROWS = 6;

/** "Từ YouTube": where an own lesson came from, above its title. */
export function createdSourceLabel(sourceType: LessonSourceType): string {
  const kind = lessonCardKind(sourceType);
  if (kind === 'video') return 'Từ YouTube';
  if (kind === 'image') return 'Từ ảnh';
  return 'Từ văn bản';
}

/** "Đã học 3/8" or "Đã xong"; null before the learner starts. */
export function createdProgressLabel(
  progress: LessonCardProgress | undefined,
): string | null {
  if (!progress) return null;
  if (progress.state === 'completed') return progress.label ?? 'Đã xong';
  if (progress.done != null && progress.total) {
    return `Đã học ${progress.done}/${progress.total}`;
  }
  return progress.label ?? 'Đang học';
}

/** The lesson's pill: start it, carry on or go over it again. */
export function createdAction(
  progress: LessonCardProgress | undefined,
): CardAction {
  if (progress?.state === 'completed') {
    return {label: 'Ôn lại', glyph: 'check', solid: true};
  }
  if (progress) return {label: 'Học tiếp', glyph: 'play', solid: true};
  return {label: 'Vào học', glyph: 'play', solid: true};
}

const COVER_GLYPHS: Record<LessonCardKind, CoverGlyph> = {
  video: 'subtitles',
  image: 'chat',
  text: 'book',
};

/**
 * "Bài tôi tạo": start a lesson from text/photo or a YouTube link, then the
 * lessons being made and the ones already on this phone, drawn like the
 * Courses cards.
 */
export function CreatedTab() {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const {t} = useTranslation();
  const appNavigation = useAppNavigation();
  const feedClearance = useFloatingTabBarClearance();
  const practiceEnabled = useFeatureEnabled('shortPractice');
  const {isBookmarked, toggleBookmark} = useLessonBookmarks();
  // The lessons are read after the tab has been drawn, outside rendering;
  // placeholder cards breathe in their place meanwhile.
  const {status, lessons, downloads, progress, refresh} = useCreatedLessons({
    practiceEnabled,
  });
  const loading = status === 'loading';
  // The cards rise into place only when they replace the placeholders.
  const revealRef = useRef(loading);
  if (loading) revealRef.current = true;

  useRefreshOnRefocus(refresh);

  const renderLesson = ({
    item,
    index,
  }: {
    item: LibraryLessonCardView;
    index: number;
  }) => {
    const lessonProgress = progress.get(item.id);
    const duration = lessonCardDurationLabel({
      youtubeDurationMs: item.youtubeDurationMs,
      estimatedMinutes: item.durationMin,
    });
    return (
      <Animated.View
        entering={
          revealRef.current && index < REVEAL_ROWS
            ? skeletonRevealEntering(index)
            : undefined
        }
      >
        <ToneCard
          accessibilityHint="Bài học đã tải về. Chạm để học."
          action={createdAction(lessonProgress)}
          bookmark={{
            saved: isBookmarked(item.id),
            onToggle: () =>
              toggleBookmark({
                lessonId: item.id,
                title: item.title,
                sourceType: item.sourceType,
                sentenceCount: item.vocabularyCount,
                estimatedMinutes: null,
                contextLabel: item.contextLabel ?? null,
              }),
          }}
          cover={{
            imageUrl: downloadedVideoCoverUrl({downloads}, item.id),
            glyph: COVER_GLYPHS[lessonCardKind(item.sourceType)],
          }}
          description={[
            item.vocabularyCount > 0 ? `${item.vocabularyCount} câu` : null,
            duration,
            createdProgressLabel(lessonProgress),
          ]
            .filter(Boolean)
            .join(' · ')}
          eyebrow={createdSourceLabel(item.sourceType)}
          footer={
            practiceEnabled && item.practiceReady ? (
              <Pressable
                accessibilityHint={t('practice.entry_hint')}
                accessibilityLabel={t('library.practice_a11y', {
                  title: item.title,
                })}
                accessibilityRole="button"
                onPress={() => appNavigation.openPractice(item.id)}
                style={styles.practice}
                testID={`lesson-practice-${item.id}`}
              >
                <AppText color="primary" variant="label">
                  {t('practice.entry_button')}
                </AppText>
              </Pressable>
            ) : undefined
          }
          gutter={theme.gutter}
          onPress={() => appNavigation.openLesson(item.id)}
          testID={`lesson-item-${item.id}`}
          title={splitLessonTitle(item.title).title}
          tone={cardToneAt(index)}
          video={lessonCardKind(item.sourceType) === 'video'}
        />
      </Animated.View>
    );
  };

  return (
    <FlatList
      ListEmptyComponent={
        loading ? (
          <CreatedLessonsSkeleton
            gap={theme.spacing.lg}
            gutter={theme.gutter}
          />
        ) : (
          <LibraryEmptyState type="lessons" />
        )
      }
      ListHeaderComponent={
        <View style={styles.header}>
          <LibraryShelf
            label="cách tạo bài"
            subtitle="Biến đoạn văn hay video thành bài học"
            title="Tạo bài mới"
            tone="yellow"
          >
            <View style={styles.actions}>
              <ActionTile
                accessibilityHint="Tạo bài từ văn bản hoặc ảnh"
                description="Dán chữ hoặc chụp ảnh"
                icon="edit"
                onPress={() => appNavigation.openCreate()}
                testID="library-create-text"
                title="Từ văn bản"
                tone="accent"
              />
              <ActionTile
                accessibilityHint="Tạo bài từ một video YouTube"
                description="Dán link video"
                icon="play_circle"
                onPress={() => appNavigation.startCreate({kind: 'youtube'})}
                testID="library-create-youtube"
                title="Từ YouTube"
                tone="secondary"
              />
            </View>
          </LibraryShelf>
          <LibraryShelf
            label="bài của tôi"
            subtitle="Đã lưu trên máy này"
            title="Bài của tôi"
            tone="yellow"
          >
            {/* S4.3: six-step lessons still being made. */}
            <ComposeRequestCards />
          </LibraryShelf>
        </View>
      }
      contentContainerStyle={[styles.content, {paddingBottom: feedClearance}]}
      data={lessons}
      keyExtractor={item => item.id}
      renderItem={renderLesson}
      testID="library-created-tab"
    />
  );
}

/** Placeholder lesson cards, breathing in step, while the lessons load. */
function CreatedLessonsSkeleton({gap, gutter}: {gap: number; gutter: number}) {
  return (
    <SkeletonGroup
      motion="pulse"
      style={{gap}}
      testID="library-created-loading"
    >
      {Array.from({length: SKELETON_CARDS}, (_, index) => (
        <ToneCardSkeleton
          gutter={gutter}
          key={index}
          tone={cardToneAt(index)}
        />
      ))}
    </SkeletonGroup>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    content: {
      gap: theme.spacing.lg,
      padding: theme.gutter,
    },
    header: {
      gap: theme.spacing.xxl,
    },
    actions: {
      flexDirection: 'row',
      gap: theme.spacing.md,
    },
    practice: {
      alignSelf: 'flex-start',
      justifyContent: 'center',
      minHeight: 44,
      paddingHorizontal: theme.spacing.xs,
    },
  });
}
