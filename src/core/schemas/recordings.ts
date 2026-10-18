import {z} from 'zod';

/**
 * Speaking-recording contracts (SETE-292 T5).
 *
 * Uploads use backend streaming: POST creates pending metadata and hands
 * back a same-API PUT upload URL; PUT streams the bytes through the server
 * so MIME, size and SHA-256 are validated before the row completes.
 */

export const RecordingStatusSchema = z.enum(['pending_upload', 'completed']);

export const SpeakingModeRecordingSchema = z.enum([
  'shadowing',
  'quick_answer',
  'standup',
  'app_description',
  'bug_report',
  'mock_interview',
]);

export const CreateRecordingRequestSchema = z.object({
  mime_type: z.string().min(1).max(127),
  byte_size: z.number().int(),
  sha256: z.string().length(64),
  client_recording_id: z.string().guid(),
  lesson_id: z.string().guid(),
  sentence_id: z.string().guid(),
  mode: SpeakingModeRecordingSchema,
  duration_ms: z.number().int().min(1).max(35000),
});

/**
 * PR 13–14: a spoken answer to a step-5 or summative task, uploaded for
 * grading (Server `CreateLessonTaskRecordingRequestSchema`).
 */
export const CreateLessonTaskRecordingRequestSchema = z
  .object({
    client_recording_id: z.string().guid(),
    mode: z.literal('lesson_task'),
    attempt_id: z.string().guid(),
    target: z.union([
      z.object({lesson_id: z.string().guid(), block_id: z.string().guid()}),
      z.object({unit_id: z.string().guid(), task_id: z.string().guid()}),
    ]),
    support_level: z.enum(['none', 'hint_1', 'hint_2', 'model']),
    duration_ms: z.number().int().min(1).max(90_000),
    mime_type: z.string().min(1).max(127),
    byte_size: z.number().int(),
    sha256: z.string().length(64),
  })
  .strict();

export type CreateLessonTaskRecordingRequest = z.infer<
  typeof CreateLessonTaskRecordingRequestSchema
>;

/** Pronunciation step 3: longest reading of one item, in milliseconds. */
export const PRONUNCIATION_MAX_DURATION_MS = 15_000;

/**
 * Pronunciation step 3: one pronunciation item read aloud, uploaded for
 * scoring (Server `CreatePronunciationRecordingRequestSchema`).
 */
export const CreatePronunciationRecordingRequestSchema = z
  .object({
    client_recording_id: z.string().guid(),
    mode: z.literal('pronunciation'),
    item_id: z.string().guid(),
    duration_ms: z.number().int().min(1).max(PRONUNCIATION_MAX_DURATION_MS),
    mime_type: z.string().min(1).max(127),
    byte_size: z.number().int(),
    sha256: z.string().length(64),
  })
  .strict();

export type CreatePronunciationRecordingRequest = z.infer<
  typeof CreatePronunciationRecordingRequestSchema
>;

export const RecordingViewSchema = z.object({
  recording_id: z.string().guid(),
  status: RecordingStatusSchema,
  mime_type: z.string(),
  byte_size: z.number().int(),
  sha256: z.string(),
  upload_expires_at: z.string(),
  created_at: z.string(),
  completed_at: z.string().nullable(),
  client_recording_id: z.string().guid().optional(),
  lesson_id: z.string().guid().optional(),
  sentence_id: z.string().guid().optional(),
  mode: z
    .enum([
      ...SpeakingModeRecordingSchema.options,
      'lesson_task',
      'pronunciation',
    ])
    .optional(),
  duration_ms: z.number().int().optional(),
  attempt_id: z.string().guid().optional(),
  /** Pronunciation step 3: the item read, on a `pronunciation` recording. */
  item_id: z.string().guid().optional(),
});

export const CreateRecordingSuccessResponseSchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  recording: RecordingViewSchema,
  upload: z.object({
    method: z.literal('PUT'),
    url: z.string(),
    content_type: z.string(),
  }),
});

export const RecordingSuccessResponseSchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  recording: RecordingViewSchema,
});

export const ListRecordingsSuccessResponseSchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  recordings: z.array(RecordingViewSchema),
});

export const DeleteRecordingSuccessResponseSchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  recording_id: z.string().guid(),
  deleted: z.literal(true),
});

export type CreateRecordingRequest = z.infer<
  typeof CreateRecordingRequestSchema
>;
export type CreateRecordingSuccessResponse = z.infer<
  typeof CreateRecordingSuccessResponseSchema
>;
export type RecordingSuccessResponse = z.infer<
  typeof RecordingSuccessResponseSchema
>;
export type ListRecordingsSuccessResponse = z.infer<
  typeof ListRecordingsSuccessResponseSchema
>;
export type DeleteRecordingSuccessResponse = z.infer<
  typeof DeleteRecordingSuccessResponseSchema
>;
