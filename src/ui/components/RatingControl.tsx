import React, {type ReactNode} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, View} from 'react-native';

import type {ReviewRating} from '@core/db/types';

import type {AppTheme} from '../theme';
import {useAppTheme} from '../theme';
import {getStickerEdge} from '../theme/hardShadow';
import {AppText} from './AppText';
import {MaterialIcon} from './MaterialIcon';

type Props = {
  onRate: (rating: ReviewRating) => void;
  onSkip: () => void;
  disabled?: boolean;
  /**
   * Pre-flip reveal action. When set and `disabled`, a single "Xem nghĩa"
   * button replaces the inactive rating buttons.
   */
  onReveal?: () => void;
  /**
   * Shown first in the bottom row, beside "Xem nghĩa" or "Bỏ qua": the
   * card's listen buttons, within the thumb's reach.
   */
  leading?: ReactNode;
};

type RatingOption = {
  rating: ReviewRating;
  labelKey: string;
  hintKey: string;
  accessibilityKey: string;
  icon: 'check_circle' | 'refresh';
};

// Forgot on the left, remembered on the right (thumb-side "yes").
const RATING_OPTIONS: RatingOption[] = [
  {
    rating: 'forgot',
    labelKey: 'rating.forgot_label',
    hintKey: 'rating.forgot_hint',
    accessibilityKey: 'rating.forgot_a11y',
    icon: 'refresh',
  },
  {
    rating: 'remembered',
    labelKey: 'rating.remembered_label',
    hintKey: 'rating.remembered_hint',
    accessibilityKey: 'rating.remembered_a11y',
    icon: 'check_circle',
  },
];

function ratingTone(
  theme: AppTheme,
  rating: ReviewRating,
  disabled: boolean,
): {background: string; border: string; edge: string; ink: string} {
  if (disabled) {
    // SETE-254: never wash the whole button with disabledOpacity — the
    // composited glyph-vs-fill contrast collapses to ~1.7-2.0:1. A muted but
    // explicitly readable tone (text.secondary on surfaceMuted, >=3:1 on all
    // themes) still reads as inactive without becoming illegible.
    return {
      background: theme.colors.surfaceMuted,
      border: theme.colors.border,
      edge: theme.colors.outlineVariant,
      ink: theme.colors.text.secondary,
    };
  }
  switch (rating) {
    case 'remembered':
      return {
        background: theme.colors.primary,
        border: theme.colors.primary,
        edge: theme.shelf?.primary.color ?? theme.colors.primaryPressed,
        ink: theme.colors.text.inverse,
      };
    case 'forgot':
    default:
      return {
        background: theme.colors.surface,
        border: theme.shelf?.surface.color ?? theme.colors.surfaceHigh,
        edge: theme.shelf?.surface.color ?? theme.colors.surfaceHigh,
        ink: theme.colors.danger,
      };
  }
}

export function RatingControl({
  onRate,
  onSkip,
  disabled = false,
  onReveal,
  leading,
}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();

  if (disabled && onReveal) {
    const revealEdge =
      theme.shelf?.primary.color ?? theme.colors.primaryPressed;
    return (
      <View style={styles.bottomRow}>
        {leading}
        <Pressable
          accessibilityHint={t('rating.reveal_hint')}
          accessibilityLabel={t('rating.reveal_a11y')}
          accessibilityRole="button"
          onPress={onReveal}
          style={({pressed}) => [
            styles.revealButton,
            {backgroundColor: theme.colors.primary},
            pressed
              ? {transform: [{translateY: 3}], ...getStickerEdge(2, revealEdge)}
              : getStickerEdge(5, revealEdge),
          ]}
          testID="rating-reveal"
        >
          <MaterialIcon
            color={theme.colors.text.inverse}
            name="visibility"
            size={22}
          />
          <AppText
            style={[styles.revealLabel, {color: theme.colors.text.inverse}]}
          >
            {t('rating.reveal_label')}
          </AppText>
        </Pressable>
      </View>
    );
  }
  const skipEdge = theme.shelf?.secondary.color ?? theme.colors.outlineVariant;

  return (
    <View style={styles.container}>
      {RATING_OPTIONS.map(option => {
        const tone = ratingTone(theme, option.rating, disabled);
        return (
          <Pressable
            accessibilityLabel={t(option.accessibilityKey)}
            accessibilityRole="button"
            accessibilityState={{disabled}}
            disabled={disabled}
            key={option.rating}
            onPress={() => onRate(option.rating)}
            style={[
              styles.button,
              {backgroundColor: tone.background, borderColor: tone.border},
              getStickerEdge(5, tone.edge),
            ]}
            testID={`rating-${option.rating}`}
          >
            <View style={styles.buttonTitle}>
              <MaterialIcon color={tone.ink} name={option.icon} size={22} />
              <AppText style={{color: tone.ink}} variant="label">
                {t(option.labelKey)}
              </AppText>
            </View>
            <AppText style={{color: tone.ink}} variant="caption">
              {t(option.hintKey)}
            </AppText>
          </Pressable>
        );
      })}

      <View style={styles.bottomRow}>
        {leading}
        <Pressable
          accessibilityLabel={t('rating.skip_a11y')}
          accessibilityRole="button"
          accessibilityState={{disabled}}
          disabled={disabled}
          onPress={onSkip}
          style={[
            styles.skipButton,
            {
              // SETE-254: readable-disabled treatment (muted fill, no opacity wash).
              backgroundColor: disabled
                ? theme.colors.surfaceMuted
                : theme.colors.surface,
            },
            getStickerEdge(5, skipEdge),
          ]}
          testID="rating-skip"
        >
          <AppText color="secondary" variant="label">
            {t('rating.skip_label')}
          </AppText>
          <MaterialIcon
            color={theme.colors.text.secondary}
            name="chevron_right"
            size={18}
          />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 2,
    flexBasis: '46%',
    flexGrow: 1,
    gap: 2,
    justifyContent: 'center',
    minHeight: 72,
    paddingHorizontal: 8,
    paddingVertical: 10,
  },
  buttonTitle: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  // The listen buttons, then the row's pill.
  bottomRow: {
    alignItems: 'center',
    flexBasis: '100%',
    flexDirection: 'row',
    gap: 12,
  },
  // Sticker pill like StickerButton.
  revealButton: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  revealLabel: {
    fontSize: 16,
    fontWeight: '800',
  },
  skipButton: {
    alignItems: 'center',
    borderRadius: 999,
    flex: 1,
    flexDirection: 'row',
    gap: 2,
    justifyContent: 'center',
    minHeight: 52,
  },
});
