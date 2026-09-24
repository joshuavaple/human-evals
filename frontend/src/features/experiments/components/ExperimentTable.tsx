import { Link, useLocation, useNavigate } from 'react-router'

import { ErrorMessage } from '@/components/ui/ErrorMessage'
import { formatTimestamp } from '@/features/traces/lib/format'

import { useExperimentList } from '../hooks/useExperimentList'
import { useExperimentSort } from '../hooks/useExperimentSort'
import { nextSort, type Sort, type SortKey, sortExperiments } from '../lib/sortExperiments'

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: 'name', label: 'Name' },
  { key: 'created_by', label: 'Created by' },
  { key: 'last_modified', label: 'Last modified' },
  { key: 'location', label: 'Location' },
]

// The experiments in the backend's folder, as a table like the Databricks
// Experiments tab. Click a column header to sort; click a row to open it.
export function ExperimentTable() {
  const { data, error, isPending } = useExperimentList()
  const [sort, setSort] = useExperimentSort()
  const navigate = useNavigate()
  // Passed to the experiment page so its "All experiments" link comes back to
  // this list with the same sort.
  const linkState = { listSearch: useLocation().search }

  if (isPending) return <p className="text-sm text-slate-500 dark:text-slate-400">Loading experiments…</p>
  if (error) return <ErrorMessage title="Could not load experiments" error={error} />

  const experiments = sortExperiments(data.experiments, sort)

  return (
    <div>
      <h2 className="text-base font-semibold">Experiments</h2>
      <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
        {experiments.length} in <code className="font-mono">{data.folder}</code>
      </p>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
        Click an experiment to start evaluating its conversations. Click a column header to sort.
      </p>
      {experiments.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">This folder has no experiments.</p>
      ) : (
        <div className="mt-4 overflow-x-auto rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 text-xs text-slate-500 dark:border-slate-800 dark:text-slate-400">
              <tr>
                {COLUMNS.map((column) => (
                  <SortableHeader
                    key={column.key}
                    label={column.label}
                    sortKey={column.key}
                    sort={sort}
                    onSort={(key) => setSort(nextSort(sort, key))}
                  />
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {experiments.map((experiment) => {
                const href = `/experiments/${experiment.experiment_id}`
                return (
                  <tr
                    key={experiment.experiment_id}
                    // The whole row opens the experiment. The name stays a real
                    // link so keyboard users and middle-click still work.
                    onClick={(event) => {
                      if (!(event.target as HTMLElement).closest('a')) navigate(href, { state: linkState })
                    }}
                    className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60"
                  >
                    <td className="px-4 py-3">
                      <Link to={href} state={linkState} className="font-medium text-indigo-600 hover:underline dark:text-indigo-400">
                        {experiment.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{experiment.created_by ?? '—'}</td>
                    <td className="whitespace-nowrap px-4 py-3 text-slate-600 dark:text-slate-300">
                      {experiment.last_update_time_ms === null ? '—' : formatTimestamp(experiment.last_update_time_ms)}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-500 dark:text-slate-400">{experiment.location}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

interface SortableHeaderProps {
  label: string
  sortKey: SortKey
  sort: Sort
  onSort: (key: SortKey) => void
}

function SortableHeader({ label, sortKey, sort, onSort }: SortableHeaderProps) {
  const active = sort.key === sortKey
  const ariaSort = active ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'
  return (
    // aria-sort tells screen readers (and the tests) how the table is sorted.
    <th scope="col" aria-sort={ariaSort} className="px-4 py-2 font-medium">
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-slate-100 ${active ? 'text-slate-900 dark:text-slate-100' : ''}`}
      >
        {label}
        {/* Only the sorted column shows an arrow; the others keep the space so headers don't shift. */}
        <span aria-hidden="true" className={active ? '' : 'invisible'}>
          {sort.direction === 'asc' ? '↑' : '↓'}
        </span>
      </button>
    </th>
  )
}
