import {getDatabase} from '@core/db/database';

export const RECORDING_UPLOAD_CONSENT_KEY = 'speaking.recording_upload_consent';

export type RecordingUploadConsentValue = 'on' | 'off' | 'undecided';

export function readRecordingUploadConsent(): RecordingUploadConsentValue {
  const db = getDatabase();
  const row = db
    .execute('SELECT value FROM app_settings WHERE key = ? LIMIT 1;', [
      RECORDING_UPLOAD_CONSENT_KEY,
    ])
    .rows?.item(0) as {value?: string} | undefined;
  if (row?.value === 'on') return 'on';
  if (row?.value === 'off') return 'off';
  return 'undecided';
}

export function isRecordingUploadConsentOn(): boolean {
  return readRecordingUploadConsent() === 'on';
}

/**
 * PR 14 (T4, A12): consent to send step-5 spoken answers to the Server and
 * its speech-recognition service for grading. Separate from the upload
 * consent above, which was asked for another purpose. A learner who says no
 * keeps self-assessment and is asked again at most once in 7 days.
 */
export const EVALUATION_CONSENT_KEY = 'speaking.evaluation_consent';
export const EVALUATION_CONSENT_ASKED_AT_KEY =
  'speaking.evaluation_consent_asked_at';
export const EVALUATION_CONSENT_ASK_AGAIN_MS = 7 * 24 * 60 * 60 * 1000;

function readSetting(key: string): string | null {
  const row = getDatabase()
    .execute('SELECT value FROM app_settings WHERE key = ? LIMIT 1;', [key])
    .rows?.item(0) as {value?: string} | undefined;
  return row?.value ?? null;
}

function writeSetting(key: string, value: string, now: string): void {
  getDatabase().execute(
    'INSERT OR REPLACE INTO app_settings (key, value, updated_at) VALUES (?, ?, ?);',
    [key, value, now],
  );
}

export function readEvaluationConsent(): RecordingUploadConsentValue {
  const value = readSetting(EVALUATION_CONSENT_KEY);
  return value === 'on' || value === 'off' ? value : 'undecided';
}

export function isEvaluationConsentOn(): boolean {
  return readEvaluationConsent() === 'on';
}

/** Records the learner's answer to the consent question (or the settings switch). */
export function setEvaluationConsent(
  value: 'on' | 'off',
  now: Date = new Date(),
): void {
  const at = now.toISOString();
  writeSetting(EVALUATION_CONSENT_KEY, value, at);
  writeSetting(EVALUATION_CONSENT_ASKED_AT_KEY, at, at);
}

/** Ask when undecided, or again 7 days after a "no". */
export function shouldAskEvaluationConsent(now: Date = new Date()): boolean {
  const consent = readEvaluationConsent();
  if (consent === 'on') return false;
  if (consent === 'undecided') return true;
  const askedAt = Date.parse(
    readSetting(EVALUATION_CONSENT_ASKED_AT_KEY) ?? '',
  );
  return (
    !Number.isFinite(askedAt) ||
    now.getTime() - askedAt >= EVALUATION_CONSENT_ASK_AGAIN_MS
  );
}

/**
 * Pronunciation step 3: consent to send a pronunciation reading to the
 * Server and Microsoft Azure Speech for scoring. Separate from the grading
 * consent above: another processor, and the audio is deleted once scored
 * rather than kept 30 days. A "no" is asked again at most once in 7 days.
 */
export const PRONUNCIATION_CONSENT_KEY = 'speaking.pronunciation_consent';
export const PRONUNCIATION_CONSENT_ASKED_AT_KEY =
  'speaking.pronunciation_consent_asked_at';

export function readPronunciationConsent(): RecordingUploadConsentValue {
  const value = readSetting(PRONUNCIATION_CONSENT_KEY);
  return value === 'on' || value === 'off' ? value : 'undecided';
}

export function isPronunciationConsentOn(): boolean {
  return readPronunciationConsent() === 'on';
}

/** Records the learner's answer to the consent question (or the settings switch). */
export function setPronunciationConsent(
  value: 'on' | 'off',
  now: Date = new Date(),
): void {
  const at = now.toISOString();
  writeSetting(PRONUNCIATION_CONSENT_KEY, value, at);
  writeSetting(PRONUNCIATION_CONSENT_ASKED_AT_KEY, at, at);
}

/** Ask when undecided, or again 7 days after a "no". */
export function shouldAskPronunciationConsent(now: Date = new Date()): boolean {
  const consent = readPronunciationConsent();
  if (consent === 'on') return false;
  if (consent === 'undecided') return true;
  const askedAt = Date.parse(
    readSetting(PRONUNCIATION_CONSENT_ASKED_AT_KEY) ?? '',
  );
  return (
    !Number.isFinite(askedAt) ||
    now.getTime() - askedAt >= EVALUATION_CONSENT_ASK_AGAIN_MS
  );
}
