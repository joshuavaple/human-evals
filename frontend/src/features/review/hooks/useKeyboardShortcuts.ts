import { useEffect, useRef } from 'react'

// Runs a handler when its key is pressed anywhere on the page, e.g.
// useKeyboardShortcuts({ p: pass, j: next }). Ignored while typing in a text
// field or when Ctrl/⌘/Alt is held, so normal typing and browser shortcuts work.
export function useKeyboardShortcuts(handlers: Record<string, () => void>) {
  // Always call the latest handlers without re-adding the listener each render.
  const latest = useRef(handlers)
  useEffect(() => {
    latest.current = handlers
  })

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.ctrlKey || event.metaKey || event.altKey) return
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, select, [contenteditable="true"]')) return
      const handler = latest.current[event.key.toLowerCase()]
      if (!handler) return
      // Stop the key from also being typed, e.g. "i" into the issue box it opens.
      event.preventDefault()
      handler()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [])
}
