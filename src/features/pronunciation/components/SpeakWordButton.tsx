import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';

import {isSentence} from '../logic/readingTarget';

type Props = {
  /** The card's word or sentence: a sentence reads "Nói câu". */
  text: string;
  /**
   * The learner has not turned on "Chấm phát âm bằng máy": the button is
   * dimmed, says so, and `onPress` opens Settings instead.
   */
  locked: boolean;
  onPress: () => void;
  testID?: string;
};

/**
 * "Nói từ" / "Nói câu" under a pack or review card, beside "Viết từ" and
 * in the same sticker look (a light face on a hard edge with a microphone
 * tile). Locked, it turns grey with a lock and a yellow notice below; the
 * whole button stays pressable and leads to Settings.
 */
export function SpeakWordButton({text, locked, onPress, testID}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const label = t(
    isSentence(text) ? 'speakWord.button_sentence' : 'speakWord.button',
  );
  const {colors} = theme;

  return (
    <Pressable
      accessibilityHint={t(
        locked ? 'speakWord.locked_hint' : 'speakWord.button_hint',
      )}
      accessibilityLabel={
        locked ? `${label}. ${t('speakWord.locked_notice')}` : label
      }
      accessibilityRole="button"
      onPress={onPress}
      style={({pressed}) => [
        styles.button,
        locked ? styles.lockedButton : null,
        pressed && styles.pressed,
      ]}
      testID={testID}
    >
      <View style={[styles.face, locked ? styles.lockedFace : null]}>
        <View style={[styles.bubble, locked ? styles.lockedBubble : null]}>
          <MaterialIcon color={colors.text.inverse} name="mic" size={22} />
        </View>
        <Text
          maxFontSizeMultiplier={1.3}
          style={[styles.label, locked ? styles.lockedLabel : null]}
        >
          {label}
        </Text>
        <MaterialIcon
          color={locked ? colors.outline : colors.primary}
          name={locked ? 'lock' : 'chevron_right'}
          size={24}
        />
      </View>
      {locked ? (
        <View style={styles.notice} testID={testID && `${testID}-locked`}>
          <MaterialIcon
            color={colors.onTertiaryContainer}
            name="warning"
            size={20}
          />
          <Text maxFontSizeMultiplier={1.3} style={styles.noticeText}>
            {t('speakWord.locked_notice')}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
}

function makeStyles(theme: AppTheme) {
  const {colors} = theme;
  return StyleSheet.create({
    button: {
      backgroundColor: colors.accentSoft,
      borderRadius: 20,
      overflow: 'hidden',
      ...getStickerEdge(4, colors.outlineVariant),
    },
    lockedButton: {
      backgroundColor: colors.surface,
    },
    face: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.md,
      minHeight: 56,
      paddingLeft: theme.spacing.sm,
      paddingRight: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    lockedFace: {
      backgroundColor: colors.surfaceHigh,
    },
    bubble: {
      alignItems: 'center',
      backgroundColor: colors.primary,
      borderRadius: 14,
      height: 40,
      justifyContent: 'center',
      width: 40,
      ...getStickerEdge(3, colors.primaryPressed),
    },
    lockedBubble: {
      backgroundColor: colors.outlineVariant,
      ...getStickerEdge(0, colors.outlineVariant),
    },
    label: {
      color: colors.primary,
      flex: 1,
      fontSize: 18,
      fontWeight: '800',
    },
    lockedLabel: {
      color: colors.outline,
    },
    notice: {
      alignItems: 'flex-start',
      backgroundColor: colors.tertiarySoft,
      flexDirection: 'row',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.md,
      paddingVertical: theme.spacing.sm,
    },
    noticeText: {
      color: colors.onTertiaryContainer,
      flex: 1,
      fontSize: 14,
      fontWeight: '700',
    },
    pressed: {
      transform: [{translateY: 2}],
      ...getStickerEdge(2, colors.outlineVariant),
    },
  });
}
