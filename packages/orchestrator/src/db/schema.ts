import { blob, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core'

// Re-export Better Auth tables so they're included in the Drizzle schema
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
	},
	(table) => [
		index('idx_tasks_status').on(table.status),
		index('idx_tasks_assigned').on(table.assigned_to),
		index('idx_tasks_workflow').on(table.workflow, table.workflow_step),
		index('idx_tasks_project').on(table.project),
		index('idx_tasks_parent').on(table.parent),
		index('idx_tasks_created').on(table.created_at),
		index('idx_tasks_priority').on(table.priority, table.status),
		index('idx_tasks_milestone').on(table.milestone),
	],
)

// ─── Messages ───────────────────────────────────────────────────────────────

export const messages = sqliteTable(
	'messages',
	{
		id: text('id').primaryKey(),
		channel: text('channel'),
		session_id: text('session_id'),
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
		metadata: text('metadata').default('{}'),
		attachments: text('attachments').default('[]'),
		thread_id: text('thread_id'),
		edited_at: text('edited_at'),
	},
	(table) => [
		index('idx_messages_channel').on(table.channel),
		index('idx_messages_session_created').on(table.session_id, table.created_at),
		index('idx_messages_from').on(table.from_id),
		index('idx_messages_to').on(table.to_id),
		index('idx_messages_thread').on(table.thread),
		index('idx_messages_created').on(table.created_at),
		index('idx_messages_thread_id').on(table.thread_id),
	],
)

// ─── Activity ───────────────────────────────────────────────────────────────

export const activity = sqliteTable(
	'activity',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		agent: text('agent').notNull(),
		type: text('type').notNull(),
		summary: text('summary').notNull(),
		details: text('details'),
		created_at: text('created_at').notNull(),
	},
	(table) => [
		index('idx_activity_agent_time').on(table.agent, table.created_at),
		index('idx_activity_type').on(table.type),
		index('idx_activity_time').on(table.created_at),
	],
)

// ─── Agent Sessions ─────────────────────────────────────────────────────────

export const agentSessions = sqliteTable(
	'agent_sessions',
	{
		id: text('id').primaryKey(),
		agent_id: text('agent_id').notNull(),
		task_id: text('task_id'),
		initiated_by: text('initiated_by'),
		channel_id: text('channel_id'),
		first_message: text('first_message'),
		summary: text('summary'),
		summary_updated_at: text('summary_updated_at'),
		last_summarized_message_id: text('last_summarized_message_id'),
		trigger_type: text('trigger_type').notNull(),
		status: text('status').notNull().default('running'),
		started_at: text('started_at').notNull(),
		ended_at: text('ended_at'),
		tool_calls: integer('tool_calls').default(0),
		tokens_used: integer('tokens_used').default(0),
		error: text('error'),
		log_path: text('log_path'),
	},
	(table) => [
		index('idx_agent_sessions_agent').on(table.agent_id),
		index('idx_agent_sessions_task').on(table.task_id),
		index('idx_agent_sessions_initiated_by').on(table.initiated_by),
		index('idx_agent_sessions_channel').on(table.channel_id),
		index('idx_agent_sessions_status').on(table.status),
		index('idx_agent_sessions_started').on(table.started_at),
	],
)

// ─── Workflow Runtime ───────────────────────────────────────────────────────

export const workflowRuns = sqliteTable(
	'workflow_runs',
	{
		id: text('id').primaryKey(),
		task_id: text('task_id').notNull(),
		workflow_id: text('workflow_id').notNull(),
		status: text('status').notNull().default('pending'),
		current_step_id: text('current_step_id'),
		trigger_source: text('trigger_source'),
		parent_task_id: text('parent_task_id'),
		parent_run_id: text('parent_run_id'),
		input_snapshot: text('input_snapshot').default('{}'),
		workflow_definition: text('workflow_definition').default('{}'),
		last_event: text('last_event'),
		stream_id: text('stream_id'),
		created_at: text('created_at').notNull(),
		updated_at: text('updated_at').notNull(),
		started_at: text('started_at').notNull(),
		completed_at: text('completed_at'),
		archived_at: text('archived_at'),
		metadata: text('metadata').default('{}'),
	},
	(table) => [
		uniqueIndex('uq_workflow_runs_task').on(table.task_id),
		index('idx_workflow_runs_workflow').on(table.workflow_id, table.status),
		index('idx_workflow_runs_parent').on(table.parent_task_id),
		index('idx_workflow_runs_current_step').on(table.current_step_id),
		index('idx_workflow_runs_updated').on(table.updated_at),
	],
)

export const stepRuns = sqliteTable(
	'step_runs',
	{
		id: text('id').primaryKey(),
		workflow_run_id: text('workflow_run_id').notNull(),
		task_id: text('task_id').notNull(),
		step_id: text('step_id').notNull(),
		attempt: integer('attempt').notNull().default(1),
		status: text('status').notNull().default('pending'),
		executor_kind: text('executor_kind'),
		executor_ref: text('executor_ref'),
		model_policy: text('model_policy'),
		validation_mode: text('validation_mode'),
		input_snapshot: text('input_snapshot').default('{}'),
		output_snapshot: text('output_snapshot').default('{}'),
		validation_snapshot: text('validation_snapshot').default('{}'),
		failure_action: text('failure_action'),
		failure_reason: text('failure_reason'),
		child_workflow_id: text('child_workflow_id'),
		child_task_id: text('child_task_id'),
		idempotency_key: text('idempotency_key'),
		created_at: text('created_at').notNull(),
		updated_at: text('updated_at').notNull(),
		started_at: text('started_at').notNull(),
		completed_at: text('completed_at'),
		archived_at: text('archived_at'),
		metadata: text('metadata').default('{}'),
	},
	(table) => [
		uniqueIndex('uq_step_runs_attempt').on(table.workflow_run_id, table.step_id, table.attempt),
		index('idx_step_runs_workflow').on(table.workflow_run_id, table.step_id),
		index('idx_step_runs_task').on(table.task_id, table.status),
		index('idx_step_runs_child_task').on(table.child_task_id),
		index('idx_step_runs_updated').on(table.updated_at),
	],
)

// ─── Search Index ────────────────────────────────────────────────────────

export const searchIndex = sqliteTable(
	'search_index',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		entityType: text('entity_type').notNull(),
		entityId: text('entity_id').notNull(),
		title: text('title'),
		content: text('content').notNull(),
		contentHash: text('content_hash').notNull(),
		indexedAt: text('indexed_at').notNull(),
		/** libSQL native F32_BLOB — embedding vector for DiskANN search. */
		embedding: blob('embedding'),
	},
	(table) => [
		index('idx_search_entity_type').on(table.entityType),
		index('idx_search_entity_id').on(table.entityId),
		uniqueIndex('uq_search_entity').on(table.entityType, table.entityId),
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

// ─── File Locks ─────────────────────────────────────────────────────────────

export const fileLocks = sqliteTable(
	'file_locks',
	{
		path: text('path').primaryKey(),
		locked_by: text('locked_by').notNull(),
		locked_at: integer('locked_at').notNull(),
		expires_at: integer('expires_at').notNull(),
	},
	(table) => [index('idx_file_locks_expires').on(table.expires_at)],
)

// ─── Pins ───────────────────────────────────────────────────────────────────

export const pins = sqliteTable(
	'pins',
	{
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
	},
	(table) => [
		index('idx_pins_group').on(table.group_id),
		index('idx_pins_type').on(table.type),
		index('idx_pins_expires').on(table.expires_at),
	],
)

// ─── Chunks (D25: paragraph-level embedding chunks) ───────────────────────

export const chunks = sqliteTable(
	'chunks',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		entityType: text('entity_type').notNull(),
		entityId: text('entity_id').notNull(),
		chunkIndex: integer('chunk_index').notNull(),
		content: text('content').notNull(),
		contentHash: text('content_hash').notNull(),
		metadata: text('metadata').default('{}'),
		indexedAt: text('indexed_at').notNull(),
		/** libSQL native F32_BLOB — embedding vector for DiskANN search. */
		embedding: blob('embedding'),
	},
	(table) => [
		index('idx_chunks_entity').on(table.entityType, table.entityId),
		index('idx_chunks_entity_chunk').on(table.entityType, table.entityId, table.chunkIndex),
		index('idx_chunks_hash').on(table.contentHash),
	],
)

// ─── Rate Limiting ──────────────────────────────────────────────────────────

// ─── Notifications ─────────────────────────────────────────────────────────

export const notifications = sqliteTable(
	'notifications',
	{
		id: text('id').primaryKey(),
		user_id: text('user_id').notNull(),
		type: text('type').notNull(),
		priority: text('priority').notNull(),
		title: text('title').notNull(),
		message: text('message'),
		url: text('url'),
		task_id: text('task_id'),
		agent_id: text('agent_id'),
		read_at: integer('read_at'),
		dismissed_at: integer('dismissed_at'),
		delivered_via: text('delivered_via'),
		created_at: integer('created_at').notNull(),
	},
	(table) => [
		index('idx_notifications_user').on(table.user_id, table.read_at, table.created_at),
		index('idx_notifications_type').on(table.type),
		index('idx_notifications_created').on(table.created_at),
	],
)

// ─── Push Subscriptions ────────────────────────────────────────────────────

export const pushSubscriptions = sqliteTable(
	'push_subscriptions',
	{
		id: text('id').primaryKey(),
		user_id: text('user_id').notNull(),
		endpoint: text('endpoint').notNull(),
		keys_p256dh: text('keys_p256dh').notNull(),
		keys_auth: text('keys_auth').notNull(),
		created_at: integer('created_at').notNull(),
	},
	(table) => [
		index('idx_push_subs_user').on(table.user_id),
		index('idx_push_subs_endpoint').on(table.endpoint),
	],
)

// ─── Notification Throttle ─────────────────────────────────────────────────

export const notificationThrottle = sqliteTable(
	'notification_throttle',
	{
		user_id: text('user_id').notNull(),
		type: text('type').notNull(),
		transport: text('transport').notNull(),
		last_sent_at: integer('last_sent_at').notNull(),
	},
	(table) => [index('idx_throttle_pk').on(table.user_id, table.type, table.transport)],
)

// ─── Rate Limiting ──────────────────────────────────────────────────────────

export const rateLimitEntries = sqliteTable(
	'rate_limit_entries',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		key: text('key').notNull(),
		window_start: integer('window_start').notNull(),
		count: integer('count').notNull().default(1),
		expires_at: integer('expires_at').notNull(),
	},
	(table) => [
		index('idx_rate_limit_key_window').on(table.key, table.window_start),
		index('idx_rate_limit_expires').on(table.expires_at),
	],
)

// ─── Message Reactions ────────────────────────────────────────────────────

export const messageReactions = sqliteTable(
	'message_reactions',
	{
		id: text('id').primaryKey(),
		message_id: text('message_id').notNull(),
		emoji: text('emoji').notNull(),
		user_id: text('user_id').notNull(),
		created_at: text('created_at').notNull(),
	},
	(table) => [
		index('idx_reactions_message').on(table.message_id),
		uniqueIndex('uq_reaction').on(table.message_id, table.emoji, table.user_id),
	],
)

// ─── Pinned Messages ──────────────────────────────────────────────────────

export const pinnedMessages = sqliteTable(
	'pinned_messages',
	{
		id: text('id').primaryKey(),
		channel_id: text('channel_id').notNull(),
		message_id: text('message_id').notNull(),
		pinned_by: text('pinned_by').notNull(),
		pinned_at: text('pinned_at').notNull(),
	},
	(table) => [index('idx_pinned_channel').on(table.channel_id)],
)

// ─── Bookmarks ────────────────────────────────────────────────────────────

export const bookmarks = sqliteTable(
	'bookmarks',
	{
		id: text('id').primaryKey(),
		user_id: text('user_id').notNull(),
		message_id: text('message_id').notNull(),
		channel_id: text('channel_id').notNull(),
		created_at: text('created_at').notNull(),
	},
	(table) => [index('idx_bookmarks_user').on(table.user_id)],
)
