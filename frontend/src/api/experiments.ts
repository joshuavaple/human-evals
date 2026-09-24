import { ApiError, client } from './client'
import type { ExperimentList, ExperimentSummary } from './types'

// One function per backend endpoint. Components never call these directly;
// they go through the hooks in features/experiments/hooks.

export async function fetchExperiments(): Promise<ExperimentList> {
  const { data, error, response } = await client.GET('/api/experiments')
  if (!data) throw new ApiError(response.status, (error as { detail?: unknown })?.detail)
  return data
}

export async function fetchExperiment(experimentId: string): Promise<ExperimentSummary> {
  const { data, error, response } = await client.GET('/api/experiments/{experiment_id}', {
    params: { path: { experiment_id: experimentId } },
  })
  if (!data) throw new ApiError(response.status, (error as { detail?: unknown })?.detail)
  return data
}
