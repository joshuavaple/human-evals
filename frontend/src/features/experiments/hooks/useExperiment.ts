import { useQuery } from '@tanstack/react-query'

import { fetchExperiment } from '@/api/experiments'

// One experiment's name and path, for the page header.
export function useExperiment(experimentId: string) {
  return useQuery({
    queryKey: ['experiments', experimentId],
    queryFn: () => fetchExperiment(experimentId),
    staleTime: 5 * 60_000,
  })
}
