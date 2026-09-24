interface ErrorMessageProps {
  title: string
  error: Error
}

export function ErrorMessage({ title, error }: ErrorMessageProps) {
  return (
    <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-rose-700 dark:text-rose-300">{error.message}</p>
    </div>
  )
}
