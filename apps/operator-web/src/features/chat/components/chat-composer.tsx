import { useRef, useState, useCallback, type KeyboardEvent } from 'react'
import { ArrowUp, Paperclip, Stop } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CommandPalette, type SlashCommand } from './command-palette'

interface ComposerAgent {
	id: string
	name: string
	model: string | null
}

interface ChatComposerProps {
	value: string
	onChange: (value: string) => void
	onSend: () => void
	/** Called when user selects /new or /reset — caller should clear the session */
	onNewSession?: () => void
	onStop?: () => void
	isSending?: boolean
	isRunning?: boolean
	placeholder?: string
	disabled?: boolean
	variant?: 'home' | 'thread'
	agents?: ComposerAgent[]
	selectedAgentId?: string | null
	onAgentChange?: (id: string) => void
}

/**
 * Returns the slash filter string when the input value starts with `/` and no
 * space has been typed yet (i.e., the palette is still relevant), or null
 * when the palette should not be shown.
 *
 * Examples:
 *   "/"       → ""          (show all commands)
 *   "/bu"     → "bu"        (filtered to "build")
 *   "/build " → null        (command chosen, argument being typed)
 *   "hello"   → null
 */
function getSlashFilter(value: string): string | null {
	if (!value.startsWith('/')) return null
	const rest = value.slice(1)
	// Once the user has typed a space (i.e., started the argument), close palette
	if (rest.includes(' ')) return null
	return rest
}

export function ChatComposer({
	value,
	onChange,
	onSend,
	onNewSession,
	onStop,
	isSending = false,
	isRunning = false,
	placeholder = 'Ask the agent, /run workflow, or @mention a teammate',
	disabled = false,
	variant = 'thread',
	agents = [],
	selectedAgentId = null,
	onAgentChange,
}: ChatComposerProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const [paletteOpen, setPaletteOpen] = useState(false)

	const selectedAgent = agents.find((a) => a.id === selectedAgentId) ?? agents[0] ?? null

	// Derive palette visibility from both explicit open flag and input text
	const slashFilter = getSlashFilter(value)
	const showPalette = paletteOpen || slashFilter !== null

	const handleChange = useCallback(
		(newValue: string) => {
			onChange(newValue)
			// If the user erases the slash prefix entirely, close the palette
			if (!newValue.startsWith('/')) {
				setPaletteOpen(false)
			}
		},
		[onChange],
	)

	const handleCommandSelect = useCallback(
		(cmd: SlashCommand) => {
			setPaletteOpen(false)

			if (cmd.isAction) {
				// /new and similar: clear composer and delegate to caller
				onChange('')
				onNewSession?.()
				return
			}

			// Insert "/command " as the new composer value
			onChange(`${cmd.name} `)
			textareaRef.current?.focus()
		},
		[onChange, onNewSession],
	)

	const handlePaletteClose = useCallback(() => {
		setPaletteOpen(false)
		// If the textarea only has a stray `/`, clean it up
		if (value === '/') onChange('')
	}, [value, onChange])

	function handleKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
		// When the palette is open, navigation/confirm/dismiss keys are
		// captured by the palette's document-level listener — don't let them
		// also fire the send logic here.
		if (showPalette && ['ArrowUp', 'ArrowDown', 'Enter', 'Tab', 'Escape'].includes(e.key)) {
			e.preventDefault()
			return
		}

		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			if (canSend) onSend()
		}
	}

	const canSend = value.trim().length > 0 && !isSending && !isRunning && !disabled
	const showStop = isRunning && !!onStop

	return (
		<div
			className={cn(
				'shrink-0 px-4',
				variant === 'thread' && 'bg-background py-3',
				variant === 'home' && 'py-2',
			)}
		>
			<div
				className={cn(
					'relative mx-auto flex flex-col',
					'bg-muted/40',
					'transition-colors duration-150',
					variant === 'home' && 'max-w-2xl',
					variant === 'thread' && 'max-w-3xl',
				)}
			>
				{/* Slash command palette — renders above the composer */}
				{showPalette && (
					<CommandPalette
						filter={slashFilter ?? ''}
						onSelect={handleCommandSelect}
						onClose={handlePaletteClose}
					/>
				)}

				{/* Textarea */}
				<textarea
					ref={textareaRef}
					value={value}
					onChange={(e) => handleChange(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder={placeholder}
					disabled={disabled || isSending || isRunning}
					rows={3}
					className={cn(
						'w-full resize-none bg-transparent outline-none',
						'field-sizing-content min-h-[88px] max-h-[400px]',
						'px-4 py-3 font-sans text-sm leading-relaxed text-foreground',
						'placeholder:text-muted-foreground',
						'disabled:cursor-not-allowed disabled:opacity-50',
					)}
				/>

				{/* Toolbar */}
				<div className="flex h-9 items-center gap-1 bg-muted/30 px-2">
					{/* Left: action buttons */}
					<Button
						size="icon-xs"
						variant="ghost"
						className="text-muted-foreground"
						title="Attach file"
						disabled
					>
						<Paperclip size={14} />
					</Button>
					<Button
						size="icon-xs"
						variant="ghost"
						className={cn(
							'font-mono text-[13px]',
							showPalette ? 'bg-muted text-foreground' : 'text-muted-foreground',
						)}
						title="Slash commands"
						onClick={() => {
							if (showPalette) {
								handlePaletteClose()
							} else {
								// Seed the textarea with `/` if not already there
								if (!value.startsWith('/')) {
									onChange('/')
								}
								setPaletteOpen(true)
								textareaRef.current?.focus()
							}
						}}
					>
						/
					</Button>

					<div className="flex-1" />

					{/* Right: agent + model + send/stop */}
					{agents.length > 0 && onAgentChange && (
						<DropdownMenu>
							<DropdownMenuTrigger className="flex items-center gap-1 rounded-none px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
								agent: <span className="text-primary">@{selectedAgent?.name ?? '?'}</span>
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end" className="min-w-[160px]">
								{agents.map((agent) => (
									<DropdownMenuItem
										key={agent.id}
										onClick={() => onAgentChange(agent.id)}
										className="font-mono text-[12px]"
									>
										@{agent.name}
										{agent.model && (
											<span className="ml-auto text-muted-foreground">{agent.model}</span>
										)}
									</DropdownMenuItem>
								))}
							</DropdownMenuContent>
						</DropdownMenu>
					)}

					{selectedAgent?.model && (
						<span className="font-mono text-[11px] text-muted-foreground">
							{selectedAgent.model}
						</span>
					)}

					<div className="ml-2 flex items-center gap-1.5">
						{showStop ? (
							<Button
								size="xs"
								variant="outline"
								onClick={onStop}
								className="gap-1 text-destructive"
							>
								<Stop size={12} weight="fill" />
								Stop
							</Button>
						) : (
							<Button
								size="xs"
								variant={canSend ? 'default' : 'ghost'}
								disabled={!canSend}
								loading={isSending}
								onClick={onSend}
								className="gap-1"
							>
								<ArrowUp size={12} weight="bold" />
								Send
							</Button>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}
