# Surface Runtime Steering

Status:
- local implementation steering note
- canonical product/spec truth still lives in `/Users/drepkovsky/questpie/specs/autopilot/`
- use this note as a focused implementation guide for the next surface/runtime passes

Date:
- 2026-04-10

## Today

Current working baseline:

- surface packs are real
- provider/handler runtime is real
- Telegram is the first real stateful surface proof
- conversation bindings are real
- query vs `task_thread` routing is real
- restart-hardened Telegram edit-in-place flow is real
- task progress cards and query preview links are real

Recent cleanup:

- stale repo-local `local_specs/` snapshot removed
- legacy `templates/solo-dev/` removed
- repo now points explicitly at external canonical specs via `docs/current-truth.md`
- runtime `.worktrees/` is ignored in the repo root

## Problem

We have enough generic primitives to prove a stateful surface.
We do **not** yet have a complete, generic runtime model for Discord Gateway-style surfaces.

Current gap:

- handler SDK exists, but reference-pack adoption is incomplete
- current provider runtime is mostly one-shot handler invocation
- `conversation.ingest` + `notify.send` are not yet a complete generic surface protocol
- full Discord Gateway requires a persistent surface process, not only per-request handler execution

## Steering

Discord must be built only on generic primitives.

That means:

- no Discord-specific core branch in orchestrator
- no Discord-only routing semantics
- no special-case DB truth for Discord
- no provider-specific hidden state outside orchestrator truth

Correct model:

- pack installs provider config + handler/daemon entrypoints
- orchestrator owns tasks, runs, bindings, sessions, artifacts, previews, notifications
- surface runtime adapts channel-specific events into generic conversation/task/query actions
- surface runtime uses generic outbound operations for message send/update/delete/typing behavior
- persistent gateway surfaces run through a generic surface daemon runtime

## Required passes

### 1. Finish Handler SDK adoption

Goal:
- make Telegram the clean reference implementation for surface authoring

Deliverables:
- Telegram handler uses the shared Handler SDK directly
- no duplicated inline helper layer inside the pack handler
- stable authoring pattern for future packs

### 2. Surface Protocol V2

Goal:
- stop overloading `notify.send` for all conversation UX

Add generic surface operations:

- `conversation.send`
- `conversation.update`
- `conversation.delete`
- `conversation.typing`
- keep `conversation.ingest`
- keep `notify.send` for notification-plane delivery

Rule:
- task/query/conversation UX should use conversation operations where appropriate
- notification fanout stays on `notify.send`

### 3. Surface Daemon Runtime V1

Goal:
- support persistent stateful surfaces without introducing provider-specific core hacks

Needed for:

- Discord Gateway
- Slack socket mode
- future persistent chat/event surfaces

Requirements:

- generic daemon declaration from provider/pack config
- orchestrator-managed lifecycle
- restart/health/reconnect ownership in generic runtime
- daemon receives config + secrets and emits normalized inbound actions back to orchestrator
- orchestrator remains the source of truth

### 4. Discord Surface Pack V1

Goal:
- build Discord only after the generic substrate exists

The Discord pack should be:

- provider config
- daemon/handler entrypoints
- channel/thread binding adaptation
- generic conversation/task/query mapping

Not:

- a special hardcoded branch in core

## Guardrails

Do not:

- add Discord-specific database primitives
- bypass conversation bindings
- let the daemon become a second truth store
- invent provider-local task state
- block on app/dashboard work

Do:

- keep surfaces as packs
- keep orchestrator as truth
- keep runtime generic enough for multiple persistent surfaces

## Order

Implementation order:

1. finish Handler SDK adoption
2. implement Surface Protocol V2
3. implement Surface Daemon Runtime V1
4. build Discord Surface Pack V1

This order matters.
If Discord is started before the daemon/runtime/protocol work is done, we will reintroduce provider-specific hacks.
