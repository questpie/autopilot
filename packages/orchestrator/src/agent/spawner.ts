import type { Agent, Task } from '@questpie/autopilot-spec'
import { createAIProviderForCompany } from '../ai'
import { companyRootFactory, container } from '../container'
import { assembleContext } from '../context/assembler'
import { dbFactory } from '../db'
import { env } from '../env'
import { eventBus } from '../events'
import type { StorageBackend } from '../fs/storage'
import { logger } from '../logger'
import { streamManagerFactory } from '../session/stream'
import type { AIProvider } from '../ai/provider'
import { extractMemory } from './memory-extractor'
import type { AgentChatMessage, AgentEvent } from './provider'
import { createAutopilotTools } from './tools'
import type { ToolContext } from './tools'
import { createFileTools } from './tools/file-tools'

const DEFAULT_MODEL = 'anthropic/claude-sonnet-4'
const SESSION_PROMPT_RAW_TAIL_MESSAGES = 12
const SESSION_SUMMARY_TRIGGER_MESSAGES = SESSION_PROMPT_RAW_TAIL_MESSAGES
const SESSION_SUMMARY_RETAIN_RAW_MESSAGES = 8
const SESSION_SUMMARY_MAX_CHARS = 1600

/** D10: Session mode — chat (streaming to user) vs autonomous (background). */
export type SpawnMode = 'autonomous' | 'chat'

/** Options required to spawn an agent session. */
export interface SpawnOptions {
	agent: Agent
	company: { name: string; slug: string; [key: string]: unknown }
	allAgents: Agent[]
	task?: Task
	sessionId?: string
	storage: StorageBackend
	trigger: { type: string; task_id?: string; schedule_id?: string }
	/** Optional human message to use as the prompt (e.g. from `autopilot chat`). */
	message?: string
	/** Human who initiated the session, used for chat-session history. */
	initiatedBy?: string
	/** D10: Session mode — 'chat' streams to user, 'autonomous' runs in background. Default: 'autonomous'. */
	mode?: SpawnMode
	/** DM channel ID for chat mode (used to save final message). */
	channelId?: string
}

/** Outcome of a completed agent session. */
export interface SpawnResult {
	sessionId: string
	result?: string
	toolCalls: number
	error?: string
}

interface SessionPromptState {
	summary: string | null
	lastSummarizedMessageId: string | null
}

interface SessionTranscriptMessage {
	id: string
	from: string
	content: string
	at: string
}

interface ConversationPromptContext {
	summary: string | null
	tailMessages: AgentChatMessage[]
}

/**
 * Spawn a single agent session end-to-end.
 *
 * Steps:
 * 1. Resolve the AIProvider from DI container.
 * 2. Assemble a multi-layer system prompt via {@link assembleContext}.
 * 3. Create the autopilot tool-set.
 * 4. Open a session stream for real-time `attach` subscriptions.
 * 5. Log session start/end to the activity feed.
 * 6. Delegate to the provider's `spawn()` for the actual LLM loop.
 */
/** D40: Read plan limits from env. Returns null if no limit set. */
function getPlanLimits(): { maxAgents?: number; maxTokensDay?: number } {
	const maxAgents = env.PLAN_MAX_AGENTS
	const maxTokensDay = env.PLAN_MAX_TOKENS_DAY
	return { maxAgents, maxTokensDay }
}

async function getRawClient(): Promise<import('@libsql/client').Client> {
	const { db: dbResult } = await container.resolveAsync([dbFactory])
	return (dbResult.db as unknown as { $client: import('@libsql/client').Client }).$client
}

async function readSessionPromptState(sessionId: string): Promise<SessionPromptState> {
	try {
		const raw = await getRawClient()
		const result = await raw.execute({
			sql: `
				SELECT summary, last_summarized_message_id
				FROM agent_sessions
				WHERE id = ?
				LIMIT 1
			`,
			args: [sessionId],
		})
		const row = result.rows[0]
		return {
			summary: row?.summary ? String(row.summary) : null,
			lastSummarizedMessageId: row?.last_summarized_message_id
				? String(row.last_summarized_message_id)
				: null,
		}
	} catch (err) {
		logger.warn(
			'agent',
			`failed to read prompt state for ${sessionId}: ${err instanceof Error ? err.message : String(err)}`,
		)
		return { summary: null, lastSummarizedMessageId: null }
	}
}

async function readSessionTranscript(sessionId: string): Promise<SessionTranscriptMessage[]> {
	const raw = await getRawClient()
	const result = await raw.execute({
		sql: `
			SELECT id, from_id, content, created_at
			FROM messages
			WHERE session_id = ?
			ORDER BY created_at ASC
		`,
		args: [sessionId],
	})

	return result.rows.map((row) => ({
		id: String(row.id),
		from: String(row.from_id),
		content: String(row.content),
		at: String(row.created_at),
	}))
}

function getUnsummarizedTranscript(
	transcript: SessionTranscriptMessage[],
	lastSummarizedMessageId: string | null,
): SessionTranscriptMessage[] {
	if (!lastSummarizedMessageId) {
		return transcript
	}

	const boundaryIndex = transcript.findIndex((message) => message.id === lastSummarizedMessageId)
	if (boundaryIndex === -1) {
		return transcript
	}

	return transcript.slice(boundaryIndex + 1)
}

function replaceLatestUserMessage(
	messages: AgentChatMessage[],
	currentInput?: string,
): AgentChatMessage[] {
	if (!currentInput) {
		return messages
	}

	const nextMessages = [...messages]
	for (let index = nextMessages.length - 1; index >= 0; index -= 1) {
		if (nextMessages[index]?.role === 'user') {
			nextMessages[index] = {
				role: 'user',
				content: currentInput,
			}
			return nextMessages
		}
	}

	nextMessages.push({ role: 'user', content: currentInput })
	return nextMessages
}

function formatTranscriptChunk(
	messages: SessionTranscriptMessage[],
	agentId: string,
): string {
	return messages
		.map((message) => {
			const role = message.from === agentId ? 'Assistant' : 'User'
			return `[${message.at}] ${role}: ${message.content}`
		})
		.join('\n\n')
}

async function buildConversationPromptContext(
	sessionId: string,
	agentId: string,
	currentInput?: string,
): Promise<ConversationPromptContext | null> {
	const promptState = await readSessionPromptState(sessionId)
	const transcript = await readSessionTranscript(sessionId)

	if (transcript.length === 0) {
		return currentInput
			? {
					summary: promptState.summary,
					tailMessages: [{ role: 'user', content: currentInput }],
				}
			: null
	}

	const unsummarizedTranscript = getUnsummarizedTranscript(
		transcript,
		promptState.lastSummarizedMessageId,
	)
	const omittedUnsummarizedCount = Math.max(
		0,
		unsummarizedTranscript.length - SESSION_PROMPT_RAW_TAIL_MESSAGES,
	)

	if (!promptState.summary && omittedUnsummarizedCount > 0) {
		logger.warn(
			'agent',
			`session ${sessionId} prompt tail truncated without summary; omitted ${omittedUnsummarizedCount} older messages`,
		)
	}

	const tailMessages = replaceLatestUserMessage(
		unsummarizedTranscript
			.slice(-SESSION_PROMPT_RAW_TAIL_MESSAGES)
			.map<AgentChatMessage>((message) => ({
				role: message.from === agentId ? 'assistant' : 'user',
				content: message.content,
			})),
		currentInput,
	)

	return {
		summary: promptState.summary,
		tailMessages,
	}
}

async function updateSessionRecord(
	sessionId: string,
	updates: { status: string; endedAt?: string; toolCallsDelta?: number; error?: string | null },
): Promise<void> {
	try {
		const raw = await getRawClient()
		await raw.execute({
			sql: `
				UPDATE agent_sessions
				SET status = ?,
					ended_at = ?,
					tool_calls = COALESCE(tool_calls, 0) + ?,
					error = ?
				WHERE id = ?
			`,
			args: [
				updates.status,
				updates.endedAt ?? null,
				updates.toolCallsDelta ?? 0,
				updates.error ?? null,
				sessionId,
			],
		})
	} catch (err) {
		logger.warn('agent', `failed to update session ${sessionId}: ${err instanceof Error ? err.message : String(err)}`)
	}
}

async function persistSessionSummary(
	sessionId: string,
	summary: string,
	lastSummarizedMessageId: string,
): Promise<void> {
	const raw = await getRawClient()
	await raw.execute({
		sql: `
			UPDATE agent_sessions
			SET summary = ?,
				summary_updated_at = ?,
				last_summarized_message_id = ?
			WHERE id = ?
		`,
		args: [summary, new Date().toISOString(), lastSummarizedMessageId, sessionId],
	})
}

async function maybeRefreshSessionSummary(
	sessionId: string,
	agentId: string,
	aiProvider: AIProvider,
): Promise<void> {
	try {
		const promptState = await readSessionPromptState(sessionId)
		const transcript = await readSessionTranscript(sessionId)
		const unsummarizedTranscript = getUnsummarizedTranscript(
			transcript,
			promptState.lastSummarizedMessageId,
		)

		if (unsummarizedTranscript.length < SESSION_SUMMARY_TRIGGER_MESSAGES) {
			return
		}

		const messagesToSummarize = unsummarizedTranscript.slice(
			0,
			Math.max(0, unsummarizedTranscript.length - SESSION_SUMMARY_RETAIN_RAW_MESSAGES),
		)

		if (messagesToSummarize.length === 0) {
			return
		}

		const updatedSummary = await aiProvider.complete({
			systemPrompt: `You maintain a rolling summary for a multi-turn AI chat session.

Your job:
- merge the existing summary with the new conversation chunk
- preserve important facts, decisions, constraints, file changes, tool outcomes, and unresolved follow-ups
- keep the result concise, chronological, and implementation-focused
- output plain text only
- keep the summary under ${SESSION_SUMMARY_MAX_CHARS} characters`,
			prompt: `Existing summary:
${promptState.summary ?? '(none)'}

New conversation chunk to summarize:
${formatTranscriptChunk(messagesToSummarize, agentId)}

Return the updated rolling summary.`,
			maxTokens: 800,
		})

		if (!updatedSummary?.trim()) {
			logger.warn('agent', `session summarization returned empty output for ${sessionId}`)
			return
		}

		await persistSessionSummary(
			sessionId,
			updatedSummary.trim().slice(0, SESSION_SUMMARY_MAX_CHARS),
			messagesToSummarize[messagesToSummarize.length - 1]!.id,
		)
	} catch (err) {
		logger.warn(
			'agent',
			`session summarization failed for ${sessionId}: ${err instanceof Error ? err.message : String(err)}`,
		)
	}
}

export async function spawnAgent(options: SpawnOptions): Promise<SpawnResult> {
	const {
		agent,
		company,
		allAgents,
		task,
		sessionId: providedSessionId,
		storage,
		trigger,
		message,
		initiatedBy,
		mode = 'autonomous',
		channelId,
	} = options
	const { companyRoot } = container.resolve([companyRootFactory])
	const { streamManager } = container.resolve([streamManagerFactory])
	const sessionId = providedSessionId ?? `session-${Date.now().toString(36)}-${agent.id}`
	const hasPrecreatedSession = !!providedSessionId

	// D40: Enforce plan limits
	const limits = getPlanLimits()
	if (limits.maxAgents) {
		const active = streamManager.getActiveStreams().length
		if (active >= limits.maxAgents) {
			const error = `Plan limit: max ${limits.maxAgents} concurrent agents`
			if (hasPrecreatedSession) {
				streamManager.emit(sessionId, { at: Date.now(), type: 'error', content: error, errorCode: 'budget' })
				streamManager.endStream(sessionId)
				await updateSessionRecord(sessionId, {
					status: 'failed',
					endedAt: new Date().toISOString(),
					toolCallsDelta: 0,
					error,
				})
			}
			return {
				sessionId,
				toolCalls: 0,
				error,
			}
		}
	}
	if (limits.maxTokensDay) {
		try {
			const { db } = await container.resolveAsync([dbFactory])
			const raw = (db.db as unknown as { $client: import('@libsql/client').Client }).$client
			const result = await raw.execute(`
				SELECT COALESCE(SUM(tokens_used), 0) as tokens
				FROM agent_sessions WHERE started_at > datetime('now', '-24 hours')
			`)
			const used = Number(result.rows[0]?.tokens ?? 0)
			if (used >= limits.maxTokensDay) {
				const error = `Plan limit: daily token limit (${limits.maxTokensDay}) reached`
				if (hasPrecreatedSession) {
					streamManager.emit(sessionId, { at: Date.now(), type: 'error', content: error, errorCode: 'budget' })
					streamManager.endStream(sessionId)
					await updateSessionRecord(sessionId, {
						status: 'failed',
						endedAt: new Date().toISOString(),
						toolCallsDelta: 0,
						error,
					})
				}
				return {
					sessionId,
					toolCalls: 0,
					error,
				}
			}
		} catch {
			// Can't check — proceed anyway
		}
	}

	// H1: Persist session to agentSessions table for dedup
	if (!hasPrecreatedSession) {
		try {
			const { db: dbResult } = await container.resolveAsync([dbFactory])
			const raw = (dbResult.db as unknown as { $client: import('@libsql/client').Client }).$client
			await raw.execute({
				sql: `INSERT INTO agent_sessions (
					id, agent_id, task_id, initiated_by, channel_id, first_message,
					trigger_type, status, started_at, tool_calls, tokens_used
				) VALUES (?, ?, ?, ?, ?, ?, ?, 'running', ?, 0, 0)`,
				args: [
					sessionId,
					agent.id,
					task?.id ?? null,
					initiatedBy ?? null,
					channelId ?? null,
					message ?? null,
					trigger.type,
					new Date().toISOString(),
				],
			})
		} catch (err) {
			logger.warn('agent', `failed to record session start: ${err instanceof Error ? err.message : String(err)}`)
		}
	}

	// 1. Resolve a fresh AI provider from the current company config.
	// Chat/setup can update provider secrets at runtime, and the container caches
	// instances by key, so session spawns should not depend on a stale singleton.
	const aiProvider = await createAIProviderForCompany(
		companyRoot,
		(company.settings as Record<string, unknown> | undefined) ?? undefined,
	)

	// 2. Assemble context (4-layer system prompt)
	const context = await assembleContext({
		companyRoot,
		agent,
		company: company as Parameters<typeof assembleContext>[0]['company'],
		allAgents,
		storage,
		task,
	})

	// 3. Create custom tools + file tools
	let autopilotTools = createAutopilotTools(companyRoot, storage, aiProvider)
	// D10: In chat mode, exclude message() tool — agent streams text directly to user
	if (mode === 'chat') {
		autopilotTools = autopilotTools.filter((t) => t.name !== 'message')
	}
	const fileTools = createFileTools({
		companyRoot,
		agentId: agent.id,
		scope: agent.fs_scope
			? { fsRead: agent.fs_scope.read, fsWrite: agent.fs_scope.write }
			: undefined,
	})
	const allTools = [...autopilotTools, ...fileTools]
	const toolContext: ToolContext = { companyRoot, agentId: agent.id, storage, eventBus }

	// 4. Build prompt
	const prompt = message
		? message
		: task
			? `Work on task: ${task.title}\n\nDescription: ${task.description || 'No description'}\nPriority: ${task.priority}\nStatus: ${task.status}\n\nDo your work using the available tools. When done, update the task status.`
			: `You have been triggered by: ${trigger.type}. Check your current tasks and act accordingly.`
	const conversationPromptContext =
		mode === 'chat'
			? await buildConversationPromptContext(sessionId, agent.id, message)
			: null

	// D10: In chat mode, add instruction to respond directly via text (not message tool)
	const systemPrompt =
		mode === 'chat'
			? `${context.systemPrompt}${
					conversationPromptContext?.summary
						? `\n\nConversation summary of earlier turns:\n${conversationPromptContext.summary}`
						: ''
				}\n\nYou are in direct chat mode. Respond directly to the user through text. Do not use the message() tool — your text output is streamed directly to the user.`
			: context.systemPrompt

	// 5. Create session stream for attach
	if (!hasPrecreatedSession) {
		streamManager.createStream(sessionId, agent.id)
	}

	// 6. Log session start
	await storage.appendActivity({
		at: new Date().toISOString(),
		agent: agent.id,
		type: 'session_start',
		summary: `Session started: ${task?.title ?? trigger.type} [${aiProvider.name}/${agent.model}] (${mode})`,
		details: {
			sessionId,
			trigger,
			taskId: task?.id,
			provider: aiProvider.name,
			model: agent.model,
			mode,
			channelId,
		},
	})
	eventBus.emit({ type: 'agent_session', agentId: agent.id, status: 'started', sessionId })
	// D9: Emit typing started
	eventBus.emit({ type: 'agent_typing', agentId: agent.id, status: 'started', sessionId })

	// 7. Spawn via provider
	// Signal a fresh run start so clients can reset per-run state on replay.
	streamManager.emit(sessionId, { at: Date.now(), type: 'status', content: 'started' })
	let streamedText = ''
	let sawTextDelta = false
	const onEvent = (event: AgentEvent) => {
		if (event.type === 'text_delta') {
			sawTextDelta = true
			streamedText += event.content ?? ''
		}

		if (event.type === 'text') {
			streamedText = event.content ?? streamedText
		}

		streamManager.emit(sessionId, {
			at: Date.now(),
			type: event.type,
			content: event.content,
			tool: event.tool,
			toolCallId: event.toolCallId,
			params: event.params,
			errorCode: event.errorCode,
		})

		if (event.type === 'tool_call') {
			storage
				.appendActivity({
					at: new Date().toISOString(),
					agent: agent.id,
					type: 'tool_call',
					summary: event.tool ?? 'unknown',
					details: { sessionId, tool: event.tool },
				})
				.catch(() => {}) // Fire-and-forget activity logging
			eventBus.emit({
				type: 'activity',
				agent: agent.id,
				toolName: event.tool ?? 'unknown',
				summary: event.tool ?? 'unknown',
			})
		}
	}

	// ── Context observability ───────────────────────────────────────────────
	const tailMsgs = conversationPromptContext?.tailMessages ?? []
	const tailChars = tailMsgs.reduce((sum, m) => sum + (m.content?.length ?? 0), 0)
	const estimatedTokens = Math.ceil((systemPrompt.length + tailChars + prompt.length) / 3.5)
	logger.info('agent', `[ctx:${sessionId}] system=${systemPrompt.length}ch messages=${tailMsgs.length}(${tailChars}ch) prompt=${prompt.length}ch ~${estimatedTokens}tok model=${agent.model || DEFAULT_MODEL}`)

	let sessionResult: { result?: string; toolCalls: number; error?: string }

	try {
		sessionResult = await aiProvider.spawn(
			{
				systemPrompt,
				prompt,
				messages: conversationPromptContext?.tailMessages,
				model: agent.model || DEFAULT_MODEL,
				tools: allTools,
				toolContext,
				maxTurns: 50,
				agentTools: agent.tools,
				agentScope: agent.fs_scope
					? { fsRead: agent.fs_scope.read, fsWrite: agent.fs_scope.write }
					: undefined,
				webSearch: (agent as Record<string, unknown>).web_search === true,
				sessionId,
				agentId: agent.id,
				maxSessionTokens: 200_000,
			},
			onEvent,
		)
		// Emit terminal text only when it reconciles missing or divergent streamed content.
		if (
			sessionResult.result &&
			(!sawTextDelta || sessionResult.result !== streamedText)
		) {
			streamManager.emit(sessionId, { at: Date.now(), type: 'text', content: sessionResult.result })
		}
	} catch (err) {
		const error = err instanceof Error ? err.message : String(err)
		sessionResult = { toolCalls: 0, error }
		streamManager.emit(sessionId, { at: Date.now(), type: 'error', content: error, errorCode: 'unknown' })
	} finally {
		// D9: Emit typing stopped
		eventBus.emit({ type: 'agent_typing', agentId: agent.id, status: 'stopped', sessionId })
		// Signal stream consumers that this run is done before tearing down the in-memory stream.
		streamManager.emit(sessionId, {
			at: Date.now(),
			type: 'status',
			content: sessionResult!.error ? 'error' : 'completed',
		})
		streamManager.endStream(sessionId)

		// H1: Update session record with final status
		await updateSessionRecord(sessionId, {
			status: sessionResult!.error ? 'failed' : 'completed',
			endedAt: new Date().toISOString(),
			toolCallsDelta: sessionResult!.toolCalls,
			error: sessionResult!.error ?? null,
		})

		await storage.appendActivity({
			at: new Date().toISOString(),
			agent: agent.id,
			type: 'session_end',
			summary: sessionResult!.error
				? `Session failed: ${sessionResult!.error}`
				: `Session completed (${sessionResult!.toolCalls} tool calls)`,
			details: { sessionId, ...sessionResult! },
		})
		eventBus.emit({ type: 'agent_session', agentId: agent.id, status: 'ended', sessionId })

		// D12: Save final text as DM message on chat session end
		if (mode === 'chat' && channelId && sessionResult!.result) {
			try {
				await storage.sendMessage({
					id: `msg-${Date.now().toString(36)}-${agent.id}`,
					channel: channelId,
					session_id: sessionId,
					from: agent.id,
					content: sessionResult!.result,
					at: new Date().toISOString(),
					mentions: [],
					references: [],
					reactions: [],
					thread: null,
					external: false,
					metadata: { sessionId },
				})
			} catch (err) {
				logger.warn('agent', `failed to save chat response for ${agent.id}/${sessionId}`, {
					error: err instanceof Error ? err.message : String(err),
				})
			}
		}

		if (mode === 'chat') {
			await maybeRefreshSessionSummary(sessionId, agent.id, aiProvider)
		}

		// Extract and persist memory from this session (best-effort, 1 retry)
		try {
			await extractMemory(companyRoot, agent.id, sessionId, storage, aiProvider)
		} catch (firstErr) {
			logger.warn('agent', `memory extraction failed for ${agent.id}/${sessionId}, retrying`, {
				error: firstErr instanceof Error ? firstErr.message : String(firstErr),
			})
			try {
				await extractMemory(companyRoot, agent.id, sessionId, storage, aiProvider)
			} catch (retryErr) {
				logger.error('agent', `memory extraction failed after retry for ${agent.id}/${sessionId}`, {
					error: retryErr instanceof Error ? retryErr.message : String(retryErr),
				})
			}
		}
	}

	return { sessionId, ...sessionResult! }
}
