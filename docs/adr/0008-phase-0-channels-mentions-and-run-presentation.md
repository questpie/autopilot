# ADR 0008: Phase-0 Channels, Mentions, and Run Presentation

- Status: accepted
- Date: 2026-07-19

## Context

Week-1 collaboration needs understandable Channel authorization, deterministic multi-Agent Mentions, and honest AI progress without turning the conversation into a vertically growing terminal or exposing raw tool verbosity by default.

## Decision

### Channel visibility

- In Phase 0, every Channel inherits its Space membership.
- Every Space member can discover and access every Channel in that Space.
- Per-Channel private membership is deferred to a later phase.

### Multi-Agent Mentions

- One Message may contain structured Mentions of multiple unique Agents.
- Each mentioned Agent receives one independent Run anchored to the same Message and Thread.
- Human-to-Agent and Agent-to-Agent Mentions use the same Actor model.
- Every Run carries lineage, and dispatch rejects cycles or duplicate triggers within that lineage.

### Live Run presentation

- A newly dispatched Run appears immediately as a compact live Run card linked to its triggering Message or Task.
- The inline card has a stable bounded footprint and never grows vertically with every streamed event.
- It shows status, elapsed time, the latest meaningful semantic activity, and a compact Activity Group summary.
- Consecutive low-level tool events are grouped. The collapsed state shows a count and a semantic label for the latest meaningful activity rather than raw tool names or arguments.
- Clicking or tapping the card opens full Run detail in the canonical adaptive detail surface: drawer at large widths, sheet on mobile.
- Raw technical events and evidence are secondary progressive disclosure, not default conversation content.
- On completion, the durable Agent result is stored as a separate Message linked to the Run.
- Failure and Permission Requests remain attributable Run states and do not fabricate a completed Agent Message.

## Consequences

- Phase-0 Channel RBAC stays aligned with Space RBAC and avoids premature nested membership UI.
- Multiple Agents can collaborate visibly without routing all work through Autopilot.
- Realtime activity remains honest and inspectable while the conversation stays calm and scannable.
- The design kit needs one canonical compact Run card, Activity Group, and adaptive Run-detail composition before product pages.

## Rejected alternatives

- **Private Channels in Phase 0:** adds a second membership system before the core collaboration loop is validated.
- **Only the first Mention runs:** violates structured Actor intent and makes additional Mentions misleading.
- **Autopilot coordinates every Mention:** centralizes independent Agents behind one identity.
- **Growing inline tool timeline:** destroys conversation density and foregrounds implementation noise.
- **Mutable placeholder Agent Message:** conflates transient execution with the durable result.
- **Typing indicator only:** hides queue, evaluation, permission, failure, and evidence states.
