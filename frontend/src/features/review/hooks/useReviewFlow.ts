import { useState } from 'react'

import type { Conversation, Review, ReviewInput, Verdict } from '@/api/types'

import { findTurn, nextUnreviewedTurn } from '../lib/turns'
import { useAutoAdvance } from './useAutoAdvance'
import { useReviewMutations } from './useReviewMutations'

export interface SavedNotice {
  id: number
  traceId: string
  message: string
  previous: Review | null // what to put back on "Undo"
}

interface ReviewFlowOptions {
  experimentId: string
  conversations: Conversation[]
  selectedId: string | null
  select: (traceId: string) => void
}

// Unsaved text in the review bar's text box: an issue description, or a note on a pass.
export interface Draft {
  verdict: Verdict
  text: string
}

// Everything the review bar needs for the selected turn: its saved verdict,
// the unsaved text, saving, undo and moving on to the next turn.
export function useReviewFlow({ experimentId, conversations, selectedId, select }: ReviewFlowOptions) {
  const { save, remove } = useReviewMutations(experimentId)
  const [autoAdvance, setAutoAdvance] = useAutoAdvance()
  // Unsaved text per trace. A trace with an entry has its text box open;
  // keeping drafts per trace means switching turns never loses typed text.
  const [drafts, setDrafts] = useState<Record<string, Draft>>({})
  const [notice, setNotice] = useState<SavedNotice | null>(null)

  const review = findTurn(conversations, selectedId)?.review ?? null
  const draft = selectedId === null ? undefined : drafts[selectedId]
  const isSaving = save.isPending && save.variables?.traceId === selectedId
  const error = save.isError && save.variables?.traceId === selectedId ? save.error : null

  function setDraft(traceId: string, value: Draft | undefined) {
    setDrafts((current) => {
      const next = { ...current }
      if (value === undefined) delete next[traceId]
      else next[traceId] = value
      return next
    })
  }

  function goToNextUnreviewed(traceId: string): string | null {
    const next = autoAdvance ? nextUnreviewedTurn(conversations, traceId) : null
    if (next) select(next)
    return next
  }

  function submit(review: ReviewInput, previous: Review | null) {
    if (selectedId === null) return
    const traceId = selectedId
    save.mutate(
      { traceId, review },
      {
        onSuccess: () => {
          setDraft(traceId, undefined)
          const saved =
            review.verdict === 'issue' ? 'Saved as Issue' : review.comment ? 'Saved as Pass with note' : 'Saved as Pass'
          const next = goToNextUnreviewed(traceId)
          const done = autoAdvance && next === null ? ' · all loaded turns are reviewed' : ''
          setNotice({ id: Date.now(), traceId, message: saved + done, previous })
        },
      },
    )
  }

  // Opens the text box, pre-filled with the saved text when that verdict is already there.
  function start(verdict: Verdict) {
    if (selectedId === null || draft !== undefined) return
    setDraft(selectedId, { verdict, text: review?.verdict === verdict ? (review.comment ?? '') : '' })
  }

  return {
    review,
    draft,
    isSaving,
    error,
    notice,
    autoAdvance,
    setAutoAdvance,

    // Plain pass. On a turn that's already passed it just moves on, so it never
    // wipes out a note saved earlier.
    pass() {
      if (selectedId === null || save.isPending) return
      if (review?.verdict === 'pass') goToNextUnreviewed(selectedId)
      else submit({ verdict: 'pass' }, review)
    },

    startNote: () => start('pass'),
    startIssue: () => start('issue'),

    setDraftText(text: string) {
      if (selectedId !== null && draft) setDraft(selectedId, { ...draft, text })
    },

    cancelDraft() {
      if (selectedId !== null) setDraft(selectedId, undefined)
    },

    // An issue needs a description; a pass note may be left empty (a plain pass).
    saveDraft() {
      if (draft === undefined || save.isPending) return
      const text = draft.text.trim()
      if (draft.verdict === 'issue') {
        if (text) submit({ verdict: 'issue', comment: text }, review)
      } else {
        submit(text ? { verdict: 'pass', comment: text } : { verdict: 'pass' }, review)
      }
    },

    // Puts back what the notice's trace had before the save, and goes back to it.
    undo() {
      if (!notice) return
      const { traceId, previous } = notice
      if (previous) save.mutate({ traceId, review: { verdict: previous.verdict, comment: previous.comment } })
      else remove.mutate({ traceId })
      setNotice(null)
      select(traceId)
    },

    dismissNotice() {
      setNotice(null)
    },
  }
}
