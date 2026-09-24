import { ApiError, client } from './client'
import type { TraceDetail, TracePage } from './types'

// One function per backend endpoint. Components never call these directly;
// they go through the hooks in features/traces/hooks.

export async function fetchTraces(pageToken?: string, maxResults = 25): Promise<TracePage> {
  const { data, error, response } = await client.GET('/api/traces', {
    params: { query: { max_results: maxResults, page_token: pageToken } },
  })
  if (!data) throw new ApiError(response.status, (error as { detail?: unknown })?.detail)
  return data
}

export async function fetchTrace(traceId: string): Promise<TraceDetail> {
  const { data, error, response } = await client.GET('/api/traces/{trace_id}', {
    params: { path: { trace_id: traceId } },
  })
  if (!data) throw new ApiError(response.status, (error as { detail?: unknown })?.detail)
  return data
}
