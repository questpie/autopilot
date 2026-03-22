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

// Dynamic paths
export const taskPath = (status: string, id: string) =>
	`${PATHS.TASKS_DIR}/${status}/${id}.yaml`

export const agentMemoryPath = (agentId: string) => `${PATHS.MEMORY_DIR}/${agentId}`

export const sessionPath = (agentId: string, sessionId: string) =>
	`${PATHS.SESSIONS_DIR}/${agentId}/${sessionId}`

export const channelPath = (channel: string) => `${PATHS.CHANNELS_DIR}/${channel}`

export const projectPath = (project: string) => `${PATHS.PROJECTS_DIR}/${project}`

export const workflowPath = (id: string) => `${PATHS.WORKFLOWS_DIR}/${id}.yaml`

export const secretPath = (name: string) => `${PATHS.SECRETS_DIR}/${name}.yaml`

export const pinPath = (id: string) => `${PATHS.PINS_DIR}/${id}.yaml`
