import React, {useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ScrollView, StyleSheet, View} from 'react-native';

import {SpeakContext, SpeechNotice, useSpeak} from '@features/audio';
import {ActivityBody, isSpeakingActivity} from '@features/lesson/flow';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {SessionHeader} from '@ui/components/StudySession';
import {useAppTheme} from '@ui/theme';

import type {UseLessonPracticeRunResult} from '../logic/useLessonPracticeRun';
import {ComposeSuggestionCard} from './ComposeSuggestionCard';
import {PracticeSegmentList} from './PracticeSegmentList';

const NO_ITEMS = new Map();

export type LessonPracticeRunViewProps = {
  lessonId: string;
  run: UseLessonPracticeRunResult;
  closeButton: React.ReactNode;
  onClose: () => void;
};

/**
 * The on-device practice of a learner lesson (plan B): one section at a
 * time with the same activity screens as the six-step player, then the
 * result with the words to save and the lesson marked complete.
 */
export function LessonPracticeRunView({
  lessonId,
  run,
  closeButton,
  onClose,
}: LessonPracticeRunViewProps) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const [pickingSegment, setPickingSegment] = useState(false);
  const {speak, notice} = useSpeak();
  const {state} = run;
  const segmentCount = run.segments.length;
  const segmented = segmentCount > 1 && run.segmentIndex !== null;
  const startSegment = (index: number) => {
    setPickingSegment(false);
    run.startSegment(index);
  };

  if (state.status === 'finished') {
    const {summary} = state;
    const allSaved =
      summary.missed.length > 0 &&
      summary.missed.every(word => run.savedItemKeys.has(word.itemKey));
    return (
      <AppScreen testID="practice-screen">
        <ScreenHeader
          rightAction={closeButton}
          title={t('practice.result_title')}
        />
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {gap: theme.spacing.md, padding: theme.gutter},
          ]}
          testID="practice-run-result"
        >
          <AppCard>
            <AppText testID="practice-result-score" variant="h1">
              {t('practice.result_score', {
                correct: summary.correct,
                total: summary.total,
              })}
            </AppText>
            <AppText color="secondary" testID="practice-run-completed">
              {run.completionFailed
                ? t('lessonPlayer.complete_error')
                : t('practice.run_lesson_completed')}
            </AppText>
            {summary.sections.map(section => (
              <AppText
                color="secondary"
                key={section.kind}
                testID={`practice-run-section-${section.kind}`}
              >
                {section.skipped
                  ? t('practice.run_section_skipped', {
                      section: t(`lessonFlow.kind_${section.kind}`),
                    })
                  : t('practice.run_section_score', {
                      section: t(`lessonFlow.kind_${section.kind}`),
                      correct: section.correct,
                      total: section.total,
                    })}
              </AppText>
            ))}
          </AppCard>

          {summary.missed.length > 0 ? (
            <View style={{gap: theme.spacing.sm}} testID="practice-missed">
              <AppText variant="h3">{t('practice.missed_title')}</AppText>
              {summary.missed.map(word => {
                const saved = run.savedItemKeys.has(word.itemKey);
                return (
                  <AppCard key={word.itemKey}>
                    <View style={styles.missedRow}>
                      <View style={styles.flex1}>
                        <AppText variant="h3">{word.word}</AppText>
                        <AppText color="secondary">{word.meaningVi}</AppText>
                      </View>
                      <AppButton
                        accessibilityHint={t('practice.missed_save_hint')}
                        accessibilityLabel={t('practice.missed_save_a11y', {
                          word: word.word,
                        })}
                        disabled={saved}
                        onPress={() => run.saveMissed(word.itemKey)}
                        testID={`practice-save-${word.itemKey}`}
                        title={
                          saved
                            ? t('practice.missed_saved')
                            : t('practice.missed_save')
                        }
                        variant="outline"
                      />
                    </View>
                  </AppCard>
                );
              })}
              {summary.missed.length > 1 && !allSaved ? (
                <AppButton
                  onPress={run.saveAllMissed}
                  testID="practice-save-all"
                  title={t('practice.missed_save_all')}
                  variant="secondary"
                />
              ) : null}
            </View>
          ) : null}

          {segmented ? (
            <AppCard testID="practice-segments">
              <View style={{gap: theme.spacing.sm}}>
                <AppText testID="practice-segments-progress" variant="h3">
                  {t('practice.segments_progress', {
                    done: run.practicedCount,
                    total: segmentCount,
                  })}
                </AppText>
                {run.nextSegment !== null ? (
                  <AppButton
                    onPress={() => startSegment(run.nextSegment!)}
                    testID="practice-next-segment"
                    title={t('practice.segment_next', {
                      number: run.nextSegment + 1,
                    })}
                  />
                ) : null}
                <AppButton
                  onPress={() => setPickingSegment(value => !value)}
                  testID="practice-pick-segment"
                  title={
                    pickingSegment
                      ? t('practice.segment_pick_close')
                      : t('practice.segment_pick')
                  }
                  variant="outline"
                />
                {pickingSegment ? (
                  <PracticeSegmentList
                    currentIndex={run.segmentIndex}
                    onPick={startSegment}
                    segments={run.segments}
                  />
                ) : null}
              </View>
            </AppCard>
          ) : null}

          <ComposeSuggestionCard
            lessonId={lessonId}
            onOpenLesson={onClose}
            picks={run.composeSuggestion}
          />

          <AppButton
            onPress={run.restart}
            testID="practice-retry"
            title={t('practice.retry')}
          />
          <AppButton
            onPress={onClose}
            testID="practice-back"
            title={t('practice.back_to_lesson')}
            variant="outline"
          />
        </ScrollView>
      </AppScreen>
    );
  }

  if (state.status !== 'running') {
    return null;
  }
  const {section, sectionIndex, sectionCount, runKey} = state;
  const label = t(`lessonFlow.kind_${section.kind}`);

  return (
    <AppScreen testID="practice-screen">
      <SessionHeader
        closeHint={t('practice.close_hint')}
        closeLabel={t('practice.close_a11y')}
        closeTestID="practice-close"
        current={sectionIndex}
        onClose={onClose}
        progressLabel={t('practice.run_progress', {
          current: sectionIndex + 1,
          total: sectionCount,
        })}
        total={sectionCount}
      />
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          {gap: theme.spacing.md, padding: theme.gutter},
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <AppText color="secondary" testID="practice-run-progress">
          {t('practice.run_progress', {
            current: sectionIndex + 1,
            total: sectionCount,
          })}
        </AppText>
        {segmented ? (
          <AppText color="secondary" testID="practice-run-segment">
            {t('practice.run_segment', {
              number: run.segmentIndex! + 1,
              total: segmentCount,
            })}
          </AppText>
        ) : null}
        <SpeechNotice notice={notice} />
        <AppCard testID={`practice-run-section-${section.kind}`}>
          <View style={{gap: theme.spacing.md}}>
            <View style={{gap: theme.spacing.xs}}>
              <Chip label={label} tone="accentSoft" />
              <AppText color="secondary">
                {t(`practice.run_instructions_${section.kind}`)}
              </AppText>
            </View>
            <SpeakContext.Provider value={speak}>
              <ActivityBody
                activity={{
                  kind: section.kind,
                  content: section.content,
                  titleVi: label,
                  instructionsVi: null,
                  taskId: null,
                }}
                content={section.content}
                items={NO_ITEMS}
                key={`${runKey}:${sectionIndex}`}
                onComplete={run.completeSection}
                task={null}
                youtubeVideoId={run.youtubeVideoId}
              />
            </SpeakContext.Provider>
            {isSpeakingActivity(section.kind) ? (
              <AppButton
                accessibilityHint={t('practice.run_skip_speaking_hint')}
                onPress={run.skipSection}
                testID="practice-run-skip-speaking"
                title={t('lessonFlow.skip_speaking')}
                variant="outline"
              />
            ) : null}
          </View>
        </AppCard>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
  missedRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  scroll: {
    flexGrow: 1,
  },
});
