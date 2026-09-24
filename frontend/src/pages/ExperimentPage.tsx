import { useState } from 'react'
import { Link, useLocation, useParams } from 'react-router'

import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { useExperiment } from '@/features/experiments/hooks/useExperiment'
import { ReviewBar } from '@/features/review/components/ReviewBar'
import { SavedNoticeToast } from '@/features/review/components/SavedNoticeToast'
import { useKeyboardShortcuts } from '@/features/review/hooks/useKeyboardShortcuts'
import { useReviewFlow } from '@/features/review/hooks/useReviewFlow'
import { adjacentTurn, turnPosition } from '@/features/review/lib/turns'
import { ConversationList } from '@/features/traces/components/ConversationList'
import { TraceDetail } from '@/features/traces/components/TraceDetail'
import { useConversationList } from '@/features/traces/hooks/useConversationList'

// "/experiments/:experimentId": the experiment's conversations on the left,
// the selected trace on the right with the review bar under it.
export function ExperimentPage() {
  const { experimentId } = useParams()
  // `key` gives each experiment a fresh page, so the selected trace, drafts and
  // expanded conversations don't carry over when switching experiments.
  return <ExperimentView key={experimentId} experimentId={experimentId!} />
}

function ExperimentView({ experimentId }: { experimentId: string }) {
  const { data: experiment, error } = useExperiment(experimentId)
  const list = useConversationList(experimentId)
  const conversations = list.data?.conversations ?? []
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const review = useReviewFlow({ experimentId, conversations, selectedId, select: setSelectedId })
  // Back to the experiment list as it was (e.g. its sort), if we came from it.
  const listSearch = (useLocation().state as { listSearch?: string } | null)?.listSearch ?? ''

  const move = (step: 1 | -1) => {
    const target = adjacentTurn(conversations, selectedId, step)
    if (target) setSelectedId(target)
  }
  useKeyboardShortcuts({
    p: review.pass,
    n: review.startNote,
    i: review.startIssue,
    j: () => move(1),
    k: () => move(-1),
  })

  const position = selectedId ? turnPosition(conversations, selectedId) : null

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
        <span className="ml-auto hidden text-xs text-slate-500 lg:inline dark:text-slate-400">
          Keys: <b>J</b>/<b>K</b> next/previous turn · <b>P</b> pass · <b>N</b> pass with note · <b>I</b> issue
        </span>
      </div>

      {error ? (
        <div className="p-6">
          <ErrorMessage title="Could not open this experiment" error={error} />
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          <aside className="w-80 shrink-0 overflow-y-auto border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <ConversationList list={list} selectedId={selectedId} onSelect={setSelectedId} />
          </aside>
          <main className="flex min-w-0 flex-1 flex-col gap-4 overflow-hidden p-6">
            {selectedId ? (
              <>
                <div className="min-h-0 flex-1">
                  <TraceDetail
                    experimentId={experimentId}
                    traceId={selectedId}
                    turnLabel={position ? `Turn ${position.turn} of ${position.of}` : undefined}
                  />
                </div>
                <ReviewBar
                  review={review.review}
                  draft={review.draft}
                  isSaving={review.isSaving}
                  error={review.error}
                  autoAdvance={review.autoAdvance}
                  onAutoAdvanceChange={review.setAutoAdvance}
                  onPass={review.pass}
                  onStartNote={review.startNote}
                  onStartIssue={review.startIssue}
                  onDraftChange={review.setDraftText}
                  onCancelDraft={review.cancelDraft}
                  onSaveDraft={review.saveDraft}
                />
              </>
            ) : (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Select a turn on the left to review it, or press <b>J</b> to start with the first one.
              </p>
            )}
          </main>
        </div>
      )}

      {review.notice && (
        <SavedNoticeToast notice={review.notice} onUndo={review.undo} onDismiss={review.dismissNotice} />
      )}
    </div>
  )
}
