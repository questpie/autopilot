import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core'

// Re-export Better Auth tables so they're included in the Drizzle schema
export {
	user, session, account, verification,
	twoFactor, apikey, rateLimit,
} from './auth-schema'

// ─── Tasks ──────────────────────────────────────────────────────────────────

export const tasks = sqliteTable('tasks', {
	id: text('id').primaryKey(),
	title: text('title').notNull(),
	description: text('description').default(''),
	type: text('type').notNull(),
	status: text('status').notNull(),
	priority: text('priority').default('medium'),

	created_by: text('created_by').notNull(),
	assigned_to: text('assigned_to'),
	reviewers: text('reviewers').default('[]'),
	approver: text('approver'),

	project: text('project'),
	parent: text('parent'),
	depends_on: text('depends_on').default('[]'),
	blocks: text('blocks').default('[]'),
	related: text('related').default('[]'),

	workflow: text('workflow'),
	workflow_step: text('workflow_step'),

	context: text('context').default('{}'),
	blockers: text('blockers').default('[]'),

	resources: text('resources').default('[]'),
	labels: text('labels').default('[]'),
	milestone: text('milestone'),

	created_at: text('created_at').notNull(),
	updated_at: text('updated_at').notNull(),
	started_at: text('started_at'),
	completed_at: text('completed_at'),
	deadline: text('deadline'),

	history: text('history').default('[]'),

	metadata: text('metadata').default('{}'),
}, (table) => [
	index('idx_tasks_status').on(table.status),
	index('idx_tasks_assigned').on(table.assigned_to),
	index('idx_tasks_workflow').on(table.workflow, table.workflow_step),
	index('idx_tasks_project').on(table.project),
	index('idx_tasks_parent').on(table.parent),
	index('idx_tasks_created').on(table.created_at),
	index('idx_tasks_priority').on(table.priority, table.status),
	index('idx_tasks_milestone').on(table.milestone),
])

// ─── Messages ───────────────────────────────────────────────────────────────

export const messages = sqliteTable('messages', {
	id: text('id').primaryKey(),
	channel: text('channel'),
	from_id: text('from_id').notNull(),
	to_id: text('to_id'),
	content: text('content').notNull(),
	created_at: text('created_at').notNull(),
	mentions: text('mentions').default('[]'),
	references_ids: text('references_ids').default('[]'),
	reactions: text('reactions').default('[]'),
	thread: text('thread'),
	transport: text('transport'),
	external: integer('external', { mode: 'boolean' }).default(false),
}, (table) => [
	index('idx_messages_channel').on(table.channel),
	index('idx_messages_from').on(table.from_id),
	index('idx_messages_to').on(table.to_id),
	index('idx_messages_thread').on(table.thread),
	index('idx_messages_created').on(table.created_at),
])

// ─── Activity ───────────────────────────────────────────────────────────────

export const activity = sqliteTable('activity', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	agent: text('agent').notNull(),
	type: text('type').notNull(),
	summary: text('summary').notNull(),
	details: text('details'),
	created_at: text('created_at').notNull(),
}, (table) => [
	index('idx_activity_agent_time').on(table.agent, table.created_at),
	index('idx_activity_type').on(table.type),
	index('idx_activity_time').on(table.created_at),
])

// ─── Agent Sessions ─────────────────────────────────────────────────────────

export const agentSessions = sqliteTable('agent_sessions', {
	id: text('id').primaryKey(),
	agent_id: text('agent_id').notNull(),
	task_id: text('task_id'),
	trigger_type: text('trigger_type').notNull(),
	status: text('status').notNull().default('running'),
	started_at: text('started_at').notNull(),
	ended_at: text('ended_at'),
	tool_calls: integer('tool_calls').default(0),
	tokens_used: integer('tokens_used').default(0),
	error: text('error'),
	log_path: text('log_path'),
}, (table) => [
	index('idx_agent_sessions_agent').on(table.agent_id),
	index('idx_agent_sessions_task').on(table.task_id),
	index('idx_agent_sessions_status').on(table.status),
	index('idx_agent_sessions_started').on(table.started_at),
])

// ─── Search Index ────────────────────────────────────────────────────────

export const searchIndex = sqliteTable('search_index', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	entityType: text('entity_type').notNull(),
	entityId: text('entity_id').notNull(),
	title: text('title'),
	content: text('content').notNull(),
	contentHash: text('content_hash').notNull(),
	indexedAt: text('indexed_at').notNull(),
}, (table) => [
	index('idx_search_entity_type').on(table.entityType),
	index('idx_search_entity_id').on(table.entityId),
	uniqueIndex('uq_search_entity').on(table.entityType, table.entityId),
])

// ─── Channels ──────────────────────────────────────────────────────────────

export const channels = sqliteTable('channels', {
	id: text('id').primaryKey(),
	name: text('name').notNull(),
	type: text('type').notNull(),
	description: text('description'),
	created_by: text('created_by').notNull(),
	created_at: text('created_at').notNull(),
	updated_at: text('updated_at').notNull(),
	metadata: text('metadata').default('{}'),
}, (table) => [
	index('idx_channels_type').on(table.type),
	index('idx_channels_created').on(table.created_at),
])

// ─── Channel Members ───────────────────────────────────────────────────────

export const channelMembers = sqliteTable('channel_members', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	channel_id: text('channel_id').notNull(),
	actor_id: text('actor_id').notNull(),
	actor_type: text('actor_type').notNull(),
	role: text('role').default('member'),
	joined_at: text('joined_at').notNull(),
}, (table) => [
	index('idx_members_channel').on(table.channel_id),
	index('idx_members_actor').on(table.actor_id),
	uniqueIndex('uq_channel_member').on(table.channel_id, table.actor_id),
])

// ─── File Locks ─────────────────────────────────────────────────────────────

export const fileLocks = sqliteTable('file_locks', {
	path: text('path').primaryKey(),
	locked_by: text('locked_by').notNull(),
	locked_at: integer('locked_at').notNull(),
	expires_at: integer('expires_at').notNull(),
}, (table) => [
	index('idx_file_locks_expires').on(table.expires_at),
])

// ─── Pins ───────────────────────────────────────────────────────────────────

export const pins = sqliteTable('pins', {
	id: text('id').primaryKey(),
	title: text('title').notNull(),
	content: text('content'),
	type: text('type').notNull().default('info'),
	group_id: text('group_id').default('overview'),
	metadata: text('metadata').default('{}'),
	created_by: text('created_by'),
	created_at: integer('created_at').notNull(),
	updated_at: integer('updated_at').notNull(),
	expires_at: integer('expires_at'),
}, (table) => [
	index('idx_pins_group').on(table.group_id),
	index('idx_pins_type').on(table.type),
	index('idx_pins_expires').on(table.expires_at),
])

// ─── Rate Limiting ──────────────────────────────────────────────────────────

export const rateLimitEntries = sqliteTable('rate_limit_entries', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	key: text('key').notNull(),
	window_start: integer('window_start').notNull(),
	count: integer('count').notNull().default(1),
	expires_at: integer('expires_at').notNull(),
}, (table) => [
	index('idx_rate_limit_key_window').on(table.key, table.window_start),
	index('idx_rate_limit_expires').on(table.expires_at),
])
