import { useEffect, useRef, useState } from 'react'

import type { Conversation, TraceSummary } from '@/api/types'
import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { ReviewMarker } from '@/features/review/components/ReviewMarker'

import type { useConversationList } from '../hooks/useConversationList'
import { formatTimestamp } from '../lib/format'
import { StateBadge } from './StateBadge'

interface ConversationListProps {
  // The page loads the list (it also needs it to move between turns) and passes it in.
  list: ReturnType<typeof useConversationList>
  selectedId: string | null
  onSelect: (traceId: string) => void
}

const conversationKey = (c: Conversation) => c.session_id ?? c.traces[0].trace_id

// Left-hand list: conversations with the latest activity first. Each one opens
// to show its turns (traces), first turn on top, with a marker on reviewed turns.
export function ConversationList({ list, selectedId, onSelect }: ConversationListProps) {
  const { data, error, isPending, isFetching, isPlaceholderData, loadMore } = list
  // Which conversations are expanded. `null` = the user hasn't toggled anything
  // yet, in which case only the most recent conversation is open.
  const [openKeys, setOpenKeys] = useState<Set<string> | null>(null)

  const conversations = data?.conversations ?? []
  const open = openKeys ?? new Set(conversations[0] ? [conversationKey(conversations[0])] : [])

  // When the selection moves into another conversation (keyboard navigation, or
  // going to the next unreviewed turn), open it. This adjusts state during render,
  // React's recommended pattern for reacting to a changed prop; it runs once per
  // change, so the conversation can still be collapsed by hand afterwards.
  const selectedConversation = conversations.find((c) => c.traces.some((t) => t.trace_id === selectedId))
  const selectedKey = selectedConversation ? conversationKey(selectedConversation) : null
  const [openedFor, setOpenedFor] = useState<string | null>(null)
  if (selectedKey !== openedFor) {
    setOpenedFor(selectedKey)
    if (selectedKey !== null && !open.has(selectedKey)) setOpenKeys(new Set(open).add(selectedKey))
  }

  if (isPending) return <p className="p-4 text-sm text-slate-500 dark:text-slate-400">Loading conversations…</p>
  if (error) return <div className="p-4"><ErrorMessage title="Could not load conversations" error={error} /></div>

  if (conversations.length === 0) {
    return <p className="p-4 text-sm text-slate-500 dark:text-slate-400">This experiment has no traces yet.</p>
  }

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
      {data.has_more && (
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
  const reviewed = traces.filter((t) => t.review !== null).length
  const issues = traces.filter((t) => t.review?.verdict === 'issue').length

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
            {formatTimestamp(conversation.latest_request_time_ms)} · {turns} ·{' '}
            <span className={reviewed === traces.length ? 'text-emerald-600 dark:text-emerald-400' : ''}>
              {reviewed}/{traces.length} reviewed
            </span>
            {issues > 0 && (
              <span className="text-amber-600 dark:text-amber-400">
                {' '}
                · ⚑ {issues}
              </span>
            )}
          </span>
        </span>
      </button>

      {isOpen && (
        <ol className="pb-2">
          {traces.map((trace, i) => (
            <TurnItem
              key={trace.trace_id}
              trace={trace}
              number={i + 1}
              isSelected={trace.trace_id === selectedId}
              onSelect={onSelect}
            />
          ))}
        </ol>
      )}
    </li>
  )
}

const NUMBER_STYLES = {
  none: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300',
  pass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
  issue: 'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
}

interface TurnItemProps {
  trace: TraceSummary
  number: number
  isSelected: boolean
  onSelect: (traceId: string) => void
}

function TurnItem({ trace, number, isSelected, onSelect }: TurnItemProps) {
  const ref = useRef<HTMLButtonElement>(null)
  // Keep the selected turn in view when it's chosen from the keyboard.
  useEffect(() => {
    if (isSelected) ref.current?.scrollIntoView?.({ block: 'nearest' })
  }, [isSelected])

  return (
    <li>
      <button
        ref={ref}
        type="button"
        onClick={() => onSelect(trace.trace_id)}
        aria-current={isSelected}
        className="flex w-full gap-3 py-2 pl-9 pr-4 text-left hover:bg-slate-50 aria-[current=true]:bg-indigo-50 dark:hover:bg-slate-800/60 dark:aria-[current=true]:bg-indigo-950/60"
      >
        <span
          className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full text-[10px] font-medium ${NUMBER_STYLES[trace.review?.verdict ?? 'none']}`}
        >
          {number}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              {formatTimestamp(trace.request_time_ms)}
              <ReviewMarker review={trace.review} />
            </span>
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
  )
}
