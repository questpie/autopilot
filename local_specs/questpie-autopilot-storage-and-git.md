# QUESTPIE Autopilot — Storage & Git Architecture

> SQLite hybrid storage + Company as Git Repo. Two foundational changes that unlock performance, queryability, and full version history.

---

## Table of Contents

1. [SPEC 1: SQLite Hybrid Storage](#spec-1-sqlite-hybrid-storage)
2. [SPEC 2: Company as Git Repo](#spec-2-company-as-git-repo)
3. [Security Audit Findings](#security-audit-findings)

---

## SPEC 1: SQLite Hybrid Storage

### 1.1 Motivácia

Aktuálna implementácia ukladá všetko ako YAML súbory:

- **Tasks** (`packages/orchestrator/src/fs/tasks.ts`): Každý task = 1 YAML súbor v `tasks/{status-folder}/{id}.yaml`. Listing vyžaduje `readdir` + parse každého súboru. Filtrovanie je sekvenčné.
- **Messages** (`packages/orchestrator/src/fs/messages.ts`): Každá správa = 1 YAML súbor v `comms/channels/{channel}/{id}.yaml`. Žiadny full-text search. Listing vyžaduje readdir.
- **Activity** (`packages/orchestrator/src/fs/activity.ts`): JSONL per deň v `logs/activity/{date}.jsonl`. Filtrovanie je in-memory parse celého súboru.

Problémy s YAML-only prístupom:
- **O(n) listing** — pri 1000 taskoch treba prečítať 1000 súborov
- **Žiadne indexy** — filter by status, agent, project = full scan
- **Žiadny full-text search** — hľadanie v messages = nemožné
- **Žiadne joins** — "tasks assigned to agent X with status Y in project Z" = custom kód
- **File contention** — concurrent writes na rovnaký task vyžadujú write queue (už implementované)
- **Git noise** — tisíce malých YAML súborov = šumné git history

### 1.2 Princíp rozdelenia

```
YAML (git-versioned, human-readable, agenti vidia priamo):
  company.yaml            → Company config
  team/agents.yaml        → Agent definitions
  team/humans.yaml        → Human users + roles
  team/roles.yaml         → Role definitions + permissions (NOVY!)
  team/workflows/*.yaml   → Workflow definitions
  team/schedules.yaml     → Cron schedules
  team/webhooks.yaml      → Webhook config
  skills/*/SKILL.md       → Agent skills
  knowledge/**/*.md       → Knowledge docs
  dashboard/**            → Dashboard customization

SQLite (rýchle queries, high-volume, operational):
  .data/tasks.db          → Tasks (CREATE TABLE tasks — id, title, status, ...)
  .data/messages.db       → Chat messages (full-text search)
  .data/activity.db       → Activity log (time-series queries)
  .data/sessions.db       → Agent session metadata

FS (binaries, large files):
  projects/               → Git repos, code, assets
  artifacts/              → React apps, HTML
  secrets/                → Encrypted files
  logs/sessions/*.jsonl   → Raw session streams (append-only)
```

**Kľúčový princíp:** YAML pre veci, ktoré agenti a ľudia čítajú/editujú priamo. SQLite pre operačné dáta s vysokým objemom a query nárokmi. FS pre veľké binárky a streamy.

### 1.3 Bun SQLite — Zero Dependencies

Bun má natívny `bun:sqlite` modul — žiadne externé dependencies. Podľa benchmarkov je 3-6x rýchlejší ako `better-sqlite3` a 8-9x rýchlejší ako Deno SQLite, pretože je integrovaný priamo do JavaScriptCore a vyhýba sa N-API overhead.

Zdroje:
- [SQLite - Bun Docs](https://bun.com/docs/runtime/sqlite)
- [bun:sqlite API Reference](https://bun.com/reference/bun/sqlite)
- [Bun 1.2 Deep Dive (SQLite, S3)](https://dev.to/pockit_tools/bun-12-deep-dive-built-in-sqlite-s3-and-why-it-might-actually-replace-nodejs-4738)
- [Bun SQLite benchmark discussion](https://github.com/WiseLibs/better-sqlite3/discussions/1057)

```typescript
import { Database } from 'bun:sqlite'

// Synchronous API — no async overhead
const db = new Database(join(companyRoot, '.data', 'tasks.db'))
db.exec('PRAGMA journal_mode = WAL')      // Write-Ahead Logging pre concurrent reads
db.exec('PRAGMA synchronous = NORMAL')     // Rýchlejšie writes, stále safe
db.exec('PRAGMA foreign_keys = ON')
```

WAL mode je kritický — umožňuje concurrent reads počas write operácií. Default `journal_mode = DELETE` blokuje reads pri writes.

### 1.4 Database Schemas

#### tasks.db

```sql
CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  type TEXT NOT NULL CHECK(type IN ('feature','bug','task','epic','spike','chore','question','design','content','ops')),
  status TEXT NOT NULL CHECK(status IN ('draft','backlog','assigned','in_progress','review','blocked','done','cancelled')),
  priority TEXT DEFAULT 'medium' CHECK(priority IN ('critical','high','medium','low')),

  created_by TEXT NOT NULL,
  assigned_to TEXT,
  reviewers TEXT DEFAULT '[]',     -- JSON array of strings
  approver TEXT,

  project TEXT,
  parent TEXT,
  depends_on TEXT DEFAULT '[]',    -- JSON array
  blocks TEXT DEFAULT '[]',        -- JSON array
  related TEXT DEFAULT '[]',       -- JSON array

  workflow TEXT,
  workflow_step TEXT,

  context TEXT DEFAULT '{}',       -- JSON object
  blockers TEXT DEFAULT '[]',      -- JSON array of blocker objects

  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  started_at TEXT,
  completed_at TEXT,
  deadline TEXT,

  history TEXT DEFAULT '[]',       -- JSON array of history entries

  _linear_id TEXT,
  _github_pr TEXT
);

-- Query patterns: list by status, filter by agent, workflow routing
CREATE INDEX idx_tasks_status ON tasks(status);
CREATE INDEX idx_tasks_assigned ON tasks(assigned_to);
CREATE INDEX idx_tasks_workflow ON tasks(workflow, workflow_step);
CREATE INDEX idx_tasks_project ON tasks(project);
CREATE INDEX idx_tasks_parent ON tasks(parent);
CREATE INDEX idx_tasks_created ON tasks(created_at);
CREATE INDEX idx_tasks_priority ON tasks(priority, status);
```

#### messages.db

```sql
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  channel TEXT,           -- NULL for DMs
  from_id TEXT NOT NULL,
  to_id TEXT,             -- NULL for channel messages
  content TEXT NOT NULL,
  created_at TEXT NOT NULL,
  mentions TEXT DEFAULT '[]',     -- JSON array
  references_ids TEXT DEFAULT '[]', -- JSON array (references is reserved)
  reactions TEXT DEFAULT '[]',    -- JSON array
  thread TEXT,                     -- parent message ID
  transport TEXT,
  external INTEGER DEFAULT 0      -- boolean
);

CREATE INDEX idx_messages_channel ON messages(channel);
CREATE INDEX idx_messages_from ON messages(from_id);
CREATE INDEX idx_messages_to ON messages(to_id);
CREATE INDEX idx_messages_thread ON messages(thread);
CREATE INDEX idx_messages_created ON messages(created_at);

-- Full-text search na message content
CREATE VIRTUAL TABLE messages_fts USING fts5(
  content,
  content=messages,
  content_rowid=rowid
);

-- Trigger na automatický FTS update
CREATE TRIGGER messages_ai AFTER INSERT ON messages BEGIN
  INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
END;
CREATE TRIGGER messages_ad AFTER DELETE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.rowid, old.content);
END;
CREATE TRIGGER messages_au AFTER UPDATE ON messages BEGIN
  INSERT INTO messages_fts(messages_fts, rowid, content) VALUES('delete', old.rowid, old.content);
  INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
END;
```

#### activity.db

```sql
CREATE TABLE activity (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  agent TEXT NOT NULL,
  type TEXT NOT NULL,
  summary TEXT NOT NULL,
  details TEXT,           -- JSON
  created_at TEXT NOT NULL
);

CREATE INDEX idx_activity_agent ON activity(agent);
CREATE INDEX idx_activity_type ON activity(type);
CREATE INDEX idx_activity_time ON activity(created_at);

-- Composite index pre typický query pattern: "čo robil agent X dnes"
CREATE INDEX idx_activity_agent_time ON activity(agent, created_at);
```

#### sessions.db

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  task_id TEXT,
  trigger_type TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'running' CHECK(status IN ('running','completed','failed','cancelled')),
  started_at TEXT NOT NULL,
  ended_at TEXT,
  tool_calls INTEGER DEFAULT 0,
  tokens_used INTEGER DEFAULT 0,
  error TEXT,
  log_path TEXT            -- path to JSONL session log
);

CREATE INDEX idx_sessions_agent ON sessions(agent_id);
CREATE INDEX idx_sessions_task ON sessions(task_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_sessions_started ON sessions(started_at);
```

### 1.5 Storage Backend Abstraction

```typescript
// packages/orchestrator/src/storage/backend.ts
import type { z } from 'zod'
import type { TaskSchema, MessageSchema } from '@questpie/autopilot-spec'

type Task = z.output<typeof TaskSchema>
type Message = z.output<typeof MessageSchema>

export interface TaskFilter {
  status?: string
  assigned_to?: string
  project?: string
  workflow?: string
  workflow_step?: string
  parent?: string
  priority?: string
  limit?: number
  offset?: number
  order_by?: 'created_at' | 'updated_at' | 'priority'
  order_dir?: 'asc' | 'desc'
}

export interface MessageFilter {
  channel?: string
  from_id?: string
  to_id?: string
  thread?: string
  limit?: number
  offset?: number
}

export interface ActivityEntry {
  at: string
  agent: string
  type: string
  summary: string
  details?: Record<string, unknown>
}

export interface ActivityFilter {
  agent?: string
  type?: string
  date?: string
  limit?: number
}

export interface StorageBackend {
  // Lifecycle
  initialize(): Promise<void>
  close(): Promise<void>

  // Tasks
  createTask(task: Task): Promise<Task>
  readTask(id: string): Promise<Task | null>
  updateTask(id: string, updates: Partial<Task>, updatedBy: string): Promise<Task>
  moveTask(id: string, newStatus: string, movedBy: string): Promise<Task>
  listTasks(filter?: TaskFilter): Promise<Task[]>
  countTasks(filter?: TaskFilter): Promise<number>
  deleteTask(id: string): Promise<void>

  // Messages
  sendMessage(msg: Message): Promise<Message>
  readMessages(filter: MessageFilter): Promise<Message[]>
  searchMessages(query: string, limit?: number): Promise<Message[]>

  // Activity
  appendActivity(entry: ActivityEntry): Promise<void>
  readActivity(filter?: ActivityFilter): Promise<ActivityEntry[]>
}
```

### 1.6 SQLite Backend Implementation

```typescript
// packages/orchestrator/src/storage/sqlite-backend.ts
import { Database } from 'bun:sqlite'
import { mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { TaskSchema, MessageSchema } from '@questpie/autopilot-spec'
import type { StorageBackend, TaskFilter, MessageFilter, ActivityEntry, ActivityFilter } from './backend'

export class SqliteBackend implements StorageBackend {
  private tasksDb!: Database
  private messagesDb!: Database
  private activityDb!: Database
  private sessionsDb!: Database

  constructor(private companyRoot: string) {}

  async initialize(): Promise<void> {
    const dataDir = join(this.companyRoot, '.data')
    await mkdir(dataDir, { recursive: true })

    this.tasksDb = this.openDb(join(dataDir, 'tasks.db'))
    this.messagesDb = this.openDb(join(dataDir, 'messages.db'))
    this.activityDb = this.openDb(join(dataDir, 'activity.db'))
    this.sessionsDb = this.openDb(join(dataDir, 'sessions.db'))

    this.runMigrations()
  }

  private openDb(path: string): Database {
    const db = new Database(path)
    db.exec('PRAGMA journal_mode = WAL')
    db.exec('PRAGMA synchronous = NORMAL')
    db.exec('PRAGMA foreign_keys = ON')
    db.exec('PRAGMA busy_timeout = 5000')
    return db
  }

  private runMigrations(): void {
    // Tasks
    this.tasksDb.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT DEFAULT '',
        type TEXT NOT NULL,
        status TEXT NOT NULL,
        priority TEXT DEFAULT 'medium',
        created_by TEXT NOT NULL,
        assigned_to TEXT,
        reviewers TEXT DEFAULT '[]',
        approver TEXT,
        project TEXT,
        parent TEXT,
        depends_on TEXT DEFAULT '[]',
        blocks TEXT DEFAULT '[]',
        related TEXT DEFAULT '[]',
        workflow TEXT,
        workflow_step TEXT,
        context TEXT DEFAULT '{}',
        blockers TEXT DEFAULT '[]',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        started_at TEXT,
        completed_at TEXT,
        deadline TEXT,
        history TEXT DEFAULT '[]',
        _linear_id TEXT,
        _github_pr TEXT
      )
    `)
    this.tasksDb.exec('CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status)')
    this.tasksDb.exec('CREATE INDEX IF NOT EXISTS idx_tasks_assigned ON tasks(assigned_to)')
    this.tasksDb.exec('CREATE INDEX IF NOT EXISTS idx_tasks_workflow ON tasks(workflow, workflow_step)')
    this.tasksDb.exec('CREATE INDEX IF NOT EXISTS idx_tasks_project ON tasks(project)')
    this.tasksDb.exec('CREATE INDEX IF NOT EXISTS idx_tasks_priority ON tasks(priority, status)')

    // Messages — schema + FTS + triggers
    this.messagesDb.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        channel TEXT,
        from_id TEXT NOT NULL,
        to_id TEXT,
        content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        mentions TEXT DEFAULT '[]',
        references_ids TEXT DEFAULT '[]',
        reactions TEXT DEFAULT '[]',
        thread TEXT,
        transport TEXT,
        external INTEGER DEFAULT 0
      )
    `)
    this.messagesDb.exec('CREATE INDEX IF NOT EXISTS idx_messages_channel ON messages(channel)')
    this.messagesDb.exec('CREATE INDEX IF NOT EXISTS idx_messages_from ON messages(from_id)')
    this.messagesDb.exec('CREATE INDEX IF NOT EXISTS idx_messages_created ON messages(created_at)')

    // FTS5 — check if exists before creating (virtual tables don't support IF NOT EXISTS)
    try {
      this.messagesDb.exec(`
        CREATE VIRTUAL TABLE messages_fts USING fts5(content, content=messages, content_rowid=rowid)
      `)
      this.messagesDb.exec(`
        CREATE TRIGGER messages_ai AFTER INSERT ON messages BEGIN
          INSERT INTO messages_fts(rowid, content) VALUES (new.rowid, new.content);
        END
      `)
    } catch {
      // Already exists
    }

    // Activity
    this.activityDb.exec(`
      CREATE TABLE IF NOT EXISTS activity (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        agent TEXT NOT NULL,
        type TEXT NOT NULL,
        summary TEXT NOT NULL,
        details TEXT,
        created_at TEXT NOT NULL
      )
    `)
    this.activityDb.exec('CREATE INDEX IF NOT EXISTS idx_activity_agent_time ON activity(agent, created_at)')
    this.activityDb.exec('CREATE INDEX IF NOT EXISTS idx_activity_type ON activity(type)')

    // Sessions
    this.sessionsDb.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        task_id TEXT,
        trigger_type TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'running',
        started_at TEXT NOT NULL,
        ended_at TEXT,
        tool_calls INTEGER DEFAULT 0,
        tokens_used INTEGER DEFAULT 0,
        error TEXT,
        log_path TEXT
      )
    `)
    this.sessionsDb.exec('CREATE INDEX IF NOT EXISTS idx_sessions_agent ON sessions(agent_id)')
    this.sessionsDb.exec('CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status)')
  }

  // ─── Tasks ──────────────────────────────────────────────────────────

  async createTask(task: z.output<typeof TaskSchema>): Promise<z.output<typeof TaskSchema>> {
    const stmt = this.tasksDb.prepare(`
      INSERT INTO tasks (
        id, title, description, type, status, priority,
        created_by, assigned_to, reviewers, approver,
        project, parent, depends_on, blocks, related,
        workflow, workflow_step, context, blockers,
        created_at, updated_at, started_at, completed_at, deadline,
        history, _linear_id, _github_pr
      ) VALUES (
        $id, $title, $description, $type, $status, $priority,
        $created_by, $assigned_to, $reviewers, $approver,
        $project, $parent, $depends_on, $blocks, $related,
        $workflow, $workflow_step, $context, $blockers,
        $created_at, $updated_at, $started_at, $completed_at, $deadline,
        $history, $_linear_id, $_github_pr
      )
    `)

    stmt.run({
      $id: task.id,
      $title: task.title,
      $description: task.description,
      $type: task.type,
      $status: task.status,
      $priority: task.priority,
      $created_by: task.created_by,
      $assigned_to: task.assigned_to ?? null,
      $reviewers: JSON.stringify(task.reviewers),
      $approver: task.approver ?? null,
      $project: task.project ?? null,
      $parent: task.parent ?? null,
      $depends_on: JSON.stringify(task.depends_on),
      $blocks: JSON.stringify(task.blocks),
      $related: JSON.stringify(task.related),
      $workflow: task.workflow ?? null,
      $workflow_step: task.workflow_step ?? null,
      $context: JSON.stringify(task.context),
      $blockers: JSON.stringify(task.blockers),
      $created_at: task.created_at,
      $updated_at: task.updated_at,
      $started_at: task.started_at ?? null,
      $completed_at: task.completed_at ?? null,
      $deadline: task.deadline ?? null,
      $history: JSON.stringify(task.history),
      $_linear_id: task._linear_id ?? null,
      $_github_pr: task._github_pr ?? null,
    })

    return task
  }

  async readTask(id: string): Promise<z.output<typeof TaskSchema> | null> {
    const row = this.tasksDb.prepare('SELECT * FROM tasks WHERE id = ?').get(id) as Record<string, unknown> | null
    if (!row) return null
    return this.rowToTask(row)
  }

  async listTasks(filter?: TaskFilter): Promise<z.output<typeof TaskSchema>[]> {
    const conditions: string[] = []
    const params: Record<string, unknown> = {}

    if (filter?.status) {
      conditions.push('status = $status')
      params.$status = filter.status
    }
    if (filter?.assigned_to) {
      conditions.push('assigned_to = $assigned_to')
      params.$assigned_to = filter.assigned_to
    }
    if (filter?.project) {
      conditions.push('project = $project')
      params.$project = filter.project
    }
    if (filter?.workflow) {
      conditions.push('workflow = $workflow')
      params.$workflow = filter.workflow
    }
    if (filter?.parent) {
      conditions.push('parent = $parent')
      params.$parent = filter.parent
    }
    if (filter?.priority) {
      conditions.push('priority = $priority')
      params.$priority = filter.priority
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const orderBy = filter?.order_by ?? 'created_at'
    const orderDir = filter?.order_dir ?? 'desc'
    const limit = filter?.limit ?? 1000
    const offset = filter?.offset ?? 0

    const sql = `SELECT * FROM tasks ${where} ORDER BY ${orderBy} ${orderDir} LIMIT ${limit} OFFSET ${offset}`
    const rows = this.tasksDb.prepare(sql).all(params) as Record<string, unknown>[]
    return rows.map(row => this.rowToTask(row))
  }

  async countTasks(filter?: TaskFilter): Promise<number> {
    const conditions: string[] = []
    const params: Record<string, unknown> = {}

    if (filter?.status) { conditions.push('status = $status'); params.$status = filter.status }
    if (filter?.assigned_to) { conditions.push('assigned_to = $assigned_to'); params.$assigned_to = filter.assigned_to }
    if (filter?.project) { conditions.push('project = $project'); params.$project = filter.project }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''
    const result = this.tasksDb.prepare(`SELECT COUNT(*) as count FROM tasks ${where}`).get(params) as { count: number }
    return result.count
  }

  // ─── Messages ───────────────────────────────────────────────────────

  async searchMessages(query: string, limit = 50): Promise<z.output<typeof MessageSchema>[]> {
    const rows = this.messagesDb.prepare(`
      SELECT m.* FROM messages m
      JOIN messages_fts fts ON m.rowid = fts.rowid
      WHERE messages_fts MATCH $query
      ORDER BY rank
      LIMIT $limit
    `).all({ $query: query, $limit: limit }) as Record<string, unknown>[]

    return rows.map(row => this.rowToMessage(row))
  }

  // ─── Helper: row → typed object ─────────────────────────────────────

  private rowToTask(row: Record<string, unknown>): z.output<typeof TaskSchema> {
    return TaskSchema.parse({
      ...row,
      reviewers: JSON.parse(row.reviewers as string),
      depends_on: JSON.parse(row.depends_on as string),
      blocks: JSON.parse(row.blocks as string),
      related: JSON.parse(row.related as string),
      context: JSON.parse(row.context as string),
      blockers: JSON.parse(row.blockers as string),
      history: JSON.parse(row.history as string),
    })
  }

  private rowToMessage(row: Record<string, unknown>): z.output<typeof MessageSchema> {
    return MessageSchema.parse({
      id: row.id,
      from: row.from_id,
      to: row.to_id,
      channel: row.channel,
      at: row.created_at,
      content: row.content,
      mentions: JSON.parse((row.mentions as string) ?? '[]'),
      references: JSON.parse((row.references_ids as string) ?? '[]'),
      reactions: JSON.parse((row.reactions as string) ?? '[]'),
      thread: row.thread,
      transport: row.transport,
      external: row.external === 1,
    })
  }

  async close(): Promise<void> {
    this.tasksDb.close()
    this.messagesDb.close()
    this.activityDb.close()
    this.sessionsDb.close()
  }
}
```

### 1.7 YAML Backend (Existujúce správanie)

```typescript
// packages/orchestrator/src/storage/yaml-backend.ts
import type { StorageBackend } from './backend'
import * as tasks from '../fs/tasks'
import * as messages from '../fs/messages'
import * as activity from '../fs/activity'

/**
 * Wraps the existing YAML-based file operations behind StorageBackend.
 * Zero changes to existing behavior — this is just an adapter.
 */
export class YamlFsBackend implements StorageBackend {
  constructor(private companyRoot: string) {}

  async initialize(): Promise<void> {
    // No-op — directories already exist from template
  }

  async close(): Promise<void> {
    // No-op — no connections to close
  }

  async createTask(task: Task): Promise<Task> {
    return tasks.createTask(this.companyRoot, task)
  }

  async readTask(id: string): Promise<Task | null> {
    return tasks.readTask(this.companyRoot, id)
  }

  async listTasks(filter?: TaskFilter): Promise<Task[]> {
    return tasks.listTasks(this.companyRoot, {
      status: filter?.status,
      agent: filter?.assigned_to,
      project: filter?.project,
    })
  }

  async searchMessages(_query: string): Promise<Message[]> {
    // YAML backend nepoddporuje full-text search
    console.warn('[yaml-backend] searchMessages not supported — use sqlite backend')
    return []
  }

  // ... remaining methods delegate to existing fs/ functions
}
```

### 1.8 Storage Factory

```typescript
// packages/orchestrator/src/storage/index.ts
import type { StorageBackend } from './backend'
import { SqliteBackend } from './sqlite-backend'
import { YamlFsBackend } from './yaml-backend'

export type StorageMode = 'yaml' | 'sqlite'

/**
 * Create the appropriate storage backend based on company config.
 *
 * Reads `settings.storage` from company.yaml:
 *   - "yaml"   → existing YAML file-based storage (default)
 *   - "sqlite" → SQLite databases in .data/
 */
export async function createStorage(
  companyRoot: string,
  mode: StorageMode = 'yaml',
): Promise<StorageBackend> {
  const backend = mode === 'sqlite'
    ? new SqliteBackend(companyRoot)
    : new YamlFsBackend(companyRoot)

  await backend.initialize()
  return backend
}

export { StorageBackend } from './backend'
```

### 1.9 company.yaml rozšírenie

```yaml
# company.yaml
settings:
  storage: yaml              # "yaml" (default) alebo "sqlite"
  # ... existing settings
```

### 1.10 MCP prístup na SQLite

Agenti **nikdy** nepristupujú priamo k SQL. Všetky operácie idú cez existujúce MCP tools (`create_task`, `update_task`, `list_tasks`, `send_message`, atd.), ktoré interne volajú `StorageBackend`.

Pre debug a admin:

```bash
# CLI: raw SQL query (owner/admin only)
autopilot query "SELECT id, title, status FROM tasks WHERE status = 'blocked'"

# CLI: task count by status
autopilot query "SELECT status, COUNT(*) as count FROM tasks GROUP BY status"
```

Dashboard: SQL explorer v Settings page — read-only queries na `.data/*.db`.

```typescript
// packages/orchestrator/src/api/routes/query.ts
// POST /api/query — requires admin/owner role
export async function handleQuery(
  body: { sql: string; db: 'tasks' | 'messages' | 'activity' | 'sessions' },
  actor: Actor,
  storage: StorageBackend,
): Promise<Response> {
  // Only allow SELECT statements
  const normalized = body.sql.trim().toUpperCase()
  if (!normalized.startsWith('SELECT')) {
    return errorResponse('Only SELECT queries allowed', 400)
  }

  // Requires admin/owner
  if (!['owner', 'admin'].includes(actor.role)) {
    return errorResponse('Forbidden — requires admin role', 403)
  }

  // Execute against appropriate DB
  // ... returns JSON rows
}
```

### 1.11 Migračný plán

| Verzia | Storage | Poznámka |
|--------|---------|----------|
| v1.0 | YAML only | Existujúce správanie, nič sa nemení |
| v1.1 | SQLite opt-in | `storage: sqlite` v company.yaml, YAML stále default |
| v2.0 | SQLite default | YAML stále podporované pre simple setups |
| v3.0 | YAML deprecated | Warning pri `storage: yaml` |

Migračný tool:

```bash
autopilot migrate yaml-to-sqlite
# Scans tasks/, comms/, logs/activity/
# Inserts all data into .data/*.db
# Validates counts match
# Updates company.yaml: storage: sqlite
# Does NOT delete YAML files (user can do manually)

autopilot migrate sqlite-to-yaml
# Reverse migration (for debugging/export)
```

```typescript
// packages/cli/src/commands/migrate.ts
import { Database } from 'bun:sqlite'
import { readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { readYaml } from '../../../orchestrator/src/fs/yaml'
import { TaskSchema, MessageSchema } from '@questpie/autopilot-spec'

async function migrateYamlToSqlite(companyRoot: string): Promise<void> {
  const backend = new SqliteBackend(companyRoot)
  await backend.initialize()

  // 1. Migrate tasks
  const taskDirs = ['backlog', 'active', 'review', 'blocked', 'done']
  let taskCount = 0
  for (const dir of taskDirs) {
    const dirPath = join(companyRoot, 'tasks', dir)
    try {
      const files = await readdir(dirPath)
      for (const file of files) {
        if (!file.endsWith('.yaml')) continue
        const task = await readYaml(join(dirPath, file), TaskSchema)
        await backend.createTask(task)
        taskCount++
      }
    } catch { /* dir doesn't exist */ }
  }
  console.log(`Migrated ${taskCount} tasks`)

  // 2. Migrate messages (channels + DMs)
  // ... similar pattern

  // 3. Migrate activity (JSONL → SQLite)
  // ... parse each .jsonl, insert rows

  // 4. Update company.yaml
  // ... set storage: sqlite

  console.log('Migration complete.')
}
```

### 1.12 Performance porovnanie

| Operácia | YAML (1000 tasks) | SQLite (1000 tasks) | Zlepšenie |
|----------|-------------------|---------------------|-----------|
| List all tasks | ~800ms (readdir + 1000 file reads + YAML parse) | ~2ms (single query) | ~400x |
| Filter by status | ~800ms (read all, filter in-memory) | ~1ms (indexed query) | ~800x |
| Search messages | Not supported | ~5ms (FTS5) | N/A → instant |
| Count tasks | ~800ms (read all) | ~0.5ms (COUNT) | ~1600x |
| Single task read | ~3ms (findTask scans 5 dirs) | ~0.1ms (primary key) | ~30x |
| Create task | ~5ms (write YAML) | ~0.5ms (INSERT) | ~10x |

---

## SPEC 2: Company as Git Repo

### 2.1 Motivácia

Company directory = git repository. Každá zmena v konfigurácii, knowledge, a workflow súboroch je automaticky commitnutá. To poskytuje:

- **Úplnú históriu** — kto, kedy, čo zmenil
- **Rollback** — `git revert` pre akúkoľvek zmenu
- **Branching** — experimentovanie s workflow/config bez rizika
- **Collaboration** — remote repo, code review na config zmeny
- **Cloud sync** — remote = záloha + multi-device

Zdroje a inšpirácie:
- [GitOps pattern](https://about.gitlab.com/topics/gitops/) — Git as single source of truth
- [Infrastructure as Code repo patterns](https://www.abhishek-tiwari.com/infrastructure-as-code/)
- [simple-git npm package](https://www.npmjs.com/package/simple-git) — TypeScript git operations
- [Git as database limitations](https://nesbitt.io/2025/12/24/package-managers-keep-using-git-as-a-database.html)

Dôležité: nepoužívame git ako databázu (preto máme SQLite pre high-volume data). Git verzionuje len konfigurčné a knowledge súbory — YAML, Markdown, static files.

### 2.2 Init Flow

```bash
autopilot init my-company
  → mkdir my-company
  → copy template (solo-dev-shop)
  → git init
  → git add -A
  → git commit -m "chore: initial company setup via autopilot init"
```

Zmena v `packages/cli/src/commands/init.ts`:

```typescript
import simpleGit from 'simple-git'

// ... po cp(templateDir, targetDir) a company.yaml update:

// Initialize git repo
const git = simpleGit(targetDir)
await git.init()

// Create .gitignore
const gitignore = `
# Auth & sessions (ephemeral, not versioned)
.auth/auth.db
.auth/auth.db-wal
.auth/auth.db-shm

# SQLite operational databases
.data/
.data/*.db
.data/*.db-wal
.data/*.db-shm

# Secrets (encryption key MUST NOT be in git)
secrets/.master-key

# Dependencies
node_modules/

# Build artifacts
.turbo/

# Session streams (too large, append-only)
logs/sessions/*.jsonl

# OS files
.DS_Store
Thumbs.db
`.trim()
await writeFile(join(targetDir, '.gitignore'), gitignore, 'utf-8')

// Initial commit
await git.add('-A')
await git.commit('chore: initial company setup via autopilot init')

console.log(success('Git repository initialized'))
console.log(dim('All changes will be auto-committed by the orchestrator'))
```

### 2.3 GitManager — Auto-Commit s Batch Queue

```typescript
// packages/orchestrator/src/git/manager.ts
import simpleGit, { type SimpleGit } from 'simple-git'

interface CommitEntry {
  files: string[]
  message: string
  author?: { name: string; email: string }
}

export interface GitManagerOptions {
  companyRoot: string
  enabled: boolean
  batchIntervalMs: number   // default 5000
  autoPush: boolean         // default false
  remote: string            // default ''
  branch: string            // default 'main'
}

export class GitManager {
  private git: SimpleGit
  private commitQueue: CommitEntry[] = []
  private commitTimer: Timer | null = null
  private options: GitManagerOptions
  private isGitRepo = false

  constructor(options: GitManagerOptions) {
    this.options = options
    this.git = simpleGit(options.companyRoot)
  }

  /** Check if company directory is a git repo. */
  async initialize(): Promise<void> {
    if (!this.options.enabled) {
      console.log('[git] auto-commit disabled')
      return
    }
    try {
      await this.git.status()
      this.isGitRepo = true
      console.log('[git] initialized — auto-commit enabled')
    } catch {
      this.isGitRepo = false
      console.warn('[git] company directory is not a git repo — auto-commit disabled')
      console.warn('[git] run "git init" in company directory to enable')
    }
  }

  /**
   * Queue a commit. Commits are batched per `batchIntervalMs` (default 5s).
   * Multiple changes within the interval are combined into a single commit.
   */
  async queueCommit(
    files: string[],
    message: string,
    author?: { name: string; email: string },
  ): Promise<void> {
    if (!this.isGitRepo || !this.options.enabled) return

    this.commitQueue.push({ files, message, author })

    if (!this.commitTimer) {
      this.commitTimer = setTimeout(() => this.flushCommits(), this.options.batchIntervalMs)
    }
  }

  /** Immediately flush all queued commits. Called on graceful shutdown. */
  async flush(): Promise<void> {
    if (this.commitTimer) {
      clearTimeout(this.commitTimer)
      this.commitTimer = null
    }
    await this.flushCommits()
  }

  private async flushCommits(): Promise<void> {
    const batch = [...this.commitQueue]
    this.commitQueue = []
    this.commitTimer = null

    if (batch.length === 0) return

    try {
      // Dedupe files
      const allFiles = [...new Set(batch.flatMap(b => b.files))]

      // Build commit message
      let message: string
      if (batch.length === 1) {
        message = batch[0]!.message
      } else {
        message = `batch: ${batch.map(b => b.message).join(', ')}`
      }

      // Determine author — use first entry's author, fallback to system
      const author = batch[0]?.author ?? {
        name: 'Autopilot',
        email: 'system@autopilot.local',
      }

      // Stage only changed files (not -A to avoid unintended files)
      for (const file of allFiles) {
        try {
          await this.git.add(file)
        } catch {
          // File might have been deleted — try git rm
          try {
            await this.git.rm(file)
          } catch {
            // File doesn't exist in git either — skip
          }
        }
      }

      // Check if there's anything staged
      const status = await this.git.status()
      if (status.staged.length === 0) return

      // Commit
      await this.git.commit(message, undefined, {
        '--author': `${author.name} <${author.email}>`,
      })

      console.log(`[git] committed: ${message} (${allFiles.length} files)`)

      // Auto-push if configured
      if (this.options.autoPush && this.options.remote) {
        try {
          await this.git.push(this.options.remote, this.options.branch)
          console.log(`[git] pushed to ${this.options.remote}/${this.options.branch}`)
        } catch (err) {
          console.error('[git] push failed:', err instanceof Error ? err.message : err)
        }
      }
    } catch (err) {
      console.error('[git] commit failed:', err instanceof Error ? err.message : err)
      // Re-queue failed items? No — log and move on. User can commit manually.
    }
  }

  /** Stop the timer and flush remaining commits. */
  async stop(): Promise<void> {
    await this.flush()
  }
}
```

### 2.4 Commit Convention

| Udalosť | Commit message | Príklad |
|---------|----------------|---------|
| Task created | `task: create {id} — {title}` | `task: create task-040 — Landing page` |
| Task status change | `task: {id} {old} → {new}` | `task: task-040 assigned → in_progress` |
| Task updated | `task: update {id} — {fields}` | `task: update task-040 — priority, deadline` |
| Agent writes file | `agent({id}): write {path}` | `agent(sam): write projects/studio/specs/landing.md` |
| Human approve | `human: approve {id}` | `human: approve task-040` |
| Config change | `config: update {file}` | `config: update team/agents.yaml` |
| Knowledge update | `knowledge: update {path}` | `knowledge: update technical/conventions.md` |
| Workflow change | `workflow: update {name}` | `workflow: update development` |
| Schedule change | `schedule: update {id}` | `schedule: update daily-standup` |
| Dashboard change | `dashboard: {action}` | `dashboard: update widgets` |
| Role/permission change | `team: update {file}` | `team: update roles.yaml` |
| Skill created/updated | `skill: update {name}` | `skill: update code-review` |

### 2.5 Commit Author

```
Agent commits:   Author: "Sam <sam@autopilot.local>"
Human commits:   Author: "Dominik <dominik@questpie.com>"  (z humans.yaml email)
System commits:  Author: "Autopilot <system@autopilot.local>"
```

Resolve autora z Actor:

```typescript
// packages/orchestrator/src/git/author.ts
import type { Actor } from '../auth/actor'

export function resolveGitAuthor(actor?: Actor): { name: string; email: string } {
  if (!actor) {
    return { name: 'Autopilot', email: 'system@autopilot.local' }
  }

  switch (actor.type) {
    case 'human':
      return { name: actor.name, email: `${actor.id}@autopilot.local` }
    case 'agent':
      return { name: actor.name, email: `${actor.id}@autopilot.local` }
    default:
      return { name: 'Autopilot', email: 'system@autopilot.local' }
  }
}
```

### 2.6 .gitignore

```gitignore
# Auth & sessions (ephemeral, not versioned)
.auth/auth.db
.auth/auth.db-wal
.auth/auth.db-shm

# SQLite operational databases (high-volume, not versioned)
.data/
.data/*.db
.data/*.db-wal
.data/*.db-shm

# Secrets (encryption key MUST NOT be in git)
secrets/.master-key

# Dependencies
node_modules/

# Build artifacts
.turbo/
dashboard/dist/

# Session streams (too large, append-only)
logs/sessions/*.jsonl

# OS files
.DS_Store
Thumbs.db
```

Čo **je** git-tracked:

| Súbor/dir | Prečo |
|-----------|-------|
| `company.yaml` | Company config — history dôležitá |
| `team/agents.yaml` | Agent definitions — kto kedy pridal/zmenil agenta |
| `team/humans.yaml` | Human users — audit trail |
| `team/roles.yaml` | Role definitions — security audit |
| `team/workflows/*.yaml` | Workflow versions — rollback |
| `team/schedules.yaml` | Schedule changes |
| `team/webhooks.yaml` | Webhook config |
| `skills/*/SKILL.md` | Agent skills — versioning |
| `knowledge/**/*.md` | Knowledge docs — history |
| `dashboard/*.yaml` | Dashboard config |
| `.auth/providers.yaml` | OAuth provider config (no secrets) |
| `.auth/invites.yaml` | Invite records (no tokens) |
| `secrets/*.yaml.enc` | Encrypted secrets — safe in git |

### 2.7 Integrácia s Orchestrátorom

```typescript
// packages/orchestrator/src/server.ts — zmeny

import { GitManager } from './git/manager'

export class Orchestrator {
  private gitManager: GitManager | null = null
  // ... existing fields

  async start(): Promise<void> {
    // ... existing startup steps 1-5

    // 6. Initialize GitManager
    const company = await loadCompany(root)
    const gitConfig = company.settings?.git ?? {}

    this.gitManager = new GitManager({
      companyRoot: root,
      enabled: gitConfig.auto_commit !== false,  // default true
      batchIntervalMs: gitConfig.commit_batch_interval ?? 5000,
      autoPush: gitConfig.auto_push ?? false,
      remote: gitConfig.remote ?? '',
      branch: gitConfig.branch ?? 'main',
    })
    await this.gitManager.initialize()

    // ... existing startup scan
  }

  async stop(): Promise<void> {
    // Flush git commits before shutdown
    if (this.gitManager) {
      await this.gitManager.flush()
    }
    // ... existing shutdown
  }

  // Hook into existing handleWatchEvent:
  private async handleWatchEvent(event: WatchEvent): Promise<void> {
    try {
      switch (event.type) {
        case 'task_changed':
          await this.handleTaskChange(event.taskId)
          // Git commit for YAML-only mode (SQLite changes don't touch FS)
          if (this.gitManager && this.storageMode === 'yaml') {
            await this.gitManager.queueCommit(
              [event.path],
              `task: update ${event.taskId}`,
            )
          }
          break
        case 'config_changed':
          await this.gitManager?.queueCommit(
            [event.path],
            `config: update ${event.file}`,
          )
          break
        case 'dashboard_changed':
          await this.gitManager?.queueCommit(
            [event.path],
            `dashboard: update ${event.file}`,
          )
          break
        // ... other event types
      }
    } catch (err) {
      console.error(`[orchestrator] error handling watch event:`, err)
    }
  }
}
```

### 2.8 company.yaml git konfigurácia

```yaml
# company.yaml
settings:
  storage: sqlite              # "yaml" | "sqlite"

  git:
    auto_commit: true           # default true — automaticky commituje zmeny
    auto_push: false            # default false — user rozhodne
    remote: ""                  # empty = no remote
    branch: main               # default branch
    commit_batch_interval: 5000 # ms — batch commits together
```

### 2.9 Remote Setup (voliteľné)

```bash
# Manuálne (štandard)
cd my-company
git remote add origin git@github.com:myorg/my-company.git

# Alebo cez company.yaml
# settings.git.remote: "git@github.com:myorg/my-company.git"
# settings.git.auto_push: true

# Alebo cez CLI
autopilot config set git.remote "git@github.com:myorg/my-company.git"
autopilot config set git.auto_push true
```

### 2.10 CLI Git Commands

```bash
autopilot git log                 # git log --oneline -20
autopilot git diff                # git diff HEAD
autopilot git status              # git status
autopilot git push                # git push origin main
autopilot git branch create X     # git checkout -b X
autopilot git branch merge X      # git merge X into current
autopilot git branch list         # git branch -a
autopilot git rollback <commit>   # git revert <commit>
```

```typescript
// packages/cli/src/commands/git.ts
import { Command } from 'commander'
import simpleGit from 'simple-git'
import { program } from '../program'

const gitCmd = new Command('git').description('Git operations on company directory')

gitCmd.addCommand(
  new Command('log')
    .option('-n <count>', 'Number of commits', '20')
    .action(async (opts) => {
      const git = simpleGit(process.cwd())
      const log = await git.log({ maxCount: parseInt(opts.n) })
      for (const entry of log.all) {
        const date = entry.date.split('T')[0]
        const author = entry.author_name.padEnd(12)
        console.log(`${entry.hash.slice(0, 7)} ${date} ${author} ${entry.message}`)
      }
    }),
)

gitCmd.addCommand(
  new Command('status').action(async () => {
    const git = simpleGit(process.cwd())
    const status = await git.status()
    console.log(`Branch: ${status.current}`)
    console.log(`Modified: ${status.modified.length}`)
    console.log(`Staged: ${status.staged.length}`)
    console.log(`Untracked: ${status.not_added.length}`)
    if (status.modified.length > 0) {
      console.log('\nModified files:')
      for (const f of status.modified) console.log(`  M ${f}`)
    }
    if (status.not_added.length > 0) {
      console.log('\nUntracked files:')
      for (const f of status.not_added) console.log(`  ? ${f}`)
    }
  }),
)

gitCmd.addCommand(
  new Command('push').action(async () => {
    const git = simpleGit(process.cwd())
    const status = await git.status()
    if (!status.tracking) {
      console.error('No remote tracking branch set. Run: git remote add origin <url>')
      process.exit(1)
    }
    await git.push()
    console.log(`Pushed to ${status.tracking}`)
  }),
)

program.addCommand(gitCmd)
```

### 2.11 Branching — Experimentálne Zmeny

```bash
# Experimentálny workflow
autopilot git branch create experiment/new-workflow
  → git checkout -b experiment/new-workflow
  → agenti pracujú na novom branchi
  → testy, validácia

autopilot git branch merge experiment/new-workflow
  → git checkout main
  → git merge experiment/new-workflow
  → pokračuj na main
```

Use cases:
- Testovanie nového workflow pred production
- Testovanie zmeny v agent konfigurácii
- A/B test rôznych prompt stratégií
- Rollback celej série zmien

### 2.12 Cloud Verzia (QUESTPIE Cloud)

Pre QUESTPIE Cloud v budúcnosti:

```
+────────────────────────────────────────────────+
│  QUESTPIE Cloud                                │
│                                                │
│  cloud.questpie.com/{slug}/                    │
│  ├── Dashboard (web UI)                        │
│  ├── Git server (Gitea/Gitness)                │
│  │   └── {slug}.git  ← company git repo        │
│  ├── Orchestrator (managed)                    │
│  └── API (managed)                             │
│                                                │
│  Features:                                     │
│  ├── Auto-provisioned git remote               │
│  ├── Web-based git history viewer              │
│  ├── Fork company = git fork                   │
│  ├── Branch = experiment bez rizika            │
│  └── Automatic backup via remote               │
+────────────────────────────────────────────────+
```

Onboarding flow:
1. User sign up na cloud.questpie.com
2. `autopilot init --cloud` → vytvorí company + nastaví remote automaticky
3. `settings.git.remote` a `settings.git.auto_push` sa nastavia automaticky
4. Každá zmena sa auto-pushne na cloud git server

### 2.13 Dependencies

```json
{
  "dependencies": {
    "simple-git": "^3.27.0"
  }
}
```

`simple-git` je lightweight wrapper nad natívnym `git` CLI:
- Full TypeScript support s bundled type definitions
- Chaining API aj Promise API
- [GitHub: steveukx/git-js](https://github.com/steveukx/git-js)
- [npm: simple-git](https://www.npmjs.com/package/simple-git)

Alternatíva: priame `Bun.spawn(['git', ...args])` — ale `simple-git` dáva lepšie error handling a typed output.

### 2.14 Implementation Plan

| Phase | Čo | Priorita |
|-------|-----|----------|
| Phase 1 | `git init` v `autopilot init` + `.gitignore` | P0 — jednoduchý, veľká hodnota |
| Phase 2 | `GitManager` s batch commits v orchestrátore | P0 — core feature |
| Phase 3 | CLI `autopilot git *` commands | P1 — convenience |
| Phase 4 | Branch/merge support | P2 — advanced usage |
| Phase 5 | Cloud git server integration | P3 — cloud-only |

---

## Integrácia oboch SPEC-ov

### Ako SQLite a Git spolupracujú

```
                    ┌──────────────────────────────┐
                    │        Orchestrator           │
                    │                               │
  YAML change ────→ │  ┌─────────┐  ┌───────────┐  │
  (config, knowledge)│  │ Watcher │→│GitManager │→│ git commit
                    │  └─────────┘  └───────────┘  │
                    │                               │
  API call ───────→ │  ┌────────────────┐           │
  (task, message)   │  │StorageBackend  │           │
                    │  │  ├── SQLite ───┤→ .data/   │ ← NOT git-tracked
                    │  │  └── YAML  ────┤→ tasks/   │ ← git-tracked (yaml mode)
                    │  └────────────────┘           │
                    └──────────────────────────────┘
```

- **SQLite mode**: Tasks/messages/activity idú do `.data/*.db` (nie v gite). YAML config files sú v gite.
- **YAML mode**: Tasks/messages idú do YAML súborov (v gite cez GitManager). Ale výkon je horšie.
- **Config/Knowledge/Skills**: Vždy YAML/MD, vždy git-tracked, nezávisle od storage mode.

### .data/ adresár

```
.data/
├── tasks.db          # Task data (SQLite mode)
├── tasks.db-wal      # Write-Ahead Log
├── tasks.db-shm      # Shared memory
├── messages.db       # Messages + FTS
├── activity.db       # Activity log
└── sessions.db       # Agent sessions
```

Celý `.data/` je v `.gitignore`. SQLite databázy sú operačné dáta — nie konfigurácia. Backup je cez:
- SQLite backup API (`sqlite3_backup`)
- `autopilot backup` command (dump to SQL alebo JSON)
- Regulárny system backup

---

## Security Audit Findings

> Nálezy z validácie security spec (`questpie-autopilot-security.md`). Tieto body treba adresovať v aktualizovanej security spec.

### PROBLÉMY

1. **Roly hardcoded v TS, nie YAML** — `humanRoles` objekt v `auth/index.ts` (riadky 112-158) definuje owner/admin/member/viewer permissions ako TypeScript konštanty. Treba `team/roles.yaml` aby boli konfigurovateľné a git-verzionované. Agent permission presets (`agentPermissionPresets`, riadky 163-189) rovnako.

2. **User-role assignments v Better Auth SQLite, nie v humans.yaml** — Keď user dostane rolu cez invite flow, uloží sa to v `.auth/auth.db` (Better Auth organization membership). Ale `team/humans.yaml` o tom nevie. Treba synchronizácia alebo jasné rozhodnutie čo je source of truth.

3. **Agent keys cez Better Auth system user** — `ensureAgentKeys` (riadky 846-892) vytvorí "system user" v Better Auth a generuje API keys pod ním. To je zbytočne komplexné. Agenti nie sú Better Auth users — generovať keys priamo (`crypto.randomBytes`), uložiť do `.auth/agent-keys.yaml` (encrypted).

4. **CEO agent vidí `.auth/` a `secrets/.master-key`** — V `agents.yaml` má CEO agent `fs_scope.read: ["/**"]`. To zahŕňa `.auth/auth.db`, `secrets/.master-key`, a všetky encrypted secrets. Treba explicitný deny pattern:
   ```yaml
   fs_scope:
     read: ["/**"]
     deny: [".auth/**", "secrets/.master-key"]
   ```

5. **Chýba `auth: false` mode pre lokálny dev** — Security spec hovorí "Auth je vždy zapnuté" (princíp, riadok 13). Ale pre lokálny single-user dev je auth overhead zbytočný. Treba `settings.auth: false` mode kde všetky requesty dostanú owner Actor automaticky.

6. **MCP `allowUnauthenticatedClientRegistration: true`** — V `createAuth` (riadok 223) je povolená neautentifikovaná registrácia OAuth klientov. To znamená že ktokoľvek s prístupom na API port sa môže zaregistrovať ako MCP klient. Nastaviť na `false`, vyžadovať admin approval.

7. **Master key plaintext v FS** — `secrets/.master-key` je 32-byte key uložený ako base64 v plain text súbore (riadky 1046-1051). Ak agent alebo útočník získa read prístup, všetky secrets sú kompromitované. Odporúčanie: environment variable `AUTOPILOT_MASTER_KEY` alebo hardcoded deny v agent scope.

8. **Invites nerozhodnuté (DB vs YAML)** — Kód v riadku 813 hovorí "Invites sa ukladajú v Better Auth DB... alebo v .auth/invites.yaml — jednoduchšie pre v1". Rozhodnutie: **YAML** (`.auth/invites.yaml`) — git-tracked, auditovateľné, jednoduché.

### VAROVANIA

1. **API key vs JWT priority conflict v `resolveActor`** — Funkcia `resolveActor` (riadky 298-366) najprv skúsi Bearer token (session), potom API key, potom MCP JWT. Ale Bearer token z API key header (`x-api-key`) a Bearer token zo session (`Authorization: Bearer ...`) sa môžu prekrývať. Riadky 323-326 extrahovujú bearer token aj z `Authorization` header — čo ak je to session token, nie API key?

2. **Permission mapping nemapuje všetky HTTP methods** — `getRequiredPermission` (riadky 547-571) nemapuje `PATCH` method pre tasks (riadok 557 — fallback na `update`). Nemapuje `PUT` pre knowledge. `DELETE` na `/api/team/:userId` nemá explicitný mapping.

3. **Audit log nie je chránený proti tampering** — Ops agent má `fs_scope.write: ["/logs/**"]` (agents.yaml riadok 53). To znamená že ops agent môže prepisovať audit logy. Audit logy by mali byť append-only a chránené proti write prístupu agentov.

4. **6-char invite code je krátky** — `generateInviteCode()` generuje 3-byte hex = 6 znakov = 16.7M kombinácií (riadky 809-811). Pre brute force s rate limiting je to dostatočné, ale pre extra bezpečnosť odporúčame 12-char (6 bytes) alebo UUID.

5. **CEO agent `read: ["/**"]` vidí `.auth/`** — Opakuje problém #4, ale z iného uhla. Aj keď CEO agent nemá zlý úmysel, v jeho context window sa môžu objaviť citlivé dáta (auth.db obsah, master key). Hardcoded deny je nutný.

6. **Webhook auth nie je adresovaný v auth middleware** — `getRequiredPermission` (riadok 566) nemá mapping pre webhook incoming requests (`/webhook/*`). Webhooky majú vlastný secret-based auth (HMAC), ale nie sú integrované do unified actor modelu.

7. **Session naming collision** — "Session" znamená aj Better Auth user session (30-day browser session) aj agent session (jedno spustenie agenta, `SessionStreamManager`). V kóde a docs sa to zmieša. Premenovať agent session na "agent run" alebo "execution".

### ODPORÚČANIA

1. **`team/roles.yaml` do template** + `RolesFileSchema` do `packages/spec/src/schemas/`:
   ```yaml
   # team/roles.yaml
   human_roles:
     owner:
       tasks: [create, read, update, approve, reject, delete]
       agents: [read, configure, spawn]
       secrets: [read, create, delete]
       # ... all permissions
     admin:
       tasks: [create, read, update, approve, reject]
       # ...
     member:
       tasks: [create, read, update]
       # ...
     viewer:
       tasks: [read]
       # ...

   agent_presets:
     standard:
       tasks: [create, read, update]
       knowledge: [read, write]
       chat: [read, write]
     orchestrator:
       tasks: [create, read, update, approve, reject]
       agents: [read, configure, spawn]
       # ...
     readonly:
       tasks: [read]
       knowledge: [read]
   ```

2. **`HUMAN_ROLES` constant do `spec/constants.ts`**:
   ```typescript
   export const HUMAN_ROLES = ['owner', 'admin', 'member', 'viewer'] as const
   export type HumanRole = (typeof HUMAN_ROLES)[number]
   ```

3. **Explicitné deny pre `.auth/` a `secrets/.master-key`** — Implementovať `deny` field v `fs_scope`:
   ```typescript
   // V scope check:
   const HARDCODED_DENY = ['.auth/**', 'secrets/.master-key']
   if (actor.type === 'agent') {
     for (const pattern of HARDCODED_DENY) {
       if (matchGlob([pattern], resourcePath)) return false
     }
   }
   ```

4. **Rate limiting na auth endpoints** — Better Auth `rateLimit` plugin:
   ```typescript
   import { rateLimit } from 'better-auth/plugins'
   plugins: [
     rateLimit({
       window: 60,     // 60 seconds
       max: 10,        // 10 attempts
       // Per IP, not per user (auth attempts are pre-auth)
     }),
   ]
   ```

5. **Token rotation pre agent API keys** — Agent keys by sa mali automaticky rotovať každých 30 dní. `ensureAgentKeys` by mal kontrolovať `created_at` a regenerovať staré keys.

6. **Master key backup mechanizmus** — Ak sa master key stratí, všetky secrets sú permanentne stratené. Treba:
   - `autopilot secrets export-master-key` (zobrazi key, user si ho uloží)
   - `autopilot secrets import-master-key <key>` (restore)
   - Alebo env variable `AUTOPILOT_MASTER_KEY` ako primárny zdroj

7. **Webhook exemption v auth middleware** — Webhook endpointy (`/webhook/*`) nemajú bearer token — autentifikujú sa cez HMAC signature. Treba explicitný bypass v auth middleware s vlastnou verifikáciou:
   ```typescript
   if (path.startsWith('/webhook/')) {
     const verified = await verifyWebhookSignature(request, webhook)
     if (!verified) return errorResponse('Invalid webhook signature', 401)
     // Create synthetic Actor for audit
     actor = { id: `webhook-${webhookId}`, type: 'api', role: 'agent', ... }
   }
   ```

8. **Jasne definovať čo z `.auth/` je git-tracked**:
   | Súbor | Git-tracked | Prečo |
   |-------|-------------|-------|
   | `.auth/auth.db` | NIE | Sessions, tokens — ephemeral |
   | `.auth/agent-keys.yaml` | NIE | Contains hashed keys |
   | `.auth/providers.yaml` | ANO | OAuth provider config (no secrets) |
   | `.auth/invites.yaml` | ANO | Invite records (codes expired, audit) |
   | `.auth/oauth-clients/` | NIE | Dynamic MCP registrations |

---

*Naposledy aktualizované: 2026-03-23*
