import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import * as experimentsApi from '@/api/experiments'
import * as reviewsApi from '@/api/reviews'
import * as tracesApi from '@/api/traces'
import type { Review, TraceSummary } from '@/api/types'
import { renderApp } from '@/test/renderApp'

// Replace the real backend calls with fakes.
vi.mock('@/api/experiments')
vi.mock('@/api/reviews')
vi.mock('@/api/traces')

const passed: Review = { verdict: 'pass', comment: null, reviewer: 'me@example.com', updated_time_ms: 1 }

function turn(id: string, session: string, question: string, review: Review | null = null): TraceSummary {
  return {
    trace_id: id,
    session_id: session,
    request_time_ms: 1,
    state: 'OK',
    execution_duration_ms: 100,
    request_preview: question,
    response_preview: `answer to ${question}`,
    review,
  }
}

// Sidebar order: a1, a2 (already passed) | b1
const turns = {
  a1: turn('a1', 'A', 'First question'),
  a2: turn('a2', 'A', 'Second question', passed),
  b1: turn('b1', 'B', 'Other chat'),
}

// Turn buttons in the sidebar are the ones with aria-current (true when selected).
// Conversation headers also show their first question, so they're left out.
const turnButtons = () => screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-current'))
const turnButton = (question: string) => turnButtons().find((b) => b.textContent?.includes(question))!
const selectedTurn = () => turnButtons().find((b) => b.getAttribute('aria-current') === 'true')
// Buttons in the review bar under the trace (not the sidebar).
const reviewButton = (name: RegExp | string) =>
  within(screen.getByRole('region', { name: 'Review' })).getByRole('button', { name })

async function renderLoaded() {
  renderApp()
  await screen.findAllByRole('button', { expanded: true })
}

async function openFirstTurn() {
  await renderLoaded()
  await userEvent.click(turnButton('First question'))
  await screen.findByText('Turn 1 of 2')
}

beforeEach(() => {
  localStorage.clear()
  vi.mocked(experimentsApi.fetchExperiment).mockResolvedValue({
    experiment_id: '1',
    name: 'chatbot',
    path: '/Shared/chatbot',
    location: '/Shared',
    created_by: null,
    last_update_time_ms: 1,
  })
  vi.mocked(tracesApi.fetchConversations).mockResolvedValue({
    conversations: [
      { session_id: 'A', latest_request_time_ms: 2, traces: [turns.a1, turns.a2] },
      { session_id: 'B', latest_request_time_ms: 1, traces: [turns.b1] },
    ],
    has_more: false,
  })
  vi.mocked(tracesApi.fetchTrace).mockImplementation(async (_, id) => ({
    ...turns[id as keyof typeof turns],
    request: 'question',
    response: 'answer',
  }))
  vi.mocked(reviewsApi.saveReview).mockImplementation(async (_, __, input) => ({
    verdict: input.verdict,
    comment: input.comment ?? null,
    reviewer: 'me@example.com',
    updated_time_ms: 2,
  }))
  vi.mocked(reviewsApi.deleteReview).mockResolvedValue()
})

describe('Review bar', () => {
  it('passes a turn and moves to the next unreviewed one', async () => {
    await openFirstTurn()
    await userEvent.click(reviewButton('Pass'))

    expect(reviewsApi.saveReview).toHaveBeenCalledWith('1', 'a1', { verdict: 'pass' })
    expect(await screen.findByRole('status')).toHaveTextContent('Saved as Pass')
    // a2 is already reviewed, so it jumps to the other conversation's turn.
    expect(selectedTurn()).toHaveTextContent('Other chat')
    expect(turnButton('First question')).toHaveTextContent('Passed')
    expect(screen.getByRole('button', { name: /First question.*2\/2 reviewed/, expanded: true })).toBeInTheDocument()
  })

  it('reports an issue with a description', async () => {
    await openFirstTurn()
    await userEvent.click(reviewButton(/Issue/))

    const save = reviewButton('Save issue')
    expect(save).toBeDisabled() // nothing typed yet
    await userEvent.type(screen.getByLabelText("What's wrong with this output?"), 'Made up a number')
    await userEvent.keyboard('{Control>}{Enter}{/Control}')

    expect(reviewsApi.saveReview).toHaveBeenCalledWith('1', 'a1', { verdict: 'issue', comment: 'Made up a number' })
    await userEvent.click(turnButton('First question'))
    await screen.findByText(/You reported an issue/)
    expect(screen.getByRole('region', { name: 'Review' })).toHaveTextContent('You reported an issue: Made up a number')
    expect(reviewButton(/Edit issue/)).toBeInTheDocument()
  })

  it('keeps unsaved issue text when switching turns', async () => {
    await openFirstTurn()
    await userEvent.click(reviewButton(/Issue/))
    await userEvent.type(screen.getByRole('textbox'), 'half-written note')

    await userEvent.click(turnButton('Second question'))
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()
    await userEvent.click(turnButton('First question'))
    expect(screen.getByRole('textbox')).toHaveValue('half-written note')
  })

  it('undoes a save and goes back to that turn', async () => {
    await openFirstTurn()
    await userEvent.click(reviewButton('Pass'))
    await userEvent.click(within(await screen.findByRole('status')).getByRole('button', { name: 'Undo' }))

    expect(reviewsApi.deleteReview).toHaveBeenCalledWith('1', 'a1')
    expect(selectedTurn()).toHaveTextContent('First question')
    expect(turnButton('First question')).not.toHaveTextContent('Passed')
  })

  it('undo puts back the earlier verdict when replacing one', async () => {
    await renderLoaded()
    await userEvent.click(turnButton('Second question'))
    await userEvent.click(reviewButton(/Issue/))
    await userEvent.type(screen.getByRole('textbox'), 'Actually wrong')
    await userEvent.click(reviewButton('Save issue'))
    await userEvent.click(within(await screen.findByRole('status')).getByRole('button', { name: 'Undo' }))

    expect(reviewsApi.saveReview).toHaveBeenLastCalledWith('1', 'a2', { verdict: 'pass', comment: null })
  })

  it('stays on the turn when "go to next" is switched off', async () => {
    await openFirstTurn()
    await userEvent.click(screen.getByRole('checkbox', { name: /next unreviewed/ }))
    await userEvent.click(reviewButton('Pass'))

    expect(await screen.findByText('✓ You passed this turn')).toBeInTheDocument()
    expect(selectedTurn()).toHaveTextContent('First question')
  })

  it('shows an error when saving fails', async () => {
    vi.mocked(reviewsApi.saveReview).mockRejectedValue(new Error('Databricks is down'))
    await openFirstTurn()
    await userEvent.click(reviewButton('Pass'))
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save: Databricks is down")
  })
})

describe('Pass with note', () => {
  it('saves a pass with a note and marks the turn with a lightbulb', async () => {
    await openFirstTurn()
    await userEvent.click(reviewButton('Pass with note'))
    expect(screen.getByLabelText(/What's good about this output/)).toHaveFocus()
    await userEvent.type(screen.getByRole('textbox'), 'Asked a clarifying question')
    await userEvent.click(reviewButton('Save pass'))

    expect(reviewsApi.saveReview).toHaveBeenCalledWith('1', 'a1', {
      verdict: 'pass',
      comment: 'Asked a clarifying question',
    })
    expect(await screen.findByRole('status')).toHaveTextContent('Saved as Pass with note')
    expect(turnButton('First question')).toHaveTextContent('Passed with note')
    expect(turnButton('Second question')).not.toHaveTextContent('with note') // plain pass

    await userEvent.click(turnButton('First question'))
    expect(screen.getByRole('region', { name: 'Review' })).toHaveTextContent(
      'You passed this turn: Asked a clarifying question',
    )
    expect(reviewButton('Edit pass note')).toBeInTheDocument()
  })

  it('an empty note is a plain pass', async () => {
    await openFirstTurn()
    await userEvent.keyboard('n')
    expect(screen.getByRole('textbox')).toHaveValue('') // the "n" isn't typed into it
    expect(reviewButton('Save pass')).toBeEnabled()
    await userEvent.keyboard('{Control>}{Enter}{/Control}')
    expect(reviewsApi.saveReview).toHaveBeenCalledWith('1', 'a1', { verdict: 'pass' })
  })

  it('P on an already passed turn keeps its note and just moves on', async () => {
    await renderLoaded()
    await userEvent.click(turnButton('Second question')) // passed earlier
    await screen.findByText('Turn 2 of 2')
    await userEvent.keyboard('p')

    expect(reviewsApi.saveReview).not.toHaveBeenCalled()
    expect(selectedTurn()).toHaveTextContent('Other chat') // next unreviewed turn below
  })
})

describe('Keyboard shortcuts', () => {
  it('J/K move between turns, I opens the issue box, P passes', async () => {
    await renderLoaded()

    await userEvent.keyboard('j')
    expect(await screen.findByText('Turn 1 of 2')).toBeInTheDocument()
    await userEvent.keyboard('j')
    expect(await screen.findByText('Turn 2 of 2')).toBeInTheDocument()
    await userEvent.keyboard('k')
    expect(await screen.findByText('Turn 1 of 2')).toBeInTheDocument()

    await userEvent.keyboard('i')
    expect(screen.getByRole('textbox')).toHaveFocus()
    expect(screen.getByRole('textbox')).toHaveValue('') // the "i" isn't typed into it
    await userEvent.keyboard('{Escape}')
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument()

    await userEvent.keyboard('p')
    expect(reviewsApi.saveReview).toHaveBeenCalledWith('1', 'a1', { verdict: 'pass' })
  })

  it('are ignored while typing', async () => {
    await openFirstTurn()
    await userEvent.click(reviewButton(/Issue/))
    await userEvent.type(screen.getByRole('textbox'), 'jkp')
    expect(screen.getByRole('textbox')).toHaveValue('jkp')
    expect(reviewsApi.saveReview).not.toHaveBeenCalled()
  })
})
