# ADR 0015: AI SDK React is a view/transport adapter

- Status: accepted for Phase 0
- Date: 2026-07-19

## Context

Autopilot needs high-quality streaming AI interaction without making browser-local chat state, provider wire chunks, or an HTTP endpoint the product's source of truth. ADR 0011 already establishes `@questpie/ai` as the durable execution module. Product Channels, Messages, Threads, Runs, Attempts, Effects, and steering commands are persisted QUESTPIE records and fan out through QUESTPIE Channels.

AI SDK React's `useChat` manages client chat state and delegates requests to a pluggable transport. That is useful at the UI boundary, but its state and `UIMessage` protocol cannot replace Autopilot's persisted collaboration graph. The new shadcn chat components explicitly own scrolling and message presentation without owning messages, AI state, transport, persistence, or model state.

## Decision

- Qualify every change against the installed package documentation and source, never remembered AI SDK APIs. The Phase-0 baseline verified on 2026-07-19 is `ai@7.0.31` and `@ai-sdk/react@4.0.34`, both equal to the latest registry versions at verification time.
- Use `@ai-sdk/react` only behind `packages/ui/src/components/ai` as an optional React streaming/view adapter.
- A QUESTPIE-specific adapter maps durable query projections and authenticated commands to the presentation contract. If `useChat` is used, it receives a custom transport and stable persisted ids; it does not own authoritative history or Run lifecycle.
- QUESTPIE TanStack Query factories provide snapshots and mutation reconciliation. QUESTPIE Channels carry live Message, presence, typing, Run, Effect, and steering events. Reconnect always reconciles against persisted truth.
- `@questpie/ai` owns model execution, provider adapters, MCP, sandbox policy, durable Run semantics, recovery, and authorization. UI code cannot call a provider SDK or Harness directly.
- The CLI-owned shadcn `MessageScroller`, `Message`, `Attachment`, and `Marker` components provide behavior and accessibility. The canonical board overrides the optional Bubble visual: `ChannelThread` renders start-aligned authored rows with Markdown and typed work blocks, while `MessageComposer` is ordinary messaging. Steering remains a separate Phase-1 durable Run command.
- AI Elements is not installed in Phase 0. Its current official setup targets Next.js and overlaps the selected shadcn chat anatomy. Individual AI Elements may be reconsidered later through the shadcn registry CLI when a concrete missing capability is proven and its Vite/TanStack Start behavior is qualified.
- `useChat.stop()` is a client-stream abort, not the Autopilot Run cancellation command. Durable Stop, Cancel, and Steering actions require an authorized QUESTPIE command and persisted reconciliation; reconnect/navigation behavior stays distinct from explicit cancellation.
- Client-facing stream failures use generic copy. Provider/server error details remain in authorized diagnostics and are never rendered from `error.message`.

## Consequences

- There is one durable collaboration graph and one realtime reconciliation path.
- We can use AI SDK React streaming ergonomics without leaking its wire model into QUESTPIE collections or page code.
- Storybook can exercise AI timing and stream states with an in-memory adapter while application tests exercise the QUESTPIE adapter.
- An adapter must define idempotency, reconnect, abort, and error translation before any `useChat` surface ships.

## References

- https://ai-sdk.dev/docs/reference/ai-sdk-ui/use-chat
- https://ai-sdk.dev/docs/ai-sdk-ui/transport
- https://ui.shadcn.com/docs/components/base/message-scroller
- https://elements.ai-sdk.dev/docs/setup
- `packages/ui/node_modules/ai/docs/02-getting-started/08-tanstack-start.mdx`
- `packages/ui/node_modules/ai/docs/04-ai-sdk-ui/02-chatbot.mdx`
- `packages/ui/node_modules/ai/docs/04-ai-sdk-ui/03-chatbot-message-persistence.mdx`
- `packages/ui/node_modules/ai/docs/04-ai-sdk-ui/03-chatbot-resume-streams.mdx`
- `packages/ui/node_modules/ai/docs/04-ai-sdk-ui/21-transport.mdx`
- `packages/ui/node_modules/@ai-sdk/react/src/use-chat.ts`
- `packages/ui/node_modules/ai/src/ui/chat-transport.ts`
