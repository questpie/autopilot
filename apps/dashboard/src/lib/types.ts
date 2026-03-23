export type TaskStatus = 'backlog' | 'assigned' | 'in_progress' | 'review' | 'blocked' | 'done'

export interface TaskResource {
	type: 'file' | 'pin' | 'channel' | 'url' | 'task'
	path: string
	label?: string
}

export interface Task {
	id: string
	title: string
	description?: string
	status: TaskStatus
	priority?: 'low' | 'medium' | 'high' | 'critical'
	assigned_to?: string
	created_by?: string
	workflow?: string
	workflow_step?: string
	project?: string
	milestone?: string
	parent?: string
	depends_on?: string[]
	blocks?: string[]
	related?: string[]
	resources?: TaskResource[]
	labels?: string[]
	branch?: string
	pr?: string
	deadline?: string
	blockers?: Blocker[]
	history?: HistoryEntry[]
	context?: Record<string, string>
	created_at?: string
	updated_at?: string
	started_at?: string
	completed_at?: string
}

export interface Blocker {
	reason: string
	assigned_to?: string
	created_at?: string
}

export interface HistoryEntry {
	at: string
	by: string
	action: string
	note?: string
	from?: string
	to?: string
}

export interface Agent {
	id: string
	name: string
	role: string
	description?: string
	model?: string
	tools?: string[]
	fs_scope?: { read?: string[]; write?: string[] }
	status?: 'active' | 'idle' | 'scheduled' | 'offline'
	current_task?: string
	sessions_today?: number
	tool_calls_today?: number
	next_scheduled?: string
	memory?: {
		facts?: number
		decisions?: number
		patterns?: number
		learnings?: number
	}
}

export interface Pin {
	id: string
	type: string
	title: string
	content?: string
	group?: string
	created_by?: string
	created_at?: string
	metadata?: {
		actions?: PinAction[]
		progress?: number
		expires_at?: string
		task_id?: string
	}
}

export interface PinAction {
	label: string
	url?: string
	action?: string
}

export interface ActivityEntry {
	agent: string
	type: string
	summary: string
	at: string
	details?: {
		sessionId?: string
		tool?: string
		message?: string
		priority?: string
		agentId?: string
		taskId?: string
		[key: string]: unknown
	}
}

export interface ChatMessage {
	id: string
	timestamp: string
	sender: string
	sender_role?: string
	content: string
	channel: string
	type: 'human' | 'agent' | 'system'
	routed_to?: string
	route_reason?: string
}

export interface ChannelInfo {
	id: string
	name: string
	type: 'channel' | 'direct'
	unread?: number
}

export interface OrchestratorStatus {
	company: string
	agentCount: number
	activeTasks: number
	runningSessions: number
	pendingApprovals?: number
	unreadMessages?: number
}

export interface DirectoryEntry {
	name: string
	type: 'file' | 'directory'
	path: string
}

export interface InboxData {
	tasks: Task[]
	pins: Pin[]
}

export interface Artifact {
	id: string
	name: string
	serve: string
	type?: string
	status: 'running' | 'stopped' | 'starting'
	port?: number
	created_by?: string
	task_id?: string
}

export interface DashboardGroup {
	id: string
	title: string
	position: number
	layout?: 'stack' | 'grid' | 'tabs'
	columns?: number
}

export interface DashboardGroups {
	groups: DashboardGroup[]
}

export interface Skill {
	id: string
	name: string
	description?: string
	roles?: string[]
	format?: string
}

export interface RoleConfig {
	role: string
	permissions: string[]
}
