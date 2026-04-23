import { type ConversationViewModel, composeConversations } from '@/api/conversations.api'
import { cancelRun } from '@/api/runs.api'
import type { ChatAttachment } from '@/api/types'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { useActiveView } from '@/hooks/use-active-view'
import { useAgents } from '@/hooks/use-agents'
import {
	useChatMessages,
	useChatSessions,
	useCreateChatSession,
	useSendChatMessage,
} from '@/hooks/use-chat-sessions'
import { useQueryList } from '@/hooks/use-queries'
import { useTasks } from '@/hooks/use-tasks'
import {
	ArrowLeftIcon,
	ChatCircle,
	ChatCircleIcon,
	ClockCounterClockwise,
	ClockCounterClockwiseIcon,
	Plus,
	PlusIcon,
} from '@phosphor-icons/react'
import { useSearch } from '@tanstack/react-router'
import { useEffect, useMemo, useState } from 'react'
import { useChatWorkspace } from '../chat-workspace-context'
import { ChatComposer } from './chat-composer'
import { ChatSessionList } from './chat-session-list'
import { ChatThread } from './chat-thread'

const EMPTY_SUGGESTIONS = [
	{ text: 'Give me a quick repo summary', id: 'summary', icon: ChatCircleIcon },
	{ text: 'Turn this into a task', id: 'task', icon: PlusIcon },
	{ text: 'What should I work on next?', id: 'next', icon: ClockCounterClockwiseIcon },
]

function buildContextAttachment(
	activeView: ReturnType<typeof useActiveView>,
	search: Record<string, unknown>,
): ChatAttachment | null {
	if (activeView === 'tasks' && typeof search.taskId === 'string' && search.taskId) {
		return {
			type: 'ref',
			source: 'page',
			label: `Current task ${search.taskId.slice(0, 8)}`,
			refType: 'task',
			refId: search.taskId,
			metadata: { view: 'tasks', taskId: search.taskId },
		}
	}

	if (activeView === 'files') {
		const selected = typeof search.selected === 'string' && search.selected ? search.selected : null
		const path = typeof search.path === 'string' && search.path ? search.path : null
		const runId = typeof search.runId === 'string' && search.runId ? search.runId : null

		if (selected) {
			return {
				type: 'ref',
				source: 'page',
				label: `Current file ${selected}`,
				refType: 'file',
				refId: selected,
				metadata: { view: 'files', path: selected, runId },
			}
		}

		if (path && search.view === 'file') {
			return {
				type: 'ref',
				source: 'page',
				label: `Current file ${path}`,
				refType: 'file',
				refId: path,
				metadata: { view: 'files', path, runId },
			}
		}

		if (path || runId) {
			return {
				type: 'ref',
				source: 'page',
				label: path ? `Current folder ${path}` : `Current run ${runId?.slice(0, 8)}`,
				refType: path ? 'directory' : 'run',
				refId: path ?? runId ?? undefined,
				metadata: { view: 'files', path, runId },
			}
		}
	}

	return null
}

function getAttachmentKey(attachment: ChatAttachment): string {
	return JSON.stringify([
		attachment.type,
		attachment.label,
		attachment.name,
		attachment.refType,
		attachment.refId,
		attachment.metadata ?? null,
	])
}

export function ChatRail() {
	const {
		activeSessionId,
		historyOpen,
		showHistory,
		startNewChat,
		openSession,
		draftSeed,
		clearDraftChat,
	} = useChatWorkspace()
	const activeView = useActiveView()
	const routeSearch = useSearch({ strict: false }) as Record<string, unknown>
	const [composerValue, setComposerValue] = useState('')
	const [attachments, setAttachments] = useState<ChatAttachment[]>([])
	const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
	const [searchQuery, setSearchQuery] = useState('')
	const [pendingRun, setPendingRun] = useState<{ runId: string; sessionId: string } | null>(null)
	const [dismissedContextKeys, setDismissedContextKeys] = useState<string[]>([])

	const sessionsQuery = useChatSessions()
	const queriesQuery = useQueryList()
	const tasksQuery = useTasks()
	const agentsQuery = useAgents()
	const messagesQuery = useChatMessages(activeSessionId)
	const sendMutation = useSendChatMessage()
	const createMutation = useCreateChatSession()

	const agents = agentsQuery.data ?? []
	const effectiveAgentId = selectedAgentId ?? agents[0]?.id ?? null
	const composerAgents = agents.map((a) => ({ id: a.id, name: a.name, model: a.model }))

	const conversations = useMemo(() => {
		return composeConversations(
			sessionsQuery.data ?? [],
			queriesQuery.data ?? [],
			tasksQuery.data ?? [],
		)
	}, [sessionsQuery.data, queriesQuery.data, tasksQuery.data])

	const filteredConversations = useMemo(() => {
		if (!searchQuery.trim()) return conversations
		const lower = searchQuery.toLowerCase()
		return conversations.filter(
			(c) => c.title.toLowerCase().includes(lower) || c.lastPreview.toLowerCase().includes(lower),
		)
	}, [conversations, searchQuery])

	const activeConversation = useMemo(() => {
		if (!activeSessionId) return null
		const conversation = conversations.find((c) => c.session.id === activeSessionId)
		if (!conversation) return null
		return { ...conversation, messages: messagesQuery.data ?? [] }
	}, [activeSessionId, conversations, messagesQuery.data])

	const draftConversation = useMemo<ConversationViewModel | null>(() => {
		if (activeConversation || historyOpen) return null
		if (!draftSeed && attachments.length === 0 && composerValue.trim().length === 0) return null

		const primaryAttachment = attachments[0] ?? draftSeed?.attachments?.[0]
		const now = new Date().toISOString()

		return {
			session: {
				id: 'draft-chat',
				provider_id: 'dashboard',
				external_conversation_id: 'draft-chat',
				external_thread_id: null,
				mode: 'query',
				task_id: null,
				status: 'active',
				created_at: now,
				updated_at: now,
				metadata: '{}',
				runtime_session_ref: null,
				preferred_worker_id: null,
			},
			displayType: 'query',
			title: primaryAttachment?.label ?? 'New chat',
			lastPreview: composerValue.trim() || draftSeed?.message || '',
			time: '',
			messages: [],
			artifacts: [],
			task: null,
			queries: [],
		}
	}, [activeConversation, attachments, composerValue, draftSeed, historyOpen])

	const isLoading =
		sessionsQuery.isLoading ||
		queriesQuery.isLoading ||
		tasksQuery.isLoading ||
		messagesQuery.isFetching
	const isSending = sendMutation.isPending || createMutation.isPending
	const noAgentAvailable = !agentsQuery.isLoading && agents.length === 0

	const queryRunId =
		activeConversation?.queries.find(
			(q) => (q.status === 'pending' || q.status === 'running') && q.run_id,
		)?.run_id ?? null
	const hasActiveQuery =
		activeConversation?.queries.some((q) => q.status === 'pending' || q.status === 'running') ??
		false
	const pendingRunId = pendingRun?.sessionId === activeSessionId ? pendingRun.runId : null
	const runAppearedInQueries =
		!!pendingRunId && activeConversation?.queries.some((q) => q.run_id === pendingRunId)

	useEffect(() => {
		if (runAppearedInQueries) setPendingRun(null)
	}, [runAppearedInQueries])

	useEffect(() => {
		if (!draftSeed || activeSessionId) return
		setComposerValue(draftSeed.message ?? '')
		setAttachments(draftSeed.attachments ?? [])
		setDismissedContextKeys([])
		clearDraftChat()
	}, [activeSessionId, clearDraftChat, draftSeed])

	const activeRunId = queryRunId ?? pendingRunId
	const isAgentThinking = isSending || hasActiveQuery || pendingRunId !== null
	const pageContextAttachment = useMemo(
		() => buildContextAttachment(activeView, routeSearch),
		[activeView, routeSearch],
	)
	const pageContextKey = pageContextAttachment ? getAttachmentKey(pageContextAttachment) : null
	const contextAttachments =
		pageContextAttachment && (!pageContextKey || !dismissedContextKeys.includes(pageContextKey))
			? [pageContextAttachment]
			: []
	const outgoingAttachments = [...contextAttachments, ...attachments]

	async function handleSend() {
		const text = composerValue.trim()
		if (!text && outgoingAttachments.length === 0) return

		if (activeSessionId) {
			const result = await sendMutation.mutateAsync({
				sessionId: activeSessionId,
				message: text,
				attachments: outgoingAttachments,
			})
			setComposerValue('')
			setAttachments([])
			if (result.run_id && !result.queued) {
				setPendingRun({ runId: result.run_id, sessionId: activeSessionId })
			}
			return
		}

		if (!effectiveAgentId) return
		const result = await createMutation.mutateAsync({
			agentId: effectiveAgentId,
			message: text,
			attachments: outgoingAttachments,
		})
		setComposerValue('')
		setAttachments([])
		if (result.run_id) {
			setPendingRun({ runId: result.run_id, sessionId: result.session_id })
		}
		openSession(result.session_id)
	}

	async function handleStop() {
		if (!activeRunId) return
		await cancelRun(activeRunId, 'cancelled by user')
	}

	function applySuggestion(text: string) {
		setComposerValue(text)
	}

	function handleRemoveContextAttachment(attachment: ChatAttachment) {
		setDismissedContextKeys((prev) => [...prev, getAttachmentKey(attachment)])
	}

	function handleStartNewChat() {
		startNewChat()
		setComposerValue('')
		setAttachments([])
	}

	const headerTitle = historyOpen ? 'Chats' : (activeConversation?.title ?? '')

	return (
		<div className="flex h-full min-h-0 flex-col overflow-hidden rounded-[20px] bg-card/60 shadow-xs ring-1 ring-border/40">
			<div className="flex h-12 shrink-0 items-center gap-2 px-3">
				<div className="min-w-0 flex-1 gap-2 flex items-center">
					{!!activeConversation && (
						<Button
							size="icon-xs"
							variant="ghost"
							title="Back"
							onClick={() => handleStartNewChat()}
						>
							<ArrowLeftIcon />
						</Button>
					)}
					{headerTitle ? (
						<p className="truncate text-sm font-semibold text-foreground">{headerTitle}</p>
					) : null}
				</div>
				{historyOpen ? (
					<Button size="icon-xs" variant="ghost" onClick={handleStartNewChat} title="New chat">
						<Plus size={14} weight="bold" />
					</Button>
				) : (
					<Button size="icon-xs" variant="ghost" onClick={showHistory} title="History">
						<ClockCounterClockwise size={14} />
					</Button>
				)}
			</div>
			<div className="min-h-0 flex-1 overflow-hidden">
				{historyOpen ? (
					<ChatSessionList
						conversations={filteredConversations}
						searchQuery={searchQuery}
						onSearchChange={setSearchQuery}
						onSelect={openSession}
						onNew={handleStartNewChat}
						onBack={() => handleStartNewChat()}
						title="Chats"
						newLabel="New chat"
						emptyTitle="No chats yet"
						emptyDescription="Start a new one from the composer."
						showHeader={false}
					/>
				) : activeConversation || draftConversation ? (
					<div className="flex h-full flex-col overflow-hidden">
						<ChatThread
							conversation={activeConversation ?? draftConversation!}
							isLoading={isLoading}
							isAgentThinking={!!activeConversation && isAgentThinking}
							activeRunId={activeConversation ? activeRunId : null}
							onBack={handleStartNewChat}
							onHistory={showHistory}
							showHeader={false}
						/>
						<ChatComposer
							value={composerValue}
							onChange={setComposerValue}
							attachments={attachments}
							contextAttachments={contextAttachments}
							onAttachmentsChange={setAttachments}
							onContextAttachmentRemove={handleRemoveContextAttachment}
							onSend={() => void handleSend()}
							onNewSession={handleStartNewChat}
							onStop={() => void handleStop()}
							isSending={isSending}
							isRunning={isAgentThinking && !isSending}
							disabled={noAgentAvailable}
							variant="thread"
							placeholder={
								noAgentAvailable ? 'No agents configured' : 'Continue the conversation...'
							}
							agents={composerAgents}
							selectedAgentId={effectiveAgentId}
							onAgentChange={setSelectedAgentId}
						/>
					</div>
				) : (
					<div className="flex h-full flex-col overflow-hidden">
						<div className="flex flex-1 flex-col items-center justify-center px-5">
							<div className="w-full max-w-md">
								<EmptyState
									icon={ChatCircle}
									title="Start a new chat"
									description="Use the composer below or jump into one of the common prompts."
									height="h-auto"
									className="border-none bg-transparent px-0"
								/>
								<div className="mt-5 flex items-center justify-center flex-wrap gap-2">
									{EMPTY_SUGGESTIONS.map((suggestion) => (
										<Button
											key={suggestion.id}
											type="button"
											variant="outline"
											size="sm"
											onClick={() => applySuggestion(suggestion.text)}
										>
											{suggestion.icon && <suggestion.icon size={12} />} {suggestion.text}
										</Button>
									))}
								</div>
							</div>
						</div>
						<ChatComposer
							value={composerValue}
							onChange={setComposerValue}
							attachments={attachments}
							contextAttachments={contextAttachments}
							onAttachmentsChange={setAttachments}
							onContextAttachmentRemove={handleRemoveContextAttachment}
							onSend={() => void handleSend()}
							onNewSession={handleStartNewChat}
							isSending={isSending}
							disabled={noAgentAvailable}
							variant="thread"
							placeholder={
								noAgentAvailable ? 'No agents configured' : 'Ask anything or create work...'
							}
							agents={composerAgents}
							selectedAgentId={effectiveAgentId}
							onAgentChange={setSelectedAgentId}
						/>
					</div>
				)}
			</div>
		</div>
	)
}
