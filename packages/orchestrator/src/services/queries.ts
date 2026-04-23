import { randomBytes } from 'node:crypto'
import { eq, and, desc, inArray } from 'drizzle-orm'
import { queries } from '../db/company-schema'
import type { CompanyDb } from '../db'
import type { SessionMessageRow } from './session-messages'

export interface QueryInstructionAttachment {
	type?: string
	name?: string
	url?: string
	content?: string
	mimeType?: string
	size?: number
	label?: string
	refType?: string
	refId?: string
	metadata?: Record<string, unknown>
}

function _getQuery(db: CompanyDb, id: string) {
	return db.select().from(queries).where(eq(queries.id, id)).get()
}

export type QueryRow = NonNullable<Awaited<ReturnType<typeof _getQuery>>>

export class QueryService {
	constructor(private db: CompanyDb) {}

	/** Create a new query record. Does NOT create a task. */
	async create(input: {
		prompt: string
		agent_id: string
		allow_repo_mutation: boolean
		session_id?: string
		created_by: string
		metadata?: string
	}): Promise<QueryRow> {
		const id = `query-${Date.now()}-${randomBytes(6).toString('hex')}`
		const now = new Date().toISOString()

		await this.db.insert(queries).values({
			id,
			prompt: input.prompt,
			agent_id: input.agent_id,
			status: 'pending',
			allow_repo_mutation: input.allow_repo_mutation,
			mutated_repo: false,
			session_id: input.session_id ?? null,
			runtime_session_ref: null,
			created_by: input.created_by,
			created_at: now,
			metadata: input.metadata ?? '{}',
		})

		return this.get(id) as Promise<QueryRow>
	}

	async get(id: string): Promise<QueryRow | undefined> {
		return _getQuery(this.db, id)
	}

	async list(filter?: { status?: string; agent_id?: string }): Promise<QueryRow[]> {
		const conditions = []
		if (filter?.status) conditions.push(eq(queries.status, filter.status))
		if (filter?.agent_id) conditions.push(eq(queries.agent_id, filter.agent_id))

		if (conditions.length === 0) {
			return this.db.select().from(queries).orderBy(desc(queries.created_at)).all()
		}
		if (conditions.length === 1) {
			return this.db.select().from(queries).where(conditions[0]!).orderBy(desc(queries.created_at)).all()
		}
		return this.db
			.select()
			.from(queries)
			.where(and(...conditions))
			.orderBy(desc(queries.created_at))
			.all()
	}

	/** List queries belonging to a session, ordered by creation. */
	async listBySession(sessionId: string): Promise<QueryRow[]> {
		return this.db
			.select()
			.from(queries)
			.where(eq(queries.session_id, sessionId))
			.orderBy(queries.created_at)
			.all()
	}

	/** Link a run to a query and mark it as running. */
	async linkRun(queryId: string, runId: string): Promise<QueryRow | undefined> {
		await this.db
			.update(queries)
			.set({ run_id: runId, status: 'running' })
			.where(eq(queries.id, queryId))
		return this.get(queryId)
	}

	/** Find a running query by its associated run ID. */
	async getByRunId(runId: string): Promise<QueryRow | undefined> {
		return this.db
			.select()
			.from(queries)
			.where(and(eq(queries.run_id, runId), eq(queries.status, 'running')))
			.get()
	}

	/** Find a query by its associated run ID, regardless of status. */
	async getByRunIdAnyStatus(runId: string): Promise<QueryRow | undefined> {
		return this.db
			.select()
			.from(queries)
			.where(eq(queries.run_id, runId))
			.get()
	}

	/** Find the most recent active (pending or running) query for a session, if any. */
	async findActiveForSession(sessionId: string): Promise<QueryRow | undefined> {
		// Check running first (most likely active state), then pending
		const running = await this.db
			.select()
			.from(queries)
			.where(
				and(
					eq(queries.session_id, sessionId),
					eq(queries.status, 'running'),
				),
			)
			.orderBy(desc(queries.created_at))
			.get()
		if (running) return running

		return this.db
			.select()
			.from(queries)
			.where(
				and(
					eq(queries.session_id, sessionId),
					eq(queries.status, 'pending'),
				),
			)
			.orderBy(desc(queries.created_at))
			.get()
	}

	/** Find the most recent completed/failed query for a session. */
	async findLastCompletedForSession(sessionId: string): Promise<QueryRow | undefined> {
		return this.db
			.select()
			.from(queries)
			.where(
				and(
					eq(queries.session_id, sessionId),
					inArray(queries.status, ['completed', 'failed']),
				),
			)
			.orderBy(desc(queries.created_at))
			.get()
	}

	/**
	 * Mark a query as promoted to a task.
	 * Does NOT create the task — caller must do that via WorkflowEngine.materializeTask().
	 */
	async promote(queryId: string, taskId: string): Promise<QueryRow | undefined> {
		const query = await this.get(queryId)
		if (!query) return undefined
		if (query.promoted_task_id) return undefined // already promoted

		await this.db
			.update(queries)
			.set({ promoted_task_id: taskId })
			.where(eq(queries.id, queryId))
		return this.get(queryId)
	}

	/** Complete a query with results from its run. */
	async complete(
		queryId: string,
		result: {
			status: 'completed' | 'failed'
			summary?: string
			mutated_repo?: boolean
			runtime_session_ref?: string
			error?: string
		},
	): Promise<QueryRow | undefined> {
		await this.db
			.update(queries)
			.set({
				status: result.status,
				summary: result.summary ?? result.error ?? null,
				mutated_repo: result.mutated_repo ?? false,
				runtime_session_ref: result.runtime_session_ref ?? null,
				ended_at: new Date().toISOString(),
			})
			.where(eq(queries.id, queryId))
		return this.get(queryId)
	}
}

// ─── Query Helpers ───────────────────────────────────────────────────────

export interface BuildQueryInstructionsOpts {
	sessionMessages?: SessionMessageRow[]
	allowMutation: boolean
	hasResume: boolean
	currentAttachments?: QueryInstructionAttachment[]
}

/** Build instructions envelope for a query run. */
export function buildQueryInstructions(
	prompt: string,
	opts: BuildQueryInstructionsOpts,
): string {
	const parts: string[] = []

	const msgs = opts.sessionMessages ?? []

	if (opts.hasResume && msgs.length > 0) {
		// Resume mode: only inject system notifications (Claude remembers the rest)
		const systemMsgs = msgs.filter((m) => m.role === 'system')
		if (systemMsgs.length > 0) {
			parts.push('## System Notifications (since last message)\n')
			for (const msg of systemMsgs) {
				const content = msg.content.length > 2000 ? msg.content.slice(0, 2000) + '...' : msg.content
				parts.push(`[system] ${content}`)
			}
		}
	} else if (!opts.hasResume && msgs.length > 0) {
		// Cold start: inject full conversation history
		parts.push('## Conversation History\n')
		for (const msg of msgs.slice(-20)) {
			const meta = safeParseMetadata(msg.metadata)
			const attachments = getAttachments(meta)
			const senderName = typeof meta.sender_name === 'string' ? meta.sender_name : undefined
			const roleLabel = msg.role === 'system' ? '[system]'
				: msg.role === 'assistant' ? '[assistant]'
				: senderName ? `[user:${senderName}]` : '[user]'
			const content = msg.content.length > 2000 ? msg.content.slice(0, 2000) + '...' : msg.content
			parts.push(`${roleLabel} ${content}`)
			for (const attachment of attachments) {
				parts.push(...formatAttachmentLines(attachment, 'history'))
			}
		}
	}

	const currentAttachments = opts.currentAttachments ?? []
	if (currentAttachments.length > 0) {
		parts.push('## Attached Context\n')
		for (const attachment of currentAttachments) {
			parts.push(...formatAttachmentLines(attachment, 'current'))
		}
	}

	if (opts.allowMutation) {
		parts.push(`## Query Mode (mutable)

You are in query mode with full repo access. You may read, create, and edit files.

### Artifacts

When your response includes substantial visual output (web page, chart, diagram,
interactive prototype, presentation — anything over ~20 lines that benefits from
a rendered preview), create it as an artifact using the \`artifact_create\` tool
instead of pasting content into chat.

**For HTML artifacts** — produce self-contained files:
- Include all dependencies via CDN (esm.sh for npm packages, unpkg, cdnjs)
- For React components: include @babel/standalone + import maps pointing to esm.sh
- For charts: include the charting library (recharts, chart.js, d3) via CDN
- For Mermaid diagrams: include mermaid.js via CDN
- Use Tailwind via CDN for styling (\`<script src="https://cdn.tailwindcss.com"></script>\`)
- Always include proper HTML structure: doctype, charset, viewport meta
- No external API calls to unknown domains

**Artifact types:**
- \`html\` — web pages, React apps, interactive content (rendered as live preview)
- \`code\` — code snippets with syntax highlighting (displayed inline)
- \`document\` — markdown or text content (rendered inline)

After creating an artifact, briefly describe what you made. Don't paste the full
artifact content into chat — it's available in the preview.

### General guidelines

- **Prefer Autopilot-native primitives.**
  Autopilot is your primary runtime. Prefer Autopilot-native primitives over host-runtime tools whenever an Autopilot equivalent exists.
  Examples:
  - use artifacts for previewable visual output
  - use Autopilot tasks for durable tracked work
  - use Autopilot schedules for recurring work
  - use host-runtime tools only when Autopilot has no equivalent primitive

- **Stay in query mode for:** prototyping, drafts, artifacts, exploratory work, quick implementation.
- **Consider creating an Autopilot task when:** the user asks for durable multi-step operational work, scheduled/repeatable work, or background work that should be tracked independently.
  Do not auto-create tasks for every request — only when the task primitive genuinely fits.

- Keep chat responses concise — this is a conversation, not a report.
- Respond in the same language the user writes.`)
	} else {
		parts.push(`## Query Mode (read-only)

You are in query mode with read-only access. You may inspect, explain, brainstorm, and draft.
Do NOT modify any files. Do NOT create artifacts that imply filesystem changes.

- Keep responses concise — this is a conversation, not a report.
- Respond in the same language the user writes.`)
	}

	parts.push(`\n## Current Message\n\n${prompt}`)

	return parts.join('\n\n')
}

function safeParseMetadata(raw: string | null | undefined): Record<string, unknown> {
	if (!raw) return {}
	try {
		return JSON.parse(raw)
	} catch {
		return {}
	}
}

function getAttachments(meta: Record<string, unknown>): QueryInstructionAttachment[] {
	return Array.isArray(meta.attachments)
		? meta.attachments.filter((attachment): attachment is QueryInstructionAttachment => !!attachment && typeof attachment === 'object')
		: []
}

function formatAttachmentLines(
	attachment: QueryInstructionAttachment,
	mode: 'current' | 'history',
): string[] {
	const label = attachment.name ?? attachment.label ?? attachment.url ?? attachment.refId ?? 'attachment'
	const lines = [`- ${label}`]
	if (attachment.type) lines.push(`  type: ${attachment.type}`)
	if (attachment.mimeType) lines.push(`  mime: ${attachment.mimeType}`)
	if (typeof attachment.size === 'number') lines.push(`  size: ${attachment.size} bytes`)
	if (attachment.refType) lines.push(`  ref_type: ${attachment.refType}`)
	if (attachment.refId) lines.push(`  ref_id: ${attachment.refId}`)
	if (attachment.url) lines.push(`  url: ${attachment.url}`)
	if (attachment.metadata && Object.keys(attachment.metadata).length > 0) {
		const metadata = JSON.stringify(attachment.metadata)
		lines.push(`  metadata: ${metadata.length > 500 ? `${metadata.slice(0, 500)}...` : metadata}`)
	}

	if (attachment.content) {
		const maxLen = mode === 'current' ? 6000 : 1500
		const content = attachment.content.length > maxLen
			? `${attachment.content.slice(0, maxLen)}...`
			: attachment.content
		lines.push('  content: |')
		for (const line of content.split('\n')) {
			lines.push(`    ${line}`)
		}
	}

	return lines
}
