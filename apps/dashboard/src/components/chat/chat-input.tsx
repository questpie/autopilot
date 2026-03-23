import { useState, useRef, useCallback } from 'react'
import { PaperPlaneTilt } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { MentionDropdown } from '@/components/chat/mention-dropdown'
import { useAgents } from '@/hooks/use-agents'
import { useMention } from '@/hooks/use-mention'
import type { Agent } from '@/lib/types'

interface ChatInputProps {
	channel: string
	onSend: (message: string) => void
	isLoading?: boolean
}

export function ChatInput({ channel, onSend, isLoading }: ChatInputProps) {
	const [value, setValue] = useState('')
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const { data: agents } = useAgents()
	const mention = useMention(agents)

	const insertMention = useCallback(
		(agent: Agent) => {
			const before = value.slice(0, mention.state.startIndex)
			const after = value.slice(textareaRef.current?.selectionStart ?? value.length)
			const next = `${before}@${agent.id} ${after}`
			setValue(next)
			mention.close()
			requestAnimationFrame(() => {
				const pos = before.length + agent.id.length + 2
				textareaRef.current?.setSelectionRange(pos, pos)
				textareaRef.current?.focus()
			})
		},
		[value, mention],
	)

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLTextAreaElement>) => {
			const val = e.target.value
			const cursor = e.target.selectionStart ?? val.length
			setValue(val)

			const textBefore = val.slice(0, cursor)
			const atMatch = textBefore.match(/@(\w*)$/)
			if (atMatch) {
				const startIndex = cursor - atMatch[0].length
				if (!mention.state.active) {
					mention.open(startIndex)
				}
				mention.setQuery(atMatch[1] ?? '')
			} else if (mention.state.active) {
				mention.close()
			}
		},
		[mention],
	)

	const handleSend = useCallback(() => {
		const trimmed = value.trim()
		if (!trimmed || isLoading) return
		onSend(trimmed)
		setValue('')
		mention.close()
		textareaRef.current?.focus()
	}, [value, isLoading, onSend, mention])

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (mention.state.active && mention.filtered.length > 0) {
			if (e.key === 'ArrowUp') {
				e.preventDefault()
				mention.moveUp()
				return
			}
			if (e.key === 'ArrowDown') {
				e.preventDefault()
				mention.moveDown()
				return
			}
			if (e.key === 'Enter') {
				e.preventDefault()
				const selected = mention.filtered[mention.state.selectedIndex]
				if (selected) insertMention(selected)
				return
			}
		}
		if (e.key === 'Escape' && mention.state.active) {
			e.preventDefault()
			mention.close()
			return
		}
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			handleSend()
		}
	}

	return (
		<div className="relative flex items-end gap-2 p-4 border-t border-border">
			{mention.state.active && (
				<MentionDropdown
					agents={mention.filtered}
					selectedIndex={mention.state.selectedIndex}
					onSelect={insertMention}
				/>
			)}
			<Textarea
				ref={textareaRef}
				value={value}
				onChange={handleChange}
				onKeyDown={handleKeyDown}
				placeholder={`Message #${channel}...`}
				className="flex-1 min-h-[48px] max-h-[200px] resize-none"
				rows={1}
			/>
			<Button
				size="icon"
				onClick={handleSend}
				disabled={!value.trim() || isLoading}
			>
				<PaperPlaneTilt size={18} weight="fill" />
			</Button>
		</div>
	)
}
