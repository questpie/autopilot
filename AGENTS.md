<!-- agent-board:start (managed block — edit outside these markers) -->
## Agent Board

This repo uses **agent-board** as the durable store for goals, specs, tasks, knowledge, flow evidence, and board hygiene. Keep plans and decisions on the board, not only in chat. Reach for the bundled skills: `agent-board` (router/orchestrator), `agent-board-bootstrap` (new work interview), `agent-board-research` (current docs/repo discovery), `agent-board-spec` (spec/task graph), `agent-board-safe-workflow` (TDD/use-case/e2e regression gates), `agent-board-flow` (closed-loop execution), `agent-board-implement` or legacy `agent-board-worker` (one task), `agent-board-grill` (adversarial review), and `agent-board-maintenance` (cleanup/archive). Run `agent-board status` before planning.
<!-- agent-board:end -->

## Working agreement

- Repository documentation, specs, ADRs, task bodies, code, tests, and commit text are English. The product UI and fixtures are Slovak; the owner and agents may converse in Slovak.
- Use Bun and repository CLIs for installs, generators, migrations, formatting, linting, testing, and framework work. Do not hand-create generated structures when an official CLI exists.
- Read `HANDOFF.md`, the linked spec/ADR, and the active Agent Board task before changing a feature. Run `agent-board status`, claim one task, keep evidence current, and do not mark it done without its verification commands.
- Implement one vertical feature at a time: scenarios and negative oracles, backend/domain contract, query/realtime adapter, UI primitives/composites, template, page, then E2E evidence.
- Treat `docs/architecture/framework-capability-reuse.md` as a binding backend gate. Reuse QUESTPIE for auth, collections, queries, realtime, search/vector, queues, workflows, AI, MCP, sandbox, executor, storage, and secrets; when a generic contract is missing, implement and release it upstream in `questpie-cms` instead of creating an Autopilot-local substitute.
- Keep data, commands, query factories, realtime reconciliation, view projections, components, templates, and routes in separate modules. Prefer deep modules with small public interfaces over wide bags of helpers or `ReactNode` slots.
- Treat a hand-written product module approaching roughly 350 lines as an architecture-review signal, not a quota to game. Split by cohesive invariant or capability before adding more behavior; generated registry source, migrations, and scenario fixtures may be longer when their tooling or linear narrative requires it. Never replace one mega file with a shallow bag of mutually dependent helpers.
- The agent may push reviewed, gate-green work to `origin` (github.com/questpie/autopilot main) without asking (owner standing authorization, 2026-07-21). It must NOT force-push, rewrite published history, delete remote branches, or change repo/branch settings without explicit per-action confirmation — those remain destructive owner-gated operations. Preserve unrelated working-tree changes and do not switch branches while other agents share the workspace.

## Upstream dependency research protocol

- Never implement a fast-moving library from memory. Before code, inspect the version requested by `package.json`, the installed version in that package's `node_modules/<package>/package.json`, and the latest published version with the package manager or official registry CLI.
- Prefer version-matched bundled documentation and source in `node_modules` over web articles. Search with `rg`, read the relevant files completely enough to establish the exact API, defaults, failure semantics, and exports, and cite the inspected paths in Agent Board evidence.
- If bundled docs do not answer the question, use only the dependency's official current documentation or repository. Do not infer an API that is absent from both installed source and official docs.
- If an official upstream skill exists, load it first with `bunx skills use`, capture and read its complete output, and resolve relative references from the supporting-files directory it reports.
- Install dependencies through Bun with intentional, exact versions. Add provider/framework packages only when a concrete module imports them; never add an unused dependency “for later.”
- After a dependency-backed change, run the narrow package typecheck/test first, then the root lint/typecheck/test gates. A type error is a signal to re-read installed source, not to cast around the contract.
- Model ids, provider catalogs, CLI flags, and experimental APIs are always runtime/version data. Fetch or inspect them; never recall them from training data.
- Every hand-written QUESTPIE custom route declares `.access(...)` explicitly. Collection defaults do not make an omitted route rule safe; the boundary lint rejects the omission.
- Keep MCP generic discovery fail-closed. Add only named tools/resources with explicit user or released Agent-workload policy; never use ambient stdio `system` authority for Autopilot Agents.
- Framework-generated persistence namespaces (`questpie_*`, `wf_*`, package-owned `ai_*`) are not app collection names. Product code may define domain records and thin adapters, never parallel framework tables.
- One-turn Mention/assignment dispatch is a typed job, not a Workflow. Crash-safe dispatch must consume the released QUESTPIE transactional-outbox seam; do not add an app polling queue or treat fire-and-forget `onAfterCommit()` as durable delivery.

## AI SDK contract

- Before every AI SDK change, run `bunx skills use "https://github.com/vercel/ai" --skill "ai-sdk"` and follow the generated instructions. Inspect `packages/ui/node_modules/ai/docs`, `packages/ui/node_modules/ai/src`, and installed framework/provider package source such as `packages/ui/node_modules/@ai-sdk/react/src`.
- At the currently qualified baseline, `ai` is `7.0.31` and `@ai-sdk/react` is `4.0.34`; these numbers are evidence, not an assumption for future work. Re-check installed and latest versions each time.
- `@questpie/ai` owns model execution, provider selection, tools, MCP, sandbox policy, authorization, durable Runs, attempts, recovery, and effects. Application/UI code does not call provider SDKs or Harness directly.
- QUESTPIE collections are durable truth. TanStack Query owns snapshots and mutation reconciliation; QUESTPIE Channels carry live events. `useChat` explicitly owns a client-side message/status store, so it may only sit behind a documented transient adapter with stable persisted ids and a custom QUESTPIE transport. It cannot replace persisted Channel, Message, Thread, Run, or steering state.
- AI SDK `UIMessage`/`UIMessageChunk` are boundary/wire types, not QUESTPIE collection schemas. Map them at the adapter boundary and validate untrusted UI messages server-side before model conversion.
- The installed React hook exposes only `submitted | streaming | ready | error`. Render those as realistic transient timing; do not invent lifecycle states. Show generic client errors and keep server/provider details in authorized diagnostics.
- `useChat.stop()` aborts the current client stream. In resumable/durable execution it does not cancel underlying work. Product Stop/Cancel/Steer actions must call an explicit authorized QUESTPIE command, persist the intent, and reconcile through Run state.
- Never use a default `/api/chat` route accidentally. A `useChat` integration must declare an authenticated custom `ChatTransport`, idempotency/reconnect behavior, persisted-id reconciliation, and tests for disconnect versus explicit cancellation.
- Do not install AI Elements in Phase 0 unless a named missing UI capability, TanStack Start qualification, shadcn CLI dry-run, and design-system review justify the overlap. The selected base anatomy is the CLI-owned shadcn chat set.

## Code quality toolchain

- Use the root-pinned OXC toolchain through Bun: `bun run format` writes formatting, `bun run format:check` verifies it, and `bun run lint` runs Oxlint plus the repository's custom no-inline-style guard. Run both checks before handoff.
- Keep `.oxfmtrc.json` and `.oxlintrc.json` as the shared source of truth. Do not bypass generated-file ignores, downgrade correctness rules, remove React/TypeScript/import-boundary coverage, or remove `scripts/lint-no-inline-styles.ts` without explicit approval.
- Apps consume UI and AI presentation through `@questpie/ui`; direct imports from Base UI, shadcn internals, `ai`, or `@ai-sdk/*` are lint errors.
- Oxlint's current type-aware mode requires the separate `oxlint-tsgolint` package. Until that dependency is deliberately qualified, `bun run check-types` remains the TypeScript semantic gate; Oxlint does not replace it.

## UI engineering contract

- Before every shadcn change, run `bunx skills use "https://github.com/shadcn/ui" --skill "shadcn"`, read the complete generated output and supporting files, then inspect the current project with the CLI. Do not rely on remembered Radix-era APIs in a Base UI project.
- `packages/ui` is a shadcn-managed product UI system using the `base-nova` preset, Base UI, Tailwind CSS v4, and Bun. Run `bunx --bun shadcn@latest info`, `search`, `docs`, and `add --dry-run` before every deliberate `add`; never use `--all`, hand-copy registry source, or overwrite customized components without explicit approval.
- Keep upstream source components one module per file in `packages/ui/src/components/ui`. Put domain-free product assemblies in `components/composites`, AI presentation and adapters in `components/ai`, and query-free screen assemblies in `components/templates`. Barrel files export only; they never contain implementations.
- Apps import the public `@questpie/ui` surface. They do not import Base UI, shadcn internals, or AI SDK UI components directly. Data fetching and realtime state stay outside `packages/ui`.
- TanStack Start owns theme state through `apps/operator-web/src/lib/theme`, adapted from the accepted WellDone2094 TanStack Start provider. Do not install or import `next-themes`. `packages/ui` components accept resolved theme props when needed and never import an app provider.
- Use shadcn composition rules: semantic tokens, `FieldGroup` + `Field`, Base UI `render`, titled overlays, grouped items, `Spinner` + `disabled` for pending buttons, and the official chat primitives. Do not add parallel home-grown primitive APIs or mega implementation files.
- QUESTPIE collections, TanStack Query, and Channels own durable chat and Run state. AI SDK React may provide a qualified transient adapter in `components/ai`, but never a second source of truth.
- Define behavior at the public module seam and drive implementation with scenario-first TDD. Every new component or feature must cover loading, empty, error, permission, realtime, long-copy, mobile, keyboard, and reduced-motion states where applicable.
- Storybook is the design-kit review surface, not optional documentation. Before pages consume a component, verify its stories at 390, 767/768, 1023/1024, and wide desktop, in light/dark, with long Slovak copy, keyboard, reduced motion, and realistic pending/reconnect/error states.
- Use qprobe/browser measurement for implemented UI QA: record exact bounding boxes and viewport state, inspect console and network failures, run accessibility checks, and store evidence on the task. Do not accept a visual gate by code inspection alone. The repo-root `qprobe.config.ts` is the PRODUCT default (tests/qprobe-product, per-run `--base`); Storybook design-kit sessions must select `QPROBE_CONFIG=qprobe.storybook.config.ts` (tests/qprobe, 127.0.0.1:6007) — see `tests/qprobe-product/README.md`.
- Treat `docs/interface-quality-rules.md` as binding. Prototype query-free templates with grounded fixtures before complex data integration, use Lucide as the sole icon vocabulary, and run the shared geometry/concentric-radius consistency gate after component and template stories are assembled.
