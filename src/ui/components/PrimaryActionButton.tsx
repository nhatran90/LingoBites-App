import React from 'react';
import {Pressable, type PressableProps} from 'react-native';

import {useAppTheme} from '../theme';
import {HERO_PALETTE} from '../theme/heroPalette';
import {AppText} from './AppText';
import {MaterialIcon} from './MaterialIcon';
import {SvgIcon} from './SvgIcon';

type Props = Pick<PressableProps, 'disabled' | 'onPress' | 'testID'> & {
  accessibilityHint?: string;
  accessibilityLabel: string;
  label: string;
  /** `coral`: the bright "learn" button of the hero cards, with a play icon. */
  tone?: 'primary' | 'coral';
};

export function PrimaryActionButton({
  accessibilityHint,
  accessibilityLabel,
  disabled = false,
  label,
  onPress,
  testID,
  tone = 'primary',
}: Props) {
  const {theme} = useAppTheme();
  const coral = tone === 'coral';

  return (
    <Pressable
      accessibilityHint={accessibilityHint}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="button"
      accessibilityState={{disabled: disabled ?? false}}
      disabled={disabled}
      onPress={onPress}
      testID={testID}
      style={({pressed}) => [
        {
          alignItems: 'center',
          backgroundColor: coral ? HERO_PALETTE.coral : theme.colors.primary,
          borderRadius: theme.radius.lg,
          borderBottomColor: coral
            ? HERO_PALETTE.coralShelf
            : theme.colors.primaryPressed,
          borderBottomWidth: pressed ? 1 : 4,
          flexDirection: 'row',
          gap: 8,
          justifyContent: 'center',
          minHeight: 52,
          opacity: disabled ? theme.states.disabledOpacity : 1,
        },
      ]}
    >
      {coral ? (
        <MaterialIcon color={HERO_PALETTE.white} name="play_arrow" size={22} />
      ) : (
        <SvgIcon
          color={theme.colors.text.inverse}
          name="auto_stories"
          size={22}
        />
      )}
      <AppText
        numberOfLines={1}
        style={{
          color: coral ? HERO_PALETTE.white : theme.colors.text.inverse,
          flexShrink: 1,
          fontSize: 18,
          fontWeight: coral ? '800' : '600',
        }}
      >
        {label}
      </AppText>
    </Pressable>
  );
}
