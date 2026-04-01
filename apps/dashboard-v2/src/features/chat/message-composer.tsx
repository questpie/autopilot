import { useEffect, useRef, useState } from 'react'
import { PaperPlaneTiltIcon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { agentsQuery } from '@/features/team/team.queries'
import { cn } from '@/lib/utils'

interface MessageComposerProps {
	onSend: (message: string, agentId: string) => Promise<void> | void
	disabled?: boolean
	placeholder?: string
	defaultAgentId?: string
	lockAgentId?: boolean
	autoFocus?: boolean
	className?: string
}

const LAST_AGENT_STORAGE_KEY = 'dashboard-v3:last-agent-id'

export function MessageComposer({
	onSend,
	disabled = false,
	placeholder = 'Ask anything...',
	defaultAgentId,
	lockAgentId = false,
	autoFocus = false,
	className,
}: MessageComposerProps): React.JSX.Element {
	const [message, setMessage] = useState('')
	const [selectedAgentId, setSelectedAgentId] = useState<string>(defaultAgentId ?? '')
	const textareaRef = useRef<HTMLTextAreaElement | null>(null)
	const { data: agents = [], isLoading, isError } = useQuery(agentsQuery)

	useEffect(() => {
		if (!agents.length) return

		if (lockAgentId && defaultAgentId) {
			setSelectedAgentId(defaultAgentId)
			return
		}

		const lastAgentId =
			typeof window !== 'undefined' ? window.localStorage.getItem(LAST_AGENT_STORAGE_KEY) : null
		const fallbackAgentId = defaultAgentId ?? lastAgentId ?? agents[0]?.id ?? ''
		if (fallbackAgentId) {
			setSelectedAgentId(fallbackAgentId)
		}
	}, [agents, defaultAgentId, lockAgentId])

	useEffect(() => {
		const element = textareaRef.current
		if (!element) return
		element.style.height = '0px'
		element.style.height = `${Math.min(element.scrollHeight, 200)}px`
	}, [message])

	const canSend =
		!disabled && message.trim().length > 0 && (lockAgentId ? !!defaultAgentId : !!selectedAgentId)

	const submit = async () => {
		if (!canSend) return
		const trimmed = message.trim()
		const agentId = lockAgentId ? (defaultAgentId ?? selectedAgentId) : selectedAgentId
		if (!trimmed || !agentId) return

		try {
			await onSend(trimmed, agentId)
			setMessage('')
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to send message')
			return
		}

		if (!lockAgentId && typeof window !== 'undefined') {
			window.localStorage.setItem(LAST_AGENT_STORAGE_KEY, agentId)
		}
	}

	return (
		<div className={cn('bg-background p-4', className)}>
			<div className="border border-border bg-card">
				{lockAgentId ? null : agents.length > 1 ? (
					<div className="border-b border-border p-2">
						<select
							value={selectedAgentId}
							onChange={(event) => setSelectedAgentId(event.target.value)}
							className="w-full bg-transparent font-heading text-xs outline-none"
							disabled={disabled}
						>
							{agents.map((agent) => (
								<option key={agent.id} value={agent.id}>
									{agent.name}
								</option>
							))}
						</select>
					</div>
				) : null}

				<div className="flex items-end gap-3 p-3">
					<div className="min-w-0 flex-1">
						<Textarea
							ref={textareaRef}
							value={message}
							onChange={(event) => setMessage(event.target.value)}
							placeholder={
								isLoading
									? 'Loading agents...'
									: isError
										? 'Unable to load agents.'
										: agents.length === 0
											? 'No agents configured.'
											: placeholder
							}
							autoFocus={autoFocus}
							aria-label="Message"
							disabled={disabled || (!lockAgentId && agents.length === 0)}
							className="min-h-[56px]  max-h-[200px]  resize-none border-0 px-0 py-0 font-heading text-sm shadow-none focus-visible:ring-0"
							onKeyDown={(event) => {
								if (event.key === 'Escape') {
									textareaRef.current?.blur()
								}

								if (event.key === 'Enter' && (event.metaKey || event.ctrlKey || !event.shiftKey)) {
									event.preventDefault()
									void submit()
								}
							}}
						/>
						{!lockAgentId && agents.length === 1 ? (
							<div className="mt-2 text-[11px] text-muted-foreground">
								Talking to {agents[0]?.name ?? 'your first agent'}
							</div>
						) : null}
						{!lockAgentId && agents.length === 0 && !isLoading ? (
							<div className="mt-2 text-[11px] text-destructive">
								No agents configured. Add an agent in your `team/agents/` directory.
							</div>
						) : null}
					</div>

					<Button
						type="button"
						size="icon"
						onClick={() => void submit()}
						disabled={!canSend}
						aria-label="Send message"
					>
						<PaperPlaneTiltIcon className="size-4" />
					</Button>
				</div>
			</div>
		</div>
	)
}
