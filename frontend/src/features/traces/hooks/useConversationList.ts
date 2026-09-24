import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { useState } from 'react'

import { fetchConversations } from '@/api/traces'

const PAGE_SIZE = 20

// Loads the most recent conversations. The backend has no page tokens for
// conversations, so "Load more" asks again for a bigger number of them.
export function useConversationList(experimentId: string) {
  const [limit, setLimit] = useState(PAGE_SIZE)
  const query = useQuery({
    queryKey: ['conversations', experimentId, limit],
    queryFn: () => fetchConversations(experimentId, limit),
    // Keep showing the current list while the bigger one loads.
    placeholderData: keepPreviousData,
  })
  return { ...query, loadMore: () => setLimit((n) => n + PAGE_SIZE) }
}
