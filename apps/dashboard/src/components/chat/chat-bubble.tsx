import { AgentAvatar } from '@/components/data/agent-avatar'
import { Badge } from '@/components/ui/badge'
import { PROSE_CLASSES, renderMarkdown } from '@/lib/markdown'
import type { ChatMessage } from '@/lib/types'
import { cn } from '@/lib/utils'

interface ChatBubbleProps {
	message: ChatMessage
	agentRole?: string
}

export function ChatBubble({ message, agentRole }: ChatBubbleProps) {
	if (message.type === 'system') {
		return (
			<div className="text-center py-2">
				<span className="font-mono text-[11px] text-muted-foreground">{message.content}</span>
			</div>
		)
	}

	const isHuman = message.type === 'human'
	const date = new Date(message.timestamp)
	const time = Number.isNaN(date.getTime())
		? ''
		: date.toLocaleTimeString('en-US', {
				hour: '2-digit',
				minute: '2-digit',
				hour12: false,
			})

	return (
		<div className={cn('flex gap-3', isHuman ? 'justify-end' : 'justify-start')}>
			{!isHuman && <AgentAvatar name={message.sender} role={agentRole} size="md" />}
			<div className={cn('max-w-[70%]')}>
				{!isHuman && (
					<div className="flex items-center gap-2 mb-1">
						<span className="font-mono text-[11px] font-semibold">{message.sender}</span>
						{agentRole && (
							<Badge variant="outline" className="text-[8px]">
								{agentRole}
							</Badge>
						)}
					</div>
				)}
				<div
					className={cn(
						'p-3',
						isHuman
							? 'bg-card border border-border'
							: 'bg-card border border-border',
					)}
				>
					<div
						className={PROSE_CLASSES}
						dangerouslySetInnerHTML={{ __html: renderMarkdown(message.content) }}
					/>
					<div
						className={cn(
							'font-mono text-[10px] text-muted-foreground mt-2',
							isHuman && 'text-right',
						)}
					>
						{time}
					</div>
				</div>
			</div>
		</div>
	)
}
