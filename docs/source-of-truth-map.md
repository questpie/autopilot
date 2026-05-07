# Autopilot Source Of Truth Map

Status: research note  
Date: 2026-05-03

## Bottom Line

Company setup is not purely filesystem-backed anymore.

Current runtime behavior is DB-first after bootstrap:

1. Server still discovers `.autopilot/company.yaml` and `.autopilot/project.yaml` as local scope markers.
2. If config tables are empty, server imports `.autopilot/` authored config into DB.
3. Runtime config then loads from `ConfigService` / DB into `AuthoredConfig`.
4. `ConfigManager` reloads from DB only; `.autopilot/` file watching is not part of live runtime config.

So `.autopilot/` is currently seed/import/local fixture, not live truth after DB has config.

## Target Decision

Remove filesystem as a product/source-of-truth surface.

Autopilot should use filesystem only for ephemeral project execution:

1. agent gets a task/run
2. worker checks out or prepares a git worktree/repo workspace
3. agent edits/tests inside that workspace
4. agent commits/pushes/opens review output as required
5. workspace can be deleted after retention/inspection

Everything durable about the company should live elsewhere:

- config/settings/agents/workflows/team/provider setup -> DB config registry
- company/project knowledge -> Knowledge API
- tasks/runs/workers/orchestration -> DB
- artifacts/previews/results -> Knowledge resource metadata + blob/storage adapter
- source code -> git remote, not company FS

Agent execution and local agent setup now have explicit integration points:

- local coding-agent execution -> `spawn-agent` / ACP, wrapped by the worker `RuntimeAdapter`
- native agent skills/MCP/AGENTS.md setup -> `agent-install`, exposed through `autopilot agent ...`
- durable agent/team/workflow/capability intent still belongs in DB config; local agent files are materialized compatibility output

## Current Map

| Area | Current live truth | Filesystem role today | Ideal target |
| --- | --- | --- | --- |
| Company settings/defaults/queues/context hints/conversation commands/packs | `config_company_scopes` via `/api/config/company` | `.autopilot/company.yaml` required for discovery and initial DB import | DB config registry is canonical; no product dependency on company FS |
| Project defaults | `config_project_scopes` plus `projects` table | `.autopilot/project.yaml` seeds project config when DB empty | DB config registry + project registry canonical; project source points at git metadata |
| Agents | `config_agents` via `/api/config/agents` | `.autopilot/agents/*.yaml` initial import only | DB config registry canonical; optional pack/export files |
| Workflows | `config_workflows` via `/api/config/workflows` | `.autopilot/workflows/*.yaml` initial import only | DB config registry canonical; workflow revisions should become explicit over time |
| Environments | `config_environments` | `.autopilot/environments/*.yaml` initial import only | DB config registry canonical |
| Providers/integrations | `config_providers` | `.autopilot/providers/*.yaml` + handler files/pack source | Provider instance config in DB; handler code stays pack/source artifact |
| Capabilities | `config_capabilities` | `.autopilot/capabilities/*.yaml` initial import only | DB config registry canonical |
| Skills | `config_skills`; `autopilot agent skill add` can materialize SKILL.md files through `agent-install` | `.autopilot/skills/` initial import only; native agent skill dirs are compatibility output | DB config registry for installed/runtime skills; pack/source for distribution; `agent-install` for local agent materialization |
| Context snippets | `config_contexts` | `.autopilot/context/*.md` initial import only | DB config registry for injected context; Knowledge API for broad company/project knowledge |
| Scripts | `config_scripts`, exposed read-only through script service | `.autopilot/scripts/*.yaml` initial import only | DB config registry for script definitions; source files/packages for executable code |
| Schedules | `schedules` + `schedule_executions` tables | Old schedule file schema exists in spec, but runtime uses ScheduleService DB | Keep DB table as live operational truth; reconcile old authored schedule schema/docs |
| Knowledge / artifacts / results | `knowledge` table + blob store via `/api/knowledge` | No generic FS truth; operator route is `/knowledge` | Knowledge resource API/storage is canonical for docs, uploads, summaries, artifacts, results, and durable previews |
| Project workspace inspection | Worker-local git diff plus project `git_remote` metadata | Real code/worktree files on worker machines; Git provider remote for compare/PR links | Read-only project Git/provider review surface; no product filesystem model |
| Tasks/runs/task graph | `tasks`, `runs`, task relation tables | Worktrees contain execution outputs, not task truth | DB canonical |
| Workers/machines | `workers`, enrollment/join-token tables | Worker local disk contains toolchain/session files | DB canonical for machine identity/status; worker owns node-local runtime state |
| Sessions/conversations/queries | DB session/query/binding tables | Runtime session files may live worker-local for specific adapters | DB canonical for conversation/session truth; worker-local files are adapter implementation detail |
| Artifacts/previews | `artifacts`, `artifact_blobs`, blob store, preview URLs | Blob store may be filesystem-backed storage | Migrate durable artifacts/previews into Knowledge resources with task/run provenance; storage adapter owns bytes |
| Secrets | `shared_secrets` table | `.env` still used for process bootstrap | DB/secret store canonical for shared integration secrets; `.env` only process bootstrap |
| User prefs/UI prefs | Better Auth/user preference DB, hydrated into UI store | browser store cache via Zustand persist | DB canonical, local store cache only |
| Runtime agents | Worker `RuntimeConfig` resolves `claude-code` / `codex` / `opencode` to `SpawnAgentAdapter` | No direct per-runtime CLI adapters remain | Use `spawn-agent` as the primary local agent transport; worker keeps Autopilot event/result normalization |
| MCP server definitions | Only referenced as string IDs in capability profiles today; `autopilot agent mcp add` can write native configs through `agent-install` | No first-class DB entity found | Add first-class DB config registry entity for MCP servers; materialize to native agent config with `agent-install` |
| Renderer mappings/type definitions | `TypeDefinitionSchema` exists; UI viewer registry still hard-coded | No first-class live registry found | Add DB-backed renderer/type registry; UI dispatches from config |

## Cleanup Implications

1. Rename the operator surface from Files to Knowledge for non-run browsing.
2. Remove persistent company/project FS browsing from the product model.
3. Use `/knowledge` for Knowledge resources and project workspace inspection for ephemeral git diff/run review; expose GitHub/GitLab-ready provider context through adapters.
4. Add retention/cleanup semantics for worker git workspaces.
5. Add first-class config entities for MCP servers and renderer/type mappings.
6. Use `spawn-agent` for worker runtime execution; do not reintroduce runtime-specific shell adapters.
7. Use `agent-install` for local skills/MCP/AGENTS.md materialization instead of hand-writing each agent format.
8. Remove old docs/examples that present `.autopilot/` as live truth after import.
9. Keep explicit import/export/sync semantics for `.autopilot/` and packs, but not as live storage.
10. Rename local project fixture defaults away from internal `dogfood` wording.

## Code Evidence

- DB config service: `packages/orchestrator/src/config/config-service.ts`
- First import from authored files: `packages/orchestrator/src/config/import-authored-config.ts`
- Server bootstrap: `packages/orchestrator/src/server.ts`
- Config tables: `packages/orchestrator/src/db/company-schema.ts`
- Knowledge service/API: `packages/orchestrator/src/services/knowledge.ts`, `packages/orchestrator/src/api/routes/knowledge.ts`
- Workspace inspection scope: `packages/orchestrator/src/services/workspace-inspection.ts`
- Operator Web config API: `apps/operator-web/src/api/config.api.ts`
- Operator Web Knowledge source hook: `apps/operator-web/src/hooks/use-knowledge-source.ts`
