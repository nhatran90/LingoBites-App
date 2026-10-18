/**
 * Vocab path P6: the pattern library, the tense map and learning single items
 * on the Server (`GET /v1/library/patterns`, `GET /v1/library/tenses`,
 * `POST /v1/items/learn`). Responses are checked with zod; failures come back
 * as values. Nothing is stored here: `libraryRepository` keeps the lists.
 */
import {z} from 'zod';

import {
  type ApiResult,
  jsonBody,
  type JsonRequestOptions,
  requestJson,
} from '@core/api/jsonRequest';
import {CatalogItemSchema} from '@core/schemas/lesson';

const FilterSchema = z.object({code: z.string(), label_vi: z.string()});

export const PatternLibrarySchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  patterns: z.array(
    z.object({
      item: CatalogItemSchema,
      cefr_level: z.string().nullable(),
      tags: z.array(z.string()),
    }),
  ),
  functions: z.array(FilterSchema),
  exams: z.array(FilterSchema),
});

export const TenseLibrarySchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  tenses: z.array(
    z.object({
      item: CatalogItemSchema,
      time: z.string().nullable(),
      aspect: z.string().nullable(),
      /** The tense's picture; older Servers leave it out. */
      image_url: z.string().nullable().optional(),
    }),
  ),
});

export const LearnItemsSchema = z.object({
  request_id: z.string(),
  status: z.literal('success'),
  enrolled: z.number().int(),
  already_scheduled: z.number().int(),
  items: z.array(CatalogItemSchema),
});

export type PatternLibrary = z.infer<typeof PatternLibrarySchema>;
export type TenseLibrary = z.infer<typeof TenseLibrarySchema>;
export type LearnItemsResult = z.infer<typeof LearnItemsSchema>;

export function fetchPatternLibrary(
  options: JsonRequestOptions = {},
): Promise<ApiResult<PatternLibrary>> {
  return requestJson(
    PatternLibrarySchema,
    '/v1/library/patterns',
    {method: 'GET'},
    options,
  );
}

export function fetchTenseLibrary(
  options: JsonRequestOptions = {},
): Promise<ApiResult<TenseLibrary>> {
  return requestJson(
    TenseLibrarySchema,
    '/v1/library/tenses',
    {method: 'GET'},
    options,
  );
}

/** Puts single items on the review schedule (stage 0); the item memory rows come with the next pull. */
export function learnItems(
  itemCodes: string[],
  options: JsonRequestOptions = {},
): Promise<ApiResult<LearnItemsResult>> {
  return requestJson(
    LearnItemsSchema,
    '/v1/items/learn',
    jsonBody({item_codes: itemCodes}),
    options,
  );
}
