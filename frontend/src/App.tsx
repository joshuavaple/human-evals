import { Link, Navigate, Route, Routes } from 'react-router'

import { ThemeToggle } from '@/features/theme/components/ThemeToggle'
import { ExperimentPage } from '@/pages/ExperimentPage'
import { ExperimentsPage } from '@/pages/ExperimentsPage'

// The header shown on every page, and which page to show for each URL.
export default function App() {
  return (
    <div className="flex h-screen flex-col bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="flex items-center justify-between border-b border-slate-200 bg-white px-6 py-3 dark:border-slate-800 dark:bg-slate-900">
        <h1 className="text-lg font-semibold">
          <Link to="/">Human Evals</Link>
        </h1>
        <ThemeToggle />
      </header>
      <Routes>
        <Route path="/" element={<ExperimentsPage />} />
        <Route path="/experiments/:experimentId" element={<ExperimentPage />} />
        {/* Any other URL goes back to the experiment list. */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </div>
  )
}
