import {z} from 'zod';

import {jsonBody, requestJson} from '@core/api/jsonRequest';

import type {ActivityDayReport} from './activityTracker';

const ActivityResponseSchema = z.object({accepted_days: z.number()});

/**
 * `POST /v1/me/activity`: the per-day usage totals. Resolves true once the
 * Server stored them; any failure resolves false so the totals are kept and
 * sent again later.
 */
export async function sendActivityReport(
  days: ActivityDayReport[],
  fetchImpl?: typeof fetch,
): Promise<boolean> {
  const result = await requestJson(
    ActivityResponseSchema,
    '/v1/me/activity',
    jsonBody({days}),
    {fetchImpl},
  );
  return result.ok;
}
