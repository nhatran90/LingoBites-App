import React, {useMemo} from 'react';
import {Pressable, StyleSheet, View} from 'react-native';

import {InterlinearSentence} from '@features/lesson/player';

import {ActionIconButton} from '@ui/components/ActionIconButton';
import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {withAlpha} from '@ui/components/layout';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import type {HandoffIconName} from '@ui/icons/iconRegistry';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';
import {HERO_PALETTE} from '@ui/theme/heroPalette';

import type {ShadowingSentence} from '../../logic/shadowing/shadowingLessons';

export type ShadowingSamplePlayback = 'normal' | 'slow' | null;

export type SentenceCardProps = {
  sentence: ShadowingSentence;
  /** Grey out the sample buttons (while recording). */
  samplesDisabled: boolean;
  onPlayNormal: () => void;
  onPlaySlow: () => void;
  /** Which sample is playing, so its button fills in. */
  playing?: ShadowingSamplePlayback;
  /** Words lit so far while a sample plays (-1: none). */
  highlightedWords?: number;
  showVietnamese?: boolean;
  onToggleVietnamese?: () => void;
  /** After recording: only the English sentence, smaller. */
  compact?: boolean;
};

/**
 * The sentence to shadow: English with each word's IPA under it, the Vietnamese
 * meaning (which the learner can hide) and the "Nghe mẫu" / "Nghe chậm"
 * buttons. While a sample plays, its words light up one by one.
 */
export function SentenceCard({
  sentence,
  samplesDisabled,
  onPlayNormal,
  onPlaySlow,
  playing = null,
  highlightedWords = -1,
  showVietnamese = true,
  onToggleVietnamese,
  compact = false,
}: SentenceCardProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  return (
    <AppCard testID="shadowing-sentence-card">
      <View style={compact ? styles.bodyCompact : styles.body}>
        <InterlinearSentence
          accessibilityHint="Câu cần nói theo"
          hideIpa={compact}
          highlightedWords={highlightedWords}
          ipa={sentence.ipa}
          litStyle={styles.lit}
          testID="shadowing-text-en"
          text={sentence.textEn}
          wordStyle={[styles.en, compact && styles.enCompact]}
        />
        {!compact ? (
          <>
            <View style={styles.divider} />
            {showVietnamese ? (
              <AppText color="secondary" testID="shadowing-text-vi">
                {sentence.textVi}
              </AppText>
            ) : (
              <Pressable
                accessibilityRole="button"
                onPress={onToggleVietnamese}
                testID="shadowing-text-vi-hidden"
              >
                <AppText color="muted" style={styles.hiddenVi}>
                  Nghĩa tiếng Việt đang ẩn · chạm để hiện
                </AppText>
              </Pressable>
            )}
            <View style={styles.controls}>
              <SampleButton
                active={playing === 'normal'}
                disabled={samplesDisabled}
                icon="play_arrow"
                label={playing === 'normal' ? 'Đang phát' : 'Nghe mẫu'}
                onPress={onPlayNormal}
                testID="shadowing-play-normal"
                tone="mint"
              />
              <SampleButton
                active={playing === 'slow'}
                disabled={samplesDisabled}
                icon="hearing"
                label={playing === 'slow' ? 'Đang phát' : 'Nghe chậm'}
                onPress={onPlaySlow}
                testID="shadowing-play-slow"
                tone="sun"
              />
              <View style={styles.spacer} />
              {onToggleVietnamese ? (
                <ActionIconButton
                  accessibilityHint="Che nghĩa để luyện nghe không nhìn bản dịch"
                  accessibilityLabel={
                    showVietnamese
                      ? 'Ẩn nghĩa tiếng Việt'
                      : 'Hiện nghĩa tiếng Việt'
                  }
                  icon="visibility"
                  onPress={onToggleVietnamese}
                  selected={!showVietnamese}
                  testID="shadowing-toggle-vi"
                />
              ) : null}
            </View>
          </>
        ) : null}
      </View>
    </AppCard>
  );
}

type SampleButtonProps = {
  label: string;
  icon: HandoffIconName;
  tone: 'mint' | 'sun';
  active: boolean;
  disabled: boolean;
  onPress: () => void;
  testID: string;
};

function SampleButton({
  label,
  icon,
  tone,
  active,
  disabled,
  onPress,
  testID,
}: SampleButtonProps) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const look =
    tone === 'mint'
      ? active
        ? styles.mintOn
        : styles.mint
      : active
        ? styles.sunOn
        : styles.sun;
  const ink =
    tone === 'mint'
      ? active
        ? HERO_PALETTE.white
        : theme.colors.primary
      : active
        ? HERO_PALETTE.ink
        : theme.colors.onTertiaryContainer;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{disabled, busy: active}}
      disabled={disabled}
      onPress={onPress}
      style={({pressed}) => [
        styles.sample,
        look,
        disabled && {opacity: theme.states.disabledOpacity},
        pressed && styles.samplePressed,
      ]}
      testID={testID}
    >
      <MaterialIcon color={ink} name={icon} size={18} />
      <AppText style={[styles.sampleLabel, {color: ink}]}>{label}</AppText>
    </Pressable>
  );
}

function makeStyles(theme: AppTheme) {
  const mintEdge = withAlpha(theme.colors.primaryContainer, 0.45);
  return StyleSheet.create({
    body: {
      gap: theme.spacing.md,
    },
    bodyCompact: {
      gap: theme.spacing.sm,
    },
    en: {
      color: theme.colors.text.primary,
      fontSize: 22,
      fontWeight: '800',
      lineHeight: 29,
    },
    enCompact: {
      fontSize: 18,
      lineHeight: 24,
    },
    lit: {
      color: theme.colors.primary,
    },
    divider: {
      backgroundColor: theme.colors.surfaceHigh,
      height: StyleSheet.hairlineWidth * 2,
    },
    hiddenVi: {
      fontStyle: 'italic',
    },
    controls: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
    },
    spacer: {
      flex: 1,
    },
    sample: {
      alignItems: 'center',
      borderRadius: 14,
      flexDirection: 'row',
      gap: 6,
      minHeight: 44,
      paddingHorizontal: 14,
    },
    samplePressed: {
      transform: [{translateY: 2}],
    },
    sampleLabel: {
      fontSize: 14,
      fontWeight: '800',
    },
    mint: {
      backgroundColor: theme.colors.accentSoft,
      ...getStickerEdge(3, mintEdge),
    },
    mintOn: {
      backgroundColor: theme.colors.primary,
      ...getStickerEdge(3, theme.colors.primaryPressed),
    },
    sun: {
      backgroundColor: theme.colors.tertiarySoft,
      ...getStickerEdge(3, theme.colors.tertiaryBorder),
    },
    sunOn: {
      backgroundColor: HERO_PALETTE.sun,
      ...getStickerEdge(3, HERO_PALETTE.sunShelf),
    },
  });
}
