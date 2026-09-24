import { ErrorMessage } from '@/components/ui/ErrorMessage'

import { useTraceList } from '../hooks/useTraceList'
import { formatTimestamp } from '../lib/format'
import { StateBadge } from './StateBadge'

interface TraceListProps {
  selectedId: string | null
  onSelect: (traceId: string) => void
}

// Left-hand list of traces, newest first, with a "Load more" button.
export function TraceList({ selectedId, onSelect }: TraceListProps) {
  const { data, error, isPending, fetchNextPage, hasNextPage, isFetchingNextPage } = useTraceList()

  if (isPending) return <p className="p-4 text-sm text-slate-500 dark:text-slate-400">Loading traces…</p>
  if (error) return <div className="p-4"><ErrorMessage title="Could not load traces" error={error} /></div>

  const traces = data.pages.flatMap((page) => page.traces)
  if (traces.length === 0) return <p className="p-4 text-sm text-slate-500 dark:text-slate-400">This experiment has no traces yet.</p>

  return (
    <div>
      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
        {traces.map((trace) => (
          <li key={trace.trace_id}>
            <button
              type="button"
              onClick={() => onSelect(trace.trace_id)}
              aria-current={trace.trace_id === selectedId}
              className="w-full px-4 py-3 text-left hover:bg-slate-50 aria-[current=true]:bg-indigo-50 dark:hover:bg-slate-800/60 dark:aria-[current=true]:bg-indigo-950/60"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-slate-500 dark:text-slate-400">{formatTimestamp(trace.request_time_ms)}</span>
                <StateBadge state={trace.state} />
              </div>
              <p className="mt-1 line-clamp-2 text-sm text-slate-900 dark:text-slate-100">{trace.request_preview ?? '(no input)'}</p>
              <p className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">{trace.response_preview ?? '(no output)'}</p>
            </button>
          </li>
        ))}
      </ul>
      {hasNextPage && (
        <div className="p-3">
          <button
            type="button"
            onClick={() => fetchNextPage()}
            disabled={isFetchingNextPage}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {isFetchingNextPage ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}
