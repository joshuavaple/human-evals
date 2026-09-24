const TONES = {
  green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  red: 'bg-rose-50 text-rose-700 ring-rose-600/20',
  gray: 'bg-slate-100 text-slate-600 ring-slate-500/20',
} as const

interface BadgeProps {
  tone: keyof typeof TONES
  children: React.ReactNode
}

export function Badge({ tone, children }: BadgeProps) {
  return (
    <span className={`inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium ring-1 ring-inset ${TONES[tone]}`}>
      {children}
    </span>
  )
}
