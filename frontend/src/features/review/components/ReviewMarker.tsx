import type { Review } from '@/api/types'
import { LightbulbIcon } from '@/components/ui/LightbulbIcon'

// ✓ (with a lightbulb when there's a note) or ⚑ next to a reviewed turn in the
// sidebar. The label is spelled out for screen readers and shown as a tooltip,
// so it doesn't rely on colour alone.
export function ReviewMarker({ review }: { review: Review | null }) {
  if (review === null) return null
  const passed = review.verdict === 'pass'
  const label = passed ? (review.comment ? 'Passed with note' : 'Passed') : 'Issue reported'
  return (
    <span
      title={review.comment ? `${label}: ${review.comment}` : label}
      className={`inline-flex items-center gap-0.5 text-xs font-semibold ${passed ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400'}`}
    >
      <span aria-hidden="true">{passed ? '✓' : '⚑'}</span>
      {passed && review.comment && <LightbulbIcon className="size-3 text-amber-500 dark:text-amber-300" />}
      <span className="sr-only">{label}</span>
    </span>
  )
}
