# ADR 0011: `@questpie/ai` Is the Durable Execution Module

- Status: accepted
- Date: 2026-07-19

## Context

Autopilot could integrate Vercel AI SDK and Harness directly or use the existing `@questpie/ai` package. The current 3.16 package is shallow and product-coupled: its worker knows Autopilot `run_links`, `chat_messages`, Task/chat kinds, and knowledge projections; app code imports AI SDK wire types and resumable-stream internals; production execution currently uses `permissionMode: "allow-all"`.

That implementation shape conflicts with independent Agent authority, durable steering, Run-scoped permission, QUESTPIE Channels, sandbox capability enforcement, and reuse by other QUESTPIE applications. Direct app integration would move the same execution state machines into Autopilot rather than remove them.

## Decision

`@questpie/ai` remains and is rebuilt as the deep, domain-neutral durable AI execution Module for QUESTPIE.

- The stable request-bound Interface is centered on `ctx.ai.suggest`, `ctx.ai.run`, and a discriminated Run command operation for Steering, cancellation, retry, and permission decisions.
- The Module owns generic durable Runs, events, commands, effects, Permission Requests, idempotency, immutable attempts, lineage, worker fencing and recovery, semantic activity, and authorized realtime Run channels.
- Vercel AI SDK and Harness are internal Runtime Adapters. Their `UIMessage`, chunks, sessions, provider objects, and experimental interfaces do not define application storage or the public Run Interface.
- Autopilot owns Company Actors, team semantics, Mentions, assignment triggers, Task/Thread anchors, request-acceptance policy, human-facing Skill assignment, and the final Agent Message projection.
- A Run pins and enforces a resolved Skill execution revision while the human-facing Skill catalog and Actor binding remain application semantics.
- Agent authority is resolved from the app-owned Actor reference through a configured seam. Callers cannot supply forged scopes, and execution never falls back to ambient `system`.
- Runtime capability discovery must report Steering, resume, tool, sandbox, and model support honestly. Unsupported behavior is explicit.
- Direct AI SDK/Harness use is allowed only inside package Runtime Adapters or disposable research spikes, not in Autopilot domain routes, storage, or UI.

## Consequences

- The current app-specific `@questpie/ai` worker path must be migrated rather than extended in place as the target Interface.
- `run_links`, bespoke chat streaming, app finalization, and `permissionMode: "allow-all"` coupling must leave the generic package contract.
- The package gains significant implementation depth while Autopilot receives a small stable Interface.
- Local linking to `questpie-cms` supports rapid joint development; a framework release follows only after package and app contract tests pass.
- Provider catalogs, Provider Connections, models, workers, credentials, and routing require an explicit follow-up domain model before schema implementation.

## Rejected alternatives

- **Direct AI SDK/Harness in Autopilot:** fastest for ephemeral chat, but duplicates durable execution, security, recovery, and realtime concerns in the app.
- **Keep the current package as a thin wrapper:** preserves two-way coupling and leaks implementation knowledge through a shallow Interface.
- **Expose every provider and Harness primitive through core:** maximizes flexibility at the cost of a large unstable Interface; provider-specific behavior belongs behind capability-aware Adapters.
