import React, {memo, useCallback, useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
  FlatList,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {useReducedMotion} from 'react-native-reanimated';

import {ActionIconButton} from '@ui/components/ActionIconButton';
import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {SaveToggle} from '@ui/components/SaveToggle';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';

import type {LessonAnalysis, LessonSentence} from '@core/schemas/lesson';

import {formatCueLabel} from '../logic/canonicalYouTubeCues';
import {pairWordsWithIpa, splitSentenceWords} from '../logic/sentenceIpa';
import type {SentenceSaveControl} from '../logic/useSavedVideoSentences';

/** How much of the next card shows at the right edge. */
const CARD_PEEK = 18;
/** Space between two cards (inside each card's slot). */
const CARD_GAP = 10;

/** A word the learner tapped in a sentence card. */
export type SentenceWordSelection = {
  sentenceId: string;
  wordIndex: number;
  word: string;
  /** The word's own IPA token, when the sentence IPA pairs up. */
  ipa: string | null;
};

export type YouTubeSentenceCarouselProps = {
  sentences: LessonSentence[];
  currentIndex: number;
  onIndexChange: (index: number) => void;
  activeIndex: number | null;
  showTranslation: boolean;
  showIpa: boolean;
  analyses: Record<string, LessonAnalysis>;
  onSeek?: (positionMs: number) => void;
  onSpeakText?: (text: string) => void;
  onOpenAnalysis?: (sentenceId: string) => void;
  /** ♥ on each card: keeps the sentence in "Câu đã lưu". */
  sentenceSave?: SentenceSaveControl;
  /** Tapping a word in a card (opens the word bubble). */
  onPressWord?: (selection: SentenceWordSelection) => void;
  /** The highlighted word, if any. */
  selectedWord?: Pick<SentenceWordSelection, 'sentenceId' | 'wordIndex'> | null;
  /** Called when a card is tapped, so the screen can pause the video. */
  onPauseVideo?: () => void;
  /** Meaning of the tapped word, shown inside its card under the sentence. */
  wordDetail?: React.ReactNode;
  /** Sentence loop is on: the current card shows a "Lặp" chip. */
  loopSentence?: boolean;
  /** When true, the next currentIndex sync scrolls with animation (prev/next). */
  scrollAnimated?: boolean;
  onScrollAnimationConsumed?: () => void;
};

type CardProps = {
  sentence: LessonSentence;
  index: number;
  cardWidth: number;
  cueActive: boolean;
  showTranslation: boolean;
  showIpa: boolean;
  analysis: LessonAnalysis | undefined;
  /** Index of the highlighted (tapped) word in this card, or null. */
  selectedWordIndex: number | null;
  wordDetail: React.ReactNode;
  looping: boolean;
  onPressCard: (index: number, sentence: LessonSentence) => void;
  onPressWord?: (selection: SentenceWordSelection) => void;
  onSpeakText?: (text: string) => void;
  onOpenAnalysis?: (sentenceId: string) => void;
  saved: boolean;
  onToggleSave?: (sentence: LessonSentence) => void;
  theme: AppTheme;
  t: (key: string, options?: Record<string, unknown>) => string;
};

function SentenceCarouselCardBody({
  sentence,
  index,
  cardWidth,
  cueActive,
  showTranslation,
  showIpa,
  analysis,
  selectedWordIndex,
  wordDetail,
  looping,
  onPressCard,
  onPressWord,
  onSpeakText,
  onOpenAnalysis,
  saved,
  onToggleSave,
  theme,
  t,
}: CardProps) {
  const styles = useMemo(() => cardStyles(theme), [theme]);
  const cueTestSuffix = cueActive ? '-active' : '';
  const pairs = useMemo(
    () => pairWordsWithIpa(sentence.text_en, sentence.ipa),
    [sentence.ipa, sentence.text_en],
  );
  const words = useMemo(
    () =>
      pairs ??
      splitSentenceWords(sentence.text_en).map(word => ({word, ipa: null})),
    [pairs, sentence.text_en],
  );
  const interlinear = showIpa && pairs !== null;

  return (
    <View
      style={[styles.cardOuter, {width: cardWidth}]}
      testID={`canonical-sentence-${sentence.id}`}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityState={{selected: cueActive}}
        testID={`youtube-cue-${sentence.id}${cueTestSuffix}`}
        onPress={() => onPressCard(index, sentence)}
      >
        <View style={[styles.card, cueActive ? styles.cardLive : null]}>
          <View style={styles.cardHeader}>
            <View
              style={[styles.timeChip, cueActive ? styles.timeChipLive : null]}
            >
              {cueActive ? <View style={styles.liveDot} /> : null}
              <AppText
                testID={`youtube-cue-time-${sentence.id}`}
                style={[
                  styles.timestamp,
                  cueActive ? styles.timestampLive : null,
                ]}
                variant="label"
              >
                {formatCueLabel(sentence.start_ms)}
              </AppText>
            </View>
            {looping ? (
              <View style={styles.loopChip} testID="youtube-card-loop-chip">
                <MaterialIcon
                  color={theme.colors.onTertiaryContainer}
                  name="repeat"
                  size={14}
                />
                <AppText style={styles.loopText} variant="caption">
                  {t('youtube.study.loop_chip')}
                </AppText>
              </View>
            ) : null}
            <View style={styles.headerSpacer} />
            {onOpenAnalysis ? (
              <ActionIconButton
                accessibilityHint={
                  analysis
                    ? t('youtube.study.view_analysis_hint')
                    : t('lessonPlayer.analyze_hint')
                }
                accessibilityLabel={
                  analysis
                    ? t('youtube.study.view_analysis')
                    : t('lessonPlayer.analyze')
                }
                icon="auto_awesome"
                label={
                  analysis
                    ? t('youtube.study.view_analysis_short')
                    : t('youtube.study.analyze_short')
                }
                onPress={() => onOpenAnalysis(sentence.id)}
                testID={`youtube-open-analysis-${sentence.id}`}
                tone="mint"
              />
            ) : null}
            {onSpeakText ? (
              <ActionIconButton
                accessibilityHint={t('lessonPlayer.speak_sentence_hint')}
                accessibilityLabel={t('lessonPlayer.speak_sentence', {
                  index: index + 1,
                })}
                icon="volume_up"
                onPress={() => onSpeakText(sentence.text_en)}
                testID={`canonical-speak-${sentence.id}`}
              />
            ) : null}
            {onToggleSave ? (
              <SaveToggle
                accessibilityHint={t('youtube.study.save_sentence_hint')}
                accessibilityLabel={
                  saved
                    ? t('youtube.study.unsave_sentence_a11y')
                    : t('youtube.study.save_sentence_a11y')
                }
                onPress={() => onToggleSave(sentence)}
                raised="row"
                saved={saved}
                testID={`youtube-save-sentence-${sentence.id}`}
              />
            ) : null}
          </View>
          <View
            accessibilityLabel={sentence.text_en}
            style={[styles.words, interlinear ? styles.wordsInterlinear : null]}
            testID={`youtube-cue-text-${sentence.id}`}
          >
            {words.map((entry, wordIndex) => (
              <Pressable
                key={`${wordIndex}-${entry.word}`}
                accessibilityHint={t('youtube.study.word_hint')}
                accessibilityLabel={entry.word}
                accessibilityRole="button"
                disabled={!onPressWord}
                onPress={() =>
                  onPressWord?.({
                    sentenceId: sentence.id,
                    wordIndex,
                    word: entry.word,
                    ipa: entry.ipa,
                  })
                }
                style={[
                  styles.word,
                  selectedWordIndex === wordIndex ? styles.wordSelected : null,
                ]}
                testID={`youtube-word-${sentence.id}-${wordIndex}`}
              >
                <AppText
                  style={[
                    styles.wordText,
                    selectedWordIndex === wordIndex
                      ? styles.wordTextSelected
                      : null,
                  ]}
                  variant="h3"
                >
                  {entry.word}
                </AppText>
                {interlinear && entry.ipa ? (
                  <AppText style={styles.wordIpa} variant="caption">
                    {entry.ipa}
                  </AppText>
                ) : null}
              </Pressable>
            ))}
          </View>
          {selectedWordIndex !== null ? wordDetail : null}
          {showTranslation ? (
            <View style={styles.translation}>
              <AppText color="secondary" variant="bodyLg">
                {sentence.text_vi}
              </AppText>
            </View>
          ) : null}
        </View>
      </Pressable>
    </View>
  );
}

const SentenceCarouselCard = memo(SentenceCarouselCardBody);

export function YouTubeSentenceCarousel({
  sentences,
  currentIndex,
  onIndexChange,
  activeIndex,
  showTranslation,
  showIpa,
  analyses,
  onSeek,
  onSpeakText,
  onOpenAnalysis,
  sentenceSave,
  onPressWord,
  selectedWord = null,
  onPauseVideo,
  wordDetail,
  loopSentence = false,
  scrollAnimated = false,
  onScrollAnimationConsumed,
}: YouTubeSentenceCarouselProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const reducedMotion = useReducedMotion();
  const listStyles = useMemo(() => listStyleSheet(theme), [theme]);
  const [listWidth, setListWidth] = useState(0);
  // The next card peeks in at the right edge so the row reads as swipeable.
  const cardWidth = Math.max(listWidth - CARD_PEEK, 280);

  const listRef = React.useRef<FlatList<LessonSentence>>(null);
  const pendingAnimatedScrollRef = React.useRef(false);
  // Only a finger drag may change the index from scroll events; animated
  // programmatic scrolls (video follow) also end in onMomentumScrollEnd and
  // would otherwise be mistaken for a manual swipe.
  const userDraggingRef = React.useRef(false);

  const scrollToIndex = useCallback(
    (index: number, animated: boolean) => {
      if (sentences.length === 0) return;
      userDraggingRef.current = false;
      const clamped = Math.max(0, Math.min(index, sentences.length - 1));
      listRef.current?.scrollToIndex({
        index: clamped,
        animated: reducedMotion ? false : animated,
      });
    },
    [reducedMotion, sentences.length],
  );

  React.useEffect(() => {
    if (scrollAnimated) {
      pendingAnimatedScrollRef.current = true;
    }
  }, [scrollAnimated]);

  React.useEffect(() => {
    const animated = pendingAnimatedScrollRef.current;
    pendingAnimatedScrollRef.current = false;
    scrollToIndex(currentIndex, animated);
    if (animated) {
      onScrollAnimationConsumed?.();
    }
  }, [currentIndex, onScrollAnimationConsumed, scrollToIndex]);

  const handlePressCard = useCallback(
    (index: number, sentence: LessonSentence) => {
      onIndexChange(index);
      if (sentence.start_ms !== null) {
        onSeek?.(sentence.start_ms);
      }
      onPauseVideo?.();
    },
    [onIndexChange, onPauseVideo, onSeek],
  );

  const renderItem = useCallback(
    ({item, index}: ListRenderItemInfo<LessonSentence>) => (
      <SentenceCarouselCard
        analysis={analyses[item.id]}
        cardWidth={cardWidth}
        cueActive={activeIndex === index}
        index={index}
        onOpenAnalysis={onOpenAnalysis}
        onPressCard={handlePressCard}
        onPressWord={onPressWord}
        selectedWordIndex={
          selectedWord?.sentenceId === item.id ? selectedWord.wordIndex : null
        }
        wordDetail={
          selectedWord?.sentenceId === item.id ? wordDetail : undefined
        }
        looping={loopSentence && currentIndex === index}
        onSpeakText={onSpeakText}
        onToggleSave={sentenceSave?.toggle}
        saved={sentenceSave?.isSaved(item.id) ?? false}
        sentence={item}
        showIpa={showIpa}
        showTranslation={showTranslation}
        t={t}
        theme={theme}
      />
    ),
    [
      activeIndex,
      analyses,
      cardWidth,
      currentIndex,
      handlePressCard,
      onOpenAnalysis,
      onPressWord,
      onSpeakText,
      loopSentence,
      selectedWord,
      sentenceSave,
      showIpa,
      showTranslation,
      t,
      theme,
      wordDetail,
    ],
  );

  const onMomentumScrollEnd = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!userDraggingRef.current) return;
      userDraggingRef.current = false;
      if (cardWidth <= 0) return;
      const offsetX = event.nativeEvent.contentOffset.x;
      const next = Math.round(offsetX / cardWidth);
      onIndexChange(Math.max(0, Math.min(next, sentences.length - 1)));
    },
    [cardWidth, onIndexChange, sentences.length],
  );

  const extraData = useMemo(
    () => ({
      activeIndex,
      showTranslation,
      showIpa,
      currentIndex,
      selectedWord,
      wordDetail,
      loopSentence,
      sentenceSave,
    }),
    [
      activeIndex,
      currentIndex,
      loopSentence,
      selectedWord,
      sentenceSave,
      showIpa,
      showTranslation,
      wordDetail,
    ],
  );

  if (sentences.length === 0) {
    return (
      <View style={listStyles.emptyWrap} testID="youtube-cards-empty">
        <AppText color="secondary">{t('youtube.study.empty_cards')}</AppText>
      </View>
    );
  }

  return (
    <View
      style={listStyles.listWrap}
      testID="youtube-sentence-carousel"
      onLayout={event => setListWidth(event.nativeEvent.layout.width)}
    >
      <FlatList
        ref={listRef}
        horizontal
        data={sentences}
        extraData={extraData}
        getItemLayout={(_, index) => ({
          index,
          length: cardWidth,
          offset: cardWidth * index,
        })}
        contentContainerStyle={{
          paddingRight: Math.max(listWidth - cardWidth, 0),
        }}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        showsHorizontalScrollIndicator={false}
        snapToAlignment="start"
        snapToInterval={cardWidth}
        decelerationRate="fast"
        onMomentumScrollEnd={onMomentumScrollEnd}
        onScrollBeginDrag={() => {
          userDraggingRef.current = true;
        }}
      />
    </View>
  );
}

function cardStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      backgroundColor: theme.colors.surface,
      borderRadius: 24,
      gap: theme.spacing.md,
      paddingBottom: theme.spacing.lg,
      paddingHorizontal: theme.spacing.lg,
      paddingTop: theme.spacing.md,
      ...getStickerEdge(4, theme.colors.surfaceHigh),
    },
    cardHeader: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
      minHeight: 40,
    },
    // Only the mint shelf marks the line the video is reading.
    cardLive: {
      ...getStickerEdge(4, theme.colors.accent),
    },
    cardOuter: {
      paddingBottom: 6,
      paddingLeft: 2,
      paddingRight: CARD_GAP,
    },
    headerSpacer: {
      flex: 1,
    },
    liveDot: {
      backgroundColor: theme.colors.accent,
      borderRadius: 4,
      height: 7,
      width: 7,
    },
    loopChip: {
      alignItems: 'center',
      backgroundColor: theme.colors.tertiarySoft,
      borderRadius: 10,
      flexDirection: 'row',
      gap: 4,
      minHeight: 28,
      paddingHorizontal: 8,
    },
    loopText: {
      color: theme.colors.onTertiaryContainer,
    },
    timeChip: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: 10,
      flexDirection: 'row',
      gap: 6,
      minHeight: 28,
      paddingHorizontal: 10,
    },
    timeChipLive: {
      backgroundColor: theme.colors.accentSoft,
    },
    timestamp: {
      color: theme.colors.text.secondary,
      fontVariant: ['tabular-nums'],
    },
    timestampLive: {
      color: theme.colors.primary,
    },
    translation: {
      borderTopColor: theme.colors.surfaceHigh,
      borderTopWidth: StyleSheet.hairlineWidth * 2,
      paddingTop: theme.spacing.sm,
    },
    word: {
      alignItems: 'center',
      borderBottomColor: theme.colors.surface,
      borderBottomWidth: 3,
      borderRadius: 8,
      marginHorizontal: -3,
      paddingHorizontal: 3,
    },
    wordIpa: {
      color: theme.colors.primary,
      opacity: 0.85,
    },
    wordSelected: {
      backgroundColor: theme.colors.accentSoft,
      borderBottomColor: theme.colors.accent,
    },
    wordText: {
      fontSize: 21,
      fontWeight: '800',
      lineHeight: 28,
    },
    wordTextSelected: {
      color: theme.colors.primary,
    },
    words: {
      columnGap: 6,
      flexDirection: 'row',
      flexWrap: 'wrap',
      rowGap: 2,
    },
    wordsInterlinear: {
      columnGap: theme.spacing.sm,
      rowGap: theme.spacing.sm,
    },
  });
}

function listStyleSheet(theme: AppTheme) {
  return StyleSheet.create({
    emptyWrap: {
      paddingVertical: theme.spacing.lg,
    },
    listWrap: {
      minHeight: 200,
    },
  });
}
