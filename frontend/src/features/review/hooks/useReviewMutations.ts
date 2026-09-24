import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query'

import { deleteReview, saveReview } from '@/api/reviews'
import type { ConversationPage, Review, ReviewInput, TraceDetail } from '@/api/types'

// Saving and removing reviews. After each change the cached trace and
// conversation data is updated in place, so the sidebar and the next-turn logic
// see it straight away without reloading anything from the backend.
export function useReviewMutations(experimentId: string) {
  const queryClient = useQueryClient()

  const save = useMutation({
    mutationFn: ({ traceId, review }: { traceId: string; review: ReviewInput }) =>
      saveReview(experimentId, traceId, review),
    onSuccess: (saved, { traceId }) => setCachedReview(queryClient, experimentId, traceId, saved),
  })

  const remove = useMutation({
    mutationFn: ({ traceId }: { traceId: string }) => deleteReview(experimentId, traceId),
    onSuccess: (_, { traceId }) => setCachedReview(queryClient, experimentId, traceId, null),
  })

  return { save, remove }
}

function setCachedReview(queryClient: QueryClient, experimentId: string, traceId: string, review: Review | null) {
  queryClient.setQueryData<TraceDetail>(['traces', experimentId, traceId], (old) => old && { ...old, review })
  // Every cached conversation list of this experiment (one per "Load more" size).
  queryClient.setQueriesData<ConversationPage>({ queryKey: ['conversations', experimentId] }, (old) =>
    old && {
      ...old,
      conversations: old.conversations.map((c) => ({
        ...c,
        traces: c.traces.map((t) => (t.trace_id === traceId ? { ...t, review } : t)),
      })),
    },
  )
}
