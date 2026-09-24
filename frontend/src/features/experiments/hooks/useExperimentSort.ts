import { useSearchParams } from 'react-router'

import { DEFAULT_SORT, SORT_KEYS, type Sort, type SortKey } from '../lib/sortExperiments'

// The table's sort, kept in the page URL (e.g. "/?sort=name&dir=asc") so it is
// still there after opening an experiment and coming back.
export function useExperimentSort(): [Sort, (sort: Sort) => void] {
  const [params, setParams] = useSearchParams()

  const key = params.get('sort')
  const dir = params.get('dir')
  const sort: Sort =
    SORT_KEYS.includes(key as SortKey) && (dir === 'asc' || dir === 'desc')
      ? { key: key as SortKey, direction: dir }
      : DEFAULT_SORT

  // `replace` so sorting doesn't add browser history entries: "back" still
  // leaves the page instead of undoing sorts one by one.
  const setSort = (next: Sort) => setParams({ sort: next.key, dir: next.direction }, { replace: true })

  return [sort, setSort]
}
