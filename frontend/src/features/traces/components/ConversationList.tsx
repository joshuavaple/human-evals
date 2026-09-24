import { useState } from 'react'

import type { Conversation } from '@/api/types'
import { ErrorMessage } from '@/components/ui/ErrorMessage'

import { useConversationList } from '../hooks/useConversationList'
import { formatTimestamp } from '../lib/format'
import { StateBadge } from './StateBadge'

interface ConversationListProps {
  experimentId: string
  selectedId: string | null
  onSelect: (traceId: string) => void
}

const conversationKey = (c: Conversation) => c.session_id ?? c.traces[0].trace_id

// Left-hand list: conversations with the latest activity first. Each one opens
// to show its turns (traces), first turn on top.
export function ConversationList({ experimentId, selectedId, onSelect }: ConversationListProps) {
  const { data, error, isPending, isFetching, isPlaceholderData, loadMore } = useConversationList(experimentId)
  // Which conversations are expanded. `null` = the user hasn't toggled anything
  // yet, in which case only the most recent conversation is open.
  const [openKeys, setOpenKeys] = useState<Set<string> | null>(null)

  if (isPending) return <p className="p-4 text-sm text-slate-500 dark:text-slate-400">Loading conversations…</p>
  if (error) return <div className="p-4"><ErrorMessage title="Could not load conversations" error={error} /></div>

  const { conversations, has_more } = data
  if (conversations.length === 0) {
    return <p className="p-4 text-sm text-slate-500 dark:text-slate-400">This experiment has no traces yet.</p>
  }

  const open = openKeys ?? new Set([conversationKey(conversations[0])])
  const toggle = (key: string) => {
    const next = new Set(open)
    if (next.has(key)) next.delete(key)
    else next.add(key)
    setOpenKeys(next)
  }

  return (
    <div>
      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {conversations.map((conversation) => {
          const key = conversationKey(conversation)
          return (
            <ConversationItem
              key={key}
              conversation={conversation}
              isOpen={open.has(key)}
              onToggle={() => toggle(key)}
              selectedId={selectedId}
              onSelect={onSelect}
            />
          )
        })}
      </ul>
      {has_more && (
        <div className="p-3">
          <button
            type="button"
            onClick={loadMore}
            disabled={isFetching && isPlaceholderData}
            className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            {isFetching && isPlaceholderData ? 'Loading…' : 'Load more'}
          </button>
        </div>
      )}
    </div>
  )
}

interface ConversationItemProps {
  conversation: Conversation
  isOpen: boolean
  onToggle: () => void
  selectedId: string | null
  onSelect: (traceId: string) => void
}

function ConversationItem({ conversation, isOpen, onToggle, selectedId, onSelect }: ConversationItemProps) {
  const { traces } = conversation
  const turns = traces.length === 1 ? '1 turn' : `${traces.length} turns`

  return (
    <li>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        title={conversation.session_id ? `Conversation ${conversation.session_id}` : 'No conversation ID'}
        className="flex w-full items-start gap-2 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800/60"
      >
        <svg
          viewBox="0 0 20 20"
          fill="currentColor"
          aria-hidden="true"
          className={`mt-0.5 size-4 shrink-0 text-slate-400 transition-transform ${isOpen ? 'rotate-90' : ''}`}
        >
          <path d="M7.2 4.5a.75.75 0 0 1 1.06 0l5 5a.75.75 0 0 1 0 1.06l-5 5a.75.75 0 1 1-1.06-1.06L11.67 10 7.2 5.53a.75.75 0 0 1 0-1.06Z" />
        </svg>
        <span className="min-w-0 flex-1">
          <span className="line-clamp-1 text-sm font-medium text-slate-900 dark:text-slate-100">
            {traces[0].request_preview ?? '(no input)'}
          </span>
          <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
            {formatTimestamp(conversation.latest_request_time_ms)} · {turns}
          </span>
        </span>
      </button>

      {isOpen && (
        <ol className="pb-2">
          {traces.map((trace, i) => (
            <li key={trace.trace_id}>
              <button
                type="button"
                onClick={() => onSelect(trace.trace_id)}
                aria-current={trace.trace_id === selectedId}
                className="flex w-full gap-3 py-2 pl-9 pr-4 text-left hover:bg-slate-50 aria-[current=true]:bg-indigo-50 dark:hover:bg-slate-800/60 dark:aria-[current=true]:bg-indigo-950/60"
              >
                <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="text-xs text-slate-500 dark:text-slate-400">{formatTimestamp(trace.request_time_ms)}</span>
                    <StateBadge state={trace.state} />
                  </span>
                  <span className="mt-0.5 line-clamp-2 text-sm text-slate-900 dark:text-slate-100">
                    {trace.request_preview ?? '(no input)'}
                  </span>
                  <span className="mt-0.5 line-clamp-1 text-xs text-slate-500 dark:text-slate-400">
                    {trace.response_preview ?? '(no output)'}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      )}
    </li>
  )
}
