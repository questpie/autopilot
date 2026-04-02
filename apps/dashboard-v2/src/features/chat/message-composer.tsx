import { useEffect, useMemo, useRef, useState } from 'react'
import { ArrowUpIcon, PaperclipIcon, SpinnerGapIcon, XIcon } from '@phosphor-icons/react'
import { GenerativeAvatar } from '@questpie/avatar'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { InputGroup, InputGroupTextarea } from '@/components/ui/input-group'
import { Select, SelectContent, SelectItem, SelectTrigger } from '@/components/ui/select'
import { agentsQuery } from '@/features/team/team.queries'
import { useUpload } from '@/hooks/use-upload'
import { cn } from '@/lib/utils'
import { formatAttachmentSize } from './chat-message-metadata'
import type { MessageAttachment } from './chat.types'

interface PendingAttachment {
	id: string
	file: File
}

export interface ComposerSendInput {
	message: string
	agentId: string
	attachments: MessageAttachment[]
}

interface MessageComposerProps {
	onSend: (input: ComposerSendInput) => Promise<void> | void
	disabled?: boolean
	placeholder?: string
	defaultAgentId?: string
	lockAgentId?: boolean
	autoFocus?: boolean
	className?: string
	sessionId?: string
	agentName?: string
}

const LAST_AGENT_STORAGE_KEY = 'dashboard-v3:last-agent-id'
const LARGE_PASTE_CHAR_THRESHOLD = 1500
const LARGE_PASTE_LINE_THRESHOLD = 24

function buildChatUploadPath(sessionId?: string): string {
	const bucket = sessionId ? `sessions/${sessionId}` : 'drafts'
	return `uploads/chat/${bucket}/${Date.now().toString(36)}-${crypto.randomUUID()}`
}

function hasFileTransfer(dataTransfer: DataTransfer): boolean {
	return dataTransfer.files.length > 0 || Array.from(dataTransfer.types).includes('Files')
}

function shouldAttachPastedText(text: string): boolean {
	const trimmed = text.trim()
	if (!trimmed) return false

	const lineCount = trimmed.split(/\r?\n/).length
	return trimmed.length >= LARGE_PASTE_CHAR_THRESHOLD || lineCount >= LARGE_PASTE_LINE_THRESHOLD
}

function createPastedTextFile(text: string): File {
	const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
	return new File([text], `pasted-note-${timestamp}.txt`, {
		type: 'text/plain',
	})
}

interface AgentLabelProps {
	seed: string
	name: string
	role?: string
	compact?: boolean
}

function AgentLabel({ seed, name, role, compact = false }: AgentLabelProps): React.JSX.Element {
	return (
		<div className="flex min-w-0 items-center gap-2">
			<GenerativeAvatar
				seed={seed}
				size={compact ? 16 : 18}
				className={cn('border border-border/70', compact ? 'size-[16px]' : 'size-[18px]')}
			/>
			<div className="min-w-0">
				<div className={cn('truncate font-heading text-foreground text-[10px] leading-none')}>
					{name}
				</div>
				{!compact && role ? (
					<div className="truncate pt-0.5 text-[9px] leading-none text-muted-foreground">
						{role}
					</div>
				) : null}
			</div>
		</div>
	)
}

export function MessageComposer({
	onSend,
	disabled = false,
	placeholder = 'Ask anything...',
	defaultAgentId,
	lockAgentId = false,
	autoFocus = false,
	className,
	sessionId,
	agentName,
}: MessageComposerProps): React.JSX.Element {
	const [message, setMessage] = useState('')
	const [selectedAgentId, setSelectedAgentId] = useState<string>(defaultAgentId ?? '')
	const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([])
	const [isDragActive, setIsDragActive] = useState(false)
	const textareaRef = useRef<HTMLTextAreaElement | null>(null)
	const fileInputRef = useRef<HTMLInputElement | null>(null)
	const dragDepthRef = useRef(0)
	const { data: agents = [], isLoading, isError } = useQuery(agentsQuery)
	const { upload, fileProgress, isUploading, reset } = useUpload()

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
		element.style.height = `${Math.min(element.scrollHeight, 260)}px`
	}, [message])

	const selectedAgent = useMemo(
		() => agents.find((agent) => agent.id === (lockAgentId ? defaultAgentId : selectedAgentId)),
		[agents, defaultAgentId, lockAgentId, selectedAgentId],
	)

	const activeAgentId = lockAgentId ? (defaultAgentId ?? selectedAgentId) : selectedAgentId
	const hasDraft = message.trim().length > 0 || pendingAttachments.length > 0
	const canSend = !disabled && !isUploading && hasDraft && !!activeAgentId

	const resolvedPlaceholder =
		disabled && !isUploading
			? 'Wait for the current response to finish...'
			: isLoading
				? 'Loading agents...'
				: isError
					? 'Unable to load agents.'
					: agents.length === 0
						? 'No agents configured.'
						: placeholder

	const appendFiles = (fileList: FileList | File[]) => {
		const files = Array.from(fileList)
		if (files.length === 0) {
			return
		}

		reset()
		setPendingAttachments((current) => [
			...current,
			...files.map((file) => ({
				id: crypto.randomUUID(),
				file,
			})),
		])
	}

	const removeAttachment = (attachmentId: string) => {
		setPendingAttachments((current) =>
			current.filter((attachment) => attachment.id !== attachmentId),
		)
	}

	const handleDragState = (active: boolean) => {
		if (disabled || isUploading) return
		setIsDragActive(active)
	}

	const submit = async () => {
		if (!canSend) return

		const trimmedMessage = message.trim()
		const agentId = lockAgentId ? (defaultAgentId ?? selectedAgentId) : selectedAgentId
		if (!agentId) return

		try {
			let attachments: MessageAttachment[] = []

			if (pendingAttachments.length > 0) {
				const uploadResults = await upload(
					pendingAttachments.map((attachment) => attachment.file),
					buildChatUploadPath(sessionId),
				)

				if (uploadResults.length !== pendingAttachments.length) {
					throw new Error('Some attachments failed to upload')
				}

				attachments = uploadResults.map((result, index) => {
					const pending = pendingAttachments[index]!
					return {
						id: `attachment-${crypto.randomUUID()}`,
						filename: result.fileName,
						size: pending.file.size,
						mime_type: pending.file.type || 'application/octet-stream',
						url: result.path.replace(/^\/+/, ''),
					}
				})
			}

			await onSend({
				message: trimmedMessage,
				agentId,
				attachments,
			})
			setMessage('')
			setPendingAttachments([])
			reset()
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to send message')
			return
		}

		if (!lockAgentId && typeof window !== 'undefined') {
			window.localStorage.setItem(LAST_AGENT_STORAGE_KEY, agentId)
		}
	}

	return (
		<div className={cn('border-t border-border/80 bg-background/95 px-4 py-2', className)}>
			<InputGroup
				className={cn(
					'mx-auto h-auto w-full max-w-4xl flex-col items-stretch border-input bg-card/90 transition-colors',
					isDragActive && 'border-primary/60 bg-primary/5',
				)}
				onDragOver={(event) => {
					if (disabled || isUploading || !hasFileTransfer(event.dataTransfer)) return
					event.preventDefault()
					event.dataTransfer.dropEffect = 'copy'
					handleDragState(true)
				}}
				onDragEnter={(event) => {
					if (disabled || isUploading || !hasFileTransfer(event.dataTransfer)) return
					event.preventDefault()
					dragDepthRef.current += 1
					handleDragState(true)
				}}
				onDragLeave={(event) => {
					if (disabled || isUploading || !hasFileTransfer(event.dataTransfer)) {
						return
					}
					event.preventDefault()
					dragDepthRef.current = Math.max(0, dragDepthRef.current - 1)
					if (dragDepthRef.current === 0) {
						handleDragState(false)
					}
				}}
				onDrop={(event) => {
					if (disabled || isUploading) return
					event.preventDefault()
					dragDepthRef.current = 0
					handleDragState(false)
					if (event.dataTransfer.files.length > 0) {
						appendFiles(event.dataTransfer.files)
					}
				}}
			>
				{pendingAttachments.length > 0 ? (
					<div className="flex flex-wrap gap-1.5 px-2.5 pt-1.5">
						{pendingAttachments.map((attachment, index) => {
							const progress = fileProgress[index]
							const status =
								progress?.status === 'uploading'
									? 'Uploading...'
									: progress?.status === 'extracting'
										? 'Extracting...'
										: progress?.status === 'error'
											? (progress.error ?? 'Upload failed')
											: null

							return (
								<div
									key={attachment.id}
									className="inline-flex max-w-full items-center gap-2 border border-border/70 bg-background px-2 py-1"
								>
									<PaperclipIcon className="size-3.5 shrink-0 text-muted-foreground" />
									<div className="min-w-0">
										<div
											className="truncate text-[11px] text-foreground"
											title={attachment.file.name}
										>
											{attachment.file.name}
										</div>
										<div className="truncate text-[11px] text-muted-foreground">
											{formatAttachmentSize(attachment.file.size)}
											{status ? ` · ${status}` : ''}
										</div>
									</div>
									<Button
										type="button"
										variant="ghost"
										size="icon-xs"
										className="shrink-0"
										onClick={() => removeAttachment(attachment.id)}
										disabled={disabled || isUploading}
										aria-label={`Remove ${attachment.file.name}`}
									>
										<XIcon className="size-3.5" />
									</Button>
								</div>
							)
						})}
					</div>
				) : null}

				<div className="relative">
					<InputGroupTextarea
						ref={textareaRef}
						value={message}
						onChange={(event) => setMessage(event.target.value)}
						placeholder={resolvedPlaceholder}
						autoFocus={autoFocus}
						aria-label="Message"
						disabled={disabled || (!lockAgentId && agents.length === 0)}
						className="min-h-[64px] max-h-[200px] border-0 bg-transparent px-2.5 pt-2 pb-1 font-sans text-sm leading-6 shadow-none focus-visible:ring-0"
						onPaste={(event) => {
							const files = Array.from(event.clipboardData.files)
							if (files.length > 0) {
								event.preventDefault()
								appendFiles(files)
								return
							}

							const pastedText = event.clipboardData.getData('text/plain')
							if (shouldAttachPastedText(pastedText)) {
								event.preventDefault()
								appendFiles([createPastedTextFile(pastedText)])
								toast.success('Large paste attached as a text file')
							}
						}}
						onKeyDown={(event) => {
							if (event.key === 'Escape') {
								textareaRef.current?.blur()
							}

							if (event.key === 'Enter' && !event.shiftKey) {
								event.preventDefault()
								void submit()
							}
						}}
					/>

					{isDragActive ? (
						<div className="pointer-events-none absolute inset-1.5 flex items-end justify-end border border-dashed border-primary/50 bg-primary/5 px-2 py-1 text-[10px] font-heading uppercase tracking-wide text-primary">
							Drop files to attach
						</div>
					) : null}
				</div>

				<div className="flex flex-col gap-1 px-2.5 pb-1.5 pt-0.5 sm:flex-row sm:items-center sm:justify-between">
					<div className="flex min-w-0 flex-wrap items-center gap-1.5">
						<Button
							type="button"
							variant="ghost"
							size="icon-xs"
							className="shrink-0 text-muted-foreground hover:text-foreground"
							onClick={() => fileInputRef.current?.click()}
							disabled={disabled || isUploading}
							aria-label="Attach files"
						>
							<PaperclipIcon className="size-3.5" />
						</Button>

						{lockAgentId ? (
							<div className="inline-flex h-7 min-w-auto max-w-55 items-center bg-transparent px-2">
								<AgentLabel
									seed={activeAgentId || sessionId || 'agent'}
									name={agentName ?? selectedAgent?.name ?? 'Selected agent'}
									role={selectedAgent?.role}
									compact
								/>
							</div>
						) : agents.length > 1 ? (
							<Select
								value={selectedAgentId}
								onValueChange={(value) => setSelectedAgentId(value ?? '')}
								disabled={disabled || isUploading}
							>
								<SelectTrigger
									size="sm"
									className="min-w-auto max-w-55 text-left border-none bg-transparent px-2"
								>
									{selectedAgent ? (
										<AgentLabel
											seed={selectedAgent.id}
											name={selectedAgent.name}
											role={selectedAgent.role}
											compact
										/>
									) : (
										<span className="truncate text-[10px] text-muted-foreground">Select agent</span>
									)}
								</SelectTrigger>
								<SelectContent className="min-w-[220px]">
									{agents.map((agent) => (
										<SelectItem key={agent.id} value={agent.id} className="py-1.5">
											<AgentLabel seed={agent.id} name={agent.name} role={agent.role} />
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						) : selectedAgent ? (
							<div className="inline-flex h-7 max-w-[220px] items-center border border-input bg-secondary px-2">
								<AgentLabel
									seed={selectedAgent.id}
									name={selectedAgent.name}
									role={selectedAgent.role}
								/>
							</div>
						) : null}

						{!lockAgentId && agents.length === 0 && !isLoading ? (
							<div className="text-[11px] text-destructive">
								No agents configured. Add one in `team/agents/`.
							</div>
						) : null}
					</div>

					<Button
						type="button"
						size="icon-sm"
						className="shrink-0"
						onClick={() => void submit()}
						disabled={!canSend}
						aria-label={isUploading ? 'Uploading attachments' : 'Send message'}
					>
						{isUploading ? (
							<SpinnerGapIcon className="size-4 animate-spin" />
						) : (
							<ArrowUpIcon className="size-4" />
						)}
					</Button>
				</div>
			</InputGroup>

			<input
				ref={fileInputRef}
				type="file"
				className="hidden"
				multiple
				onChange={(event) => {
					if (event.target.files) {
						appendFiles(event.target.files)
					}
					event.target.value = ''
				}}
			/>
		</div>
	)
}
