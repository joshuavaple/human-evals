import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'

import { STORAGE_KEY } from '../lib/theme'
import { ThemeToggle } from './ThemeToggle'

const isDark = () => document.documentElement.classList.contains('dark')

describe('ThemeToggle', () => {
  beforeEach(() => {
    localStorage.clear()
    document.documentElement.classList.remove('dark')
  })

  it('switches to dark mode and back, remembering the choice', async () => {
    render(<ThemeToggle />)
    expect(isDark()).toBe(false)

    await userEvent.click(screen.getByRole('button', { name: 'Switch to dark mode' }))
    expect(isDark()).toBe(true)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark')

    await userEvent.click(screen.getByRole('button', { name: 'Switch to light mode' }))
    expect(isDark()).toBe(false)
    expect(localStorage.getItem(STORAGE_KEY)).toBe('light')
  })

  it('starts in the saved theme', () => {
    localStorage.setItem(STORAGE_KEY, 'dark')
    render(<ThemeToggle />)
    expect(isDark()).toBe(true)
    expect(screen.getByRole('button', { name: 'Switch to light mode' })).toBeInTheDocument()
  })
})
