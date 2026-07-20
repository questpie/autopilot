# ADR 0001: A Space Owns Projects

- Status: accepted
- Date: 2026-07-19

## Context

The old wireframe implicitly merged Space and Project into one surface. The v2 brief treats them as separate concepts. Without explicit ownership, membership, visibility, navigation, Channels, and work-object authorization would be ambiguous.

## Decision

A Space is a first-class organization and authorization context below a Company and owns zero or more Projects.

- Membership, visibility, and navigation context belong to the Space.
- Every Project belongs to exactly one Space.
- Every Goal, Task, and Channel belongs to exactly one Space.
- A Goal, Task, or Channel may optionally reference a Project, but only a Project from the same Space.
- Work without a Project is valid; work without a Space is not.
- Onboarding creates a system-managed `Whole Company` Space. It is the Company's shared work context, not the Company root.
- Every Space contains a default `#general` Channel and may contain any number of additional Channels.
- A Channel never belongs directly to a Company; Company-wide communication belongs to the `Whole Company` Space.

## Consequences

- A Company can start with one Space and introduce Projects only when it needs finer grouping.
- Authorization and realtime subscriptions have one stable parent context.
- Moving a Project between Spaces is a domain operation affecting every linked object, not a plain field update.
- One Space and Channel model covers both Company-wide and narrower collaboration without parallel global permissions.
- The interface must not use Space and Project as synonyms.

## Rejected alternatives

- **Space and Project are 1:1:** preserves the old wireframe ambiguity and duplicates concepts.
- **Project owns Spaces:** makes optional Project grouping mandatory for ordinary Company work.
- **Independent parallel scopes:** complicates authorization and permits invalid cross-scope links.
- **Channels directly under Company:** creates a second scope and authorization model.
