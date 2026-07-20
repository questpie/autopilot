# ADR 0014: Phase 1 Deepens One Versioned Collaboration Graph

- Status: accepted
- Date: 2026-07-19

## Context

The brief describes a thin Week-1 dogfood loop and a subsequent collaborative-depth phase, but its early vision paragraph also names Artifacts, Mini-apps, and Automations as “Phase 1.” The detailed roadmap assigns those capabilities to Phase 2 and Build/Deploy to Phase 3. Without one binding boundary, implementation could repeat v1's breadth-first failure and introduce richer replacement models beside the Week-1 objects.

Phase 1 also introduces collaborative editing, review, Knowledge, DMs, and multiple Agents. Mutable JSON blobs, per-feature comment systems, and parallel Human/Agent schemas would be fast locally but expensive to reconcile once history, citations, RBAC, and realtime are live.

## Decision

### Binding phase boundary

Phase 0 is the complete thin loop:

- Shell and resumable Company onboarding;
- Whole Company plus optional operational Spaces;
- optional Space-owned Projects as create/select/filter context, not a parallel Project app;
- basic Goals and first-class Criteria;
- Tasks with one accountable Human or Agent;
- Space Channels, reply/object Threads, structured Mentions, and Message history;
- one production commercial Provider Connection and provider-gated Autopilot;
- Mention/assignment Run, compact progress, permission/failure recovery, and a separate Agent result Message.

Phase 1 deepens those same objects:

- six-section Goal specs, breakdown proposals, Criterion coverage/evidence, reviews, and achievement confirmation;
- Task queues/board, semantic relations, anchored discussion, review, and Run controls;
- curated Knowledge with retrieval evidence and citations;
- Team directory, Agent profiles, fixed RBAC inspection, versioned Skills, and multiple Agents;
- one-to-one Direct sessions, durable read cursors, and presence;
- Steering and richer Run lineage where Runtime capability is real.

Phase 0 supports the domain/dispatch contract for multiple independent Agent Mentions and depth-three guarded delegation as decided in ADRs 0008/0009, although onboarding exposes only Autopilot. Phase 1 adds the Team UI for creating/configuring additional Agents. Phase 0 exposes cancel/retry; the durable Steering inbox and UI from ADR 0010 enter the acceptance suite in Phase 1.

Artifacts, Mini-apps, Dashboards, and Automations remain Phase 2. Builder and Deploy remain Phase 3. Future destinations are not shown before their vertical slice exists.

### One graph, not replacement domains

- Phase 1 extends the Phase-0 Company, Space, Project, Actor, Goal, Criterion, Task, conversation, and Run identifiers. It does not create “advanced” duplicates.
- Every Goal, Task, Project, product Channel, anchored Thread, and Knowledge document resolves one Space authorization context. Company-wide content belongs to Whole Company.
- Project remains optional and inherits Space membership. Phase 0/1 do not support Project membership, cross-Space moves, or cross-Space Task relations.
- One `chat_sessions` primitive represents Channel, Thread, and Direct sessions through constrained kind/anchor fields. Each Task, Goal, or parent Message has at most one canonical Thread.
- A Task/Goal Thread is idempotently created on first discussion, Agent assignment, Mention work, or explicit open. Empty Threads are not provisioned for every unused object.

### Versioned intent and evidence

- Published Goal specs, Skills, and Knowledge revisions are immutable. One mutable draft may exist, and publish creates a numbered revision with Actor/Run provenance.
- Criteria remain first-class rows rather than duplicated inside the Goal spec JSON. Assessments and waivers are attributable evidence.
- Task-to-Criterion links derive coverage only. They never prove achievement.
- Goal review pins the exact spec and Criterion snapshot. A material change invalidates pending or accepted review and requires a new review before achievement confirmation.
- AI creates staged proposals or drafts. An authorized Actor's acceptance is a separate attributable command.
- Knowledge retrieval filters by Agent RBAC, Space/Project, publication state, and Skill policy before ranking; Runs retain immutable revision/chunk evidence and used citations.

### Aggregate and conversation consistency

- Mutable aggregates carry integer versions and every update command uses compare-and-swap. Product clients have read-only generated collection access; no invariant-bearing field is generically writable.
- Criteria have immutable revision rows. Goal review snapshots the exact published spec, current Criterion revisions, and current assessment ids/hashes. Achievement and reopen decisions are append-only events.
- Task assignment and transition are immutable Task events. Agent work is idempotently keyed to the assignment event. Blocking has a reason and resumable prior state; relation cycle checks serialize per Space.
- Messages have a race-safe monotonic sequence unique within a session and structured rich-text Mention nodes. Channel, Thread, and Direct constraints are enforced by checks and partial unique indexes.
- Root-Channel Agent Mentions idempotently create/reuse a reply Thread anchored to the triggering Message. Run progress and result live in that Thread; the root retains only a compact reply/Run indicator.

### AI authority and disclosure boundary

- Request acceptance, Agent authority, and result disclosure are three different checks. Request acceptance never lends the requester's or Agent's broader authority to the anchor.
- Run reads and projection are anchor-Space bounded. Cross-Space data requires a typed `share_to_anchor` effect naming exact resource revisions, source/destination authorization, and a package-owned Review Gate.
- Generic Run Channels contain only disclosure-safe semantic activity. The app projects a final result only from an authorized package result-projection record and rechecks the anchor at commit time.
- Effect classification is package-owned, versioned, and fail-closed. An approver must hold both the explicit effect-review permission and the underlying target operation; there is no broad permission bypass.
- Phase-0 Week-1 acceptance uses a trusted `self_hosted_embedded` Worker and envelope-encrypted SecretStore. Managed remote Workers remain a separate production gate.

### Collaboration depth

- Detail remains a deep-linkable document route. Discussion is an optional adaptive panel/drawer/sheet, never a permanent AI rail or second comment API.
- Phase-1 Direct sessions are one-to-one. Messages to an Agent still contain an explicit structured Mention; merely opening or writing in a DM does not implicitly invoke AI.
- Read cursors use monotonic server Message sequence. Presence is ephemeral. Agent availability is a separate derived operational fact rendered in the same identity grammar.
- Fixed Company and Space role templates ship before custom role authoring. Humans and Agents use the same bindings; only a Human may own the Company.
- Role bindings are the sole grant source; Space membership records participation and never overrides roles. Company grants do not imply Space-content access.

## Consequences

- Phase 1 can ship feature by feature without data migration from a disposable Week-1 model.
- Collaborative history, AI provenance, review, and Knowledge citations survive later edits.
- The surface count remains small: richer states live in the same routes and Storybook fixtures rather than dozens of disconnected pages.
- Project and Thread semantics remain useful without premature nested membership and workflow builders.
- Phase-2/3 capabilities can reference stable Company, Space, Project, Actor, Task, Knowledge, and Run identities later.
- Revision tables, command idempotency, review invalidation, and access-filtered retrieval add implementation depth that must be tested before UI breadth.
- The app can start domain/design implementation against QUESTPIE 3.16 APIs, but Agent execution cannot pass its gate until the required linked framework work is released and pinned.

## Rejected alternatives

- **Treat the early vision list as the Phase-1 build list:** repeats breadth-first delivery and contradicts the explicit roadmap.
- **Mutable `goals.spec` and Knowledge blobs only:** loses review targets, provenance, concurrency safety, and historical citations.
- **Separate comments, Channels, DMs, and Agent chat tables:** duplicates authorization, read state, Message behavior, and realtime.
- **Make Project a second hierarchy with membership:** competes with Space as the authorization context.
- **Implicitly invoke an Agent in every Direct Message:** violates explicit trigger semantics and makes ordinary conversation expensive and surprising.
- **Ship custom role/flow builders before fixed contracts:** expands the state space before enforcement and dogfood behavior are known.
- **Treat request acceptance as delegated authority:** turns a privileged Agent into a disclosure oracle.
- **Use generic CRUD for “simple edits”:** creates an invariant bypass and ambiguous concurrency behavior.
- **Make managed remote execution the Week-1 topology:** couples the dogfood loop to enrollment, fleet, sandbox transport, and recovery before the local contract is proven.

## Clarifies earlier decisions

- ADR 0008 remains binding for multi-Agent Mention dispatch and fixed-height Run presentation; this ADR locates additional-Agent configuration UI in Phase 1 and locates root-Channel results in an anchored reply Thread.
- ADR 0009 remains binding for depth/cycle guards and immutable attempts.
- ADR 0010 remains binding for durable Steering semantics; this ADR locates Steering acceptance in Phase 1.
- ADR 0011 remains binding for package ownership; this ADR makes the app projection consumer and disclosure gate explicit.
- ADR 0013 remains binding for Work Machines; this ADR chooses `self_hosted_embedded` only as the Week-1 acceptance topology, not as the final cloud product model.
