/** Available roles that an agent can be assigned in the autopilot system. */
export const AGENT_ROLES = [
	'meta',
	'strategist',
	'planner',
	'developer',
	'reviewer',
	'devops',
	'marketing',
	'design',
] as const

/** Lifecycle statuses a task can transition through. */
export const TASK_STATUSES = [
	'draft',
	'backlog',
	'assigned',
	'in_progress',
	'review',
	'blocked',
	'done',
	'cancelled',
] as const

/** Classification of task purpose within a workflow. */
export const TASK_TYPES = [
	'intent',
	'planning',
	'implementation',
	'review',
	'deployment',
	'marketing',
	'monitoring',
	'human_required',
] as const

/** Priority levels ordered from most to least urgent. */
export const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const

/** Types of steps that can appear in a workflow definition. */
export const WORKFLOW_STEP_TYPES = ['agent', 'human_gate', 'terminal', 'sub_workflow'] as const

/** Events that can trigger an agent to execute. */
export const TRIGGER_TYPES = [
	'task_assigned',
	'task_status_changed',
	'mention',
	'message_received',
	'schedule',
	'webhook',
	'file_changed',
	'threshold',
	'human_action',
	'agent_request',
] as const

/** Supported message transport channels. */
export const TRANSPORT_TYPES = [
	'email',
	'whatsapp',
	'slack',
	'telegram',
	'discord',
	'web_push',
	'cli',
] as const

/** Visual indicator types for dashboard pins. */
export const PIN_TYPES = ['info', 'warning', 'success', 'error', 'progress'] as const

/** Lifecycle statuses of an agent session. */
export const SESSION_STATUSES = [
	'spawning',
	'running',
	'tool_call',
	'idle',
	'completed',
	'failed',
	'timeout',
] as const

/** Categories of actions that require human approval. */
export const GATE_TYPES = [
	'merge',
	'deploy',
	'publish',
	'spend',
	'setup',
	'incident',
	'review',
] as const
