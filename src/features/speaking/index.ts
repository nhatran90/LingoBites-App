export {
  captureErrorEvent,
  insertSpeakingRecording,
  listErrorEvents,
  listSpeakingRecordings,
} from './logic/speakingQueryPort';
export {
  createRecordingMetadata,
  RECORDING_UPLOAD_CONSENT_WITHDRAWN,
  RECORDING_UPLOAD_MIME,
  uploadRecordingBinary,
} from './logic/api/recordingClient';
export type {
  CreateRecordingResult,
  RecordingClientOptions,
  UploadBinaryResult,
} from './logic/api/recordingClient';
export {listAllSpeakingAttempts} from './logic/data/SpeakingAttemptRepository';
export {
  clearSpeakingData,
  listSpeakingRecordingFilePaths,
} from './logic/data/SpeakingRepository';

export async function listSpeakingRecordingsDirectoryFilePaths(): Promise<
  string[]
> {
  let listRecordingsDirectoryFilePaths: () => Promise<string[]>;
  try {
    ({listRecordingsDirectoryFilePaths} =
      require('./logic/recordingService') as typeof import('./logic/recordingService'));
  } catch {
    return [];
  }
  return listRecordingsDirectoryFilePaths();
}

export async function sweepSpeakingRecordingsDirectory(): Promise<void> {
  let sweepRecordingsDirectory: () => Promise<void>;
  try {
    ({sweepRecordingsDirectory} =
      require('./logic/recordingService') as typeof import('./logic/recordingService'));
  } catch {
    return;
  }
  await sweepRecordingsDirectory();
}
/**
 * PR 10: the recorder for the lesson player's speaking self-check. Files stay
 * on the device (the caller deletes them); nothing is uploaded or stored in
 * `speaking_recordings`. Loaded lazily like the helpers above, so screens
 * that never record do not need the native module; `null` when unavailable.
 */
export type LessonRecorder = Pick<
  typeof import('./logic/recordingService'),
  | 'startRecording'
  | 'stopRecording'
  | 'playRecording'
  | 'stopPlayback'
  | 'deleteRecordingFile'
>;

export function loadLessonRecorder(): LessonRecorder | null {
  try {
    return require('./logic/recordingService') as typeof import('./logic/recordingService');
  } catch {
    return null;
  }
}

/**
 * Pronunciation step 3: the lesson recorder plus reading a finished take
 * (size, SHA-256, bytes) for upload. Loaded lazily like the recorder above.
 */
export type ReadingRecorder = LessonRecorder &
  Pick<typeof import('./logic/recordingService'), 'readRecordingFileForUpload'>;

export function loadReadingRecorder(): ReadingRecorder | null {
  try {
    return require('./logic/recordingService') as typeof import('./logic/recordingService');
  } catch {
    return null;
  }
}
export {saveShadowingAttempt} from './logic/shadowing/saveShadowingAttempt';
export {
  initRecordingUploadQueue,
  requestRecordingUploadDrain,
} from './logic/upload/recordingUploadQueue';
export {
  enqueueSpeakingAttemptTombstones,
  queueDurableServerRecordingDelete,
  queueAccountOnlyServerRecordingDelete,
} from './logic/upload/serverRecordingDeletion';
export {
  isEvaluationConsentOn,
  isPronunciationConsentOn,
  isRecordingUploadConsentOn,
  readEvaluationConsent,
  readPronunciationConsent,
  readRecordingUploadConsent,
  setEvaluationConsent,
  setPronunciationConsent,
  shouldAskEvaluationConsent,
  shouldAskPronunciationConsent,
} from './logic/upload/recordingConsent';
export {queueLessonTaskRecording} from './logic/upload/lessonTaskRecording';
export {
  applyRecordingUploadConsent,
  SpeakingRecordingsSettingsRow,
} from './components/SpeakingRecordingsSettingsRow';
export {
  applyEvaluationConsent,
  SpeechGradingSettingsRow,
} from './components/SpeechGradingSettingsRow';
export {PronunciationSettingsRow} from './components/PronunciationSettingsRow';
export type {
  SaveShadowingAttemptInput,
  SaveShadowingAttemptResult,
} from './logic/shadowing/saveShadowingAttempt';
export function findMostRecentInProgressShadowingLesson(
  ...args: Parameters<
    typeof import('./logic/shadowing/shadowingProgress').findMostRecentInProgressShadowingLesson
  >
): ReturnType<
  typeof import('./logic/shadowing/shadowingProgress').findMostRecentInProgressShadowingLesson
> {
  const {findMostRecentInProgressShadowingLesson: fn} =
    require('./logic/shadowing/shadowingProgress') as typeof import('./logic/shadowing/shadowingProgress');
  return fn(...args);
}

export function listShadowingLessonProgressSummaries(
  ...args: Parameters<
    typeof import('./logic/shadowing/shadowingProgress').listShadowingLessonProgressSummaries
  >
): ReturnType<
  typeof import('./logic/shadowing/shadowingProgress').listShadowingLessonProgressSummaries
> {
  const {listShadowingLessonProgressSummaries: fn} =
    require('./logic/shadowing/shadowingProgress') as typeof import('./logic/shadowing/shadowingProgress');
  return fn(...args);
}

export function resolveShadowingEntry(
  ...args: Parameters<
    typeof import('./logic/shadowing/shadowingProgress').resolveShadowingEntry
  >
): ReturnType<
  typeof import('./logic/shadowing/shadowingProgress').resolveShadowingEntry
> {
  const {resolveShadowingEntry: fn} =
    require('./logic/shadowing/shadowingProgress') as typeof import('./logic/shadowing/shadowingProgress');
  return fn(...args);
}

export function summarizeShadowingLessonProgress(
  ...args: Parameters<
    typeof import('./logic/shadowing/shadowingProgress').summarizeShadowingLessonProgress
  >
): ReturnType<
  typeof import('./logic/shadowing/shadowingProgress').summarizeShadowingLessonProgress
> {
  const {summarizeShadowingLessonProgress: fn} =
    require('./logic/shadowing/shadowingProgress') as typeof import('./logic/shadowing/shadowingProgress');
  return fn(...args);
}
export type {
  ShadowingEntryTarget,
  ShadowingLessonProgressSummary,
  ShadowingLessonStatusChip,
} from './logic/shadowing/shadowingProgress';
export type {
  ShadowingLessonPickerRouteParams,
  ShadowingSessionRouteParams,
  ShadowingSummaryRouteParams,
  SpeakingRoomRouteParams,
  SpeakingShadowingRouteParams,
} from './screens/navigationTypes';
