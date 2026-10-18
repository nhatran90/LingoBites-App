import React, {useMemo} from 'react';
import {useTranslation} from 'react-i18next';
import {ScrollView, StyleSheet, View} from 'react-native';

import {PronunciationSettingsRow} from '@features/speaking';

import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {SettingsGroup} from '@ui/components/SettingsGroup';
import {type AppTheme, useAppTheme} from '@ui/theme';

export type PronunciationSettingsRouteParams = undefined;

export interface PronunciationSettingsScreenProps {
  navigation: {goBack: () => void};
}

/**
 * Where a locked "Nói từ" button leads: the "Chấm phát âm bằng máy" switch
 * of Settings › Dữ liệu, highlighted, on the root stack so that going back
 * returns to the card the learner was on (the Profile tab's own copy would
 * drop the review). The button unlocks as soon as the switch turns on.
 *
 * IGNORE_TAB_BAR_CLEARANCE: a root-stack screen, drawn above the tab bar.
 */
export function PronunciationSettingsScreen({
  navigation,
}: PronunciationSettingsScreenProps) {
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  return (
    <AppScreen>
      <ScreenHeader
        onBack={() => navigation.goBack()}
        title={t('speakWord.settings_title')}
      />
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {paddingHorizontal: theme.gutter},
        ]}
      >
        <SettingsGroup title="Bản ghi giọng nói">
          <View style={styles.highlight} testID="pronunciation-settings-focus">
            <PronunciationSettingsRow />
          </View>
        </SettingsGroup>
        <AppText color="secondary" variant="caption">
          {t('speakWord.settings_body')}
        </AppText>
      </ScrollView>
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    content: {
      gap: theme.spacing.md,
      paddingBottom: theme.spacing.xxl,
    },
    highlight: {
      backgroundColor: theme.colors.tertiarySoft,
      borderColor: theme.colors.tertiaryContainer,
      borderRadius: theme.radius.md,
      borderWidth: 3,
    },
  });
}
