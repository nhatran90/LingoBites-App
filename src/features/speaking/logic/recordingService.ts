/**
 * On-device mic recording + playback for the Speaking Room (SETE-110 / M5,
 * REQ-20/21).
 *
 * Follows the same "native adapter degrades gracefully" convention as
 * `features/audio/logic/deviceChapterAudio.ts`: every function returns an explicit
 * `{ok:false, errorCode}` result instead of throwing when the native
 * recorder module or file system is unavailable (e.g. on a bare simulator
 * without the native module linked), so the Speaking Room UI can show a
 * clear message rather than crash.
 *
 * Recording is always explicit: `startRecording` only ever runs because the
 * learner tapped a record button in the UI — there is no background/silent
 * recording path anywhere in this module (REQ-20).
 */

import * as RNFS from '@dr.pogodin/react-native-fs';
import {Platform} from 'react-native';
import {
  AudioEncoderAndroidType,
  type AudioSet,
  createSound,
  OutputFormatAndroidType,
} from 'react-native-nitro-sound';
import {check, PERMISSIONS, request, RESULTS} from 'react-native-permissions';

import type {SpeakingMode} from '@core/db/types';

function nativeFsAvailable(): boolean {
  return (
    typeof RNFS.DocumentDirectoryPath === 'string' &&
    RNFS.DocumentDirectoryPath.length > 0 &&
    typeof RNFS.readDir === 'function'
  );
}

function recordingsRoot(): string {
  return `${RNFS.DocumentDirectoryPath}/LingoBitesRecordings`;
}

async function ensureDirectory(directory: string): Promise<void> {
  try {
    await RNFS.mkdir(directory);
  } catch {
    // Directory usually already exists; a real storage error surfaces on write.
  }
}

/** Keeps a recording id safe to use as a file system segment. */
export function sanitizeRecordingSegment(segment: string): string {
  const cleaned = segment
    .replace(/[^A-Za-z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned || 'recording';
}

type Recorder = ReturnType<typeof createSound>;

let recorder: Recorder | null = null;

export async function preflightMicrophonePermission(): Promise<
  'granted' | 'denied' | 'not_requested' | 'unavailable'
> {
  const permission =
    Platform.OS === 'ios'
      ? PERMISSIONS.IOS.MICROPHONE
      : PERMISSIONS.ANDROID.RECORD_AUDIO;

  const status = await check(permission);
  if (status === RESULTS.UNAVAILABLE) return 'unavailable';
  if (status === RESULTS.GRANTED) return 'granted';
  if (status === RESULTS.DENIED) return 'not_requested';
  return 'denied';
}

export async function requestMicrophonePermission(): Promise<
  'granted' | 'denied' | 'unavailable'
> {
  const permission =
    Platform.OS === 'ios'
      ? PERMISSIONS.IOS.MICROPHONE
      : PERMISSIONS.ANDROID.RECORD_AUDIO;

  const status = await request(permission);
  if (status === RESULTS.UNAVAILABLE) return 'unavailable';
  if (status === RESULTS.GRANTED) return 'granted';
  return 'denied';
}

function getRecorder(): Recorder {
  if (!recorder) {
    recorder = createSound();
  }
  return recorder;
}

export type StartRecordingResult =
  | {ok: true; filePath: string}
  | {
      ok: false;
      errorCode:
        | 'UNAVAILABLE'
        | 'PERMISSION_DENIED'
        | 'NO_INPUT_DEVICE'
        | 'TRANSIENT_FAILURE';
      message: string;
    };

/**
 * Starts recording to a new file under the app's documents directory.
 * Must only be called from an explicit user tap on a record button (REQ-20).
 */
/**
 * PR 14 (decision H13): spoken task answers go to speech recognition, which
 * needs no more than AAC, mono, 16 kHz at ~32 kbps (35 s ≈ 140 KB).
 * Pronunciation readings (step 3) use it too: Azure scores 16 kHz mono.
 */
export const LESSON_TASK_AUDIO_SET: AudioSet = {
  AudioEncoderAndroid: AudioEncoderAndroidType.AAC,
  OutputFormatAndroid: OutputFormatAndroidType.MPEG_4,
  AVFormatIDKeyIOS: 'aac',
  AudioSamplingRate: 16_000,
  AudioChannels: 1,
  AudioEncodingBitRate: 32_000,
};

/**
 * Speaking Room recordings: AAC in .m4a, mono, 44.1 kHz at 128 kbps. Without
 * an explicit set the recorder would default to 48 kHz stereo at 192 kbps.
 */
export const SPEAKING_AUDIO_SET: AudioSet = {AudioQuality: 'medium'};

export async function startRecording(
  mode: SpeakingMode | 'lesson_task' | 'pronunciation',
  recordingId: string,
): Promise<StartRecordingResult> {
  if (!nativeFsAvailable()) {
    return {
      ok: false,
      errorCode: 'UNAVAILABLE',
      message: 'Tính năng ghi âm chưa sẵn sàng trên thiết bị này.',
    };
  }

  const perm = await preflightMicrophonePermission();
  if (perm === 'unavailable') {
    return {
      ok: false,
      errorCode: 'NO_INPUT_DEVICE',
      message: 'Không tìm thấy micro trên thiết bị này.',
    };
  }
  if (perm === 'not_requested') {
    const requested = await requestMicrophonePermission();
    if (requested !== 'granted') {
      return {
        ok: false,
        errorCode: 'PERMISSION_DENIED',
        message: 'LingoBites cần micro để ghi âm phần luyện nói của bạn.',
      };
    }
  } else if (perm === 'denied') {
    return {
      ok: false,
      errorCode: 'PERMISSION_DENIED',
      message: 'LingoBites cần micro để ghi âm phần luyện nói của bạn.',
    };
  }

  const directory = `${recordingsRoot()}/${sanitizeRecordingSegment(mode)}`;
  await ensureDirectory(directory);
  const filePath = `${directory}/${sanitizeRecordingSegment(recordingId)}.m4a`;

  try {
    await getRecorder().startRecorder(
      filePath,
      mode === 'lesson_task' || mode === 'pronunciation'
        ? LESSON_TASK_AUDIO_SET
        : SPEAKING_AUDIO_SET,
    );
    return {ok: true, filePath};
  } catch {
    return {
      ok: false,
      errorCode: 'TRANSIENT_FAILURE',
      message: 'Không thể bắt đầu ghi âm. Vui lòng thử lại.',
    };
  }
}

export type StopRecordingResult =
  | {ok: true; filePath: string; durationMs: number}
  | {ok: false; errorCode: 'UNAVAILABLE'; message: string};

/** Stops the in-progress recording started by `startRecording`. */
export async function stopRecording(
  filePath: string,
  startedAtMs: number,
): Promise<StopRecordingResult> {
  try {
    const resultPath = await getRecorder().stopRecorder();
    getRecorder().removeRecordBackListener();
    return {
      ok: true,
      filePath: resultPath || filePath,
      durationMs: Math.max(0, Date.now() - startedAtMs),
    };
  } catch {
    return {
      ok: false,
      errorCode: 'UNAVAILABLE',
      message: 'Không thể dừng ghi âm.',
    };
  }
}

export type PlaybackResult =
  | {ok: true}
  | {ok: false; errorCode: 'UNAVAILABLE' | 'NOT_FOUND'; message: string};

/** Plays back a recorded (or reference) audio file from local disk. */
export async function playRecording(filePath: string): Promise<PlaybackResult> {
  if (nativeFsAvailable()) {
    let exists = false;
    try {
      exists = await RNFS.exists(filePath);
    } catch {
      exists = false;
    }
    if (!exists) {
      return {
        ok: false,
        errorCode: 'NOT_FOUND',
        message: 'Không tìm thấy tệp ghi âm.',
      };
    }
  }
  try {
    await getRecorder().startPlayer(filePath);
    return {ok: true};
  } catch {
    return {
      ok: false,
      errorCode: 'UNAVAILABLE',
      message: 'Không thể phát lại bản ghi âm.',
    };
  }
}

/** Stops any in-progress playback started by `playRecording`. */
export async function stopPlayback(): Promise<void> {
  try {
    await getRecorder().stopPlayer();
    getRecorder().removePlayBackListener();
  } catch {
    // Best-effort: nothing to stop, or the native module is unavailable.
  }
}

export type ReadRecordingFileForUploadResult =
  | {ok: true; byteSize: number; sha256: string; binary: Blob | ArrayBuffer}
  | {ok: false; errorCode: string};

/**
 * Reads a saved recording from disk for the upload queue (FR-020 / audio/mp4).
 */
export async function readRecordingFileForUpload(
  filePath: string,
): Promise<ReadRecordingFileForUploadResult> {
  if (!nativeFsAvailable()) {
    return {ok: false, errorCode: 'UNAVAILABLE'};
  }
  try {
    const exists = await RNFS.exists(filePath);
    if (!exists) {
      return {ok: false, errorCode: 'NOT_FOUND'};
    }
    const stat = await RNFS.stat(filePath);
    const sha256 = (await RNFS.hash(filePath, 'sha256')).toLowerCase();
    const fileUri = filePath.startsWith('file://')
      ? filePath
      : `file://${filePath}`;
    const fileRes = await fetch(fileUri);
    const binary = await fileRes.blob();
    return {
      ok: true,
      byteSize: Number(stat.size),
      sha256,
      binary,
    };
  } catch {
    return {ok: false, errorCode: 'READ_FAILED'};
  }
}

function isMissingFileError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /enoent|not found|does not exist/i.test(message);
}

/** Deletes a recording file; only a missing path is treated as success (AC-5). */
export async function deleteRecordingFile(filePath: string): Promise<void> {
  if (!nativeFsAvailable()) {
    return;
  }
  try {
    await RNFS.unlink(filePath);
  } catch (error) {
    if (isMissingFileError(error)) {
      return;
    }
    throw error;
  }
}

export function getRecordingsDirectoryRoot(): string {
  return recordingsRoot();
}

function isMissingDirectoryError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /enoent|not found|does not exist/i.test(message);
}

async function listFilesRecursive(directory: string): Promise<string[]> {
  const paths: string[] = [];
  try {
    const entries = await RNFS.readDir(directory);
    for (const entry of entries) {
      if (entry.isDirectory()) {
        paths.push(...(await listFilesRecursive(entry.path)));
      } else if (entry.isFile()) {
        paths.push(entry.path);
      }
    }
  } catch (error) {
    if (isMissingDirectoryError(error)) {
      return [];
    }
    throw error;
  }
  return paths;
}

/** Every file under `LingoBitesRecordings`, including untracked orphans (FR-018). */
export async function listRecordingsDirectoryFilePaths(): Promise<string[]> {
  if (!nativeFsAvailable()) {
    return [];
  }
  return listFilesRecursive(recordingsRoot());
}

/** Removes all files under the recordings directory (after DB commit — AC-018). */
export async function sweepRecordingsDirectory(): Promise<void> {
  const paths = await listRecordingsDirectoryFilePaths();
  for (const filePath of paths) {
    await deleteRecordingFile(filePath);
  }
}
