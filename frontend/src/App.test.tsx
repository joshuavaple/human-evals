import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as experimentsApi from '@/api/experiments'
import * as api from '@/api/traces'
import type { TraceSummary } from '@/api/types'
import App from './App'

// Replace the real backend calls with fakes.
vi.mock('@/api/experiments')
vi.mock('@/api/traces')

const experiments = [
  {
    experiment_id: '1',
    name: 'chatbot',
    path: '/Shared/chatbot',
    location: '/Shared',
    created_by: 'zoe@example.com',
    last_update_time_ms: 2,
  },
  {
    experiment_id: '2',
    name: 'rag-agent',
    path: '/Shared/rag-agent',
    location: '/Shared',
    created_by: 'amy@example.com',
    last_update_time_ms: 1,
  },
]

// Experiment names in the order the table shows them.
const rowNames = () => screen.getAllByRole('row').slice(1).map((row) => within(row).getByRole('link').textContent)

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

// Renders the whole app as if the browser were at `path`.
function renderApp(path = '/experiments/1') {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[path]}>
        <App />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  vi.mocked(experimentsApi.fetchExperiments).mockResolvedValue({ folder: '/Shared', experiments })
  vi.mocked(experimentsApi.fetchExperiment).mockImplementation(async (id) => {
    const found = experiments.find((e) => e.experiment_id === id)
    if (!found) throw new Error(`Experiment not found: ${id}`)
    return found
  })
})

describe('Experiment browsing', () => {
  beforeEach(() => {
    vi.mocked(api.fetchConversations).mockResolvedValue({ conversations: [], has_more: false })
  })

  it('lists experiments in a table, newest first', async () => {
    renderApp('/')
    expect(await screen.findByRole('columnheader', { name: 'Last modified' })).toHaveAttribute('aria-sort', 'descending')
    expect(screen.getAllByRole('columnheader').map((h) => h.textContent)).toEqual([
      'Name↓',
      'Created by↓',
      'Last modified↓',
      'Location↓',
    ])
    expect(rowNames()).toEqual(['chatbot', 'rag-agent'])
    expect(screen.getByRole('link', { name: 'rag-agent' })).toHaveAttribute('href', '/experiments/2')
    expect(screen.getByRole('row', { name: /rag-agent/ })).toHaveTextContent('amy@example.com')
  })

  it('sorts by a column when its header is clicked, and flips on a second click', async () => {
    renderApp('/')
    await userEvent.click(await screen.findByRole('button', { name: /Created by/ }))
    expect(screen.getByRole('columnheader', { name: /Created by/ })).toHaveAttribute('aria-sort', 'ascending')
    expect(screen.getByRole('columnheader', { name: /Last modified/ })).toHaveAttribute('aria-sort', 'none')
    expect(rowNames()).toEqual(['rag-agent', 'chatbot']) // amy before zoe

    await userEvent.click(screen.getByRole('button', { name: /Created by/ }))
    expect(screen.getByRole('columnheader', { name: /Created by/ })).toHaveAttribute('aria-sort', 'descending')
    expect(rowNames()).toEqual(['chatbot', 'rag-agent'])
  })

  it('opens an experiment by clicking anywhere on its row', async () => {
    renderApp('/')
    await userEvent.click(await screen.findByText('amy@example.com'))
    expect(await screen.findByText('/Shared/rag-agent')).toBeInTheDocument()
  })

  it('keeps the sort when going back to the list', async () => {
    renderApp('/?sort=name&dir=desc')
    expect(await screen.findByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'descending')
    await userEvent.click(screen.getByRole('link', { name: 'chatbot' }))
    await userEvent.click(await screen.findByRole('link', { name: '← All experiments' }))
    expect(await screen.findByRole('columnheader', { name: /Name/ })).toHaveAttribute('aria-sort', 'descending')
    expect(rowNames()).toEqual(['rag-agent', 'chatbot'])
  })

  it('opens an experiment and goes back to the list', async () => {
    renderApp('/')
    await userEvent.click(await screen.findByRole('link', { name: 'rag-agent' }))

    expect(await screen.findByText('/Shared/rag-agent')).toBeInTheDocument()
    expect(api.fetchConversations).toHaveBeenCalledWith('2', 20)

    await userEvent.click(screen.getByRole('link', { name: '← All experiments' }))
    expect(await screen.findByRole('link', { name: 'chatbot' })).toBeInTheDocument()
  })

  it('shows an error for an experiment that does not exist', async () => {
    renderApp('/experiments/404')
    expect(await screen.findByRole('alert')).toHaveTextContent('Experiment not found: 404')
    expect(screen.getByRole('link', { name: '← All experiments' })).toBeInTheDocument()
  })

  it('sends unknown URLs to the experiment list', async () => {
    renderApp('/no/such/page')
    expect(await screen.findByRole('link', { name: 'chatbot' })).toBeInTheDocument()
  })
})

describe('Experiment page', () => {
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
    expect(api.fetchTrace).toHaveBeenCalledWith('1', 'm1')
  })

  it('asks for more conversations when "Load more" is clicked', async () => {
    vi.mocked(api.fetchConversations).mockResolvedValue({ conversations, has_more: true })
    renderApp()
    await userEvent.click(await screen.findByRole('button', { name: 'Load more' }))
    expect(api.fetchConversations).toHaveBeenLastCalledWith('1', 40)
  })

  it('shows an error when the backend fails', async () => {
    vi.mocked(api.fetchConversations).mockRejectedValue(new Error('Experiment not found'))
    renderApp()
    expect(await screen.findByRole('alert')).toHaveTextContent('Experiment not found')
  })
})
