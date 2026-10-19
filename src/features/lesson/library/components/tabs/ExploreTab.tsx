import {useFocusEffect} from '@react-navigation/native';
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ScrollView, StyleSheet, View} from 'react-native';

import {useCanonicalCatalog} from '@features/lesson/player';
import {
  kindSummary,
  type PackRow,
  packTitle,
  useWordPathRows,
} from '@features/wordPath';

import {AppText} from '@ui/components/AppText';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {formatVideoDuration, splitLessonTitle} from '@ui/components/LessonCard';
import {topicGlyph} from '@ui/components/LibraryCover';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {
  PACK_CARD_HEIGHT,
  PACK_CARD_SHELF_HEIGHT,
  PackStatusCard,
} from '@ui/components/PackStatusCard';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useAppNavigation} from '@core/navigation';

import {catalogCoverUrl} from '../../logic/catalogCover';
import {
  EMPTY_LESSON_CARD_STATE,
  readLessonCardLocalState,
  useLessonBookmarks,
} from '../../logic/lessonCardData';
import {
  getLibrarySection,
  type LibrarySectionConfig,
} from '../../logic/librarySections';
import {useRefreshOnRefocus} from '../../logic/useLibrarySegments';
import {type CardAction, ToneCard} from '../ExploreCards';
import {LibraryShelf, type ShelfStatus} from '../LibraryShelf';
import {cardToneAt, libraryTone} from '../libraryTones';
import {PackStack} from '../PackStack';
import {videoContextLabel} from '../PublicLessonsList';
import {createdAction, createdProgressLabel} from './CreatedTab';

/** How many packs the stack holds before "Tất cả". */
export const SHELF_LIMIT = 3;
/** How many videos the shelf shows before "Tất cả". */
export const VIDEO_LIMIT = 3;

const PUBLIC_VIDEOS = getLibrarySection('publicVideo');

const PACK_ORDER: Record<PackRow['status'], number> = {
  learning: 0,
  ready: 1,
  not_downloaded: 2,
  done: 3,
};

/** Packs being learned first, then downloaded ones, then the rest. */
export function shelfPacks(rows: readonly PackRow[]): PackRow[] {
  return [...rows]
    .sort((a, b) => PACK_ORDER[a.status] - PACK_ORDER[b.status])
    .slice(0, SHELF_LIMIT);
}

/**
 * "Khám phá": what LingoBites provides, as shelves of word packs and public
 * videos. Public lessons all sit in a course unit, so they live under "Khóa
 * học" rather than here. Packs on the phone still show offline.
 */
export function ExploreTab() {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const {t} = useTranslation();
  const feedClearance = useFloatingTabBarClearance();
  const appNavigation = useAppNavigation();
  const packs = useWordPathRows();
  const offlineTone = libraryTone(theme, 'yellow');

  useRefreshOnRefocus(packs.reload);

  // Leaving the tab (e.g. for the pack list) starts the stack over, so it
  // is back on the first pack with all three piled up on return.
  const [stackKey, setStackKey] = useState(0);
  useFocusEffect(useCallback(() => () => setStackKey(key => key + 1), []));

  const packStatus: ShelfStatus | null =
    packs.rows === null
      ? {kind: 'loading'}
      : packs.rows.length === 0
        ? {
            kind: 'message',
            text: packs.offline ? 'Cần mạng để xem gói học' : 'Chưa có gói học',
            onRetry: packs.offline ? packs.reload : undefined,
          }
        : null;
  const packCount = packs.rows?.length ?? 0;

  return (
    <ScrollView
      contentContainerStyle={[styles.content, {paddingBottom: feedClearance}]}
      testID="library-explore-tab"
    >
      {packs.offline ? (
        <View style={[styles.offline, {backgroundColor: offlineTone.soft}]}>
          <MaterialIcon
            color={theme.colors.text.secondary}
            name="warning"
            size={18}
          />
          <AppText
            color="secondary"
            style={styles.offlineText}
            testID="library-explore-offline"
          >
            Đang offline: chỉ hiện những gì đã có trên máy.
          </AppText>
        </View>
      ) : null}
      <LibraryShelf
        count={packCount > 0 ? String(packCount) : null}
        label="gói học"
        onSeeAll={() => appNavigation.openLibrarySection('wordPath')}
        seeAllLabel={`Xem cả ${packCount} gói`}
        status={packStatus}
        subtitle="Học theo chủ đề, tải về để học offline"
        testID="library-shelf-packs"
        title="Gói từ vựng"
        tone="teal"
      >
        <PackStack
          items={shelfPacks(packs.rows ?? [])}
          key={stackKey}
          cardHeight={PACK_CARD_HEIGHT + PACK_CARD_SHELF_HEIGHT}
          keyOf={row => row.packId}
          moreCount={Math.max(packCount - SHELF_LIMIT, 0)}
          onPastEnd={() => appNavigation.openLibrarySection('wordPath')}
          renderCard={(row, _index, a11y) => (
            <PackStatusCard
              {...a11y}
              accessibilityHint={
                row.downloaded
                  ? t('wordPath.open_hint')
                  : 'Mở danh sách gói để tải về'
              }
              action={packAction(row)}
              cover={{imageUrl: row.coverUrl, glyph: topicGlyph(row.topicCode)}}
              description={kindSummary(t, row.kindCounts)}
              eyebrow={
                row.topic
                  ? t('wordPath.pack_title', {position: row.position})
                  : null
              }
              gutter={theme.spacing.md}
              learned={row.learned}
              learnedLabel={t('wordPath.learned_label')}
              level={row.level}
              onPress={() =>
                row.downloaded
                  ? appNavigation.openWordPack(row.packId)
                  : appNavigation.openLibrarySection('wordPath')
              }
              remoteNote={t('wordPath.remote_note')}
              status={row.status}
              statusLabel={t(`wordPath.status_${row.status}`)}
              testID={`library-pack-${row.packId}`}
              title={packTitle(t, row)}
              total={row.total}
            />
          )}
          testID="library-pack-stack"
        />
      </LibraryShelf>
      <PatternTenseShelf />
      <VideoShelf />
    </ScrollView>
  );
}

/** Vocab path P6: the way into the pattern library and the tense map. */
function PatternTenseShelf() {
  const {theme} = useAppTheme();
  const appNavigation = useAppNavigation();
  const patterns = getLibrarySection('patterns');
  const tenses = getLibrarySection('tenses');
  return (
    <LibraryShelf
      label="mẫu câu và thì"
      subtitle="Tra mẫu theo ý muốn nói, xem mình nhớ thì nào"
      testID="library-shelf-patterns"
      title="Mẫu câu & thì"
      tone="violet"
    >
      <ToneCard
        accessibilityHint="Mở kho mẫu câu"
        action={{label: 'Xem', solid: true}}
        cover={{imageUrl: null, glyph: 'chat'}}
        description={patterns.description}
        gutter={theme.spacing.md}
        onPress={() => appNavigation.openLibrarySection(patterns.id)}
        testID="library-patterns-card"
        title={patterns.title}
        tone={cardToneAt(0)}
      />
      <ToneCard
        accessibilityHint="Mở bản đồ thì"
        action={{label: 'Xem', solid: true}}
        cover={{imageUrl: null, glyph: 'school'}}
        description={tenses.description}
        gutter={theme.spacing.md}
        onPress={() => appNavigation.openLibrarySection(tenses.id)}
        testID="library-tenses-card"
        title={tenses.title}
        tone={cardToneAt(1)}
      />
    </LibraryShelf>
  );
}

/** The pack's pill: download it, start it, carry on or go over it again. */
export function packAction(row: PackRow): CardAction {
  if (!row.downloaded) {
    return {label: 'Tải về', glyph: 'download', solid: false};
  }
  if (row.status === 'done') {
    return {label: 'Ôn lại', glyph: 'check', solid: true};
  }
  if (row.learned > 0) {
    return {label: 'Học tiếp', glyph: 'play', solid: true};
  }
  return {label: 'Vào học', glyph: 'play', solid: true};
}

/** Folder state for a catalog query: spinner, error, empty or none. */
function catalogStatus(
  state: ReturnType<typeof useCanonicalCatalog>['state'],
  refresh: () => void,
  emptyHint: string,
): ShelfStatus | null {
  return state.status === 'idle' || state.status === 'loading'
    ? {kind: 'loading'}
    : state.status === 'error'
      ? {kind: 'message', text: 'Cần mạng để xem', onRetry: refresh}
      : state.lessons.length === 0
        ? {kind: 'message', text: emptyHint}
        : null;
}

/** "20" or "20+" when the server has more than the first page. */
function catalogCount(
  state: ReturnType<typeof useCanonicalCatalog>['state'],
): string | null {
  if (state.status !== 'ready' || state.lessons.length === 0) return null;
  return `${state.lessons.length}${state.nextCursor ? '+' : ''}`;
}

function useSectionCatalog(section: LibrarySectionConfig) {
  const catalog = useCanonicalCatalog({
    origin: section.catalog?.origin,
    sourceType: section.catalog?.sourceType,
    kind: section.catalog?.kind,
  });
  const {refresh} = catalog;
  useEffect(() => {
    refresh();
  }, [refresh]);
  return catalog;
}

/** Public videos, drawn like the "Video công khai" list. */
function VideoShelf() {
  const testID = 'library-shelf-videos';
  const {theme} = useAppTheme();
  const appNavigation = useAppNavigation();
  const {state, refresh} = useSectionCatalog(PUBLIC_VIDEOS);
  const {isBookmarked, toggleBookmark} = useLessonBookmarks();
  const count = catalogCount(state);
  const videos =
    state.status === 'ready' ? state.lessons.slice(0, VIDEO_LIMIT) : [];
  const localState = useMemo(
    () =>
      state.status === 'ready'
        ? readLessonCardLocalState()
        : EMPTY_LESSON_CARD_STATE,
    [state.status],
  );

  return (
    <LibraryShelf
      count={count}
      label="video"
      onSeeAll={() => appNavigation.openLibrarySection(PUBLIC_VIDEOS.id)}
      seeAllLabel={count ? `Xem cả ${count} video` : 'Xem tất cả video'}
      status={catalogStatus(state, refresh, PUBLIC_VIDEOS.emptyHint)}
      subtitle={PUBLIC_VIDEOS.description}
      testID={testID}
      title="Xem & học"
      tone="coral"
    >
      {videos.map((item, index) => {
        const contextLabel = videoContextLabel(item);
        const progress = localState.progress.get(item.id);
        return (
          <ToneCard
            accessibilityHint="Mở video"
            action={
              progress
                ? createdAction(progress)
                : {label: 'Xem', glyph: 'play', solid: true}
            }
            bookmark={{
              saved: isBookmarked(item.id),
              onToggle: () =>
                toggleBookmark({
                  lessonId: item.id,
                  title: item.title,
                  sourceType: item.source_type,
                  sentenceCount: item.sentence_count,
                  estimatedMinutes: item.estimated_minutes ?? null,
                  contextLabel,
                }),
            }}
            cover={{imageUrl: catalogCoverUrl(item), glyph: 'subtitles'}}
            description={[
              item.youtube_duration_ms
                ? formatVideoDuration(item.youtube_duration_ms)
                : null,
              item.cefr_level,
              localState.downloadedIds.has(item.id) ? 'Đã tải' : null,
              createdProgressLabel(progress),
            ]
              .filter(Boolean)
              .join(' · ')}
            eyebrow={contextLabel}
            gutter={theme.spacing.md}
            key={item.id}
            onPress={() => appNavigation.openLesson(item.id)}
            testID={`${testID}-${item.id}`}
            title={splitLessonTitle(item.title).title}
            tone={cardToneAt(index)}
            video
          />
        );
      })}
    </LibraryShelf>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    content: {
      gap: theme.spacing.xl,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.md,
    },
    offline: {
      alignItems: 'center',
      borderRadius: 14,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    offlineText: {
      flex: 1,
      fontSize: 13,
      fontWeight: '700',
    },
  });
}
