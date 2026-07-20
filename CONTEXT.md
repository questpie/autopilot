# QUESTPIE Autopilot

Autopilot is a company operating layer where Humans and AI Agents collaborate as equal team members toward shared outcomes.

Product copy is Slovak. Specifications, domain names, code, and Agent Board records use English. The Slovak UI label is noted only where it prevents ambiguity.

## Organization

**Company** (`Firma`):
The top-level work and authorization boundary for one organization.
_Avoid_: Workspace, account, tenant

**Company Language** (`Jazyk firmy`):
The language in which one Company's product copy, content, validation, and error messages are presented. Every Company today is Slovak; the Company record is where a future language choice lives.
_Avoid_: UI locale toggle, Actor preference, browser language

**Whole Company Space** (`Celá firma`):
The automatically created default Space for work and communication shared by all Company Actors.
_Avoid_: Company root, global Channel, Project

**Space** (`Priestor`):
A durable context within a Company that gathers related work, Actors, and communication. It owns membership, visibility, and navigation context and may contain zero or more Projects.
_Avoid_: Folder, team, Project

**Project** (`Projekt`):
An optional narrower context within exactly one Space: a cohesive initiative or operated product surface under which the Company tracks related outcomes.
_Avoid_: Space, repository, Goal

**Company Membership**:
An Actor's durable participation in one Company. It is required before the Actor may receive any Space membership or Company-scoped role.
_Avoid_: Login account, Space membership, invitation

**Space Membership**:
An Actor's durable participation and role eligibility in one Space. Projects and Channels inherit this access in Phase 0 and Phase 1.
_Avoid_: Project membership, Channel participant, presence

**System Content**:
A product object seeded with a stable `systemKey` identity, such as the fixed roles, the Whole Company Space, the default `#general` Channel, and the Autopilot Agent. Its display name is product copy in the Company Language and may be renamed; its systemKey and slug are stable English identifiers that contracts and fixtures bind to.
_Avoid_: Hardcoded name, seed data row, renamable identifier

## Actors

**Actor** (`Aktér`):
A Company member with its own memberships, roles, and permissions that can receive work, communicate, and leave an attributable trail. An Actor is a Human or an Agent.
_Avoid_: User, executor

**Human** (`Človek`):
An Actor representing a natural person, whether an employee, contractor, or partner.
_Avoid_: Employee, user

**Agent**:
An Actor whose work is performed by an AI runtime. Each Agent is an independent team member with its own memberships, roles, permissions, and Skills; it does not borrow authority from the Human or Agent that requested its work.
_Avoid_: Bot, AI feature, model

**Autopilot**:
The Company's default general-purpose Agent. It is one of potentially many Agents, not a shared identity for all AI work. Company creation provisions it as `pending_setup`; activation requires a verified provider, Space membership, role, permissions, and Skills.
_Avoid_: Assistant, chatbot

**Skill**:
A named Agent capability with a bounded purpose, allowed tools, and execution limits.
_Avoid_: Permission, prompt, role

**Provider Connection**:
A Company-owned, verified connection to an AI Provider from which an Agent may use allowed Model Offerings and Runtimes. It references a Credential Binding but never exposes credential material, and it grants no access to Company data.
_Avoid_: Agent, model, permission

**Provider Definition**:
A credential-free catalog description of an AI Provider contributed by an installed Runtime Adapter, including supported connection methods and discovery capabilities.
_Avoid_: Provider Connection, Integration, credential

**Model Offering**:
A provider model that a verified Provider Connection can currently access, normalized from live discovery or a versioned Adapter catalog.
_Avoid_: Runtime, Agent, free-form model label

**Runtime**:
An execution mechanism through which a Worker can run an Agent, such as direct model generation or an interactive coding Harness.
_Avoid_: Model, Provider, Worker

**Credential Binding**:
An opaque, revocable reference connecting one credential consumer — a Provider Connection or an Integration Installation — to credential material stored in a managed secret store or a Worker Home. It records the credential subject, approved authentication method, and consumer-specific policy such as billing owner or concurrency mode. Credential material is never part of a Run, prompt, tool result, log, source code, or artifact.
_Avoid_: Plaintext secret, Provider Connection, Agent permission

**Credential Requirement**:
A named declaration in an Integration Adapter of one credential its Installation must or may bind: a kind from the closed set `api_key`, `oauth2`, `basic`, `dsn`, or `service_account`, plus constraints, optionality, and a plain-language purpose. Only a Human may satisfy it with a Credential Binding; an Agent's request creates a Permission Request.
_Avoid_: Credential Binding, secret value, environment variable

**Work Machine**:
A Company-visible logical execution environment on which Agents can work. It may represent a Human's computer, a manually connected VPS, a cloud-provider machine provisioned through a guided integration, or QUESTPIE-managed capacity backed by a hidden Worker Pool. A Company can manage Work Machines whether its control plane is self-hosted or QUESTPIE Cloud. It exposes understandable readiness, supported Runtimes, capacity, and connection availability without exposing pods, leases, or scheduler internals.
_Avoid_: Actor, Worker process, Kubernetes node

**Work Machine Provisioning Mode**:
How a Work Machine is created and operated: `manual`, `guided_provider`, or `questpie_managed`. This is independent of whether the Autopilot control plane itself is self-hosted or QUESTPIE Cloud.
_Avoid_: Control-plane hosting, Runtime, provider authentication

**Worker**:
A replaceable internal process or pod inside a Work Machine that advertises Runtime capabilities and performs Runs. A Worker is not an Actor and receives only the selected Agent's short-lived Run authority.
_Avoid_: Agent, Human, team member

**Worker Pool**:
An internal schedulable group of Workers behind one Work Machine. QUESTPIE Cloud may scale this pool without presenting each pod or node as a product object.
_Avoid_: Team, Work Machine, Actor group

**Worker Home**:
Encrypted persistent state assigned to a Work Machine, capable of holding runtime sessions and resumable workspace state independently of a replaceable Worker process. It is not a supported store for personal Claude subscription credentials in Autopilot production.
_Avoid_: Actor home, container image, Company data store

**Execution Policy**:
An Agent policy naming allowed Provider Connections, Model Offerings, Runtimes, Worker Pools, preferences, and fallbacks from which a Run target may be selected.
_Avoid_: Provider credential, Skill, per-Run result

**Credit**:
The metered unit in which QUESTPIE-managed compute, storage, and platform-provided model usage are billed to a Company. Work run on the Company's own Work Machine, or model usage through the Company's own Provider Connection, is not charged in Credits.
_Avoid_: vCPU-second, subscription seat, model-token price

**Permission Request**:
A paused request from an Agent to an authorized Human for a specific missing access grant or effect required by a Run. An approval is scoped to that Run by default and expires when the Run ends.
_Avoid_: Impersonation, unlimited approval, error

**Request Acceptance Policy**:
The policy deciding whether one Actor may ask a particular Agent to perform a category of work in a specific context. It protects a privileged Agent from becoming an authority or disclosure bypass without making the Agent impersonate the requester.
_Avoid_: Agent RBAC, Skill, Permission Request

**Result Projection**:
A separately authorized, idempotent placement of a completed Run result into one application anchor. Request acceptance does not authorize projection: the destination is rechecked, and data outside its Space requires an exact reviewed `share_to_anchor` effect.
_Avoid_: Run result part, raw output stream, automatic Message

## Work

**Goal** (`Cieľ`):
A named outcome whose achievement the Company intentionally tracks. Progress is derived from its Criteria; an authorized Actor explicitly confirms achievement.
_Avoid_: Project, epic, task container

**Criterion** (`Kritérium`):
An independently assessable condition by which an Actor determines whether a Goal has been acceptably achieved. Criteria drive Goal progress; completed Tasks are supporting evidence, not automatic proof of achievement.
_Avoid_: Checklist item, Task

**Goal Spec Revision**:
One attributable version of a Goal's structured intent. A published revision is immutable and can be reviewed without later edits silently changing the reviewed target.
_Avoid_: Goal status, Criterion, mutable note

**Task** (`Úloha`):
The smallest independently assignable unit of work toward an outcome. A Task may be unassigned or have exactly one accountable Human or Agent assignee; other Actors collaborate through participation, Mentions, and related Tasks. Its canonical workflow is `backlog`, `ready`, `in_progress`, `blocked`, `in_review`, `done`, or `cancelled`.
_Avoid_: Run, issue

**Task Relationship**:
A named semantic edge between two Tasks: `blocks`, `relates_to`, or `duplicates`. Inverse views such as `blocked_by` are derived rather than stored as a second edge.
_Avoid_: Ordering, nesting, parent/subtask tree

**Task Event**:
An immutable attributable assignment, transition, block, unblock, restore, or material update in a Task's history. Agent assignment requests key to the exact assignment event rather than the mutable Task row.
_Avoid_: Activity event, audit log, Run event

**Review Gate**:
A package-owned decision point before a Run causes an external, destructive, financial, access-control, or cross-Space disclosure effect. The approver must hold both the explicit effect-review permission and the underlying target operation. Goal/Task collaboration review is a separate application Review Request.
_Avoid_: Status, approval button, Goal Review Request

## Collaboration

**Channel** (`Kanál`):
A named, ongoing Actor conversation in exactly one Space, optionally narrowed to a Project. A Space may contain multiple Channels and exactly one is its protected default `#general` (a `kind=channel` session with `systemKey=general`, `slug=general`). Product contracts and fixtures do not call this Channel `#všeobecné`. In Phase 0, every Space member can access every Channel in that Space.
_Avoid_: Chat, Thread, DM

**Thread** (`Vlákno`):
A contextual Actor conversation anchored in a Channel or to a work object.
_Avoid_: Channel, comment

**Direct Conversation** (`Priama konverzácia`):
A private one-to-one conversation between two Company Actors. Writing to an Agent still requires an explicit structured Mention to request work.
_Avoid_: Private Channel, implicit Agent command, external DM

**Message** (`Správa`):
One attributable communication event in a Thread or Channel session.
_Avoid_: Prompt, transport event

**Mention** (`Zmienka`):
An explicit structured invitation of an Actor into attention or work in one Message. One Message may Mention multiple unique Agents; each receives an independent, traceable Run in the same Thread.
_Avoid_: Assignment, notification, plain text name

## AI execution

**Suggestion** (`Návrh`):
A non-binding AI result that requires deliberate Human acceptance before it is written into a work object.
_Avoid_: Autocomplete, Run

**Run** (`Beh`):
One immutable execution attempt of work by an Agent with state, evidence, lineage, and an attributable result. If the Agent cannot continue in the Task context, the Run may wait for an authorized Human's permission. During execution, a compact live card summarizes current semantic activity; full detail opens on demand, and the completed result becomes a separate Agent Message. Cancellation is best-effort, and retry creates a linked new Run.
_Avoid_: Task, session, workflow

**Steering**:
An ordered, attributable Phase-1 instruction submitted to one active Run by an Actor with `runs.steer` permission. Steering is delivered at the next safe execution boundary, never rewinds committed effects, and remains visible to every Actor allowed to inspect the Run.
_Avoid_: Message, prompt replacement, hidden intervention

**Activity Group**:
A compact semantic roll-up of consecutive low-level Run events, such as several tool calls, shown as a count and the latest meaningful activity label until expanded in Run detail.
_Avoid_: Raw log dump, Message, mutable result

**Provenance**:
The information identifying which Actor and Run created or changed a result.
_Avoid_: Author without Run, AI badge

## Knowledge and tools

**Knowledge** (`Znalosť`):
Curated Company content on which Actors rely when deciding and working.
_Avoid_: Asset, file, memory

**Knowledge Revision**:
One attributable version of Knowledge content. A published revision is immutable so later edits cannot rewrite the evidence used by an earlier Run or decision.
_Avoid_: Agent memory, search index entry, live draft

**Artifact** (`Artefakt`):
A durable work output intended for review, use, or further processing.
_Avoid_: Attachment, log

**Company Drive**:
A Company-wide navigable projection of typed references to the Company's canonical objects — Knowledge, Assets, Integration Packages, Skills, Dashboards, Mini-apps, Projects, and their revisions. It references rather than copies, and moving an item within it changes neither the item's identity nor its permissions.
_Avoid_: File system, source tree, storage bucket

**Dashboard**:
A read-oriented, durable composition of governed Company data. It may filter, navigate, drill down, and invoke explicit authorized actions, but it is not an application runtime.
_Avoid_: Mini-app, arbitrary report page, mutable widget code

**Mini-app** (`Miniappka`):
An independently versioned, Company-owned zero-install source project whose qualified HTML, normally imported local JSX/TypeScript modules, CSS, and template JavaScript are deterministically compiled and run through the isolated Mini-app Host. It may have governed Data Query and Integration Action bindings, capability-granted stores, Runs, exports, and optional Automation links, but it owns no parallel server-action system.
_Avoid_: Dashboard, deployed Project, presentation document model, mutable Asset bundle

**Mini-app Template**:
A later-phase immutable cloneable source scaffold paired with an authoring Skill. It promotes a proven repeated `.app` shape into a registry item; instantiation copies one exact Template revision into a new independent Mini-app draft and records provenance. The first slice creates `.app` projects directly from a Skill and its supporting reference files without a Template Registry.
_Avoid_: Runtime inheritance, installed singleton editor, copied export, mutable base app

**Mini-app Host**:
The generic trusted shell that validates and mounts a Mini-app revision in a null-origin sandboxed iframe, injects the scoped command bridge, and owns CSP, size, session, and capability boundaries. Domain behavior remains in the Mini-app source.
_Avoid_: Slides editor, app business logic, ambient credential bridge

**Mini-app UI Profile**:
The qualified presentation contract of a Mini-app. `product` is the default and requires canonical Mini-app UI Runtime controls for internal-tool chrome and interactions. `canvas` explicitly permits a custom visual kit inside a declared Slides, wireframe, document, or branded-content region while retaining canonical Host and editing controls.
_Avoid_: Theme, arbitrary CSS mode, separate design system

**Mini-app UI Runtime**:
A versioned host-controlled browser projection of the public `@questpie/ui` component and Lucide catalog, plus semantic theme tokens, injected into an isolated Mini-app frame. It provides presentation consistency but grants no data or command authority.
_Avoid_: Base UI import, shadcn source copy, security boundary, ambient app provider

**Mini-app Source Manifest**:
The required, statically validated `app.json` in every Mini-app revision. It declares the manifest schema version, named Surface module entries, UI Profile and runtime compatibility, and symbolic Data Query and Integration Action requirements. It grants no authority by itself, and `.app` has no `server.ts` action registry.
_Avoid_: Inline server manifest, embedded server-action registry, implicit authority by convention, Template metadata

**Dependency Policy**:
An Integration Installation's explicit choice between `automatic`, which follows the latest published Integration Package version, and `pinned`, which stays on one exact version. Updating never grants new authority.
_Avoid_: Compatibility heuristic, per-operation lockfile, implicit permission

**Execution Snapshot**:
The exact Package, Operation, Adapter, and executable bundle revisions used by one Query Execution or Run, preserved even when an automatic Integration Installation later advances.
_Avoid_: Installation preference, latest pointer, mutable provenance

**Integration Action Binding**:
A qualified mapping from one local Mini-app action alias to one exact published Integration Action revision. Mini-app UI and the Action's MCP adapter invoke the same command contract, authorization, approval policy, Run model, and audit trail through different adapters.
_Avoid_: Mini-app server handler, duplicated MCP implementation, ambient command access

**Action Invocation Mode**:
One governed delivery intent for an exact Integration Action revision. The current Dashboard and Mini-app slice supports explicit immediate invocation only. One-off deferred, recurring, event-driven, and child invocation remain deferred compatibility requirements rather than fields exposed by the current Mini-app Source Manifest.
_Avoid_: Separate Action implementation, raw job, browser timer, permission bypass

**Child Action Invocation**:
A capability-scoped request made by one sandboxed Action to create a separately authorized child Run for an exact target Action revision, optionally with a bounded delay. It carries explicit idempotency and lineage and never exposes the host queue or inherits ambient parent authority.
_Avoid_: Nested Deno process call, raw queue publish, unbounded delegation

**Surface**:
One named renderable presentation owned by a specific Dashboard or Mini-app revision. A Dashboard Surface owns a declarative Render Spec; a Mini-app Surface names a qualified local module entry. `preview` and `content` are distinct Surfaces with intentional information priorities; a Surface has no standalone lifecycle, permission model, or revision graph.
_Avoid_: Standalone collection, responsive breakpoint, Placement, screenshot

**Render Spec**:
The declarative json-render tree owned by a Dashboard Surface. It may use only the qualified Autopilot catalog backed by public `@questpie/ui` components, authorized query bindings, and named QUESTPIE command actions.
_Avoid_: Mini-app source, executable widget code, browser fetch plan, `@json-render/shadcn`, domain entity

**Placement**:
A live `{ownerRevisionId, surfaceName}` reference that pins one Surface into a destination with validated presentation parameters. It does not copy or change the identity, lifecycle, data, or permissions of the source artifact.
_Avoid_: Dashboard copy, widget data, layout source code

**Operation**:
The common versioned contract family for governed executable definitions. A Query is the strictly read-only profile and an Integration Action is the effectful profile; the profiles share identity and binding language but not authority or result lifecycle.
_Avoid_: Boolean-mutating function, Route, Job, Workflow

**Integration Package**:
A versioned set of Integration Adapters, Queries, Integration Actions, Skills, and optional Mini-app Templates designed and qualified together while remaining independently grantable.
_Avoid_: Monolithic runtime, Company credentials, Integration Installation

**Package Export**:
The stable symbolic name under which one Integration Package publishes one first-class definition — an Integration Adapter, Data Query, Integration Action, Skill, or Mini-app Template — across versions. Bindings, generated proxies, and Skills reference a Package Export, never a revision id or file path.
_Avoid_: Revision id, file path, handler import, npm export

**Integration Installation**:
A Company's activated binding to one Integration Package revision, including its Credential Bindings, granted capabilities, and exposed Data Sources and Integration Actions.
_Avoid_: Data Source, credential, copied package

**Data Source**:
A governed readable projection declared by an Integration Adapter and exposed by an Integration Installation over an external system or QUESTPIE collections. It shares the Installation's connection identity without owning credentials or effect authority.
_Avoid_: Integration Installation, credential, write target, Data Query

**Integration Adapter**:
A versioned executable definition owning one external system's complete transport contract: named credential requirements, health, schema discovery, typed reads for its Data Sources, optional source-change ingress, and sealed effects that only Integration Actions may invoke. Autopilot may author it, but qualification rather than authorship determines whether it may be activated.
_Avoid_: Source Adapter, Data Source, credential, Query, Integration Action

**Data Query**:
A separately versioned, governed read-only Operation over one or more Data Sources or Queries with typed parameters, expected result shape, limits, and provenance.
_Avoid_: Widget fetch, Integration Action, mutable prompt

**Integration Action**:
A separately versioned effectful Operation that may use zero or more Integration Installations, Data Sources, and Queries under explicit grants and effect policy.
_Avoid_: Query, Mini-app handler, Job, Workflow, ambient collection write

**Surface Binding**:
A symbolic reference from a Surface to a Data Query exported by an Integration Package together with validated parameters, refresh intent, and result policy. The owning Integration Installation's Dependency Policy selects the active package version.
_Avoid_: Raw query text, browser fetch handler, execution scheduler

**Refresh Intent**:
The freshness behavior requested by a Surface Binding, such as realtime invalidation, interval refresh, manual refresh, or a fixed snapshot. It does not prescribe the Query Runtime's execution trigger.
_Avoid_: Automation, polling implementation, Query Execution

**Result Scope**:
The exact authority and audience boundary within which one governed Data Query result may be reused. It includes organizational scope, Actor or Projection Grant, audience, field and row policy, and data classification.
_Avoid_: Company-wide cache, creator authority, UI visibility

**Degraded Result**:
The last successful Query Result that remains authorized and schema-compatible while a newer refresh cannot complete. It carries explicit acquisition, freshness, failure, and retry state.
_Avoid_: Current result, silent cache, revoked snapshot

**Freshness Contract**:
The maximum age and refresh expectations under which a Query Result remains valid for its business meaning. A Binding or Projection Grant may require fresher data but cannot relax the Data Query's published limit.
_Avoid_: Cache TTL, refresh implementation, retention period

**Consistency Group**:
A named set of semantically coupled Surface Bindings whose Results must be published for one compatible `asOf` contract. Bindings outside the group remain independently refreshable.
_Avoid_: Entire Dashboard transaction, visual section, browser-side join

**Active Materialization**:
A shared scoped Query Result that remains proactively refreshed because a valid published Surface currently depends on it. It is derived from published use rather than managed as a separate business object.
_Avoid_: Open browser tab, every published Query, Automation schedule

**Automation** (`Automatizácia`):
A deferred Autopilot business-work concept combining a durable Trigger with a repeatable Work Template. Each firing snapshots a new Work Request whose target may be adaptive Agent Work, a versioned Flow, or a direct Action. A schedule is only one Trigger form. Automation is outside the current Dashboard/Mini-app implementation slice and never lives in a Mini-app manifest or Query refresh policy.
_Avoid_: Cron-to-Action shorthand, Dashboard refresh, Mini-app cron export, raw queue schedule, browser timer

**Automation Work Template**:
The repeatable instructions, executing Actor selection, bounded context references, expected deliverable, result destination, and execution policy that an Automation snapshots into a new Work Request on each firing. It does not pre-authorize the Actor's reads or effects.
_Avoid_: Action input alone, mutable in-flight Run, permission grant, scheduler payload

**Automation Firing**:
The idempotent durable receipt that one Automation Trigger occurrence was evaluated and either created a Work Request, was skipped by policy, or failed before dispatch. Actual work progress belongs to the resulting Run rather than the Firing.
_Avoid_: Run, schedule row, queue job, recurring process

## Builder

**Builder**:
The surface where an Actor evolves a Project's real codebase conversationally, seeing changes rendered live before they are proposed.
_Avoid_: IDE, sandbox, vibecoding tool

**Draft**:
A durable, in-progress body of proposed changes over one Project's repository, owned by one active writer at a time, that exists before those changes are reviewed or shipped.
_Avoid_: Branch, worktree, session directory

**Checkpoint**:
A restorable point in a Draft's history the product can return to or compare against.
_Avoid_: Commit, snapshot id, revision hash

**Preview**:
A live, viewable rendering of a Draft's current state as a running application, distinct from the finished deployed Project.
_Avoid_: Dev server, container, port

**Preview URL**:
The addressable location where a Preview is served to a reviewer.
_Avoid_: Proxy, tunnel, wildcard DNS

**Project Repository**:
The external source repository a Project is bound to, treated as the system of record for its code.
_Avoid_: GitHub repo, remote URL

**Change Request**:
The reviewable, auditable proposal to merge a Draft into its Project Repository's main line, requiring explicit Human approval before it lands. A Draft's own in-progress commits push freely and are not Change Requests.
_Avoid_: Pull request, per-change gate

**Environment**:
A named runtime target a Project can be shipped to, such as production, staging, or preview.
_Avoid_: Namespace, cluster, deployment row

**Deploy Target**:
A configured destination a Project can be deployed to, backed by a deploy adapter. QUESTPIE Cloud is one Deploy Target; a Company may add or author others, such as another provider or a self-hosted host.
_Avoid_: Hardcoded pipeline, the single cloud

**Deploy**:
Shipping a Project to an Environment on a Deploy Target through that target's adapter, driven by declared configuration rather than manual infrastructure steps.
_Avoid_: Kubernetes apply, build pipeline
