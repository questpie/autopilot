# ADR 0006: A Task Has One Accountable Assignee

- Status: accepted
- Date: 2026-07-19

## Context

Human and Agent parity requires one assignment model. Multiple equal assignees would blur accountability, make Agent assignment triggers ambiguous, and complicate ownership transitions.

## Decision

- A Task may be unassigned.
- A Task has at most one accountable `assignee`, which may reference any Human or Agent Actor with access to the Task's Space.
- Other Actors collaborate as Thread participants, followers, or structured Mentions rather than additional accountable assignees.
- Changing the assignee is an explicit responsibility transfer with provenance.
- Newly assigning a Task to an Agent produces the single assignment-triggered Run defined by ADR 0005.
- Work that needs independently accountable parallel owners is represented by related Tasks.

## Consequences

- Task lists and detail surfaces always have one unambiguous accountable owner.
- The assignment event has a stable idempotency identity for Agent execution.
- Collaboration remains many-to-many without weakening accountability.

## Rejected alternatives

- **Multiple equal assignees:** obscures ownership and creates ambiguous Agent execution semantics.
- **Human-only assignee plus separate Agent field:** breaks Actor parity and duplicates UI and authorization logic.
