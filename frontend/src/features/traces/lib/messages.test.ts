import { describe, expect, it } from 'vitest'

import { toMessages } from './messages'

describe('toMessages', () => {
  it('wraps a plain string in a single message', () => {
    expect(toMessages('hi', 'user')).toEqual([{ role: 'user', text: 'hi', toolCalls: [] }])
  })

  it('reads OpenAI-style chat messages', () => {
    const value = { messages: [{ role: 'user', content: 'hello' }, { role: 'assistant', content: 'hi!' }] }
    expect(toMessages(value, 'user')).toEqual([
      { role: 'user', text: 'hello', toolCalls: [] },
      { role: 'assistant', text: 'hi!', toolCalls: [] },
    ])
  })

  it('reads a ResponsesAgent request', () => {
    const value = {
      input: [{ type: 'message', role: 'user', content: 'good thanks', status: null }],
      context: { conversation_id: 'abc' },
    }
    expect(toMessages(value, 'user')).toEqual([{ role: 'user', text: 'good thanks', toolCalls: [] }])
  })

  it('reads a ResponsesAgent response with tool calls', () => {
    const value = {
      object: 'response',
      output: [
        { type: 'function_call', name: 'get_rate', arguments: '{"term": 30}' },
        { type: 'function_call_output', output: '6.5%' },
        { type: 'message', role: 'assistant', content: [{ type: 'output_text', text: 'The rate is 6.5%.' }] },
      ],
    }
    expect(toMessages(value, 'assistant')).toEqual([
      { role: 'assistant', text: '', toolCalls: [{ name: 'get_rate', args: '{"term": 30}' }] },
      { role: 'tool', text: '6.5%', toolCalls: [] },
      { role: 'assistant', text: 'The rate is 6.5%.', toolCalls: [] },
    ])
  })

  it('reads LangChain messages', () => {
    const value = {
      messages: [
        { type: 'human', content: 'weather in Danang?' },
        { type: 'ai', content: '', tool_calls: [{ name: 'get_weather', args: { location: 'Danang' } }] },
        { type: 'tool', content: 'sunny' },
      ],
    }
    const messages = toMessages(value, 'user')
    expect(messages?.map((m) => m.role)).toEqual(['user', 'assistant', 'tool'])
    expect(messages?.[1].toolCalls[0].name).toBe('get_weather')
  })

  it('reads an OpenAI chat completion', () => {
    const value = { choices: [{ message: { role: 'assistant', content: 'done' } }] }
    expect(toMessages(value, 'assistant')).toEqual([{ role: 'assistant', text: 'done', toolCalls: [] }])
  })

  it('returns null for shapes it does not recognise, so raw JSON is shown', () => {
    expect(toMessages({ foo: 1 }, 'user')).toBeNull()
    expect(toMessages({ messages: [{ role: 'robot', content: 'x' }] }, 'user')).toBeNull()
    expect(toMessages(42, 'user')).toBeNull()
  })
})
