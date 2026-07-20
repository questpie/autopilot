# ADR 0003: Conversations Use Sessions and Channels Belong to Spaces

- Status: accepted
- Date: 2026-07-19

## Context

Week 1 needs multiple named Channels, threaded replies, conversations anchored to Tasks and Goals, and a Company-wide Channel. QUESTPIE also uses the word `channel` for its realtime transport. The product Channel and transport channel must remain distinct.

## Decision

- A product Channel is a named root conversation in exactly one Space, optionally narrowed to a Project.
- A Space may contain multiple Channels and receives a default `#general` Channel when created.
- Company-wide chat is `Hrebeň → Whole Company → #general`; it does not live directly under the Company.
- Channel and Thread use one persistent `chat_sessions` conversation collection, distinguished by kind and relationships.
- A Thread is a session anchored to a Message or work object. A Task or Goal has at most one canonical anchored Thread.
- Every Message belongs to exactly one session.
- A QUESTPIE typed channel such as `thread-[sessionId]` is realtime event transport, not a product Channel.
- Persisted sessions and Messages are the source of truth. Realtime carries new events, presence, typing, and Run progress.

## Consequences

- Channels, replies, and contextual discussions do not create three competing message APIs.
- RBAC and realtime authorization always derive from a concrete Space and session.
- UI and code naming must distinguish product Channels from technical realtime channels.

## Rejected alternatives

- **Channels directly under Company:** creates a second scope and parallel authorization model.
- **Separate tables and APIs for Channels, Threads, and anchored discussion:** duplicates participants, read cursors, Messages, and realtime behavior.
- **Realtime channel as history source:** replay is not a durable database; replay gaps recover from the persistent model.
