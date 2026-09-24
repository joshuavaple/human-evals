import { useInfiniteQuery } from '@tanstack/react-query'

import { fetchTraces } from '@/api/traces'

// Loads the trace list page by page. `fetchNextPage()` loads the next page;
// `hasNextPage` is false once the backend stops returning a page token.
export function useTraceList() {
  return useInfiniteQuery({
    queryKey: ['traces'],
    queryFn: ({ pageParam }) => fetchTraces(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.next_page_token ?? undefined,
  })
}
