/**
 * Canonical filesystem paths for all autopilot configuration and data files.
 * All paths are relative to the project root.
 */
export const PATHS = {
	// Root
	COMPANY_CONFIG: '/company.yaml',

	// Team
	AGENTS: '/team/agents.yaml',
	HUMANS: '/team/humans.yaml',
	WORKFLOWS_DIR: '/team/workflows',
	SCHEDULES: '/team/schedules.yaml',
	WEBHOOKS: '/team/webhooks.yaml',
	WATCHERS: '/team/watchers.yaml',
	THRESHOLDS: '/team/thresholds.yaml',
	TRANSPORTS: '/team/transports.yaml',
	AGENT_TRANSPORTS: '/team/agent-transports.yaml',
	APPROVAL_GATES: '/team/policies/approval-gates.yaml',
	INFO_SHARING: '/team/policies/information-sharing.yaml',

	// Tasks
	TASKS_DIR: '/tasks',
	TASKS_SCHEMA: '/tasks/_schema.yaml',
	TASKS_BACKLOG: '/tasks/backlog',
	TASKS_ACTIVE: '/tasks/active',
	TASKS_REVIEW: '/tasks/review',
	TASKS_BLOCKED: '/tasks/blocked',
	TASKS_DONE: '/tasks/done',

	// Comms
	COMMS_DIR: '/comms',
	CHANNELS_DIR: '/comms/channels',
	DIRECT_DIR: '/comms/direct',

	// Knowledge
	KNOWLEDGE_DIR: '/knowledge',

	// Projects
	PROJECTS_DIR: '/projects',

	// Infra
	INFRA_DIR: '/infra',

	// Context
	MEMORY_DIR: '/context/memory',
	INDEXES_DIR: '/context/indexes',
	SNAPSHOTS_DIR: '/context/snapshots',

	// Secrets
	SECRETS_DIR: '/secrets',

	// Dashboard
	DASHBOARD_DIR: '/dashboard',
	PINS_DIR: '/dashboard/pins',
	DASHBOARD_GROUPS: '/dashboard/groups.yaml',

	// Logs
	LOGS_DIR: '/logs',
	ACTIVITY_DIR: '/logs/activity',
	SESSIONS_DIR: '/logs/sessions',
	ERRORS_DIR: '/logs/errors',
	WEBHOOKS_LOG_DIR: '/logs/webhooks',
	DECISIONS_DIR: '/logs/decisions',
} as const

/**
 * Returns the filesystem path for a task YAML file.
 * @param status - Task status directory (e.g. 'backlog', 'active')
 * @param id - Unique task identifier
 */
export const taskPath = (status: string, id: string) =>
	`${PATHS.TASKS_DIR}/${status}/${id}.yaml`

/**
 * Returns the directory path for an agent's persistent memory.
 * @param agentId - Unique agent identifier
 */
export const agentMemoryPath = (agentId: string) => `${PATHS.MEMORY_DIR}/${agentId}`

/**
 * Returns the directory path for a specific agent session.
 * @param agentId - Unique agent identifier
 * @param sessionId - Unique session identifier
 */
export const sessionPath = (agentId: string, sessionId: string) =>
	`${PATHS.SESSIONS_DIR}/${agentId}/${sessionId}`

/**
 * Returns the directory path for a communication channel.
 * @param channel - Channel name or identifier
 */
export const channelPath = (channel: string) => `${PATHS.CHANNELS_DIR}/${channel}`

/**
 * Returns the directory path for a project.
 * @param project - Project name or identifier
 */
export const projectPath = (project: string) => `${PATHS.PROJECTS_DIR}/${project}`

/**
 * Returns the filesystem path for a workflow YAML file.
 * @param id - Unique workflow identifier
 */
export const workflowPath = (id: string) => `${PATHS.WORKFLOWS_DIR}/${id}.yaml`

/**
 * Returns the filesystem path for a secret YAML file.
 * @param name - Secret name
 */
export const secretPath = (name: string) => `${PATHS.SECRETS_DIR}/${name}.yaml`

/**
 * Returns the filesystem path for a dashboard pin YAML file.
 * @param id - Unique pin identifier
 */
export const pinPath = (id: string) => `${PATHS.PINS_DIR}/${id}.yaml`
