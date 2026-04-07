Implement `dashboard-v3` phase-by-phase from the local specs. Do not expand scope.

Read first:
- `local_specs/dashboard-v3/00-architecture.md`
- `local_specs/dashboard-v3/INTERACTION-MATRIX.md`
- `local_specs/dashboard-v3/MENTAL-MODEL-CHANGES.md`
- `local_specs/dashboard-v3/00-ui-primitives.md`
- `local_specs/dashboard-v3/CHANGELOG-v3-review.md`
- `local_specs/dashboard-v3/01-strip-and-shell.md`
- `local_specs/dashboard-v3/02-ai-chat.md`
- `local_specs/dashboard-v3/02a-onboarding-to-chat.md`
- `local_specs/dashboard-v3/02b-references-and-mentions.md`
- `local_specs/dashboard-v3/02d-inference-adapters.md`
- `local_specs/dashboard-v3/03-channels-and-dms.md`
- `local_specs/dashboard-v3/03a-user-invites.md`
- `local_specs/dashboard-v3/05-workflow.md`
- `local_specs/dashboard-v3/05a-inbox-and-notifications.md`
- `local_specs/dashboard-v3/04-fs.md`
- `local_specs/dashboard-v3/04a-artifacts-and-dashboard.md`
- `.claude/commands/dashboard-v3.md`

Core rules:
1. Interaction minimalism is mandatory. No dead-end controls. No "coming soon". No duplicate entrypoints.
2. URL is source of truth. Do not introduce redundant UI state when the route/search params already define it.
3. Reuse existing primitives and infrastructure when they already work.
4. Keep the implementation maintenance-first and MVP-first.
5. If a leaf spec conflicts with `00-architecture.md` or `INTERACTION-MATRIX.md`, treat those two as canonical.
6. `POST /api/chat-sessions` is the correct chat-session endpoint. Never use `/api/sessions` for chat.
7. Minimal visual direction: no decorative grids or glows in content areas. Motion only when it improves orientation.
8. Do not reintroduce deferred features into MVP.
9. If implementation changes the product mental model, update `local_specs/dashboard-v3/MENTAL-MODEL-CHANGES.md` in the same pass.
10. In Phase 2 chat, session = conversation thread. New chat creates sessions; `/s/:sessionId` continues them. Remove conflicting channel-first or steer-style behavior instead of preserving it.
11. Before starting Phase 3, complete the Phase 2 polish checkpoint: GPT-style composer, direct chat uploads, and DB-backed tool-call history for completed runs.
12. AI runtime and provider code must stay behind the internal `TextInference` and `EmbeddingInference` contracts. Do not leak TanStack AI, OpenRouter, or other SDK/provider-specific types into product-facing code.
13. `02d-inference-adapters.md` freezes the contract early; it is not permission to implement the full provider/preset matrix before the plan reaches Settings/general.
14. If the current chat/runtime path works but the code is tangled, do a bounded stabilization/refactor pass before adding new capability surface.

Execution mode:
- Implement one phase at a time.
- Before editing, inspect the relevant existing code paths and note what can be reused.
- After each phase, run the narrowest relevant verification possible.
- Keep diffs intentional and bounded.
- If you find a spec contradiction, stop and report it instead of guessing.

Phase order:
1. Phase 0+1: shell, routes, empty states
2. Phase 2: AI chat + onboarding
3. Phase 2 polish: composer, uploads, DB-backed tool-call history
4. Phase 2 stabilization: stream lifecycle cleanup, replay verification, maintenance-first cleanup
5. Phase 3: channels + DMs
6. Phase 4: workflow + inbox + settings
7. Phase 5: FS
8. Phase 6: polish

Output style:
- Start by summarizing what you will inspect and implement in the current phase.
- Then implement.
- End with:
  - what changed
  - any mental model changes recorded
  - what was reused
  - what was verified
  - any open risks

Current task:
Implement only the phase I specify in this session. Do not jump ahead.
