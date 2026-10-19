type Translate = (key: string, options?: Record<string, unknown>) => string;

/** E3: what a failed moment says, by the server's error code (no credit was used for these). */
export function momentFailureMessage(
  code: string | undefined,
  t: Translate,
  limit?: number,
): string {
  switch (code) {
    case 'COMPOSE_LIMIT_REACHED':
      return limit !== undefined
        ? t('moment.limit_reached', {limit})
        : t('moment.limit_reached_plain');
    case 'MOMENT_RUNNING':
      return t('moment.running');
    case 'MOMENT_DISABLED':
      return t('moment.disabled');
    case 'STORE_UNAVAILABLE':
      return t('moment.unavailable');
    case 'MOMENT_CANCELLED':
    case 'MOMENT_EXPIRED':
      return t('moment.cancelled_no_credit');
    case 'MOMENT_NOT_SUITABLE':
      return t('moment.not_suitable');
    case 'MOMENT_AUTHOR_FAILED':
      return t('moment.author_failed');
    case 'CONTENT_REJECTED':
      return t('moment.content_rejected');
    default:
      return t('moment.generic_failed');
  }
}

/**
 * What a failed moment offers next:
 * - `system`: our side failed (AI, building, unknown code); try the same situation again.
 * - `not_suitable`: the situation needs more detail; edit the text and send again.
 * - `paused`: creating is off or out of budget for now; retrying at once would fail too.
 * - `limit`: the daily credits are used up.
 * - `cancelled`: the learner said no, or the confirmation window passed.
 * - `pick_other`: this situation cannot be used (gone, or not allowed).
 */
export type MomentFailureKind =
  'system' | 'not_suitable' | 'paused' | 'limit' | 'cancelled' | 'pick_other';

export function momentFailureKind(code: string | undefined): MomentFailureKind {
  switch (code) {
    case 'MOMENT_NOT_SUITABLE':
    case 'COMPOSE_NOT_SUITABLE':
      return 'not_suitable';
    case 'COMPOSE_BUDGET_EXHAUSTED':
    case 'MOMENT_DISABLED':
    case 'STORE_UNAVAILABLE':
      return 'paused';
    case 'COMPOSE_LIMIT_REACHED':
      return 'limit';
    case 'MOMENT_CANCELLED':
    case 'MOMENT_EXPIRED':
      return 'cancelled';
    case 'SITUATION_NOT_FOUND':
    case 'CONTENT_REJECTED':
      return 'pick_other';
    default:
      return 'system';
  }
}

/** The failure screen's heading and explanation for a server code. */
export function momentFailureCopy(
  code: string | undefined,
  t: Translate,
  limit?: number,
): {kind: MomentFailureKind; title: string; message: string} {
  const kind = momentFailureKind(code);
  switch (kind) {
    case 'not_suitable':
      return {
        kind,
        title: t('moment.fail_vague_title'),
        message: t('moment.fail_vague_body'),
      };
    case 'paused':
      return {
        kind,
        title: t('moment.fail_paused_title'),
        message: t('moment.fail_paused_body'),
      };
    case 'limit':
      return {
        kind,
        title: t('moment.fail_limit_title'),
        message: momentFailureMessage(code, t, limit),
      };
    case 'cancelled':
      return {
        kind,
        title: t('moment.fail_cancelled_title'),
        message: t('moment.cancelled_no_credit'),
      };
    case 'pick_other':
      return {
        kind,
        title: t('moment.fail_pick_other_title'),
        message:
          code === 'CONTENT_REJECTED'
            ? t('moment.content_rejected')
            : t('moment.fail_situation_gone'),
      };
    default:
      return {
        kind,
        title: t('moment.fail_system_title'),
        message: t('moment.fail_system_body'),
      };
  }
}

/** Codes whose server message is already written for the learner (Vietnamese). */
const IMAGE_CODES_WITH_LEARNER_MESSAGE = new Set([
  'IMAGE_TOO_LARGE',
  'IMAGE_UNSUPPORTED',
  'IMAGE_REJECTED',
  'OCR_PROVIDER_ERROR',
]);

/** E3: what a failed photo analysis says (`analyzeImage` result). */
export function imageAnalysisFailureMessage(
  failure: {kind: string; errorCode: string; message: string},
  t: Translate,
): string {
  if (failure.errorCode === 'IMAGE_ANALYZE_TIMEOUT') {
    return t('errors.ocr_timeout');
  }
  if (failure.kind === 'network-error') {
    return t('errors.network_lost');
  }
  if (failure.kind === 'auth-error') {
    return t('errors.session_expired');
  }
  if (failure.errorCode === 'RATE_LIMIT_EXCEEDED') {
    return t('errors.rate_limit_exceeded');
  }
  if (IMAGE_CODES_WITH_LEARNER_MESSAGE.has(failure.errorCode)) {
    return failure.message;
  }
  return t('errors.ocr_failed');
}
