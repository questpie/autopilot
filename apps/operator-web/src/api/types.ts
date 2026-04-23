/**
 * API contract types for operator-web.
 *
 * These mirror the backend API response shapes from packages/orchestrator.
 * They are NOT auto-generated from Drizzle schemas — they are manually
 * maintained API contracts. When the backend changes, these must be updated.
 *
 * View models (TaskWithRelations, RunWithArtifacts, etc.) are UI-only
 * compositions — the backend never returns these directly.
 */

// ── Task ──
export interface Task {
  id: string
  title: string
  description: string
  type: string
  status: string
  priority: 'low' | 'medium' | 'high'
  assigned_to: string | null
  workflow_id: string | null
  workflow_step: string | null
  // Runtime DB fields — JSON strings stored as text
  context: string
  metadata: string
  queue: string | null
  start_after: string | null
  scheduled_by: string | null
  created_by: string
  created_at: string
  updated_at: string
}

// ── Run ──
export type RunStatus = 'pending' | 'claimed' | 'running' | 'completed' | 'failed'

export interface Run {
  id: string
  agent_id: string
  task_id: string | null
  worker_id: string | null
  runtime: string
  model: string | null
  provider: string | null
  variant: string | null
  status: RunStatus
  initiated_by: string | null
  instructions: string | null
  summary: string | null
  tokens_input: number
  tokens_output: number
  error: string | null
  started_at: string | null
  ended_at: string | null
  created_at: string
  runtime_session_ref: string | null
  resumed_from_run_id: string | null
  preferred_worker_id: string | null
  resumable: boolean
}

// ── Artifact ──
export type ArtifactKind =
  | 'changed_file'
  | 'diff_summary'
  | 'test_report'
  | 'doc'
  | 'external_receipt'
  | 'preview_file'
  | 'preview_url'
  | 'implementation_prompt'
  | 'validation_report'
  | 'other'

export type ArtifactRefKind = 'file' | 'url' | 'inline' | 'base64'

export interface Artifact {
  id: string
  run_id: string
  task_id: string | null
  kind: ArtifactKind
  title: string
  ref_kind: ArtifactRefKind
  ref_value: string
  mime_type: string | null
  // Runtime DB field — JSON string stored as text
  metadata: string
  blob_id: string | null
  created_at: string
}

// ── Schedule ──
export type ScheduleMode = 'task' | 'query'
export type ConcurrencyPolicy = 'skip' | 'allow' | 'queue'

export interface Schedule {
  id: string
  name: string
  description: string | null
  cron: string
  timezone: string
  agent_id: string
  workflow_id: string | null
  // Runtime DB fields — JSON strings stored as text
  task_template: string
  mode: ScheduleMode
  query_template: string
  concurrency_policy: ConcurrencyPolicy
  enabled: boolean
  last_run_at: string | null
  next_run_at: string | null
  created_by: string | null
  created_at: string
  updated_at: string
}

export interface ScheduleExecution {
  id: string
  schedule_id: string
  task_id: string | null
  query_id: string | null
  status: 'triggered' | 'completed' | 'skipped' | 'failed' | 'queued'
  skip_reason: string | null
  error: string | null
  triggered_at: string
  created_at: string
}

// ── Query ──
export type QueryStatus = 'pending' | 'running' | 'completed' | 'failed'

export interface Query {
  id: string
  prompt: string
  agent_id: string
  run_id: string | null
  status: QueryStatus
  allow_repo_mutation: boolean
  mutated_repo: boolean
  summary: string | null
  created_by: string
  created_at: string
  ended_at: string | null
  // Runtime DB field — JSON string stored as text
  metadata: string
  session_id: string | null
  promoted_task_id: string | null
}

// ── Session ──
// Mirrors packages/spec/src/schemas/session.ts — SessionRowSchema + SessionMessageRowSchema
export type SessionMode = 'query' | 'task_thread'
export type SessionStatus = 'active' | 'closed'

export interface Session {
  id: string
  provider_id: string
  external_conversation_id: string
  external_thread_id: string | null
  mode: SessionMode
  task_id: string | null
  status: SessionStatus
  created_at: string
  updated_at: string
  // Runtime DB field — JSON string stored as text
  metadata: string
  runtime_session_ref: string | null
  preferred_worker_id: string | null
}

// ── Session Message ──
export type SessionMessageRole = 'user' | 'assistant' | 'system'

export interface ChatAttachment {
  type: 'text' | 'file' | 'ref' | string
  name?: string
  url?: string
  content?: string
  mimeType?: string
  size?: number
  source?: 'upload' | 'paste' | 'drag' | 'page' | string
  label?: string
  refType?: 'task' | 'file' | 'directory' | 'session' | 'run' | 'artifact' | 'page' | string
  refId?: string
  metadata?: Record<string, unknown>
}

export interface SessionMessage {
  id: string
  session_id: string
  role: SessionMessageRole
  content: string
  query_id: string | null
  external_message_id: string | null
  // Runtime DB field — JSON string stored as text
  metadata: string
  attachments?: ChatAttachment[] | null
  created_at: string
}

export interface UserPreference {
  user_id: string
  key: string
  value: unknown
  created_at: string
  updated_at: string
}

// ── Worker ──
export type WorkerStatus = 'online' | 'busy' | 'offline'

export interface Worker {
  id: string
  name: string | null
  status: WorkerStatus
  capabilities: WorkerCapability[]
  registered_at: string
  last_heartbeat: string | null
}

export interface WorkerCapability {
  runtime: string
  models: string[]
  maxConcurrent: number
  tags: string[]
}

// ── Agent (config-driven, from GET /api/config/agents) ──
// Mirrors packages/spec/src/schemas/agent.ts — AgentSchema
export interface Agent {
  id: string
  name: string
  role: string
  description: string
  model: string | null
  provider: string | null
  variant: string | null
  capability_profiles: string[]
}

// ── Run Event (persisted row) ──
export interface RunEvent {
  id: number
  run_id: string
  type: string
  summary: string | null
  // Runtime DB field — JSON string stored as text
  metadata: string
  created_at: string
}

// ── SSE Event ──
// Mirrors packages/orchestrator/src/events/event-bus.ts — AutopilotEvent
export type AutopilotEvent =
  | { type: 'task_changed'; taskId: string; status: string }
  | { type: 'task_created'; taskId: string; title: string }
  | { type: 'run_started'; runId: string; agentId: string }
  | { type: 'run_event'; runId: string; eventType: string; summary: string }
  | { type: 'run_completed'; runId: string; status: string }
  | { type: 'worker_registered'; workerId: string }
  | { type: 'worker_offline'; workerId: string }
  | { type: 'task_relation_created'; sourceTaskId: string; targetTaskId: string; relationType: string }
  | { type: 'settings_changed' }
  | { type: 'heartbeat'; ts: string }

// ── Worker Event ──
// Mirrors packages/spec/src/schemas/worker-event.ts — WorkerEventSchema
export type WorkerEventType =
  | 'started'
  | 'progress'
  | 'tool_use'
  | 'thinking'
  | 'artifact'
  | 'message_sent'
  | 'task_updated'
  | 'approval_needed'
  | 'error'
  | 'completed'
  | 'external_action'

export interface WorkerEvent {
  type: WorkerEventType
  summary: string
  metadata?: Record<string, unknown>
}

// ── View models for screens without backend API yet ──

/**
 * FE projection over Provider — no canonical spec schema exists for this type.
 * This is a UI-only convenience model derived from provider connection state.
 */
export interface Integration {
  id: string
  provider: string
  name: string
  icon: string
  status: 'connected' | 'needs_action' | 'disconnected' | 'error'
  last_sync_at: string | null
  config: Record<string, unknown>
  created_at: string
}

// ── Workflow ──
// Mirrors packages/spec/src/schemas/workflow.ts — WorkflowSchema + WorkflowStepSchema

export type WorkflowStepType = 'agent' | 'human_approval' | 'wait_for_children' | 'done'

export interface WorkflowStep {
  id: string
  name: string | null
  type: WorkflowStepType
  /** The agent that executes this step. Required for 'agent' steps. */
  agent_id: string | null
  /** Instructions passed to the agent run. */
  instructions: string | null
  /** Who can approve. Only meaningful for 'human_approval' steps. */
  approvers: string[]
  /** External actions to execute after the step's run completes. */
  actions: Array<Record<string, unknown>>
}

export interface Workflow {
  id: string
  name: string
  description: string
  workspace?: { mode: 'none' | 'isolated_worktree' }
  steps: WorkflowStep[]
}

// ── Script ──
// Mirrors packages/spec/src/schemas/script.ts — StandaloneScriptSchema

export type ScriptRunner = 'bun' | 'node' | 'python3' | 'bash' | 'exec'
export type ScriptInputType = 'string' | 'number' | 'boolean' | 'json'

export interface Script {
  id: string
  name: string
  description: string
  entry_point: string
  runner: ScriptRunner
  inputs: Array<{ name: string; description: string; type: ScriptInputType; required: boolean }>
  outputs: Array<{ name: string; description: string; type: ScriptInputType }>
  sandbox: {
    fs_scope: { read: string[]; write: string[] }
    network: 'none' | 'local' | 'unrestricted'
    timeout_ms: number
  }
  env?: Record<string, string>
  secret_env?: Record<string, string>
  tags: string[]
}

// ── Activity (from GET /api/tasks/:id/activity) ──
export interface ActivityEntry {
  id: number
  actor: string
  type: string
  summary: string
  details: string | null
  created_at: string
}

// ── Workflow advance result (from approve/reject/reply endpoints) ──
export interface AdvanceResult {
  task: Task
  runId: string | null
  actions: string[]
}

// ── Task Relations ──
export interface TaskRelation {
  id: string
  source_task_id: string
  target_task_id: string
  relation_type: string
  dedupe_key: string | null
  origin_run_id: string | null
  created_by: string
  created_at: string
  metadata: string
}

// ── View Models (derived for UI, NOT in backend) ──

export interface TaskWithRelations extends Task {
  parents: Task[]
  children: Task[]
  dependencies: Task[]
  dependents: Task[]
  runs: Run[]
}

export interface RunWithArtifacts extends Run {
  artifacts: Artifact[]
}

export interface ScheduleWithHistory extends Schedule {
  history: ScheduleExecution[]
}

// ── VFS (from packages/spec/src/schemas/vfs.ts) ──

export interface VfsStatResult {
  uri: string
  type: 'file' | 'directory'
  size: number
  mime_type: string | null
  writable: boolean
  etag: string | null
}

export interface VfsListEntry {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  mime_type?: string | null
}

export interface VfsListResult {
  uri: string
  entries: VfsListEntry[]
}

export interface VfsDiffFile {
  path: string
  status: string
  diff: string
}

export interface VfsDiffResult {
  uri: string
  base: string
  head: string
  files: VfsDiffFile[]
  stats: {
    files_changed: number
    insertions: number
    deletions: number
  }
}
