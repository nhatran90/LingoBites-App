import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {useScreenSpeak} from '@features/audio';
import {
  useWordPractice,
  WordPracticeBar,
  WordPracticeView,
} from '@features/pronunciation';

import {AppText} from '@ui/components/AppText';
import {SLOW_TTS_RATE} from '@ui/components/ListenButtons';
import {formatIpa} from '@ui/components/WordCard';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {
  type CatalogItem,
  itemCardIds,
  type LessonBlock,
} from '@core/schemas/lesson';

import {itemCardText} from '../../player/components/CanonicalBlockView';
import {Flashcard, FlashcardDeck} from '../../player/components/FlashcardDeck';
import {
  SpeakSquare,
  StudyProgress,
} from '../../player/components/StudyControls';
import type {FlowItems} from '../logic/flowContent';
import {
  type FlowFooterAction,
  FlowFooterBar,
  useFlowFooter,
} from './FlowFooter';

export {SLOW_TTS_RATE};

export type ListenCardDeckProps = {
  block: LessonBlock;
  items: FlowItems;
  /** "Sang phần luyện" on the last card; omitted = the step's own button. */
  onDone?: () => void;
};

/**
 * Step 2: an `item_cards` block as flashcards, like "Từ & cụm". The front
 * shows the item and its IPA with "Nghe" and "Nghe chậm"; a tap flips it to
 * the meaning; a swipe or the bottom buttons move through the deck. Nothing
 * here is an attempt.
 */
export function ListenCardDeck({block, items, onDone}: ListenCardDeckProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const cards = useMemo(
    () =>
      itemCardIds(block).flatMap(id => {
        const item = items.get(id);
        return item ? [{id, item}] : [];
      }),
    [block, items],
  );
  const [index, setIndex] = useState(0);
  const speak = useScreenSpeak();
  const total = cards.length;
  const last = index + 1 >= total;
  const goTo = (next: number) => {
    setIndex(Math.min(Math.max(next, 0), total - 1));
  };
  const current = cards[index];
  // "Viết từ" / "Đọc từ": the card swaps for the practice panel (practice
  // only); the step's buttons wait until it closes.
  const wordPractice = useWordPractice(
    current
      ? {
          key: current.id,
          text: current.item.text,
          meaningVi: current.item.meaning_vi,
          ipa: current.item.ipa ? formatIpa(current.item.ipa) : null,
          kind: current.item.kind,
          itemId: current.item.id,
        }
      : null,
    'lesson',
  );

  const previous =
    total > 1
      ? {
          title: t('lessonFlow.card_previous'),
          hint: t('lessonFlow.card_previous_hint'),
          testID: 'lesson-flow-card-previous',
          onPress: () => goTo(index - 1),
          disabled: index === 0,
        }
      : undefined;
  const action: FlowFooterAction | null = !last
    ? {
        title: t('lessonFlow.card_next'),
        hint: t('lessonFlow.card_next_hint'),
        testID: 'lesson-flow-card-next',
        onPress: () => goTo(index + 1),
        secondary: previous,
      }
    : onDone
      ? {
          title: t('lessonFlow.card_done'),
          hint: t('lessonFlow.card_done_hint'),
          testID: 'lesson-flow-card-done',
          onPress: onDone,
          secondary: previous,
        }
      : null;
  const hosted = useFlowFooter(wordPractice.practising ? 'hidden' : action, 1);

  const card = cards[index];
  if (!card) return null;

  return (
    <View
      style={themedStyles.container}
      testID={`lesson-flow-deck-${block.id}`}
    >
      {block.title ? <AppText variant="h3">{block.title}</AppText> : null}
      {total > 1 ? (
        <StudyProgress
          index={index}
          label={t('lessonPlayer.study_position', {
            index: index + 1,
            total,
          })}
          onSelect={goTo}
          testID="lesson-flow-card-progress"
          total={total}
        />
      ) : null}
      {wordPractice.practising ? (
        <WordPracticeView
          onSpeak={speak}
          practice={wordPractice}
          testID="lesson-flow-card"
        />
      ) : (
        <>
          <FlashcardDeck
            faceOf={k => faceOf(cards[k]!.item)}
            index={index}
            onIndexChange={goTo}
            renderCard={() => (
              <ListenCard id={card.id} item={card.item} key={card.id} />
            )}
            testID="lesson-flow-card-swipe"
            total={total}
          />
          <WordPracticeBar
            practice={wordPractice}
            testID="lesson-flow-card-practice"
          />
          <AppText color="muted" style={themedStyles.hint}>
            {t('lessonFlow.card_swipe_hint')}
          </AppText>
        </>
      )}
      {action && !hosted && !wordPractice.practising ? (
        <FlowFooterBar action={action} />
      ) : null}
    </View>
  );
}

function faceOf(item: CatalogItem) {
  return {
    word: itemCardText(item),
    ipa: item.ipa ? formatIpa(item.ipa) : null,
  };
}

/** One card: listen and listen slowly on both sides (not for patterns). */
function ListenCard({id, item}: {id: string; item: CatalogItem}) {
  const {t} = useTranslation();
  const speak = useScreenSpeak();
  const speakable = item.kind !== 'pattern';
  const actions = (side: 'front' | 'back') => {
    if (!speakable) return null;
    const suffix = side === 'back' ? '-back' : '';
    return (
      <>
        <SpeakSquare
          accessibilityHint={t('lessonFlow.listen_model_hint')}
          accessibilityLabel={t('lessonFlow.listen_model')}
          onPress={() => {
            speak(item.text);
          }}
          onTint={side === 'back'}
          testID={`lesson-flow-card-listen${suffix}`}
        />
        <SpeakSquare
          accessibilityHint={t('lessonFlow.listen_slow_hint')}
          accessibilityLabel={t('lessonFlow.listen_slow')}
          label={t('listen.slow_badge')}
          onPress={() => {
            speak(item.text, SLOW_TTS_RATE);
          }}
          onTint={side === 'back'}
          testID={`lesson-flow-card-listen-slow${suffix}`}
        />
      </>
    );
  };
  return (
    <Flashcard
      {...faceOf(item)}
      actions={actions}
      meaning={item.meaning_vi}
      sentence={item.examples[0]?.text_en ?? null}
      tags={item.part_of_speech ? [item.part_of_speech] : []}
      testID={`lesson-flow-card-${id}`}
    />
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.md,
    },
    hint: {
      fontSize: 12.5,
      textAlign: 'center',
    },
  });
}
