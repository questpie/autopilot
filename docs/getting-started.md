# Getting Started

## Prerequisites

- **Bun 1.3+** ([install](https://bun.sh)) or **Docker**
- **Authentication** (choose one per provider):
  - **Subscription login** (recommended): `autopilot provider login claude` or `autopilot provider login codex`
  - **API key** (alternative): set `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`

## Install & Run

### Option A: bunx (quickest)

```bash
bunx @questpie/autopilot init my-company
cd my-company

# Authenticate (choose one)
autopilot provider login claude    # Use Claude subscription (recommended)
# OR
export ANTHROPIC_API_KEY=sk-ant-...  # Use API key

bunx @questpie/autopilot start
```

### Option B: Global install

```bash
bun add -g @questpie/autopilot
autopilot init my-company
cd my-company

# Authenticate (choose one)
autopilot provider login claude    # Use Claude subscription (recommended)
# OR
export ANTHROPIC_API_KEY=sk-ant-...  # Use API key

autopilot start
```

### Option C: Docker

```bash
git clone https://github.com/questpie/autopilot
cd autopilot
cp .env.example .env
docker compose up

# Then authenticate:
# autopilot provider login claude   (subscription — works headless, prints a link)
# OR set ANTHROPIC_API_KEY in .env  (API key)
```

## Your First Intent

```bash
autopilot ask "Create a simple landing page for my SaaS product"
```

What happens:
1. **CEO agent** receives your intent and decomposes it into tasks
2. **Strategist** scopes the requirements
3. **Planner** creates an implementation plan
4. **Developer** writes the code
5. **Reviewer** checks quality
6. The orchestrator records workflow execution in SQLite as the work advances
7. You get notified at approval gates (merge, deploy)

## Watch Agents Work

```bash
# See what agents are doing
autopilot agents

# Stream a live session (like kubectl logs -f)
autopilot attach peter

# Check pending approvals
autopilot inbox

# View the dashboard
open http://localhost:3000
```

## What Just Happened?

When you ran `autopilot start`, the orchestrator:
1. Loaded your company config from `company.yaml`
2. Started watching the filesystem for changes
3. Started the API server on port 7778
4. Started the webhook server on port 7777
5. Started the dashboard on port 3000
6. Initialized the SQLite database with FTS5 + vector search

When you ran `autopilot ask`, it:
1. Created a task in SQLite (`.data/autopilot.db`)
2. The CEO agent picked it up and decomposed it
3. Sub-tasks were created and assigned to agents
4. Workflow execution was tracked in SQLite (`workflow_runs`, `step_runs`)
5. Each agent worked in sequence following the current workflow step
6. Every file change was auto-committed to git

Your company config lives in the `my-company/` directory, and runtime data (tasks, messages, activity, workflow execution) lives in SQLite. Back it up with `cp -r`, fork it with `git clone`.
