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
  context: Record<string, unknown>
  metadata: Record<string, unknown>
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
  status: RunStatus
  instructions: string | null
  summary: string | null
  tokens_input: number
  tokens_output: number
  error: string | null
  started_at: string | null
  ended_at: string | null
  created_at: string
  resumable: boolean
  resumed_from_run_id: string | null
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
  metadata: Record<string, unknown>
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
  task_template: Record<string, unknown>
  mode: ScheduleMode
  query_template: Record<string, unknown>
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
  status: 'triggered' | 'completed' | 'skipped' | 'failed'
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
  metadata: Record<string, unknown>
  session_id: string | null
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

// ── Run Event ──
export interface RunEvent {
  id: string
  run_id: string
  type: string
  data: Record<string, unknown>
  created_at: string
}

// ── SSE Event ──
export type AutopilotEventType =
  | 'task_changed'
  | 'run_event'
  | 'run_completed'
  | 'worker_registered'
  | 'worker_offline'
  | 'heartbeat'

export interface AutopilotEvent {
  type: AutopilotEventType
  taskId?: string
  status?: string
  runId?: string
  eventType?: string
  summary?: string
  workerId?: string
  ts?: string
}

// ── View models for screens without backend API yet ──

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

export interface Playbook {
  id: string
  name: string
  description: string
  status: 'active' | 'draft' | 'disabled'
  trigger: 'scheduled' | 'manual' | 'on_demand'
  skill_id: string | null
  linked_schedule_ids: string[]
  resource_refs: string[]
  last_used_at: string | null
  usage_count: number
  success_rate: number
  created_at: string
}

export interface CompanyProfile {
  name: string
  description: string
  tone: string
  knowledge_files: Array<{ name: string; size: string; uri: string }>
}

// ── Workflow ──

export interface WorkflowStep {
  name: string
  type: 'trigger' | 'action' | 'condition'
}

export interface Workflow {
  id: string
  name: string
  steps: WorkflowStep[]
}

// ── Script ──

export interface Script {
  id: string
  name: string
  description: string
  runtime: 'bun' | 'node' | 'python3' | 'bash'
  entry_point: string
  inputs: Array<{ name: string; type: string; required: boolean }>
  outputs: Array<{ name: string; type: string }>
  linked_workflow_ids: string[]
  linked_task_ids: string[]
  last_run_at: string | null
  created_at: string
}

// ── Playbook step/execution (mock view models) ──

export interface PlaybookStep {
  name: string
  description: string
  type: 'gather' | 'execute' | 'review' | 'deliver'
}

export interface PlaybookExecution {
  date: string
  task_id: string
  status: 'completed' | 'failed'
  outcome: string
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

// ── File tree view model (composed from VFS list/stat, NOT a backend entity) ──
export type FileTreeNodeType = 'file' | 'directory' | 'worktree-root'
export type FileChangeKind = 'added' | 'modified' | 'deleted' | 'unchanged'

export interface FileTreeNode {
  path: string
  name: string
  type: FileTreeNodeType
  change: FileChangeKind
  size: number | null
  mime_type: string | null
  linked_task_id: string | null
  linked_run_id: string | null
  children?: FileTreeNode[]
}
