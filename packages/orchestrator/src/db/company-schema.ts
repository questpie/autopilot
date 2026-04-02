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

// ─── Messages ──────────────────────────────────────────────────────────────

export const messages = sqliteTable(
	'messages',
	{
		id: text('id').primaryKey(),
		from_id: text('from_id').notNull(),
		channel_id: text('channel_id'),
		run_id: text('run_id'),
		content: text('content').notNull(),
		mentions: text('mentions').default('[]'),
		attachments: text('attachments').default('[]'),
		thread_id: text('thread_id'),
		created_at: text('created_at').notNull(),
	},
	(table) => [
		index('idx_messages_channel').on(table.channel_id),
		index('idx_messages_run_created').on(table.run_id, table.created_at),
		index('idx_messages_from').on(table.from_id),
		index('idx_messages_created').on(table.created_at),
		index('idx_messages_thread_id').on(table.thread_id),
	],
)

// ─── Channels ──────────────────────────────────────────────────────────────

export const channels = sqliteTable(
	'channels',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		type: text('type').notNull(),
		description: text('description'),
		created_by: text('created_by').notNull(),
		created_at: text('created_at').notNull(),
		updated_at: text('updated_at').notNull(),
		metadata: text('metadata').default('{}'),
	},
	(table) => [
		index('idx_channels_type').on(table.type),
		index('idx_channels_created').on(table.created_at),
	],
)

// ─── Channel Members ───────────────────────────────────────────────────────

export const channelMembers = sqliteTable(
	'channel_members',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		channel_id: text('channel_id').notNull(),
		actor_id: text('actor_id').notNull(),
		actor_type: text('actor_type').notNull(),
		role: text('role').default('member'),
		joined_at: text('joined_at').notNull(),
	},
	(table) => [
		index('idx_members_channel').on(table.channel_id),
		index('idx_members_actor').on(table.actor_id),
		uniqueIndex('uq_channel_member').on(table.channel_id, table.actor_id),
	],
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
