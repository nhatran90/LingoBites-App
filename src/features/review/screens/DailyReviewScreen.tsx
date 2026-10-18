import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
  Alert,
  type LayoutChangeEvent,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import {type SpeakText, SpeechNotice, useSpeak} from '@features/audio';
import {
  reconcileReminders,
  type ReviewSession,
  startReviewSession,
} from '@features/engagement';
import {requestSync} from '@features/sync';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {Banner} from '@ui/components/Banner';
import {ErrorCard} from '@ui/components/ErrorCard';
import {FlipCard} from '@ui/components/FlipCard';
import {HeaderIconButton} from '@ui/components/HeaderIconButton';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {Medallion} from '@ui/components/Medallion';
import {ProgressRing} from '@ui/components/ProgressRing';
import {RatingControl} from '@ui/components/RatingControl';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {SessionHeader} from '@ui/components/StudySession';
import {SwipeCard, type SwipeDirection} from '@ui/components/SwipeCard';
import {canWriteWord, WriteWordButton} from '@ui/components/WriteWordButton';
import {WriteWordPanel} from '@ui/components/WriteWordPanel';
import {useAppTheme} from '@ui/theme';

import type {FlashcardRecord, ReviewRating} from '@core/db/types';
import {renderFrameWithLabels} from '@core/learning';
import {useFeatureEnabled} from '@core/release';

import {ReviewCardBack, ReviewCardFront} from '../components/ReviewCardFaces';
import {useFlashcardLibrary} from '../logic/useFlashcardLibrary';

const DEFAULT_SOFT_CAP = 10;

type Props = {
  navigation?: {
    goBack?: () => void;
    navigate?: (screen: string) => void;
    popToTop?: () => void;
  };
  softCap?: number;
};

type Summary = {
  reviewed: number;
  remembered: number;
  forgot: number;
};

function FlashcardFace({
  card,
  side,
  speak,
}: {
  card: FlashcardRecord;
  side: 'front' | 'back';
  speak: SpeakText;
}) {
  const {t} = useTranslation();

  // SETE-253: the flip must reveal something new. The front is the English
  // prompt only (recall cue); the back adds the Vietnamese meaning as the
  // answer. Cards without a translation never reach this component — they are
  // filtered out of the due queue in `getDueFlashcards`.
  // A word saved from an analysis has no curated example, but it does carry
  // the sentence it was found in: show that as context. The example
  // translation belongs to the example only.
  // Pattern cards (PR 6) are reviewed Vietnamese → English: the stored frame
  // shows with its slots blanked and the example sentence is read aloud.
  const pattern = card.kind === 'pattern';
  const word = pattern ? renderFrameWithLabels(card.word) : card.word;
  const content = {
    word,
    meaning: card.meaningVi,
    ipa: card.ipa,
    pos: card.wordType,
    cefr: card.cefrLevel,
    example: card.example ?? card.sourceSentence,
    exampleTranslation: card.example ? card.exampleTranslation : null,
    kind: card.kind,
  };
  const onSpeak = () => {
    speak(pattern ? (card.example ?? word) : card.word);
  };
  if (side === 'back') {
    return (
      <ReviewCardBack
        card={content}
        hint={t('review.swipe_hint')}
        onSpeak={onSpeak}
        speakAccessibilityLabel={
          pattern
            ? t('review.pattern_listen_a11y')
            : t('review.listen_answer_a11y')
        }
        speakTestID="review-speak-back"
        testID="review-card-back"
      />
    );
  }
  return (
    <ReviewCardFront
      card={content}
      hint={
        pattern
          ? t('review.pattern_show_answer_hint')
          : t('review.show_answer_hint')
      }
      patternLabel={t('review.pattern_chip')}
      patternPrompt={t('review.pattern_prompt')}
      onSpeak={onSpeak}
      speakAccessibilityLabel={t('review.listen_prompt_a11y')}
      speakTestID="review-speak-front"
      testID="review-card-front"
    />
  );
}

export function DailyReviewScreen({
  navigation,
  softCap = DEFAULT_SOFT_CAP,
}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const reviewSystemEnabled = useFeatureEnabled('reviewSystem');
  const {
    getCardDueAt,
    getDueFlashcards,
    listFlashcards,
    recordFlashcardRating,
  } = useFlashcardLibrary();
  const {speak, notice: speechNotice} = useSpeak();
  const [allDueCount] = useState(() => getDueFlashcards().length);
  const [sessionCards] = useState(() => getDueFlashcards({limit: softCap}));
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  // "Viết thử": write the word before flipping (practice only).
  const [writing, setWriting] = useState(false);
  const [ratingError, setRatingError] = useState<string | null>(null);
  const [summary, setSummary] = useState<Summary>({
    reviewed: 0,
    remembered: 0,
    forgot: 0,
  });
  const [complete, setComplete] = useState(false);
  const [stageHeight, setStageHeight] = useState(0);
  // Engagement session (SETE-89): records the rated cards and, when the session
  // ends, writes the gamification events that drive streak/XP/badges/pet state.
  const [session] = useState<ReviewSession>(() => startReviewSession());
  const [sessionXpEarned, setSessionXpEarned] = useState<number | null>(null);

  const savedCardCount = useMemo(
    () => listFlashcards().length,
    [listFlashcards],
  );
  const carryOverCount = Math.max(0, allDueCount - sessionCards.length);
  const activeCard = sessionCards[currentIndex] ?? null;

  function finishNext(nextSummary: Summary) {
    setRatingError(null);
    setFlipped(false);
    setWriting(false);
    if (currentIndex + 1 >= sessionCards.length) {
      setSummary(nextSummary);
      setComplete(true);
      finalizeSession();
      return;
    }
    setSummary(nextSummary);
    setCurrentIndex(index => index + 1);
  }

  /** Persists the session's gamification events (idempotent, no-op if empty). */
  function finalizeSession() {
    const outcome = session.finish();
    if (outcome?.ok) {
      setSessionXpEarned(outcome.xpEarned);
      // Ratings just moved several due times: reconcile reminders so stale ones
      // are cancelled and the new due times are scheduled (REQ-10 / VC-5).
      reconcileReminders();
    }
  }

  function handleRate(rating: ReviewRating) {
    // SETE-254: ratings are gated behind the flip — the RatingControl is
    // disabled pre-flip, and this guard keeps a pre-flip rating from ever
    // being recorded even if the handler is invoked directly.
    if (!flipped) {
      return;
    }
    const card = sessionCards[currentIndex];
    if (!card) {
      return;
    }

    const reviewedAt = new Date().toISOString();
    // Due instant before rating — needed to tell whether this was on time.
    const dueAt = getCardDueAt(card.id);
    const result = recordFlashcardRating({flashcardId: card.id, rating});

    if (!result.ok) {
      // Persistence failed: keep the learner on this card and surface the
      // translated error instead of silently advancing the session.
      setRatingError(
        result.errorCode === 'FLASHCARD_NOT_FOUND'
          ? t('errors.flashcard_not_found')
          : t('errors.flashcard_rating_save_failed'),
      );
      return;
    }

    session.record({
      flashcardId: card.id,
      rating,
      dueAt,
      reviewedAt,
    });
    requestSync();

    const nextSummary = {
      reviewed: summary.reviewed + 1,
      remembered: summary.remembered + (rating === 'remembered' ? 1 : 0),
      forgot: summary.forgot + (rating === 'forgot' ? 1 : 0),
    };
    finishNext(nextSummary);
  }

  function handleSkip() {
    // SETE-254: same flip gate as handleRate — the skip control is disabled
    // pre-flip, and this keeps a pre-flip skip from advancing the session.
    if (!flipped) {
      return;
    }
    finishNext({
      ...summary,
      reviewed: summary.reviewed + 1,
    });
  }

  function handleSwipe(direction: SwipeDirection) {
    handleRate(direction === 'right' ? 'remembered' : 'forgot');
  }

  function handleStageLayout(event: LayoutChangeEvent) {
    setStageHeight(event.nativeEvent.layout.height);
  }

  function exitSession() {
    // Leaving after rating at least one card still closes the session.
    finalizeSession();
    navigation?.goBack?.();
  }

  function requestExit() {
    // Nothing at stake on the first card with no answers given: exit directly.
    if (summary.reviewed === 0) {
      exitSession();
      return;
    }
    Alert.alert(
      t('review.exit_title'),
      t('review.exit_body', {
        reviewed: summary.reviewed,
        total: sessionCards.length,
      }),
      [
        {text: t('review.exit_stay'), style: 'cancel'},
        {
          text: t('review.exit_quit'),
          style: 'destructive',
          onPress: exitSession,
        },
      ],
    );
  }

  if (!reviewSystemEnabled) {
    return (
      <AppScreen>
        <View style={styles.centered}>
          <ErrorCard message={t('review.feature_disabled')} />
        </View>
      </AppScreen>
    );
  }

  const closeButton = (
    <HeaderIconButton
      accessibilityLabel={t('review.close_a11y')}
      icon="close"
      onPress={requestExit}
      testID="review-close"
    />
  );

  if (sessionCards.length === 0) {
    return (
      <AppScreen>
        <ScreenHeader rightAction={closeButton} title={t('review.title')} />
        <View style={styles.emptyState}>
          <Medallion label={savedCardCount === 0 ? '0' : '✓'} />
          <AppText style={styles.emptyTitle} variant="h2">
            {savedCardCount === 0
              ? t('review.empty_no_cards_title')
              : t('review.empty_done_title')}
          </AppText>
          <AppText color="secondary" style={styles.emptyCopy}>
            {savedCardCount === 0
              ? t('review.empty_no_cards_body')
              : t('review.empty_done_body')}
          </AppText>
        </View>
      </AppScreen>
    );
  }

  if (complete) {
    const rated = summary.remembered + summary.forgot;
    const accuracy = rated > 0 ? summary.remembered / rated : 0;
    const percent = Math.round(accuracy * 100);
    const headline =
      rated === 0
        ? t('review.summary_title')
        : percent >= 80
          ? t('review.summary_great')
          : percent >= 50
            ? t('review.summary_good')
            : t('review.summary_keep');
    return (
      <AppScreen>
        <ScrollView
          contentContainerStyle={[
            styles.summaryContent,
            {paddingHorizontal: theme.gutter},
          ]}
          testID="review-summary"
        >
          <View style={styles.summaryHero}>
            <ProgressRing
              accessibilityLabel={t('review.summary_accuracy_a11y', {percent})}
              caption={t('review.summary_accuracy')}
              progress={accuracy}
              testID="summary-accuracy"
              value={`${percent}%`}
            />
            <AppText style={styles.centerText} variant="h1">
              {headline}
            </AppText>
            <AppText color="secondary" style={styles.centerText}>
              {t('review.summary_subtitle', {count: summary.reviewed})}
            </AppText>
            {sessionXpEarned != null && sessionXpEarned > 0 ? (
              <View
                style={[
                  styles.xpPill,
                  {backgroundColor: theme.colors.accentSoft},
                ]}
              >
                <MaterialIcon
                  color={theme.colors.primary}
                  name="bolt"
                  size={18}
                />
                <AppText
                  style={[styles.xpText, {color: theme.colors.primary}]}
                  testID="summary-xp-earned"
                >
                  {t('review.summary_xp', {xp: sessionXpEarned})}
                </AppText>
              </View>
            ) : null}
          </View>

          <View style={styles.statGrid}>
            <SummaryStat
              color={theme.colors.text.primary}
              label={t('review.summary_reviewed_label')}
              valueTestID="summary-reviewed-count"
              value={summary.reviewed}
            />
            <SummaryStat
              color={theme.colors.primary}
              label={t('review.summary_remembered_label')}
              valueTestID="summary-remembered-count"
              value={summary.remembered}
            />
            <SummaryStat
              color={theme.colors.danger}
              label={t('review.summary_forgot_label')}
              valueTestID="summary-forgot-count"
              value={summary.forgot}
            />
          </View>

          {carryOverCount > 0 ? (
            <Banner
              message={t('review.carry_over', {count: carryOverCount})}
              variant="neutral"
            />
          ) : null}
          <AppButton
            accessibilityLabel={t('review.back_to_home_a11y')}
            onPress={() => navigation?.popToTop?.() ?? navigation?.goBack?.()}
            title={t('review.back_to_home')}
          />
        </ScrollView>
      </AppScreen>
    );
  }

  // Card face height: fill the stage, leaving room for the hint rows.
  // Both faces get the stage's exact height, so flipping never resizes the card.
  const cardHeight = stageHeight > 0 ? Math.max(300, stageHeight) : undefined;

  return (
    <AppScreen>
      <SessionHeader
        closeLabel={t('review.close_a11y')}
        closeHint={t('review.title')}
        closeTestID="review-close"
        current={currentIndex + 1}
        onClose={requestExit}
        progressLabel={`${t('review.title')} ${currentIndex + 1}/${sessionCards.length}`}
        testID="review-progress"
        total={sessionCards.length}
      />
      <View style={[styles.progress, {paddingHorizontal: theme.gutter}]}>
        {carryOverCount > 0 ? (
          <AppText
            color="muted"
            style={styles.carryOver}
            testID="review-banner"
            variant="caption"
          >
            {t('review.carry_over', {count: carryOverCount})}
          </AppText>
        ) : null}
      </View>

      <View style={[styles.stage, {paddingHorizontal: theme.gutter}]}>
        {ratingError ? <ErrorCard message={ratingError} /> : null}
        <SpeechNotice notice={speechNotice} />
        <View onLayout={handleStageLayout} style={styles.flex1}>
          {activeCard && writing ? (
            <ScrollView keyboardShouldPersistTaps="handled">
              <WriteWordPanel
                ipa={activeCard.ipa}
                key={activeCard.id}
                meaningVi={activeCard.meaningVi}
                onDone={() => {
                  setWriting(false);
                  setFlipped(true);
                }}
                testID="review-write"
                word={activeCard.word}
              />
            </ScrollView>
          ) : activeCard ? (
            <SwipeCard
              cardKey={activeCard.id}
              enabled={flipped}
              leftLabel={t('rating.forgot_label')}
              onSwipe={handleSwipe}
              rightLabel={t('rating.remembered_label')}
              testID="review-swipe-card"
            >
              <FlipCard
                back={
                  <FlashcardFace card={activeCard} side="back" speak={speak} />
                }
                backHint={t('review.swipe_hint')}
                flipped={flipped}
                front={
                  <FlashcardFace card={activeCard} side="front" speak={speak} />
                }
                bare
                frontHint={t('review.show_answer_hint')}
                height={cardHeight}
                onFlip={() => setFlipped(value => !value)}
                testID="daily-review-flip-card"
              />
            </SwipeCard>
          ) : null}
        </View>
      </View>

      <View style={[styles.actions, {paddingHorizontal: theme.gutter}]}>
        {activeCard &&
        !flipped &&
        !writing &&
        activeCard.kind !== 'pattern' &&
        canWriteWord(activeCard.word) ? (
          <WriteWordButton
            onPress={() => setWriting(true)}
            testID="review-write-try"
            text={activeCard.word}
          />
        ) : null}
        <RatingControl
          disabled={!flipped}
          onRate={handleRate}
          onReveal={() => setFlipped(true)}
          onSkip={handleSkip}
        />
      </View>
    </AppScreen>
  );
}

function SummaryStat({
  label,
  value,
  color,
  valueTestID,
}: {
  label: string;
  value: number;
  color: string;
  valueTestID: string;
}) {
  return (
    <AppCard style={styles.statCard}>
      <View accessible accessibilityLabel={`${label}: ${value}`}>
        <AppText
          style={[styles.statValue, {color}]}
          testID={valueTestID}
          variant="h2"
        >
          {value}
        </AppText>
        <AppText color="secondary" style={styles.centerText} variant="label">
          {label}
        </AppText>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 12,
    paddingBottom: 12,
    paddingTop: 8,
  },
  carryOver: {
    marginTop: 4,
    textAlign: 'right',
  },
  centerText: {
    textAlign: 'center',
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    padding: 16,
  },
  flex1: {
    flex: 1,
  },
  emptyCopy: {
    maxWidth: 280,
    textAlign: 'center',
  },
  emptyState: {
    alignItems: 'center',
    flex: 1,
    gap: 12,
    justifyContent: 'center',
    padding: 24,
  },
  emptyTitle: {
    textAlign: 'center',
  },
  progress: {
    paddingBottom: 8,
  },
  stage: {
    flex: 1,
    gap: 12,
    paddingVertical: 8,
  },
  statCard: {
    flex: 1,
  },
  statGrid: {
    flexDirection: 'row',
    gap: 10,
  },
  statValue: {
    textAlign: 'center',
  },
  summaryContent: {
    gap: 20,
    paddingBottom: 32,
    paddingTop: 32,
  },
  summaryHero: {
    alignItems: 'center',
    gap: 8,
  },
  xpPill: {
    alignItems: 'center',
    borderRadius: 999,
    flexDirection: 'row',
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  xpText: {
    fontWeight: '700',
  },
});
