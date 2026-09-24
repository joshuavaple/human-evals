import { ApiError, client } from './client'
import type { Review, ReviewInput } from './types'

// One function per backend endpoint. Components never call these directly;
// they go through the hooks in features/review/hooks.

const REVIEW_PATH = '/api/experiments/{experiment_id}/traces/{trace_id}/review'

// Saves the logged-in user's verdict on a trace, replacing their earlier one.
export async function saveReview(experimentId: string, traceId: string, review: ReviewInput): Promise<Review> {
  const { data, error, response } = await client.PUT(REVIEW_PATH, {
    params: { path: { experiment_id: experimentId, trace_id: traceId } },
    body: review,
  })
  if (!data) throw new ApiError(response.status, (error as { detail?: unknown })?.detail)
  return data
}

// Removes the logged-in user's verdict from a trace (used by "Undo").
export async function deleteReview(experimentId: string, traceId: string): Promise<void> {
  const { error, response } = await client.DELETE(REVIEW_PATH, {
    params: { path: { experiment_id: experimentId, trace_id: traceId } },
  })
  if (!response.ok) throw new ApiError(response.status, (error as { detail?: unknown })?.detail)
}
