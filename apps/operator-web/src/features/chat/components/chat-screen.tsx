import { useState, useEffect } from 'react'
import { ClockCounterClockwise } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { SquareBuildLogo } from '@/components/brand/square-build-logo'
import { useSetLayoutMode } from '@/features/shell/layout-mode-context'
import { useAgents } from '@/hooks/use-agents'
import type { ChatAttachment } from '@/api/types'
import { cancelRun } from '@/api/runs.api'
import { useChatScreen } from '../hooks/use-chat-screen'
import { ChatSessionList } from './chat-session-list'
import { ChatThread } from './chat-thread'
import { ChatComposer } from './chat-composer'

export function ChatScreen() {
	useSetLayoutMode('immersive')
	const {
		conversations,
		filteredConversations,
		activeConversation,
		activeId,
		view,
		searchQuery,
		setSearchQuery,
		selectConversation,
		clearConversation,
		goToHistory,
		isLoading,
		sendMutation,
		createMutation,
	} = useChatScreen()

	const [composerValue, setComposerValue] = useState('')
	const [attachments, setAttachments] = useState<ChatAttachment[]>([])
	const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null)
	// Track run from mutation response to bridge the gap before query data catches up.
	// Scoped to sessionId so it doesn't leak across conversations.
	const [pendingRun, setPendingRun] = useState<{ runId: string; sessionId: string } | null>(null)
	const agentsQuery = useAgents()

	const agents = agentsQuery.data ?? []
	const effectiveAgentId = selectedAgentId ?? agents[0]?.id ?? null
	const composerAgents = agents.map((a) => ({ id: a.id, name: a.name, model: a.model }))

	async function handleSend() {
		const text = composerValue.trim()
		if (!text && attachments.length === 0) return

		if (activeId) {
			const result = await sendMutation.mutateAsync({
				sessionId: activeId,
				message: text,
				attachments,
			})
			setComposerValue('')
			setAttachments([])
			// Only track pendingRun for new runs — queued messages attach to the existing active run
			if (result.run_id && !result.queued)
				setPendingRun({ runId: result.run_id, sessionId: activeId })
		} else {
			if (!effectiveAgentId) return
			const result = await createMutation.mutateAsync({
				agentId: effectiveAgentId,
				message: text,
				attachments,
			})
			setComposerValue('')
			setAttachments([])
			if (result.run_id) setPendingRun({ runId: result.run_id, sessionId: result.session_id })
			selectConversation(result.session_id)
		}
	}

	function handleNew() {
		clearConversation()
		setComposerValue('')
		setAttachments([])
	}

	async function handleStop() {
		if (!activeRunId) return
		await cancelRun(activeRunId, 'cancelled by user')
	}

	const isSending = sendMutation.isPending || createMutation.isPending
	const noAgentAvailable = !agentsQuery.isLoading && (agentsQuery.data ?? []).length === 0
	const queryRunId =
		activeConversation?.queries.find(
			(q) => (q.status === 'pending' || q.status === 'running') && q.run_id,
		)?.run_id ?? null
	const hasActiveQuery =
		activeConversation?.queries.some((q) => q.status === 'pending' || q.status === 'running') ??
		false

	// Only use pendingRun if it belongs to the current conversation
	const pendingRunId = pendingRun?.sessionId === activeId ? pendingRun.runId : null
	// Clear once query data reflects the run (active or terminal) — must be in useEffect, not during render
	const runAppearedInQueries =
		!!pendingRunId && activeConversation?.queries.some((q) => q.run_id === pendingRunId)
	useEffect(() => {
		if (runAppearedInQueries) setPendingRun(null)
	}, [runAppearedInQueries])

	const activeRunId = queryRunId ?? pendingRunId
	const isAgentThinking = isSending || hasActiveQuery || pendingRunId !== null

	// ── Thread view ──
	if (activeId && activeConversation) {
		return (
			<div className="flex h-full flex-col overflow-hidden">
				<ChatThread
					conversation={activeConversation}
					isLoading={isLoading}
					isAgentThinking={isAgentThinking}
					activeRunId={activeRunId}
					onBack={clearConversation}
					onHistory={goToHistory}
				/>
				<ChatComposer
					value={composerValue}
					onChange={setComposerValue}
					attachments={attachments}
					onAttachmentsChange={setAttachments}
					onSend={() => void handleSend()}
					onNewSession={handleNew}
					onStop={() => void handleStop()}
					isSending={isSending}
					isRunning={isAgentThinking && !isSending}
					disabled={noAgentAvailable}
					variant="thread"
					placeholder={noAgentAvailable ? 'No agents configured' : 'Continue the conversation...'}
					agents={composerAgents}
					selectedAgentId={effectiveAgentId}
					onAgentChange={setSelectedAgentId}
				/>
			</div>
		)
	}

	// ── History view ──
	if (view === 'history') {
		return (
			<ChatSessionList
				conversations={filteredConversations}
				searchQuery={searchQuery}
				onSearchChange={setSearchQuery}
				onSelect={selectConversation}
				onNew={handleNew}
			/>
		)
	}

	// ── Home view: composer-first ──
	const recentConversations = conversations.slice(0, 5)

	return (
		<div className="flex h-full flex-col overflow-hidden">
			{/* Main area — vertically centered composer */}
			<div className="flex flex-1 flex-col items-center justify-center px-6">
				<div className="w-full max-w-2xl">
					{/* Brand + Greeting */}
					<div className="mb-6 flex flex-col items-center gap-4 text-center">
						<div className="flex flex-col items-center gap-2">
							<SquareBuildLogo size={40} />
							<span className="text-sm font-medium text-muted-foreground/80">
								Autopilot
							</span>
						</div>
						<h1 className="text-balance text-2xl font-semibold text-foreground">
							What can I help you with?
						</h1>
					</div>

					{/* Composer */}
					<ChatComposer
						value={composerValue}
						onChange={setComposerValue}
						attachments={attachments}
						onAttachmentsChange={setAttachments}
						onSend={() => void handleSend()}
						onNewSession={handleNew}
						isSending={isSending}
						disabled={noAgentAvailable}
						variant="home"
						placeholder={
							noAgentAvailable
								? 'No agents configured'
								: 'Ask a question, start a task, or run a workflow...'
						}
						agents={composerAgents}
						selectedAgentId={effectiveAgentId}
						onAgentChange={setSelectedAgentId}
					/>

					{/* Recent conversations */}
					{recentConversations.length > 0 && (
						<div className="mt-8">
							<div className="mb-3 flex items-center justify-between">
								<p className="text-sm font-medium text-muted-foreground">
									Recent
								</p>
								<Button
									variant="ghost"
									size="xs"
									onClick={goToHistory}
									className="gap-1 text-muted-foreground"
								>
									<ClockCounterClockwise size={12} />
									<span>View all</span>
								</Button>
							</div>
							<div className="overflow-hidden rounded-lg bg-card/40">
								{recentConversations.map((conv) => (
									<button
										key={conv.session.id}
										type="button"
										onClick={() => selectConversation(conv.session.id)}
										className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-[background-color,color] hover:bg-muted/50"
									>
										<span className="truncate text-sm font-medium text-foreground">
											{conv.title || 'New conversation'}
										</span>
										<span className="shrink-0 text-xs text-muted-foreground tabular-nums">
											{conv.time}
										</span>
									</button>
								))}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
