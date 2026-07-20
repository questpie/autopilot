# ADR 0010: Run Steering Is Durable, Explicit, and Transparent

- Status: accepted
- Date: 2026-07-19

## Context

Actors need to redirect a long-running Agent without cancelling useful work or hiding intervention inside an ordinary Thread Message. Steering must survive worker reconnects, respect authorization, remain attributable, and avoid expanding the compact Run card into a raw event feed.

The installed Claude Code and Codex harness adapters already implement mid-turn `HarnessV1PromptControl.submitUserMessage`. The current `@questpie/ai` worker does not expose that control handle and only polls for cancellation, so QUESTPIE needs a durable framework-level steering seam.

## Decision

- Steering is submitted explicitly from a Run card or Run-detail surface and is always bound to one Run.
- The author must have access to the Run context and the explicit `runs.steer` permission. Merely being able to read a Run is insufficient. `ai_runs` is a persistence name, not the permission namespace.
- Steering inputs are durable, ordered, attributable records with an idempotency key and delivery state.
- A private typed QUESTPIE channel wakes the owning worker; the database inbox is the source of truth.
- The worker delivers steering through the active harness prompt control at the next safe execution boundary.
- An atomic in-flight tool call may finish before steering is incorporated. Steering never rewinds already committed effects.
- The Agent reevaluates RBAC, Skill, and effect policy after steering. Expanded scope may create a Permission Request.
- The compact card acknowledges queued and incorporated Steering without growing vertically. Full text and delivery history appear in Run detail.
- Every Actor who may inspect the Run may inspect its Steering history.
- A terminal Run rejects late Steering and offers a linked new Run instead.
- If a runtime does not support live input, the UI says so and offers cancel-and-continue as a new linked Run; it never simulates successful live Steering.

## Consequences

- QUESTPIE `@questpie/ai` needs a generic `steer` command plus a durable Run-control inbox and worker delivery loop.
- App code does not own a runtime-specific websocket or mutable prompt buffer.
- Steering remains collaborative and auditable without becoming a normal Message or triggering unrelated Mentions.
- Cancellation remains the control for work that must stop immediately; Steering is cooperative redirection.

## Rejected alternatives

- **Ordinary Thread reply as implicit Steering:** ambiguous when multiple Runs are active and can accidentally trigger Mentions.
- **Only the original requester may steer:** prevents legitimate team intervention governed by RBAC.
- **Every Run viewer may steer:** conflates read and control authorization.
- **Private hidden Steering:** damages collaboration and provenance.
- **In-memory-only control message:** is lost during worker reconnect or ownership transfer.
