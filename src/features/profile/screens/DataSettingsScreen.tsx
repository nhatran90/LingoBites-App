import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React from 'react';
import {Alert, Modal, StyleSheet, View} from 'react-native';

import {withdrawPhotoConsent} from '@features/input';
import {usePronunciationAvailable} from '@features/pronunciation';
import {
  PronunciationSettingsRow,
  readPronunciationConsent,
  SpeakingRecordingsSettingsRow,
  SpeechGradingSettingsRow,
} from '@features/speaking';

import {AppButton} from '@ui/components/AppButton';
import {AppCard} from '@ui/components/AppCard';
import {AppText} from '@ui/components/AppText';
import {ProfileSettingsRow} from '@ui/components/ProfileSettingsRow';
import {SettingsGroup} from '@ui/components/SettingsGroup';
import {TextField} from '@ui/components/TextField';
import {useAppTheme} from '@ui/theme';

import {OfflineStudySettingsGroup} from '../components/OfflineStudySettingsGroup';
import {ProfileSubpage} from '../components/ProfileSubpage';
import {useDataSettings} from '../logic/useDataSettings';
import type {ProfileStackParamList} from './navigationTypes';

type Props = NativeStackScreenProps<ProfileStackParamList, 'DataSettings'>;

/**
 * Offline audio, offline study downloads, speaking recordings and local-data
 * deletion.
 */
export function DataSettingsScreen({navigation}: Props) {
  const {theme} = useAppTheme();
  // Pronunciation step 3: shown where scoring is offered, and always once
  // the learner said yes, so the consent can be withdrawn.
  const pronunciationAvailable = usePronunciationAvailable();
  const showPronunciation =
    pronunciationAvailable || readPronunciationConsent() === 'on';
  const handleWithdrawPhotoConsent = () => {
    Alert.alert(
      'Rút đồng ý gửi ảnh?',
      'Ảnh bạn chụp sẽ không được gửi đi cho đến khi bạn đồng ý lại.',
      [
        {text: 'Hủy', style: 'cancel'},
        {
          text: 'Rút đồng ý',
          style: 'destructive',
          onPress: () => {
            withdrawPhotoConsent();
          },
        },
      ],
    );
  };
  const {
    audioCacheTrailingLabel,
    clearDataConfirmText,
    confirmClearData,
    dismissClearDataModal,
    handleClearSpeakingData,
    handlePlayCachedAudio,
    hideClearDataModal,
    isClearDataModalVisible,
    openClearDataModal,
    setClearDataConfirmText,
    statusMessage,
  } = useDataSettings();

  return (
    <ProfileSubpage
      onBack={() => navigation.goBack()}
      statusMessage={statusMessage}
      title="Dữ liệu & bộ nhớ"
    >
      <SettingsGroup title="Âm thanh">
        <ProfileSettingsRow
          accessibilityHint="Chạm để thay đổi"
          accessibilityLabel="Dung lượng âm thanh chương học đã tải về máy — bấm để nghe thử clip đã tải"
          icon="volume_up"
          label="Âm thanh chương học"
          medallionTone="teal"
          onPress={handlePlayCachedAudio}
          trailing={{text: audioCacheTrailingLabel}}
        />
      </SettingsGroup>

      <OfflineStudySettingsGroup
        onOpenDownloads={() => navigation.navigate('OfflineDownloads')}
      />

      <SettingsGroup title="Ảnh gửi đi">
        <View>
          <ProfileSettingsRow
            accessibilityHint="Chạm để rút đồng ý"
            accessibilityLabel="Rút đồng ý gửi ảnh để phân tích"
            icon="photo_camera"
            label="Rút đồng ý gửi ảnh"
            onPress={handleWithdrawPhotoConsent}
            trailing="chevron"
          />
          <AppText
            color="secondary"
            style={[styles.caption, {paddingBottom: theme.spacing.sm}]}
            variant="caption"
          >
            Lần sau bạn chụp ảnh sẽ được hỏi lại trước khi ảnh được gửi đi.
          </AppText>
        </View>
      </SettingsGroup>

      <SettingsGroup title="Bản ghi giọng nói">
        <SpeakingRecordingsSettingsRow />
        <SpeechGradingSettingsRow />
        {showPronunciation ? <PronunciationSettingsRow /> : null}
      </SettingsGroup>

      <SettingsGroup title="Vùng nguy hiểm">
        <View>
          <ProfileSettingsRow
            accessibilityHint="Chạm để xóa dữ liệu"
            accessibilityLabel="Xóa dữ liệu luyện nói"
            destructive
            icon="delete"
            label="Xóa dữ liệu luyện nói & ghi âm"
            onPress={handleClearSpeakingData}
            trailing="chevron"
          />
          <AppText
            color="secondary"
            style={[styles.caption, {paddingBottom: theme.spacing.sm}]}
            variant="caption"
          >
            Xóa toàn bộ bản ghi âm và lịch sử luyện nói. Không thể khôi phục.
          </AppText>
        </View>
        <View>
          <ProfileSettingsRow
            accessibilityHint="Chạm để xóa dữ liệu"
            accessibilityLabel="Xóa dữ liệu học trên máy"
            destructive
            icon="delete"
            label="Xóa dữ liệu học trên máy"
            onPress={openClearDataModal}
            trailing="chevron"
          />
          <AppText
            color="secondary"
            style={[styles.caption, {paddingBottom: theme.spacing.sm}]}
            variant="caption"
          >
            Xóa toàn bộ tiến trình học, XP, và lịch sử. Không thể khôi phục.
          </AppText>
        </View>
      </SettingsGroup>

      <Modal
        animationType="fade"
        transparent
        visible={isClearDataModalVisible}
        onRequestClose={hideClearDataModal}
      >
        <View
          style={[
            styles.modalOverlay,
            {
              backgroundColor: theme.colors.overlay,
              padding: theme.spacing.xl,
            },
          ]}
        >
          <AppCard style={{gap: theme.spacing.sm, padding: theme.spacing.lg}}>
            <AppText style={styles.mb8} variant="h2">
              Xóa dữ liệu học trên máy
            </AppText>
            <AppText color="secondary" style={styles.mb16}>
              Hành động này sẽ xóa toàn bộ tiến trình học, XP, và lịch sử. Không
              thể khôi phục.
            </AppText>
            <AppText style={styles.mb8}>
              Nhập chữ <AppText style={styles.bold}>XOA</AppText> để xác nhận:
            </AppText>
            <TextField
              autoCapitalize="characters"
              onChangeText={setClearDataConfirmText}
              placeholder="XOA"
              value={clearDataConfirmText}
            />
            <View
              style={[
                styles.modalActions,
                {gap: theme.spacing.md, marginTop: theme.spacing.md},
              ]}
            >
              <AppButton
                onPress={dismissClearDataModal}
                style={styles.flex1}
                title="Hủy"
                variant="secondary"
              />
              <AppButton
                disabled={clearDataConfirmText !== 'XOA'}
                onPress={confirmClearData}
                style={styles.flex1}
                title="Xóa"
                variant="danger"
              />
            </View>
          </AppCard>
        </View>
      </Modal>
    </ProfileSubpage>
  );
}

const styles = StyleSheet.create({
  bold: {
    fontWeight: 'bold',
  },
  caption: {
    paddingHorizontal: 16,
  },
  flex1: {
    flex: 1,
  },
  mb16: {
    marginBottom: 16,
  },
  mb8: {
    marginBottom: 8,
  },
  modalActions: {
    flexDirection: 'row',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
  },
});
