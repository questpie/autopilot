import { Markdown } from '@/components/ui/markdown'
import { SmartText } from '@/lib/smart-links'
import type { SessionMessage } from '@/api/types'

interface ChatMessageProps {
  message: SessionMessage
}

export function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'

  const timestamp = new Date(message.created_at).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
  })

  if (isSystem) return null

  if (isUser) {
    return (
      <div className="flex w-full justify-end">
        <div className="max-w-[72%] bg-muted px-4 py-3">
          <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
            You
          </p>
          <p className="font-sans text-sm leading-relaxed text-foreground whitespace-pre-wrap break-words">
            <SmartText text={message.content} />
          </p>
          <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">{timestamp}</p>
        </div>
      </div>
    )
  }

  // Assistant message — render as markdown
  return (
    <div className="flex w-full justify-start">
      <div className="max-w-[85%] bg-transparent px-4 py-3">
        <p className="font-mono text-[11px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
          Assistant
        </p>
        <Markdown content={message.content} className="prose prose-sm font-sans text-sm" />
        <p className="mt-1.5 font-mono text-[11px] text-muted-foreground">{timestamp}</p>
      </div>
    </div>
  )
}
