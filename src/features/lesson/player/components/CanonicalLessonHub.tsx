import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {trackEvent} from '@features/analytics';

import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {Chip} from '@ui/components/Chip';
import {LessonExploreRow} from '@ui/components/LessonExploreRow';
import {SectionHeader} from '@ui/components/SectionHeader';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {buildPracticeSource, getPracticeEligibility} from '@core/learning';
import type {LessonAnalysis, LessonSnapshot} from '@core/schemas/lesson';

import {blocksOfStep, FLOW_STEPS} from '../../flow/logic/practiceCompletion';
import type {FlowEntry} from '../../flow/logic/useFlowEntry';
import {
  collectLessonOutcome,
  collectLessonPatterns,
  collectLessonTense,
  collectLessonVocabulary,
  type LessonHubSection,
  type LessonHubSectionRow,
  lessonHubSections,
  sortedSentences,
} from '../logic/lessonHubContent';
import {useLessonPictures} from '../logic/lessonPictures';
import {replayDayKey, replayLine} from '../logic/situationReplay';
import {LessonContentTabs} from './LessonContentTabs';
import {LessonHeroCard, type LessonHeroMeta} from './LessonHeroCard';
import {LessonOutcomeCard} from './LessonOutcomeCard';
import {LessonPathCard} from './LessonPathCard';
import {LessonStatusBanners} from './LessonStatusBanners';
import {LessonTenseCard} from './LessonTenseCard';
import {SourcePhotoCard} from './SourcePhotoCard';

export type {LessonHubSection};

type ExploreRowCopy = {
  icon: HandoffIconName;
  tone: 'teal' | 'coral' | 'gold';
  titleKey: string;
  subtitleKey: string;
  /** Shown instead of the subtitle when the section is empty. */
  emptyKey?: string;
};

const EXPLORE_ROWS: Record<LessonHubSection, ExploreRowCopy> = {
  sentences: {
    icon: 'menu_book',
    tone: 'teal',
    titleKey: 'lessonPlayer.explore_sentences_title',
    subtitleKey: 'lessonPlayer.explore_sentences_subtitle',
  },
  vocabulary: {
    icon: 'style',
    tone: 'coral',
    titleKey: 'lessonPlayer.explore_vocabulary_title',
    subtitleKey: 'lessonPlayer.explore_vocabulary_subtitle',
    emptyKey: 'lessonPlayer.explore_vocabulary_empty',
  },
  grammar: {
    icon: 'rule',
    tone: 'gold',
    titleKey: 'lessonPlayer.explore_grammar_title',
    subtitleKey: 'lessonPlayer.explore_grammar_subtitle',
    emptyKey: 'lessonPlayer.explore_grammar_empty',
  },
  patterns: {
    icon: 'rule',
    tone: 'gold',
    titleKey: 'lessonPlayer.explore_patterns_title',
    subtitleKey: 'lessonPlayer.explore_patterns_subtitle',
  },
  pronunciation: {
    icon: 'record_voice_over',
    tone: 'teal',
    titleKey: 'lessonPlayer.explore_pronunciation_title',
    subtitleKey: 'lessonPlayer.explore_pronunciation_subtitle',
  },
  listening: {
    icon: 'hearing',
    tone: 'coral',
    titleKey: 'lessonPlayer.explore_listening_title',
    subtitleKey: 'lessonPlayer.explore_listening_subtitle',
  },
};

/** Catalog lessons call their vocabulary "Từ & cụm". */
const CATALOG_VOCABULARY_ROW: ExploreRowCopy = {
  ...EXPLORE_ROWS.vocabulary,
  titleKey: 'lessonPlayer.explore_items_vocabulary_title',
  subtitleKey: 'lessonPlayer.explore_items_vocabulary_subtitle',
};

/** Section title for the player header (same wording as the hub row). */
export function lessonSectionTitleKey(
  section: LessonHubSection,
  catalogLesson: boolean,
): string {
  return section === 'vocabulary' && catalogLesson
    ? CATALOG_VOCABULARY_ROW.titleKey
    : EXPLORE_ROWS[section].titleKey;
}

export type CanonicalLessonHubProps = {
  snapshot: LessonSnapshot;
  /** Stored plus late analyses (display-only merge). */
  analyses: Record<string, LessonAnalysis>;
  offline?: boolean;
  hasUpdate?: boolean;
  onOpenSection: (section: LessonHubSection) => void;
  /** Opens another lesson (a prerequisite on the outcome card). */
  onOpenLesson?: (lessonId: string) => void;
  /**
   * Opens the quick-practice quiz. Omit to hide the row (practice flag off);
   * the row also stays hidden while the lesson is too small for a quiz.
   */
  onOpenPractice?: () => void;
  /** S4.3: opens "Học theo 6 bước" sentence picking. Omit to hide the row. */
  onOpenCompose?: () => void;
  /** E5: the learner's own lesson can be deleted (server and this device). */
  onDeleteLesson?: () => void;
  /** Speaks words and sentences (TTS); omitted = no listen buttons. */
  onSpeakText?: (text: string) => void;
  /** The lesson flow (curriculum and composed lessons) for "Lộ trình". */
  flowEntry?: FlowEntry;
  /** Opens the lesson flow; omitted hides "Lộ trình". */
  onOpenFlow?: () => void;
};

/**
 * Lesson overview: the hero card (cover as its background), the goal, the
 * lesson path ("Lộ trình") for flow lessons, the words and sentences under
 * one tab bar, and "Khám phá" rows into the study sections.
 * Everything shown is derived from the canonical snapshot; only the
 * pictures are asked for beside it, and the defaults stand in without them.
 */
export function CanonicalLessonHub({
  snapshot,
  analyses,
  offline,
  hasUpdate,
  onOpenSection,
  onOpenLesson,
  onOpenPractice,
  onOpenCompose,
  onDeleteLesson,
  onSpeakText,
  flowEntry,
  onOpenFlow,
}: CanonicalLessonHubProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const sentences = useMemo(() => sortedSentences(snapshot), [snapshot]);
  const outcome = useMemo(() => collectLessonOutcome(snapshot), [snapshot]);
  const tense = useMemo(() => collectLessonTense(snapshot), [snapshot]);
  const [replayOpen, setReplayOpen] = useState(false);
  // E5 (S3): only lessons made from a situation can be replayed; no AI, works offline.
  const replay = useMemo(
    () =>
      snapshot.source_type === 'learner_situation'
        ? replayLine(collectLessonPatterns(snapshot), replayDayKey(new Date()))
        : null,
    [snapshot],
  );
  const sectionRows = useMemo(
    () => lessonHubSections(snapshot, analyses),
    [snapshot, analyses],
  );
  const catalogLesson = (snapshot.lesson_items ?? []).length > 0;
  const curriculumLesson = snapshot.unit != null;
  const pictures = useLessonPictures(
    snapshot.id,
    catalogLesson || curriculumLesson,
    offline ?? false,
  );
  const canPractice = useMemo(
    () =>
      onOpenPractice !== undefined &&
      getPracticeEligibility(buildPracticeSource(snapshot, analyses)).eligible,
    [onOpenPractice, snapshot, analyses],
  );
  const vocabulary = useMemo(
    () => collectLessonVocabulary(snapshot, analyses),
    [snapshot, analyses],
  );
  // Rows with nothing to open are left out. Words and phrases have their own
  // tab; an empty vocabulary row stays only where analysing a sentence fills it.
  const exploreRows = sectionRows.filter(row =>
    row.section === 'sentences'
      ? row.count > 0
      : row.section === 'vocabulary'
        ? row.count === 0 && !catalogLesson && sentences.length > 0
        : true,
  );
  const path = useMemo(() => {
    if (!flowEntry?.available || !onOpenFlow) return null;
    // Step 1 with nothing to review is left out, not shown as skipped.
    const firstStep = flowEntry.reviewSkipped ? 2 : 1;
    const current = flowEntry.resumeAt ?? firstStep;
    return {
      steps: FLOW_STEPS.filter(step => step >= firstStep).map(step => ({
        step,
        label: t(`lessonFlow.step_${step}`),
      })),
      current,
      finished: current === 6,
      reviewSkipped: flowEntry.reviewSkipped && flowEntry.resumeAt === null,
      nextActivities: blocksOfStep(snapshot, current).filter(
        block => block.type === 'activity',
      ).length,
    };
  }, [flowEntry, onOpenFlow, snapshot, t]);
  const meta: LessonHeroMeta[] = [
    ...(outcome?.estimatedMinutes
      ? [
          {
            icon: 'schedule' as const,
            label: t('lessonPlayer.hub_minutes', {
              count: outcome.estimatedMinutes,
            }),
          },
        ]
      : []),
    {
      icon: 'description',
      label: t('lessonPlayer.hero_sentences', {count: sentences.length}),
    },
    ...(vocabulary.length > 0
      ? [
          {
            icon: 'style' as const,
            label: t('lessonPlayer.hub_items', {count: vocabulary.length}),
          },
        ]
      : []),
  ];
  const chips = [
    snapshot.generated
      ? {
          key: 'generated',
          label: t('compose.chip_generated'),
          testID: 'canonical-hub-generated',
          tone: 'gold' as const,
        }
      : null,
    snapshot.situation_source === 'inferred'
      ? {
          key: 'inferred',
          label: t('compose.chip_inferred'),
          testID: 'canonical-hub-inferred',
          tone: 'coralSoft' as const,
        }
      : null,
    outcome && outcome.audience !== 'all'
      ? {
          key: 'audience',
          label: t(`lessonPlayer.audience_${outcome.audience}`),
          testID: 'canonical-hub-audience',
          tone: 'coralSoft' as const,
        }
      : null,
  ].filter(chip => chip !== null);

  return (
    <View testID="canonical-lesson-hub" style={styles.container}>
      <LessonStatusBanners offline={offline} hasUpdate={hasUpdate} />
      <SourcePhotoCard
        items={(snapshot.lesson_items ?? []).map(entry => entry.item)}
        lessonId={snapshot.id}
        offline={offline ?? false}
      />

      <View style={styles.header}>
        <LessonHeroCard
          description={
            snapshot.description.trim().length > 0 ? snapshot.description : null
          }
          eyebrow={
            snapshot.unit?.level_title ??
            (snapshot.origin === 'learner' ? t('lessonPlayer.hero_mine') : null)
          }
          glyph="book"
          imageUrl={curriculumLesson ? pictures.coverUrl : null}
          meta={meta}
          title={snapshot.title}
        />
        {chips.length > 0 ? (
          <View style={styles.chips}>
            {chips.map(chip => (
              <Chip
                key={chip.key}
                label={chip.label}
                testID={chip.testID}
                tone={chip.tone}
              />
            ))}
          </View>
        ) : null}
        {snapshot.generated &&
        snapshot.derived_from_lesson_id &&
        onOpenLesson ? (
          <Pressable
            accessibilityHint={t('compose.source_link_hint')}
            accessibilityRole="link"
            onPress={() => onOpenLesson(snapshot.derived_from_lesson_id!)}
            testID="canonical-hub-source-lesson"
          >
            <AppText style={themedStyles.expandLabel} variant="label">
              {`${t('compose.source_link')} →`}
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {outcome ? (
        <View>
          <SectionHeader title={t('lessonPlayer.goal_section')} />
          <LessonOutcomeCard onOpenLesson={onOpenLesson} outcome={outcome} />
        </View>
      ) : null}

      {tense ? (
        <View>
          <SectionHeader title={t('lessonPlayer.tense_title')} />
          <LessonTenseCard tense={tense} />
        </View>
      ) : null}

      {path ? (
        <LessonPathCard
          current={path.current}
          finished={path.finished}
          nextActivities={path.nextActivities}
          note={
            path.reviewSkipped ? t('lessonPlayer.path_review_skipped') : null
          }
          onOpen={onOpenFlow!}
          steps={path.steps}
        />
      ) : null}

      <LessonContentTabs
        itemImages={pictures.itemImages}
        onOpenWords={() => onOpenSection('vocabulary')}
        onSpeakText={onSpeakText}
        sentences={sentences}
        showPictures={catalogLesson}
        words={vocabulary}
      />

      <View style={styles.exploreSection}>
        {exploreRows.length > 0 || canPractice || replay || onOpenCompose ? (
          <SectionHeader title={t('lessonPlayer.explore_title')} />
        ) : null}
        {exploreRows.map(row => (
          <ExploreRow
            key={row.section}
            catalogLesson={catalogLesson}
            onOpenSection={onOpenSection}
            row={row}
          />
        ))}
        {canPractice ? (
          <LessonExploreRow
            icon="bolt"
            medallionTone="teal"
            onPress={onOpenPractice!}
            subtitle={t('practice.entry_hint')}
            testID="canonical-hub-practice"
            title={t('practice.entry_button')}
          />
        ) : null}
        {replay ? (
          <View>
            <LessonExploreRow
              icon="repeat"
              medallionTone="teal"
              onPress={() => {
                if (!replayOpen) trackEvent('moment_replayed', {});
                setReplayOpen(open => !open);
              }}
              subtitle={t('moment.replay_subtitle')}
              testID="canonical-hub-replay"
              title={t('moment.replay_title')}
            />
            {replayOpen ? (
              <AppCard style={themedStyles.contentCard}>
                <AppText color="secondary" variant="caption">
                  {t('moment.replay_changed', {label: replay.changedLabelVi})}
                </AppText>
                <AppText variant="h3">{replay.after}</AppText>
                {onSpeakText ? (
                  <Pressable
                    accessibilityLabel={t('moment.replay_listen')}
                    accessibilityRole="button"
                    onPress={() => onSpeakText(replay.after)}
                    style={themedStyles.listen}
                    testID="canonical-hub-replay-listen"
                  >
                    <AppText color="primary" variant="label">
                      {t('moment.replay_listen')}
                    </AppText>
                  </Pressable>
                ) : null}
              </AppCard>
            ) : null}
          </View>
        ) : null}
        {onOpenCompose ? (
          <LessonExploreRow
            icon="auto_awesome"
            medallionTone="gold"
            onPress={onOpenCompose}
            subtitle={t('compose.entry_subtitle')}
            testID="canonical-hub-compose"
            title={t('compose.entry_title')}
          />
        ) : null}
        {onDeleteLesson ? (
          <Pressable
            accessibilityLabel={t('moment.delete_lesson')}
            accessibilityRole="button"
            disabled={offline}
            onPress={onDeleteLesson}
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 44,
            }}
            testID="canonical-hub-delete"
          >
            <AppText
              style={{color: theme.colors.text.muted, fontWeight: '600'}}
            >
              {t('moment.delete_lesson')}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </View>
  );
}

function ExploreRow({
  row,
  catalogLesson,
  onOpenSection,
}: {
  row: LessonHubSectionRow;
  catalogLesson: boolean;
  onOpenSection: (section: LessonHubSection) => void;
}) {
  const {t} = useTranslation();
  const copy =
    row.section === 'vocabulary' && catalogLesson
      ? CATALOG_VOCABULARY_ROW
      : EXPLORE_ROWS[row.section];
  return (
    <LessonExploreRow
      disabled={row.section === 'sentences' && row.count === 0}
      icon={copy.icon}
      medallionTone={copy.tone}
      onPress={() => onOpenSection(row.section)}
      subtitle={
        row.count === 0 && copy.emptyKey
          ? t(copy.emptyKey)
          : t(copy.subtitleKey, {count: row.count})
      }
      testID={`canonical-hub-explore-${row.section}`}
      title={t(copy.titleKey)}
    />
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    listen: {alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center'},
    contentCard: {
      borderBottomColor: theme.colors.accentSoft,
      borderBottomWidth: 4,
    },
    expandLabel: {
      color: theme.colors.primary,
    },
  });
}

const styles = StyleSheet.create({
  container: {
    gap: 16,
  },
  exploreSection: {
    gap: 10,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  header: {
    gap: 8,
  },
});
