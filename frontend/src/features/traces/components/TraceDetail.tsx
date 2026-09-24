import { ErrorMessage } from '@/components/ui/ErrorMessage'

import { useTrace } from '../hooks/useTrace'
import { formatDuration, formatTimestamp } from '../lib/format'
import { IOPanel } from './IOPanel'
import { StateBadge } from './StateBadge'

// Right-hand pane: the selected trace's input and output side by side.
export function TraceDetail({ traceId }: { traceId: string }) {
  const { data: trace, error, isPending } = useTrace(traceId)

  if (isPending) return <p className="text-sm text-slate-500 dark:text-slate-400">Loading trace…</p>
  if (error) return <ErrorMessage title="Could not load this trace" error={error} />

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-slate-600 dark:text-slate-400">
        <code className="text-xs text-slate-500 dark:text-slate-400">{trace.trace_id}</code>
        <StateBadge state={trace.state} />
        <span>{formatTimestamp(trace.request_time_ms)}</span>
        <span>Took {formatDuration(trace.execution_duration_ms)}</span>
      </div>
      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
        <IOPanel title="Input" value={trace.request} defaultRole="user" />
        <IOPanel title="Output" value={trace.response} defaultRole="assistant" />
      </div>
    </div>
  )
}
