import React, {useMemo, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {ScrollView, StyleSheet, View} from 'react-native';

import {useSpeak} from '@features/audio';

import {ActionIconButton} from '@ui/components/ActionIconButton';
import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {HeroFill} from '@ui/components/HeroFill';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {StickerButton} from '@ui/components/StickerButton';
import {StudyFlashCard} from '@ui/components/StudyFlashCard';
import {
  SessionHeader,
  SessionSteps,
  StudyQuestion,
} from '@ui/components/StudySession';
import {SwipeCard, type SwipeDirection} from '@ui/components/SwipeCard';
import {canWriteWord, WriteWordButton} from '@ui/components/WriteWordButton';
import {WriteWordPanel} from '@ui/components/WriteWordPanel';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

import {readCatalogItems} from '@core/db/catalogItems';
import {
  buildRecognitionQuestions,
  type QuizQuestion,
} from '@core/learning/packQuiz';
import {useAppNavigation} from '@core/navigation';
import type {CatalogItem} from '@core/schemas/lesson';

import {topicLabelOf} from '../logic/packRows';
import {findDownloadedPack} from '../logic/wordPackRepository';
import {learnWordPack} from '../logic/wordPathClient';
import type {PackLearnRouteParams} from './navigationTypes';

type Props = {
  navigation?: {goBack?: () => void};
  route?: {params: PackLearnRouteParams};
  /** Tests pass the words; the screen reads the pack otherwise. */
  items?: CatalogItem[];
};

type Stage = 'cards' | 'recognition' | 'saving' | 'done';

/**
 * Vocab path P5, learn a pack: each word's card (meaning, IPA, one example),
 * then one recognition question per word. The words answered right are learned
 * (stage 0 on the review schedule); the others wait in the pack.

 *
 * IGNORE_TAB_BAR_CLEARANCE: a root-stack screen, drawn above the tab bar.
 */
export function PackLearnScreen({navigation, route, items: given}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const appNavigation = useAppNavigation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const {speak: say} = useSpeak();
  const packId = route?.params.packId ?? '';
  const [pack] = useState(() => (given ? null : findDownloadedPack(packId)));
  const [items] = useState<CatalogItem[]>(() => {
    if (given) return given;
    if (!pack) return [];
    const byCode = readCatalogItems(pack.itemCodes);
    return pack.itemCodes.flatMap(code => byCode.get(code) ?? []);
  });
  const [questions] = useState<QuizQuestion[]>(() =>
    buildRecognitionQuestions(items),
  );
  const [stage, setStage] = useState<Stage>('cards');
  const [cardIndex, setCardIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);
  const [chosen, setChosen] = useState<number | null>(null);
  const [learned, setLearned] = useState<string[]>([]);
  const [failed, setFailed] = useState(false);
  // "Viết từ": the current card swaps for the writing panel (practice only).
  const [writing, setWriting] = useState(false);
  const card = items[cardIndex];
  const question = questions[questionIndex];

  const save = async (codes: string[]) => {
    setStage('saving');
    setFailed(false);
    if (codes.length === 0) {
      setStage('done');
      return;
    }
    const result = await learnWordPack(packId, {
      itemCodes: codes,
      mode: 'learn',
    });
    if (result.ok) {
      setStage('done');
    } else {
      setFailed(true);
      setStage('recognition');
    }
  };

  const answer = (option: number) => {
    if (!question || chosen !== null) return;
    setChosen(option);
    const next =
      option === question.answerIndex
        ? [...learned, question.itemCode]
        : learned;
    setLearned(next);
  };

  const nextQuestion = () => {
    setChosen(null);
    if (questionIndex + 1 < questions.length) {
      setQuestionIndex(value => value + 1);
    } else {
      save(learned).catch(() => setFailed(true));
    }
  };

  const topic = pack
    ? (topicLabelOf(pack.topicCode) ??
      t('wordPath.pack_title', {position: pack.position}))
    : null;
  const packLabel = topic
    ? topic.charAt(0).toUpperCase() + topic.slice(1)
    : null;
  const nextCard = () => {
    setWriting(false);
    if (cardIndex + 1 < items.length) {
      setCardIndex(value => value + 1);
    } else {
      setStage('recognition');
    }
  };
  const prevCard = () => {
    setWriting(false);
    setCardIndex(value => Math.max(0, value - 1));
  };
  const onSwipe = (direction: SwipeDirection) =>
    direction === 'left' ? nextCard() : prevCard();
  const close = () => navigation?.goBack?.();
  const header =
    stage === 'cards'
      ? {
          current: Math.min(cardIndex + 1, items.length),
          total: items.length,
          label: t('packLearn.progress', {
            current: cardIndex + 1,
            total: items.length,
          }),
        }
      : {
          current:
            stage === 'recognition' ? questionIndex + 1 : questions.length,
          total: questions.length,
          label: t('packLearn.recognition', {
            current: questionIndex + 1,
            total: questions.length,
          }),
        };

  return (
    <AppScreen>
      <SessionHeader
        complete={stage === 'done'}
        current={header.current}
        onClose={close}
        progressLabel={header.label}
        total={header.total}
      />
      <ScrollView contentContainerStyle={themedStyles.container}>
        {items.length === 0 ? (
          <AppCard testID="pack-learn-empty">
            <AppText color="secondary">{t('packLearn.empty')}</AppText>
          </AppCard>
        ) : null}

        {items.length > 0 && stage !== 'done' ? (
          <SessionSteps
            active={stage === 'cards' ? 0 : 1}
            labels={[t('packLearn.step_cards'), t('packLearn.step_quiz')]}
          />
        ) : null}

        {stage === 'cards' && card && writing ? (
          <WriteWordPanel
            ipa={card.ipa}
            key={card.code}
            meaningVi={card.meaning_vi}
            onDone={() => setWriting(false)}
            testID="pack-learn-write"
            word={card.text}
          />
        ) : null}
        {stage === 'cards' && card && !writing ? (
          <SwipeCard
            cardKey={card.code}
            directions={cardIndex === 0 ? ['left'] : ['left', 'right']}
            enabled
            leftLabel=""
            onSwipe={onSwipe}
            rightLabel=""
            testID="pack-learn-swipe"
          >
            <StudyFlashCard
              example={card.examples[0]?.text_en ?? null}
              ipa={card.ipa}
              meaning={card.meaning_vi}
              onSpeak={() => say(card.text)}
              packLabel={packLabel}
              testID={`pack-learn-card-${card.code}`}
              word={card.text}
            />
          </SwipeCard>
        ) : null}
        {stage === 'cards' && card && !writing && canWriteWord(card.text) ? (
          <WriteWordButton
            onPress={() => setWriting(true)}
            testID="pack-learn-write-word"
            text={card.text}
          />
        ) : null}
        {stage === 'cards' && card && !writing ? (
          <AppText
            color="muted"
            style={themedStyles.swipeHint}
            variant="caption"
          >
            {t('packLearn.swipe_hint')}
          </AppText>
        ) : null}

        {stage !== 'cards' && stage !== 'done' && question ? (
          <StudyQuestion
            answerIndex={question.answerIndex}
            chosen={chosen}
            onChoose={answer}
            onSpeak={() => say(question.prompt)}
            optionTestID="pack-learn-option"
            options={question.options}
            prompt={question.prompt}
            containerTestID={`pack-learn-question-${questionIndex}`}
          />
        ) : null}
        {failed ? (
          <AppText color="danger">{t('packLearn.save_failed')}</AppText>
        ) : null}

        {stage === 'done' ? (
          <PackLearnDone
            learned={learned}
            items={items}
            packLabel={packLabel}
            total={questions.length}
          />
        ) : null}
      </ScrollView>

      {stage === 'cards' && card && !writing ? (
        <View style={themedStyles.footer}>
          <ActionIconButton
            accessibilityHint={t('packLearn.prev_hint')}
            accessibilityLabel={t('packLearn.prev')}
            disabled={cardIndex === 0}
            icon="chevron_left"
            onPress={prevCard}
            onTint
            size="bar"
            testID="pack-learn-prev-card"
          />
          <AppButton
            iconRight="chevron_right"
            onPress={nextCard}
            style={themedStyles.grow}
            testID="pack-learn-next-card"
            title={t('packLearn.next')}
            variant="secondary-coral"
          />
        </View>
      ) : null}

      {(stage === 'recognition' || stage === 'saving') && question ? (
        <View style={themedStyles.footer}>
          <AppButton
            disabled={chosen === null || stage === 'saving'}
            loading={stage === 'saving'}
            onPress={nextQuestion}
            style={themedStyles.grow}
            testID="pack-learn-next-question"
            iconRight="chevron_right"
            title={
              questionIndex + 1 < questions.length
                ? t('packLearn.next')
                : t('packLearn.finish')
            }
            variant="secondary-coral"
          />
        </View>
      ) : null}

      {stage === 'done' ? (
        <View style={themedStyles.footer}>
          <View style={themedStyles.grow}>
            <StickerButton
              label={t('packLearn.finish')}
              onPress={() => appNavigation.goBack()}
              testID="pack-learn-back"
            />
          </View>
        </View>
      ) : null}
    </AppScreen>
  );
}

const DONE_WORDS_SHOWN = 6;

/** The end of the session: how many words went into review, and which. */
function PackLearnDone({
  learned,
  items,
  packLabel,
  total,
}: {
  learned: string[];
  items: CatalogItem[];
  packLabel: string | null;
  total: number;
}) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const words = items
    .filter(item => learned.includes(item.code))
    .map(item => item.text);
  const hidden = words.length - DONE_WORDS_SHOWN;
  return (
    <View style={themedStyles.doneContent} testID="pack-learn-done">
      <View
        accessible
        accessibilityLabel={t('packLearn.done', {count: learned.length})}
        style={themedStyles.doneShelf}
      >
        <View style={themedStyles.doneHero}>
          <HeroFill id="pack-learn-done-fill" />
          <View style={themedStyles.doneMedal}>
            <MaterialIcon
              color={theme.colors.primary}
              name="check_circle"
              size={40}
            />
          </View>
          <AppText
            style={themedStyles.doneCount}
          >{`+${learned.length}`}</AppText>
          <AppText style={themedStyles.doneAdded}>
            {t('packLearn.done_added')}
          </AppText>
          <View style={themedStyles.doneChips}>
            <View style={themedStyles.doneChip}>
              <MaterialIcon
                color={HERO_PALETTE.tealInk}
                name="check"
                size={16}
              />
              <AppText style={themedStyles.doneChipText}>
                {t('packLearn.done_score', {right: learned.length, total})}
              </AppText>
            </View>
            {packLabel ? (
              <View style={themedStyles.doneChip}>
                <MaterialIcon
                  color={HERO_PALETTE.tealInk}
                  name="style"
                  size={16}
                />
                <AppText numberOfLines={1} style={themedStyles.doneChipText}>
                  {packLabel}
                </AppText>
              </View>
            ) : null}
          </View>
        </View>
      </View>
      {words.length > 0 ? (
        <AppCard>
          <View style={themedStyles.doneWordsBlock}>
            <AppText style={themedStyles.doneWordsLabel}>
              {t('packLearn.done_words')}
            </AppText>
            <View style={themedStyles.doneWords}>
              {words.slice(0, DONE_WORDS_SHOWN).map(word => (
                <View key={word} style={themedStyles.doneWord}>
                  <AppText style={themedStyles.doneWordText}>{word}</AppText>
                </View>
              ))}
              {hidden > 0 ? (
                <View style={[themedStyles.doneWord, themedStyles.doneMore]}>
                  <AppText color="muted" style={themedStyles.doneWordText}>
                    {`+${hidden}`}
                  </AppText>
                </View>
              ) : null}
            </View>
          </View>
        </AppCard>
      ) : null}
      {learned.length > 0 ? (
        <AppText color="muted" style={themedStyles.doneNext} variant="caption">
          {t('packLearn.done_next')}
        </AppText>
      ) : null}
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    container: {
      gap: theme.spacing.md,
      padding: theme.spacing.md,
    },
    footer: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: 10,
      paddingBottom: theme.spacing.md,
      paddingHorizontal: theme.spacing.md,
      paddingTop: theme.spacing.sm,
    },
    grow: {
      flex: 1,
    },
    doneContent: {
      gap: theme.spacing.lg,
      paddingTop: theme.spacing.sm,
    },
    doneShelf: {
      backgroundColor: HERO_PALETTE.shelf,
      borderRadius: 30,
      paddingBottom: 6,
    },
    doneHero: {
      alignItems: 'center',
      borderRadius: 30,
      gap: 6,
      overflow: 'hidden',
      paddingBottom: 20,
      paddingHorizontal: 18,
      paddingTop: 26,
    },
    doneMedal: {
      alignItems: 'center',
      backgroundColor: HERO_PALETTE.white,
      borderRadius: 36,
      height: 72,
      justifyContent: 'center',
      marginBottom: 6,
      width: 72,
      ...getStickerEdge(5, HERO_PALETTE.ghostShelf),
    },
    doneCount: {
      color: HERO_PALETTE.ink,
      fontSize: 52,
      fontWeight: '900',
      lineHeight: 58,
    },
    doneAdded: {
      color: HERO_PALETTE.tealInk,
      fontSize: 16,
      fontWeight: '800',
      textAlign: 'center',
    },
    doneChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      justifyContent: 'center',
      marginTop: 8,
    },
    doneChip: {
      alignItems: 'center',
      backgroundColor: HERO_PALETTE.chipStrong,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: 4,
      maxWidth: '100%',
      paddingHorizontal: 11,
      paddingVertical: 5,
    },
    doneChipText: {
      color: HERO_PALETTE.tealInk,
      flexShrink: 1,
      fontSize: 13,
      fontWeight: '800',
    },
    doneWordsBlock: {
      gap: 10,
    },
    doneWordsLabel: {
      color: theme.colors.text.muted,
      fontSize: 11,
      fontWeight: '800',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    doneWords: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    doneWord: {
      backgroundColor: theme.colors.accentSoft,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 11,
      paddingVertical: 5,
    },
    doneMore: {
      backgroundColor: theme.colors.surfaceMuted,
    },
    doneWordText: {
      color: theme.colors.primary,
      fontSize: 13,
      fontWeight: '800',
    },
    doneNext: {
      textAlign: 'center',
    },
    swipeHint: {
      textAlign: 'center',
    },
  });
}
