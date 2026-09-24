import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as api from '@/api/traces'
import App from './App'

// Replace the real backend calls with fakes.
vi.mock('@/api/traces')

const summary = {
  trace_id: 'tr-1',
  request_time_ms: 1_700_000_000_000,
  state: 'OK',
  execution_duration_ms: 1200,
  request_preview: 'What is my monthly payment?',
  response_preview: 'About $2,000.',
}

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
    vi.mocked(api.fetchTraces).mockResolvedValue({ traces: [summary], next_page_token: null })
    vi.mocked(api.fetchTrace).mockResolvedValue({
      ...summary,
      request: { messages: [{ role: 'user', content: 'What is my monthly payment?' }] },
      response: { messages: [{ role: 'assistant', content: 'About **$2,000**.' }] },
    })
  })

  it('lists traces and shows the selected one', async () => {
    renderApp()
    await userEvent.click(await screen.findByText('What is my monthly payment?'))

    expect(await screen.findByText('tr-1')).toBeInTheDocument()
    expect(screen.getByText('$2,000')).toBeInTheDocument() // rendered as markdown bold
    expect(api.fetchTrace).toHaveBeenCalledWith('tr-1')
  })

  it('shows an error when the backend fails', async () => {
    vi.mocked(api.fetchTraces).mockRejectedValue(new Error('Experiment not found'))
    renderApp()
    expect(await screen.findByRole('alert')).toHaveTextContent('Experiment not found')
  })
})
