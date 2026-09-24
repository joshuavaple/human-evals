import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import type { Message, Role } from '../lib/conversation'

const ROLE_STYLES: Record<Role, { label: string; bubble: string }> = {
  user: { label: 'User', bubble: 'bg-slate-100' },
  assistant: { label: 'Assistant', bubble: 'bg-indigo-50' },
  system: { label: 'System', bubble: 'bg-amber-50' },
  tool: { label: 'Tool result', bubble: 'border border-slate-200 bg-white' },
}

export function ConversationView({ messages }: { messages: Message[] }) {
  return (
    <div className="space-y-3">
      {messages.map((message, i) => {
        const style = ROLE_STYLES[message.role]
        return (
          <div key={i} className={`rounded-lg p-3 ${style.bubble}`}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">{style.label}</p>
            {message.text && (
              <div className="prose prose-sm max-w-none break-words prose-pre:whitespace-pre-wrap">
                <Markdown remarkPlugins={[remarkGfm]}>{message.text}</Markdown>
              </div>
            )}
            {message.toolCalls.map((call, j) => (
              <div key={j} className="mt-2 rounded-md border border-slate-200 bg-white p-2 text-xs">
                <p className="font-medium text-slate-700">Calls tool: <code>{call.name}</code></p>
                <pre className="mt-1 whitespace-pre-wrap text-slate-600">{call.args}</pre>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
