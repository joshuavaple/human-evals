import type { Review } from '@/api/types'
import { LightbulbIcon } from '@/components/ui/LightbulbIcon'

import type { Draft } from '../hooks/useReviewFlow'

interface ReviewBarProps {
  review: Review | null // the saved verdict, if any
  draft: Draft | undefined // unsaved text; defined while the text box is open
  isSaving: boolean
  error: Error | null
  autoAdvance: boolean
  onAutoAdvanceChange: (on: boolean) => void
  onPass: () => void
  onStartNote: () => void
  onStartIssue: () => void
  onDraftChange: (text: string) => void
  onCancelDraft: () => void
  onSaveDraft: () => void
}

// The bar under the input/output cards where the reviewer gives a verdict.
// It stays in place while the cards scroll. "Pass" is one click; "Pass with
// note" and "Issue" open the same text box in the bar itself.
export function ReviewBar(props: ReviewBarProps) {
  return (
    <section
      aria-label="Review"
      className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
    >
      {props.draft === undefined ? <VerdictRow {...props} /> : <TextForm {...props} draft={props.draft} />}
      {props.error && (
        <p role="alert" className="mt-2 text-sm text-rose-700 dark:text-rose-300">
          Couldn't save: {props.error.message}. Try again.
        </p>
      )}
    </section>
  )
}

function VerdictRow({
  review,
  isSaving,
  autoAdvance,
  onAutoAdvanceChange,
  onPass,
  onStartNote,
  onStartIssue,
}: ReviewBarProps) {
  const passed = review?.verdict === 'pass'
  const hasNote = passed && review.comment !== null
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="min-w-0 flex-1 text-sm">
        {review === null ? (
          <span className="font-medium text-slate-700 dark:text-slate-200">Is this output acceptable?</span>
        ) : passed ? (
          <span className="block truncate text-emerald-700 dark:text-emerald-300" title={review.comment ?? undefined}>
            <span className="font-medium">✓ You passed this turn{hasNote ? ':' : ''}</span>
            {hasNote && (
              <>
                {' '}
                <LightbulbIcon className="size-3.5 text-amber-500 dark:text-amber-300" /> {review.comment}
              </>
            )}
          </span>
        ) : (
          <span className="block truncate text-amber-800 dark:text-amber-200" title={review.comment ?? undefined}>
            <span className="font-medium">⚑ You reported an issue:</span> {review.comment}
          </span>
        )}
      </div>

      <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
        <input
          type="checkbox"
          checked={autoAdvance}
          onChange={(e) => onAutoAdvanceChange(e.target.checked)}
          className="accent-indigo-600"
        />
        Go to next unreviewed after saving
      </label>

      <div className="flex gap-2">
        {/* Split button: the big part is a plain pass, the small part adds a note. */}
        <div className="inline-flex rounded-md shadow-sm">
          <button
            type="button"
            onClick={onPass}
            disabled={isSaving}
            aria-label="Pass"
            aria-pressed={passed}
            className="inline-flex items-center gap-2 rounded-l-md bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50 aria-pressed:bg-emerald-700 dark:hover:bg-emerald-500 dark:aria-pressed:bg-emerald-500"
          >
            {isSaving ? 'Saving…' : '✓ Pass'} <Kbd>P</Kbd>
          </button>
          <button
            type="button"
            onClick={onStartNote}
            disabled={isSaving}
            aria-label={hasNote ? 'Edit pass note' : 'Pass with note'}
            title={`${hasNote ? 'Edit pass note' : 'Pass with note'} (N)`}
            className="inline-flex items-center gap-1.5 rounded-r-md border-l border-emerald-500 bg-emerald-600 px-2 py-1.5 text-white hover:bg-emerald-700 disabled:opacity-50 dark:border-emerald-700 dark:hover:bg-emerald-500"
          >
            <LightbulbIcon className="size-4" /> <Kbd>N</Kbd>
          </button>
        </div>
        <button
          type="button"
          onClick={onStartIssue}
          disabled={isSaving}
          aria-pressed={review?.verdict === 'issue'}
          className="inline-flex items-center gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-sm font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-50 aria-pressed:ring-2 aria-pressed:ring-amber-300 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200 dark:hover:bg-amber-900/50 dark:aria-pressed:ring-amber-800"
        >
          {review?.verdict === 'issue' ? '⚑ Edit issue' : '⚑ Issue'} <Kbd>I</Kbd>
        </button>
      </div>
    </div>
  )
}

// Wording and colours of the text box for each verdict. An issue needs text; a
// pass note is optional.
const FORMS = {
  issue: {
    label: "What's wrong with this output?",
    placeholder: 'e.g. "Ignored the 2-day limit and made up a tool result"',
    save: 'Save issue',
    saveClass: 'bg-amber-600 hover:bg-amber-700 dark:hover:bg-amber-500',
    focusClass: 'focus:border-amber-500 focus:ring-amber-500',
  },
  pass: {
    label: "✓ What's good about this output? (optional)",
    placeholder: 'e.g. "Asked a clarifying question before calculating"',
    save: 'Save pass',
    saveClass: 'bg-emerald-600 hover:bg-emerald-700 dark:hover:bg-emerald-500',
    focusClass: 'focus:border-emerald-500 focus:ring-emerald-500',
  },
}

function TextForm({ draft, isSaving, onDraftChange, onCancelDraft, onSaveDraft }: ReviewBarProps & { draft: Draft }) {
  const form = FORMS[draft.verdict]
  const canSave = !isSaving && (draft.verdict === 'pass' || draft.text.trim() !== '')
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        if (canSave) onSaveDraft()
      }}
    >
      <label htmlFor="review-text" className="text-sm font-medium text-slate-700 dark:text-slate-200">
        {form.label}
      </label>
      <textarea
        id="review-text"
        autoFocus
        rows={3}
        value={draft.text}
        onChange={(e) => onDraftChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
            e.preventDefault()
            if (canSave) onSaveDraft()
          } else if (e.key === 'Escape') {
            onCancelDraft()
          }
        }}
        placeholder={form.placeholder}
        className={`mt-2 block w-full resize-y rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-1 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 ${form.focusClass}`}
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="text-xs text-slate-500 dark:text-slate-400">
          <Kbd>Ctrl</Kbd>+<Kbd>Enter</Kbd> to save · <Kbd>Esc</Kbd> to cancel
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancelDraft}
            className="rounded-md px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className={`rounded-md px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 ${form.saveClass}`}
          >
            {isSaving ? 'Saving…' : form.save}
          </button>
        </div>
      </div>
    </form>
  )
}

// A keyboard key, e.g. <Kbd>P</Kbd>.
function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-current/30 px-1 font-sans text-[10px] leading-4 opacity-80">{children}</kbd>
  )
}
