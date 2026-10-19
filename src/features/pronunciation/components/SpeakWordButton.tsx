import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {Pressable, StyleSheet, Text, View} from 'react-native';

import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';

type Props = {
  /** The card's word or sentence. */
  text: string;
  /**
   * The learner has not turned on "Chấm phát âm bằng máy": the button is
   * grey with a lock, says where to turn it on, and `onPress` opens Settings
   * instead.
   */
  locked: boolean;
  onPress: () => void;
  testID?: string;
};

/**
 * "Đọc từ" in a word card's practice row (`WordPracticeBar`), beside
 * "Viết từ" and in the same sticker look (a light face on a hard edge with
 * a microphone tile). Locked, it turns grey with a lock and a short
 * "Bật trong Cài đặt" line; the whole button stays pressable and leads to
 * Settings.
 */
export function SpeakWordButton({text, locked, onPress, testID}: Props) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const label = t('speakWord.button');
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
      accessibilityValue={{text}}
      onPress={onPress}
      style={({pressed}) => [
        styles.button,
        locked ? styles.lockedButton : null,
        pressed && (locked ? styles.lockedPressed : styles.pressed),
      ]}
      testID={testID}
    >
      <View style={[styles.bubble, locked ? styles.lockedBubble : null]}>
        <MaterialIcon
          color={locked ? colors.text.secondary : colors.text.inverse}
          name={locked ? 'lock' : 'mic'}
          size={20}
        />
      </View>
      <View style={styles.text}>
        <Text
          maxFontSizeMultiplier={1.3}
          numberOfLines={1}
          style={[styles.label, locked ? styles.lockedLabel : null]}
        >
          {label}
        </Text>
        {locked ? (
          <Text
            maxFontSizeMultiplier={1.3}
            numberOfLines={1}
            style={styles.notice}
            testID={testID && `${testID}-locked`}
          >
            {t('speakWord.locked_short')}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

function makeStyles(theme: AppTheme) {
  const {colors} = theme;
  const lockedEdge = theme.shelf?.secondary.color ?? colors.outlineVariant;
  return StyleSheet.create({
    button: {
      alignItems: 'center',
      backgroundColor: colors.accentSoft,
      borderRadius: 20,
      flex: 1,
      flexDirection: 'row',
      gap: theme.spacing.sm + 2,
      minHeight: 56,
      paddingHorizontal: theme.spacing.sm,
      ...getStickerEdge(4, colors.outlineVariant),
    },
    lockedButton: {
      backgroundColor: colors.surfaceContainer,
      ...getStickerEdge(4, lockedEdge),
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
      backgroundColor: colors.surface,
      ...getStickerEdge(3, lockedEdge),
    },
    text: {
      flex: 1,
    },
    label: {
      color: colors.primary,
      fontSize: 16,
      fontWeight: '800',
    },
    lockedLabel: {
      color: colors.text.secondary,
    },
    notice: {
      color: colors.text.secondary,
      fontSize: 12,
      fontWeight: '700',
    },
    pressed: {
      transform: [{translateY: 2}],
      ...getStickerEdge(2, colors.outlineVariant),
    },
    lockedPressed: {
      transform: [{translateY: 2}],
      ...getStickerEdge(2, lockedEdge),
    },
  });
}
