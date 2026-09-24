import { useState } from 'react'

import { ThemeToggle } from '@/features/theme/components/ThemeToggle'
import { TraceDetail } from '@/features/traces/components/TraceDetail'
import { TraceList } from '@/features/traces/components/TraceList'

// Page layout: header, trace list on the left, selected trace on the right.
export default function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-lg font-semibold">Human Evals</h1>
        <ThemeToggle />
      </header>
      <div className="flex min-h-0 flex-1">
        <aside className="w-80 shrink-0 overflow-y-auto border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <TraceList selectedId={selectedId} onSelect={setSelectedId} />
        </aside>
        <main className="min-w-0 flex-1 overflow-hidden p-6">
          {selectedId ? (
            <TraceDetail traceId={selectedId} />
          ) : (
            <p className="text-sm text-slate-500 dark:text-slate-400">Select a trace on the left to review it.</p>
          )}
        </main>
      </div>
    </div>
  )
}
