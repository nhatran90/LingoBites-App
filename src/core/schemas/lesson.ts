import {z} from 'zod';

/**
 * Canonical lesson contract mirror (LING-149 TASK-007, AD-009).
 *
 * The Server owns this contract (`LingoBites-Server`
 * `src/modules/canonicalLesson/model/` on `integration/LING-149`); this
 * module mirrors it instead of redefining the shapes. Bump
 * `LESSON_CONTRACT_VERSION` only together with the Server. A `contract_version`
 * mismatch surfaces an "update the app" state and is never parsed leniently.
 *
 * The contract tests under `__tests__` parse byte-identical copies of the
 * Server fixtures and check their SHA-256 pins (`./fixtures.ts`), so any drift
 * fails the build.
 *
 * Backward-design curriculum (PR 5): one version. The snapshot carries the
 * lesson specification, its catalog items and tasks; the retired v2
 * `items[]` (derived learning items) is rejected, so the Server must keep
 * `LESSON_SNAPSHOT_ITEMS_ENABLED` off until it drops that field.
 */

export const LESSON_CONTRACT_VERSION = 1;

export const LESSON_CONTRACT_FIXTURE_REVISION = 'backward-design-pr5';

export const LessonContractVersionSchema = z.literal(LESSON_CONTRACT_VERSION);

export const LessonOriginValues = ['admin', 'learner'] as const;

export const LessonOriginSchema = z.enum(LessonOriginValues);

export type LessonOrigin = z.infer<typeof LessonOriginSchema>;

export const LessonSourceTypeValues = [
  'admin_text',
  'learner_text',
  'learner_ocr',
  'youtube',
  'learner_situation',
] as const;

export const LessonSourceTypeSchema = z.enum(LessonSourceTypeValues);

export type LessonSourceType = z.infer<typeof LessonSourceTypeSchema>;

/** `item_cards` replaced the `vocabulary` and `grammar` blocks (Server PR 4). */
export const CanonicalLessonBlockTypeValues = [
  'text',
  'example',
  'media',
  'context',
  'activity',
  'item_cards',
] as const;

export const CanonicalLessonBlockTypeSchema = z.enum(
  CanonicalLessonBlockTypeValues,
);

export type CanonicalLessonBlockType = z.infer<
  typeof CanonicalLessonBlockTypeSchema
>;

export const NonBlankTextSchema = z
  .string()
  .refine(value => value.trim().length > 0, {
    message: 'must not be blank',
  });

export const LessonSentenceSchema = z
  .object({
    id: z.string().guid(),
    position: z.number().int().min(0),
    text_en: NonBlankTextSchema,
    text_vi: NonBlankTextSchema,
    ipa: NonBlankTextSchema,
    /** `ipa` split over the words of `text_en`; null for a word with no IPA. */
    ipa_words: z.array(NonBlankTextSchema.nullable()).nullable().optional(),
    start_ms: z.number().int().min(0).nullable(),
    end_ms: z.number().int().nullable(),
  })
  .strict();

export type LessonSentence = z.infer<typeof LessonSentenceSchema>;

export const LessonUnitSchema = z
  .object({
    course_id: z.string().guid(),
    course_title: z.string(),
    level_id: z.string().guid(),
    level_title: z.string(),
    unit_id: z.string().guid(),
    unit_title: z.string(),
    unit_position: z.number().int(),
    lesson_position: z.number().int(),
  })
  .strict();

export type LessonUnit = z.infer<typeof LessonUnitSchema>;

export const LessonYoutubeSchema = z
  .object({
    video_id: z.string().min(1),
    duration_ms: z.number().int().min(0),
  })
  .strict();

export type LessonYoutube = z.infer<typeof LessonYoutubeSchema>;

export const LessonBlockSchema = z
  .object({
    id: z.string().guid(),
    type: CanonicalLessonBlockTypeSchema,
    position: z.number().int().min(0),
    title: z.string().nullable(),
    data: z.record(z.string(), z.unknown()),
    /** Lesson step 1–6 (6 is the result screen), skill and duration. */
    step: z.number().int().min(1).max(6).nullable().optional(),
    skill: z.enum(['speak', 'listen', 'write']).nullable().optional(),
    duration_sec: z.number().int().positive().nullable().optional(),
  })
  .strict();

export type LessonBlock = z.infer<typeof LessonBlockSchema>;

/** Item ids an `item_cards` block shows; `[]` for any other block. */
export function itemCardIds(block: LessonBlock): string[] {
  if (block.type !== 'item_cards' || !Array.isArray(block.data.item_ids)) {
    return [];
  }
  return block.data.item_ids.filter(
    (id): id is string => typeof id === 'string',
  );
}

export const AnalysisVocabularyItemSchema = z
  .object({
    id: z.string().guid(),
    word: NonBlankTextSchema,
    pos: NonBlankTextSchema,
    ipa: NonBlankTextSchema,
    meaning: NonBlankTextSchema,
  })
  .strict();

export type AnalysisVocabularyItem = z.infer<
  typeof AnalysisVocabularyItemSchema
>;

export const AnalysisGrammarItemSchema = z
  .object({
    id: z.string().guid(),
    name: NonBlankTextSchema,
    description: NonBlankTextSchema,
    formula: NonBlankTextSchema,
    analysis: NonBlankTextSchema,
  })
  .strict();

export type AnalysisGrammarItem = z.infer<typeof AnalysisGrammarItemSchema>;

export const LessonAnalysisSchema = z
  .object({
    sentence_id: z.string().guid(),
    vocabulary: z.array(AnalysisVocabularyItemSchema),
    grammar: z.array(AnalysisGrammarItemSchema),
    created_at: z.string(),
  })
  .strict();

export type LessonAnalysis = z.infer<typeof LessonAnalysisSchema>;

export const LessonCatalogItemSchema = z
  .object({
    id: z.string().guid(),
    title: z.string(),
    description: z.string(),
    origin: LessonOriginSchema,
    source_type: LessonSourceTypeSchema,
    content_revision: z.number().int().min(1),
    sentence_count: z.number().int().min(0),
    youtube_video_id: z.string().min(1).nullable(),
    unit: LessonUnitSchema.nullable(),
    updated_at: z.string(),
    /** Sent with `include=card_meta`; absent on older servers. */
    estimated_minutes: z.number().int().min(0).nullable().optional(),
    youtube_duration_ms: z.number().int().min(0).nullable().optional(),
    activity_count: z.number().int().min(0).optional(),
    /** Sent with `include=card_meta`: lesson code and can-do statements. */
    code: z.string().nullable().optional(),
    can_do: z.array(z.string()).optional(),
    /**
     * Sent with `include=video_meta`: for a public video (admin YouTube
     * lesson outside any unit), how many published unit lessons were made
     * from it; null for any other lesson.
     */
    video_lesson_count: z.number().int().min(0).nullable().optional(),
    /**
     * Sent with `include=cover_meta`: the cover picture (the lesson's, else
     * its unit's) and the CEFR level for the library card; null when none.
     */
    cover_url: z.string().nullable().optional(),
    cefr_level: z.string().nullable().optional(),
  })
  .strict();

export type LessonCatalogItem = z.infer<typeof LessonCatalogItemSchema>;

export const LessonCatalogResponseSchema = z
  .object({
    contract_version: LessonContractVersionSchema,
    lessons: z.array(LessonCatalogItemSchema),
    next_cursor: z.string().nullable(),
  })
  .strict();

export type LessonCatalogResponse = z.infer<typeof LessonCatalogResponseSchema>;

/** `GET /api/v1/lessons/:id/video-lessons`: unit lessons made from the video. */
export const LessonVideoLessonsResponseSchema = z
  .object({
    contract_version: LessonContractVersionSchema,
    lessons: z.array(LessonCatalogItemSchema),
  })
  .strict();

export type LessonVideoLessonsResponse = z.infer<
  typeof LessonVideoLessonsResponseSchema
>;

/** Public catalog narrowing: public videos, or everything but them. */
export type LessonCatalogKind = 'video' | 'lesson';

const AudienceValues = ['all', 'kids', 'adults'] as const;

export const AudienceSchema = z.enum(AudienceValues);

export type Audience = z.infer<typeof AudienceSchema>;

/** Media embedded in a snapshot (the shape a media block carries). */
export const SnapshotMediaSchema = z
  .object({
    id: z.string().guid(),
    title: z.string(),
    mime_type: z.string(),
    object_key: z.string(),
  })
  .strict();

export type SnapshotMedia = z.infer<typeof SnapshotMediaSchema>;

export const LessonSituationSchema = z
  .object({
    speaker: z.string(),
    listener: z.string(),
    place: z.string(),
    purpose: z.string(),
  })
  .strict();

export type LessonSituation = z.infer<typeof LessonSituationSchema>;

/** Lesson specification: outcome, situation, prerequisites. Null for learner lessons. */
export const LessonSpecSchema = z
  .object({
    code: z.string().nullable(),
    audience: AudienceSchema,
    can_do: z.array(z.string()),
    situation: LessonSituationSchema.nullable(),
    estimated_minutes: z.number().int().nullable(),
    prerequisites: z.array(
      z
        .object({
          lesson_id: z.string().guid(),
          code: z.string().nullable(),
          title: z.string(),
        })
        .strict(),
    ),
  })
  .strict();

export type LessonSpec = z.infer<typeof LessonSpecSchema>;

export const CatalogItemKindValues = [
  'word',
  'phrase',
  'pattern',
  'pronunciation',
  'listening',
  'grammar',
] as const;

export const CatalogItemKindSchema = z.enum(CatalogItemKindValues);

export type CatalogItemKind = z.infer<typeof CatalogItemKindSchema>;

/**
 * A catalog item as the learner downloads it. `payload` is kind-specific and
 * read through `@core/learning` (`parseItemPayload`), like the Server does.
 */
export const CatalogItemSchema = z
  .object({
    id: z.string().guid(),
    code: z.string(),
    kind: CatalogItemKindSchema,
    text: z.string(),
    meaning_vi: z.string(),
    ipa: z.string().nullable(),
    part_of_speech: z.string().nullable(),
    note_vi: z.string().nullable(),
    audience: AudienceSchema,
    payload: z.record(z.string(), z.unknown()),
    audio: SnapshotMediaSchema.nullable(),
    image: SnapshotMediaSchema.nullable(),
    examples: z.array(
      z
        .object({
          text_en: z.string(),
          text_vi: z.string(),
          audience: AudienceSchema,
          audio: SnapshotMediaSchema.nullable(),
        })
        .strict(),
    ),
    variants: z.array(
      z.object({text: z.string(), note_vi: z.string().nullable()}).strict(),
    ),
    errors: z.array(
      z
        .object({
          code: z.string(),
          description_vi: z.string(),
          feedback_vi: z.string(),
          severity: z.enum(['blocking', 'tolerated']),
          wrong_example: z.string().nullable(),
          right_example: z.string().nullable(),
        })
        .strict(),
    ),
  })
  .strict();

export type CatalogItem = z.infer<typeof CatalogItemSchema>;

export const LessonItemRoleValues = ['required', 'extended'] as const;
export const LessonItemIntroductionValues = [
  'new',
  'recycled',
  'prerequisite',
] as const;

export const LessonItemEntrySchema = z
  .object({
    role: z.enum(LessonItemRoleValues),
    introduction: z.enum(LessonItemIntroductionValues),
    position: z.number().int().min(0),
    item: CatalogItemSchema,
  })
  .strict();

export type LessonItemEntry = z.infer<typeof LessonItemEntrySchema>;

export const LessonTaskSchema = z
  .object({
    id: z.string().guid(),
    kind: z.enum(['guided', 'variation', 'independent']),
    title_vi: z.string(),
    prompt_vi: z.string(),
    situation: LessonSituationSchema.nullable(),
    response_mode: z.enum(['speak', 'write', 'choose']),
    hint_levels: z.array(z.record(z.string(), z.unknown())),
    position: z.number().int().min(0),
    item_codes: z.array(z.string()),
    criteria: z.array(
      z
        .object({
          criterion: z.enum(['purpose', 'content', 'clarity', 'independence']),
          required: z.boolean(),
          threshold: z.number().nullable(),
        })
        .strict(),
    ),
  })
  .strict();

export type LessonTask = z.infer<typeof LessonTaskSchema>;

/**
 * PR 16: a unit's summative task (`GET /v1/units/:unitId/summative-task`),
 * in the shape of a snapshot task with the unit it belongs to.
 */
export const UnitSummativeTaskSchema = LessonTaskSchema.extend({
  kind: z.literal('summative'),
  unit_id: z.string().guid(),
});

export type UnitSummativeTask = z.infer<typeof UnitSummativeTaskSchema>;

export const UnitSummativeTaskResponseSchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  task: UnitSummativeTaskSchema.nullable(),
});

export const LessonSnapshotSchema = z
  .object({
    id: z.string().guid(),
    slug: z.string(),
    title: z.string(),
    description: z.string(),
    origin: LessonOriginSchema,
    source_type: LessonSourceTypeSchema,
    content_revision: z.number().int().min(1),
    unit: LessonUnitSchema.nullable(),
    youtube: LessonYoutubeSchema.nullable(),
    sentences: z.array(LessonSentenceSchema),
    blocks: z.array(LessonBlockSchema),
    analyses: z.record(z.string(), LessonAnalysisSchema),
    /**
     * Lesson specification, focus items and tasks. Learner lessons carry
     * null / []; a Server running with LESSON_SNAPSHOT_SPEC_ENABLED=false omits
     * them, which reads as the same.
     */
    spec: LessonSpecSchema.nullable().optional(),
    lesson_items: z.array(LessonItemEntrySchema).optional(),
    tasks: z.array(LessonTaskSchema).optional(),
    /**
     * S4.3: only on the learner's own lesson composed from picked sentences
     * ("AI tạo"): the lesson the sentences came from (null once deleted) and
     * whether the situation came from it or the AI inferred one.
     */
    generated: z.literal(true).optional(),
    derived_from_lesson_id: z.string().guid().nullable().optional(),
    situation_source: z.enum(['source', 'inferred']).nullable().optional(),
  })
  .strict();

export type LessonSnapshot = z.infer<typeof LessonSnapshotSchema>;

export const LessonSnapshotResponseSchema = z
  .object({
    contract_version: LessonContractVersionSchema,
    lesson: LessonSnapshotSchema,
  })
  .strict();

export type LessonSnapshotResponse = z.infer<
  typeof LessonSnapshotResponseSchema
>;

export const LessonAnalysisResponseSchema = z
  .object({
    contract_version: LessonContractVersionSchema,
    analysis: LessonAnalysisSchema,
  })
  .strict();

export type LessonAnalysisResponse = z.infer<
  typeof LessonAnalysisResponseSchema
>;

export const LessonRevisionStateSchema = z.enum(['current', 'gone']);

export type LessonRevisionState = z.infer<typeof LessonRevisionStateSchema>;

export const LessonRevisionItemSchema = z
  .object({
    id: z.string().guid(),
    state: LessonRevisionStateSchema,
    content_revision: z.number().int().min(1).nullable(),
  })
  .strict();

export type LessonRevisionItem = z.infer<typeof LessonRevisionItemSchema>;

export const LessonRevisionsRequestSchema = z
  .object({
    lesson_ids: z.array(z.string().guid()).min(1).max(100),
  })
  .strict();

export type LessonRevisionsRequest = z.infer<
  typeof LessonRevisionsRequestSchema
>;

export const LessonRevisionsResponseSchema = z
  .object({
    contract_version: LessonContractVersionSchema,
    revisions: z.array(LessonRevisionItemSchema),
  })
  .strict();

export type LessonRevisionsResponse = z.infer<
  typeof LessonRevisionsResponseSchema
>;

export const LessonCreationStatusValues = [
  'queued',
  'processing',
  'waiting_transcript',
  'awaiting_confirmation',
  'succeeded',
  'failed',
] as const;

export const LessonCreationStatusSchema = z.enum(LessonCreationStatusValues);

export type LessonCreationStatus = z.infer<typeof LessonCreationStatusSchema>;

export const LearnerCreationSourceSchema = z.enum(['text', 'ocr', 'youtube']);

export type LearnerCreationSource = z.infer<typeof LearnerCreationSourceSchema>;

export const LearnerLessonCreationRequestBodySchema = z.union([
  z
    .object({
      source: z.literal('text'),
      text: z.string().trim().min(1),
    })
    .strict(),
  z
    .object({
      source: z.literal('ocr'),
      text: z.string().trim().min(1),
    })
    .strict(),
  z
    .object({
      source: z.literal('youtube'),
      url: z.string().trim().url(),
    })
    .strict(),
]);

export type LearnerLessonCreationRequestBody = z.infer<
  typeof LearnerLessonCreationRequestBodySchema
>;

export const LessonCreationAcceptedResponseSchema = z
  .object({
    contract_version: LessonContractVersionSchema,
    request: z
      .object({
        id: z.string().guid(),
        status: LessonCreationStatusSchema,
      })
      .strict(),
  })
  .strict();

export type LessonCreationAcceptedResponse = z.infer<
  typeof LessonCreationAcceptedResponseSchema
>;

export const LessonCreationErrorSchema = z
  .object({
    code: z.string().min(1),
    retryable: z.boolean(),
  })
  .strict();

export type LessonCreationError = z.infer<typeof LessonCreationErrorSchema>;

/**
 * S4.3: progress of a "Học theo 6 bước" request (Server wait design §2.3).
 * Only compose requests carry it.
 */
export const LessonComposeProgressSchema = z
  .object({
    stage: z.string().nullable(),
    stage_started_at: z.string().nullable(),
    elapsed_ms: z.number().int().min(0),
    /** Typical duration (p50) of the prompt version, for "about N s". */
    expected_ms: z.number().int().min(0),
    /** Whether the request used one of the learner's daily composes. */
    quota_charged: z.boolean(),
    reason_vi: z.string().nullable(),
    suggestion_vi: z.string().nullable(),
    dropped_sentence_ids: z.array(z.string().guid()),
  })
  .strict();

export type LessonComposeProgress = z.infer<typeof LessonComposeProgressSchema>;

export const LessonCreationStatusResponseSchema = z
  .object({
    contract_version: LessonContractVersionSchema,
    status: LessonCreationStatusSchema,
    lesson_id: z.string().guid().nullable(),
    error: LessonCreationErrorSchema.nullable(),
    compose: LessonComposeProgressSchema.optional(),
    /** E2: the situation the AI understood, while awaiting the learner's confirmation. */
    situation_vi: z.string().nullable().optional(),
    confirm_expires_at: z.string().nullable().optional(),
  })
  .strict();

export type LessonCreationStatusResponse = z.infer<
  typeof LessonCreationStatusResponseSchema
>;

/** S4.3: the same picked sentences were composed before (no AI, no quota). */
export const ComposeCachedResponseSchema = z
  .object({
    contract_version: z.literal(1),
    lesson_id: z.string().guid(),
    cached: z.literal(true),
  })
  .strict();

export const ComposeQuotaResponseSchema = z
  .object({
    contract_version: z.literal(1),
    quota: z
      .object({
        limit: z.number().int().min(0),
        used: z.number().int().min(0),
        remaining: z.number().int().min(0),
        resets_at: z.string(),
      })
      .strict(),
  })
  .strict();

export type ComposeQuota = z.infer<typeof ComposeQuotaResponseSchema>['quota'];

export const ActiveComposeResponseSchema = z
  .object({
    contract_version: z.literal(1),
    requests: z.array(
      z
        .object({
          id: z.string().guid(),
          status: LessonCreationStatusSchema,
          source_lesson_id: z.string().guid(),
          source_lesson_title: z.string().nullable(),
          sentence_ids: z.array(z.string().guid()),
          compose: LessonComposeProgressSchema,
        })
        .strict(),
    ),
  })
  .strict();

export type ActiveCompose = z.infer<
  typeof ActiveComposeResponseSchema
>['requests'][number];

/**
 * Parse helpers. Every helper rejects a `contract_version` mismatch so the
 * caller can render the "update the app" state instead of a half-parsed
 * lesson (AD-009).
 */
export function parseLessonCatalogResponse(body: unknown):
  | {
      ok: true;
      response: LessonCatalogResponse;
    }
  | {ok: false; message: string} {
  const parsed = LessonCatalogResponseSchema.safeParse(body);
  if (!parsed.success) {
    return {ok: false, message: 'Lesson catalog response failed validation.'};
  }
  return {ok: true, response: parsed.data};
}

export function parseLessonVideoLessonsResponse(body: unknown):
  | {
      ok: true;
      response: LessonVideoLessonsResponse;
    }
  | {ok: false; message: string} {
  const parsed = LessonVideoLessonsResponseSchema.safeParse(body);
  if (!parsed.success) {
    return {ok: false, message: 'Video lessons response failed validation.'};
  }
  return {ok: true, response: parsed.data};
}

export function parseLessonSnapshotResponse(body: unknown):
  | {
      ok: true;
      response: LessonSnapshotResponse;
    }
  | {ok: false; message: string} {
  const parsed = LessonSnapshotResponseSchema.safeParse(body);
  if (!parsed.success) {
    return {ok: false, message: 'Lesson snapshot response failed validation.'};
  }
  return {ok: true, response: parsed.data};
}

export function parseLessonAnalysisResponse(body: unknown):
  | {
      ok: true;
      response: LessonAnalysisResponse;
    }
  | {ok: false; message: string} {
  const parsed = LessonAnalysisResponseSchema.safeParse(body);
  if (!parsed.success) {
    return {ok: false, message: 'Lesson analysis response failed validation.'};
  }
  return {ok: true, response: parsed.data};
}

export function parseLessonRevisionsResponse(body: unknown):
  | {
      ok: true;
      response: LessonRevisionsResponse;
    }
  | {ok: false; message: string} {
  const parsed = LessonRevisionsResponseSchema.safeParse(body);
  if (!parsed.success) {
    return {ok: false, message: 'Lesson revisions response failed validation.'};
  }
  return {ok: true, response: parsed.data};
}

export function parseLessonCreationAcceptedResponse(body: unknown):
  | {
      ok: true;
      response: LessonCreationAcceptedResponse;
    }
  | {ok: false; message: string} {
  const parsed = LessonCreationAcceptedResponseSchema.safeParse(body);
  if (!parsed.success) {
    return {ok: false, message: 'Lesson creation response failed validation.'};
  }
  return {ok: true, response: parsed.data};
}

export function parseLessonCreationStatusResponse(body: unknown):
  | {
      ok: true;
      response: LessonCreationStatusResponse;
    }
  | {ok: false; message: string} {
  const parsed = LessonCreationStatusResponseSchema.safeParse(body);
  if (!parsed.success) {
    return {
      ok: false,
      message: 'Lesson creation status response failed validation.',
    };
  }
  return {ok: true, response: parsed.data};
}
