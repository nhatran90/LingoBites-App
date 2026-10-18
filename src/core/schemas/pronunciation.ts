import {z} from 'zod';

/**
 * Pronunciation step 3: the scores of one reading of a pronunciation item.
 * Mirror of the Server's `PronunciationAttemptResponseSchema`, the body of
 * `GET /v1/pronunciation/attempts/:recordingId`. It holds scores and the
 * reference words only, never what the learner said: a word the learner
 * added comes back as an `insertion` without its text.
 */

export const PronunciationAttemptStatusValues = [
  'pending',
  'scored',
  'unscorable',
  'failed',
] as const;
export type PronunciationAttemptStatus =
  (typeof PronunciationAttemptStatusValues)[number];

export const PronunciationUnscorableReasonValues = [
  'too_short',
  'no_speech',
  'limit',
  'target_gone',
] as const;
export type PronunciationUnscorableReason =
  (typeof PronunciationUnscorableReasonValues)[number];

export const PronunciationErrorTypeValues = [
  'none',
  'mispronunciation',
  'omission',
  'insertion',
] as const;
export type PronunciationErrorType =
  (typeof PronunciationErrorTypeValues)[number];

const Score = z.number().int().min(0).max(100).nullable();

export const PronunciationWordSchema = z.object({
  /** A reference word; null for a word the learner added. */
  text: z.string().nullable(),
  accuracy: Score,
  error: z.enum(PronunciationErrorTypeValues),
  phonemes: z.array(z.object({ipa: z.string(), accuracy: Score})),
});
export type PronunciationWord = z.infer<typeof PronunciationWordSchema>;

export const PronunciationScoresSchema = z.object({
  pron: Score,
  accuracy: Score,
  fluency: Score,
  completeness: Score,
  prosody: Score,
});
export type PronunciationScores = z.infer<typeof PronunciationScoresSchema>;

export const PronunciationAttemptSchema = z.object({
  recording_id: z.string().guid(),
  item_id: z.string().guid().nullable(),
  status: z.enum(PronunciationAttemptStatusValues),
  unscorable_reason: z.enum(PronunciationUnscorableReasonValues).nullable(),
  reference_text: z.string().nullable(),
  scores: PronunciationScoresSchema.nullable(),
  words: z.array(PronunciationWordSchema),
  created_at: z.string().nullable(),
});
export type PronunciationAttempt = z.infer<typeof PronunciationAttemptSchema>;

export const PronunciationAttemptResponseSchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  attempt: PronunciationAttemptSchema,
});

/** The part of the public `GET /v1/capabilities` this feature reads. */
export const PronunciationCapabilitySchema = z.object({
  capabilities: z.object({
    pronunciation: z.object({enabled: z.boolean()}),
  }),
});
