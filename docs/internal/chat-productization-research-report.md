# Chat Productization Research Report

## Executive Summary

The chat stack is close to being productizable without a rewrite, but three foundational problems are holding it back:

1. `run_completed` is emitted before the final assistant message and `query.summary` are durably visible, so the FE invalidates and tears down the transient stream too early. That is the main cause of disappearing final answers, stale previews, and stream/thread mismatch.
2. The run stream has no stable replay contract. `/api/runs/:id/stream` replays all persisted events on reconnect, provides no event IDs or cursoring, and the FE blindly appends. That is the main cause of duplicate transient events and reconnect instability.
3. Composer 2.0 is blocked less by missing endpoints than by a missing shared attachment/context model. The backend already accepts and stores chat attachments, but FE types, send paths, rendering, and `buildQueryInstructions()` all ignore them.

The highest-leverage starting sequence is:

1. Fix completion ordering and stream replay.
2. Introduce one shared chat/composer state model.
3. Turn existing latent attachment support into a typed FE/BE contract.
4. Productize `/chat` as the canonical surface and demote the rail to contextual continuation.

## Critical Findings Table

| Finding | Confidence | Layer | Key Files | Smallest Credible Fix |
|---|---|---:|---|---|
| Final assistant message can disappear or never appear after completion | High | Cross-layer | `packages/orchestrator/src/api/routes/runs.ts`, `packages/orchestrator/src/providers/query-response-bridge.ts`, `apps/operator-web/src/hooks/use-auto-events.ts`, `apps/operator-web/src/features/chat/components/chat-thread.tsx`, `apps/operator-web/src/hooks/use-run-stream.ts` | Make run finalization ordered before emitting FE-visible completion. |
| Conversation preview/query summary can stay stale after completion | High | Cross-layer | `packages/orchestrator/src/api/routes/runs.ts`, `apps/operator-web/src/api/conversations.api.ts` | Complete query state before FE completion invalidation. |
| Queued follow-on runs can start invisibly | High | Cross-layer | `packages/orchestrator/src/api/routes/chat-sessions.ts`, `packages/orchestrator/src/providers/query-response-bridge.ts`, `apps/operator-web/src/hooks/use-auto-events.ts` | Emit a real `run_started` event for chat-created and drained runs. |
| Reconnect/replay duplication in the run stream | High | Cross-layer | `packages/orchestrator/src/api/routes/runs.ts`, `packages/orchestrator/src/services/runs.ts`, `apps/operator-web/src/hooks/use-run-stream.ts` | Add stable event IDs/cursoring and FE dedupe. |
| Transient stream and persisted thread do not match | High | Cross-layer | `packages/orchestrator/src/api/routes/runs.ts`, `apps/operator-web/src/features/chat/components/run-event-feed.tsx`, `apps/operator-web/src/features/chat/components/chat-thread.tsx` | Send full event payloads over SSE and remove dead `qsummary-*` assumptions. |
| Task progress duplication across restarts or different instances | High | BE | `packages/orchestrator/src/providers/task-progress-bridge.ts` | Add durable lookup for existing task-progress messages before creating a new one. |
| Standalone Chat and chat rail are two separate chat products | High | FE/Product | `apps/operator-web/src/features/chat/components/chat-screen.tsx`, `apps/operator-web/src/features/chat/components/chat-rail.tsx`, `apps/operator-web/src/features/chat/hooks/use-chat-screen.ts`, `apps/operator-web/src/features/chat/chat-workspace-context.tsx` | Extract one shared workspace/composer state model. |
| FE attachment/context support is missing even though BE already accepts it | High | Cross-layer | `packages/orchestrator/src/api/routes/chat-sessions.ts`, `apps/operator-web/src/api/chat-sessions.api.ts`, `apps/operator-web/src/api/types.ts`, `apps/operator-web/src/features/chat/components/chat-composer.tsx`, `packages/orchestrator/src/services/queries.ts` | Type/send/render attachments in FE and inject them in `buildQueryInstructions()`. |

## Current Capability Audit

| Capability | Current State | Evidence | Can Do Now With Existing Backend Support? |
|---|---|---|---|
| Slash commands | Partial, mostly UI-only | `apps/operator-web/src/features/chat/components/command-palette.tsx`, `apps/operator-web/src/features/chat/components/chat-composer.tsx` | No real semantics yet |
| Agent selection | Partial and misleading | `apps/operator-web/src/api/chat-sessions.api.ts`, `packages/orchestrator/src/api/routes/chat-sessions.ts` | Partial for new chat only |
| Mentions / `@` menu | Missing | `apps/operator-web/src/features/chat/components/chat-composer.tsx` | No |
| Clickable refs in user messages | Present | `apps/operator-web/src/lib/smart-links.tsx`, `apps/operator-web/src/features/chat/components/chat-message.tsx` | Yes |
| Clickable refs in assistant messages | Partial/inconsistent | `apps/operator-web/src/features/chat/components/chat-message.tsx`, `apps/operator-web/src/components/ui/markdown.tsx` | Yes |
| Backend attachment transport | Present but latent | `packages/orchestrator/src/api/routes/chat-sessions.ts` | Yes |
| FE attachment typing/send paths | Missing | `apps/operator-web/src/api/types.ts`, `apps/operator-web/src/api/chat-sessions.api.ts` | Yes |
| Thread attachment rendering | Missing | chat FE search | Yes |
| Long paste -> attachment | Missing | chat FE search | Yes |
| Local text upload | Missing | `apps/operator-web/src/features/chat/components/chat-composer.tsx` | Yes |
| Local binary upload | Missing | chat FE search | Partial |
| Drag and drop | Missing | chat FE search | Yes |
| Internal entity drag | Missing | route/task/file signals exist | Yes |
| Page-context injection | Missing FE UX, sufficient route signal exists | `apps/operator-web/src/hooks/use-active-view.ts`, route files | Yes |
| Assistant-visible attachment/context injection | Missing | `packages/orchestrator/src/services/queries.ts` | Needs backend work |

## Target UX Model

Canonical recommendation:

- Standalone `Chat` is the primary chat product.
- The shell sidebar context section becomes the session list in Chat mode.
- The right rail becomes a contextual continuation surface with `Open in Chat`, not a second full chat product.
- History lives in the Chat sidebar, not in a separate history mode inside the rail.
- Do not ship chat tabs yet.
- `New chat` clears the active session and keeps visible removable context chips when launched from Tasks/Files.
- Current page context should be implicit-but-visible in contextual entry points and explicit in standalone Chat home.
- Dragging tasks/files/sessions/runs/artifacts should create chips, not raw pasted text.
- Long pasted text should become an attachment around 12 lines / 1,500 chars.
- Assistant messages should stay Markdown-based, but internal refs in assistant text should become clickable.

## Recommended Data/API Model

No new endpoint is required for the initial Composer 2.0 rollout.

Recommended normalized attachment shape:

```ts
type ChatAttachment = {
  type: 'text' | 'file' | 'ref'
  source?: 'paste' | 'upload' | 'page' | 'drag'
  name?: string
  mimeType?: string
  size?: number
  content?: string
  uri?: string
  label?: string
  refType?: 'task' | 'file' | 'directory' | 'session' | 'run' | 'artifact' | 'page'
  refId?: string
  metadata?: Record<string, unknown>
}
```

Recommended contract direction:

- Reuse the existing `attachments` field on `POST /api/chat-sessions` and `POST /api/chat-sessions/:id/messages`.
- Extend FE `SessionMessage` with `attachments?: ChatAttachment[]` because backend already returns them.
- Represent page context and internal refs as `type: 'ref'` attachments.
- Extend `buildQueryInstructions()` to add a structured `## Attached Context` section.
- Copy the attachment/context snapshot used for a run into `queries.metadata` for debugging and replay.
- Enrich completion/start events with enough targeting info for FE invalidation.

## Phased Implementation Plan

1. Ordered finalization
   - Fix disappearing final messages, stale summaries, and invisible queued follow-on runs.
   - Files: `packages/orchestrator/src/api/routes/runs.ts`, `packages/orchestrator/src/providers/query-response-bridge.ts`, `apps/operator-web/src/hooks/use-auto-events.ts`, `apps/operator-web/src/hooks/use-run-stream.ts`

2. Stream identity and replay
   - Add stable replay semantics and FE dedupe.
   - Files: `packages/orchestrator/src/api/routes/runs.ts`, `packages/orchestrator/src/services/runs.ts`, `apps/operator-web/src/hooks/use-run-stream.ts`

3. Shared chat domain and structured composer state
   - Remove duplicated chat state machines.
   - Files: `apps/operator-web/src/features/chat/components/chat-screen.tsx`, `apps/operator-web/src/features/chat/components/chat-rail.tsx`, `apps/operator-web/src/features/chat/hooks/use-chat-screen.ts`

4. FE attachment typing and thread rendering
   - Make latent backend support usable in the product.
   - Files: `apps/operator-web/src/api/types.ts`, `apps/operator-web/src/api/chat-sessions.api.ts`, `apps/operator-web/src/features/chat/components/chat-composer.tsx`, `apps/operator-web/src/features/chat/components/chat-message.tsx`

5. BE attachment and page-context injection
   - Make attachments and refs visible to the model.
   - Files: `packages/orchestrator/src/api/routes/chat-sessions.ts`, `packages/orchestrator/src/services/queries.ts`

6. Long paste and local upload
   - Convert large paste to attachment and support file upload.

7. Internal drag/drop and page context pills
   - Support task/file/session/run/artifact drops.

8. Assistant ref linkification and render consistency
   - Make assistant refs clickable and unify live/persisted rendering.

9. Standalone Chat productization
   - Make `/chat` the canonical first-class surface.

10. Right rail consolidation
   - Demote the rail to contextual continuation.

11. Regression protection
   - Lock in the pipeline with route, bridge, FE hook, and e2e coverage.

## Testing / Verification Plan

- Add orchestrator route/integration coverage for ordered completion and stream replay.
- Add bridge restart recovery coverage for `TaskProgressBridge`, matching the existing `QueryResponseBridge` restart tests.
- Add FE tests for `useRunStream`, `ChatThread`, `ChatComposer`, and new-session flow.
- Add end-to-end checks for:
  - final answer never disappearing after completion
  - follow-on queued message becoming visible
  - text/file/ref attachments round-tripping and becoming model-visible
  - `Open in Chat` preserving context from Tasks/Files

## Open Questions / Decision Gates

- Make agent selection session-scoped for now, because existing-session sends do not support per-message agent override.
- Ship metadata-only binary attachments first; add VFS-backed durability later.
- Remove persistent full-history mode from the rail.
- Use implicit-but-visible page context in contextual entry points.
- Use about 12 lines / 1,500 chars as the default paste-to-attachment threshold.
- Include scope metadata now so the future scope model does not require another contract shift.
