import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as api from '@/api/traces'
import type { TraceSummary } from '@/api/types'
import App from './App'

// Replace the real backend calls with fakes.
vi.mock('@/api/traces')

function trace(id: string, sessionId: string, time: number, question: string): TraceSummary {
  return {
    trace_id: id,
    session_id: sessionId,
    request_time_ms: time,
    state: 'OK',
    execution_duration_ms: 1200,
    request_preview: question,
    response_preview: `answer to ${question}`,
  }
}

// The backend returns conversations latest first, turns oldest first.
const conversations = [
  {
    session_id: 'mortgage',
    latest_request_time_ms: 4,
    traces: [trace('m1', 'mortgage', 2, 'Can you plan my mortgage?'), trace('m2', 'mortgage', 4, 'Monthly, please')],
  },
  {
    session_id: 'weather',
    latest_request_time_ms: 3,
    traces: [trace('w1', 'weather', 3, 'Weather in Danang?')],
  },
]

// The list of turns shown under an expanded conversation header.
const turnList = (header: HTMLElement) => within(header.closest('li')!).getByRole('list')

function renderApp() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>,
  )
}

describe('App', () => {
  beforeEach(() => {
    vi.mocked(api.fetchConversations).mockResolvedValue({ conversations, has_more: false })
    vi.mocked(api.fetchTrace).mockResolvedValue({
      ...trace('m1', 'mortgage', 2, 'Can you plan my mortgage?'),
      request: { messages: [{ role: 'user', content: 'Can you plan my mortgage?' }] },
      response: { messages: [{ role: 'assistant', content: 'About **$2,000** a month.' }] },
    })
  })

  it('lists conversations latest first with the newest one open, turns in order', async () => {
    renderApp()
    await screen.findAllByRole('button', { expanded: true })
    const headers = screen.getAllByRole('button', { expanded: true }).concat(
      screen.getAllByRole('button', { expanded: false }),
    )
    expect(headers.map((h) => h.textContent)).toEqual([
      expect.stringContaining('2 turns'), // mortgage: open
      expect.stringContaining('1 turn'), // weather: closed
    ])

    const turns = within(turnList(headers[0])).getAllByRole('button')
    expect(turns[0]).toHaveTextContent('Can you plan my mortgage?')
    expect(turns[1]).toHaveTextContent('Monthly, please')
    expect(within(headers[1].closest('li')!).queryByRole('list')).not.toBeInTheDocument()
  })

  it('expands a conversation on click', async () => {
    renderApp()
    const weather = await screen.findByRole('button', { expanded: false })
    await userEvent.click(weather)
    expect(weather).toHaveAttribute('aria-expanded', 'true')
    expect(within(turnList(weather)).getByRole('button')).toHaveTextContent('Weather in Danang?')
  })

  it('shows the selected turn', async () => {
    renderApp()
    const header = await screen.findByRole('button', { expanded: true })
    await userEvent.click(within(turnList(header)).getAllByRole('button')[0])

    expect(await screen.findByText('m1')).toBeInTheDocument()
    expect(screen.getByText('$2,000')).toBeInTheDocument() // rendered as markdown bold
    expect(api.fetchTrace).toHaveBeenCalledWith('m1')
  })

  it('asks for more conversations when "Load more" is clicked', async () => {
    vi.mocked(api.fetchConversations).mockResolvedValue({ conversations, has_more: true })
    renderApp()
    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }))
    expect(api.fetchConversations).toHaveBeenLastCalledWith(40)
  })

  it('shows an error when the backend fails', async () => {
    vi.mocked(api.fetchConversations).mockRejectedValue(new Error('Experiment not found'))
    renderApp()
    expect(await screen.findByRole('alert')).toHaveTextContent('Experiment not found')
  })
})
