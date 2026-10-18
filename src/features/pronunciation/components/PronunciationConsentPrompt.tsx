import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {AppButton} from '@ui/components/AppButton';
import {AppText} from '@ui/components/AppText';
import {MaterialIcon} from '@ui/components/MaterialIcon';
import {type AppTheme, useAppTheme} from '@ui/theme';

/**
 * Pronunciation step 3: asked before the first take. It names Microsoft
 * Azure Speech and says the audio is deleted once scored; "Để sau" keeps
 * the model reading and asks again in 7 days.
 */
export function PronunciationConsentPrompt({
  onAnswer,
}: {
  onAnswer: (agreed: boolean) => void;
}) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <View style={themedStyles.box} testID="pronunciation-consent">
      <View style={themedStyles.title}>
        <MaterialIcon color={theme.colors.primary} name="lock" size={18} />
        <AppText variant="label">{t('pronunciation.consent_title')}</AppText>
      </View>
      <AppText color="secondary">{t('pronunciation.consent_body')}</AppText>
      <View style={themedStyles.row}>
        <AppButton
          accessibilityHint={t('pronunciation.consent_agree')}
          onPress={() => onAnswer(true)}
          testID="pronunciation-consent-agree"
          title={t('pronunciation.consent_agree')}
        />
        <AppButton
          accessibilityHint={t('pronunciation.consent_later')}
          onPress={() => onAnswer(false)}
          testID="pronunciation-consent-later"
          title={t('pronunciation.consent_later')}
          variant="outline"
        />
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    box: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      gap: theme.spacing.sm,
      padding: theme.spacing.md,
    },
    title: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.xs,
    },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: theme.spacing.sm,
    },
  });
}
