import React, {useCallback, useMemo, useRef} from 'react';
import {useTranslation} from 'react-i18next';
import {
  FlatList,
  type ListRenderItemInfo,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {withAlpha} from '@ui/components/layout';
import {SaveToggle} from '@ui/components/SaveToggle';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';

import type {LessonSentence} from '@core/schemas/lesson';

import {formatCueLabel} from '../logic/canonicalYouTubeCues';
import type {SentenceSaveControl} from '../logic/useSavedVideoSentences';
import {YouTubeSheet} from './YouTubeSheet';

export type YouTubeTranscriptSheetProps = {
  visible: boolean;
  sentences: LessonSentence[];
  activeIndex: number | null;
  currentIndex: number;
  /** When false, highlight follows the study card (AC-002 S2). */
  videoPlaying: boolean;
  showTranslation: boolean;
  /** ♥ on each row: keeps the sentence in "Câu đã lưu". */
  sentenceSave?: SentenceSaveControl;
  onClose: () => void;
  onSelectSentence: (index: number, startMs: number | null) => void;
};

export function YouTubeTranscriptSheet({
  visible,
  sentences,
  activeIndex,
  currentIndex,
  videoPlaying,
  showTranslation,
  sentenceSave,
  onClose,
  onSelectSentence,
}: YouTubeTranscriptSheetProps) {
  const highlightIndex =
    videoPlaying && activeIndex !== null ? activeIndex : currentIndex;
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const listRef = useRef<FlatList<LessonSentence>>(null);

  const initialScrollIndex = useMemo(() => {
    if (sentences.length === 0) return 0;
    const target = highlightIndex ?? currentIndex;
    return Math.max(0, Math.min(target, sentences.length - 1));
  }, [currentIndex, highlightIndex, sentences.length]);

  const handleScrollToIndexFailed = useCallback(
    (info: {index: number; averageItemLength: number}) => {
      const offset = info.averageItemLength * info.index;
      listRef.current?.scrollToOffset({animated: false, offset});
      requestAnimationFrame(() => {
        listRef.current?.scrollToIndex({
          animated: false,
          index: info.index,
        });
      });
    },
    [],
  );

  const renderItem = useCallback(
    ({item, index}: ListRenderItemInfo<LessonSentence>) => {
      const selected = highlightIndex === index;
      const past = highlightIndex !== null && index < highlightIndex;
      return (
        <Pressable
          accessibilityRole="button"
          accessibilityState={{selected}}
          onPress={() => onSelectSentence(index, item.start_ms)}
          style={({pressed}) => [
            styles.row,
            selected ? styles.rowActive : null,
            past ? styles.rowPast : null,
            pressed ? styles.pressed : null,
          ]}
          testID={`youtube-transcript-row-${item.id}`}
        >
          <AppText
            style={[styles.timestamp, selected ? styles.timestampActive : null]}
            variant="label"
          >
            {formatCueLabel(item.start_ms)}
          </AppText>
          <View style={styles.rowText}>
            <AppText style={styles.en} variant="bodyLg">
              {item.text_en}
            </AppText>
            {showTranslation ? (
              <AppText color="secondary" variant="body">
                {item.text_vi}
              </AppText>
            ) : null}
          </View>
          {sentenceSave ? (
            <SaveToggle
              accessibilityHint={t('youtube.study.save_sentence_hint')}
              accessibilityLabel={
                sentenceSave.isSaved(item.id)
                  ? t('youtube.study.unsave_sentence_a11y')
                  : t('youtube.study.save_sentence_a11y')
              }
              onPress={() => sentenceSave.toggle(item)}
              raised="row"
              saved={sentenceSave.isSaved(item.id)}
              testID={`youtube-transcript-save-${item.id}`}
            />
          ) : null}
        </Pressable>
      );
    },
    [
      highlightIndex,
      onSelectSentence,
      sentenceSave,
      showTranslation,
      styles,
      t,
    ],
  );

  const listHeader =
    sentences.length > 0 ? (
      <AppText color="muted" style={styles.meta} variant="label">
        {t('youtube.study.sheet_transcript_meta', {count: sentences.length})}
      </AppText>
    ) : null;

  return (
    <YouTubeSheet
      accessibilityLabel={t('youtube.study.sheet_transcript_title')}
      onClose={onClose}
      testID="youtube-sheet-transcript"
      scrollable={false}
      title={t('youtube.study.sheet_transcript_title')}
      visible={visible}
    >
      {sentences.length === 0 ? (
        <AppText color="secondary" testID="youtube-transcript-empty">
          {t('youtube.study.sheet_transcript_empty')}
        </AppText>
      ) : (
        <FlatList
          ref={listRef}
          ListHeaderComponent={listHeader}
          data={sentences}
          initialScrollIndex={initialScrollIndex}
          keyExtractor={item => item.id}
          onScrollToIndexFailed={handleScrollToIndexFailed}
          renderItem={renderItem}
          testID="youtube-transcript-list"
        />
      )}
    </YouTubeSheet>
  );
}

function makeStyles(theme: AppTheme) {
  const mintEdge = withAlpha(theme.colors.primaryContainer, 0.45);
  return StyleSheet.create({
    en: {
      fontWeight: '700',
    },
    meta: {
      marginBottom: theme.spacing.sm,
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
    row: {
      backgroundColor: theme.colors.surface,
      borderRadius: 18,
      flexDirection: 'row',
      gap: theme.spacing.md,
      marginBottom: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      ...getStickerEdge(3, theme.colors.surfaceHigh),
    },
    rowActive: {
      backgroundColor: theme.colors.accentSoft,
      ...getStickerEdge(3, mintEdge),
    },
    rowPast: {
      opacity: 0.7,
    },
    rowText: {
      flex: 1,
      gap: 3,
    },
    timestamp: {
      color: theme.colors.text.muted,
      fontVariant: ['tabular-nums'],
      minWidth: 40,
    },
    timestampActive: {
      color: theme.colors.primary,
    },
  });
}
