import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {ActionIconButton} from '@ui/components/ActionIconButton';
import {AppText} from '@ui/components/AppText';
import {HeroFill} from '@ui/components/HeroFill';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {formatIpa} from '@ui/components/WordCard';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {HERO_PALETTE as PALETTE} from '@ui/theme/heroPalette';

export type ReviewCardContent = {
  word: string;
  meaning: string;
  ipa?: string | null;
  pos?: string | null;
  cefr?: string | null;
  example?: string | null;
  exampleTranslation?: string | null;
  /**
   * `pattern` cards are reviewed Vietnamese → English: the front shows the
   * meaning and the learner says the sentence; `word` holds the frame with its
   * slots blanked.
   */
  kind?: string | null;
};

type FaceProps = {
  card: ReviewCardContent;
  hint: string;
  /** Pattern cards: kind chip and what to do on the front. */
  patternLabel?: string;
  patternPrompt?: string;
  /** The card's speak button; omitted when the screen has its own. */
  onSpeak?: () => void;
  speakAccessibilityLabel?: string;
  speakTestID?: string;
  testID: string;
};

/**
 * Front: the recall cue only, on the pack card's mint-to-sky face — chips,
 * the word with its IPA in a pill under it, and a big speak button. Fills
 * the whole card.
 */
export function ReviewCardFront({
  card,
  hint,
  patternLabel,
  patternPrompt,
  onSpeak,
  speakAccessibilityLabel,
  speakTestID,
  testID,
}: FaceProps) {
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  if (card.kind === 'pattern') {
    // No speak button: hearing the sentence would give the answer away.
    return (
      <View style={[themedStyles.shelf, styles.shelfHero]}>
        <View style={[themedStyles.face, themedStyles.front]} testID={testID}>
          <HeroFill id={`${testID}-fill`} />
          <View style={styles.chips}>
            {patternLabel ? (
              <View style={themedStyles.chip}>
                <AppText style={styles.chipText}>{patternLabel}</AppText>
              </View>
            ) : null}
          </View>
          <View style={styles.center}>
            <AppText
              adjustsFontSizeToFit
              numberOfLines={4}
              style={styles.meaningFront}
              variant="display"
            >
              {card.meaning}
            </AppText>
            {patternPrompt ? (
              <AppText style={styles.prompt} variant="bodyLg">
                {patternPrompt}
              </AppText>
            ) : null}
          </View>
          <View style={styles.hintRow}>
            <MaterialIcon color={PALETTE.tealInk} name="refresh" size={16} />
            <AppText style={styles.hintOnHero} variant="label">
              {hint}
            </AppText>
          </View>
        </View>
      </View>
    );
  }
  return (
    <View style={[themedStyles.shelf, styles.shelfHero]}>
      <View style={[themedStyles.face, themedStyles.front]} testID={testID}>
        <HeroFill id={`${testID}-fill`} />
        <View style={styles.chips}>
          {card.pos ? (
            <View style={themedStyles.chip}>
              <AppText style={styles.chipText}>{card.pos}</AppText>
            </View>
          ) : (
            <View />
          )}
          {card.cefr ? (
            <View style={themedStyles.chip}>
              <AppText style={styles.chipText}>{card.cefr}</AppText>
            </View>
          ) : null}
        </View>
        <View style={styles.center}>
          <AppText
            adjustsFontSizeToFit
            numberOfLines={2}
            style={styles.word}
            variant="display"
          >
            {card.word}
          </AppText>
          {card.ipa ? (
            <View style={themedStyles.ipaPill}>
              <AppText style={styles.ipa} variant="bodyLg">
                {formatIpa(card.ipa)}
              </AppText>
            </View>
          ) : null}
          {onSpeak ? (
            <ActionIconButton
              accessibilityLabel={speakAccessibilityLabel ?? ''}
              icon="volume_up"
              onPress={onSpeak}
              onTint
              size="large"
              style={styles.speak}
              testID={speakTestID}
            />
          ) : null}
        </View>
        <View style={styles.hintRow}>
          <MaterialIcon color={PALETTE.tealInk} name="refresh" size={16} />
          <AppText style={styles.hintOnHero} variant="label">
            {hint}
          </AppText>
        </View>
      </View>
    </View>
  );
}

/**
 * Back: laid out like the pack flash card. The word stays on a short
 * mint-to-sky band at the top; the meaning is the hero on white; the
 * example sits in a yellow panel under it.
 */
export function ReviewCardBack({
  card,
  hint,
  onSpeak,
  speakAccessibilityLabel,
  speakTestID,
  testID,
}: FaceProps) {
  const {t} = useTranslation();
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const pattern = card.kind === 'pattern';
  const meta = [card.ipa ? formatIpa(card.ipa) : null, card.pos]
    .filter(Boolean)
    .join(' · ');
  // A pattern's answer is the English frame; the prompt (meaning) goes on top.
  const top = pattern ? card.meaning : card.word;
  const hero = pattern ? card.word : card.meaning;
  return (
    <View style={themedStyles.shelf}>
      <View style={[themedStyles.face, themedStyles.back]} testID={testID}>
        <View style={themedStyles.band}>
          <HeroFill id={`${testID}-fill`} />
          <View style={styles.flex1}>
            <AppText numberOfLines={2} style={styles.bandTitle} variant="h2">
              {top}
            </AppText>
            {meta ? (
              <AppText style={styles.bandMeta} variant="label">
                {meta}
              </AppText>
            ) : null}
          </View>
          {onSpeak ? (
            <ActionIconButton
              accessibilityLabel={speakAccessibilityLabel ?? ''}
              icon="volume_up"
              onPress={onSpeak}
              onTint
              testID={speakTestID}
            />
          ) : null}
        </View>
        <View style={themedStyles.backBody}>
          <AppText style={themedStyles.label}>{t('packLearn.meaning')}</AppText>
          <View style={styles.center}>
            <AppText
              adjustsFontSizeToFit
              numberOfLines={4}
              style={themedStyles.meaning}
              testID={`${testID}-hero`}
              variant="display"
            >
              {hero}
            </AppText>
          </View>
          {card.example ? (
            <View
              style={themedStyles.examplePanel}
              testID="review-card-example"
            >
              <AppText style={styles.exampleText}>{card.example}</AppText>
              {card.exampleTranslation ? (
                <AppText color="secondary" variant="caption">
                  {card.exampleTranslation}
                </AppText>
              ) : null}
            </View>
          ) : null}
          <View style={styles.hintRow}>
            <MaterialIcon
              color={theme.colors.text.muted}
              name="chevron_left"
              size={18}
            />
            <AppText color="muted" variant="label">
              {hint}
            </AppText>
            <MaterialIcon
              color={theme.colors.text.muted}
              name="chevron_right"
              size={18}
            />
          </View>
        </View>
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    // Solid shelf under the card, as under the pack flash card.
    shelf: {
      alignSelf: 'stretch',
      backgroundColor: theme.shelf?.surface.color ?? theme.colors.border,
      borderRadius: 28,
      flex: 1,
      paddingBottom: 6,
    },
    face: {
      borderRadius: 28,
      flex: 1,
      overflow: 'hidden',
    },
    front: {
      backgroundColor: PALETTE.faceFrom,
      padding: theme.spacing.lg - 4,
    },
    back: {
      backgroundColor: theme.colors.surface,
    },
    chip: {
      backgroundColor: PALETTE.chip,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 10,
      paddingVertical: 4,
    },
    ipaPill: {
      backgroundColor: PALETTE.chip,
      borderRadius: theme.radius.pill,
      paddingHorizontal: 14,
      paddingVertical: 6,
    },
    band: {
      alignItems: 'center',
      backgroundColor: PALETTE.faceFrom,
      flexDirection: 'row',
      gap: 12,
      paddingHorizontal: theme.spacing.lg - 4,
      paddingVertical: theme.spacing.md,
    },
    backBody: {
      flex: 1,
      gap: theme.spacing.sm,
      padding: theme.spacing.lg - 4,
    },
    label: {
      color: theme.colors.text.muted,
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 1,
      textTransform: 'uppercase',
    },
    meaning: {
      color: theme.colors.primary,
      fontSize: 34,
      lineHeight: 40,
      textAlign: 'center',
    },
    examplePanel: {
      backgroundColor: theme.colors.tertiarySoft,
      borderRadius: 16,
      gap: 4,
      paddingHorizontal: 12,
      paddingVertical: 10,
    },
  });
}

const styles = StyleSheet.create({
  // The mint-to-sky face sits on the teal hero edge, like the pack card.
  shelfHero: {
    backgroundColor: PALETTE.shelf,
  },
  bandMeta: {
    color: PALETTE.tealInk,
    opacity: 0.85,
  },
  bandTitle: {
    color: PALETTE.ink,
  },
  center: {
    alignItems: 'center',
    flex: 1,
    gap: 10,
    justifyContent: 'center',
  },
  chipText: {
    color: PALETTE.tealInk,
    fontSize: 12,
    fontWeight: '700',
  },
  chips: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  exampleText: {
    color: PALETTE.ink,
    fontStyle: 'italic',
  },
  flex1: {
    flex: 1,
  },
  hintOnHero: {
    color: PALETTE.tealInk,
  },
  hintRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'center',
  },
  ipa: {
    color: PALETTE.tealInk,
    textAlign: 'center',
  },
  meaningFront: {
    color: PALETTE.ink,
    fontSize: 30,
    lineHeight: 38,
    textAlign: 'center',
  },
  prompt: {
    color: PALETTE.tealInk,
    textAlign: 'center',
  },
  speak: {
    marginTop: 12,
  },
  word: {
    color: PALETTE.ink,
    fontSize: 38,
    lineHeight: 46,
    textAlign: 'center',
  },
});
