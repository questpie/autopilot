# QUESTPIE Autopilot v2 — Phase 0 and Phase 1 Specification

- Status: accepted for Phase-0/Phase-1 implementation planning
- Product language: Slovak
- Specification, domain, and code language: English
- API baseline: QUESTPIE 3.16.0, TanStack Start, React 19, TanStack Query, Bun/Turbo
- Required AI release: an unreleased `questpie-cms` package train must add the authority, SecretStore, durable Run, MCP, sandbox, and worker contracts in section 7.5; the app may link the framework branch during development but must pin a released package version before the Phase-0 AI acceptance gate
- Framework reuse gate: [`docs/architecture/framework-capability-reuse.md`](docs/architecture/framework-capability-reuse.md) is binding; generic auth, query, realtime, search/vector, queue, workflow, AI, MCP, sandbox, executor, storage, and secret capabilities are extended upstream rather than reimplemented in the app
- Dogfood company: Hrebeň

## 1. Product contract

Autopilot is a Company operating layer in which Humans and AI Agents collaborate as first-class Actors. Phase 0 proves one thin, real loop end to end:

`create Hrebeň → invite Actors → optionally activate Autopilot → enter a Space → create a Goal → create and assign a Task → mention or assign Autopilot → observe a real Run → receive an attributable reply in the same Thread`

Phase 1 deepens the same objects. It does not add parallel goal, task, chat, Agent, or execution models.

### 1.1 Non-negotiable invariants

1. Every Human and Agent action is attributable to one Actor.
2. An Agent acts with its own RBAC, Skills, and execution policy; it never impersonates a requester or falls back to ambient `system` authority.
3. Every Goal, Task, Project, and product Channel belongs to exactly one Space.
4. A Project is optional. A Space is mandatory.
5. Persisted collections are truth. Realtime Channels accelerate collaboration but never replace history.
6. AI time is visible: request, queue, evaluation, work, response, terminal result or recoverable failure.
7. A Run is an immutable attempt. Retry creates a linked attempt.
8. Suggestions do not mutate work objects until deliberately accepted.
9. Derived values are never written as presentation caches unless a measured read-model requirement justifies it.
10. Phase 0 remains usable by Humans when AI setup or execution is unavailable.

### 1.2 Phase boundary

| Capability | Phase 0 — Week 1 | Phase 1 — Collaborative depth | Later |
| --- | --- | --- | --- |
| Company | Create, owner, Human invites | Roles and richer governance | Multi-company administration |
| Spaces | Whole Company + create/open | Membership management and richer activity | Advanced directory/scaling |
| Projects | Optional Space-owned grouping: create/select/rename/archive | Compact overview and richer filtering | Builder/deploy ownership |
| Goals | Create, list, basic detail, Criteria progress | Structured spec, evidence, breakdown, coverage, review | Portfolio analytics |
| Tasks | List, create, detail, assign, status | Board/queue lenses, relations, review, live Run controls | Configurable workflows |
| Chat | Space Channels, reply/object Threads, mentions | One-to-one DMs, presence and durable read state | Private Channels, group DMs, external bridges |
| Agents | Default Autopilot UI; schema and dispatch support independent multi-Agent Mentions/delegation with depth and cycle guards | Directory, creation/configuration, profiles, roles, versioned Skills, multiple-Agent operations | Packs/marketplace |
| Knowledge | Context links only | Library, revisions, retrieval, citations | Advanced memory governance |
| AI execution | Durable Run, result, failure, permission, cancel/retry, bounded delegation contract | Steering UI, richer lineage/evidence, app reviews | Automation/build/deploy runtimes |
| Work Machines | Readiness only | Operator settings when required | Guided Hetzner and managed fleet depth |

## 2. Information architecture

### 2.1 Canonical routes

```text
/sign-in
/onboarding/company
/onboarding/team
/onboarding/ai
/onboarding/work

/app/:companySlug/home
/app/:companySlug/needs-you
/app/:companySlug/activity
/app/:companySlug/spaces
/app/:companySlug/spaces/:spaceSlug/overview
/app/:companySlug/spaces/:spaceSlug/projects/:projectSlug
/app/:companySlug/spaces/:spaceSlug/goals
/app/:companySlug/spaces/:spaceSlug/goals/:goalId
/app/:companySlug/spaces/:spaceSlug/tasks
/app/:companySlug/spaces/:spaceSlug/tasks/:taskId
/app/:companySlug/spaces/:spaceSlug/channels
/app/:companySlug/spaces/:spaceSlug/channels/:channelSlug
/app/:companySlug/runs/:runId
/app/:companySlug/direct/:sessionId
/app/:companySlug/knowledge
/app/:companySlug/knowledge/:documentId
/app/:companySlug/team
/app/:companySlug/team/:actorId
/app/:companySlug/settings/ai
/app/:companySlug/settings/work-machines
```

Phase 0 exposes only implemented destinations. Knowledge, full Team profiles, DMs, and Work Machine administration are added to navigation when their Phase-1 vertical slice ships. No disabled Phase-2/3 navigation is shown.

### 2.2 Shell navigation

Desktop navigation has three stable bands:

1. Company attention: Home, Needs you, Activity.
2. Spaces: Whole Company first, then pinned/recent Spaces; each Space opens its last visited facet.
3. Company resources: Knowledge, Team, Settings when available.

At `>=1024px`, the shell uses a persistent rail and content area. Below `1024px`, it uses a compact header, bottom navigation for the highest-frequency destinations, and a drawer for the full hierarchy. Overlay adaptation occurs independently at `768px`.

### 2.3 Detail navigation

- Goal and Task detail are real deep-linkable routes, not temporary drawers.
- Their main content is a document-style page.
- The canonical anchored Thread is opened by URL state. A document-detail container may pin it beside the document only when its own inline size is at least the design token `--detail-split-min` (1180px); this is a component container query, not a third global shell breakpoint. Otherwise it uses a right drawer at desktop widths and a full-height sheet/page below the overlay breakpoint. It is never a permanent global AI rail.
- Run detail is route-backed progressive disclosure from a compact Run card. Direct navigation resolves the same `/runs/:runId` state; in-context navigation renders it in a drawer on desktop and a sheet/page on mobile, while browser Back restores the anchored Channel or Thread.
- Browser back restores the previous list filters, scroll position, and Space facet.

## 3. Actors, authority, and tenancy

### 3.1 Authentication and Actor resolution

QUESTPIE starter auth and Better Auth own login identities in `user`, `session`, and `account`. Autopilot owns Company participation.

1. Phase 0 uses Better Auth email/password registration and sign-in with mandatory email verification, forgot-password email, and expiring reset link. A signed-in verified `user` resolves to exactly one active Human Actor per Company.
2. Company and Space scope come from persisted relations and the authorized route context, never from a trusted client-supplied role or permission list.
3. Collection access filters every query by Companies and Spaces visible to the resolved Actor.
4. Detached AI execution uses a short-lived Agent/workload principal minted for one Run. It contains the Company, executing Agent, resolved grants, Skill revision, Run, expiry, and audience.
5. `system` remains reserved for trusted maintenance and cannot represent product Agent work.

### 3.2 Phase-0 roles

| Role | Purpose | Representative permissions |
| --- | --- | --- |
| Company Owner | Company bootstrap and irreversible governance; Human only | company.manage, members.manage, providers.manage, agents.activate, roles.manage |
| Company Admin | Operate Company settings without ownership transfer | members.manage, providers.manage, spaces.create, agents.configure |
| Company Member | Eligibility to join Spaces and collaborate | company.read, spaces.list |
| Space Lead | Manage one Space and its work | space.manage, goals.manage, tasks.manage, runs.review |
| Space Member | Daily collaboration | goal/task create/update, chat.write, runs.request |
| Space Viewer | Read-only collaboration context | visible Space read, chat.read |

`actor_role_bindings` is the only role source. Grants are the union of active exact-scope bindings: Company grants never imply access to Space content, and a Space grant cannot escape its Company. `space_memberships` records participation only and has no role override. Phase 0 ships fixed system templates `owner|admin|member` and `lead|member|viewer`; it has no per-Actor permission overrides or deny rules. Phase 1 may clone/customize definitions only after the complete permission matrix is inspectable and tested. The last Human Owner cannot leave or be suspended.

### 3.3 Fixed permission matrix

`✓` is granted by the fixed role. `—` is not granted. Effect policy may still require review even when RBAC grants the command.

#### Company scope

| Permission | Owner | Admin | Member |
| --- | :---: | :---: | :---: |
| `company.read` | ✓ | ✓ | ✓ |
| `company.update` | ✓ | ✓ | — |
| `company.transfer_ownership` / purge | ✓ | — | — |
| `members.read` | ✓ | ✓ | ✓ |
| `members.invite_suspend` | ✓ | ✓ | — |
| `roles.read` | ✓ | ✓ | — |
| `roles.manage` | ✓ | — | — |
| `providers.read` | ✓ | ✓ | — |
| `providers.connect_verify_rotate_revoke` | ✓ | ✓ | — |
| `work_machines.read` | ✓ | ✓ | — |
| `work_machines.manage` | ✓ | ✓ | — |
| `spaces.create_archive` | ✓ | ✓ | — |
| `audit.read` | ✓ | ✓ | — |

#### Space scope

| Permission | Lead | Member | Viewer |
| --- | :---: | :---: | :---: |
| `space.read` | ✓ | ✓ | ✓ |
| `space.update` / `space.members.manage` | ✓ | — | — |
| `projects.create_update_archive` | ✓ | ✓ | — |
| `goals.create_update` | ✓ | ✓ | — |
| `goals.assess_criteria` | ✓ | ✓ | — |
| `goals.request_review` | ✓ | ✓ | — |
| `goals.review_achieve_reopen` | ✓ | — | — |
| `tasks.create_update_assign_transition` | ✓ | ✓ | — |
| `tasks.review` | ✓ | ✓ when requested reviewer | — |
| `chat.read` | ✓ | ✓ | ✓ |
| `chat.write` / `runs.request` | ✓ | ✓ | — |
| `chat.manage` | ✓ | — | — |
| `knowledge.read` | ✓ | ✓ | ✓ |
| `knowledge.draft` | ✓ | ✓ | — |
| `knowledge.publish_archive` | ✓ | — | — |
| `runs.read_cancel_retry` | ✓ | own/visible request context | — |
| `runs.steer` | ✓ | own/explicitly delegated Run | — |
| `runs.approve_effect` | underlying permission + explicit approver grant | underlying permission + explicit approver grant | — |

Company Owner and Admin are Human-only fixed roles in Phase 0. Agents receive Company Member plus explicit Space bindings. This is a safety restriction on governance roles, not a different work/communication identity model. Phase 1 may introduce an audited custom Agent governance role only after request-acceptance, effect, and disclosure tests pass.

An Agent's ability to invoke any domain command is bounded by both its role permissions and its bound Skill's tool allowlist (§4.4); there is no separate internal-command risk classifier — a Company gates a command by granting or removing the permission or by omitting the tool from the Skill, the way an agent's allowed-tools are configured. Default Autopilot Skills conservatively omit irreversible governance and finalization commands (`goals.confirmAchievement`, `actors.suspend/archive`, `roleBindings.replace`); a Company may grant them explicitly. This is distinct from the effect Review Gate (§6.4), which independently governs external, destructive, financial, access-control, and cross-Space effects.

### 3.4 Agent activation and availability

Agent membership and operational readiness are distinct.

```text
membership: invited | active | suspended | deactivated
setup: pending_setup | ready | invalid
availability (derived): available | busy | unavailable | paused
```

Autopilot becomes requestable only when membership is active, at least one Space membership exists, role/permissions and Skill bindings are valid, a verified commercial Provider Connection and allowed model/runtime exist, and a compatible Work Machine is available or queueing is permitted. Setup and availability never share enum values: `ready` belongs only to setup; availability is exactly `available|busy|unavailable|paused`, accompanied by a safe reason code such as `provider_unverified`, `no_authorized_space`, `no_capacity`, or `manually_paused`.

An Agent's transition to `suspended` or `deactivated` bumps the `revocationEpoch` of its in-flight Runs, which then fail at their next boundary check (§6.1) and surface an honest terminal state rather than stopping silently. `manually_paused` is availability-only: it blocks new dispatch but does not by itself cancel an active Run, since cancellation is a separate explicit action.

## 4. Collection model

All mutable aggregates use QUESTPIE standard `id`, `createdAt`, and `updatedAt` plus an integer `version`. Invariant-bearing commands require `expectedVersion` and update by compare-and-swap; append-only event/revision rows do not mutate. Business deletion defaults to archive/deactivate. Hard deletion is limited to unreferenced setup mistakes and retention workflows. Generated collection CRUD is client-read-only by default; every product write goes through a typed command in section 12.

### 4.1 Company and collaboration collections

| Collection | Phase | Stored fields and constraints | Ownership |
| --- | --- | --- | --- |
| `companies` | 0 | `name`, unique `slug`, `status`, `locale`, `timezone`, `createdByUser`, nullable `createdByActor` backfilled during bootstrap, `version` | Autopilot |
| `actors` | 0 | `company`, `kind human|agent`, `name`, `avatar`, optional unique `(company,user)`, `membershipStatus` | Autopilot |
| `actor_invitations` | 0 | `company`, `email`, inviter, intended Company/Space roles, `status`, expiry, one-time token hash; unique active invite | Autopilot |
| `roles` | 0 | `company`, `name`, `kind system|custom`, `permissions[]`, `status`; unique `(company,name)` | Autopilot |
| `actor_role_bindings` | 0 | `actor`, `role`, `scopeType company|space`, optional `space`; unique binding | Autopilot |
| `spaces` | 0 | `company`, `name`, unique `(company,slug)`, `description`, `status`, `isWholeCompany`, `createdBy` | Autopilot |
| `space_memberships` | 0 | `space`, `actor`, `status pending|active|suspended|left`, `version`; unique `(space,actor)` | Participation only; role comes from `actor_role_bindings` |
| `projects` | 0 | `company`, required `space`, `name`, unique `(space,slug)`, `description`, `status`, `ownerActor` | Autopilot |
| `activity_events` | 0 | `company`, optional `space`, `actor`, `verb`, `subjectType`, opaque `subjectId`, optional `runRef`, redacted display metadata | User-facing projection; no polymorphic FK is implied |
| `audit_events` | 0 | append-only Actor/principal, command, `targetType/targetId` and hashes, correlation, reason, redacted before/after facts, optional Run | Immutable evidence survives target tombstone |
| `command_receipts` | 0 | Company, command kind, Actor/principal, idempotency key, normalized payload hash, status/result reference, timestamps; unique scope/key | Deterministic command retry/conflict evidence |

Company bootstrap first creates the Company using the authenticated Better Auth `user` as `createdByUser`, then creates and references the owner Human Actor in the same transaction; `createdByActor` is nullable only across this bootstrap boundary and is backfilled before commit. The transaction also creates fixed roles and bindings, Whole Company, owner membership, the protected default Channel, and default Autopilot in `pending_setup`. The default Channel is canonical everywhere as a `kind=channel` session with `systemKey=general`, `slug=general`, visible Slovak label `#general`; `(spaceId,systemKey)` and `(spaceId,slug)` are unique, while identical leaf labels/slugs in different Spaces never alias. Product contracts and fixtures do not use `#všeobecné`. System objects have stable keys independent of display names. Every active Company Actor belongs to Whole Company. Autopilot activation atomically activates its selected pending Space memberships and exact-scope role bindings; a partially active Agent is impossible. Repeated bootstrap with the same idempotency key returns the original Company.

Invitation entry at `/invite/:token` validates the token once, exchanges it for an opaque expiring server-side challenge, sets only the challenge id in an HttpOnly SameSite continuation cookie, and redirects to sign-in/registration without preserving the raw token in query strings or client storage. Invitation acceptance requires an authenticated, email-verified Better Auth user whose normalized email matches the invitation. After sign-in or verification, the continuation returns to the acceptance card. The accept transaction locks and consumes the challenge/invitation, creates or reactivates the unique `(company,user)` Human Actor, activates intended memberships and exact-scope bindings, and records a receipt. A different existing Actor/user or normalized-email conflict stops for Owner resolution; it never merges identities automatically. Resend revokes the previous token, and accept versus revoke/expiry races are decided under the same locked status/version check.

Projects inherit Space access and have no membership collection in Phase 0/1. Cross-Space moves of Projects, Goals, Tasks, Threads, or Knowledge are rejected. Within one Space, work may attach to, detach from, or switch Projects through an audited command.

Removing a Space membership that holds open accountable work is never silent: `spaceMemberships.remove` shows an impact preview and, on confirmation, cascades — Tasks the Actor was assigned return to unassigned, Goals it owned require a new owner, and pending reviews it held are reassigned or cancelled — and atomically revokes the Actor's exact-scope role bindings in the same transaction. Project archival follows the same impact-preview-and-cascade rule for the Goals, Tasks, and Channels that reference the Project.

### 4.2 Goal and Task collections

| Collection | Phase | Stored fields and constraints | Notes |
| --- | --- | --- | --- |
| `goals` | 0 | `company`, `space`, optional same-Space `project`, `title`, `status draft|active|achieved|cancelled`, optional archive metadata, `ownerActor`, current draft/published spec revision refs, optional `currentAchievementEvent`, Company-timezone `targetDate`, `createdBy`, `version` | Archive is orthogonal; activation needs at least one applicable Criterion |
| `goal_spec_revisions` | 0 schema / 1 full UI | `goal`, monotonic `revision`, six-section structured content excluding Criteria, `state draft|published|superseded`, `authoredBy`, optional `originRun`; unique `(goal,revision)` | Phase 0 edits minimal Outcome/context through the same seam; Phase 1 exposes all sections |
| `goal_criteria` | 0 | `goal`, stable identity/position, `currentRevision`, nullable `currentAssessment`, optional archive metadata, `version`; unique `(goal,position)` | Revision and assessment heads update under one row lock/CAS |
| `goal_criterion_revisions` | 0 | `criterion`, monotonic `revision`, immutable text/applicability/waiver rule, `authoredBy`, optional `originRun`; unique `(criterion,revision)` | Material edit creates a row and invalidates pending review |
| `goal_criterion_assessments` | 0 | exact `criterionRevision`, `status met|unmet|waived`, evidence references/reason, `assessedBy`, `assessedAt`, optional `supersedes`; unique assessment id | Append-only; `goal_criteria.currentAssessment` is authoritative |
| `goal_criterion_tasks` | 1 | `criterion`, `task`, `linkedBy`, optional `originRun`; unique `(criterion,task)` | Drives coverage, not achievement |
| `goal_review_criteria` | 1 | `reviewRequest`, exact `criterionRevision`, nullable exact `assessment`, immutable assessment hash | Pins complete Criterion snapshot membership |
| `goal_achievement_events` | 1 | `goal`, exact published spec revision, immutable set/hash of review-criterion rows, `achievedBy`, `achievedAt`, reason, optional `supersedes` | Append-only achievement/reopen evidence |
| `tasks` | 0 | `company`, `space`, optional same-Space `project`, optional `goal`, `title`, structured rich-text description plus plain-text projection, `status`, `priority none|low|normal|high|urgent`, optional `assigneeActor`, `reviewRequired`, optional `blockedReason/blockedBy/blockedAt`, optional Company-timezone `dueDate`, `createdBy`, `version` | One accountable assignee; default priority `none` |
| `task_events` | 0 | `task`, monotonic `revision`, `kind created|updated|assigned|transitioned|blocked|unblocked|restored`, previous/new status and assignee, reason, Actor/principal, idempotency key; unique `(task,revision)` and command key | Assignment event is the work-request anchor |
| `task_relations` | 1 | `sourceTask`, `targetTask`, `kind blocks|relates_to|duplicates`, `createdBy`; canonical orientation and unique triple | Both Tasks must belong to the same Space |
| `review_requests` | 1 | `company`, `space`, `requestedBy`, `reviewerActor`, `subjectType goal|task`, explicit nullable `goal/task` with exactly-one validation, pinned aggregate/spec revision, `status pending|accepted|returned|stopped|cancelled`, decision attribution, `version` | App review only; AI effects stay package-owned |

Task status is exactly `backlog|ready|in_progress|blocked|in_review|done|cancelled`. `blocked` requires a reason and records the prior resumable state in the blocking event. Agent assignment sets `reviewRequired=true`; such work returns to `in_review`, never directly to `done`. When `reviewRequired=false`, an authorized assignee or Lead may move `in_progress → done`. Agent Run states never become Task statuses. Assignment to an Agent is an explicit confirmed command and creates at most one work request keyed to the immutable assignment event.

The legal transition matrix is: `backlog→ready|cancelled`; `ready→in_progress|blocked|cancelled`; `in_progress→in_review|done(if !reviewRequired)|blocked|cancelled`; `blocked→the stored pre-block state|cancelled`; `in_review→done|in_progress|blocked|cancelled`; `done→ready`; `cancelled→backlog`. Cancel requires a reason. Reassigning while an Agent Run is active requires `wait` (leave assignment and Run unchanged until terminal) or `cancel_and_transfer`. The latter persists cancel, waits for a terminal acknowledgement, and only then creates the new assignment event. If the deadline expires first, a fenced-transfer transaction revokes the old Run principal, increments its revocation epoch, invalidates its worker lease/effect fence, records `timed_out`, and then creates the new assignment event. MCP and effect commits recheck both epoch and lease fence, so the old Run cannot commit after transfer. No surface writes arbitrary status values.

`blocks` is directed and acyclic. Creation serializes on a stable same-Space advisory key, rechecks the graph in the transaction, and rejects cycles under concurrent writes. `relates_to` is symmetric and stored once in canonical endpoint order. `duplicates` points from the duplicate to its canonical Task; a separate resolve-duplicate command records the edge and cancels the duplicate. All Task relations are same-Space in Phase 0/1.

Assessment locks the Criterion row, verifies `expectedVersion` and the current Criterion revision, appends one assessment whose `supersedes` matches the prior pointer, then advances `currentAssessment` and version atomically. Concurrent stale assessment loses CAS and never creates two current heads. A Goal review transaction pins the published spec revision and one `goal_review_criteria` row per current applicable Criterion. Any new spec or Criterion revision invalidates the review. A Goal can be active or achieved only with at least one non-waived applicable Criterion; an all-waived Goal derives `not_measurable` and must restore/add an applicable Criterion before achievement. `goals.confirmAchievement` appends a `goal_achievement_event` and points the Goal to it atomically; reopening appends superseding evidence rather than erasing history.

### 4.3 Conversation collections

| Collection | Phase | Stored fields and constraints | Notes |
| --- | --- | --- | --- |
| `chat_sessions` | 0 | `company`, required authorization `space`, optional same-Space `project`, `kind channel|thread|direct`, `anchorKind none|message|task|goal`, `title`, optional slug, optional `parentSession`, optional matching anchor relation, optional canonical `pairKey`, `status`, `version` | Exact kind/anchor constraints below |
| `chat_session_participants` | 1 | `session`, `actor`, `role member|owner`, `joinedAt`, optional `leftAt`; unique active `(session,actor)` | Exactly two active rows for DMs |
| `chat_messages` | 0 | `session`, server-assigned monotonic `sequence`, `authorActor`, structured rich-text JSON plus plain-text projection, unique client nonce per author/session, optional `runRef`, `editedAt`, `deletedAt`, `version`; unique `(session,sequence)` | Agent result is a separate Message |
| `chat_message_mentions` | 0 | `message`, stable rich-text `nodeId`, `mentionedActor`; unique `(message,nodeId)` | Plain text and offsets are never dispatch intent |
| `chat_read_cursors` | 1 | `session`, `actor`, monotonic `lastReadSequence`, `lastReadAt`; unique `(session,actor)` | Unread excludes own Messages and never moves backward |
| `chat_thread_follows` | 1 | `threadSession`, `actor`, reason `explicit|participated|mentioned`, status, timestamps; unique `(threadSession,actor)` | Defines reply-unread eligibility independently of cursor |

Kind constraints are exact and fail closed: a Channel has `anchorKind=none`, a required slug, optional protected `systemKey`, and no parent/anchor/pair; a Thread has exactly one message, Task, or Goal anchor and no slug/systemKey/pair; a Direct session has `anchorKind=none`, no parent/anchor/slug/systemKey, the Company's Whole Company Space as its authorization Space, exactly two active participants, and the sorted Actor-id `pairKey`. Partial unique indexes enforce one `systemKey=general` Channel per Space, local `(space,slug)` uniqueness, one Thread per anchor, and one Direct session per `(company,pairKey)`. `chat_messages.sequence` is allocated race-safely by locking the session sequence row inside the send transaction. Multi-device read advancement stores `max(current, observed)`.

`messages.send` validates session write access and structured Mention nodes, allocates sequence, persists Message, Mentions, and one `pending` `agent_work_request` per unique Agent Mention in the same transaction. QUESTPIE's realtime outbox is notification transport, not the business queue. After commit, a durable dispatcher claims pending requests with lease/attempt/dead-letter state and calls idempotent `ctx.ai.run`; reconciliation recovers stranded pending requests. Client optimistic state reconciles using `clientNonce`. Editing never dispatches, cancels, or rewrites the immutable request snapshot; deleting a trigger Message leaves a tombstone and preserves Run anchors. A direct Message to an Agent still requires a visible structured Mention.

If a Mention originates in a root Channel, `messages.send` idempotently ensures a reply Thread anchored to that triggering Message and uses it as the work/result anchor. The root shows a compact reply/Run indicator; progress and the final result Message live in the Thread. A Mention already inside a Thread or Task/Goal Thread stays there.

### 4.4 Agent application collections

| Collection | Phase | Stored fields and constraints | Notes |
| --- | --- | --- | --- |
| `agent_profiles` | 0 | unique `actor`, `instructions`, `setupStatus`, `pausedAt`, `executionPolicyRef`, display metadata | Technical configuration stays out of `actors` |
| `skills` | 0 schema / 1 management UI | `company`, `name`, `status draft|published|archived`, current published revision | Phase 0 seeds curated built-ins; a Skill is not RBAC |
| `skill_revisions` | 0 schema / 1 management UI | `skill`, revision, purpose/instructions, tool allowlist, effect ceiling, Knowledge retrieval policy, runtime requirements, budgets/limits, immutable after publish | Resolved and pinned per Run |
| `agent_skill_bindings` | 0 | `agentActor`, published Skill revision/policy, `status`, optional Space restriction; unique active binding | New revisions never mutate active Runs |
| `agent_request_policies` | 0 | `agentActor`, monotonic revision, accepted request kinds, requester/Space/Skill constraints, result projection policy, authored/published provenance | Versioned separately from RBAC |
| `agent_work_requests` | 0 | `company`, `space`, `agentActor`, `requesterActor`, `triggerType mention|task_assignment|explicit_action|delegation`, explicit nullable `message/taskEvent/parentRun/proposalTarget` relations with trigger-specific validation, exact request-policy revision, immutable request and result-anchor snapshot, `idempotencyKey`, `status pending|claimed|dispatched|dead_letter|completed`, lease/attempt fields, optional `runRef`, `version` | Explicit action covers named UI commands such as Goal breakdown; never background magic |
| `ai_proposal_batches` | 1 | `company`, `space`, `kind`, `originRun`, exact result-part hash, target aggregate/version, status draft|accepted|dismissed, `version` | Staged application proposal |
| `ai_proposal_items` | 1 | batch, stable item key, structured payload, selected/edited payload, decision Actor/time | Accepted only through typed app command |

`agent_work_requests` owns product triggers and anchors. Generic AI Runs do not know Task or Chat schema.

Before creating a Run, request acceptance verifies the requester may write/assign in the anchor and invoke that Agent for the request kind under the pinned `agent_request_policy`. It does not grant tool authority. The Agent acts under its own exact-scope bindings.

Phase-0/1 Run reads and final result projection are anchor-Space bounded by default. A privileged Agent cannot read another Space for a request merely because it can access both. Cross-Space retrieval or disclosure requires a typed `share_to_anchor` effect naming exact resource revisions and destination, authorization under both source-read and destination-share permissions, and Review Gate policy. Run Channels expose only disclosure-safe semantic activity, never raw tool output or unrestricted model deltas. The app writes a final result Message only from a package-owned `ai_result_projection` that has passed this disclosure check; access revocation or anchor archive turns projection into an attributable failed/stopped state without rerunning AI.

### 4.5 Knowledge collections

| Collection | Phase | Stored fields and constraints | Notes |
| --- | --- | --- | --- |
| `knowledge_documents` | 1 | `company`, required `space`, optional same-Space `project`, `title`, `status draft|published|archived`, current revision, `createdBy`, initial-origin kind human|agent|import | Current author/provenance derives from current revision; Company-wide Knowledge belongs to Whole Company |
| `knowledge_revisions` | 1 | `document`, monotonic revision, Markdown content, content/source fingerprint, `authoredBy`, optional `originRun`, publisher/reviewer and review date, `state`; unique `(document,revision)` | Published revision immutable |
| `knowledge_references` | 1 | `sourceType/sourceId`, optional Run relation, `documentRevision`, optional chunk locator and quote hash | Durable citation that survives source tombstone |

Phase 1 uses QUESTPIE's package-owned Search Adapter contract, initially a qualified `createPostgresSearchAdapter` plus the qualified `createPgVectorSearchAdapter`. Autopilot does not create `knowledge_index_documents`, a parallel vector table, or a search service. Published Knowledge revisions explicitly opt into the collection `.searchable(...)` contract; every secret or operational collection is explicitly disabled. QUESTPIE owns `questpie_search`, embeddings, ranking, facets, reindex jobs, and adapter migrations. Durable Knowledge documents/revisions/citations remain application domain records. If retrieval needs chunks, Phase-1 research must first qualify a generic framework chunk-source contract or model durable evidence chunks as ordinary access-controlled app records indexed through the same adapter; vector storage still remains framework-owned. Search never relies on Company/Space metadata as authorization and never falls back to an unfiltered query. Lexical search and facets stay disabled until the upstream adapter preserves the full supported access predicate AST, including `in` scopes, applies the same authorized candidate set to facet counts, fails closed on unsupported filters, and makes indexing explicit opt-in. Semantic/hybrid mode additionally stays disabled until access joins run before ranking and pagination/counts are authorization-accurate. An unavailable embedding adapter may leave qualified authorized lexical search available, but never weaken access. This is a Phase-1 qualification gate before UC-P1-002 implementation.

Runs store selected revision/chunk identifiers, hashes, scores, index version, retrieval time, and actually used citations. `agent_memory` remains a separate later execution-learning concern and is never shown as curated Company Knowledge.

### 4.6 Generic `@questpie/ai` collections

| Collection | Stored responsibility |
| --- | --- |
| `ai_runs` | Immutable attempt identity, tenant scope, requester reference, executing Agent reference, request-acceptance result, Skill revision, status, budget/admission deadlines, selected runtime/provider/model/worker snapshot, lineage, timing, terminal summary/error |
| `ai_run_events` | Per-Run monotonic `sequence`, ordered disclosure-safe semantic events and redacted evidence references; unique `(run,sequence)`; low-level events may compact into Activity Groups |
| `ai_run_commands` | Per-Run monotonic `sequence`, durable ordered `steer|cancel|retry|permission_decision|effect_review_decision` inbox with author, idempotency and delivery state; unique `(run,sequence)` |
| `ai_permission_requests` | Specific action, resource, reason, proposed scope, expiry, decision and attribution |
| `ai_effects` | Planned/started/committed/failed external or internal effects with idempotency, risk-catalog revision, exact target operation, and review requirement |
| `ai_credential_bindings` | Opaque SecretStore reference, tenant/provider binding, key version, rotated/revoked metadata; never credential material |
| `ai_provider_verification_attempts` | Immutable attempt, connection/config fingerprint, start/end, safe evidence/error, discovered catalog revision |
| `ai_run_result_parts` | Ordered immutable typed result parts with hashes, disclosure labels, redaction and retention state |
| `ai_run_citations` | Exact result part to source revision/chunk/hash relationship with retrieval evidence |
| `ai_result_projections` | App projection request/status, destination anchor, authorized resource set/hash, idempotency, attempt/error, completion reference |
| `ai_usage_ledger` | Append-only attributable provider/runtime usage and cost facts; estimates are derived separately |
| `ai_provider_definitions` | Credential-free Adapter-contributed provider catalog |
| `ai_provider_connections` | Tenant-owned logical connection, auth method, credential binding reference, verification state/evidence |
| `ai_model_offerings` | Connection-scoped discovered/catalog model capabilities with provenance and freshness |
| `ai_execution_policies` | Allowed connections, offerings, runtimes, Work Machines/pools, budget and fallback rules |
| `ai_work_machines` | Product-level logical machine, provisioning mode, readiness and coarse capability |
| `ai_workers` | Internal enrolled process/pod identity, attested capabilities, capacity, health and revocation |
| `ai_worker_enrollments` / `ai_worker_leases` | One-time expiring enrollment and fenced claim/heartbeat/cancel/finalize ownership; secrets bind exact Worker identity |

The package must not read or write `agent_work_requests`, `tasks`, `chat_messages`, or other application collections directly. An app projection consumer claims `ai_result_projections`, rechecks anchor access/archive and disclosure evidence, writes the result Message plus app activity in one transaction, and records the app reference idempotently; terminal Run commit never directly mutates app collections.

## 5. Derived read models

| Read model | Formula | Refresh path |
| --- | --- | --- |
| Goal progress | Current-version assessment: `met / (pending + met + unmet)`; waived excluded; no criteria = `not_measurable`, not 0% | Criteria + append-only assessments |
| Goal coverage | For each applicable Criterion, whether at least one non-cancelled Task link exists | Criterion-link and Task snapshots |
| Goal health | Derived from target date, unmet Criteria, blocked Tasks, pending review, failed/paused Runs | Bounded server read model/query |
| Needs you | Items requiring current Actor decision/action: assigned ready/in-progress Tasks, requested reviews, permission requests, direct Mentions; never simple status union | Server route/read model with Actor context |
| Task blocked | Stored Task status plus derived blocking relations; relation resolution never silently mutates status | Task and relation snapshots |
| Unread | Phase 1: server-sequenced Messages after Actor cursor, excluding own; reply unread counts only for followed/participated/Mentioned Threads | Message count + cursor |
| Presence | Current typed Channel roster; optional `lastSeenAt` shown only as coarse fallback | Ephemeral presence channel |
| Agent availability | Lifecycle + provider/model/runtime + Space authority + Skill + compatible Work Machine/capacity | `available|busy|unavailable|paused` with safe reason; temporary degradation remains a reason, not a fifth state |
| Run elapsed | Client clock from stored `startedAt`; stops at terminal time | Run live snapshot |

Derived models are implemented once in server read-model services and shared typed selectors. Page components do not recreate business formulas.

## 6. AI work primitive

### 6.1 Stable interface

```ts
type AiWorkInput<TContext, TResult> = {
  agent: ActorRef
  skill?: SkillRef
  instruction: string
  context: TContext
  anchorContext: AppAnchorRef
  execution?: { policy?: string; mode?: "suggest" | "run" }
  idempotencyKey: string
  tags?: Partial<Record<"feature" | "scenario" | "correlation", string>>
}

ctx.ai.suggest<TContext, TResult>(input): Promise<AiSuggestionHandle<TResult>>
ctx.ai.run<TContext, TResult>(input): Promise<AiRunHandle<TResult>>
ctx.ai.command(runId, command): Promise<AiRunSnapshot>
```

The authenticated request context identifies the requester; the input identifies only stable Agent/Skill and opaque app anchor references. The configured authority resolver loads Company, Space, executing Agent, request-policy revision, RBAC grants, disclosure boundary, Skill revision, and execution policy from persisted state. Callers cannot inject Company ids, permissions, principal claims, provider/model ids, or arbitrary trace fields. `suggest` uses the same durable execution state machine with a restricted no-effect policy. `run` returns after durable enqueue, not after model completion.

Detached work uses an audience-bound principal token with a maximum five-minute lifetime and a Run-bound refresh lease. It snapshots a `grantEpoch` and `revocationEpoch`; MCP tool entry, data read, effect planning, effect commit, Steering, and result projection all reject an expired token or changed revocation epoch and re-resolve policy at the boundary.

### 6.2 Run lifecycle

```text
requested → queued → evaluating → working → responding → completed
                          ├→ waiting_for_permission → evaluating
                          ├→ rejected
                          ├→ failed | timed_out
                          └→ cancelled

`cancel_requested` is a durable command delivery state, not a Run lifecycle state. Phase 0/1 has no generic `waiting_for_input`: ordinary Thread Messages never resume a Run implicitly. A future input-request record/command must be specified before that state can exist.
```

Known invalid setup rejects before Run creation and stores an attributable unavailable notice at the app anchor. Transient provider/capacity loss after a ready Agent is requested creates an honest queued Run with a captured admission deadline (default ten minutes), then a stable retryable failure. Phase 0 has no silent provider/model fallback. Terminal result projection is idempotent by `(runId, projectionKind)` and projection retry never reruns AI.

### 6.3 Realistic timing contract

| Moment | Trigger | Visible behavior |
| --- | --- | --- |
| Message send | Explicit send | Optimistic local Message immediately; acknowledge when the server transaction returns; preserve draft on error |
| Mention dispatch | Persisted structured Mention | Compact queued Run card after acknowledgement; never before a durable request exists |
| Evaluation | Worker claim | “Evaluating request” with elapsed time; may end in reject/permission request |
| First progress | Runtime event | No fixed promise; show queue explanation after 3s and slow-state copy after 15s |
| Response | First disclosure-safe preview part | Bounded authorized preview in Run detail; raw model/tool output is never broadcast and the Channel card stays fixed height |
| Final result | Durable terminal result | Separate Agent Message after finalization, then card collapses to summary |
| Contextual suggestion | Explicit action by default | Button → queued/loading → streamed proposal → accept/edit/dismiss; no AI call on every keystroke |
| Search/retrieval | Explicit Run need or search submit | Skeleton only after debounce/submit; cite revision and show access-safe empty state |

### 6.4 Effects and permission

- Every effect kind is classified by a versioned package-owned risk catalog; unknown kinds fail closed and require review.
- Reversible internal effects may execute only when Agent RBAC, pinned Skill policy, and the risk catalog allow them without review.
- External, destructive, financial, access-control, and `share_to_anchor` effects always require a package-owned Review Gate. There is no permission-string bypass.
- A Permission Request names one action, target, reason, scope, expiry and effect preview, and snapshots the applicable policy plus eligible approver Actor ids and routing status.
- Needs-you recipient rows are stored for each eligible approver. If the set is empty, the Run remains blocked and a separate configuration-only attention item may route to Actors who can change policy; that recipient cannot decide the effect.
- Approval requires the Human to hold both `runs.approve_effect` and the exact underlying target operation at decision time. Eligibility is re-evaluated at the decision command and never trusted from the recipient snapshot alone. It grants this Run/effect only and persists the decision in the generic command/effect state. The first valid decision resolves the Permission Request; concurrent or later decisions on the same request are rejected as stale through the ordered `ai_run_commands` inbox — the same CAS discipline used for Criterion assessment and Steering.
- Steering re-evaluates authority and effect scope.
- Every committed effect has an idempotency key and provenance.

App `review_requests` cover Goal/Task collaboration only. The generic package owns effect review and resumes the Worker from its durable command state; Autopilot merely renders an authorized projection and submits typed `effect.review_decide`.

### 6.5 Phase-0 provider and execution profile

Phase 0 supports one deliberately narrow production path behind the generic Adapter contract:

- a customer-owned Anthropic commercial API connection;
- write-only credential capture into the configured `SecretStore`;
- Adapter-owned model discovery plus a bounded real generation probe;
- one explicit eligible stable Model Offering and Runtime, with no automatic fallback;
- one Week-1 acceptance topology: `self_hosted_embedded`, a trusted in-process Worker with a concrete SecretStore and no remote enrollment dependency;
- a default 30-minute Run timeout and explicit token/spend/tool/effect ceilings;
- a default ten-minute capacity admission deadline for a previously ready Agent.

The self-hosted SecretStore uses a deployment master key outside PostgreSQL, a random per-secret data-encryption key, AES-256-GCM authenticated encryption, explicit master-key version, rotation by rewrapping, backup of ciphertext plus metadata, and operator-guided credential re-entry if the master key is lost. Secret values never cross collection APIs.

`questpie_managed` is a later production topology with its own gate: workload identity, secure one-time Worker enrollment, authenticated sandbox transport, fenced remote lifecycle, recovery ownership, backup/rotation, and managed KMS/broker. The reference remote adapter is test-only until all gates pass. Cloud management means QUESTPIE can supply capacity when the customer does not configure a Work Machine; customers may still connect their own machines. Model API usage and managed compute remain separate billable dimensions.

Verification is immediately invalidated by credential rotation/revocation, endpoint or Adapter change, or selected-model retirement. It is refreshed on a bounded schedule (default 24 hours) and on explicit operator request. Transient outages degrade availability without erasing historical verification evidence. Claude/Codex subscription OAuth and host-HOME passthrough are development-only and never a Company Provider Connection.

## 7. QUESTPIE integration

### 7.1 Application boundary

The TanStack Start application and headless QUESTPIE handler share one origin. `/api/$` delegates to `createFetchHandler(app, { basePath: "/api" })`. Browser authentication uses secure same-origin cookies. Server loaders forward the incoming cookie when prefetching protected data.

The router creates a request-scoped QueryClient on the server and passes that exact instance through typed router context and `QueryClientProvider`. A module-global server QueryClient is forbidden because it can leak cached protected data across requests. Until a request-bound QUESTPIE client forwards inbound Cookie/Authorization headers, protected SSR reads remain client-side rather than caching anonymous results. Operator-web adds the typed Better Auth React client at `/api/auth`.

`createClient<AppConfig>` and `createQuestpieQueryOptions(client, { keyPrefix: ["autopilot-v2"], locale: "sk" })` are the only frontend data gateways. Route components consume exported feature query factories; they do not call `fetch` or duplicate query keys. Every custom route declares explicit `.access(...)`; current QUESTPIE route access defaults to allow when omitted, so an access-less product route fails review.

### 7.2 Package ownership

| Package | Autopilot use |
| --- | --- |
| `questpie` | Collections, custom routes, access filters, auth context, codegen, jobs, typed Channels, realtime snapshots |
| `@questpie/tanstack-query` | Typed query/mutation options, live bounded collection snapshots, Channel presence/event adapters |
| `@questpie/ai` | Generic durable AI Runs, provider/runtime/worker scheduling, commands, permission, effects, Run Channels |
| `@questpie/mcp` | Agent-facing tools under the Run-scoped Agent principal and explicit grants |
| `@questpie/executor` | Capability broker for scoped data/services/network actions |
| `@questpie/sandbox` | Isolated execution boundary where the selected Runtime requires it |
| `@questpie/workflows` | Durable multi-step business processes; not the core one-turn Mention path |
| `@questpie/openapi` | Typed external/operator API documentation where needed |

### 7.3 Query-first reactive policy

- Lists/counts/globals use `q.collections.*.find/count(..., { realtime: true })` with bounded limits.
- Live detail temporarily uses `find({ where: { id }, limit: 1 }, { realtime: true })` until the upstream typed live-item builder lands.
- Loaders and components reuse identical option factories through `ensureQueryData` and `useQuery/useSuspenseQuery`.
- Mutations use generated options or typed domain routes. Optimistic cache changes are limited to immediate acknowledgement; authoritative snapshots reconcile them.
- Full snapshot replacement is expected. Infinite unbounded lists require pagination and non-live historical pages.
- Query invalidation uses factory keys, never hand-written key arrays.
- Workflow handlers persist explicit requester/executing Actor identity and re-check current effect policy. Their internal `system` persistence context never becomes product authority.

### 7.4 Realtime planes

Persisted truth uses collection/global live snapshots. Typed Channels carry only bounded ephemeral signals:

```text
thread-[sessionId]
  presence: safe Actor projection
  events: typing.started, typing.stopped, message.persisted, run.linked

ai-run-[runId]
  events: state.changed, activity.appended, projection.preview, command.acknowledged
```

Every subscribe/publish rule resolves Actor access to the persisted Thread or Run. A replay gap invalidates/refetches persisted state. `projection.preview` is an optional bounded, schema-validated, disclosure-checked result-part preview; it is never a raw provider token, unrestricted model delta, tool payload, prompt, or replacement for persisted result truth. Channel payloads contain no credentials, raw tool secrets, unrestricted prompts, or full chat history.

### 7.5 Required upstream framework work before honest Agent execution

1. Generic `ctx.ai.suggest/run/command` and package-owned durable Runs.
2. Agent/workload principal with short-lived Run authority.
3. MCP execution under that principal rather than stdio `system`.
4. Sandbox policy integration that fails closed and removes production `allow-all`/real-HOME defaults.
5. Runtime capability schema plus the `self_hosted_embedded` Worker/SecretStore acceptance implementation.
6. For managed/remote only: verified enrollment and complete claim/heartbeat/cancel/finalize protocol with exact identity and lease fencing.
7. Provider Connection verification and scoped credential brokerage.
8. Private typed Run Channel and persisted terminal state.

Phase 0 dogfood AI requires the explicit SecretStore, authority, Run, MCP, provider, effect, disclosure, and embedded runtime contracts above. Remote enrollment, authenticated remote sandbox transport, and remote lifecycle are not required for the chosen Week-1 embedded topology, but remain mandatory before `questpie_managed` is called production-ready. The current app has dependencies but no registered/configured acceptance path yet.

The app may link the local framework branch while these seams are implemented. The release gate records the exact framework commit, produces one semver-compatible package train newer than 3.16.0, verifies migrations against a fresh and upgraded database, updates the app lockfile, and runs contract tests in both repos. Unreleased links never pass the Phase-0 AI acceptance gate.

### 7.6 Framework capability reuse gate

The binding ownership matrix is [`docs/architecture/framework-capability-reuse.md`](docs/architecture/framework-capability-reuse.md). Every backend vertical slice names the installed framework API it reuses and keeps the Autopilot seam limited to domain policy, stable anchors, typed commands, projections, and UI. It may not add an app-owned identity/session protocol, query cache, websocket/event-store protocol, search/vector store, queue/workflow engine, MCP server, sandbox broker, durable AI state machine, or provider execution path.

Known generic gaps are upstream work, not permission for local substitutes. At the 3.16 baseline these include a general SecretStore and Provider registry/routing contract; package-owned durable AI Runs/Attempts/Commands/Effects; a typed transactional row-lock primitive; access-safe lexical Search predicates/facets with explicit opt-in; and access-filtered semantic/true hybrid pgvector retrieval. Agent workload authority, MCP, sandbox, and executor boundaries are being developed in the framework worktree but remain partially integrated and unreleased. Phase 0 may ship Human-only behavior against qualified 3.16 primitives, but Agent acceptance requires the homogeneous released package train. Phase-1 Knowledge retrieval additionally requires both lexical and semantic upstream Search qualification.

## 8. Business scenarios

| Use case | Flow | Scenario slug | Actors/roles | Required layer/fixture |
| --- | --- | --- | --- | --- |
| `UC-P0-001` | `F01` | `bootstrap-human-only-company` | Marek / Owner | real HTTP, disposable Hrebeň Company, provider absent |
| `UC-P0-002` | `F02` | `activate-autopilot-commercial-provider` | Tomáš / Admin | real secret stub + delayed/failing provider Adapter |
| `UC-P0-003` | `F03` | `create-space-project-goal-tasks` | Marek / Owner | PostgreSQL domain/route/browser |
| `UC-P0-004` | `F04` | `mention-agent-and-project-result` | Lucia / Space Member, Autopilot | real realtime + queue + delayed worker |
| `UC-P0-005` | `F05` | `assign-agent-once` | Marek / Lead, Autopilot | duplicate/replay/assignment revision matrix |
| `UC-P0-006` | `F06` | `request-run-permission` | Autopilot, authorized approver | Agent principal, MCP/effect test double |
| `UC-P0-007` | `F07` | `cancel-and-retry-run` | Lucia / Member, Marek / Lead | command inbox + capability variants |
| `UC-P0-008` | `F08` | `delegate-between-agents-safely` | Autopilot, Architect, Critic | lineage depth/cycle fixtures |
| `UC-P0-009` | `F09` | `recover-realtime-gap` | Lucia | forced SSE disconnect/replay gap |
| `UC-P0-010` | `F10` | `handle-provider-or-capacity-loss` | Tomáš, Lucia | known-invalid + transient outage clocks |
| `UC-P1-001` | `F11` | `spec-breakdown-review-achieve-goal` | Marek, Zuzana, Autopilot | revision conflict/review invalidation |
| `UC-P1-002` | `F12` | `retrieve-and-cite-knowledge` | Lucia, Autopilot | authorized search index + stale/failure states |
| `UC-P1-003` | `F13` | `configure-and-inspect-agent-peer` | Marek / Owner | role/Skill/runtime compatibility fixtures |
| `UC-P1-004` | `F14` | `direct-conversation-read-and-presence` | Lucia, Zuzana or Agent | multi-tab presence/read cursor/replay |
| `UC-P1-005` | `F15` | `steer-running-work-at-safe-boundary` | Lucia / requester, Autopilot | durable Steering inbox + capability variants |
| `UC-P1-006` | `F16` | `deepen-task-board-relations-review-and-run-controls` | Lucia / assignee, Marek / reviewer, Autopilot | Task projection/relation/review/version and Run-control fixtures |

All browser flows run with Slovak product copy and locale-independent selectors. Permission variants include allowed, read-only, denied-without-existence-leak, suspended Actor, and access revoked during an active stream.

### S0.1 — Marek creates Hrebeň without AI

1. Marek signs in and names the Company Hrebeň.
2. Bootstrap creates Marek's Human Actor, fixed roles, Whole Company, `#general`, and pending Autopilot.
3. Marek skips AI setup after seeing what will be unavailable.
4. He invites Lucia; she accepts the single-use invitation, signs in, and appears as a Human Actor without inheriting unrelated Space access.
5. Marek visits Company Home and Activity, then creates Marketing, verifies its protected `#general`, creates `#kampan` in the same Space, writes in both, switches to the separate Whole Company `#general`, and creates a Goal and a Task.
6. Autopilot is visible as `Needs setup`; mentioning it explains the gate and creates no fake Run.

Acceptance: every Human-only operation works; no provider secret is required; the setup action is visible only to authorized Actors; expired, revoked, already-used, wrong-account and resend-versus-accept invitation cases fail without duplicate Actors or widened access.

### S0.2 — Tomáš activates Autopilot

1. Tomáš opens AI setup, chooses a supported commercial Provider Definition, and enters a credential once.
2. Verification shows `verifying`, performs a bounded real test, then discovers Model Offerings.
3. Tomáš selects an allowed model/runtime, Space membership, role, and initial Skill.
4. Activation derives `ready`; it is never a raw `enabled=true` toggle.

Edge cases: invalid key, provider unavailable, verified but no supported model, compatible Worker absent, credential rotation, stale verification, duplicate submit.

### S0.3 — Marek runs the Hrebeň launch goal

1. From Marketing, Marek proves `Marketing → #general` and `Marketing → #kampan` are separate Channels and that `Celá firma → #general` remains a different Space-anchored record, then creates “Launch the summer ridge-comb campaign”.
2. He adds Criteria and activates the Goal.
3. He creates Tasks under the Goal, assigns Lucia, Zuzana, and Autopilot independently.
4. Goal progress stays based on assessed Criteria, not Task completion.

### S0.4 — Lucia mentions Autopilot in a Channel

1. Lucia types a Message and selects the structured `@Autopilot` mention.
2. Send persists Message + Mention atomically.
3. An idempotent work request and Run appear; card shows queue/evaluation/work honestly.
4. Autopilot posts a separate final Message in the same Thread.
5. Reconnect restores persisted state and resumes ephemeral progress if available.

### S0.5 — Agent assignment starts work once

Assigning a Task to Autopilot creates one Run anchored to the Task's canonical Thread. Saving other Task fields, reconnecting, or reassigning the same Actor without a new assignment event creates no Run. `Run again` creates a linked attempt.

### S0.6 — Autopilot lacks permission

Autopilot evaluates the request, resolves eligible approvers, creates a precise Permission Request plus stored Needs-you recipients, and pauses. An authorized Human approves once, denies, or opens Agent settings for a durable role change. Approval resumes the same Run; denial ends or redirects it without protected effects. If no eligible approver exists, the Run remains blocked and a configuration-only attention item explains the missing policy path without granting decision authority.

### S0.7 — Cancellation and retry

Lucia cancels a running campaign draft from Run detail. The durable command is acknowledged as queued/delivered before the Worker reaches a safe boundary. Cancellation is best-effort and never erases committed effects. `Run again` creates a linked immutable attempt with a fresh authority snapshot; it never reopens the terminal attempt.

### S0.8 — Multiple Agents and cycle guard

The fixture first activates Architect and Critic as separate Agent Actors with exact Marketing memberships, Space roles, immutable Skill/request-policy/execution-policy revisions, and compatible provider/model/runtime/Worker snapshots. Lucia then mentions both in one Message and two independent Runs appear. Missing membership, inactive state or incompatible runtime rejects before dispatch. An Agent may mention another Agent, but lineage depth is limited to three and repeated Agent-request fingerprints are rejected. The current Agent reports the stop in the Thread.

### S0.9 — Realtime gap recovers from truth

Lucia loses the SSE connection while a Thread and Run are active. The UI keeps persisted content, marks ephemeral state reconnecting, resumes from the last event id when possible, and refetches bounded collection snapshots when the server reports a replay gap. `clientNonce`, Message sequence, work-request idempotency, and projection keys prevent duplicate Messages or Runs.

### S0.10 — Provider or capacity becomes unavailable

A known-invalid Provider Connection or incompatible embedded runtime rejects before Run creation and stores an attributable unavailable notice in the anchor Thread. If a previously ready setup loses transient provider/capacity after dispatch, a queued Run shows the captured admission deadline and ends in a stable retryable failure when it expires. No fallback model or fake success is selected.

### S1.1 — Goal specification, breakdown, and review

Marek publishes a six-section Goal spec. Autopilot proposes Criteria and a Task breakdown as a staged suggestion. Marek edits and accepts selected items. Coverage shows which Criteria have Tasks, not whether they are met. Zuzana reviews the Goal and requests changes before achievement confirmation.

### S1.2 — Knowledge-grounded work

Lucia publishes Hrebeň brand guidance. A Run queries only Knowledge visible to its Agent, records exact revision citations, and includes citations in the result. Losing access prevents future retrieval but does not rewrite the historical audit reference.

### S1.3 — Human/Agent team parity

The Team directory shows Humans and Agents with the same identity grammar. Agent profile adds operational setup, Skills, RBAC, execution policy, availability reasons, and recent Runs without implying greater authority.

### S1.4 — DM and presence

Lucia opens a DM with Zuzana or an Agent. Access derives from explicit participants. Presence is ephemeral and multi-tab aware. Durable read cursors determine unread state. Mentioning an Agent in a DM follows the same work request contract.

### S1.5 — Steering reaches the next safe boundary

Lucia adds an instruction to an active Run from Run detail. The command persists with author and sequence, renders `queued|delivered|incorporated|rejected`, and is applied only at a runtime-declared safe boundary after authority re-evaluation. A terminal or incapable Run rejects Steering and offers a linked new attempt; ordinary Thread Messages never steer implicitly.

### S1.6 — Task depth preserves one truth and anchored work history

Lucia opens Needs you, switches between List and Board lenses, and sees the same versioned Task identity and filters. In Task detail she creates a same-Space relation, observes a blocker-derived waiting state, requests review in the canonical Task Thread, and Marek decides the exact Task snapshot. The linked Run card remains compact; full history and cancel/retry controls live in Run detail. Cross-Space, self, duplicate or cyclic relations, stale review decisions, unauthorized reviewers and stale-authority retries fail without partial writes or hidden-record disclosure.

### 8.1 Scenario evidence contract

| Flow | Commands | Stored truth | Derived/UI | Expected audit/effect | Negative oracle |
| --- | --- | --- | --- | --- | --- |
| F01 | `companies.bootstrap`, invitation, Space/Goal/Task/Message commands | Company graph, invitation state, Human Actors, work objects, Message | setup/invitation gate, Home, Activity, progress | bootstrap/invitation/activity receipts | no provider secret or Run; no duplicate Actor/token leak/access widening |
| F02 | provider connect/verify, Agent activate | credential binding, attempt, policy, memberships | setup/availability reason | secret-safe audit | invalid/stale/capacity cannot activate |
| F03 | Space/Channel/Project/Goal/Task commands | Space-anchored Channels/Messages plus versioned work aggregates/events | exact scope header, filters, Criterion progress | attributable activity | same leaf across Spaces never aliases; local slug conflict/cross-Space write rejected |
| F04 | `messages.send`, dispatcher, projection | Message/Mention/request/Run/result projection | compact card, Thread reply | one projection/result Message | text-only/duplicate Mention starts no extra Run |
| F05 | `tasks.assign`, dispatcher | assignment event/request/Run | assignee and Thread Run | one request per event | unrelated save/replay starts no Run |
| F06 | generic permission/effect decision | request, approver-policy snapshot, recipient routes, effect/command | Needs-you + waiting/decision/no-approver state | exact one-Run grant/effect | wrong/config-only/no approver, expiry, unknown effect, forged/stale authority, and duplicate/concurrent decision denied |
| F07 | Run cancel/retry | commands and linked attempts | acknowledgement/terminal state | cancellation/retry audit | terminal attempt never mutates |
| F08 | delegated request | exact Agent activation fixtures plus lineage/request/Run | independent cards/stop notice | depth/fingerprint evidence | inactive/incompatible Agent, depth >3 and cycle rejected |
| F09 | cursor/refetch only | unchanged persisted truth | reconnecting/reconciled | transport diagnostics | no duplicate entity after replay gap |
| F10 | provider/runtime commands | attempt/readiness/Run failure | honest unavailable/deadline | safe failure evidence | no silent fallback/fake Run |
| F11 | Goal/Review commands | revisions/snapshots/achievement events | progress/coverage/review | acceptance attribution | stale review/all-waived achievement rejected |
| F12 | Knowledge publish/search | revision/index/citation rows | indexed state/citations | retrieval evidence | unauthorized scope filtered before ranking |
| F13 | Agent/Skill/role commands | revisions/bindings/policies | readiness/profile | configuration audit | incompatible/suspended Agent unavailable |
| F14 | Direct/thread/read commands | pair session/participants/cursors | presence/unread | membership/cursor events | third participant/cursor rollback rejected |
| F15 | `runs.steer` | ordered command | queued→incorporated/rejected | authority recheck | terminal/incapable/late command rejected |
| F16 | Task/relation/review plus Run cancel/retry commands | one Task aggregate, projection state, relation graph, review snapshot and immutable Run attempts | Needs-you/List/Board lenses, anchored review, compact Run card/detail | relation/review/version/Run-command attribution | cross-Space/self/duplicate/cycle, stale/unauthorized review and stale-authority retry rejected |

Every row is verified through its named integration test and browser flow where a surface exists; the negative oracle must prove absence of unauthorized writes, leaks, duplicate dispatch, and phase-inappropriate UI.

## 9. End-to-end flows

### 9.1 Message-to-Agent result

```text
Composer
  → POST messages.send(clientNonce, body, mentionActorIds)
  → transaction: authorize + allocate sequence + Message + Mention rows
                + ensure reply Thread when root Channel Mention
                + pending agent_work_request per Agent (key = message+agent)
  → commit emits ordinary realtime invalidation
  → durable dispatcher claim/lease/retry/dead-letter
  → idempotent ctx.ai.run(...)
  → persist runRef on work request
  → live Message/Run snapshots + transient Run Channel
  → worker evaluates Agent RBAC + Skill + effect policy
  → work / Permission Request / failure
  → package terminal commit + disclosure-checked ai_result_projection
  → app projection consumer rechecks anchor/access
  → transaction: result Message(runRef) + activity + projection receipt
  → Thread snapshot replaces optimistic state
```

### 9.2 Task assignment-to-Agent result

```text
Task assignee command
  → validate assignee Space membership
  → transaction: responsibility transfer + immutable assignment event
                + canonical Task Thread + pending work request(event id)
  → durable dispatcher claim/lease/retry/dead-letter
  → ctx.ai.run
  → progress in Task Thread
  → result Message + optional permitted Task changes
```

### 9.3 Goal suggestion acceptance

```text
Explicit “Suggest breakdown”
  → ctx.ai.suggest(no-effect policy, published Goal spec revision)
  → queued/working proposal
  → durable proposal batch/items pinned to result-part hash and target version
  → Human selects/edits
  → typed domain command creates Criteria/Tasks/links atomically
  → activity records accepted subset and origin Run
```

### 9.4 Reconnect

```text
transport disconnect
  → show reconnecting without erasing content
  → SSE resumes from topic seq/channel event id
  → replay available: apply in order
  → replay gap/reset: authoritative collection refetch
  → reconcile optimistic Message by clientNonce
  → restore Run status from ai_runs
```

## 10. Screen contracts

Every screen below is composed only after its required primitives exist and pass Storybook review. Tables distinguish stored (`S`), derived (`D`), local (`L`), configuration (`CFG`), and static (`STATIC`) bindings. Combined screens label Phase-1-only controls instead of implying they ship in Week 1.

### 10.0 Sign-in and invitation acceptance

```text
QUESTPIE Autopilot
Welcome back
[ Email                         ]
[ Password                      ]
[ Sign in                      ]
[Create account] [Forgot password]
Verification sent to ma…@…       [Resend]
────────────────────────────────
Invitation to Hrebeň
Marketing · Space Member
[Accept invitation]  [Not this account]
```

| Element | Binding | Behavior/states | AI timing |
| --- | --- | --- | --- |
| Sign-in/register/reset | Better Auth identity | email/password; mandatory verification; forgot/reset expiry; pending/error/rate-limit/session redirect; never invents Actor | None |
| Invitation card | S invitation + intended bindings | token expiry, email/account mismatch, already accepted, suspended/duplicate Actor conflict | None |
| Accept action | `invitations.accept` | consumes token and binds/reactivates Human Actor atomically; retry returns receipt | None |
| Verification/invite continuation | S opaque challenge + auth state | raw invite token exchanged before auth; verified matching account returns to card | None |
| Owner controls | S invitations | resend rotates token; revoke races fail closed against accept | None |

### 10.0A Screen data and command registry

| Surface | Phase | Live query factory | Typed writes | Required exceptional states |
| --- | --- | --- | --- | --- |
| Sign-in/invite | 0 | auth session, `invitationByToken` | invitation accept/resend/revoke | expired, mismatch, duplicate, revoked |
| Company shell/Home | 0 | `companyShell`, `needsYou`, `activityFeed` | none | access revoked, reconnect, empty |
| Onboarding | 0 | `onboardingState`, provider/Agent readiness | bootstrap, invite, provider, activate | resumable, AI skipped/unavailable |
| Space/Project | 0 | `spacesVisible`, `spaceOverview`, `projectContext` | Space/Channel/Project commands | no membership, archived, slug conflict |
| Goal | 0/1 | `goalsInSpace`, `goalDetail` | Goal/Criterion/Review commands | version conflict, not measurable, stale review |
| Task | 0/1 | `tasksInSpace`, `taskDetail` | Task/Relation commands | blocked, active Run transfer, invalid transition |
| Channel/Thread | 0 | `sessionHistory`, `sessionLiveTail` | Message/Thread/Channel commands | reconnect, denied, archived, Run unavailable |
| Direct | 1 | `directSession`, `sessionHistory` | direct ensure, Message, cursor | peer suspended, Mention required, reconnect |
| Run detail | 0/1 | `runDetail`, private Run Channel | cancel/retry/permission; Steering P1 | queued, waiting permission, rejected, timed out, unavailable |
| Knowledge | 1 | `knowledgeLibrary`, `knowledgeDocument` | Knowledge commands | indexing pending/stale/failed, denied |
| Team/Agent/Skill | 1 | `actorsVisible`, `agentProfile`, `skillDetail` | Actor/role/Agent/Skill commands | suspended, incompatible, version conflict |
| AI/Work Machines | 0 setup / 1 operator | provider/policy/machine readiness | provider/Agent/machine commands | verifying, invalid, stale, no capacity |

Every query factory is request-context aware, reused by loader and component, and bounds realtime collection snapshots. No page calls raw `fetch` or writes a collection directly.

### 10.1 Company shell

```text
┌──────────────┬──────────────────────────────────────────────┐
│ HREBEŇ   ▾   │ Breadcrumb / page title        Actors   +   │
│ Home         ├──────────────────────────────────────────────┤
│ Needs you  3 │                                              │
│ Activity     │              route content                   │
│              │                                              │
│ SPACES       │                                              │
│ Whole Co.    │                                              │
│ Marketing    │                                              │
│ Product      │                                              │
│              │                                              │
│ Knowledge    │                                              │
│ Team         │                                              │
│ Settings     │                                              │
└──────────────┴──────────────────────────────────────────────┘
mobile: compact header + full content + bottom nav + IA drawer
```

| Element | Binding | Behavior/states | AI timing |
| --- | --- | --- | --- |
| Company switcher | S: visible Companies/current Company | Menu→sheet; switching clears Company-scoped cache | None |
| Attention count | D: actor-specific actionable read model | Live bounded count; access-safe empty/error | Permission/Run items appear after durable persistence |
| Space list | S: memberships + Spaces; D: recent/pinned | Route-driven active state; archived hidden | None |
| Actor presence | D: current presence roster | Compact safe projection; unknown/reconnecting state | Agent presence never substitutes Run status |
| Command entry | Route/action catalog filtered by permission | Keyboard palette; mobile full-height sheet | AI commands explicitly label that they start work |

### 10.1A Company Home, Needs you, and Activity

```text
Home / Needs you / Activity
────────────────────────────────────────────────────
Good morning, Marek
Needs you: 3             Active Goals: 2
  Review summer copy     Zuzana · Goal review
  Approve one effect     Autopilot · Run
Recent Company activity
  Lucia created “Retailer outreach”
  Autopilot completed a campaign draft
```

| Element | Binding | Behavior/states | AI timing |
| --- | --- | --- | --- |
| Home summary | D: bounded Company/visible-Space read models | Links to filtered routes; no dashboard customization | Agent counts change only from persisted state |
| Needs-you rows | D: assigned action/review/permission/Mention reasons | Exact reason and next action; pagination; safe empty/access/error | Permission/Run row appears after durable request |
| Activity rows | S/D: collaborator activity projection | Grouped, paginated, deep-linked; not security audit | Agent activity never appears before committed event |
| Route facets | URL state | Back restores selected facet and cursor | None |

### 10.2 Onboarding — Company

```text
┌──────────────────────────────────────────────┐
│ QUESTPIE                              1 / 5 │
│ Create your company                         │
│ [ Hrebeň                                  ] │
│ [ hreben                                  ] │
│                                             │
│ What is created: Whole Company, #general,  │
│ your Human Actor, pending Autopilot         │
│                              [Continue]     │
└──────────────────────────────────────────────┘
```

| Element | Binding | Behavior/states | AI timing |
| --- | --- | --- | --- |
| Company name/slug | Draft then S: `companies` | Client format + server uniqueness; preserve on error | No automatic AI naming |
| Creation preview | Static domain contract | Explains defaults, not configurable checklist | None |
| Continue | `companies.bootstrap` route | idle/loading/success/recoverable error; idempotent | None |

### 10.3 Onboarding — Team

```text
┌──────────────────────────────────────────────┐
│ Invite team                           2 / 5 │
│ Marek Hraško        Human       Owner       │
│ [email] [role]                  [Add]       │
│                                              │
│ Autopilot           Agent       Needs setup │
│                     [Configure later]        │
│                       [Skip] [Continue]      │
└──────────────────────────────────────────────┘
```

| Element | Binding | Behavior/states | AI timing |
| --- | --- | --- | --- |
| Actor rows | S: Actors/invitations/roles | Human and Agent share Actor row/chip; duplicate invite reconciles | None |
| Invite form | Domain route | Per-address validation, resend, expired/revoked states | None |
| Autopilot row | S setup + D availability | Routes to AI setup; clearly inactive | No fake activity |

### 10.4 Onboarding — AI provider and Agent gate

```text
┌──────────────────────────────────────────────┐
│ Activate Autopilot                    3 / 5 │
│ Provider     [Anthropic API          ▾]     │
│ API key      [••••••••••••••••••••••]      │
│              stored write-only               │
│ [Verify connection]                          │
│ Status: verifying / verified / exact failure │
│ Model        [available offering      ▾]     │
│ Space        [Whole Company           ▾]     │
│ Role         [Member                  ▾]     │
│ Skills       [General collaboration   ▾]     │
│                 [Set up later] [Activate]    │
└──────────────────────────────────────────────┘
```

| Element | Binding | Behavior/states | AI timing |
| --- | --- | --- | --- |
| Provider catalog | S: Provider Definitions | Supported choices before credential | None |
| Credential field | Write-only secret command | Never repopulated; paste-safe; rotate rather than reveal | None |
| Verify | S: verification attempt/evidence | Explicit action; verifying, invalid, unreachable, no model, success | Real bounded provider call; show elapsed/slow state |
| Model selector | S/D: fresh Model Offerings compatible with Runtime | Disabled until verified; retirement/stale explanations | Discovery follows verification, not instant typing |
| Agent authority | S: membership/roles/Skills/policy | Activation validates all gates atomically | None |
| Set up later | S: Agent remains pending | Human onboarding continues | Mention later explains setup gate without Run |

### 10.5 Onboarding — first Space and Goal

```text
┌──────────────────────────────────────────────┐
│ Start working                         4 / 5 │
│ [Use Whole Company] or [Create Space]       │
│ Space: Marketing                            │
│ Project (optional): Summer campaign         │
│ Members: Marek · Lucia · Autopilot          │
│                                              │
│ First Goal                           5 / 5 │
│ Launch the summer ridge-comb campaign       │
│ Criteria  [+ Add]                           │
│                              [Enter Space]  │
└──────────────────────────────────────────────┘
```

| Element | Binding | Behavior/states | AI timing |
| --- | --- | --- | --- |
| Space choice | S: Whole Company or new Space | New Space creates `#general`; memberships validated | None |
| Project | S: optional same-Space Project | Create/select/skip; no Project membership or parallel app | None |
| Member picker | S: active Company Actors | Agent uses same picker and access rule | None |
| First Goal | S after submit | May skip; creates draft/active Goal with Criteria | No background AI; Phase 1 suggestion is explicit |

### 10.5A Space directory and create

```text
Spaces                                      [+ Space]
Whole Company          14 Actors · #general
Marketing               6 Actors · 3 Goals
Product                  5 Actors · 8 Tasks

Create Space
[ Name                                  ]
[ Description                           ]
Members [Marek] [Lucia] [+]
                         [Cancel] [Create]
```

| Element | Binding | Behavior/states | AI timing |
| --- | --- | --- | --- |
| Space rows | S visible Spaces; D counts/activity | Whole Company pinned; archived omitted; denied not leaked | None |
| Create sheet/modal | L draft + Actor query | dialog `>=768`, sheet below; slug conflict and membership errors inline | None |
| Member picker | S eligible Actors | Lead/Member/Viewer binding set; active exact-scope grant only | None |
| Submit | `spaces.create` | Space, memberships/bindings, `#general`, receipt atomically | None |

### 10.5B Channel directory and management

```text
Marketing / Channels                       [+ Channel]
# general                  Default · 24 unread
# campaign-launch          8 members active

Channel settings
Name [campaign-launch]
Description [Launch coordination]
[Archive channel]                     [Save]
```

| Element | Binding | Behavior/states | AI timing |
| --- | --- | --- | --- |
| Channel list | S Space Channels; D unread | default first; live bounded counts; archived filter | Run indicators derive from Threads |
| Create/edit form | S aggregate + L draft | Lead-only; slug conflict; responsive modal/sheet | None |
| Archive/restore | Channel command | cannot archive `#general`; confirmation names impact; restore revalidates slug | Active Runs remain in durable Threads; no cancellation implied |
| Thread follow | S follow row | explicit follow/unfollow and automatic participated/Mentioned reasons | None |

### 10.6 Space overview

```text
Marketing / Overview                     [+ Create]
Goals  Tasks  Channels  Members
────────────────────────────────────────────────────
Active goals
  Summer campaign      2/4 criteria      Jun 30
Needs attention
  Review product copy  Zuzana            In review
Recent conversation
  #general             Lucia mentioned Autopilot
```

| Element | Binding | Behavior/states | AI timing |
| --- | --- | --- | --- |
| Space header/facets | S: Space; route catalog | Same contract on every Space page | None |
| Goal summary | S Goals/Criteria; D progress | Opens Goal route; empty action | Never model-generated progress |
| Attention | D authorized Space read model | Shows reason and Actor; live | Run states only after persisted transition |
| Conversation | S sessions/messages; D unread | Opens Channel/Thread | No fake typing preview |

### 10.6A Project context overview

```text
Marketing / Summer campaign                 [•••]
Overview · Goals · Tasks · Channels
────────────────────────────────────────────────────
Outcome context and owner
Goals in this Project        1 active
Tasks                        4 open · 1 blocked
Project Channels             #summer-launch
```

| Element | Binding | Behavior/states | AI timing |
| --- | --- | --- | --- |
| Project header | S: same-Space Project | Rename/archive with reference preview; no membership UI | None |
| Facets | S queries filtered by Project | Same Goal/Task/Channel rows and routes; clear Project retains Space | None |
| Summary | D bounded counts/health | Phase-1 compact overview, not a second app | Run indicators use durable snapshots only |

### 10.7 Goals list and create

```text
Goals                                      [+ Goal]
[Active] [Draft] [Achieved] [Archived]   [Search]
────────────────────────────────────────────────────
Summer campaign      Marketing   2/4     Jun 30
Wholesale launch     Whole Co.   no criteria
```

| Element | Binding | Behavior/states | AI timing |
| --- | --- | --- | --- |
| Filters/search | Route search params + S query | URL-stable, back-restorable, clear no-results | Search debounce only; no AI |
| Goal row | S Goal; D progress/health | Whole row link, quiet overflow actions | None |
| Create flow | S Space inherited, optional Project | Modal→sheet; criteria may be added inline | AI suggestion only via explicit Phase-1 action |

### 10.8 Goal detail and Phase-1 depth

```text
Summer campaign          Active      [•••]
Outcome summary                          Jun 30
Progress  2 of 4 criteria met
────────────────────────────────────────────────────
SPEC                      COVERAGE
Outcome                    ✓ Product page task
Why & context              ! No task for retailer kit
Scope
Acceptance criteria
Constraints
Deadline
────────────────────────────────────┬───────────────
Criteria and evidence               │ Goal Thread   │
Task breakdown                      │ messages/runs │
[Suggest breakdown] [Request review]│               │
```

| Element | Binding | Behavior/states | AI timing |
| --- | --- | --- | --- |
| Goal header | S Goal | Status command with confirmation for achieve/cancel/archive | None |
| Progress | D Criteria | No criteria state; waived excluded and labeled | No AI |
| Spec editor | S draft/published revisions | Autosave draft after pause; publish explicit; conflict/revision state | AI drafting only explicit per section or whole spec |
| Criteria | S first-class rows/evidence | Assess met/not met/waived with attribution | Agent may propose; Human/authorized reviewer commits |
| Coverage | D task links and non-cancelled Tasks | Missing coverage is attention, not failure | Suggest breakdown creates staged proposal |
| Review | S Review Request | Pending/changes/approved history | Agent review has real Run timing; Human review has no spinner |
| Anchored Thread | S canonical session/messages | Wide panel; drawer/sheet on narrower layout | Same compact Run card contract |

### 10.9 Tasks list/queue

```text
Tasks                                      [+ Task]
[Needs you] [My work] [Team] [All]      [List | Board]
────────────────────────────────────────────────────
◉ High  Review summer copy    Zuzana    In review
◌ Normal Prepare SKU sheet    Autopilot Working 2m
◌ Low   Retailer outreach     Lucia     Ready
```

| Element | Binding | Behavior/states | AI timing |
| --- | --- | --- | --- |
| Lenses | D actor-aware server read models | URL-stable; not hard-coded status aliases | None |
| List/board | Same S Tasks query/read model | Board added Phase 1; keyboard and mobile list fallback | None |
| Task row | S Task; D blocked/Run attention | One accountable Actor; opens route | Live Run label from durable Run snapshot |
| Quick create | Typed route | Inherits Space/filter context; preserves failed draft | Agent assignment dispatches after commit only |

### 10.10 Task detail

```text
Review summer copy                     In review
High · Marketing · Summer campaign
Assignee [Zuzana ▾]     Due [Jun 24]
────────────────────────────────────┬───────────────
Description                         │ Task Thread   │
Acceptance links                    │ Humans and    │
Relations: blocks Retailer outreach │ Agents        │
Activity / review                   │ Run cards     │
                                    │ Composer      │
```

| Element | Binding | Behavior/states | AI timing |
| --- | --- | --- | --- |
| Status/priority/due | S Task | Typed commands, optimistic label only after accepted mutation | None |
| Assignee | S Actor relation | Valid Space Actors; transfer history; one Agent assignment event | New Agent assignment creates queued card after durable work request |
| Description | S Markdown | Save conflict/offline/error preserves draft | AI rewrite is explicit suggestion, never silent |
| Criterion links | S join rows | Same Goal only; coverage updates live | Suggested link requires acceptance |
| Relations | S semantic graph | Prevent self/duplicate invalid edge; show inverse derived | None |
| Thread | S canonical session/messages; Phase-1 read cursor | Idempotently ensured on first comment, Agent assignment, Mention work, or explicit open; always the same Thread | Mention/Run contract applies |
| Review/Run control | S review + generic Run snapshots | steer/cancel/retry/permission according to RBAC | Honest acknowledgement and safe-boundary semantics |

### 10.11 Channel and Thread

```text
# general                         8 members   [Search]
────────────────────────────────────────────────────
Lucia  09:42
@Autopilot prepare three launch headlines…
  ┌ Autopilot · Working · 00:18 ────────────────┐
  │ Reviewing Hrebeň brand guidance · 4 actions │
  └──────────────────────────────────────────────┘

Autopilot 09:43
Here are three directions… [Run provenance]
────────────────────────────────────────────────────
[ + ] Message #general…                  [Send]
```

| Element | Binding | Behavior/states | AI timing |
| --- | --- | --- | --- |
| Channel header | S session/Space; D presence/unread | Search, details, access-safe member count | Presence independent from Run |
| History | S paginated Messages | Live bounded tail + historical pagination; date separators | Persisted final Agent Message only after finalization |
| Mention token | S Actor id in composer draft | Combobox filtered by session-visible Actors; structured node | Selecting does not dispatch; send does |
| Composer | Local draft + domain route | optimistic client nonce; retry/edit; 16px touch input | Message acknowledgement is not AI completion |
| Run indicator/card | S Run + D latest Activity Group | A root Mention shows compact reply/Run indicator; fixed-height card lives in its ensured Thread and opens detail | queue/evaluate/work/respond with elapsed time |
| Thread affordance | S child session | Reply count/unread; opens contextual panel/page | Root Mention work and result stay in the ensured reply Thread |

### 10.11A Direct conversation

```text
Lucia Bartošová ↔ Autopilot        Available / unavailable
────────────────────────────────────────────────────
Lucia
Could you review this later?              (no Run)

Lucia
@Autopilot review the summer copy…        (Run)
────────────────────────────────────────────────────
[ + ] Message Autopilot…                  [Send]
```

| Element | Binding | Behavior/states | AI timing |
| --- | --- | --- | --- |
| Direct header | S canonical Actor-pair session; D presence/availability | One session per pair; suspended/archived peer makes read-only | Agent availability is not Human presence |
| History/composer | Same Message contract as Channel | Private participant access; visible reminder that Agent requires Mention | Ordinary text has no AI timing because it starts no Run |
| Read state | S monotonic cursor; D unread | Observed sequence advances with debounce/max | None |
| Agent Mention/Run | S Mention/work request/Run | Exact same trigger, card, permission and result projection | Same honest lifecycle as Channel |

### 10.12 Run detail

```text
Run: Prepare launch headlines          Working 00:18
Agent Autopilot · requested by Lucia
Task/Thread anchor · model/runtime snapshot
────────────────────────────────────────────────────
Current activity
  Reviewed 3 knowledge sources
  Used 4 tools                      [Expand]
Steering (Phase 1)
  [Add instruction…]                [Send]
Permissions / effects
Evidence and citations
Attempts and lineage
                         [Cancel] [Close]
```

| Element | Binding | Behavior/states | AI timing |
| --- | --- | --- | --- |
| Identity/snapshot | S immutable Run snapshot | Shows exact Agent/requester/policy/model/runtime | None |
| Activity Groups | S immutable ordered semantic events; D package-owned grouping | Only consecutive tool call/result records in one attempt compact; show count + latest semantic label and expand full order. Permission/effect/error/Message/result/attempt boundaries always split groups | Append and regroup deterministically as persisted events arrive |
| Steering (P1) | S command inbox | Permission checked; queued/delivered/incorporated/rejected | Next safe boundary, never instant promise |
| Permission/effects | S requests/effects | Approve/deny explicit target; terminal history | Resume only after durable decision |
| Cancel/retry | S commands/attempt links | Best effort; retry creates new Run | Honest acknowledgement and terminal outcome |

### 10.13 Knowledge library and document

```text
Knowledge                                 [+ Document]
[All] [Marketing] [Product]             [Search]
Brand voice guide        Published · Human · rev 4
Retailer facts           Draft · Autopilot · rev 1

Document detail
Brand voice guide                      [Edit] [•••]
Published rev 4 · Marek · used by 6 Runs
────────────────────────────────────────────────────
Markdown content
References / provenance / revision history
```

| Element | Binding | Behavior/states | AI timing |
| --- | --- | --- | --- |
| Library | S visible Documents/current revisions | Scope filters, pagination, access/no-results | Semantic search only after submit/debounce with clear loading |
| Status/provenance | S document/revision | Agent and Human use same Actor chip plus provenance mark | Agent draft remains draft until publish permission |
| Editor | S draft revision | Explicit publish, conflict handling, revision history | Draft/summarize explicit; streamed proposal then accept |
| Usage/citations | D authorized references | Never reveals inaccessible Run details | Retrieval records citation after actual use |

### 10.14 Team directory and Agent profile

```text
Team                                      [+ Actor]
[All] [Humans] [Agents]
Marek Hraško       Human   Owner      Available
Lucia Bartošová    Human   Member     Available
Autopilot          Agent   Member     Busy

Autopilot
Identity · Spaces · Roles · Skills · Execution · Activity
Setup: Ready     Availability: Busy on 2 Runs
```

| Element | Binding | Behavior/states | AI timing |
| --- | --- | --- | --- |
| Actor rows | S Actor; D presence/availability | Same row/chip grammar for both kinds | Agent busy derives from Runs, not animation |
| Membership/RBAC | S bindings | Permission-aware editing and audit | None |
| Skills | S bindings/revisions | Enable/disable with impact preview | Verification may be explicit if runtime capability required |
| Execution policy | S provider/model/runtime/Work Machine policy | Shows incompatible/unavailable reasons separately | Provider verification is real asynchronous work |
| Recent activity | S activity/Run references | Authorized, paginated | Live active Runs use compact status |

### 10.14A Provider and Work Machine settings

```text
Settings / AI
Provider Connections
  Anthropic Production   Verified 23m ago   [Manage]
Model policy
  Claude … · no fallback

Work Machines
  Hrebeň VPS             Ready · 2/4 slots  [Open]
  QUESTPIE Managed       Ready · managed    [Open]
  (Phase 1 bounded operator view; no provisioning or pod/lease table)
```

| Element | Binding | Behavior/states | AI timing |
| --- | --- | --- | --- |
| Connection row | S provider/verification/credential metadata | Verify/rotate/revoke with reference impact and no secret reveal | Real verification attempt with elapsed/slow/error states |
| Model policy | S discovered offering + Agent policies | Retirement/stale/incompatible states; Phase 0 one explicit target | Discovery/compatibility never fabricated |
| Work Machine row | S logical machine + ownership mode; D readiness/capacity | Manual customer-machine enrollment and revoke/drain guards; deployment-provisioned managed capacity may appear read-only; guided provisioning and raw fleet tables stay later | Health follows fenced Worker heartbeat/readiness, not decorative presence |
| Managed usage | S metering ledger; D estimates | Compute/orchestration and model API separate; budgets/stops | Usage arrives after attributable provider calls |

### 10.14B Agent creation and Skill management (Phase 1)

```text
Create Agent
Name [Campaign Critic]
Spaces [Marketing]
Role [Space Member]
Skills [Copy review v3] [+ Skill]
Execution [Anthropic Production · Model · Embedded]
Request policy [Mention + assignment]
                         [Save draft] [Activate]

Skill / Copy review
Draft v4 · Published v3
Purpose · instructions · tools · effects · knowledge · limits
                              [Discard] [Publish v4]
```

| Element | Binding | Behavior/states | AI timing |
| --- | --- | --- | --- |
| Agent form | S Actor/profile/policy + L draft | creation is Human-governed; exact Space bindings; save incomplete draft | Activation verifies readiness asynchronously |
| Request policy | S immutable revision | invocation kind/requester/Space/result projection preview | New Runs pin newest published revision |
| Skill editor | S draft/published revisions | one mutable draft; publish immutable; conflict and impact preview | Optional validation is explicit, never per keystroke |
| Activation | Agent command | atomically activates membership/bindings only after all gates pass | verifying/available/unavailable with reason |

### 10.15 Archive and restore confirmation template

```text
Archive “campaign-launch”?
It disappears from normal navigation. Messages and Run evidence remain.
Active work: 1 Run · 3 Tasks
[Cancel]                           [Archive]

Restore “campaign-launch”?
Slug is now in use. [campaign-launch-2]
[Cancel]                           [Restore]
```

| Element | Binding | Behavior/states | AI timing |
| --- | --- | --- | --- |
| Impact summary | D protected references/active work | names exact object and consequences; no generic destructive copy | Active Run is shown, not silently cancelled |
| Confirmation | L explicit intent | modal `>=768`, sheet below; focus trap/restore; pending/error | None |
| Archive command | aggregate `version` | archive is read-only tombstone; protected system objects fail closed | Projection to archived anchor stops safely |
| Restore command | S tombstone + L conflict resolution | revalidates slug, membership, references and eligibility | Agent readiness recalculates after restore |

## 11. Universal screen states

Every query-backed surface specifies and tests:

1. initial loading/skeleton with `aria-busy`;
2. intrinsic empty state with one relevant next action;
3. filter/search no-results with clear-filter recovery;
4. read-only/access denied/not found without leaking existence;
5. whole-surface error with retry;
6. inline mutation error preserving input;
7. offline/reconnecting/replayed;
8. stale provider/Agent/Work Machine readiness where relevant.

## 12. Domain commands and routes

Generated collection queries are read-only from product clients. There is no generic product-write fallback. All writes use typed, explicitly access-controlled commands; internal services may use collections only behind the same domain invariants.

| Command | Atomic responsibility |
| --- | --- |
| `companies.bootstrap` | Company, owner Actor, roles, Whole Company, membership, `#general`, Autopilot |
| `invitations.issue/accept/resend/revoke` | One-time token, authenticated email binding, Actor create/reactivate, intended role/membership, expiry/revoke race |
| `spaces.create/update/archive/restore` | Space, protected system key, slug/version guards, activity |
| `spaceMemberships.add/change/remove` | Participation plus exact-scope role bindings; never implicit Company-content access; `remove` cascades open accountable work via impact preview and atomically revokes role bindings |
| `channels.create/update/archive/restore` | Channel constraint/default protection and audit |
| `threads.ensure/follow/unfollow`, `direct.ensure` | Canonical anchor/pair uniqueness, participants/follow state |
| `projects.create/rename/archive/restore/moveWork` | Same-Space optional context, protected references and activity |
| `actors.suspend/reactivate/archive`, `roleBindings.replace` | last-owner and active-work guards, exact-scope grants |
| `agents.create/configure/activate/pause/archive` | Validate provider, model, Work Machine, roles, Skills, request policy and atomic memberships |
| `skills.saveDraft/publish/bind/archive` | Versioned immutable publish and Run-safe binding |
| `providers.connect/verify/rotate/revoke` | Write-only credential, real verification, catalog refresh, audit |
| `messages.send/edit/delete` | Access, sequence, structured Message/Mentions, nonce idempotency, pending requests |
| `goals.create/update/archive/restore/publishSpec/reviseCriterion` | Aggregate CAS, immutable revisions and current pointers |
| `tasks.create/update/assign/transition/relate/archive/restore/moveProject` | Events, legal transition, canonical Thread/request, relation/scope invariants |
| `goals.assessCriterion/confirmAchievement/reopen` | Exact revision evidence, reviewer/actor attribution and append-only lifecycle events |
| `goals.acceptBreakdown` | Selected Criteria/Tasks/links with origin provenance |
| `reviews.request/decide` | Goal/Task review snapshot, decision attribution and invalidation |
| `runs.steer/cancel/retry/decidePermission`, `effects.reviewDecide` | Delegates to generic `ctx.ai.command` after app authorization |
| `knowledge.saveDraft/publish/archive/restore` | Immutable revision, index job/tombstone, provenance |
| `chat.advanceReadCursor` | Phase-1 monotonic max update after observed Message sequence |

Every side-effecting command accepts `{ idempotencyKey, expectedVersion?, correlationId? }`. `expectedVersion` is mandatory when an existing mutable aggregate is changed. Keys are scoped to Company, command kind, and initiating Actor/principal. A `command_receipts` row stores normalized payload hash and outcome: a different payload conflicts, while the same retry returns the prior result. Unique receipts protect bootstrap defaults, invites, Message sends, Mention dispatch, Agent assignments, anchored Thread creation, Run commands, effect commits, provider verification, proposal acceptance, result projection, and read-cursor advancement. Contract tests also prove direct generated create/update/delete calls are denied for every domain collection.

## 13. Lifecycle, archive, and evidence

- Product flows archive rather than hard-delete Company, Space, Project, Actor, Channel, Goal, Task, Knowledge, and Skill records.
- Archived records are read-only and excluded from normal navigation/query defaults. Restore is an explicit audited command that revalidates names, memberships, references, and provider/runtime eligibility.
- Whole Company, its default Channel, the last Human Owner, terminal Runs/effects/decisions, Message rows and threads, assessments, and audit evidence cannot be product-deleted.
- A Message body is editable in place (marked `editedAt`) or soft-deleted (`deletedAt`); unlike Goal, Knowledge, and Skill content it is deliberately not versioned, since chat is not published content. When a Message is cited as evidence, the citation snapshots the cited content so a later edit cannot rewrite it.
- Hard deletion is limited to empty unreferenced setup drafts or a separate privacy/Company purge workflow with a preview and retention policy.
- Activity is a collaborator-facing projection that may group events. Audit is append-only security evidence and is never replaced by activity or raw logs.
- Audit redaction preserves who/what/when/correlation and target hashes without secrets, credentials, unrestricted prompts, or raw sensitive tool arguments.

## 14. Verification strategy

### 14.1 Contract tests

- Collection access filters prove Company and Space isolation for Human and Agent principals.
- Authority tests prove Company grants do not imply Space reads, forged anchor/Company/permission input is ignored or rejected, and expired/revoked principal epochs fail at MCP/effect/projection boundaries.
- Disclosure tests prove request acceptance does not widen reads, cross-Space content cannot enter Run Channels/results without an authorized `share_to_anchor` effect, and access revocation stops projection without leaking existence.
- Domain routes prove idempotency under duplicate POST, outbox replay, reconnect, and worker retry.
- Generated collection create/update/delete endpoints are denied for domain collections; aggregate CAS conflicts are deterministic.
- Concurrent Message sends preserve unique monotonic session sequence; concurrent `blocks` edges cannot create a cycle.
- Run finalization proves exactly one terminal state and at most one final Agent Message per Run.
- Provider credentials never appear in collection output, logs, events, Channels, Run metadata, or test snapshots.
- Worker secret binds to exact worker identity; enrollment token is expiring and one-time.

### 14.2 Scenario tests

Each F01-F16 business scenario in section 8 becomes a named integration/e2e test. Critical negative cases include inactive Agent Mention, access denial, invalid provider, no compatible Worker, replay gap, duplicate Mention event, assignment re-save, permission denial, late Steering, cancellation after committed effect, Agent cycle guard, cross-Space/cyclic Task relations, stale review, and retry with stale authority.

### 14.3 UI gates

- Storybook must pass before page implementation for every required primitive/template.
- Screen tests run at 390, both sides of the overlay threshold (767/768), both sides of the shell threshold (1023/1024), and wide desktop.
- Keyboard, focus restoration, screen-reader names, reduced motion, 44px touch targets, 16px coarse-pointer inputs, safe-area behavior, and contrast are required.
- Inline structural styles and raw token values fail lint.
- Prefer semantic role/name locators. Where a stable test hook is necessary, use locale-independent product identifiers such as `screen-goal-detail`, `goal-criterion-row`, `task-assignee-trigger`, `chat-composer`, `message-run-card`, `run-steering-input`, and `permission-decision-approve`; never bind regression tests to Slovak copy or CSS classes.
- Real auth/cookie/redirect/realtime flows use fresh disposable Companies and real HTTP. Important flows `F01`, `F04`, `F06`, `F09`, `F11`, `F12`, and `F16` are recorded/replayed with server, browser, console, and network errors captured as evidence.

## 15. Implementation order

1. Upstream authority and durable AI Run contracts.
2. App Company/Actor/Space domain and access filters.
3. Design tokens and canonical Storybook primitives.
4. Shell and auth/onboarding templates.
5. Company bootstrap → Space → Goal → Task vertical slice.
6. Chat session/message/mention realtime vertical slice.
7. Agent provider activation and Mention/assignment Run result vertical slice.
8. Week-1 regression and dogfood gate.
9. Goal spec/Criterion coverage/review depth.
10. Task board/relations/Run controls depth.
11. Knowledge retrieval/citation depth.
12. Team/Agent profile and DM/presence depth.

No Phase-2 dashboard, mini-app, automation editor, Builder, Deploy, or guided Hetzner implementation enters the graph before the Phase-1 acceptance suite is green.

## 16. Ratified review decisions and release gates

Two independent decision reviewers examined every domain branch. This specification adopts their common recommendations and resolves their differences as follows:

- Phase 0 includes minimal optional Projects, but no parallel Project app.
- Goal specs, Skills, and Knowledge use immutable published revisions.
- Fixed roles ship before custom role authoring.
- Request acceptance is separate from Agent execution authority and prevents cross-scope disclosure.
- Task relations and supported moves remain same-Space.
- One commercial Anthropic API Adapter is the Phase-0 production path; subscription OAuth is excluded.
- Direct sessions remain explicit-Mention driven for Agents.
- Anchored Threads are idempotently created on first need rather than eagerly for every unused object.
- Knowledge ships before DMs inside Phase 1 unless dogfood evidence reverses their priority.
- Phase 0 supports multiple independent Agent requests and bounded delegation at the data/dispatch layer because Actor parity is foundational; Phase 1 exposes creation/configuration of additional Agents.
- Phase 0 exposes cancel/retry; Steering is a Phase-1 surface and capability gate.
- Week-1 acceptance uses `self_hosted_embedded`; managed remote execution is a separate later production gate.

The following are explicit blocking qualification tasks, not permission to invent behavior:

- implement and contract-test the Runtime Adapter capability schema and embedded acceptance adapter;
- implement and recovery-test the envelope-encrypted self-hosted SecretStore;
- qualify the exact-pinned Anthropic Adapter/model catalog against current provider APIs;
- release the linked framework package train, verify fresh/upgrade migrations, and pin the app lockfile;
- qualify PostgreSQL/pgvector Knowledge indexing before UC-P1-002;
- measure whether 24-hour verification freshness and ten-minute admission timeout fit dogfood operations.

If a probe fails, the associated feature remains unavailable with an honest reason. It never falls back to ambient authority, instant AI, silent data loss, or invented framework capability.
