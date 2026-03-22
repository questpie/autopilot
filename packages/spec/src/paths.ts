/**
 * Canonical filesystem paths for all autopilot configuration and data files.
 * All paths are relative to the project root.
 */
export const PATHS = {
	// Root
	COMPANY_CONFIG: '/company/company.yaml',

	// Team
	AGENTS: '/company/team/agents.yaml',
	HUMANS: '/company/team/humans.yaml',
	WORKFLOWS_DIR: '/company/team/workflows',
	SCHEDULES: '/company/team/schedules.yaml',
	WEBHOOKS: '/company/team/webhooks.yaml',
	WATCHERS: '/company/team/watchers.yaml',
	THRESHOLDS: '/company/team/thresholds.yaml',
	TRANSPORTS: '/company/team/transports.yaml',
	AGENT_TRANSPORTS: '/company/team/agent-transports.yaml',
	APPROVAL_GATES: '/company/team/policies/approval-gates.yaml',
	INFO_SHARING: '/company/team/policies/information-sharing.yaml',

	// Tasks
	TASKS_DIR: '/company/tasks',
	TASKS_SCHEMA: '/company/tasks/_schema.yaml',
	TASKS_BACKLOG: '/company/tasks/backlog',
	TASKS_ACTIVE: '/company/tasks/active',
	TASKS_REVIEW: '/company/tasks/review',
	TASKS_BLOCKED: '/company/tasks/blocked',
	TASKS_DONE: '/company/tasks/done',

	// Comms
	COMMS_DIR: '/company/comms',
	CHANNELS_DIR: '/company/comms/channels',
	DIRECT_DIR: '/company/comms/direct',

	// Knowledge
	KNOWLEDGE_DIR: '/company/knowledge',

	// Projects
	PROJECTS_DIR: '/company/projects',

	// Infra
	INFRA_DIR: '/company/infra',

	// Context
	MEMORY_DIR: '/company/context/memory',
	INDEXES_DIR: '/company/context/indexes',
	SNAPSHOTS_DIR: '/company/context/snapshots',

	// Secrets
	SECRETS_DIR: '/company/secrets',

	// Dashboard
	DASHBOARD_DIR: '/company/dashboard',
	PINS_DIR: '/company/dashboard/pins',
	DASHBOARD_GROUPS: '/company/dashboard/groups.yaml',

	// Logs
	LOGS_DIR: '/company/logs',
	ACTIVITY_DIR: '/company/logs/activity',
	SESSIONS_DIR: '/company/logs/sessions',
	ERRORS_DIR: '/company/logs/errors',
	WEBHOOKS_LOG_DIR: '/company/logs/webhooks',
	DECISIONS_DIR: '/company/logs/decisions',
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
