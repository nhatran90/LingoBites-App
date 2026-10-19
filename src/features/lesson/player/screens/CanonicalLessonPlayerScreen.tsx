import {useFocusEffect} from '@react-navigation/native';
import type {NativeStackScreenProps} from '@react-navigation/native-stack';
import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {useTranslation} from 'react-i18next';
import {Alert, ScrollView, StyleSheet, View} from 'react-native';

import {useSpeak} from '@features/audio';

import {AppButton} from '@ui/components/AppButton';
import {AppScreen} from '@ui/components/AppScreen';
import {AppText} from '@ui/components/AppText';
import {BottomActionBar} from '@ui/components/BottomActionBar';
import {HeaderIconButton} from '@ui/components/HeaderIconButton';
import {useFloatingTabBarClearance} from '@ui/components/layout';
import {PrimaryActionButton} from '@ui/components/PrimaryActionButton';
import {ScreenHeader} from '@ui/components/ScreenHeader';
import {type AppTheme, useAppTheme} from '@ui/theme';

import {useIsOffline} from '@core/api/connectivity';
import {useAppNavigation} from '@core/navigation';
import {useFeatureEnabled} from '@core/release';
import type {LessonAnalysis} from '@core/schemas/lesson';

import {
  hasLessonPracticeRun,
  isFlowLesson,
} from '../../flow/logic/practiceCompletion';
import {
  nextPracticeSegment,
  type PracticeSegmentView,
  practiceSegmentViews,
} from '../../flow/logic/practiceSegments';
import {useFlowEntry} from '../../flow/logic/useFlowEntry';
import {
  CanonicalLessonHub,
  type LessonHubSection,
  lessonSectionTitleKey,
} from '../components/CanonicalLessonHub';
import {CanonicalLessonPlayer} from '../components/CanonicalLessonPlayer';
import {ComposeSheet} from '../components/ComposeSheet';
import {LessonDisplayToggles} from '../components/LessonDisplayToggles';
import {LessonGrammarSection} from '../components/LessonGrammarSection';
import {LessonListeningSection} from '../components/LessonListeningSection';
import {LessonMediaDownloadCard} from '../components/LessonMediaDownloadCard';
import {LessonPatternSection} from '../components/LessonPatternSection';
import {LessonPlayerSkeleton} from '../components/LessonPlayerSkeleton';
import {LessonPronunciationSection} from '../components/LessonPronunciationSection';
import {LessonVocabularySection} from '../components/LessonVocabularySection';
import {MediaDownloadConsentSheet} from '../components/MediaDownloadConsentSheet';
import type {
  SentenceAnalysisPanelError,
  SentenceAnalysisPanelState,
} from '../components/SentenceAnalysisPanel';
import {YouTubeFinishedView} from '../components/YouTubeFinishedView';
import type {CurrentSentenceInfo} from '../components/YouTubeLessonStudy';
// Imported statically: a dynamic import() loads a split bundle in dev, which
// throws when the dev client has not set up HMR. Jest mocks the iframe module
// in jest.setup.js.
import {
  YouTubePlayer,
  type YouTubePlayerRef,
} from '../components/YouTubePlayer';
import {
  formatCueLabel,
  nextStudyPlaybackRate,
} from '../logic/canonicalYouTubeCues';
import {canComposeFrom} from '../logic/composePick';
import {
  markComposedLessonSeen,
  requestComposeSheet,
  useComposeTracker,
} from '../logic/composeTracker';
import {deleteLearnerLesson} from '../logic/learnerLessonDelete';
import {
  collectLessonGrammar,
  collectLessonListening,
  collectLessonPatterns,
  collectLessonPronunciation,
  collectLessonVocabulary,
  mergeAnalyses,
} from '../logic/lessonHubContent';
import {isLessonNotDownloaded} from '../logic/lessonNotDownloaded';
import {
  postponeMediaDownloadConsent,
  setMediaDownloadConsent,
  shouldAskMediaDownloadConsent,
} from '../logic/mediaDownloadConsent';
import {nextSentenceRepeat, type SentenceRepeat} from '../logic/sentenceRepeat';
import {useCanonicalLesson} from '../logic/useCanonicalLesson';
import {useComposeAvailable} from '../logic/useComposePick';
import {useLessonCompletion} from '../logic/useLessonCompletion';
import {useLessonMediaDownload} from '../logic/useLessonMediaDownload';
import {useLessonSavedItems} from '../logic/useLessonSavedItems';
import {useSavedVideoSentences} from '../logic/useSavedVideoSentences';
import {useVideoLessons} from '../logic/useVideoLessons';
import type {LessonFlowParamList} from './navigationTypes';

type Props = NativeStackScreenProps<
  LessonFlowParamList,
  'CanonicalLessonPlayer'
>;

type PlayerView = 'hub' | LessonHubSection;

/**
 * One player route for every canonical source. Opens the snapshot (or the
 * offline download), wires per-sentence analysis with offline/retry states,
 * renders the YouTube player with cue highlight/seek, and applies the
 * download status check (`gone` only on HTTP 200 removes the copy).
 *
 * Text/OCR/admin lessons open on the Lesson Hub overview and switch to the
 * sentence, vocabulary and grammar sections in place (same route); back
 * returns to the overview first. YouTube lessons keep the video layout.
 */
export function CanonicalLessonPlayerScreen({navigation, route}: Props) {
  const {lessonId} = route.params;
  const {theme} = useAppTheme();
  const {t} = useTranslation();
  const themedStyles = useMemo(() => makeStyles(theme), [theme]);
  const {state, open, checkForUpdate, requestAnalysis} =
    useCanonicalLesson(lessonId);
  const {
    state: completionState,
    complete: completeLesson,
    markStarted,
  } = useLessonCompletion(lessonId);
  const savedItems = useLessonSavedItems(lessonId);
  const savedSentences = useSavedVideoSentences(lessonId);
  const appNavigation = useAppNavigation();
  const practiceEnabled = useFeatureEnabled('shortPractice');
  const reloadSavedItems = savedItems.reload;
  const [positionMs, setPositionMs] = useState(0);
  const [videoAvailable, setVideoAvailable] = useState(true);
  const offline = useIsOffline();
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [videoMountKey, setVideoMountKey] = useState(0);
  const [showTranslation, setShowTranslation] = useState(true);
  // IPA starts hidden to keep the card short; the display menu turns it on.
  const [showIpa, setShowIpa] = useState(false);
  const [sentenceRepeat, setSentenceRepeat] = useState<SentenceRepeat>(0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [currentSentence, setCurrentSentence] =
    useState<CurrentSentenceInfo | null>(null);
  const youtubePlayerRef = useRef<YouTubePlayerRef>(null);
  const seekHoldMsRef = useRef<number | null>(null);
  const [view, setView] = useState<PlayerView>('hub');
  const [lateAnalyses, setLateAnalyses] = useState<
    Record<string, LessonAnalysis>
  >({});
  const [analysisStates, setAnalysisStates] = useState<
    Record<string, SentenceAnalysisPanelState | SentenceAnalysisPanelError>
  >({});
  const floatingClearance = useFloatingTabBarClearance();
  const composeAvailable = useComposeAvailable();
  const [composeOpen, setComposeOpen] = useState(false);
  const [composePicks, setComposePicks] = useState<string[] | undefined>();
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    open();
  }, [open]);

  const lessonReady = state.status === 'ready';
  useEffect(() => {
    if (lessonReady) {
      markStarted();
      // S4.3: a composed lesson the learner opens needs no "ready" banner.
      markComposedLessonSeen(lessonId);
    }
  }, [lessonId, lessonReady, markStarted]);

  useFocusEffect(
    useCallback(() => {
      checkForUpdate();
    }, [checkForUpdate]),
  );

  // Saved state can change elsewhere (Library, Review) while this is open.
  useFocusEffect(reloadSavedItems);

  const snapshot = state.status === 'ready' ? state.snapshot : null;
  const flowEntry = useFlowEntry(lessonId, snapshot);
  // Plan B: a learner's own lesson practises on the device and completes
  // through that practice instead of a one-tap "complete".
  const practiceRun = useMemo(
    () =>
      practiceEnabled && snapshot !== null && hasLessonPracticeRun(snapshot),
    [practiceEnabled, snapshot],
  );
  // Plan "practice segments": a long lesson continues at its next segment;
  // read again on focus, after a run finished a segment.
  const [practiceSegments, setPracticeSegments] = useState<
    PracticeSegmentView[]
  >([]);
  useFocusEffect(
    useCallback(() => {
      setPracticeSegments(
        practiceRun && snapshot ? practiceSegmentViews(snapshot) : [],
      );
    }, [practiceRun, snapshot]),
  );
  const nextSegment = nextPracticeSegment(practiceSegments);
  const continueSegment =
    practiceSegments.length > 1 &&
    nextSegment !== null &&
    practiceSegments.some(segment => segment.practicedAt !== null)
      ? nextSegment
      : null;
  const openPractice = useCallback(
    () => appNavigation.openPractice(lessonId),
    [appNavigation, lessonId],
  );
  // A public video lists the six-step lessons made from it.
  const videoLessons = useVideoLessons(snapshot, offline);
  const lessonMedia = useLessonMediaDownload(snapshot);
  const downloadLessonMedia = lessonMedia.download;
  // Lesson media is only downloaded with consent; ask once, online, on the
  // first lesson that has media.
  const [mediaConsentOpen, setMediaConsentOpen] = useState(false);
  useEffect(() => {
    if (snapshot && !offline && shouldAskMediaDownloadConsent(snapshot)) {
      setMediaConsentOpen(true);
    }
  }, [offline, snapshot]);
  const answerMediaConsent = useCallback(
    (choice: 'auto' | 'manual' | 'later') => {
      setMediaConsentOpen(false);
      if (choice === 'later') {
        postponeMediaDownloadConsent();
        return;
      }
      setMediaDownloadConsent(choice);
      if (choice === 'auto') downloadLessonMedia();
    },
    [downloadLessonMedia],
  );
  // A six-step lesson opens on its hub even when it came from a video (S4.3:
  // a learner's lesson composed from YouTube sentences keeps source_type).
  const flowLesson = snapshot !== null && isFlowLesson(snapshot);
  const isYouTubeStudy = snapshot?.source_type === 'youtube' && !flowLesson;
  const isYouTubeLegacy =
    snapshot !== null &&
    !flowLesson &&
    Boolean(snapshot.youtube) &&
    snapshot.source_type !== 'youtube';
  const canCompose =
    composeAvailable && snapshot !== null && canComposeFrom(snapshot);
  const openCompose = canCompose ? () => setComposeOpen(true) : undefined;
  /** E5 (S4): the learner deletes their own lesson after one confirmation. */
  const confirmDelete = () => {
    Alert.alert(t('moment.delete_title'), t('moment.delete_body'), [
      {text: t('moment.delete_cancel'), style: 'cancel'},
      {
        text: t('moment.delete_confirm'),
        style: 'destructive',
        onPress: async () => {
          const result = await deleteLearnerLesson(lessonId);
          if (result.ok) {
            appNavigation.goBack();
          } else {
            Alert.alert(t('moment.delete_title'), t('moment.delete_failed'));
          }
        },
      },
    ]);
  };

  // An "Đang tạo bài" card opened this lesson to show its compose progress.
  const sheetRequested = useComposeTracker(
    store => store.sheetLessonId === lessonId,
  );
  const composeSheetShown = snapshot !== null && canComposeFrom(snapshot);
  useEffect(() => {
    if (sheetRequested && composeSheetShown) {
      setComposePicks(useComposeTracker.getState().sheetPicks ?? undefined);
      setComposeOpen(true);
      requestComposeSheet(null);
    }
  }, [composeSheetShown, sheetRequested]);
  const isYouTube = isYouTubeStudy || isYouTubeLegacy;
  const inSection = snapshot !== null && !isYouTube && view !== 'hub';
  // These sections page through their cards and keep their own scroll area
  // above the previous / next buttons.
  const pagedSection =
    inSection &&
    (view === 'sentences' ||
      view === 'vocabulary' ||
      view === 'patterns' ||
      view === 'listening');

  const openView = useCallback((next: PlayerView) => {
    setView(next);
    scrollRef.current?.scrollTo({y: 0, animated: false});
  }, []);

  // Hardware back / swipe from a section returns to the overview first.
  // Closing the whole lesson (a reset from the close button) still leaves.
  useEffect(() => {
    if (!inSection) return undefined;
    return navigation.addListener?.('beforeRemove', event => {
      if (event.data.action.type === 'RESET') return;
      event.preventDefault();
      openView('hub');
    });
  }, [inSection, navigation, openView]);

  const {speak: handleSpeak, notice: speechNotice} = useSpeak();

  const handleRequestAnalysis = useCallback(
    async (sentenceId: string) => {
      setAnalysisStates(previous => ({
        ...previous,
        [sentenceId]: {status: 'loading'},
      }));
      const result = await requestAnalysis(sentenceId);
      if (result.ok) {
        setLateAnalyses(previous => ({
          ...previous,
          [sentenceId]: result.value,
        }));
        setAnalysisStates(previous => {
          const next = {...previous};
          delete next[sentenceId];
          return next;
        });
        return;
      }
      if (result.kind === 'analysis-busy') {
        setAnalysisStates(previous => ({
          ...previous,
          [sentenceId]: {status: 'busy'},
        }));
        return;
      }
      if (result.kind === 'network-error') {
        setAnalysisStates(previous => ({
          ...previous,
          [sentenceId]: {status: 'offline-missing'},
        }));
        return;
      }
      setAnalysisStates(previous => ({
        ...previous,
        [sentenceId]: {
          status: 'failed',
          retryable: result.retryable,
          message: result.message,
        },
      }));
    },
    [requestAnalysis],
  );

  const analyses = useMemo(
    () => mergeAnalyses(snapshot?.analyses ?? {}, lateAnalyses),
    [snapshot, lateAnalyses],
  );
  const vocabulary = useMemo(
    () => (snapshot ? collectLessonVocabulary(snapshot, analyses) : []),
    [snapshot, analyses],
  );
  const grammar = useMemo(
    () => (snapshot ? collectLessonGrammar(snapshot, analyses) : []),
    [snapshot, analyses],
  );
  const patterns = useMemo(
    () => (snapshot ? collectLessonPatterns(snapshot) : []),
    [snapshot],
  );
  const pronunciation = useMemo(
    () => (snapshot ? collectLessonPronunciation(snapshot) : []),
    [snapshot],
  );
  const listening = useMemo(
    () => (snapshot ? collectLessonListening(snapshot) : []),
    [snapshot],
  );

  const showHub = snapshot !== null && !isYouTube && view === 'hub';
  // Lesson names can be long: the header keeps a short generic title and
  // the full lesson name is rendered in the page body.
  const title = inSection
    ? t(
        lessonSectionTitleKey(
          view as LessonHubSection,
          (snapshot?.lesson_items ?? []).length > 0,
        ),
      )
    : t('lessonPlayer.player_title');

  const handleSeek = useCallback((ms: number) => {
    seekHoldMsRef.current = ms;
    setPositionMs(ms);
    youtubePlayerRef.current?.seekTo(ms / 1000);
  }, []);

  const handleTimeUpdate = useCallback((seconds: number) => {
    const ms = Math.floor(seconds * 1000);
    const hold = seekHoldMsRef.current;
    if (hold !== null) {
      if (ms + 500 < hold) {
        return;
      }
      seekHoldMsRef.current = null;
    }
    setPositionMs(ms);
  }, []);

  const handlePlayVideo = useCallback(() => {
    youtubePlayerRef.current?.play();
  }, []);

  const handleCyclePlaybackRate = useCallback(() => {
    setPlaybackRate(rate => nextStudyPlaybackRate(rate));
  }, []);

  const handlePauseVideo = useCallback(() => {
    youtubePlayerRef.current?.pause();
    setVideoPlaying(false);
  }, []);

  // FR-09: the video ended, or the learner moved past the last sentence.
  const [videoFinished, setVideoFinished] = useState(false);
  const [studyKey, setStudyKey] = useState(0);
  const handleFinishVideo = useCallback(() => {
    youtubePlayerRef.current?.pause();
    setVideoPlaying(false);
    setVideoFinished(true);
    completeLesson();
  }, [completeLesson]);

  /** "Xem lại": the video and the cards start again from sentence 1. */
  const handleReplayLesson = useCallback(() => {
    setVideoFinished(false);
    setPositionMs(0);
    setVideoMountKey(key => key + 1);
    setStudyKey(key => key + 1);
  }, []);

  const handleRetryVideo = useCallback(() => {
    setVideoAvailable(true);
    setVideoPlaying(false);
    setVideoMountKey(key => key + 1);
  }, []);

  const renderPlayer = (options?: {
    videoSlot?: React.ReactNode;
    onRetryVideo?: () => void;
  }) =>
    snapshot ? (
      <CanonicalLessonPlayer
        key={studyKey}
        snapshot={snapshot}
        analyses={snapshot.analyses}
        lateAnalyses={lateAnalyses}
        offline={state.status === 'ready' ? state.offline : false}
        hasUpdate={state.status === 'ready' ? state.hasUpdate : false}
        playbackPositionMs={positionMs}
        videoAvailable={videoAvailable}
        videoPlaying={videoPlaying}
        showTranslation={showTranslation}
        showIpa={showIpa}
        unavailableReason={
          offline
            ? t('lessonPlayer.video_offline')
            : t('lessonPlayer.video_unavailable')
        }
        videoSlot={options?.videoSlot}
        onRetryVideo={options?.onRetryVideo}
        onSeek={handleSeek}
        onPauseVideo={handlePauseVideo}
        onRequestAnalysis={handleRequestAnalysis}
        onRetryAnalysis={handleRequestAnalysis}
        analysisStates={analysisStates}
        onSpeakText={handleSpeak}
        vocabularySave={savedItems.vocabulary}
        grammarSave={savedItems.grammar}
        sentenceSave={isYouTubeStudy ? savedSentences : undefined}
        onFinish={isYouTubeStudy ? handleFinishVideo : () => openView('hub')}
        videoLessons={videoLessons}
        onOpenVideoLesson={appNavigation.openLesson}
        onPlayVideo={handlePlayVideo}
        sentenceRepeat={sentenceRepeat}
        playbackRate={playbackRate}
        onCyclePlaybackRate={handleCyclePlaybackRate}
        onCurrentSentenceChange={setCurrentSentence}
      />
    ) : null;

  const renderBody = () => {
    if (state.status === 'idle' || state.status === 'loading') {
      return <LessonPlayerSkeleton testID="canonical-player-loading" />;
    }
    if (state.status === 'archived') {
      return (
        <CanonicalLessonPlayer
          snapshot={{
            id: lessonId,
            slug: '',
            title: '',
            description: '',
            origin: 'admin',
            source_type: 'admin_text',
            content_revision: 1,
            unit: null,
            youtube: null,
            sentences: [],
            blocks: [],
            analyses: {},
          }}
          analyses={{}}
          archived
        />
      );
    }
    if (state.status === 'contract-mismatch') {
      return (
        <AppText testID="canonical-player-update-app" color="secondary">
          {t('lessonPlayer.update_app')}
        </AppText>
      );
    }
    if (state.status === 'error') {
      return (
        <View testID="canonical-player-error" style={themedStyles.errorBox}>
          <AppText color="danger">
            {isLessonNotDownloaded(state)
              ? t('lessonPlayer.not_downloaded')
              : 'message' in state.error
                ? state.error.message
                : t('lessonPlayer.load_failed')}
          </AppText>
          <AppButton
            accessibilityHint={t('lessonPlayer.retry_load_hint')}
            onPress={open}
            testID="canonical-player-retry"
            title={t('common.retry')}
            variant="secondary"
          />
        </View>
      );
    }
    if (!snapshot) return null;
    if (isYouTubeStudy && videoFinished) {
      return (
        <YouTubeFinishedView
          onOtherVideo={() => appNavigation.startCreate({kind: 'youtube'})}
          onReplay={handleReplayLesson}
          onReviewSaved={appNavigation.openReview}
          saveFailed={completionState === 'error'}
          savedSentenceCount={savedSentences.savedCount}
          savedWordCount={savedItems.savedCardCount}
          sentenceCount={snapshot.sentences.length}
        />
      );
    }
    if (isYouTubeStudy) {
      return renderPlayer({
        onRetryVideo: handleRetryVideo,
        videoSlot: (
          <YouTubePlayer
            key={videoMountKey}
            ref={youtubePlayerRef}
            videoId={snapshot.youtube!.video_id}
            playbackRate={playbackRate}
            onPlayingChange={setVideoPlaying}
            onTimeUpdate={handleTimeUpdate}
            onEnded={handleFinishVideo}
            onError={() => {
              setVideoAvailable(false);
              setVideoPlaying(false);
            }}
          />
        ),
      });
    }
    if (isYouTubeLegacy) {
      return (
        <>
          <YouTubePlayer
            videoId={snapshot.youtube!.video_id}
            onPlayingChange={setVideoPlaying}
            onTimeUpdate={seconds => setPositionMs(Math.floor(seconds * 1000))}
            onError={code => {
              if (
                code === 'YOUTUBE_VIDEO_NOT_FOUND' ||
                code === 'YOUTUBE_NOT_EMBEDDABLE'
              ) {
                setVideoAvailable(false);
                setVideoPlaying(false);
              }
            }}
          />
          {renderPlayer()}
        </>
      );
    }
    switch (view) {
      case 'hub':
        return (
          <>
            <LessonMediaDownloadCard
              offline={offline}
              onDownload={lessonMedia.download}
              onRemove={lessonMedia.remove}
              status={lessonMedia.status}
            />
            <CanonicalLessonHub
              snapshot={snapshot}
              analyses={analyses}
              offline={state.status === 'ready' ? state.offline : false}
              hasUpdate={state.status === 'ready' ? state.hasUpdate : false}
              onOpenSection={openView}
              onOpenLesson={appNavigation.openLesson}
              onOpenPractice={
                practiceEnabled && !practiceRun ? openPractice : undefined
              }
              onOpenCompose={openCompose}
              onSpeakText={handleSpeak}
              flowEntry={flowEntry}
              onOpenFlow={
                flowEntry.available
                  ? () => appNavigation.openLessonFlow(lessonId)
                  : undefined
              }
              onDeleteLesson={
                snapshot.origin === 'learner' ? confirmDelete : undefined
              }
            />
          </>
        );
      case 'sentences':
        return renderPlayer();
      case 'vocabulary':
        return (
          <LessonVocabularySection
            entries={vocabulary}
            onFinish={() => openView('hub')}
            onSpeakText={handleSpeak}
            saveControl={savedItems.vocabulary}
            sentences={snapshot.sentences}
          />
        );
      case 'grammar':
        return (
          <LessonGrammarSection
            entries={grammar}
            saveControl={savedItems.grammar}
          />
        );
      case 'patterns':
        return (
          <LessonPatternSection
            entries={patterns}
            onFinish={() => openView('hub')}
            onSpeakText={handleSpeak}
            saveControl={savedItems.patterns}
          />
        );
      case 'pronunciation':
        return (
          <LessonPronunciationSection
            entries={pronunciation}
            onSpeakText={handleSpeak}
          />
        );
      case 'listening':
        return (
          <LessonListeningSection
            entries={listening}
            onFinish={() => openView('hub')}
            onSpeakText={handleSpeak}
          />
        );
    }
  };

  const studyReady = isYouTubeStudy && state.status === 'ready';
  // Curriculum lessons start the six-step player (PR 10, decision G1).
  const startLabel = practiceRun
    ? continueSegment !== null
      ? t('practice.start_segment', {
          number: continueSegment + 1,
          total: practiceSegments.length,
        })
      : completionState === 'finished'
        ? t('practice.start_again')
        : t('practice.start')
    : !flowEntry.available
      ? t('lessonPlayer.start_learning')
      : flowEntry.resumeAt === null
        ? t('lessonFlow.start_at', {
            label: t(
              flowEntry.reviewSkipped
                ? 'lessonFlow.step_2'
                : 'lessonFlow.step_1',
            ),
          })
        : flowEntry.resumeAt === 6
          ? t('lessonFlow.review')
          : t('lessonFlow.continue_at', {
              label: t(`lessonFlow.step_${flowEntry.resumeAt}`),
            });

  return (
    <AppScreen offlineCopy={state.status === 'ready' && state.offline}>
      <ScreenHeader
        title={studyReady && snapshot ? snapshot.title : title}
        subtitle={
          studyReady && currentSentence && currentSentence.total > 0
            ? t('youtube.study.header_subtitle', {
                index: currentSentence.position,
                total: currentSentence.total,
                time: formatCueLabel(currentSentence.startMs),
              })
            : undefined
        }
        onBack={() => (inSection ? openView('hub') : navigation.goBack())}
        rightAction={
          studyReady ? (
            <>
              {practiceRun ? (
                // The practice run is the YouTube lesson's way to complete;
                // the label carries the next segment of a long lesson.
                <HeaderIconButton
                  accessibilityHint={t('practice.start_hint')}
                  accessibilityLabel={startLabel}
                  icon="fitness_center"
                  onPress={openPractice}
                  testID="canonical-youtube-practice"
                />
              ) : null}
              {openCompose ? (
                <HeaderIconButton
                  accessibilityHint={t('compose.entry_subtitle')}
                  accessibilityLabel={t('compose.entry_a11y')}
                  icon="add"
                  onPress={openCompose}
                  testID="youtube-open-compose"
                />
              ) : null}
              <LessonDisplayToggles
                onCycleRepeat={() => setSentenceRepeat(nextSentenceRepeat)}
                onToggleIpa={() => setShowIpa(value => !value)}
                sentenceRepeat={sentenceRepeat}
                onToggleTranslation={() => setShowTranslation(value => !value)}
                showIpa={showIpa}
                showTranslation={showTranslation}
              />
            </>
          ) : inSection ? (
            // Back returns to the hub; close leaves the lesson in one tap.
            <HeaderIconButton
              accessibilityHint={t('lessonFlow.close_lesson_hint')}
              accessibilityLabel={t('lessonFlow.close_lesson')}
              icon="close"
              onPress={appNavigation.closeLesson}
              testID="canonical-close-lesson"
            />
          ) : showHub &&
            completionState !== 'finished' &&
            !flowEntry.available &&
            !practiceRun ? (
            <HeaderIconButton
              accessibilityHint={t('lessonPlayer.complete_lesson_hint')}
              accessibilityLabel={t('lessonPlayer.complete_lesson')}
              icon="check_circle"
              onPress={completeLesson}
              testID="canonical-hub-complete"
            />
          ) : undefined
        }
      />
      {speechNotice ? (
        <View style={themedStyles.speechNotice} testID="lesson-speech-notice">
          <AppText color="danger">
            {speechNotice === 'VOICE_UNAVAILABLE'
              ? t('lessonPlayer.speech_voice_missing')
              : t('lessonPlayer.speech_unavailable')}
          </AppText>
        </View>
      ) : null}
      {studyReady || pagedSection ? (
        <View style={themedStyles.study} testID="canonical-player-screen">
          {renderBody()}
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={themedStyles.scroll}
          testID="canonical-player-screen"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[
            themedStyles.content,
            showHub ? null : {paddingBottom: floatingClearance},
          ]}
        >
          {renderBody()}
        </ScrollView>
      )}
      {showHub ? (
        <BottomActionBar style={themedStyles.actionBar}>
          {flowEntry.available ? (
            // Curriculum lessons complete through their practice (G6).
            flowEntry.practiceDone ? (
              <AppText
                color="secondary"
                testID="canonical-hub-practice-done"
                variant="label"
              >
                {t('lessonFlow.practice_done')}
              </AppText>
            ) : null
          ) : completionState === 'finished' ? (
            <AppText
              color="secondary"
              testID="canonical-hub-completed"
              variant="label"
            >
              {t('lessonPlayer.completed_label')}
            </AppText>
          ) : null}
          {completionState === 'error' ? (
            <AppText
              color="danger"
              testID="canonical-hub-complete-error"
              variant="body"
            >
              {t('lessonPlayer.complete_error')}
            </AppText>
          ) : null}
          <PrimaryActionButton
            accessibilityLabel={startLabel}
            tone="coral"
            label={startLabel}
            accessibilityHint={
              practiceRun ? t('practice.start_hint') : undefined
            }
            onPress={() =>
              flowEntry.available
                ? appNavigation.openLessonFlow(lessonId)
                : practiceRun
                  ? openPractice()
                  : openView('sentences')
            }
            testID={
              flowEntry.available
                ? 'canonical-hub-start-flow'
                : practiceRun
                  ? 'canonical-hub-start-practice'
                  : 'canonical-hub-start'
            }
          />
        </BottomActionBar>
      ) : null}
      {snapshot && (canCompose || (composeOpen && composeSheetShown)) ? (
        <ComposeSheet
          initialPicks={composePicks}
          offline={state.status === 'ready' ? state.offline : false}
          onClose={() => {
            setComposeOpen(false);
            setComposePicks(undefined);
          }}
          onOpenLesson={appNavigation.openLesson}
          onSpeakText={handleSpeak}
          snapshot={snapshot}
          visible={composeOpen}
        />
      ) : null}
      <MediaDownloadConsentSheet
        onChooseAuto={() => answerMediaConsent('auto')}
        onChooseManual={() => answerMediaConsent('manual')}
        onLater={() => answerMediaConsent('later')}
        visible={mediaConsentOpen}
      />
    </AppScreen>
  );
}

function makeStyles(theme: AppTheme) {
  return StyleSheet.create({
    actionBar: {
      backgroundColor: theme.colors.background,
      borderTopColor: theme.colors.outlineVariant,
    },
    content: {
      gap: theme.spacing.lg,
      paddingBottom: theme.spacing.lg,
      paddingHorizontal: theme.gutter,
      paddingTop: theme.spacing.sm,
    },
    scroll: {
      flex: 1,
    },
    study: {
      flex: 1,
    },
    speechNotice: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      marginHorizontal: theme.spacing.lg,
      marginTop: theme.spacing.sm,
      padding: theme.spacing.md,
    },
    errorBox: {
      backgroundColor: theme.colors.surfaceMuted,
      borderRadius: theme.radius.lg,
      gap: theme.spacing.md,
      padding: theme.spacing.lg,
    },
  });
}
