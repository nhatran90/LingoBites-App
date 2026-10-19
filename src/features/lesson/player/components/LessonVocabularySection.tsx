import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {
  useWordPractice,
  WordPracticeBar,
  WordPracticeView,
} from '@features/pronunciation';

import {AppTabs} from '@ui/components/AppTabs';
import {AppText} from '@ui/components/AppText';
import {formatIpa} from '@ui/components/WordCard';
import {type AppTheme, useAppTheme} from '@ui/theme';

import type {LessonSentence} from '@core/schemas/lesson';

import type {
  LessonItemRole,
  LessonVocabularyEntry,
} from '../logic/lessonHubContent';
import type {VocabularySaveControl} from '../logic/useLessonSavedItems';
import {Flashcard, FlashcardDeck} from './FlashcardDeck';
import {
  BookmarkToggle,
  SpeakSquare,
  StudyNavButton,
  StudyNavRow,
  StudyPage,
  StudyProgress,
} from './StudyControls';

export type LessonVocabularySectionProps = {
  entries: LessonVocabularyEntry[];
  /** The lesson's sentences, to show each word in context on the back. */
  sentences?: LessonSentence[];
  /** Speaks a word (TTS), slowly with a rate; omitted = no play buttons. */
  onSpeakText?: (text: string, rate?: number) => void;
  /** "Lưu thẻ" per word; omitted = no save buttons. */
  saveControl?: VocabularySaveControl;
  /** "Xong" after the last word; omitted = no button there. */
  onFinish?: () => void;
};

/**
 * "Từ & cụm": the lesson's words as flashcards, one at a time. The front
 * shows the word and its IPA, a tap flips it to the meaning, and a swipe
 * moves to the next or previous word. Catalog lessons split the words into
 * "Cần nhớ" and "Mở rộng" tabs.
 */
export function LessonVocabularySection({
  entries,
  sentences = [],
  onSpeakText,
  saveControl,
  onFinish,
}: LessonVocabularySectionProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const groups = useMemo(
    () =>
      (['required', 'extended'] as const)
        .map(role => ({
          role,
          entries: entries.filter(entry => (entry.role ?? 'required') === role),
        }))
        .filter(group => group.entries.length > 0),
    [entries],
  );
  const grouped = entries.some(entry => entry.role !== null);
  const [role, setRole] = useState<LessonItemRole>('required');
  const [index, setIndex] = useState(0);
  const group =
    grouped && groups.length > 1
      ? (groups.find(candidate => candidate.role === role) ?? groups[0]!)
      : null;
  const list = group ? group.entries : entries;
  const total = list.length;
  const at = Math.min(index, Math.max(total - 1, 0));
  const current = list[at];
  // "Viết từ" / "Đọc từ": the card swaps for the practice panel (practice
  // only). Moving to another word closes it.
  const wordPractice = useWordPractice(
    current
      ? {
          key: `${group?.role ?? 'all'}:${current.key}`,
          text: current.word,
          meaningVi: current.meaning,
          ipa: current.ipa ? formatIpa(current.ipa) : null,
          kind: null,
          itemId: current.itemId,
        }
      : null,
    'lesson',
  );

  if (entries.length === 0) {
    return (
      <View testID="lesson-vocabulary-empty" style={styles.empty}>
        <AppText color="secondary">
          {t('lessonPlayer.vocabulary_empty')}
        </AppText>
      </View>
    );
  }

  const entry = list[at]!;
  const last = at >= total - 1;
  const goTo = (next: number) => {
    setIndex(Math.min(Math.max(next, 0), total - 1));
  };

  const footer = (
    <StudyNavRow>
      <StudyNavButton
        disabled={at === 0}
        icon="chevron_left"
        label={t('lessonPlayer.study_prev_word')}
        onPress={() => goTo(at - 1)}
        testID="lesson-vocabulary-prev"
        tone="ghost"
      />
      {last ? (
        <StudyNavButton
          accessibilityHint={t('lessonPlayer.study_done_hint')}
          disabled={!onFinish}
          icon="check_circle"
          label={t('lessonPlayer.study_done')}
          onPress={() => onFinish?.()}
          testID="lesson-vocabulary-done"
          tone="coral"
        />
      ) : (
        <StudyNavButton
          icon="chevron_right"
          iconSide="right"
          label={t('lessonPlayer.study_next_word')}
          onPress={() => goTo(at + 1)}
          testID="lesson-vocabulary-next"
          tone="coral"
        />
      )}
    </StudyNavRow>
  );

  return (
    <StudyPage
      footer={wordPractice.practising ? null : footer}
      pageKey={`${group?.role ?? 'all'}-${at}`}
      testID="lesson-vocabulary-section"
    >
      {group ? (
        <AppTabs
          accessibilityHint={t('lessonPlayer.study_tab_hint')}
          onChange={next => {
            setRole(next);
            setIndex(0);
          }}
          tabs={groups.map(candidate => ({
            id: candidate.role,
            label: t(`lessonPlayer.vocabulary_group_${candidate.role}`),
            count: candidate.entries.length,
          }))}
          testID="lesson-vocabulary-group"
          value={group.role}
        />
      ) : null}
      <StudyProgress
        index={at}
        label={t('lessonPlayer.study_position', {index: at + 1, total})}
        onSelect={goTo}
        testID="lesson-vocabulary-progress"
        total={total}
      />
      {wordPractice.practising ? (
        <WordPracticeView
          onSpeak={onSpeakText}
          practice={wordPractice}
          testID="lesson-vocabulary"
        />
      ) : (
        <>
          <FlashcardDeck
            faceOf={k => faceOf(list[k]!)}
            index={at}
            onIndexChange={goTo}
            renderCard={() => (
              <VocabularyCard
                entry={entry}
                key={entry.key}
                onSpeakText={onSpeakText}
                saveControl={saveControl}
                sentence={sentenceWith(sentences, entry.word)}
              />
            )}
            testID="lesson-vocabulary-swipe"
            total={total}
          />
          <WordPracticeBar
            practice={wordPractice}
            testID="lesson-vocabulary-practice"
          />
          <AppText color="muted" style={styles.hint}>
            {t('lessonPlayer.flashcard_swipe_hint')}
          </AppText>
        </>
      )}
    </StudyPage>
  );
}

/** The first lesson sentence that uses the word (as a whole word), if any. */
function sentenceWith(
  sentences: LessonSentence[],
  word: string,
): string | null {
  const escaped = word.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!escaped) return null;
  const pattern = new RegExp(`\\b${escaped}\\b`, 'i');
  return (
    [...sentences]
      .sort((a, b) => a.position - b.position)
      .find(sentence => pattern.test(sentence.text_en))?.text_en ?? null
  );
}

function faceOf(entry: LessonVocabularyEntry) {
  return {word: entry.word, ipa: entry.ipa ? formatIpa(entry.ipa) : null};
}

/** One word as a flashcard, with listen and save on both sides. */
function VocabularyCard({
  entry,
  sentence,
  onSpeakText,
  saveControl,
}: {
  entry: LessonVocabularyEntry;
  sentence: string | null;
  onSpeakText?: (text: string) => void;
  saveControl?: VocabularySaveControl;
}) {
  const {t} = useTranslation();
  const actions = (side: 'front' | 'back') => {
    const suffix = side === 'back' ? '-back' : '';
    return (
      <>
        {onSpeakText ? (
          <SpeakSquare
            accessibilityHint={t('lessonPlayer.speak_word_hint')}
            accessibilityLabel={t('lessonPlayer.speak_word', {
              word: entry.word,
            })}
            onPress={() => onSpeakText(entry.word)}
            onTint={side === 'back'}
            testID={`lesson-vocabulary-speak-${entry.key}${suffix}`}
          />
        ) : null}
        {saveControl ? (
          <BookmarkToggle
            accessibilityHint={t('lessonPlayer.save_card_hint')}
            label={t('lessonPlayer.save_card')}
            onPress={() => saveControl.onToggle({...entry, id: entry.key})}
            onTint={side === 'back'}
            saved={saveControl.isSaved(entry.key)}
            savedLabel={t('lessonPlayer.saved')}
            testID={`lesson-vocabulary-save-${entry.key}${suffix}`}
          />
        ) : null}
      </>
    );
  };
  const tags = [
    entry.pos,
    entry.introduction
      ? t(`lessonPlayer.item_intro_${entry.introduction}`)
      : null,
  ].filter((tag): tag is string => Boolean(tag));
  return (
    <Flashcard
      {...faceOf(entry)}
      actions={actions}
      meaning={entry.meaning}
      sentence={sentence}
      tags={tags}
      testID={`lesson-vocabulary-${entry.key}`}
    />
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    empty: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      padding: theme.spacing.lg,
    },
    hint: {
      fontSize: 12.5,
      textAlign: 'center',
    },
  });
}
