import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, ScrollView, StyleSheet, View} from 'react-native';

import {SpeechNotice, useSpeak} from '@features/audio';
import {listComboSentenceSetsFor} from '@features/combo';
import {requestSync} from '@features/sync';

import {ActionIconButton} from '@ui/components/ActionIconButton';
import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {SessionHeader, StudyQuestion} from '@ui/components/StudySession';
import {formatIpa} from '@ui/components/WordCard';
import {canWriteWord, WriteWordButton} from '@ui/components/WriteWordButton';
import {WriteWordPanel} from '@ui/components/WriteWordPanel';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {createRequestId} from '@core/api/requestId';
import {questionFor, type QuizQuestion} from '@core/learning/packQuiz';
import {lapsesOf} from '@core/sync/learningOutcomes';

import {ApplyExerciseCard} from '../components/ApplyExerciseCard';
import {
  type ApplyExercise,
  type ApplySentence,
  buildApplyExercise,
  seedOf,
} from '../logic/applyExercise';
import {
  type ItemReviewQueue,
  itemReviewQueue,
  recordItemReview,
} from '../logic/itemReview';

/** Vocab path P5: a card at this stage or above is asked by recall; below it, by recognition (bậc 2 and bậc 1). */
export const RECALL_FROM_STAGE = 2;
/**
 * Vocab path P6: from this stage (the 30-day wait) a card is asked by a
 * written stage-3 exercise (bậc 3) built from the learner's combo sentences;
 * without an opened set for the item it is asked by recall.
 */
export const APPLY_FROM_STAGE = 4;
/** A card the learner has got wrong this many times is compared before it is asked again. */
export const COMPARE_FROM_LAPSES = 4;

function applySetsFor(code: string): ApplySentence[][] {
  try {
    return listComboSentenceSetsFor(code);
  } catch {
    return [];
  }
}

function lapsesFor(code: string): number {
  try {
    return lapsesOf(code);
  } catch {
    return 0;
  }
}

type Props = {
  navigation?: {goBack?: () => void};
  /** Tests pass a fixed queue; the screen reads today's otherwise. */
  queue?: ItemReviewQueue;
};

function readQueue(): ItemReviewQueue {
  try {
    return itemReviewQueue();
  } catch {
    return {items: [], missing: 0, doneToday: 0};
  }
}

/**
 * PR 16 (decision G9): today's lesson items on the Server's schedule. The
 * learner recalls the meaning, turns the card and says whether they knew
 * it; each answer is a review attempt the Server schedules from.
 *
 * IGNORE_TAB_BAR_CLEARANCE: a root-stack screen, drawn above the tab bar.
 */
export function ItemReviewScreen({navigation, queue: given}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [queue] = useState(() => given ?? readQueue());
  const [sessionId] = useState(createRequestId);
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);
  // "Viết từ": write the word before recalling (practice only).
  const [writing, setWriting] = useState(false);
  const [shownAt, setShownAt] = useState(() => Date.now());
  const [tally, setTally] = useState({correct: 0, incorrect: 0});
  const [failed, setFailed] = useState(false);
  const [compared, setCompared] = useState(false);
  const [chosen, setChosen] = useState<number | null>(null);
  const {speak: say, notice: speechNotice} = useSpeak();
  const current = queue.items[index];
  const recognition =
    current !== undefined && current.memory.stage < RECALL_FROM_STAGE;
  const lapses = current ? lapsesFor(current.item.code) : 0;
  const showCompare =
    current !== undefined && !compared && lapses >= COMPARE_FROM_LAPSES;
  // Built once per card: the wrong choices are drawn when the card comes up.
  const question = useMemo<QuizQuestion | null>(() => {
    if (!current || !recognition) return null;
    return questionFor(
      current.item,
      queue.items.map(entry => entry.item),
    );
  }, [current, recognition, queue.items]);
  const exercise = useMemo<ApplyExercise | null>(() => {
    if (!current || current.memory.stage < APPLY_FROM_STAGE) return null;
    return buildApplyExercise(
      applySetsFor(current.item.code),
      seedOf(current.item.code, index),
    );
  }, [current, index]);
  const recall = !recognition && exercise === null;

  const advance = () => {
    setIndex(value => value + 1);
    setRevealed(false);
    setWriting(false);
    setChosen(null);
    setCompared(false);
    setShownAt(Date.now());
  };

  const answer = (result: 'correct' | 'incorrect') => {
    if (!current) return;
    const ok = recordItemReview({
      itemCode: current.item.code,
      result,
      sessionId,
      durationMs: Math.min(Date.now() - shownAt, 3_600_000),
    });
    if (!ok) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setTally(value => ({...value, [result]: value[result] + 1}));
    advance();
    requestSync();
  };

  // Recognition and stage 3: the answer is recorded at once and the next card waits for "Next".
  const recordChecked = (result: 'correct' | 'incorrect') => {
    if (!current) return;
    const ok = recordItemReview({
      itemCode: current.item.code,
      result,
      sessionId,
      durationMs: Math.min(Date.now() - shownAt, 3_600_000),
    });
    if (!ok) {
      setFailed(true);
      return;
    }
    setFailed(false);
    setTally(value => ({...value, [result]: value[result] + 1}));
    requestSync();
  };

  const pickOption = (option: number) => {
    if (!current || !question || chosen !== null) return;
    setChosen(option);
    recordChecked(option === question.answerIndex ? 'correct' : 'incorrect');
  };

  const total = queue.items.length;
  return (
    <AppScreen>
      <SessionHeader
        closeHint={t('itemReview.back_hint')}
        closeLabel={t('itemReview.back')}
        current={current ? index + 1 : total}
        onClose={() => navigation?.goBack?.()}
        progressLabel={
          current
            ? t('itemReview.progress', {current: index + 1, total})
            : t('itemReview.title')
        }
        total={total}
      />
      <ScrollView contentContainerStyle={themedStyles.container}>
        <SpeechNotice notice={speechNotice} />
        {queue.missing > 0 ? (
          <AppText
            color="secondary"
            testID="item-review-missing"
            variant="label"
          >
            {t('itemReview.missing', {count: queue.missing})}
          </AppText>
        ) : null}
        {current && showCompare ? (
          <AppCard testID={`item-review-compare-${current.item.code}`}>
            <AppText variant="label" color="secondary">
              {t('itemReview.compare_title')}
            </AppText>
            <AppText variant="h2">{current.item.text}</AppText>
            <AppText color="secondary">{current.item.meaning_vi}</AppText>
            <AppButton
              onPress={() => setCompared(true)}
              testID="item-review-compare-ok"
              title={t('itemReview.compare_ok')}
              variant="secondary"
            />
          </AppCard>
        ) : null}
        {current && !showCompare && recognition && question ? (
          <StudyQuestion
            answerIndex={question.answerIndex}
            chosen={chosen}
            containerTestID={`item-review-question-${current.item.code}`}
            onChoose={pickOption}
            onSpeak={() => say(current.item.text)}
            optionTestID="item-review-option"
            options={question.options}
            prompt={question.prompt}
          />
        ) : null}
        {current && !showCompare && recognition && failed ? (
          <AppText color="danger">{t('itemReview.save_failed')}</AppText>
        ) : null}
        {current && !showCompare && exercise ? (
          <ApplyExerciseCard
            exercise={exercise}
            failed={failed}
            key={index}
            onNext={advance}
            onResult={recordChecked}
          />
        ) : null}
        {current && !showCompare && recall && writing ? (
          <WriteWordPanel
            ipa={current.item.ipa ? formatIpa(current.item.ipa) : null}
            key={current.item.code}
            meaningVi={current.item.meaning_vi}
            onDone={() => {
              setWriting(false);
              setRevealed(true);
            }}
            testID="item-review-write"
            word={current.item.text}
          />
        ) : null}
        {current && !showCompare && recall && !writing ? (
          <AppCard testID={`item-review-card-${current.item.code}`}>
            <View style={themedStyles.row}>
              <Pressable
                accessibilityHint={t('itemReview.reveal_hint')}
                accessibilityRole="button"
                onPress={() => setRevealed(value => !value)}
                style={themedStyles.flex}
                testID="item-review-reveal"
              >
                <AppText variant="h2">{current.item.text}</AppText>
                <AppText color="secondary" testID="item-review-meaning">
                  {revealed ? current.item.meaning_vi : t('itemReview.reveal')}
                </AppText>
              </Pressable>
              <ActionIconButton
                accessibilityHint={t('itemReview.listen_hint')}
                accessibilityLabel={t('itemReview.listen')}
                icon="volume_up"
                onPress={() => say(current.item.text)}
              />
            </View>
            {current.item.kind !== 'pattern' &&
            canWriteWord(current.item.text) ? (
              <WriteWordButton
                onPress={() => setWriting(true)}
                testID="item-review-write-word"
                text={current.item.text}
              />
            ) : null}
            {/* Same order and weight as the daily review's rating buttons:
                not remembered on the left, remembered (the "yes") on the
                thumb side, filled. */}
            <View style={themedStyles.row}>
              <AppButton
                accessibilityHint={t('itemReview.forgot_hint')}
                onPress={() => answer('incorrect')}
                style={themedStyles.flex}
                testID="item-review-forgot"
                title={t('itemReview.forgot')}
                variant="outline"
              />
              <AppButton
                accessibilityHint={t('itemReview.remembered_hint')}
                onPress={() => answer('correct')}
                style={themedStyles.flex}
                testID="item-review-remembered"
                title={t('itemReview.remembered')}
                variant="deep"
              />
            </View>
            {failed ? (
              <AppText color="danger">{t('itemReview.save_failed')}</AppText>
            ) : null}
          </AppCard>
        ) : null}
        {!current ? (
          <AppCard testID="item-review-done">
            <AppText variant="h3">
              {queue.items.length === 0
                ? t('itemReview.empty')
                : t('itemReview.done')}
            </AppText>
            {queue.items.length > 0 ? (
              <AppText color="secondary" testID="item-review-summary">
                {t('itemReview.summary', tally)}
              </AppText>
            ) : null}
            <AppButton
              accessibilityHint={t('itemReview.back_hint')}
              onPress={() => navigation?.goBack?.()}
              testID="item-review-back"
              title={t('itemReview.back')}
              variant="outline"
            />
          </AppCard>
        ) : null}
      </ScrollView>
      {current && !showCompare && recognition && chosen !== null ? (
        <View style={themedStyles.footer}>
          <AppButton
            iconRight="chevron_right"
            onPress={advance}
            testID="item-review-next"
            title={t('itemReview.next')}
            variant="primary"
          />
        </View>
      ) : null}
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.md,
      padding: theme.spacing.md,
    },
    flex: {
      flex: 1,
    },
    footer: {
      paddingBottom: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.sm,
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
  });
}
