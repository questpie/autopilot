/** Available roles for human users in the autopilot system. */
export const HUMAN_ROLES = ['owner', 'admin', 'member', 'viewer'] as const

/** Available roles that an agent can be assigned. */
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
export const TASK_STATUSES = ['backlog', 'active', 'review', 'blocked', 'done'] as const

/** Priority levels ordered from most to least urgent. */
export const PRIORITIES = ['critical', 'high', 'medium', 'low'] as const
