import type { ExperimentSummary } from '@/api/types'

// Sorting for the experiment table. Plain functions, no React, so they're easy to test.

export type SortKey = 'name' | 'created_by' | 'last_modified' | 'location'
export type SortDirection = 'asc' | 'desc'

export interface Sort {
  key: SortKey
  direction: SortDirection
}

export const SORT_KEYS: SortKey[] = ['name', 'created_by', 'last_modified', 'location']

// Newest first, like the Databricks Experiments tab.
export const DEFAULT_SORT: Sort = { key: 'last_modified', direction: 'desc' }

// What the value of each column is, for comparing.
const VALUE: Record<SortKey, (e: ExperimentSummary) => string | number | null> = {
  name: (e) => e.name,
  created_by: (e) => e.created_by,
  last_modified: (e) => e.last_update_time_ms,
  location: (e) => e.location,
}

// "numeric" puts "exp-2" before "exp-10"; "base" ignores upper/lower case.
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

function compareValues(a: string | number, b: string | number): number {
  return typeof a === 'number' && typeof b === 'number' ? a - b : collator.compare(String(a), String(b))
}

// Returns a sorted copy. Empty values go last in both directions; ties are
// broken by name so the order never jumps around.
export function sortExperiments(experiments: ExperimentSummary[], sort: Sort): ExperimentSummary[] {
  const sign = sort.direction === 'asc' ? 1 : -1
  const value = VALUE[sort.key]
  return [...experiments].sort((x, y) => {
    const a = value(x)
    const b = value(y)
    if (a === null || b === null) {
      if (a !== b) return a === null ? 1 : -1
    } else {
      const byColumn = compareValues(a, b)
      if (byColumn !== 0) return sign * byColumn
    }
    return collator.compare(x.name, y.name)
  })
}

// The sort after clicking a column header: the same column flips direction;
// a new column starts A→Z for text and newest first for dates.
export function nextSort(current: Sort, key: SortKey): Sort {
  if (current.key === key) return { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
  return { key, direction: key === 'last_modified' ? 'desc' : 'asc' }
}
