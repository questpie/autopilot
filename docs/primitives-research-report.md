# Autopilot Primitives — Research Report

> Generated 2026-04-08. Research pass across actual codebase — no aspirational claims.

---

## Table of Contents

1. [Docs Map](#1-docs-map)
2. [Primitive Index](#2-primitive-index)
3. [Cleanup Recommendations](#3-cleanup-recommendations)
4. [Demo-Safe Summary](#4-demo-safe-summary)

---

## 1. Docs Map

Proposed structure for `docs/autopilot/primitives/`:

```
docs/autopilot/primitives/
  company-project-scope.md      # Company/project YAML, scope resolution, merge rules
  query.md                      # Lightweight non-task work, query lifecycle
  session.md                    # Conversation state tracking, session_messages, resume
  conversation-binding.md       # Task ↔ external chat thread link
  conversation-command.md       # Slash commands from surfaces → task creation
  task-work-order.md            # Task lifecycle, statuses, metadata
  workflow.md                   # Workflow steps, transitions, retry, output contracts
  workspace.md                  # Git worktree isolation, merge, cleanup
  run.md                        # Run lifecycle, claiming, completion, continuation, run_events (worker-posted, persisted)
  worker.md                     # Worker polling, capabilities, leases, heartbeat
  artifact-preview.md           # Artifact kinds, refs, preview serving
  provider-handler.md           # Provider YAML, handler scripts, envelope contract
  runtime-sdk.md                # Handler SDK helpers, runtime execution, stdin/stdout protocol (PARTIAL — not packaged)
  actions-scripts.md            # Post-run webhook/script actions, script runners
  packs.md                      # Pack manifests, git registries, lockfile, materialization
  context-capabilities.md       # Capability profiles, context injection, MCP, prompts
  schedules.md                  # Cron schedules, daemon, execution history
  notifications.md              # Event-driven outbound, provider routing, payload schema
  remote-sync.md                # Worker enrollment + VPS deployment (ACTIVE); config sync is manual git/CI (PARTIAL)
  bootstrap-setup.md            # Bootstrap command, scaffolding, starter workflows

docs/autopilot/primitives/addendum/
  auth-identity-roles.md        # Better Auth, RBAC, actor model, API keys
  enrollment-join-tokens.md     # Join token lifecycle, machine credentials
  shared-secrets.md             # AES-256-GCM encrypted secrets, scope-based delivery
  environments.md               # Named environments (PARTIAL — schema only)
  queues.md                     # Named concurrency queues, priority ordering
  task-graph.md                 # Relations, dependencies, cycle detection, wait-for-children
  run-steering.md               # Mid-run guidance, steer claim/delivery
  activity-audit.md             # DB activity table, task-scoped approval/rejection/reply audit
  search-indexer.md             # ACTIVE: index.db FTS5 across tasks/runs/context/schedules, Indexer, SearchService, `autopilot search`
  events-sse.md                 # In-memory EventBus + /api/events SSE, ephemeral no replay
  webhooks-external-actions.md  # Webhook + script actions (see also actions-scripts.md)
  humans-notification-routing.md # Human YAML, quiet hours, routing (schema-only)
  doctor-validation.md          # Setup health checks, runtime detection
  release-channels.md           # Stable/canary, npm/Docker, update CLI
  workspace-cli.md              # Merge, cleanup, diff commands
  messaging-tables.md           # LEGACY: messages, channels, channel_members tables + dead messages-FTS5 triggers
```

---

## 2. Primitive Index

### Status Legend

| Symbol | Meaning |
|--------|---------|
| **ACTIVE** | Production code, tested, used in dogfood |
| **PARTIAL** | Schema exists, implementation incomplete |
| **LEGACY** | Tables/code exist but unused, superseded |
| **DEFERRED** | Mentioned in specs/docs, not yet built |

---

### Core Primitives

| # | Concept | Status | Source of Truth | Key Files | Docs Owner |
|---|---------|--------|-----------------|-----------|------------|
| 1 | **Company / Project Scope** | ACTIVE | YAML (`.autopilot/company.yaml`, `project.yaml`) | `spec/schemas/scope.ts:49-76`, `orchestrator/config/scope-resolver.ts` | `company-project-scope.md` |
| 2 | **Query** | ACTIVE | DB (`queries` table) | `spec/schemas/query.ts`, `orchestrator/services/queries.ts`, `cli/commands/query.ts` | `query.md` |
| 3 | **Session** | ACTIVE | DB (`sessions` + `session_messages`) | `orchestrator/services/sessions.ts`, `orchestrator/services/session-messages.ts` | `session.md` |
| 4 | **Conversation Binding** | ACTIVE | DB (`conversation_bindings`) | `orchestrator/services/conversation-bindings.ts`, `orchestrator/api/routes/conversations.ts` | `conversation-binding.md` |
| 5 | **Conversation Command** | ACTIVE | YAML (`company.yaml → conversation_commands`) | `spec/schemas/scope.ts:21-29`, `orchestrator/api/routes/conversations.ts:323-401` | `conversation-command.md` |
| 6 | **Task** | ACTIVE | DB (`tasks` table) | `orchestrator/db/company-schema.ts:18-53`, `orchestrator/services/tasks.ts`, `orchestrator/services/workflow-engine.ts` | `task-work-order.md` |
| 7 | **Workflow** | ACTIVE | YAML (`.autopilot/workflows/*.yaml`) | `spec/schemas/workflow.ts`, `orchestrator/services/workflow-engine.ts` | `workflow.md` |
| 8 | **Workspace / Worktree** | ACTIVE | Runtime (git worktrees) | `worker/workspace.ts`, `cli/commands/workspace.ts` | `workspace.md` |
| 9 | **Run** | ACTIVE | DB (`runs` table) | `orchestrator/services/runs.ts`, `spec/schemas/api-contracts.ts:56-122` | `run.md` |
| 10 | **Worker** | ACTIVE | DB (`workers` + `worker_leases`) | `worker/worker.ts`, `orchestrator/services/workers.ts` | `worker.md` |
| 11 | **Artifact / Preview** | ACTIVE | DB (`artifacts` table) | `spec/schemas/artifact.ts`, `orchestrator/services/artifacts.ts`, `orchestrator/api/routes/previews.ts` | `artifact-preview.md` |
| 12 | **Provider / Handler** | ACTIVE | YAML (`.autopilot/providers/*.yaml`) + handler scripts | `spec/schemas/provider.ts`, `orchestrator/providers/handler-runtime.ts` | `provider-handler.md` |
| 13 | **Handler SDK** | PARTIAL | Code exists (`handler-sdk.ts`); not packaged separately. Telegram handler uses inline SDK-shaped helpers, not a shared import. | `orchestrator/providers/handler-sdk.ts:1-189` | `runtime-sdk.md` |
| 14 | **Actions / Scripts** | ACTIVE | YAML (workflow step `actions:`). Webhook/script actions work, but shared runtime SDK/package dependency model for action scripts is not finalized. | `spec/schemas/external-action.ts`, `worker/actions/script.ts`, `worker/actions/webhook.ts` | `actions-scripts.md` |
| 15 | **Packs** | ACTIVE | YAML (`company.yaml → packs:`) + git registries | `spec/schemas/pack.ts`, `cli/packs/resolver.ts`, `cli/packs/materializer.ts` | `packs.md` |
| 16 | **Context / Capabilities** | ACTIVE | YAML (`.autopilot/capabilities/*.yaml`, `.autopilot/context/*.md`) | `spec/schemas/capability-profile.ts`, `orchestrator/services/workflow-engine.ts:1103-1150` | `context-capabilities.md` |
| 17 | **Schedules** | ACTIVE | DB (`schedules` + `schedule_executions`) | `orchestrator/services/schedules.ts`, `orchestrator/services/scheduler-daemon.ts`, `cli/commands/schedule.ts` | `schedules.md` |
| 18 | **Notifications** | ACTIVE | Code (event-driven) + provider handlers | `orchestrator/providers/notification-bridge.ts`, `spec/schemas/provider.ts` | `notifications.md` |
| 19 | **Remote / VPS** | PARTIAL | Worker enrollment + VPS deployment docs are ACTIVE. Local→VPS config/code propagation is manual (git/CI), not automatic sync. | `cli/commands/worker.ts`, `docs/guides/vps-deployment.md` | `remote-sync.md` |
| 20 | **Bootstrap** | ACTIVE | Code (starter templates) | `cli/commands/bootstrap.ts` | `bootstrap-setup.md` |

### Addendum Primitives

| # | Concept | Status | Source of Truth | Key Files | Docs Owner |
|---|---------|--------|-----------------|-----------|------------|
| 21 | **Auth / Identity / Roles** | ACTIVE | DB (Better Auth tables) | `orchestrator/auth/index.ts`, `orchestrator/auth/middleware.ts`, `orchestrator/auth/roles.ts` | `auth-identity-roles.md` |
| 22 | **Worker Enrollment / Join Tokens** | ACTIVE | DB (`join_tokens`, `workers`) | `orchestrator/services/enrollment.ts`, `orchestrator/api/routes/enrollment.ts` | `enrollment-join-tokens.md` |
| 23 | **Shared Secrets** | ACTIVE | DB (`shared_secrets`, AES-256-GCM) | `orchestrator/services/secrets.ts`, `spec/schemas/secret-ref.ts` | `shared-secrets.md` |
| 24 | **Environments** | PARTIAL | Schema only (`spec/schemas/environment.ts`) | `spec/schemas/environment.ts:1-14`, workflow targeting field | `environments.md` |
| 25 | **Queues** | ACTIVE | YAML (`company.yaml → queues:`) + DB | `spec/schemas/scope.ts:6-16`, `orchestrator/services/tasks.ts:122-206` | `queues.md` |
| 26 | **Task Graph / Relations** | ACTIVE | DB (`task_relations`) | `orchestrator/services/task-graph.ts`, `orchestrator/services/task-relations.ts`, `orchestrator/services/dependency-bridge.ts` | `task-graph.md` |
| 27 | **Run Steering** | ACTIVE | DB (`run_steers`) | `orchestrator/services/steers.ts`, `orchestrator/api/routes/runs.ts:384-438` | `run-steering.md` |
| 28 | **Activity / Audit** | ACTIVE | DB (`activity` table) — task-scoped approval audit trail | `orchestrator/services/activity.ts`, `orchestrator/api/routes/tasks.ts:208-218` | `activity-audit.md` |
| 29 | **Search / Indexer** | ACTIVE | DB (`index.db` — FTS5 on tasks, runs, context, schedules) | `orchestrator/services/indexer.ts`, `orchestrator/services/search.ts`, `cli/commands/search.ts` | `search-indexer.md` |
| 30 | **Events / SSE** | ACTIVE | Runtime (in-memory EventBus) | `orchestrator/events/event-bus.ts`, SSE endpoint | `events-sse.md` |
| 31 | **External Actions / Webhooks** | ACTIVE | YAML (workflow step actions) | `spec/schemas/external-action.ts`, `worker/actions/webhook.ts` | `webhooks-external-actions.md` |
| 32 | **Humans / Notification Routing** | PARTIAL | YAML (`.autopilot/team/humans/`) — schema exists, no runtime consumer | `spec/schemas/human.ts:1-29` | `humans-notification-routing.md` |
| 33 | **Doctor / Setup Validation** | ACTIVE | CLI runtime checks | `cli/commands/doctor.ts:1-395` | `doctor-validation.md` |
| 34 | **Release / Version Channels** | ACTIVE | npm registry + package.json | `cli/commands/update.ts`, `cli/commands/version.ts`, `docs/guides/release-channels.md` | `release-channels.md` |
| 35 | **Workspace CLI** | ACTIVE | CLI commands + git | `cli/commands/workspace.ts:1-452` | `workspace-cli.md` |
| 36 | **Messaging Tables** | LEGACY | DB (`messages`, `channels`, `channel_members`) — never queried | `orchestrator/db/company-schema.ts:112-171` | `messaging-tables.md` |

---

## 3. Cleanup Recommendations

### 3.1 Legacy Code to Remove or Isolate

| Item | Location | Action | Risk |
|------|----------|--------|------|
| **messages / channels / channel_members tables** | `company-schema.ts:112-171`, migration `0000_slim_krista_starr.sql:75-143` | Mark as legacy with `@deprecated`. Do NOT drop yet — migration risk. Document as "reserved for future messaging." | Low — no code queries them |
| **FTS5 triggers on messages table** | `orchestrator/db/index.ts` | Legacy — the *active* search system uses a separate `index.db` with FTS5 on tasks/runs/context/schedules. The messages-table FTS5 is dead code. | None |
| **templates/solo-dev/** | `/templates/solo-dev/` | Evaluate if bootstrap still references it. If not, archive. Bootstrap now uses inline templates. | Low |
| **local_specs/** | `/local_specs/` | Archive — project memory says "company specs are canonical, local_specs is archive" | None |

### 3.2 Inline Bootstrap Templates

Bootstrap (`cli/commands/bootstrap.ts`) contains ~200 lines of inline YAML template strings for company.yaml, agent configs, and workflows.

**Recommendation:** Extract into a `templates/` directory as standalone YAML files. Benefits:
- Easier to test/validate templates independently
- Easier for pack authors to provide alternative starter templates
- Cleaner separation of CLI logic vs. content

### 3.3 Handler SDK Packaging

Currently, handler scripts import SDK helpers directly from orchestrator source:
```typescript
import { defineHandler, ok, fail } from '../../../packages/orchestrator/src/providers/handler-sdk'
```

**Recommendation:** Publish handler SDK as a separate thin package (`@questpie/autopilot-handler-sdk`):
- Contains only `defineHandler()`, result builders, and TypeScript types
- Zero runtime dependencies
- Handler scripts can `import { defineHandler } from '@questpie/autopilot-handler-sdk'`
- Enables pack authors to write handlers without importing from orchestrator internals

### 3.4 Command Naming Inconsistencies

| Current | Problem | Suggested |
|---------|---------|-----------|
| `autopilot query` | Overloaded — both "create" and "list" | `autopilot query create <prompt>`, `autopilot query list` |
| `autopilot task` | Same overload | `autopilot task create`, `autopilot task list` |
| `autopilot run` | Same | `autopilot run list`, `autopilot run show` |
| `autopilot token create` | Under `worker` subcommand but conceptually separate | `autopilot enrollment token create` or keep as-is |
| `autopilot secret set` | Fine | — |
| `autopilot sync` | Does too many things (packs + CLAUDE.md + skills) | Consider `autopilot sync --packs-only`, `autopilot sync --docs-only` |

### 3.5 Docs Duplication

| File | Overlaps With | Action |
|------|---------------|--------|
| `docs/security.md` | `docs/internal/security.md` | Merge into one. Internal version is more complete. |
| `docs/architecture.md` | `docs/internal/architecture.md` | Keep both — public vs. internal audiences. Cross-reference. |
| `docs/guides/vps-deployment.md` | `docs/internal/deployment.md` | Merge VPS-specific into deployment.md, keep runbook separate. |

### 3.6 Specs vs. Docs Ownership

| Content Type | Current Location | Should Be |
|-------------|------------------|-----------|
| Schema descriptions | Inline in `spec/schemas/*.ts` (JSDoc) | Keep in code — single source of truth |
| Behavioral contracts | Scattered across `docs/internal/*.md` | Consolidate into primitives docs (proposed above) |
| Operator guides | `docs/guides/` | Keep separate — audience is operators, not devs |
| API reference | Not generated | Generate from Hono routes + Zod schemas (deferred) |

### 3.7 Concepts That Are Confusingly Similar

| Pair | Confusion | Resolution |
|------|-----------|------------|
| **Session vs. Conversation Binding** | Both link external chat to internal state | Session = conversation continuity (query mode). Binding = task ownership (task_thread mode). Document the distinction explicitly. |
| **Query vs. Task** | Both create runs | Query = lightweight, no workflow, no task record. Task = durable, workflow-driven, has lifecycle. |
| **Run targeting vs. Run execution** | "targeting" field name misleading | Rename to `constraints` in docs. Targeting = what the run requires. Execution = what actually happens. |
| **Worker registration vs. Enrollment** | Both are identity-related | Enrollment = one-time (join token → machine secret). Registration = per-startup (capabilities advertisement). |
| **Provider vs. Handler** | Provider YAML vs. handler script | Provider = config (what to invoke, when, with what). Handler = code (how to invoke). One provider → one handler file. |
| **Context vs. Context Hints** | Both inject knowledge into runs | Context = actual file content (injected_context). Hints = filesystem paths for the agent to explore (context_hints). |
| **Notification vs. Conversation action** | Both send messages externally | Notification = outbound event-triggered delivery. Conversation action = handler result that orchestrator interprets (task.approve, query.message, etc.). |

---

## 4. Demo-Safe Summary

### What Can Be Claimed Tomorrow

These are production-tested, code-backed, and demonstrable:

| Claim | Evidence | Caveat |
|-------|----------|--------|
| **Task decomposition** — agents break work into subtasks | `task_spawn_children` MCP tool, idempotent with dedupe_key, cycle detection | No dashboard visualization yet |
| **Workflow engine** — declarative YAML state machines drive task progression | Bounded-dev, simple, direct workflows. Steps, transitions, retry policies. | No parallel step execution |
| **Conversation surfaces** — Telegram surface working | Telegram pack working. Commands, query mode, task thread mode. Provider/handler architecture is intended to generalize to other surfaces. | No Slack pack shipped; other surfaces require authoring a new pack |
| **Conversation commands** — `/build`, `/task`, `/direct` from chat | Defined in company.yaml, routed through handler → task creation | Only `task.create` action works |
| **Git worktree isolation** — dev workflows can use isolated task worktrees | WorkspaceManager creates `autopilot/{taskId}` worktrees, persistent across steps. Workflows with `workspace.mode: none` skip worktree. | Non-git repos get degraded mode; worktree is opt-in per workflow |
| **Worker enrollment** — join token → durable machine credential | One-time token, SHA-256 hashed, X-Worker-Secret auth | No token revocation API |
| **Encrypted secrets** — AES-256-GCM at rest, scope-filtered delivery | `autopilot secret set`, delivered only to matching scope at claim time | No master key rotation |
| **Schedules** — cron-based automation creating tasks/queries | Full CLI, daemon polls every 15s, execution history | No retry on failure |
| **Mid-run steering** — guide a running agent without restarting | `POST /runs/:id/steer`, worker polls and applies | No CLI command for it yet |
| **Packs** — distributable config bundles from git registries | Telegram surface pack working end-to-end with lockfile | No npm registry, no discovery |
| **Setup in one command** — `autopilot bootstrap` scaffolds everything | Interactive prompts, starter workflows, context import | No rollback if broken |
| **Health checks** — `autopilot doctor` validates setup | 8 check categories, pass/warn/fail with fix suggestions | No DB health check |
| **Full-text search** — search tasks, runs, context, schedules | FTS5 index in separate `index.db`, 5-min refresh cycle, `autopilot search` CLI | Embedding/vector search infrastructure exists but unused |
| **Activity audit** — track approvals, rejections, replies on tasks | `activity` table, `GET /tasks/:id/activity` | Task-scoped only — no global audit log query |
| **Real-time events** — SSE stream of orchestrator events | `GET /api/events`, `autopilot event` CLI with type filtering | Ephemeral (in-memory), no replay on reconnect |
| **Multi-step workflows** — plan → implement → review → done | bounded-dev workflow with human_approval step | No parallel steps, no timeout |
| **Query mode** — ask questions without creating tasks | Sessions, conversation history, runtime resume (Claude Code) | Resume only works with Claude Code |
| **Release channels** — stable + canary with `autopilot update check` | npm-backed version checking, Docker tags | Canary Docker not automated |

### What Must Be Caveated

| Claim | Reality | Caveat to State |
|-------|---------|-----------------|
| **Environments** | Schema only — `EnvironmentSchema` exists but nothing consumes it | "Environments are designed but not yet wired into the runtime" |
| **Notification routing / Quiet hours** | `HumanSchema` has fields; no orchestrator code reads them | "Human notification preferences are defined but not enforced" |
| **Search (semantic)** | FTS5 keyword search works; embedding column + chunks table exist but unused | "Keyword search is live; semantic/vector search is infrastructure-ready but not active" |
| **Audit log (global)** | Task-scoped `activity` table works; no cross-task global audit query | "Per-task audit trail is live; global audit dashboard is planned" |
| **Multi-runtime** | Worker advertises capabilities for Claude Code; Codex/OpenCode are registered but untested | "Primary runtime is Claude Code; others are available but less tested" |
| **RBAC** | Roles exist (owner/admin/member/viewer/agent); auth disabled by default in dev | "Role-based access control is implemented but not enforced in local dev" |
| **Messaging / Channels** | Tables exist in schema; never queried by any code | Do NOT mention. Dead code. |
| **Handler SDK** | Code exists in orchestrator; Telegram handler uses inline SDK-shaped helpers, not a shared import. No published package. | "Handler SDK code exists; packaging as a standalone importable module is not finalized. Materialized pack handlers currently inline their own helpers." |
| **Concurrent runs** | Worker supports `maxConcurrentRuns`; lease management handles it | "Concurrent execution works but no load-balancing or auto-scaling" |
| **Pack versioning** | Only git refs (branch/tag); no semver range matching | "Packs resolve by git ref; semantic versioning is planned" |
| **Config sync to remote** | No automation — manual git push + orchestrator restart | "Config distribution to remote is manual (git-based)" |

### Hard No — Do Not Claim

| Topic | Why |
|-------|-----|
| **Internal messaging system** | `messages/channels/channel_members` tables are legacy dead code |
| **Email notifications** | No email provider handler shipped |
| **Auto-scaling workers** | No dynamic provisioning |
| **Protocol version negotiation** | Deferred — compatibility is informational only |
| **Multi-tenant isolation** | Company/project are config scopes, not tenant boundaries |
| **Workflow versioning** | Workflows are repo-based; no history/rollback mechanism |
| **Secret rotation** | No mechanism to re-encrypt with new master key |
| **Pack dependency resolution** | No transitive deps; each pack resolved independently |

---

## Appendix: Concept Lifecycle Quick Reference

```
Bootstrap → Company/Project YAML → Sync (packs + docs)
                                         ↓
                            Orchestrator startup (loads config)
                                         ↓
    ┌─────────────────────────────────────┼───────────────────────────┐
    │                                     │                           │
Schedule (cron)              Conversation (webhook)              CLI / API
    │                              │                                  │
    ├─ creates Task ◄──────── Command routing                   creates Task
    │                              │                            creates Query
    │                         creates Query                          │
    │                              │                                  │
    └──────────────┬───────────────┴──────────────────────────────────┘
                   │
            WorkflowEngine.intake()
                   │
            ┌──────┴──────┐
            │  Run (pending) │
            └──────┬──────┘
                   │
         Worker.claim() ──── Workspace.acquire()
                   │
         Run (running) ──── Steering messages
                   │
         Run (completed) ──── Actions (webhook/script)
                   │                    │
         Artifacts created        Notifications sent
                   │
         WorkflowEngine.advance()
                   │
         ┌─────── ┤ ────────┐
         │        │         │
    Next step   Done    Wait for children
                          (ParentJoinBridge)
```
