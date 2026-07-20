# ADR 0005: Agent Work Has Two Explicit Triggers

- Status: accepted
- Date: 2026-07-19

## Context

An Agent must feel like a responsive teammate without turning text matches, reconnects, or ordinary edits into duplicate work. Week 1 needs clear semantics for requesting work through chat and Tasks.

## Decision

Agent work has two explicit triggers:

1. Sending a Message containing a structured Mention of the Agent creates one Run anchored to that Message and conversation session.
2. Newly assigning a Task to the Agent creates one Run anchored to that Task and its canonical Thread.

Additional rules:

- Plain text containing an Agent name is not a Mention and starts no work.
- Editing an old Message, receiving a duplicate event, or reconnecting realtime starts no additional Run.
- Re-saving a Task already assigned to the same Agent starts no additional Run.
- An explicit `Run again` action creates a new Run linked to the earlier request.
- Before effects, the Agent evaluates the request and then accepts it, rejects it, or requests permission.
- Honest visible states are `queued`, `evaluating`, `working`, `responding`, and a terminal or paused state: `completed`, `failed`, or `waiting_for_permission`.

## Consequences

- Mention and assignment handlers require durable idempotency keys derived from the triggering event.
- Every Run has a durable anchor and returns progress and results to the relevant Thread.
- Presence or reconnect logic can never be treated as work intent.

## Rejected alternatives

- **Name matching in text:** produces accidental work and cannot preserve Mention identity.
- **Every Task update re-runs the Agent:** creates loops, duplicate cost, and unclear intent.
- **Instant assistant response:** hides queueing, evaluation, permission, and execution failure.
