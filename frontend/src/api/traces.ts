import { ApiError, client } from './client'
import type { ConversationPage, TraceDetail } from './types'

// One function per backend endpoint. Components never call these directly;
// they go through the hooks in features/traces/hooks.

export async function fetchConversations(
  experimentId: string,
  maxResults: number,
): Promise<ConversationPage> {
  const { data, error, response } = await client.GET('/api/experiments/{experiment_id}/conversations', {
    params: { path: { experiment_id: experimentId }, query: { max_results: maxResults } },
  })
  if (!data) throw new ApiError(response.status, (error as { detail?: unknown })?.detail)
  return data
}

export async function fetchTrace(experimentId: string, traceId: string): Promise<TraceDetail> {
  const { data, error, response } = await client.GET('/api/experiments/{experiment_id}/traces/{trace_id}', {
    params: { path: { experiment_id: experimentId, trace_id: traceId } },
  })
  if (!data) throw new ApiError(response.status, (error as { detail?: unknown })?.detail)
  return data
}
