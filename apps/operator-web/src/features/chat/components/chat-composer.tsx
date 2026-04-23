import { useRef, useState, useCallback, type ChangeEvent, type ClipboardEvent, type DragEvent, type KeyboardEvent } from 'react'
import { ArrowUp, File, FileText, Paperclip, Stop, X } from '@phosphor-icons/react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { MetaChipButton } from '@/components/ui/meta-chip'
import type { ChatAttachment } from '@/api/types'
import { readDraggedChatAttachment } from '../lib/chat-dnd'
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
	attachments?: ChatAttachment[]
	contextAttachments?: ChatAttachment[]
	onAttachmentsChange?: (attachments: ChatAttachment[]) => void
	onContextAttachmentRemove?: (attachment: ChatAttachment) => void
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
	attachments = [],
	contextAttachments = [],
	onAttachmentsChange,
	onContextAttachmentRemove,
	onAgentChange,
}: ChatComposerProps) {
	const textareaRef = useRef<HTMLTextAreaElement>(null)
	const fileInputRef = useRef<HTMLInputElement>(null)
	const [paletteOpen, setPaletteOpen] = useState(false)
	const [isAttaching, setIsAttaching] = useState(false)
	const [isDragActive, setIsDragActive] = useState(false)

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

	const totalAttachmentCount = attachments.length + contextAttachments.length
	const canSend =
		(value.trim().length > 0 || totalAttachmentCount > 0) &&
		!isSending &&
		!isRunning &&
		!disabled &&
		!isAttaching
	const showStop = isRunning && !!onStop

	const removeAttachment = useCallback(
		(index: number) => {
			onAttachmentsChange?.(attachments.filter((_, i) => i !== index))
		},
		[attachments, onAttachmentsChange],
	)

	const appendAttachments = useCallback(
		(nextAttachments: ChatAttachment[]) => {
			if (nextAttachments.length === 0 || !onAttachmentsChange) return
			onAttachmentsChange([...attachments, ...nextAttachments])
		},
		[attachments, onAttachmentsChange],
	)

	const openFilePicker = useCallback(() => {
		if (disabled || isSending || isRunning || isAttaching) return
		fileInputRef.current?.click()
	}, [disabled, isSending, isRunning, isAttaching])

	async function toAttachment(file: File): Promise<ChatAttachment> {
		const isTextLike =
			file.type.startsWith('text/') ||
			/\.(md|txt|json|js|jsx|ts|tsx|css|html|py|rs|go|sh|sql|yaml|yml|csv)$/i.test(file.name)
		if (!isTextLike || file.size > 200_000) {
			return {
				type: 'file',
				name: file.name,
				mimeType: file.type || 'application/octet-stream',
				size: file.size,
				source: 'upload',
			}
		}

		const content = await file.text()
		return {
			type: 'text',
			name: file.name,
			mimeType: file.type || 'text/plain',
			size: file.size,
			content,
			source: 'upload',
		}
	}

	const handleFileChange = useCallback(
		async (e: ChangeEvent<HTMLInputElement>) => {
			const files = Array.from(e.target.files ?? [])
			e.target.value = ''
			if (files.length === 0 || !onAttachmentsChange) return

			setIsAttaching(true)
			try {
				const next = await Promise.all(files.map((file) => toAttachment(file)))
				appendAttachments(next)
			} catch (error) {
				toast.error(error instanceof Error ? error.message : 'Failed to attach file')
			} finally {
				setIsAttaching(false)
			}
		},
		[appendAttachments, onAttachmentsChange],
	)

	const handlePaste = useCallback(
		(e: ClipboardEvent<HTMLTextAreaElement>) => {
			const text = e.clipboardData.getData('text/plain')
			if (!text || !onAttachmentsChange) return

			const lineCount = text.split(/\r?\n/).length
			const shouldConvertToAttachment = lineCount >= 12 || text.length >= 1500
			if (!shouldConvertToAttachment) return

			e.preventDefault()
			appendAttachments([
				{
					type: 'text',
					name: 'pasted-text.txt',
					mimeType: 'text/plain',
					content: text,
					size: text.length,
					source: 'paste',
				},
			])
			toast.success('Long paste added as attachment')
		},
		[appendAttachments, onAttachmentsChange],
	)

	const attachDroppedFiles = useCallback(
		async (files: File[]) => {
			if (files.length === 0 || !onAttachmentsChange) return

			setIsAttaching(true)
			try {
				const next = await Promise.all(files.map((file) => toAttachment(file)))
				appendAttachments(next)
			} catch (error) {
				toast.error(error instanceof Error ? error.message : 'Failed to attach dropped file')
			} finally {
				setIsAttaching(false)
			}
		},
		[appendAttachments, onAttachmentsChange],
	)

	const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
		e.preventDefault()
		e.dataTransfer.dropEffect = 'copy'
		setIsDragActive(true)
	}, [])

	const handleDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
		if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
		setIsDragActive(false)
	}, [])

	const handleDrop = useCallback(async (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault()
		setIsDragActive(false)

		const draggedAttachment = readDraggedChatAttachment(e.dataTransfer)
		if (draggedAttachment) {
			appendAttachments([{ ...draggedAttachment, source: draggedAttachment.source ?? 'drag' }])
			return
		}

		const files = Array.from(e.dataTransfer.files ?? [])
		if (files.length > 0) {
			await attachDroppedFiles(files)
		}
	}, [appendAttachments, attachDroppedFiles])

	function renderAttachmentChip(
		attachment: ChatAttachment,
		index: number,
		kind: 'attachment' | 'context',
	) {
		const Icon = attachment.type === 'text' ? FileText : File
		const label =
			attachment.name ??
			attachment.label ??
			attachment.url ??
			attachment.refId ??
			`attachment-${index + 1}`
		return (
			<MetaChipButton
				key={`${kind}-${label}-${index}`}
				onClick={() => {
					if (kind === 'context') {
						onContextAttachmentRemove?.(attachment)
						return
					}
					removeAttachment(index)
				}}
				icon={<Icon size={12} />}
				className="max-w-full"
				title="Remove attachment"
				tone={kind === 'context' ? 'primary' : 'neutral'}
			>
				<span className="truncate max-w-[220px]">{label}</span>
				<X size={12} />
			</MetaChipButton>
		)
	}

	return (
		<div className={cn('shrink-0 px-4 py-3')}>
			<div
				className={cn(
					'relative mx-auto flex flex-col',
					variant === 'home' && 'max-w-2xl',
					variant === 'thread' && 'max-w-3xl',
				)}
				onDragOver={handleDragOver}
				onDragLeave={handleDragLeave}
				onDrop={(e) => void handleDrop(e)}
			>
				<input
					ref={fileInputRef}
					type="file"
					multiple
					onChange={(e) => void handleFileChange(e)}
					className="hidden"
					tabIndex={-1}
				/>

				{/* Slash command palette — renders above the composer */}
				{showPalette && (
					<CommandPalette
						filter={slashFilter ?? ''}
						onSelect={handleCommandSelect}
						onClose={handlePaletteClose}
					/>
				)}

				<div
					className={cn(
						'overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm',
						'transition-[background-color,border-color,box-shadow] duration-150',
						'focus-within:border-primary-border focus-within:shadow-md',
						isDragActive && 'border-primary bg-primary/5 shadow-md',
					)}
				>
					{isDragActive && (
						<div className="border-b border-border/60 bg-primary/8 px-4 py-2 text-xs text-primary">
							Drop files, tasks, or file refs here
						</div>
					)}
					{attachments.length > 0 && (
						<div className="flex flex-wrap gap-2 border-b border-border/60 px-4 py-3">
							{contextAttachments.map((attachment, index) =>
								renderAttachmentChip(attachment, index, 'context'))}
							{attachments.map((attachment, index) =>
								renderAttachmentChip(attachment, index, 'attachment'))}
						</div>
					)}
					{attachments.length === 0 && contextAttachments.length > 0 && (
						<div className="flex flex-wrap gap-2 border-b border-border/60 px-4 py-3">
							{contextAttachments.map((attachment, index) =>
								renderAttachmentChip(attachment, index, 'context'))}
						</div>
					)}

					{/* Textarea */}
					<textarea
						ref={textareaRef}
						value={value}
						onChange={(e) => handleChange(e.target.value)}
						onPaste={handlePaste}
						onKeyDown={handleKeyDown}
						placeholder={placeholder}
						disabled={disabled || isSending || isRunning}
						rows={3}
						className={cn(
							'w-full resize-none bg-transparent outline-none',
							'field-sizing-content min-h-[88px] max-h-[400px]',
							'px-4 py-4 font-sans text-[15px] leading-relaxed text-foreground',
							'placeholder:text-muted-foreground',
							'disabled:cursor-not-allowed disabled:opacity-50',
						)}
					/>

					{/* Toolbar */}
					<div className="flex min-h-11 items-center gap-1 border-t border-border/60 bg-muted/20 px-2 py-1.5">
						{/* Left: action buttons */}
						<Button
							size="icon-xs"
							variant="ghost"
							className="text-muted-foreground"
							title="Attach file"
							onClick={openFilePicker}
							disabled={disabled || isSending || isRunning || isAttaching}
						>
							<Paperclip size={14} />
						</Button>
						<Button
							size="icon-xs"
							variant="ghost"
							className={cn(
								'text-sm font-medium',
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
								<DropdownMenuTrigger className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-[background-color,color] hover:bg-accent hover:text-foreground">
									<span>Agent</span>
									<span className="text-primary">@{selectedAgent?.name ?? '?'}</span>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="min-w-[160px]">
									{agents.map((agent) => (
										<DropdownMenuItem
											key={agent.id}
											onClick={() => onAgentChange(agent.id)}
											className="text-sm"
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
							<span className="text-xs text-muted-foreground tabular-nums">
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
									loading={isSending || isAttaching}
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
		</div>
	)
}
