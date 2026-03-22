# Contributing to QUESTPIE Autopilot

Thanks for your interest in contributing to QUESTPIE Autopilot. This document covers everything you need to get set up and start contributing.

## Prerequisites

- [Bun](https://bun.sh) v1.0+ — runtime, package manager, and test runner
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
npx turbo build

# Run all tests
npx turbo test
```

## Package Structure

This is a Bun monorepo managed with Turbo.

| Package | Path | Description |
|---|---|---|
| `@questpie/spec` | `packages/spec/` | Zod schemas, constants, path helpers, validators for all company filesystem formats (tasks, agents, workflows, messages, etc.) |
| `@questpie/orchestrator` | `packages/orchestrator/` | Core engine — FS watcher, workflow engine, agent spawner, context assembler, memory extractor, cron scheduler, webhook server, session stream |
| `@questpie/agents` | `packages/agents/` | Agent definitions, system prompt templates, primitive implementations, memory extraction logic |
| `@questpie/autopilot` | `packages/cli/` | CLI interface — `autopilot init`, `start`, `ask`, `attach`, `inbox`, `agents`, `status`, `approve`, `reject` |
| Landing page | `apps/web/` | TanStack Start landing page and documentation site with Tailwind CSS |

### Architecture Overview

```
packages/spec         — Pure data: schemas, types, constants, validators
    ↓
packages/orchestrator — Runtime: watches files, runs workflows, spawns agents
    ↓
packages/agents       — AI: prompt templates, primitive tool definitions
    ↓
packages/cli          — Interface: human commands that talk to the orchestrator
```

- `spec` has zero runtime dependencies — only Zod for schema definitions
- `orchestrator` depends on `spec` for types and validation
- `agents` depends on `spec` for schemas and `orchestrator` for runtime context
- `cli` depends on all packages and ties everything together

## Running Tests

```bash
# Run all tests across all packages
npx turbo test

# Run tests for a specific package
cd packages/spec && bun test
cd packages/orchestrator && bun test
cd packages/agents && bun test

# Run a specific test file
bun test packages/orchestrator/tests/workflow-engine.test.ts

# Run tests in watch mode
bun test --watch
```

### Current Test Counts

| Package | Test files | Description |
|---|---|---|
| `packages/spec` | 4 | Schema validation, constants, path helpers |
| `packages/orchestrator` | 11 | Workflow engine, scheduler, watcher, tasks, messages, context assembler, webhook server, session stream, pins, activity, YAML parsing |
| `packages/agents` | 1 | System prompt generation |
| `packages/cli` | 0 | Not yet implemented |

## Building

```bash
# Build all packages (respects dependency order via Turbo)
npx turbo build

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
- Use Zod schemas (from `@questpie/spec`) for runtime validation
- Export types explicitly

### File Organization

- Source code in `src/`
- Tests in `tests/` (at package root, not inside `src/`)
- One module per file, named after what it exports
- Index files (`index.ts`) only for public API re-exports

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
4. Run `npx turbo test` to verify all tests pass
5. Run `npx turbo build` to verify the build succeeds
6. Commit with a conventional commit message
7. Open a PR against `main`

## Landing Page Development

The landing page is a TanStack Start app in `apps/web/`:

```bash
cd apps/web
bun run dev
# Opens at http://localhost:3000
```

- Design system: dark theme (#0A0A0A), purple accent (#B700FF), sharp edges
- Fonts: JetBrains Mono (code) + Inter (UI)
- Tailwind CSS with custom tokens defined in `app.css`
- Pages live in `src/routes/`
- Components in `src/components/`
- Documentation pages at `/docs/*`

## Questions?

Open an issue on [GitHub](https://github.com/questpie/autopilot/issues) or reach out on Discord (coming soon).
