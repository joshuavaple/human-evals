// Turns a trace's raw request/response JSON into a list of chat messages.
//
// Agents log their inputs/outputs in different shapes. We recognise the
// common ones below; anything else returns null and is shown as raw JSON.
//
//   OpenAI chat / MLflow ChatAgent   {"messages": [{"role", "content"}]}
//   OpenAI chat completion           {"choices": [{"message": {...}}]}
//   MLflow ResponsesAgent (request)  {"input":  [{"type": "message", "role", "content"}]}
//   MLflow ResponsesAgent (response) {"output": [{"type": "message" | "function_call" | ...}]}
//   LangChain messages               {"messages": [{"type": "human" | "ai" | "tool", ...}]}
//   Plain string                     "hello"

export type Role = 'user' | 'assistant' | 'system' | 'tool'

export interface ToolCall {
  name: string
  args: string
}

export interface Message {
  role: Role
  text: string
  toolCalls: ToolCall[]
}

type Json = Record<string, unknown>

const isObject = (v: unknown): v is Json => typeof v === 'object' && v !== null && !Array.isArray(v)

export function toMessages(value: unknown, defaultRole: Role): Message[] | null {
  if (typeof value === 'string') return [message(defaultRole, value)]
  if (!isObject(value)) return null

  if (Array.isArray(value.messages)) return parseItems(value.messages)
  if (Array.isArray(value.input)) return parseItems(value.input)
  if (Array.isArray(value.output)) return parseItems(value.output)
  if (Array.isArray(value.choices)) {
    return parseItems(value.choices.map((c) => (isObject(c) ? c.message : null)))
  }
  return null
}

function parseItems(items: unknown[]): Message[] | null {
  const messages: Message[] = []
  for (const item of items) {
    const parsed = parseItem(item)
    if (parsed === null) return null
    messages.push(parsed)
  }
  return messages.length > 0 ? messages : null
}

function parseItem(item: unknown): Message | null {
  if (!isObject(item)) return null

  // ResponsesAgent items that aren't plain messages.
  if (item.type === 'function_call') {
    return { role: 'assistant', text: '', toolCalls: [toolCall(item.name, item.arguments)] }
  }
  if (item.type === 'function_call_output') return message('tool', stringify(item.output))

  const role = toRole(item.role ?? item.type)
  if (role === null) return null

  const calls = Array.isArray(item.tool_calls) ? item.tool_calls : []
  return {
    role,
    text: contentToText(item.content),
    toolCalls: calls.filter(isObject).map((c) => {
      // OpenAI nests name/arguments under "function"; LangChain uses name/args.
      const fn = isObject(c.function) ? c.function : c
      return toolCall(fn.name, fn.arguments ?? fn.args)
    }),
  }
}

function toRole(value: unknown): Role | null {
  switch (value) {
    case 'user':
    case 'human':
      return 'user'
    case 'assistant':
    case 'ai':
      return 'assistant'
    case 'system':
      return 'system'
    case 'tool':
    case 'function':
      return 'tool'
    default:
      return null
  }
}

// Content is either a string or a list of parts like {"type": "output_text", "text": "..."}.
function contentToText(content: unknown): string {
  if (content == null) return ''
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((part) => (isObject(part) && typeof part.text === 'string' ? part.text : stringify(part)))
      .join('\n\n')
  }
  return stringify(content)
}

function toolCall(name: unknown, args: unknown): ToolCall {
  return { name: typeof name === 'string' ? name : 'unknown', args: stringify(args) }
}

function message(role: Role, text: string): Message {
  return { role, text, toolCalls: [] }
}

function stringify(value: unknown): string {
  return typeof value === 'string' ? value : JSON.stringify(value, null, 2)
}
