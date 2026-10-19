import React from 'react';
import {useTranslation} from 'react-i18next';
import {StyleSheet, View} from 'react-native';

import {ActionIconButton, type ActionIconSize} from './ActionIconButton';

/** Text-to-speech rate of "Nghe chậm" (the default rate is 0.5). */
export const SLOW_TTS_RATE = 0.3;

type Props = {
  /** Reads the model at the normal rate. */
  onListen: () => void;
  /** Reads it slowly (`SLOW_TTS_RATE`); omitted = no slow button. */
  onListenSlow?: () => void;
  /** `bar` in a screen's bottom row, `row` inside a card or prompt. */
  size?: Extract<ActionIconSize, 'row' | 'bar'>;
  /** White faces, for buttons on a bright card. */
  onTint?: boolean;
  /** Prefix of the testIDs: `<testID>` and `<testID>-slow`. */
  testID?: string;
};

/**
 * The app's one pair of listen buttons: a speaker, and the same speaker
 * with "0.5×" for the slow reading, so "slow" reads at a glance everywhere
 * (word cards, practice panels, listen-and-repeat).
 */
export function ListenButtons({
  onListen,
  onListenSlow,
  size = 'bar',
  onTint = false,
  testID = 'listen',
}: Props) {
  const {t} = useTranslation();
  return (
    <View style={styles.row}>
      <ActionIconButton
        accessibilityHint={t('listen.normal_hint')}
        accessibilityLabel={t('listen.normal')}
        icon="volume_up"
        onPress={onListen}
        onTint={onTint}
        size={size}
        testID={testID}
      />
      {onListenSlow ? (
        <ActionIconButton
          accessibilityHint={t('listen.slow_hint')}
          accessibilityLabel={t('listen.slow')}
          icon="volume_up"
          label={t('listen.slow_badge')}
          onPress={onListenSlow}
          onTint={onTint}
          size={size}
          testID={`${testID}-slow`}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: 10,
  },
});
