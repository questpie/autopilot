import { index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

// Re-export Better Auth tables so they're included in the company schema
export {
	user,
	session,
	account,
	verification,
	twoFactor,
	apikey,
	rateLimit,
	invite,
} from './auth-schema'

// ─── Tasks ──────────────────────────────────────────────────────────────────

export const tasks = sqliteTable(
	'tasks',
	{
		id: text('id').primaryKey(),
		title: text('title').notNull(),
		description: text('description').default(''),
		type: text('type').notNull(),
		status: text('status').notNull(),
		priority: text('priority').default('medium'),

		assigned_to: text('assigned_to'),
		workflow_id: text('workflow_id'),
		workflow_step: text('workflow_step'),

		context: text('context').default('{}'),
		metadata: text('metadata').default('{}'),

		/** Optional named queue for concurrency control. */
		queue: text('queue'),
		/** ISO datetime — task should not be executed before this time. */
		start_after: text('start_after'),
		/** Schedule ID that created this task (if any). */
		scheduled_by: text('scheduled_by'),

		created_by: text('created_by').notNull(),
		created_at: text('created_at').notNull(),
		updated_at: text('updated_at').notNull(),
	},
	(table) => [
		index('idx_tasks_status').on(table.status),
		index('idx_tasks_assigned').on(table.assigned_to),
		index('idx_tasks_workflow').on(table.workflow_id, table.workflow_step),
		index('idx_tasks_created').on(table.created_at),
		index('idx_tasks_priority').on(table.priority, table.status),
		index('idx_tasks_queue_status').on(table.queue, table.status),
	],
)

// ─── Runs (replaces agent_sessions) ────────────────────────────────────────

export const runs = sqliteTable(
	'runs',
	{
		id: text('id').primaryKey(),
		agent_id: text('agent_id').notNull(),
		task_id: text('task_id'),
		worker_id: text('worker_id'),
		runtime: text('runtime').notNull(), // claude-code | codex | opencode | direct-api
		model: text('model'), // canonical model intent (e.g. 'claude-sonnet-4')
		provider: text('provider'), // canonical provider hint (e.g. 'anthropic')
		variant: text('variant'), // behavioral variant hint (e.g. 'extended-thinking')
		status: text('status').notNull().default('pending'), // pending | claimed | running | completed | failed
		initiated_by: text('initiated_by'),
		instructions: text('instructions'),
		summary: text('summary'),
		tokens_input: integer('tokens_input').default(0),
		tokens_output: integer('tokens_output').default(0),
		error: text('error'),
		started_at: text('started_at'),
		ended_at: text('ended_at'),
		created_at: text('created_at').notNull(),
		// Session continuation fields
		runtime_session_ref: text('runtime_session_ref'), // worker-local session ID (e.g. Claude session_id)
		resumed_from_run_id: text('resumed_from_run_id'), // previous run in continuation chain
		preferred_worker_id: text('preferred_worker_id'), // route continuation to specific worker
		resumable: integer('resumable', { mode: 'boolean' }).default(false),
		// Execution targeting — JSON-serialized ExecutionTarget, null = no constraints
		targeting: text('targeting'),
	},
	(table) => [
		index('idx_runs_status').on(table.status),
		index('idx_runs_agent').on(table.agent_id),
		index('idx_runs_task').on(table.task_id),
		index('idx_runs_worker').on(table.worker_id),
		index('idx_runs_resumed_from').on(table.resumed_from_run_id),
	],
)

// ─── Run Events ────────────────────────────────────────────────────────────

export const runEvents = sqliteTable(
	'run_events',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		run_id: text('run_id').notNull(),
		type: text('type').notNull(), // started | progress | tool_use | artifact | message_sent | task_updated | approval_needed | error | completed
		summary: text('summary'),
		metadata: text('metadata').default('{}'),
		created_at: text('created_at').notNull(),
	},
	(table) => [index('idx_run_events_run_created').on(table.run_id, table.created_at)],
)

// ─── Join Tokens ──────────────────────────────────────────────────────────

export const joinTokens = sqliteTable(
	'join_tokens',
	{
		id: text('id').primaryKey(),
		/** SHA-256 hash of the token secret. */
		secret_hash: text('secret_hash').notNull(),
		description: text('description'),
		created_by: text('created_by').notNull(),
		created_at: text('created_at').notNull(),
		expires_at: text('expires_at').notNull(),
		/** Set when consumed by enrollment. */
		used_at: text('used_at'),
		/** Worker ID that consumed this token. */
		used_by_worker_id: text('used_by_worker_id'),
	},
	(table) => [
		index('idx_join_tokens_expires').on(table.expires_at),
	],
)

// ─── Workers ───────────────────────────────────────────────────────────────

export const workers = sqliteTable(
	'workers',
	{
		id: text('id').primaryKey(),
		device_id: text('device_id'),
		name: text('name'),
		status: text('status').notNull().default('offline'), // online | busy | offline
		capabilities: text('capabilities').default('[]'),
		registered_at: text('registered_at').notNull(),
		last_heartbeat: text('last_heartbeat'),
		/** SHA-256 hash of the durable machine secret. Null for legacy/local workers. */
		machine_secret_hash: text('machine_secret_hash'),
	},
	(table) => [
		index('idx_workers_device').on(table.device_id),
		index('idx_workers_status').on(table.status),
	],
)

// ─── Worker Leases ─────────────────────────────────────────────────────────

export const workerLeases = sqliteTable(
	'worker_leases',
	{
		id: text('id').primaryKey(),
		worker_id: text('worker_id').notNull(),
		run_id: text('run_id').notNull(),
		claimed_at: text('claimed_at').notNull(),
		expires_at: text('expires_at').notNull(),
		status: text('status').notNull().default('active'), // active | completed | failed | expired
	},
	(table) => [
		index('idx_leases_worker').on(table.worker_id),
		index('idx_leases_run').on(table.run_id),
		index('idx_leases_status').on(table.status),
	],
)

// ─── Artifact Blobs ───────────────────────────────────────────────────────

export const artifactBlobs = sqliteTable('artifact_blobs', {
	id: text('id').primaryKey(),
	content_hash: text('content_hash').notNull().unique(),
	storage_key: text('storage_key').notNull().unique(),
	size: integer('size').notNull(),
	created_at: text('created_at').notNull(),
})

// ─── Artifacts ────────────────────────────────────────────────────────────

export const artifacts = sqliteTable(
	'artifacts',
	{
		id: text('id').primaryKey(),
		run_id: text('run_id').notNull(),
		task_id: text('task_id'),
		kind: text('kind').notNull(), // changed_file | diff_summary | test_report | doc | external_receipt | preview_url | other
		title: text('title').notNull(),
		ref_kind: text('ref_kind').notNull(), // file | url | inline
		ref_value: text('ref_value').notNull(),
		mime_type: text('mime_type'),
		metadata: text('metadata').default('{}'),
		blob_id: text('blob_id'), // FK to artifact_blobs.id — null for inline/legacy
		created_at: text('created_at').notNull(),
	},
	(table) => [
		index('idx_artifacts_run').on(table.run_id),
		index('idx_artifacts_task').on(table.task_id),
		index('idx_artifacts_kind').on(table.kind),
		index('idx_artifacts_blob_id').on(table.blob_id),
	],
)

// ─── Conversation Bindings ─────────────────────────────────────────────────

export const conversationBindings = sqliteTable(
	'conversation_bindings',
	{
		id: text('id').primaryKey(),
		provider_id: text('provider_id').notNull(),
		external_conversation_id: text('external_conversation_id').notNull(),
		external_thread_id: text('external_thread_id'),
		mode: text('mode').notNull(), // task_thread | intent_intake (provider-facing binding mode, distinct from session mode)
		task_id: text('task_id'),
		metadata: text('metadata').default('{}'),
		created_at: text('created_at').notNull(),
		updated_at: text('updated_at').notNull(),
	},
	(table) => [
		uniqueIndex('uq_binding_provider_conv').on(table.provider_id, table.external_conversation_id, table.external_thread_id),
		index('idx_bindings_task').on(table.task_id),
		index('idx_bindings_provider').on(table.provider_id),
	],
)

// ─── Task Relations ───────────────────────────────────────────────────────

export const taskRelations = sqliteTable(
	'task_relations',
	{
		id: text('id').primaryKey(),
		source_task_id: text('source_task_id').notNull(),
		target_task_id: text('target_task_id').notNull(),
		relation_type: text('relation_type').notNull(), // decomposes_to
		dedupe_key: text('dedupe_key'),
		origin_run_id: text('origin_run_id'),
		created_by: text('created_by').notNull(),
		created_at: text('created_at').notNull(),
		metadata: text('metadata').default('{}'),
	},
	(table) => [
		index('idx_task_relations_source').on(table.source_task_id, table.relation_type),
		index('idx_task_relations_target').on(table.target_task_id, table.relation_type),
		uniqueIndex('uq_task_relation').on(table.source_task_id, table.target_task_id, table.relation_type),
		// SQLite treats NULL as distinct in unique indexes, so this only enforces
		// uniqueness when dedupe_key is non-null — exactly what we need.
		uniqueIndex('uq_task_relation_dedupe').on(table.source_task_id, table.relation_type, table.dedupe_key),
	],
)

// ─── Shared Secrets ───────────────────────────────────────────────────────

export const sharedSecrets = sqliteTable(
	'shared_secrets',
	{
		/** Unique secret name (e.g. "TELEGRAM_BOT_TOKEN"). */
		name: text('name').primaryKey(),
		/** Delivery scope: worker | provider | orchestrator_only. */
		scope: text('scope').notNull(),
		/** AES-256-GCM ciphertext (base64). */
		encrypted_value: text('encrypted_value').notNull(),
		/** AES-256-GCM initialization vector (base64). */
		iv: text('iv').notNull(),
		/** AES-256-GCM authentication tag (base64). */
		auth_tag: text('auth_tag').notNull(),
		/** Optional human-readable description. */
		description: text('description'),
		created_at: text('created_at').notNull(),
		updated_at: text('updated_at').notNull(),
	},
	(table) => [
		index('idx_shared_secrets_scope').on(table.scope),
	],
)

// ─── Queries ──────────────────────────────────────────────────────────────

export const queries = sqliteTable(
	'queries',
	{
		id: text('id').primaryKey(),
		prompt: text('prompt').notNull(),
		agent_id: text('agent_id').notNull(),
		run_id: text('run_id'),
		status: text('status').notNull().default('pending'), // pending | running | completed | failed
		allow_repo_mutation: integer('allow_repo_mutation', { mode: 'boolean' }).notNull().default(false),
		mutated_repo: integer('mutated_repo', { mode: 'boolean' }).notNull().default(false),
		summary: text('summary'),

		runtime_session_ref: text('runtime_session_ref'), // optional adapter resume handle

		created_by: text('created_by').notNull(),
		created_at: text('created_at').notNull(),
		ended_at: text('ended_at'),
		metadata: text('metadata').default('{}'),
		/** Session this query belongs to. */
		session_id: text('session_id'),
		/** Task ID if this query was promoted to a task. */
		promoted_task_id: text('promoted_task_id'),
	},
	(table) => [
		index('idx_queries_status').on(table.status),
		index('idx_queries_agent').on(table.agent_id),
		index('idx_queries_created').on(table.created_at),
		index('idx_queries_session').on(table.session_id),
		index('idx_queries_promoted').on(table.promoted_task_id),
	],
)

// ─── Sessions ─────────────────────────────────────────────────────────────

export const sessions = sqliteTable(
	'sessions',
	{
		id: text('id').primaryKey(),
		provider_id: text('provider_id').notNull(),
		external_conversation_id: text('external_conversation_id').notNull(),
		external_thread_id: text('external_thread_id').notNull(), // real thread ID or '__chat__' sentinel
		mode: text('mode').notNull(), // query | task_thread (discussion is task_thread with discussion-style task)
		task_id: text('task_id'),

		status: text('status').notNull().default('active'), // active | closed
		created_at: text('created_at').notNull(),
		updated_at: text('updated_at').notNull(),
		metadata: text('metadata').default('{}'),
		/** Claude Code session ID for --resume. */
		runtime_session_ref: text('runtime_session_ref'),
		/** Worker that holds session files — route continuation runs here. */
		preferred_worker_id: text('preferred_worker_id'),
	},
	(table) => [
		uniqueIndex('uq_session_provider_conv').on(table.provider_id, table.external_conversation_id, table.external_thread_id),
		index('idx_sessions_provider').on(table.provider_id),
		index('idx_sessions_task').on(table.task_id),
		index('idx_sessions_status').on(table.status),
		index('idx_sessions_mode').on(table.mode),
	],
)

// ─── Session Messages ────────────────────────────────────────────────────

export const sessionMessages = sqliteTable(
	'session_messages',
	{
		id: text('id').primaryKey(),
		session_id: text('session_id').notNull(),
		role: text('role').notNull(), // user | assistant | system
		content: text('content').notNull(),
		query_id: text('query_id'), // null = queued user message not yet consumed
		/** External provider message ID used for edit-in-place delivery. */
		external_message_id: text('external_message_id'),
		metadata: text('metadata').default('{}'),
		created_at: text('created_at').notNull(),
	},
	(table) => [
		index('idx_session_messages_session_created').on(table.session_id, table.created_at),
		index('idx_session_messages_session_query').on(table.session_id, table.query_id),
	],
)

// ─── Schedules ───────────────────────────────────────────────────────────

export const schedules = sqliteTable(
	'schedules',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		description: text('description'),
		cron: text('cron').notNull(),
		timezone: text('timezone').default('UTC'),
		agent_id: text('agent_id').notNull(),
		workflow_id: text('workflow_id'),
		task_template: text('task_template').default('{}'), // JSON: { title, description, type, priority }
		mode: text('mode').default('task'), // task | query
		query_template: text('query_template').default('{}'), // JSON: { prompt, allow_repo_mutation }
		concurrency_policy: text('concurrency_policy').default('skip'), // skip | allow | queue
		enabled: integer('enabled', { mode: 'boolean' }).default(true),
		last_run_at: text('last_run_at'),
		next_run_at: text('next_run_at'),
		created_by: text('created_by'),
		created_at: text('created_at').notNull(),
		updated_at: text('updated_at').notNull(),
	},
	(table) => [
		index('idx_schedules_enabled').on(table.enabled),
		index('idx_schedules_next_run').on(table.next_run_at),
		index('idx_schedules_agent').on(table.agent_id),
	],
)

// ─── Schedule Executions ────────────────────────────────────────────────

export const scheduleExecutions = sqliteTable(
	'schedule_executions',
	{
		id: text('id').primaryKey(),
		schedule_id: text('schedule_id').notNull(),
		task_id: text('task_id'),
		query_id: text('query_id'),
		status: text('status').notNull().default('triggered'), // triggered | completed | skipped | failed | queued
		skip_reason: text('skip_reason'),
		error: text('error'),
		triggered_at: text('triggered_at').notNull(),
		created_at: text('created_at').notNull(),
	},
	(table) => [
		index('idx_schedule_executions_schedule').on(table.schedule_id),
		index('idx_schedule_executions_status').on(table.status),
		index('idx_schedule_executions_triggered').on(table.triggered_at),
	],
)

// ─── Activity ──────────────────────────────────────────────────────────────

export const activity = sqliteTable(
	'activity',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		actor: text('actor').notNull(),
		type: text('type').notNull(),
		summary: text('summary').notNull(),
		details: text('details'),
		created_at: text('created_at').notNull(),
	},
	(table) => [
		index('idx_activity_actor_time').on(table.actor, table.created_at),
		index('idx_activity_type').on(table.type),
		index('idx_activity_time').on(table.created_at),
	],
)
