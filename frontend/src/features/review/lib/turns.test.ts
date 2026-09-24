import { describe, expect, it } from 'vitest'

import type { Conversation, TraceSummary } from '@/api/types'

import { adjacentTurn, findTurn, nextUnreviewedTurn, turnPosition } from './turns'

function turn(id: string, reviewed = false): TraceSummary {
  return {
    trace_id: id,
    session_id: null,
    request_time_ms: 0,
    state: 'OK',
    execution_duration_ms: null,
    request_preview: null,
    response_preview: null,
    review: reviewed ? { verdict: 'pass', comment: null, reviewer: 'me', updated_time_ms: 1 } : null,
  }
}

function conversation(...traces: TraceSummary[]): Conversation {
  return { session_id: traces[0].trace_id, latest_request_time_ms: 0, traces }
}

// Sidebar order: a1 a2 a3 | b1 | c1 c2
const conversations = [
  conversation(turn('a1'), turn('a2', true), turn('a3')),
  conversation(turn('b1', true)),
  conversation(turn('c1'), turn('c2')),
]

describe('adjacentTurn', () => {
  it('moves through turns across conversations', () => {
    expect(adjacentTurn(conversations, 'a3', 1)).toBe('b1')
    expect(adjacentTurn(conversations, 'b1', -1)).toBe('a3')
  })

  it('stops at the ends', () => {
    expect(adjacentTurn(conversations, 'c2', 1)).toBeNull()
    expect(adjacentTurn(conversations, 'a1', -1)).toBeNull()
  })

  it('starts at the first turn when nothing is selected', () => {
    expect(adjacentTurn(conversations, null, 1)).toBe('a1')
    expect(adjacentTurn(conversations, null, -1)).toBeNull()
  })
})

describe('nextUnreviewedTurn', () => {
  it('skips reviewed turns, crossing into the next conversation', () => {
    expect(nextUnreviewedTurn(conversations, 'a1')).toBe('a3')
    expect(nextUnreviewedTurn(conversations, 'a3')).toBe('c1')
  })

  it('wraps around to unreviewed turns above', () => {
    expect(nextUnreviewedTurn(conversations, 'c2')).toBe('a1')
  })

  it('returns null when everything else is reviewed', () => {
    const done = [conversation(turn('x1', true), turn('x2'))]
    expect(nextUnreviewedTurn(done, 'x2')).toBeNull()
  })
})

describe('turnPosition and findTurn', () => {
  it('gives the turn number within its conversation', () => {
    expect(turnPosition(conversations, 'a2')).toEqual({ turn: 2, of: 3 })
    expect(turnPosition(conversations, 'nope')).toBeNull()
  })

  it('finds a turn by ID', () => {
    expect(findTurn(conversations, 'c1')?.trace_id).toBe('c1')
    expect(findTurn(conversations, null)).toBeNull()
  })
})
