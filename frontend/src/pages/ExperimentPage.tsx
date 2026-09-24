import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'

import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { useExperiment } from '@/features/experiments/hooks/useExperiment'
import { ConversationList } from '@/features/traces/components/ConversationList'
import { TraceDetail } from '@/features/traces/components/TraceDetail'

// "/experiments/:experimentId": the experiment's conversations on the left,
// the selected trace on the right.
export function ExperimentPage() {
  const { experimentId } = useParams()
  // `key` gives each experiment a fresh page, so the selected trace and the
  // expanded conversations don't carry over when switching experiments.
  return <ExperimentView key={experimentId} experimentId={experimentId!} />
}

function ExperimentView({ experimentId }: { experimentId: string }) {
  const { data: experiment, error } = useExperiment(experimentId)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Back to the experiment list as it was (e.g. its sort), if we came from it.
  const listSearch = (useLocation().state as { listSearch?: string } | null)?.listSearch ?? ''

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center gap-3 border-b border-slate-200 bg-white px-6 py-2 text-sm dark:border-slate-800 dark:bg-slate-900">
        <Link to={`/${listSearch}`} className="text-indigo-600 hover:underline dark:text-indigo-400">
          ← All experiments
        </Link>
        {experiment && (
          <>
            <span className="text-slate-300 dark:text-slate-600">/</span>
            <span className="font-medium">{experiment.name}</span>
            <span className="truncate text-xs text-slate-500 dark:text-slate-400">{experiment.path}</span>
          </>
        )}
      </div>

      {error ? (
        <div className="p-6">
          <ErrorMessage title="Could not open this experiment" error={error} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <aside className="w-80 shrink-0 overflow-y-auto border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <ConversationList experimentId={experimentId} selectedId={selectedId} onSelect={setSelectedId} />
          </aside>
          <main className="min-w-0 flex-1 overflow-hidden p-6">
            {selectedId ? (
              <TraceDetail experimentId={experimentId} traceId={selectedId} />
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">Select a trace on the left to review it.</p>
            )}
          </main>
        </div>
      )}
    </div>
  )
}
