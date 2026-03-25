# Contributing to QUESTPIE Autopilot

Thanks for your interest in contributing to QUESTPIE Autopilot. This document covers everything you need to get set up and start contributing.

## Prerequisites

- [Bun](https://bun.sh) v1.3.0+ — runtime, package manager, and test runner
- [Node.js](https://nodejs.org) v20+ — required by some tooling
- [Git](https://git-scm.com)

## Setup

```bash
# Clone the repository
git clone https://github.com/questpie/autopilot.git
cd autopilot

# Install dependencies (Bun workspaces)
bun install

# Build all packages
bunx turbo build

# Run all tests
bunx turbo test
```

## Package Structure

This is a Bun monorepo managed with Turbo.

| Package | Path | Description |
|---|---|---|
| `@questpie/autopilot-spec` | `packages/spec/` | Zod schemas, constants, path helpers, validators for all company filesystem formats (tasks, agents, workflows, messages, etc.) |
| `@questpie/autopilot-orchestrator` | `packages/orchestrator/` | Core engine — FS watcher, workflow engine, agent spawner, context assembler, memory extractor, cron scheduler, webhook server, session stream, write queue, API server |
| `@questpie/autopilot-agents` | `packages/agents/` | Agent system prompt templates and prompt builder for all 8 agent roles |
| `@questpie/autopilot` | `packages/cli/` | CLI interface — `autopilot init`, `start`, `ask`, `attach`, `inbox`, `agents`, `status`, `tasks` |
| `@questpie/autopilot-dashboard` | `apps/dashboard/` | Living Dashboard — React 19 + TanStack Router + Tailwind CSS 4 |
| `@questpie/autopilot-docs` | `apps/docs/` | Documentation site (Fumadocs) |
| `@questpie/avatar` | `packages/avatar/` | Deterministic SVG avatar generator |

### Architecture Overview

```
packages/spec         — Pure data: schemas, types, constants, validators
    ↓
packages/orchestrator — Runtime: watches files, runs workflows, spawns agents
    ↓
packages/agents       — AI: prompt templates for all 8 agent roles
    ↓
packages/cli          — Interface: human commands that talk to the orchestrator
```

- `spec` has zero runtime dependencies — only Zod for schema definitions
- `orchestrator` depends on `spec` for types and validation
- `agents` depends on `spec` for schemas (agent roles, types)
- `cli` depends on all packages and ties everything together

## Running Tests

```bash
# Run all tests across all packages
bunx turbo test

# Run tests for a specific package
cd packages/spec && bun test
cd packages/orchestrator && bun test
cd packages/agents && bun test
cd packages/cli && bun test

# Run a specific test file
bun test packages/orchestrator/tests/workflow-engine.test.ts

# Run tests in watch mode
bun test --watch
```

### Current Test Counts

| Package | Tests | Test files | Description |
|---|---|---|---|
| `packages/spec` | 139 | 4 | Schema validation, constants, path helpers |
| `packages/agents` | 83 | 1 | System prompt generation for all roles |
| `packages/orchestrator` | 252 | 21 | Workflow engine, scheduler, watcher, tasks, messages, context assembler, webhook server, session stream, pins, activity, YAML parsing, write queue, API server, agent tools, skills, artifact router |
| `packages/cli` | 30 | 4 | Command parsing, output formatting, root finding |
| **Total** | **504** | **30** | |

## Building

```bash
# Build all packages (respects dependency order via Turbo)
bunx turbo build

# Build a specific package
cd packages/spec && bun run build

# Dev mode for the landing page
cd apps/web && bun run dev
```

## Code Conventions

### Formatting (Biome)

We use [Biome](https://biomejs.dev) for formatting and linting. The configuration is in `biome.json` at the repo root.

- **Indentation:** tabs (not spaces)
- **Quotes:** single quotes
- **Semicolons:** as needed (no trailing semicolons)
- **Line width:** 100 characters
- **No `any`:** use proper types or `unknown`

```bash
# Check formatting and lint
bun run lint

# Auto-fix formatting
bun run format
```

### TypeScript

- Strict mode enabled
- No `any` types — use `unknown` and narrow
- Prefer `interface` over `type` for object shapes
- Use Zod schemas (from `@questpie/autopilot-spec`) for runtime validation
- Export types explicitly

### File Organization

- Source code in `src/`
- Tests in `tests/` (at package root, not inside `src/`)
- One module per file, named after what it exports
- Index files (`index.ts`) only for public API re-exports

## How to Add a New CLI Command

1. Create a new file in `packages/cli/src/commands/` named after your command (e.g., `deploy.ts`).

2. Export a function that handles the command. Follow the existing pattern — each command receives parsed arguments and an options object:

```ts
import type { AutopilotContext } from '../context'

export async function deployCommand(ctx: AutopilotContext, args: string[]) {
	// 1. Validate arguments
	// 2. Call the orchestrator API or read/write the company filesystem
	// 3. Print output using the formatting helpers from '../format'
}
```

3. Register the command in `packages/cli/src/index.ts` by adding it to the command map.

4. Add tests in `packages/cli/tests/` — at minimum, test argument parsing and expected output.

5. Update the CLI help text if your command should appear in `autopilot --help`.

## How to Add a New Agent Tool

Agent tools (primitives) are the actions agents can perform during execution. To add a new tool:

1. Define the tool schema in `packages/spec/src/schemas/` — add a Zod schema for the tool's input and output.

2. Export the schema from `packages/spec/src/schemas/index.ts`.

3. Implement the tool handler in `packages/orchestrator/src/agent/` — the handler receives validated input and returns the tool result:

```ts
import { z } from 'zod'

export const MyToolInputSchema = z.object({
	target: z.string(),
	content: z.string(),
})

export type MyToolInput = z.infer<typeof MyToolInputSchema>

export async function handleMyTool(input: MyToolInput): Promise<string> {
	// Perform the action (write files, send messages, etc.)
	// Return a result string the agent will see
}
```

4. Register the tool in the agent tool registry so the orchestrator exposes it to agents.

5. Add tests in `packages/orchestrator/tests/` covering success cases, validation errors, and edge cases.

6. Update the relevant agent prompt templates in `packages/agents/src/prompts/` if agents need to know about the new tool.

## Commit Conventions

We follow [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add webhook retry logic
fix: handle empty task YAML gracefully
test: add workflow engine edge case tests
docs: update CLI reference with new commands
chore: bump turbo to v2.8
refactor: extract context assembly into separate module
```

**Scope** is optional but encouraged for clarity:

```
feat(orchestrator): add FS watcher debouncing
fix(cli): handle missing ANTHROPIC_API_KEY gracefully
test(spec): add schema validation for nested task refs
```

## Development Workflow

1. Create a feature branch from `main`
2. Make your changes
3. Run `bun run lint` to check formatting
4. Run `bunx turbo test` to verify all tests pass
5. Run `bunx turbo build` to verify the build succeeds
6. Commit with a conventional commit message
7. Open a PR against `main`

## Dashboard Development

The Living Dashboard is a React 19 + TanStack Router app in `apps/dashboard/`:

```bash
cd apps/dashboard
bun run dev
# Opens at http://localhost:3001
```

- React 19 + TanStack Router + TanStack Query
- Tailwind CSS 4 + Base UI components
- Vite 6 with HMR

## Docs Development

The documentation site is in `apps/docs/`:

```bash
cd apps/docs
bun run dev
```

- Fumadocs-based documentation
- MDX content in `content/docs/`

## Questions?

Open an issue on [GitHub](https://github.com/questpie/autopilot/issues) or reach out on Discord (coming soon).
