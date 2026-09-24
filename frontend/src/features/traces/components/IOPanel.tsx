import { useState } from 'react'

import { toMessages, type Role } from '../lib/messages'
import { MessageList } from './MessageList'

interface IOPanelProps {
  title: string
  value: unknown
  defaultRole: Role
}

// One side of the input/output pair. Shows readable chat messages when the
// format is recognised, with a toggle to see the raw JSON.
export function IOPanel({ title, value, defaultRole }: IOPanelProps) {
  const messages = toMessages(value, defaultRole)
  const [showRaw, setShowRaw] = useState(false)
  const raw = messages === null || showRaw

  return (
    <section className="flex min-h-0 flex-col rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <header className="flex items-center justify-between border-b border-slate-100 px-4 py-2 dark:border-slate-800">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200">{title}</h2>
        {messages !== null && (
          <button type="button" onClick={() => setShowRaw(!showRaw)} className="text-xs text-indigo-600 hover:underline dark:text-indigo-400">
            {showRaw ? 'Show formatted' : 'Show raw JSON'}
          </button>
        )}
      </header>
      <div className="overflow-auto p-4">
        {value == null ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Nothing was logged.</p>
        ) : raw ? (
          <pre className="whitespace-pre-wrap break-words text-xs text-slate-700 dark:text-slate-300">{JSON.stringify(value, null, 2)}</pre>
        ) : (
          <MessageList messages={messages} />
        )}
      </div>
    </section>
  )
}
