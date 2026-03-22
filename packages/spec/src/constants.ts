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

export const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const

export const WORKFLOW_STEP_TYPES = ['agent', 'human_gate', 'terminal', 'sub_workflow'] as const

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

export const TRANSPORT_TYPES = [
	'email',
	'whatsapp',
	'slack',
	'telegram',
	'discord',
	'web_push',
	'cli',
] as const

export const PIN_TYPES = ['info', 'warning', 'success', 'error', 'progress'] as const

export const SESSION_STATUSES = [
	'spawning',
	'running',
	'tool_call',
	'idle',
	'completed',
	'failed',
	'timeout',
] as const

export const GATE_TYPES = [
	'merge',
	'deploy',
	'publish',
	'spend',
	'setup',
	'incident',
	'review',
] as const
