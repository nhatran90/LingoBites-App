import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ScrollView, StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppProgressBar} from '@ui/components/AppProgressBar';
import {AppText} from '@ui/components/AppText';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';

import type {
  LessonAnalysis,
  LessonCatalogItem,
  LessonSnapshot,
} from '@core/schemas/lesson';

import {
  activeSentenceIndexAt,
  sentenceLoopEndMs,
  startedSentenceIndexAt,
} from '../logic/canonicalYouTubeCues';
import {sortedBlocks, sortedSentences} from '../logic/lessonHubContent';
import {
  bareWord,
  findVocabularyForWord,
  stripIpaDelimiters,
} from '../logic/sentenceIpa';
import {
  type SentenceRepeat,
  shouldRepeatSentence,
} from '../logic/sentenceRepeat';
import type {VocabularySaveControl} from '../logic/useLessonSavedItems';
import type {SentenceSaveControl} from '../logic/useSavedVideoSentences';
import {CanonicalBlockView} from './CanonicalBlockView';
import {LessonStatusBanners} from './LessonStatusBanners';
import {LessonStudyToolbar} from './LessonStudyToolbar';
import type {
  SentenceAnalysisPanelError,
  SentenceAnalysisPanelState,
} from './SentenceAnalysisPanel';
import {VideoLessonsSection} from './VideoLessonsSection';
import {WordBubble} from './WordBubble';
import {YouTubeAnalysisSheet} from './YouTubeAnalysisSheet';
import {
  type SentenceWordSelection,
  YouTubeSentenceCarousel,
} from './YouTubeSentenceCarousel';
import {YouTubeTranscriptSheet} from './YouTubeTranscriptSheet';

export type YouTubeLessonStudyProps = {
  snapshot: LessonSnapshot;
  analyses: Record<string, LessonAnalysis>;
  lateAnalyses?: Record<string, LessonAnalysis>;
  offline?: boolean;
  hasUpdate?: boolean;
  playbackPositionMs: number;
  videoAvailable: boolean;
  videoPlaying: boolean;
  showTranslation?: boolean;
  showIpa?: boolean;
  unavailableReason?: string;
  videoSlot?: React.ReactNode;
  onRetryVideo?: () => void;
  onSeek?: (positionMs: number) => void;
  /** Tapping a card pauses the video so the learner can read it. */
  onPauseVideo?: () => void;
  onRequestAnalysis?: (sentenceId: string) => void;
  onRetryAnalysis?: (sentenceId: string) => void;
  analysisStates?: Record<
    string,
    SentenceAnalysisPanelState | SentenceAnalysisPanelError
  >;
  onSpeakText?: (text: string) => void;
  vocabularySave?: VocabularySaveControl;
  /** ♥ on the sentence cards and transcript rows. */
  sentenceSave?: SentenceSaveControl;
  /** Public video: the six-step lessons made from it, listed under it. */
  videoLessons?: readonly LessonCatalogItem[];
  onOpenVideoLesson?: (lessonId: string) => void;
  /** Resumes the video (replay sentence). */
  onPlayVideo?: () => void;
  /** Past the last sentence: the lesson is finished (FR-09). */
  onFinish?: () => void;
  /** How many times the sentence plays again before the video moves on. */
  sentenceRepeat?: SentenceRepeat;
  /** Current video speed, shown on the toolbar. */
  playbackRate?: number;
  onCyclePlaybackRate?: () => void;
  /** Reports the card in view so the screen header can show "Câu x/y". */
  onCurrentSentenceChange?: (current: CurrentSentenceInfo) => void;
};

export type CurrentSentenceInfo = {
  /** 1-based position (0 when the lesson has no sentences). */
  position: number;
  total: number;
  startMs: number | null;
};

/** Poll slack: loop a little before the cue end so the next line never shows. */
const LOOP_END_SLACK_MS = 150;

type OpenSheet = 'none' | 'analysis' | 'transcript';

export function YouTubeLessonStudy({
  snapshot,
  analyses,
  lateAnalyses,
  offline,
  hasUpdate,
  playbackPositionMs,
  videoAvailable,
  videoPlaying,
  showTranslation = true,
  showIpa = true,
  unavailableReason,
  videoSlot,
  onRetryVideo,
  onSeek,
  onPauseVideo,
  onRequestAnalysis,
  onRetryAnalysis,
  analysisStates,
  onSpeakText,
  vocabularySave,
  sentenceSave,
  videoLessons,
  onOpenVideoLesson,
  onPlayVideo,
  onFinish,
  sentenceRepeat = 0,
  playbackRate = 1,
  onCyclePlaybackRate,
  onCurrentSentenceChange,
}: YouTubeLessonStudyProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [openSheet, setOpenSheet] = useState<OpenSheet>('none');
  const [carouselScrollAnimated, setCarouselScrollAnimated] = useState(false);
  // Cards follow the video timeline while it plays. Any manual navigation
  // (swipe, prev/next, card tap, transcript) stops following until the video
  // is played again.
  const [followVideo, setFollowVideo] = useState(true);
  const [selectedWord, setSelectedWord] =
    useState<SentenceWordSelection | null>(null);
  const currentIndexRef = useRef(0);
  currentIndexRef.current = currentIndex;
  // Set once a loop seek is sent; cleared when playback is back inside the
  // sentence, so late position polls cannot send the seek twice.
  const loopSeekSentRef = useRef(false);
  // Jumps back made on the current card; the card it gave up repeating on.
  const repeatsDoneRef = useRef(0);
  const [repeatDoneIndex, setRepeatDoneIndex] = useState<number | null>(null);
  const loopSentence = sentenceRepeat !== 0;
  // While the card still repeats, the card does not follow the video.
  const holdingSentence = loopSentence && repeatDoneIndex !== currentIndex;

  const orderedSentences = useMemo(() => sortedSentences(snapshot), [snapshot]);
  const orderedBlocks = useMemo(() => sortedBlocks(snapshot), [snapshot]);
  const mergedAnalyses = useMemo(
    () => ({...analyses, ...lateAnalyses}),
    [analyses, lateAnalyses],
  );
  const activeIndex = useMemo(
    () => activeSentenceIndexAt(orderedSentences, playbackPositionMs),
    [orderedSentences, playbackPositionMs],
  );
  const followIndex = useMemo(
    () => startedSentenceIndexAt(orderedSentences, playbackPositionMs),
    [orderedSentences, playbackPositionMs],
  );

  useEffect(() => {
    if (videoPlaying) {
      setFollowVideo(true);
    }
  }, [videoPlaying]);

  useEffect(() => {
    if (
      videoPlaying &&
      followVideo &&
      !holdingSentence &&
      followIndex !== null &&
      followIndex !== currentIndexRef.current
    ) {
      setCarouselScrollAnimated(true);
      setCurrentIndex(followIndex);
    }
  }, [followIndex, followVideo, holdingSentence, videoPlaying]);

  const handleOpenAnalysis = useCallback(
    (sentenceId: string) => {
      const hasStored =
        mergedAnalyses[sentenceId] !== undefined ||
        analyses[sentenceId] !== undefined;
      if (!offline && !hasStored && onRequestAnalysis) {
        onRequestAnalysis(sentenceId);
      }
      setOpenSheet('analysis');
    },
    [analyses, mergedAnalyses, offline, onRequestAnalysis],
  );

  const handleOpenTranscript = useCallback(() => {
    setOpenSheet('transcript');
  }, []);

  const handleCloseSheet = useCallback(() => {
    setOpenSheet('none');
  }, []);

  const currentSentence = orderedSentences[currentIndex];
  const currentSentenceId = currentSentence?.id ?? '';
  const currentStartMs = currentSentence?.start_ms ?? null;
  const loopEndMs = useMemo(
    () => sentenceLoopEndMs(orderedSentences, currentIndex),
    [currentIndex, orderedSentences],
  );

  useEffect(() => {
    onCurrentSentenceChange?.({
      position: orderedSentences.length === 0 ? 0 : currentIndex + 1,
      total: orderedSentences.length,
      startMs: currentStartMs,
    });
  }, [
    currentIndex,
    currentStartMs,
    onCurrentSentenceChange,
    orderedSentences.length,
  ]);

  // A word bubble belongs to one card; moving to another card closes it.
  useEffect(() => {
    setSelectedWord(null);
  }, [currentIndex]);

  // A new card, or a new repeat choice, starts the count again.
  useEffect(() => {
    repeatsDoneRef.current = 0;
    setRepeatDoneIndex(null);
  }, [currentIndex, sentenceRepeat]);

  useEffect(() => {
    if (
      !holdingSentence ||
      !videoPlaying ||
      currentStartMs === null ||
      loopEndMs === null
    ) {
      loopSeekSentRef.current = false;
      return;
    }
    if (playbackPositionMs >= loopEndMs - LOOP_END_SLACK_MS) {
      if (!loopSeekSentRef.current) {
        loopSeekSentRef.current = true;
        if (shouldRepeatSentence(sentenceRepeat, repeatsDoneRef.current)) {
          repeatsDoneRef.current += 1;
          onSeek?.(currentStartMs);
        } else {
          // Done repeating: the video plays on and the card follows it.
          setRepeatDoneIndex(currentIndex);
        }
      }
    } else {
      loopSeekSentRef.current = false;
    }
  }, [
    currentIndex,
    currentStartMs,
    holdingSentence,
    loopEndMs,
    onSeek,
    playbackPositionMs,
    sentenceRepeat,
    videoPlaying,
  ]);

  const seekToSentence = useCallback(
    (index: number) => {
      const start = orderedSentences[index]?.start_ms ?? null;
      if (start !== null) {
        onSeek?.(start);
      }
    },
    [onSeek, orderedSentences],
  );

  const handleTogglePlay = useCallback(() => {
    if (videoPlaying) onPauseVideo?.();
    else onPlayVideo?.();
  }, [onPauseVideo, onPlayVideo, videoPlaying]);

  const handleReplay = useCallback(() => {
    if (currentStartMs === null) return;
    setFollowVideo(true);
    onSeek?.(currentStartMs);
    onPlayVideo?.();
  }, [currentStartMs, onPlayVideo, onSeek]);

  const handleProgressSelect = useCallback(
    (index: number) => {
      if (orderedSentences.length === 0) return;
      setFollowVideo(false);
      setCarouselScrollAnimated(true);
      setCurrentIndex(index);
      seekToSentence(index);
    },
    [orderedSentences.length, seekToSentence],
  );

  const handlePressWord = useCallback(
    (selection: SentenceWordSelection) => {
      setSelectedWord(previous =>
        previous?.sentenceId === selection.sentenceId &&
        previous.wordIndex === selection.wordIndex
          ? null
          : selection,
      );
      onPauseVideo?.();
    },
    [onPauseVideo],
  );

  const handleCloseWord = useCallback(() => {
    setSelectedWord(null);
  }, []);

  const selectedSentenceId = selectedWord?.sentenceId ?? null;
  const handleAnalyzeWord = useCallback(() => {
    if (selectedSentenceId) handleOpenAnalysis(selectedSentenceId);
  }, [handleOpenAnalysis, selectedSentenceId]);

  const bubbleVocabulary = useMemo(() => {
    if (!selectedWord) return null;
    const vocabulary = mergedAnalyses[selectedWord.sentenceId]?.vocabulary;
    return vocabulary
      ? findVocabularyForWord(selectedWord.word, vocabulary)
      : null;
  }, [mergedAnalyses, selectedWord]);

  const handleTranscriptSelect = useCallback(
    (index: number, startMs: number | null) => {
      setFollowVideo(false);
      setCurrentIndex(index);
      if (startMs !== null) {
        onSeek?.(startMs);
      }
      setOpenSheet('none');
    },
    [onSeek],
  );

  // While looping, the video moves with the card so the new sentence loops.
  const goPrev = useCallback(() => {
    setFollowVideo(false);
    setCarouselScrollAnimated(true);
    const index = Math.max(0, currentIndexRef.current - 1);
    setCurrentIndex(index);
    if (loopSentence) seekToSentence(index);
  }, [loopSentence, seekToSentence]);

  const goNext = useCallback(() => {
    setFollowVideo(false);
    setCarouselScrollAnimated(true);
    const index = Math.min(
      orderedSentences.length - 1,
      currentIndexRef.current + 1,
    );
    setCurrentIndex(index);
    if (loopSentence) seekToSentence(index);
  }, [loopSentence, orderedSentences.length, seekToSentence]);

  const handleCarouselIndexChange = useCallback((index: number) => {
    setCarouselScrollAnimated(false);
    // Programmatic scrolls report the index we already hold; only a real
    // swipe to another card should stop following the video.
    if (index !== currentIndexRef.current) {
      setFollowVideo(false);
    }
    setCurrentIndex(index);
  }, []);

  const handleCarouselScrollAnimationConsumed = useCallback(() => {
    setCarouselScrollAnimated(false);
  }, []);

  const position = orderedSentences.length === 0 ? 0 : currentIndex + 1;
  const atFirst = currentIndex <= 0 || orderedSentences.length === 0;
  const atLast =
    orderedSentences.length === 0 ||
    currentIndex >= orderedSentences.length - 1;

  return (
    <View testID="canonical-player" style={styles.root}>
      <View style={styles.videoShelf}>
        <View style={styles.videoFrame}>
          {videoAvailable ? (
            videoSlot
          ) : (
            <View
              style={styles.unavailableBox}
              testID="youtube-timeline-unavailable"
            >
              <AppText
                color="secondary"
                testID="youtube-timeline-unavailable-text"
                variant="body"
              >
                {unavailableReason ?? t('lessonPlayer.video_unavailable')}
              </AppText>
              {onRetryVideo ? (
                <AppButton
                  accessibilityHint={t('youtube.study.video_retry_hint')}
                  onPress={onRetryVideo}
                  testID="youtube-video-retry"
                  title={t('youtube.study.video_retry')}
                  variant="secondary"
                />
              ) : null}
            </View>
          )}
        </View>
      </View>

      <View style={styles.progressRow}>
        <AppProgressBar
          accessibilityHint={t('youtube.study.progress_a11y')}
          accessibilityLabel={t('lessonPlayer.sentence_counter', {
            index: position,
            total: orderedSentences.length,
          })}
          accessibilityValue={{
            min: 0,
            max: orderedSentences.length,
            now: position,
          }}
          count={`${position}/${orderedSentences.length}`}
          current={orderedSentences.length > 0 ? currentIndex : undefined}
          onSelect={handleProgressSelect}
          style={styles.progress}
          testID="youtube-study-progress"
          total={orderedSentences.length}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        style={styles.scroll}
        testID="youtube-study-scroll"
      >
        <LessonStatusBanners offline={offline} hasUpdate={hasUpdate} />

        <YouTubeSentenceCarousel
          activeIndex={activeIndex}
          analyses={mergedAnalyses}
          currentIndex={currentIndex}
          onIndexChange={handleCarouselIndexChange}
          onPauseVideo={onPauseVideo}
          onScrollAnimationConsumed={handleCarouselScrollAnimationConsumed}
          scrollAnimated={carouselScrollAnimated}
          onOpenAnalysis={handleOpenAnalysis}
          onPressWord={handlePressWord}
          selectedWord={selectedWord}
          loopSentence={loopSentence}
          wordDetail={
            selectedWord ? (
              <WordBubble
                ipa={
                  bubbleVocabulary
                    ? stripIpaDelimiters(bubbleVocabulary.ipa)
                    : selectedWord.ipa
                }
                onAnalyze={onRequestAnalysis ? handleAnalyzeWord : undefined}
                onClose={handleCloseWord}
                onSpeakText={onSpeakText}
                vocabulary={bubbleVocabulary}
                vocabularySave={vocabularySave}
                word={bareWord(selectedWord.word)}
              />
            ) : null
          }
          onSeek={onSeek}
          onSpeakText={onSpeakText}
          sentenceSave={sentenceSave}
          sentences={orderedSentences}
          showIpa={showIpa}
          showTranslation={showTranslation}
        />

        {orderedBlocks.map(block => (
          <CanonicalBlockView key={block.id} block={block} />
        ))}

        {videoLessons && onOpenVideoLesson ? (
          <VideoLessonsSection
            lessons={videoLessons}
            onOpenLesson={onOpenVideoLesson}
          />
        ) : null}
      </ScrollView>

      <LessonStudyToolbar
        atFirst={atFirst}
        atLast={atLast}
        onCyclePlaybackRate={onCyclePlaybackRate}
        onFinish={onFinish}
        onNext={goNext}
        onOpenTranscript={handleOpenTranscript}
        onPrev={goPrev}
        onReplay={currentStartMs !== null && onSeek ? handleReplay : undefined}
        onTogglePlay={
          (videoPlaying ? onPauseVideo : onPlayVideo)
            ? handleTogglePlay
            : undefined
        }
        playbackRate={playbackRate}
        videoPlaying={videoPlaying}
      />

      <YouTubeAnalysisSheet
        analyses={analyses}
        analysisStates={analysisStates}
        lateAnalyses={lateAnalyses}
        offline={offline}
        onClose={handleCloseSheet}
        onRequestAnalysis={onRequestAnalysis}
        onRetryAnalysis={onRetryAnalysis}
        onSpeakText={onSpeakText}
        sentenceId={currentSentenceId}
        vocabularySave={vocabularySave}
        visible={openSheet === 'analysis' && currentSentenceId.length > 0}
        wordPath={snapshot.origin === 'learner'}
      />
      <YouTubeTranscriptSheet
        activeIndex={activeIndex}
        currentIndex={currentIndex}
        onClose={handleCloseSheet}
        onSelectSentence={handleTranscriptSelect}
        sentenceSave={sentenceSave}
        sentences={orderedSentences}
        showTranslation={showTranslation}
        videoPlaying={videoPlaying}
        visible={openSheet === 'transcript'}
      />
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    progress: {
      flex: 1,
    },
    progressRow: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
      marginHorizontal: theme.gutter,
      marginTop: theme.spacing.sm,
    },
    root: {
      flex: 1,
    },
    scroll: {
      flex: 1,
    },
    scrollContent: {
      gap: theme.spacing.md,
      paddingBottom: theme.spacing.lg,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
    },
    unavailableBox: {
      backgroundColor: theme.colors.surfaceMuted,
      borderColor: theme.colors.border,
      borderRadius: theme.radius.md,
      borderWidth: 1,
      gap: theme.spacing.md,
      minHeight: 200,
      padding: theme.spacing.lg,
    },
    videoFrame: {
      backgroundColor: theme.colors.surfaceLow,
      borderRadius: 22,
      minHeight: 200,
      overflow: 'hidden',
      position: 'relative',
    },
    videoShelf: {
      backgroundColor: theme.colors.surfaceLow,
      borderRadius: 22,
      marginHorizontal: theme.gutter,
      ...getStickerEdge(4, theme.colors.surfaceHigh),
    },
  });
}
