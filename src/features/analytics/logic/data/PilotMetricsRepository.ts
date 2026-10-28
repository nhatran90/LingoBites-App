/**
 * Repository and calculator for Capability Progress Report (REQ-39 / VC-12)
 * and Privacy-Safe Pilot Metrics (M8 Pilot Readiness).
 *
 * Exposes capability metrics, before/after recording comparisons, and privacy-safe
 * metrics export. Excludes raw text, audio bytes, and file paths from exported JSON per CON-6.
 */

import {listErrorEvents, listSpeakingRecordings} from '@features/speaking';

import {getAppVersion} from '@core/api/appConfig';
import {getDatabase} from '@core/db/database';

export type CapabilityProgressReport = {
  sentencesSpokenWithoutLookingCount: number;
  averageStartToAnswerMs: number | null;
  startToAnswerTimeFormatted: string;
  firstListenComprehensionRate: number | null; // 0..100 percentage or null if no data
  retention7DayRate: number | null; // 0..100 percentage or null if no data
  retention30DayRate: number | null; // 0..100 percentage or null if no data
  passedSituationsCount: number;
  beforeAfterRecordings: {
    earliest: {
      id: string;
      mode: string;
      createdAt: string;
      durationMs: number;
      filePath: string;
    } | null;
    latest: {
      id: string;
      mode: string;
      createdAt: string;
      durationMs: number;
      filePath: string;
    } | null;
  };
};

export type PrivacySafeMetricsExport = {
  schema_version: 'lingobites-pilot-metrics-v1';
  exported_at: string;
  app_version: string;
  aggregate_metrics: {
    sentences_spoken_without_looking: number;
    avg_start_to_answer_ms: number | null;
    first_listen_comprehension_rate: number | null;
    retention_7d_rate: number | null;
    retention_30d_rate: number | null;
    passed_situations_count: number;
    total_recordings_count: number;
    total_speaking_duration_ms: number;
    total_review_sessions_count: number;
    error_events_by_category: Record<string, number>;
  };
};

function formatDurationMs(ms: number | null): string {
  if (ms === null) {
    return 'Chưa đủ dữ liệu';
  }
  const seconds = (ms / 1000).toFixed(1);
  return `${seconds} giây`;
}

function formatPercentage(rate: number | null): string {
  if (rate === null) {
    return 'Chưa đủ dữ liệu';
  }
  return `${Math.round(rate)}%`;
}

export {formatDurationMs, formatPercentage};

/**
 * Calculates capability progress metrics (REQ-39) using SQLite data from
 * review_sessions, speaking_recordings, error_events, and app_settings.
 */
export function getCapabilityProgressReport(
  nowIso?: string,
): CapabilityProgressReport {
  const db = getDatabase();
  const now = nowIso ? new Date(nowIso) : new Date();

  // 1. Spoken without looking count
  let sentencesSpokenWithoutLookingCount = 0;
  try {
    const recordings = listSpeakingRecordings();
    // Shadowing and standup / quick answer modes where learner speaks without looking at prompt
    sentencesSpokenWithoutLookingCount = recordings.filter(
      r =>
        r.mode === 'shadowing' ||
        r.mode === 'quick_answer' ||
        r.mode === 'standup',
    ).length;
  } catch (_e) {
    sentencesSpokenWithoutLookingCount = 0;
  }

  // 2. Start-to-answer time
  let averageStartToAnswerMs: number | null = null;
  try {
    const recordings = listSpeakingRecordings();
    if (recordings.length > 0) {
      // Approximate start-to-answer / response duration in speaking attempts
      const totalDuration = recordings.reduce(
        (acc, r) => acc + r.durationMs,
        0,
      );
      averageStartToAnswerMs = Math.round(totalDuration / recordings.length);
    }
  } catch (_e) {
    averageStartToAnswerMs = null;
  }

  // 3. First-listen comprehension rate
  let firstListenComprehensionRate: number | null = null;
  try {
    const res = db.execute(
      "SELECT value FROM app_settings WHERE key = 'first_listen_attempts';",
    );
    const row = res.rows?.item(0) as {value: string} | undefined;
    if (row && row.value) {
      const parsed = JSON.parse(row.value) as {total: number; correct: number};
      if (parsed.total > 0) {
        firstListenComprehensionRate = Math.round(
          (parsed.correct / parsed.total) * 100,
        );
      }
    }
  } catch (_e) {
    firstListenComprehensionRate = null;
  }

  // 4. 7-day and 30-day retention rates from review_sessions
  let retention7DayRate: number | null = null;
  let retention30DayRate: number | null = null;

  try {
    const ms7Days = 7 * 24 * 60 * 60 * 1000;
    const ms30Days = 30 * 24 * 60 * 60 * 1000;
    const date7DaysAgoIso = new Date(now.getTime() - ms7Days).toISOString();
    const date30DaysAgoIso = new Date(now.getTime() - ms30Days).toISOString();

    const res7d = db.execute(
      'SELECT rating FROM review_sessions WHERE reviewed_at >= ?;',
      [date7DaysAgoIso],
    );
    const rows7d = res7d.rows;
    if (rows7d && rows7d.length > 0) {
      let goodCount = 0;
      for (let i = 0; i < rows7d.length; i += 1) {
        const rating = (rows7d.item(i) as {rating: string}).rating;
        if (rating === 'good' || rating === 'easy' || rating === 'pass') {
          goodCount += 1;
        }
      }
      retention7DayRate = Math.round((goodCount / rows7d.length) * 100);
    }

    const res30d = db.execute(
      'SELECT rating FROM review_sessions WHERE reviewed_at >= ?;',
      [date30DaysAgoIso],
    );
    const rows30d = res30d.rows;
    if (rows30d && rows30d.length > 0) {
      let goodCount = 0;
      for (let i = 0; i < rows30d.length; i += 1) {
        const rating = (rows30d.item(i) as {rating: string}).rating;
        if (rating === 'good' || rating === 'easy' || rating === 'pass') {
          goodCount += 1;
        }
      }
      retention30DayRate = Math.round((goodCount / rows30d.length) * 100);
    }
  } catch (_e) {
    retention7DayRate = null;
    retention30DayRate = null;
  }

  // 5. Passed situations count (weekly sessions and stage checks passed)
  let passedSituationsCount = 0;
  try {
    const res = db.execute(
      "SELECT value FROM app_settings WHERE key = 'passed_situations';",
    );
    const row = res.rows?.item(0) as {value: string} | undefined;
    if (row && row.value) {
      const parsed = JSON.parse(row.value) as {count: number};
      passedSituationsCount = parsed.count || 0;
    } else {
      // Fallback count from review_sessions rating = 'pass'
      const passRes = db.execute(
        "SELECT COUNT(*) as cnt FROM review_sessions WHERE rating = 'pass';",
      );
      passedSituationsCount =
        (passRes.rows?.item(0) as {cnt: number} | undefined)?.cnt || 0;
    }
  } catch (_e) {
    passedSituationsCount = 0;
  }

  // 6. Before / after recordings comparison
  let earliest = null;
  let latest = null;
  try {
    const recordings = listSpeakingRecordings();
    if (recordings.length > 0) {
      const sorted = [...recordings].sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
      earliest = sorted[0];
      if (sorted.length > 1) {
        latest = sorted[sorted.length - 1];
      }
    }
  } catch (_e) {
    earliest = null;
    latest = null;
  }

  return {
    sentencesSpokenWithoutLookingCount,
    averageStartToAnswerMs,
    startToAnswerTimeFormatted: formatDurationMs(averageStartToAnswerMs),
    firstListenComprehensionRate,
    retention7DayRate,
    retention30DayRate,
    passedSituationsCount,
    beforeAfterRecordings: {
      earliest: earliest
        ? {
            id: earliest.id,
            mode: earliest.mode,
            createdAt: earliest.createdAt,
            durationMs: earliest.durationMs,
            filePath: earliest.filePath,
          }
        : null,
      latest: latest
        ? {
            id: latest.id,
            mode: latest.mode,
            createdAt: latest.createdAt,
            durationMs: latest.durationMs,
            filePath: latest.filePath,
          }
        : null,
    },
  };
}

/**
 * Generates privacy-safe metrics export object excluding raw learner text,
 * audio bytes, recognized speech, and local file paths (CON-6).
 */
export function exportPrivacySafeMetrics(
  nowIso?: string,
): PrivacySafeMetricsExport {
  const report = getCapabilityProgressReport(nowIso);
  const recordings = listSpeakingRecordings();
  const errors = listErrorEvents();

  const totalRecordingsCount = recordings.length;
  const totalSpeakingDurationMs = recordings.reduce(
    (acc, r) => acc + r.durationMs,
    0,
  );

  const errorEventsByCategory: Record<string, number> = {};
  for (const err of errors) {
    errorEventsByCategory[err.category] =
      (errorEventsByCategory[err.category] || 0) + 1;
  }

  let totalReviewSessionsCount = 0;
  try {
    const db = getDatabase();
    const res = db.execute('SELECT COUNT(*) as cnt FROM review_sessions;');
    totalReviewSessionsCount =
      (res.rows?.item(0) as {cnt: number} | undefined)?.cnt || 0;
  } catch (_e) {
    totalReviewSessionsCount = 0;
  }

  return {
    schema_version: 'lingobites-pilot-metrics-v1',
    exported_at: nowIso ?? new Date().toISOString(),
    app_version: getAppVersion(),
    aggregate_metrics: {
      sentences_spoken_without_looking:
        report.sentencesSpokenWithoutLookingCount,
      avg_start_to_answer_ms: report.averageStartToAnswerMs,
      first_listen_comprehension_rate: report.firstListenComprehensionRate,
      retention_7d_rate: report.retention7DayRate,
      retention_30d_rate: report.retention30DayRate,
      passed_situations_count: report.passedSituationsCount,
      total_recordings_count: totalRecordingsCount,
      total_speaking_duration_ms: totalSpeakingDurationMs,
      total_review_sessions_count: totalReviewSessionsCount,
      error_events_by_category: errorEventsByCategory,
    },
  };
}
