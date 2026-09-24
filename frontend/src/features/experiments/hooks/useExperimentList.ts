import { useQuery } from '@tanstack/react-query'

import { fetchExperiments } from '@/api/experiments'

// All experiments in the backend's folder. Listing them takes a few seconds on
// Databricks, so the result is reused for 5 minutes before refreshing.
export function useExperimentList() {
  return useQuery({
    queryKey: ['experiments'],
    queryFn: fetchExperiments,
    staleTime: 5 * 60_000,
  })
}
