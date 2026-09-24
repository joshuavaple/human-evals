import { useState } from 'react'

const STORAGE_KEY = 'autoAdvance'

// Whether saving a review jumps to the next unreviewed turn. On by default;
// the choice is remembered in the browser.
export function useAutoAdvance(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(() => {
    try {
      return localStorage.getItem(STORAGE_KEY) !== 'off'
    } catch {
      return true
    }
  })

  const set = (value: boolean) => {
    setOn(value)
    try {
      localStorage.setItem(STORAGE_KEY, value ? 'on' : 'off')
    } catch {
      // Not saved; still applies for this visit.
    }
  }

  return [on, set]
}
