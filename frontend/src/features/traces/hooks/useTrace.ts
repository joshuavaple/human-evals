import { useQuery } from '@tanstack/react-query'

import { fetchTrace } from '@/api/traces'

// Loads the full input/output of one trace. Does nothing until an ID is given.
export function useTrace(traceId: string | null) {
  return useQuery({
    queryKey: ['traces', traceId],
    queryFn: () => fetchTrace(traceId!),
    enabled: traceId !== null,
  })
}
