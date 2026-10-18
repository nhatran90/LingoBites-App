import React, {
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import {Alert, ScrollView, StyleSheet, View} from 'react-native';
import {SafeAreaInsetsContext} from 'react-native-safe-area-context';

import {SpeechNotice} from '@features/audio';
import {recordShadowingSessionActivity} from '@features/engagement';

import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {HeaderIconButton} from '@ui/components/HeaderIconButton';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {StickerButton} from '@ui/components/StickerButton';
import {StickerFooter} from '@ui/components/StickerFooter';
import {SessionHeader, SessionSteps} from '@ui/components/StudySession';
import {useAppTheme} from '@ui/theme';

import {ConsentSheet} from '../components/shadowing/ConsentSheet';
import {RecorderPanel} from '../components/shadowing/RecorderPanel';
import {SelfCheckList} from '../components/shadowing/SelfCheckList';
import {SentenceCard} from '../components/shadowing/SentenceCard';
import {applyRecordingUploadConsent} from '../components/SpeakingRecordingsSettingsRow';
import {requestMicrophonePermission} from '../logic/recordingService';
import type {ShadowingSentence} from '../logic/shadowing/shadowingLessons';
import {
  formatShadowingElapsed,
  useShadowingSession,
} from '../logic/shadowing/useShadowingSession';
import {
  isRecordingUploadConsentOn,
  readRecordingUploadConsent,
} from '../logic/upload/recordingConsent';
import type {
  ShadowingSessionRouteParams,
  ShadowingSummaryRouteParams,
} from './navigationTypes';

export type ShadowingSessionScreenProps = {
  navigation: {
    goBack: () => void;
    navigate: (
      screen: 'ShadowingSummary',
      params: ShadowingSummaryRouteParams,
    ) => void;
  };
  route: {
    params: ShadowingSessionRouteParams;
  };
};

export function ShadowingSessionScreen({
  navigation,
  route,
}: ShadowingSessionScreenProps) {
  const {theme} = useAppTheme();
  const floatingClearance = useFloatingTabBarClearance();
  // The mic dock runs under the home indicator, so it pads the bottom inset
  // itself. Read from context so renders without a provider (Jest) get 0.
  const bottomInset = useContext(SafeAreaInsetsContext)?.bottom ?? 0;
  const lessonId = route.params.lessonId;
  const initialSentenceIndex = route.params.sentenceIndex ?? 0;

  const [consentVisible, setConsentVisible] = useState(false);
  const [showVietnamese, setShowVietnamese] = useState(true);
  const playback = useEstimatedPlayback();

  const session = useShadowingSession({
    lessonId,
    initialSentenceIndex,
    onSessionComplete: summary => {
      recordShadowingSessionActivity(summary.lessonId);
      navigation.navigate('ShadowingSummary', summary);
    },
  });

  const runSave = useCallback(() => {
    session.saveAndContinue().catch(() => undefined);
  }, [session]);

  const handleSavePress = useCallback(() => {
    if (readRecordingUploadConsent() === 'undecided') {
      setConsentVisible(true);
      return;
    }
    runSave();
  }, [runSave]);

  const handleConsentUploadOn = useCallback(() => {
    applyRecordingUploadConsent('on');
    setConsentVisible(false);
    runSave();
  }, [runSave]);

  const handleConsentLocalOnly = useCallback(() => {
    applyRecordingUploadConsent('off');
    setConsentVisible(false);
    runSave();
  }, [runSave]);

  useEffect(() => {
    requestMicrophonePermission();
  }, []);

  const stopPlayback = playback.stop;
  const sentenceId = session.sentence?.id;
  useEffect(() => {
    stopPlayback();
  }, [sentenceId, stopPlayback]);

  const exitWithoutConfirm = useCallback(() => {
    navigation.goBack();
  }, [navigation]);

  const handleClose = useCallback(() => {
    if (!session.hasUnsavedProgress) {
      exitWithoutConfirm();
      return;
    }
    Alert.alert(
      'Thoát buổi luyện nói?',
      'Bản ghi chưa lưu sẽ bị xóa. Các câu đã lưu vẫn được giữ.',
      [
        {text: 'Huỷ', style: 'cancel'},
        {
          text: 'Thoát',
          style: 'destructive',
          onPress: () => {
            session
              .discardUnsavedTake()
              .finally(exitWithoutConfirm)
              .catch(() => undefined);
          },
        },
      ],
    );
  }, [exitWithoutConfirm, session]);

  const closeAction = (
    <HeaderIconButton
      accessibilityLabel="Đóng buổi luyện nói"
      icon="close"
      onPress={handleClose}
      testID="shadowing-close"
    />
  );

  if (!session.lesson || !session.sentence) {
    return (
      <AppScreen>
        <ScreenHeader rightAction={closeAction} title="Lặp lại theo mẫu" />
        <View style={{padding: theme.gutter}}>
          <AppText color="secondary">
            Chưa có nội dung lặp lại theo mẫu cho bài này.
          </AppText>
        </View>
      </AppScreen>
    );
  }

  const sentence = session.sentence;
  const showRecorder =
    session.sessionState === 'idle' || session.sessionState === 'recording';
  const showReview =
    session.sessionState === 'recorded' || session.sessionState === 'saving';
  const saving = session.sessionState === 'saving';
  const isLastSentence = session.sentenceIndex >= session.sentenceCount - 1;
  const myTakeLabel = session.take
    ? formatShadowingElapsed(session.take.durationMs)
    : '0:00';
  const step = showReview ? 2 : session.sessionState === 'recording' ? 1 : 0;

  const stopUnlessPlayed = (played: boolean) => {
    if (!played) playback.stop();
  };

  return (
    <AppScreen edges={showRecorder ? SCREEN_EDGES_ABOVE_DOCK : undefined}>
      <SessionHeader
        closeHint="Thoát buổi luyện nói"
        closeLabel="Đóng buổi luyện nói"
        closeTestID="shadowing-close"
        current={session.sentenceIndex + 1}
        onClose={handleClose}
        progressLabel={`Câu ${session.sentenceIndex + 1}/${session.sentenceCount}`}
        total={session.sentenceCount}
      />
      <ScrollView
        contentContainerStyle={{
          gap: theme.spacing.md,
          paddingBottom: theme.spacing.lg,
          paddingHorizontal: theme.gutter,
          paddingTop: theme.spacing.sm,
        }}
        showsVerticalScrollIndicator={false}
        style={styles.flex1}
      >
        <SessionSteps active={step} labels={SHADOWING_STEPS} />
        <SpeechNotice
          notice={session.speechNotice}
          testID="shadowing-speech-notice"
        />
        <SentenceCard
          compact={showReview}
          highlightedWords={
            playback.kind === 'normal' || playback.kind === 'slow'
              ? Math.floor(playback.progress * sentenceWordCount(sentence))
              : -1
          }
          onPlayNormal={() => {
            playback.start('normal', estimateSampleMs(sentence, 1));
            session.playNormalSample().then(stopUnlessPlayed, () => {
              playback.stop();
              Alert.alert('Âm thanh mẫu', 'Không thể phát âm thanh mẫu.');
            });
          }}
          onPlaySlow={() => {
            playback.start(
              'slow',
              estimateSampleMs(sentence, SLOW_SAMPLE_STRETCH),
            );
            session.playSlowSample().then(stopUnlessPlayed, () => {
              playback.stop();
              Alert.alert('Âm thanh mẫu', 'Không thể phát âm thanh mẫu.');
            });
          }}
          onToggleVietnamese={() => setShowVietnamese(value => !value)}
          playing={
            playback.kind === 'normal' || playback.kind === 'slow'
              ? playback.kind
              : null
          }
          samplesDisabled={session.sessionState === 'recording'}
          sentence={sentence}
          showVietnamese={showVietnamese}
        />

        {showReview ? (
          <SelfCheckList
            myTakeLabel={myTakeLabel}
            onPlayMyTake={() => {
              playback.start('mine', session.take?.durationMs ?? 0);
              session.playMyTake().catch(() => playback.stop());
            }}
            onPlaySample={() => {
              playback.start('sample', estimateSampleMs(sentence, 1));
              session
                .playNormalSample()
                .then(stopUnlessPlayed, () => playback.stop());
            }}
            onReRecord={() => {
              playback.stop();
              session.reRecord().catch(() => undefined);
            }}
            onToggle={key => {
              session.setSelfCheckItem(key, !session.selfCheck[key]);
            }}
            playProgress={playback.progress}
            playing={
              playback.kind === 'sample' || playback.kind === 'mine'
                ? playback.kind
                : null
            }
            values={session.selfCheck}
          />
        ) : null}
      </ScrollView>

      {showRecorder ? (
        <View
          style={{
            backgroundColor: theme.colors.surface,
            paddingBottom: bottomInset,
          }}
        >
          <RecorderPanel
            elapsedMs={session.elapsedMs}
            onSkip={
              session.sessionState === 'idle' ? session.skipSentence : undefined
            }
            onStart={() => {
              playback.stop();
              session.startRecordingTake().catch(() => undefined);
            }}
            onStop={() => {
              session.stopRecordingTake().catch(() => undefined);
            }}
            sessionState={session.sessionState}
          />
        </View>
      ) : null}

      {showReview ? (
        <StickerFooter
          bottomInset={Math.max(floatingClearance, theme.spacing.lg)}
          note={
            isRecordingUploadConsentOn()
              ? 'Bản ghi sẽ được lưu lên tài khoản khi có mạng'
              : 'Không bắt buộc tick. Bản ghi được lưu trên máy.'
          }
        >
          <StickerButton
            disabled={saving}
            label={
              saving
                ? 'Đang lưu…'
                : isLastSentence
                  ? 'Lưu & xem tóm tắt'
                  : 'Lưu & câu tiếp'
            }
            onPress={() => {
              playback.stop();
              handleSavePress();
            }}
            testID="shadowing-save-continue"
          />
        </StickerFooter>
      ) : null}
      <ConsentSheet
        onChooseLocalOnly={handleConsentLocalOnly}
        onChooseUploadOn={handleConsentUploadOn}
        onDismiss={() => setConsentVisible(false)}
        visible={consentVisible}
      />
    </AppScreen>
  );
}

const SHADOWING_STEPS = ['Nghe', 'Nói', 'Tự chấm'];

/** Rough TTS pace; the TTS module reports no end of speech. */
const SAMPLE_MS_PER_WORD = 330;
const SAMPLE_MS_LEAD = 400;
/** "Nghe chậm" speaks at 0.3 against the default 0.5. */
const SLOW_SAMPLE_STRETCH = 1.8;
const PLAYBACK_TICK_MS = 100;

type PlaybackKind = 'normal' | 'slow' | 'sample' | 'mine';

function sentenceWordCount(sentence: ShadowingSentence): number {
  return sentence.textEn.split(' ').length;
}

function estimateSampleMs(sentence: ShadowingSentence, stretch: number) {
  return (
    (SAMPLE_MS_LEAD + sentenceWordCount(sentence) * SAMPLE_MS_PER_WORD) *
    stretch
  );
}

/**
 * Which sample or take is playing and how far along (0..1). Neither TTS nor
 * the recorder player reports progress, so this runs on the expected length
 * and only drives the lit words and wave fill.
 */
function useEstimatedPlayback() {
  const [kind, setKind] = useState<PlaybackKind | null>(null);
  const [progress, setProgress] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const stop = useCallback(() => {
    if (timer.current) {
      clearInterval(timer.current);
      timer.current = null;
    }
    setKind(null);
    setProgress(0);
  }, []);

  const start = useCallback(
    (next: PlaybackKind, durationMs: number) => {
      stop();
      if (durationMs <= 0) {
        return;
      }
      const startedAt = Date.now();
      setKind(next);
      timer.current = setInterval(() => {
        const share = (Date.now() - startedAt) / durationMs;
        if (share >= 1) {
          stop();
          return;
        }
        setProgress(share);
      }, PLAYBACK_TICK_MS);
    },
    [stop],
  );

  useEffect(() => stop, [stop]);

  return {kind, progress, start, stop};
}

const SCREEN_EDGES_ABOVE_DOCK = ['top', 'left', 'right'] as const;

const styles = StyleSheet.create({
  flex1: {
    flex: 1,
  },
});
