import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';

import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';
import {getStickerEdge} from '@ui/theme/hardShadow';

/** The situation a moment is about, shown above its wait and failure states. */
export function MomentSituationChip({
  title,
  centered = false,
}: {
  title: string;
  centered?: boolean;
}) {
  const {theme} = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View
      accessible
      style={[styles.chip, centered ? styles.centered : null]}
      testID="moment-situation-chip"
    >
      <MaterialIcon
        color={theme.colors.primary}
        name="record_voice_over"
        size={16}
      />
      <AppText numberOfLines={2} style={styles.text} variant="caption">
        {title}
      </AppText>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    chip: {
      alignItems: 'center',
      alignSelf: 'flex-start',
      backgroundColor: theme.colors.surface,
      borderRadius: theme.radius.pill,
      flexDirection: 'row',
      gap: 6,
      maxWidth: '100%',
      paddingLeft: 10,
      paddingRight: 14,
      paddingVertical: 7,
      ...getStickerEdge(2, theme.colors.surfaceHigh),
    },
    centered: {alignSelf: 'center'},
    text: {
      color: theme.colors.text.secondary,
      flexShrink: 1,
      fontWeight: '600',
    },
  });
}
