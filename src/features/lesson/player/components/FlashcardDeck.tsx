import React, {useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {
  Animated,
  type LayoutChangeEvent,
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import {useReducedMotion} from 'react-native-reanimated';

import {AppText} from '@ui/components/AppText';
import {withAlpha} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {cardColors} from '@ui/components/ToneCard';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {solidOver} from '@ui/theme/colorUtils';
import {getStickerEdge} from '@ui/theme/hardShadow';

import {studyCardStyle, StudyLabel} from './StudyControls';
import {SwipeCard} from './SwipeCard';

export const FLASHCARD_HEIGHT = 340;
/** How far each card behind the top one peeks out. */
const PEEK = 10;
/** How much narrower each card behind is, on each side. */
const SHEET_INSET = 10;
/** The card's raised edge, the same height on both faces. */
const CARD_EDGE = 6;
/** Drag distance at which the card below has fully come up. */
const LIFT_DISTANCE = 140;

export type FlashcardFace = {
  word: string;
  /** Already formatted, e.g. "/ˈsɪm.bəl/". */
  ipa: string | null;
};

export type FlashcardProps = FlashcardFace & {
  meaning: string;
  tags?: string[];
  /** A lesson sentence using the word, shown on the back. */
  sentence?: string | null;
  /** The buttons in the card's top corner, on each side. */
  actions?: (side: 'front' | 'back') => React.ReactNode;
  testID: string;
};

/**
 * A card that flips on tap: the word and its IPA on the front, the meaning,
 * tags and a lesson sentence on the back.
 */
export function Flashcard({
  word,
  ipa,
  meaning,
  tags = [],
  sentence = null,
  actions,
  testID,
}: FlashcardProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const reduceMotion = useReducedMotion();
  const [flipped, setFlipped] = useState(false);
  const turn = useRef(new Animated.Value(0)).current;
  const back = cardColors(theme, 'accent');

  useEffect(() => {
    if (reduceMotion) {
      turn.setValue(flipped ? 1 : 0);
      return;
    }
    Animated.timing(turn, {
      toValue: flipped ? 1 : 0,
      duration: 360,
      useNativeDriver: true,
    }).start();
  }, [flipped, reduceMotion, turn]);

  const face = (from: string, to: string, visibleFirst: boolean) => ({
    opacity: turn.interpolate({
      inputRange: [0, 0.5, 0.501, 1],
      outputRange: visibleFirst ? [1, 1, 0, 0] : [0, 0, 1, 1],
    }),
    transform: [
      {perspective: 1200},
      {
        rotateY: turn.interpolate({
          inputRange: [0, 1],
          outputRange: [from, to],
        }),
      },
    ],
  });

  return (
    <View style={styles.card} testID={testID}>
      <Pressable
        accessibilityHint={t('lessonPlayer.flashcard_flip_a11y')}
        accessibilityLabel={
          flipped
            ? t('lessonPlayer.flashcard_a11y_back', {word, meaning})
            : t('lessonPlayer.flashcard_a11y_front', {word, ipa: ipa ?? ''})
        }
        accessibilityRole="button"
        onPress={() => setFlipped(value => !value)}
        style={StyleSheet.absoluteFill}
        testID={`${testID}-flip`}
      />
      <Animated.View
        accessibilityElementsHidden={flipped}
        importantForAccessibility={flipped ? 'no-hide-descendants' : 'auto'}
        pointerEvents={flipped ? 'none' : 'box-none'}
        style={[styles.face, styles.front, face('0deg', '180deg', true)]}
        testID={`${testID}-front`}
      >
        <View pointerEvents="box-none" style={styles.bar}>
          <StudyLabel>{t('lessonPlayer.flashcard_front')}</StudyLabel>
          {actions ? (
            <View style={styles.actions}>{actions('front')}</View>
          ) : null}
        </View>
        <FrontBody ipa={ipa} word={word} />
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={styles.tapHint}
        >
          <MaterialIcon color={theme.colors.primary} name="refresh" size={16} />
          <AppText style={styles.tapText}>
            {t('lessonPlayer.flashcard_flip_hint')}
          </AppText>
        </View>
      </Animated.View>
      <Animated.View
        accessibilityElementsHidden={!flipped}
        importantForAccessibility={flipped ? 'auto' : 'no-hide-descendants'}
        pointerEvents={flipped ? 'box-none' : 'none'}
        style={[
          styles.face,
          {
            backgroundColor: back.face,
            ...getStickerEdge(CARD_EDGE, back.shelf),
          },
          face('180deg', '360deg', false),
        ]}
        testID={`${testID}-back`}
      >
        <View pointerEvents="box-none" style={styles.bar}>
          <StudyLabel color={back.ink}>
            {t('lessonPlayer.flashcard_back')}
          </StudyLabel>
          {actions ? (
            <View style={styles.actions}>{actions('back')}</View>
          ) : null}
        </View>
        <View
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          pointerEvents="none"
          style={styles.backBody}
        >
          <View style={styles.backWordLine}>
            <AppText style={[styles.backWord, {color: back.ink}]}>
              {word}
            </AppText>
            {ipa ? (
              <AppText color="muted" variant="caption">
                {ipa}
              </AppText>
            ) : null}
          </View>
          <AppText style={styles.meaning} testID={`${testID}-meaning`}>
            {meaning}
          </AppText>
          {tags.length > 0 ? (
            <View style={styles.tags}>
              {tags.map(tag => (
                <View key={tag} style={styles.tag}>
                  <AppText style={[styles.tagText, {color: back.ink}]}>
                    {tag}
                  </AppText>
                </View>
              ))}
            </View>
          ) : null}
        </View>
        {sentence ? (
          <View pointerEvents="none" style={styles.example}>
            <StudyLabel color={back.ink}>
              {t('lessonPlayer.flashcard_in_lesson')}
            </StudyLabel>
            <AppText style={styles.exampleText}>{sentence}</AppText>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

/** The word and its IPA in the middle of a card's front. */
function FrontBody({word, ipa}: FlashcardFace) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      pointerEvents="none"
      style={styles.frontBody}
    >
      <AppText style={styles.word}>{word}</AppText>
      {ipa ? (
        <AppText color="muted" style={styles.ipa}>
          {ipa}
        </AppText>
      ) : null}
    </View>
  );
}

export type FlashcardDeckProps = {
  total: number;
  index: number;
  onIndexChange: (index: number) => void;
  /** The card on top. */
  renderCard: (index: number) => React.ReactNode;
  /** The front of another card, shown under the top one while it moves. */
  faceOf: (index: number) => FlashcardFace;
  testID: string;
};

/**
 * Flashcards stacked one on another. Dragging the top card sideways brings
 * up the card underneath, already showing the next word (or the previous
 * one when dragging back), so the deck never looks empty.
 */
export function FlashcardDeck({
  total,
  index,
  onIndexChange,
  renderCard,
  faceOf,
  testID,
}: FlashcardDeckProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const drag = useRef(new Animated.Value(0)).current;
  // The cards behind are drawn narrower by scaling, so the scale needs the width.
  const [width, setWidth] = useState(0);
  const narrow = (depth: number) =>
    width > 0 ? (width - 2 * SHEET_INSET * depth) / width : 1 - 0.06 * depth;
  /** 1 while dragging towards the next card, -1 towards the previous one. */
  const [direction, setDirection] = useState<1 | -1>(1);
  useEffect(() => {
    const id = drag.addListener(({value}) => {
      if (value < 0) setDirection(1);
      else if (value > 0) setDirection(-1);
    });
    return () => drag.removeListener(id);
  }, [drag]);

  const last = index >= total - 1;
  const behind = Math.min(total - 1 - index, 2);
  const underIndex = index + direction;
  const under =
    underIndex >= 0 && underIndex < total ? faceOf(underIndex) : null;
  const lift = drag.interpolate({
    inputRange: [-LIFT_DISTANCE, 0, LIFT_DISTANCE],
    outputRange: [1, 0, 1],
    extrapolate: 'clamp',
  });
  // Solid at rest; only the last card hides its spare one until dragged.
  const underOpacity = lift.interpolate({
    inputRange: [0, 0.01, 1],
    outputRange: [behind > 0 ? 1 : 0, 1, 1],
  });
  // Even the last card keeps one card under it, to come up when going back.
  const layers = Math.max(behind, index > 0 ? 1 : 0);

  return (
    <View
      onLayout={(event: LayoutChangeEvent) =>
        setWidth(event.nativeEvent.layout.width)
      }
      style={[styles.deck, {height: FLASHCARD_HEIGHT + behind * PEEK}]}
    >
      {Array.from({length: layers}, (_, k) => layers - k).map(depth =>
        depth === 1 ? (
          <Animated.View
            key={depth}
            pointerEvents="none"
            style={[
              styles.behind,
              {
                opacity: underOpacity,
                transform: [
                  {
                    translateY: lift.interpolate({
                      inputRange: [0, 1],
                      outputRange: [PEEK, 0],
                    }),
                  },
                  {
                    scaleX: lift.interpolate({
                      inputRange: [0, 1],
                      outputRange: [narrow(1), 1],
                    }),
                  },
                ],
              },
            ]}
            testID={`${testID}-under`}
          >
            {under ? <FrontBody ipa={under.ipa} word={under.word} /> : null}
          </Animated.View>
        ) : (
          <View
            key={depth}
            style={[
              styles.behind,
              styles.behindDeep,
              {
                transform: [
                  {translateY: depth * PEEK},
                  {scaleX: narrow(depth)},
                ],
              },
            ]}
          />
        ),
      )}
      <SwipeCard
        canNext={!last}
        canPrevious={index > 0}
        drag={drag}
        onNext={() => onIndexChange(index + 1)}
        onPrevious={() => onIndexChange(index - 1)}
        style={styles.top}
        testID={testID}
      >
        {renderCard(index)}
      </SwipeCard>
    </View>
  );
}

/**
 * The white face's border and raised edge: the page's warm neutral, a step
 * darker for the edge, so a white card stands off a cream page. Drawn on
 * every theme, like the back face's edge.
 */
function frontSurface(theme: AppTheme, background: string) {
  const line = theme.colors.surfaceHigh;
  const shelf = solidOver(withAlpha(theme.colors.ink, 0.12), line);
  return {
    backgroundColor: background,
    borderRadius: 28,
    borderWidth: 1.5,
    borderColor: line,
    ...getStickerEdge(CARD_EDGE, shelf),
    // Android draws the edge as a bottom border; keep the other sides thin.
    borderTopColor: line,
    borderLeftColor: line,
    borderRightColor: line,
  } as const;
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    deck: {
      position: 'relative',
    },
    behind: {
      ...frontSurface(theme, theme.colors.surface),
      height: FLASHCARD_HEIGHT,
      left: 0,
      padding: 16,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    behindDeep: {
      backgroundColor: theme.colors.surfaceLow,
    },
    top: {
      height: FLASHCARD_HEIGHT,
    },
    card: {
      flex: 1,
    },
    face: {
      ...studyCardStyle(theme),
      backfaceVisibility: 'hidden',
      borderRadius: 28,
      bottom: 0,
      left: 0,
      padding: 16,
      position: 'absolute',
      right: 0,
      top: 0,
    },
    front: {
      ...frontSurface(theme, theme.colors.surface),
      alignItems: 'center',
    },
    bar: {
      alignItems: 'center',
      alignSelf: 'stretch',
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    actions: {
      flexDirection: 'row',
      gap: 6,
    },
    frontBody: {
      alignItems: 'center',
      flex: 1,
      gap: 8,
      justifyContent: 'center',
    },
    word: {
      color: theme.colors.text.primary,
      fontSize: 36,
      fontWeight: '800',
      lineHeight: 42,
      textAlign: 'center',
    },
    ipa: {
      fontSize: 17,
    },
    tapHint: {
      alignItems: 'center',
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: 6,
      paddingHorizontal: 14,
      paddingVertical: 7,
    },
    tapText: {
      color: theme.colors.primary,
      fontSize: 12.5,
      fontWeight: '700',
    },
    backBody: {
      flex: 1,
      gap: 10,
      paddingTop: 14,
    },
    backWordLine: {
      alignItems: 'baseline',
      columnGap: 8,
      flexDirection: 'row',
      flexWrap: 'wrap',
    },
    backWord: {
      fontSize: 19,
      fontWeight: '800',
    },
    meaning: {
      color: theme.colors.text.primary,
      fontSize: 27,
      fontWeight: '800',
      lineHeight: 33,
    },
    tags: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
    },
    tag: {
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    tagText: {
      fontSize: 12,
      fontWeight: '700',
    },
    example: {
      backgroundColor: theme.colors.surface,
      borderRadius: 16,
      gap: 2,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
    exampleText: {
      color: theme.colors.text.primary,
      fontSize: 14.5,
      lineHeight: 20,
    },
  });
}
