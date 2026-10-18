/**
 * "Học từng câu" for text, photo and admin lessons: one sentence at a time.
 * The progress strip says where you are, the sentence card swipes to the
 * next or previous sentence, its analysis sits right under it, and the
 * previous / next buttons stay at the bottom.
 */
import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import {AppSwitch} from '@ui/components/AppSwitch';
import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

import type {LessonAnalysis, LessonSnapshot} from '@core/schemas/lesson';

import {
  collectLessonGrammar,
  mergeAnalyses,
  sortedBlocks,
  sortedSentences,
} from '../logic/lessonHubContent';
import type {
  GrammarSaveControl,
  VocabularySaveControl,
} from '../logic/useLessonSavedItems';
import {CanonicalBlockView} from './CanonicalBlockView';
import {InterlinearSentence} from './InterlinearSentence';
import {LessonStatusBanners} from './LessonStatusBanners';
import {
  SentenceAnalysisPanel,
  type SentenceAnalysisPanelError,
  type SentenceAnalysisPanelState,
} from './SentenceAnalysisPanel';
import {SentenceAnalysisTabs} from './SentenceAnalysisTabs';
import {
  studyCardStyle,
  StudyNavButton,
  StudyNavRow,
  StudyPage,
  StudyProgress,
} from './StudyControls';
import {SwipeCard} from './SwipeCard';

export type SentenceStudyProps = {
  snapshot: LessonSnapshot;
  analyses: Record<string, LessonAnalysis>;
  lateAnalyses?: Record<string, LessonAnalysis>;
  offline?: boolean;
  hasUpdate?: boolean;
  onRequestAnalysis?: (sentenceId: string) => void;
  onRetryAnalysis?: (sentenceId: string) => void;
  analysisStates?: Record<
    string,
    SentenceAnalysisPanelState | SentenceAnalysisPanelError
  >;
  onSpeakText?: (text: string) => void;
  vocabularySave?: VocabularySaveControl;
  grammarSave?: GrammarSaveControl;
  /** "Xong" on the last sentence; omitted = no button there. */
  onFinish?: () => void;
};

export function SentenceStudy({
  snapshot,
  analyses,
  lateAnalyses,
  offline,
  hasUpdate,
  onRequestAnalysis,
  onRetryAnalysis,
  analysisStates,
  onSpeakText,
  vocabularySave,
  grammarSave,
  onFinish,
}: SentenceStudyProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const sentences = useMemo(() => sortedSentences(snapshot), [snapshot]);
  const blocks = useMemo(() => sortedBlocks(snapshot), [snapshot]);
  const blockItems = useMemo(
    () =>
      new Map(
        (snapshot.lesson_items ?? []).map(entry => [entry.item.id, entry.item]),
      ),
    [snapshot],
  );
  // Grammar is saved under its lesson-level id (the first sentence that
  // has it), so the Ngữ pháp section shows the same bookmark.
  const grammarKeys = useMemo(() => {
    const keys = new Map<string, string>();
    collectLessonGrammar(
      snapshot,
      mergeAnalyses(analyses, lateAnalyses),
    ).forEach(entry => keys.set(entry.name.toLowerCase(), entry.key));
    return keys;
  }, [analyses, lateAnalyses, snapshot]);
  const [index, setIndex] = useState(0);
  const [showVi, setShowVi] = useState(false);

  const total = sentences.length;
  const at = Math.min(index, Math.max(total - 1, 0));
  const sentence = sentences[at];
  const last = at >= total - 1;
  const goTo = (next: number) =>
    setIndex(Math.min(Math.max(next, 0), Math.max(total - 1, 0)));

  const footer = (
    <StudyNavRow>
      <StudyNavButton
        disabled={at === 0}
        icon="chevron_left"
        label={t('lessonPlayer.study_prev_sentence')}
        onPress={() => goTo(at - 1)}
        testID="sentence-study-prev"
        tone="ghost"
      />
      {last ? (
        <StudyNavButton
          accessibilityHint={t('lessonPlayer.study_done_hint')}
          disabled={!onFinish}
          icon="check_circle"
          label={t('lessonPlayer.study_done')}
          onPress={() => onFinish?.()}
          testID="sentence-study-done"
          tone="coral"
        />
      ) : (
        <StudyNavButton
          icon="chevron_right"
          iconSide="right"
          label={t('lessonPlayer.study_next_sentence')}
          onPress={() => goTo(at + 1)}
          testID="sentence-study-next"
          tone="coral"
        />
      )}
    </StudyNavRow>
  );

  const renderAnalysis = () => {
    if (!sentence) return null;
    const stored = analyses[sentence.id] ?? lateAnalyses?.[sentence.id];
    const asyncState = analysisStates?.[sentence.id];
    const tabsFor = (analysis: LessonAnalysis) => (
      <SentenceAnalysisTabs
        analysis={analysis}
        grammarKeyOf={item =>
          grammarKeys.get(item.name.toLowerCase()) ?? item.id
        }
        grammarSave={grammarSave}
        onSpeakText={onSpeakText}
        sentenceId={sentence.id}
        vocabularySave={vocabularySave}
        wordPath={snapshot.origin === 'learner'}
      />
    );
    if (stored) return tabsFor(stored);
    if (asyncState?.status === 'ready') return tabsFor(asyncState.analysis);
    if (asyncState) {
      return (
        <SentenceAnalysisPanel
          onRetry={
            onRetryAnalysis ? () => onRetryAnalysis(sentence.id) : undefined
          }
          sentenceId={sentence.id}
          state={asyncState}
        />
      );
    }
    if (offline) {
      return (
        <SentenceAnalysisPanel
          sentenceId={sentence.id}
          state={{status: 'offline-missing'}}
        />
      );
    }
    return (
      <View style={styles.analyzeCard}>
        <AppText color="secondary" style={styles.analyzeText}>
          {t('lessonPlayer.analysis_none')}
        </AppText>
        <Pressable
          accessibilityHint={t('lessonPlayer.analyze_hint')}
          accessibilityLabel={t('lessonPlayer.analyze_this')}
          accessibilityRole="button"
          onPress={() => onRequestAnalysis?.(sentence.id)}
          style={({pressed}) => [
            styles.analyzeButton,
            pressed ? styles.pressed : null,
          ]}
          testID={`canonical-analyze-${sentence.id}`}
        >
          <MaterialIcon
            color={theme.colors.text.inverse}
            name="auto_awesome"
            size={19}
          />
          <AppText style={styles.analyzeLabel}>
            {t('lessonPlayer.analyze_this')}
          </AppText>
        </Pressable>
      </View>
    );
  };

  return (
    <StudyPage footer={footer} pageKey={at} testID="canonical-player">
      <LessonStatusBanners hasUpdate={hasUpdate} offline={offline} />
      {total > 0 ? (
        <StudyProgress
          index={at}
          label={t('lessonPlayer.study_position', {index: at + 1, total})}
          onSelect={goTo}
          testID="sentence-study-progress"
          total={total}
        />
      ) : null}
      {sentence ? (
        <>
          <SwipeCard
            canNext={!last}
            canPrevious={at > 0}
            onNext={() => goTo(at + 1)}
            onPrevious={() => goTo(at - 1)}
            testID="sentence-study-swipe"
          >
            <View
              accessibilityHint={t('lessonPlayer.study_swipe_sentences')}
              accessibilityLabel={`${t('lessonPlayer.sentence_counter', {
                index: at + 1,
                total,
              })}. ${sentence.text_en}`}
              style={styles.card}
              testID={`canonical-sentence-${sentence.id}`}
            >
              <View style={styles.cardTop}>
                <View style={styles.chip}>
                  <AppText style={styles.chipText}>
                    {t('lessonPlayer.study_sentence_chip', {index: at + 1})}
                  </AppText>
                </View>
                <View style={styles.viSwitch}>
                  <AppText variant="label">
                    {t('lessonPlayer.show_vietnamese')}
                  </AppText>
                  <AppSwitch
                    accessibilityHint={t('lessonPlayer.show_vietnamese_hint')}
                    accessibilityLabel={t('lessonPlayer.show_vietnamese')}
                    onValueChange={setShowVi}
                    testID="sentence-study-vi-toggle"
                    value={showVi}
                  />
                </View>
              </View>
              <InterlinearSentence
                ipa={sentence.ipa}
                ipaWords={sentence.ipa_words}
                testID={`sentence-study-en-${sentence.id}`}
                text={sentence.text_en}
                wordStyle={styles.english}
              />
              {showVi ? (
                <View style={styles.viBox}>
                  <AppText
                    style={styles.viText}
                    testID={`sentence-study-vi-${sentence.id}`}
                  >
                    {sentence.text_vi}
                  </AppText>
                </View>
              ) : null}
              {onSpeakText ? (
                <Pressable
                  accessibilityHint={t('lessonPlayer.speak_sentence_hint')}
                  accessibilityLabel={t('lessonPlayer.speak_sentence', {
                    index: at + 1,
                  })}
                  accessibilityRole="button"
                  onPress={() => onSpeakText(sentence.text_en)}
                  style={({pressed}) => [
                    styles.listen,
                    pressed ? styles.listenPressed : null,
                  ]}
                  testID={`canonical-speak-${sentence.id}`}
                >
                  <MaterialIcon
                    color={HERO_PALETTE.white}
                    name="volume_up"
                    size={18}
                  />
                  <AppText style={styles.listenText}>
                    {t('lessonPlayer.study_listen_sentence')}
                  </AppText>
                </Pressable>
              ) : null}
            </View>
          </SwipeCard>
          {total > 1 ? (
            <AppText color="muted" style={styles.hint}>
              {t('lessonPlayer.study_swipe_sentences')}
            </AppText>
          ) : null}
          <AppText variant="h3">{t('lessonPlayer.analysis_section')}</AppText>
          {renderAnalysis()}
        </>
      ) : null}
      {blocks.length > 0 ? (
        <>
          <AppText variant="h3">{t('lessonPlayer.study_more_content')}</AppText>
          {blocks.map(block => (
            <CanonicalBlockView
              block={block}
              items={blockItems}
              key={block.id}
              onSpeakText={onSpeakText}
            />
          ))}
        </>
      ) : null}
    </StudyPage>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    card: {
      ...studyCardStyle(theme),
      borderRadius: 26,
      gap: 10,
      padding: 18,
    },
    cardTop: {
      alignItems: 'center',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    chip: {
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    chipText: {
      color: theme.colors.primary,
      fontSize: 12,
      fontWeight: '800',
    },
    viSwitch: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 8,
    },
    english: {
      color: theme.colors.text.primary,
      fontSize: 22,
      fontWeight: '800',
      lineHeight: 30,
    },
    viBox: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    viText: {
      color: theme.colors.text.secondary,
      fontSize: 15,
      lineHeight: 21,
    },
    listen: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: HERO_PALETTE.coral,
      borderRadius: 16,
      flexDirection: 'row',
      gap: 8,
      marginTop: 4,
      minHeight: 44,
      paddingHorizontal: 16,
      ...getStickerEdge(4, HERO_PALETTE.coralShelf),
    },
    listenPressed: {
      opacity: theme.states.pressedOpacity,
    },
    listenText: {
      color: HERO_PALETTE.white,
      fontSize: 14,
      fontWeight: '800',
    },
    hint: {
      fontSize: 12.5,
      marginTop: -4,
      textAlign: 'center',
    },
    analyzeCard: {
      ...studyCardStyle(theme),
      alignItems: 'center',
      gap: 12,
      padding: 16,
    },
    analyzeText: {
      textAlign: 'center',
    },
    analyzeButton: {
      alignItems: 'center',
      alignSelf: 'stretch',
      backgroundColor: theme.colors.primary,
      borderRadius: 18,
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'center',
      minHeight: 52,
      ...getStickerEdge(4, HERO_PALETTE.tealInk),
    },
    analyzeLabel: {
      color: theme.colors.text.inverse,
      fontSize: 16,
      fontWeight: '800',
    },
    pressed: {
      opacity: theme.states.pressedOpacity,
    },
  });
}
