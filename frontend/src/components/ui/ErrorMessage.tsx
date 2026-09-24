interface ErrorMessageProps {
  title: string
  error: Error
}

export function ErrorMessage({ title, error }: ErrorMessageProps) {
  return (
    <div role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-rose-700">{error.message}</p>
    </div>
  )
}
