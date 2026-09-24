// A lightbulb drawn as SVG so it takes the surrounding text colour and size.
// (The 💡 character is a colour emoji and ignores both.)
export function LightbulbIcon({ className = 'size-3.5' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={`inline-block shrink-0 ${className}`}
    >
      <path d="M9 18h6M10 22h4" />
      <path d="M12 2a7 7 0 0 0-4 12.74c.63.46 1 1.2 1 1.98V17h6v-.28c0-.78.37-1.52 1-1.98A7 7 0 0 0 12 2Z" />
    </svg>
  )
}
