import { AgentAvatar } from './AgentAvatar'

interface ChatBubbleProps {
	sender: string
	role?: string
	message: string
	timestamp?: string
	isHuman?: boolean
}

export function ChatBubble({ sender, role, message, timestamp, isHuman }: ChatBubbleProps) {
	return (
		<div className={`flex gap-3 mb-3 ${isHuman ? 'flex-row-reverse' : ''}`}>
			<AgentAvatar name={sender} role={isHuman ? undefined : role} />
			<div
				className={`max-w-[70%] p-3 ${
					isHuman
						? 'bg-purple/15 border border-purple/30'
						: 'bg-card border border-border'
				}`}
			>
				<div className="flex items-center gap-2 mb-1">
					<span className="text-xs font-semibold text-fg">{sender}</span>
					{timestamp && <span className="text-xs text-ghost">{timestamp}</span>}
				</div>
				<p className="text-sm text-muted whitespace-pre-wrap">{message}</p>
			</div>
		</div>
	)
}
