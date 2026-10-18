import React, {useCallback, useMemo, useState} from 'react';
import {StyleSheet, View} from 'react-native';

import {AppSwitch} from '@ui/components/AppSwitch';
import {AppText} from '@ui/components/AppText';
import {ProfileSettingsRow} from '@ui/components/ProfileSettingsRow';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {
  isPronunciationConsentOn,
  setPronunciationConsent,
} from '../logic/upload/recordingConsent';

/**
 * Pronunciation step 3: switch the consent to send pronunciation readings
 * to Microsoft Azure Speech for scoring. Nothing waits on the device for
 * this consent (a reading is sent at once or not at all), so turning it off
 * has nothing to drop.
 */
export function PronunciationSettingsRow() {
  const {theme} = useAppTheme();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const [on, setOn] = useState(() => isPronunciationConsentOn());

  const handleToggle = useCallback((next: boolean) => {
    setPronunciationConsent(next ? 'on' : 'off');
    setOn(next);
  }, []);

  return (
    <View testID="pronunciation-settings">
      <ProfileSettingsRow
        accessibilityHint="Gửi giọng đọc tới Microsoft Azure Speech để chấm phát âm"
        accessibilityLabel="Chấm phát âm bằng máy"
        icon="mic"
        label="Chấm phát âm bằng máy"
        medallionTone="teal"
        trailing={{text: on ? 'Bật' : 'Tắt'}}
      />
      <View style={themedStyles.row}>
        <AppText color="secondary" style={themedStyles.flex} variant="caption">
          Gửi giọng đọc ở phần Luyện phát âm tới Microsoft Azure Speech để chấm.
          Bản ghi bị xoá ngay sau khi chấm, chỉ giữ lại điểm.
        </AppText>
        <AppSwitch
          accessibilityHint="Bật hoặc tắt chấm phát âm bằng máy"
          accessibilityLabel="Chấm phát âm bằng máy"
          onValueChange={handleToggle}
          testID="pronunciation-settings-switch"
          value={on}
        />
      </View>
    </View>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    flex: {
      flex: 1,
    },
    row: {
      alignItems: 'center',
      flexDirection: 'row',
      gap: theme.spacing.sm,
      paddingHorizontal: theme.spacing.lg,
      paddingVertical: theme.spacing.sm,
    },
  });
}
