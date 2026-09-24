import { useQuery } from '@tanstack/react-query'

import { fetchTrace } from '@/api/traces'

// Loads the full input/output of one trace. Does nothing until an ID is given.
export function useTrace(experimentId: string, traceId: string | null) {
  return useQuery({
    queryKey: ['traces', experimentId, traceId],
    queryFn: () => fetchTrace(experimentId, traceId!),
    enabled: traceId !== null,
  })
}
