import type { Conversation, TraceSummary } from '@/api/types'

// Moving between turns. The order is the sidebar's: conversations top to
// bottom, and within each conversation turn 1, 2, 3…

export function allTurns(conversations: Conversation[]): TraceSummary[] {
  return conversations.flatMap((c) => c.traces)
}

// The turn before (step = -1) or after (step = 1) the current one. With nothing
// selected, "next" is the first turn. Returns null at either end.
export function adjacentTurn(conversations: Conversation[], currentId: string | null, step: 1 | -1): string | null {
  const turns = allTurns(conversations)
  const index = turns.findIndex((t) => t.trace_id === currentId)
  if (index === -1) return step === 1 ? (turns[0]?.trace_id ?? null) : null
  return turns[index + step]?.trace_id ?? null
}

// Where to go after reviewing `currentId`: the next unreviewed turn below it,
// or else the first unreviewed one above it. Null when every other loaded turn
// is reviewed.
export function nextUnreviewedTurn(conversations: Conversation[], currentId: string): string | null {
  const turns = allTurns(conversations)
  const index = turns.findIndex((t) => t.trace_id === currentId)
  const ordered = [...turns.slice(index + 1), ...turns.slice(0, Math.max(index, 0))]
  return ordered.find((t) => t.review === null && t.trace_id !== currentId)?.trace_id ?? null
}

// "Turn 2 of 5" for the trace header.
export function turnPosition(conversations: Conversation[], traceId: string): { turn: number; of: number } | null {
  for (const c of conversations) {
    const index = c.traces.findIndex((t) => t.trace_id === traceId)
    if (index !== -1) return { turn: index + 1, of: c.traces.length }
  }
  return null
}

export function findTurn(conversations: Conversation[], traceId: string | null): TraceSummary | null {
  return allTurns(conversations).find((t) => t.trace_id === traceId) ?? null
}
