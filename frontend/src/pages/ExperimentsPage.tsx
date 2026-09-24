import { ExperimentTable } from '@/features/experiments/components/ExperimentTable'

// Home page ("/"): pick an experiment to review.
export function ExperimentsPage() {
  return (
    // Fills the space under the header and scrolls on its own, so the header stays put.
    <main className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl p-6">
        <ExperimentTable />
      </div>
    </main>
  )
}
