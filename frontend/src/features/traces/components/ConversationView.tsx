import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

import type { Message, Role } from '../lib/conversation'

const ROLE_STYLES: Record<Role, { label: string; bubble: string }> = {
  user: { label: 'User', bubble: 'bg-slate-100 dark:bg-slate-800' },
  assistant: { label: 'Assistant', bubble: 'bg-indigo-50 dark:bg-indigo-950/60' },
  system: { label: 'System', bubble: 'bg-amber-50 dark:bg-amber-950/40' },
  tool: { label: 'Tool result', bubble: 'border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900' },
}

export function ConversationView({ messages }: { messages: Message[] }) {
  return (
    <div className="space-y-3">
      {messages.map((message, i) => {
        const style = ROLE_STYLES[message.role]
        return (
          <div key={i} className={`rounded-lg p-3 ${style.bubble}`}>
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{style.label}</p>
            {message.text && (
              <div className="prose prose-sm max-w-none break-words prose-pre:whitespace-pre-wrap dark:prose-invert">
                <Markdown remarkPlugins={[remarkGfm]}>{message.text}</Markdown>
              </div>
            )}
            {message.toolCalls.map((call, j) => (
              <div key={j} className="mt-2 rounded-md border border-slate-200 bg-white p-2 text-xs dark:border-slate-700 dark:bg-slate-900">
                <p className="font-medium text-slate-700 dark:text-slate-200">Calls tool: <code>{call.name}</code></p>
                <pre className="mt-1 whitespace-pre-wrap text-slate-600 dark:text-slate-400">{call.args}</pre>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
