Migrate the current AI provider layer to the dashboard v3 inference architecture without changing product behavior.

Read first:
- `local_specs/dashboard-v3/00-architecture.md`
- `local_specs/dashboard-v3/02-ai-chat.md`
- `local_specs/dashboard-v3/02a-onboarding-to-chat.md`
- `local_specs/dashboard-v3/02d-inference-adapters.md`
- `local_specs/dashboard-v3/04a-artifacts-and-dashboard.md`
- `local_specs/dashboard-v3/MENTAL-MODEL-CHANGES.md`
- `packages/orchestrator/src/ai/openrouter-provider.ts`
- `packages/orchestrator/src/agent/spawner.ts`
- `packages/orchestrator/src/api/routes/settings.ts`
- `apps/dashboard-v2/src/features/settings/provider-form.tsx`
- `apps/dashboard-v2/src/components/model-picker.tsx`

Task:
- Keep TanStack AI as the first runtime adapter.
- Move provider transport to a generic OpenAI-compatible layer.
- Hide TanStack/provider specifics behind internal `TextInference` and `EmbeddingInference` contracts.
- Do not expand scope into an AI SDK rewrite, durable-stream rewrite, or MCP redesign.

Execution mode:
- Do this in **two explicit phases**:
  1. `Phase A: Backend`
  2. `Phase B: Frontend`
- Finish backend first so the frontend can target stable API contracts.
- Do not merge the phases conceptually. The frontend should consume the backend contract produced in Phase A.

Target architecture:
1. Add internal inference contracts:
   - `TextInference`
   - `EmbeddingInference`
2. Add first adapters:
   - `TanStackTextInferenceAdapter`
   - `OpenAICompatibleEmbeddingAdapter`
3. Refactor current `openrouter-provider.ts` into inference-shaped naming and responsibility.
4. Make settings/onboarding/provider forms OpenAI-compatible preset based:
   - `OpenRouter`
   - `Vercel AI Gateway`
   - `OpenAI`
   - `Custom OpenAI-compatible`
5. Make `GET /api/settings/models` use normalized model discovery through the active adapter/connection.
6. Preserve manual model ID entry in the UI.
7. Keep existing chat/session behavior stable.

Hard rules:
- Product-facing code must not import vendor SDK types directly.
- Do not leak TanStack/OpenRouter/Vercel/OpenAI naming into canonical product contracts.
- Model selector must work even when `/models` returns sparse metadata.
- Keep the diff bounded. This is a refactor, not a platform rewrite.
- If you change the product mental model, update `local_specs/dashboard-v3/MENTAL-MODEL-CHANGES.md`.

## Phase A: Backend

Scope:
1. Create `packages/orchestrator/src/inference/` with contract types and adapters.
2. Move current TanStack runtime logic behind `TextInference`.
3. Move embedding logic behind `EmbeddingInference`.
4. Refactor current provider-shaped code into inference-shaped naming and ownership.
5. Replace provider-specific settings schema with OpenAI-compatible connection schema.
6. Normalize `GET /api/settings/models` around the active adapter/connection.
7. Add backend support for:
   - connection presets: `OpenRouter`, `Vercel AI Gateway`, `OpenAI`, `Custom OpenAI-compatible`
   - optional OpenAI headers: `OpenAI-Organization`, `OpenAI-Project`
   - text-model discovery
   - embedding-model discovery
   - embedding model persistence and reindex-required behavior
   - split connection validation for text vs embeddings
   - vector index metadata persistence and enforcement
   - explicit reindex lifecycle states

Backend acceptance criteria:
- product/runtime code depends on `TextInference` and `EmbeddingInference`, not vendor SDK types
- TanStack AI is reachable only through the adapter layer
- `GET /api/settings/models` returns a normalized catalog and still supports sparse `/models` responses
- there is a clear backend contract for one active workspace embedding model
- embedding model changes are treated as reindex-required, not hot-swappable
- vector index metadata includes provider/model/dimensions/distance metric/created/status
- query and write paths reject index/model/dimension mismatch
- text inference validation and embeddings validation are exposed separately
- reindex lifecycle has at least `active`, `reindexing`, and `failed`
- existing chat/session behavior still works

## Phase B: Frontend

Scope:
1. Update onboarding to use an `AI connection` step instead of provider-specific key entry.
2. Build a dynamic schema-driven connection form based on preset:
   - `OpenRouter`
   - `Vercel AI Gateway`
   - `OpenAI`
   - `Custom OpenAI-compatible`
3. Show preset-specific fields only when needed:
   - key for all presets
   - `baseURL` only for custom
   - optional `OpenAI-Organization` / `OpenAI-Project` only for OpenAI
4. Rework `model-picker.tsx` to consume the normalized backend model catalog.
5. Add both:
   - text model picker
   - embedding model picker
6. Keep manual model ID entry for both pickers.
7. Add UX for embedding lifecycle:
   - normal initial selection during onboarding/settings bootstrap
   - read-only/locked state after first index build
   - explicit reindex warning/flow if the user changes the embedding model later
8. Surface split validation results in the UI:
   - text inference valid/invalid
   - embeddings valid/invalid
9. Surface vector index/reindex state where needed for admin clarity.

Frontend acceptance criteria:
- onboarding no longer assumes OpenRouter-first behavior
- the connection form is dynamic from preset/schema, not hardcoded ad hoc branches
- the UI never exposes TanStack/provider SDK internals
- text and embedding model selection both work against the normalized backend contract
- the embedding model change UX clearly signals reindexing
- the UI does not pretend embeddings are healthy when only text inference passed
- reindex/index status is understandable to an admin user
- manual model entry still exists as fallback

## Integration Notes

- Keep old file names/routes only if needed for incremental compatibility; otherwise rename for clarity.
- If backend contract changes force a product mental model change, update `local_specs/dashboard-v3/MENTAL-MODEL-CHANGES.md`.
- Prefer backend-first commits/patches, then frontend adaptation on top.

Verification:
- typecheck
- targeted tests if they exist around settings/model routes
- manual sanity check:
  - Phase A:
    - save a preset connection through the backend
    - fetch normalized text models
    - fetch normalized embedding models if the route separates them, or verify both kinds are represented
    - validate text inference separately from embeddings inference
    - verify vector index metadata exists and mismatch protection is enforced
    - create a chat session
    - confirm streaming still works
  - Phase B:
    - load onboarding/settings
    - switch presets and confirm the dynamic form changes correctly
    - save a preset connection
    - load text model picker
    - load embedding model picker
    - verify split validation states render correctly
    - verify manual entry still works
    - verify embedding change path shows reindex warning/lock behavior

Output format:
- summarize inspected files
- describe the bounded migration plan
- explicitly separate the response into `Phase A: Backend` and `Phase B: Frontend`
- implement
- end with:
  - what changed
  - what was reused
  - what was verified
  - open risks
