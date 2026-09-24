import { useEffect, useRef } from 'react'

import type { SavedNotice } from '../hooks/useReviewFlow'

const VISIBLE_MS = 6000

interface SavedNoticeToastProps {
  notice: SavedNotice
  onUndo: () => void
  onDismiss: () => void
}

// "Saved as Pass · Undo", shown for a few seconds after each save instead of an
// "Are you sure?" dialog.
export function SavedNoticeToast({ notice, onUndo, onDismiss }: SavedNoticeToastProps) {
  // The timer restarts only for a new notice, but always calls the latest onDismiss.
  const dismiss = useRef(onDismiss)
  useEffect(() => {
    dismiss.current = onDismiss
  })
  useEffect(() => {
    const timer = setTimeout(() => dismiss.current(), VISIBLE_MS)
    return () => clearTimeout(timer)
  }, [notice.id])

  return (
    <div
      role="status"
      className="fixed bottom-28 right-6 z-10 flex items-center gap-3 rounded-lg bg-slate-900 px-4 py-2 text-sm text-white shadow-lg dark:bg-slate-100 dark:text-slate-900"
    >
      <span>{notice.message}</span>
      <button type="button" onClick={onUndo} className="font-medium text-indigo-300 hover:underline dark:text-indigo-700">
        Undo
      </button>
      <button type="button" onClick={onDismiss} aria-label="Dismiss" className="opacity-60 hover:opacity-100">
        ×
      </button>
    </div>
  )
}
