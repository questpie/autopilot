# Runtime Setup

> Worker-local runtime adapter setup for QUESTPIE Autopilot.
> Last updated: 2026-04-07 (Pass 25.8)

---

## Overview

Workers execute runs using **runtime adapters** — CLI tools that run on the worker machine. The orchestrator does not own or install runtimes. Each worker machine needs at least one runtime binary installed and authenticated locally.

Supported runtimes:

| Runtime | Binary | Default | Status |
|---------|--------|---------|--------|
| Claude Code | `claude` | Yes | Full adapter, production-tested |
| Codex | `codex` | No | V1 adapter, functional |
| OpenCode | `opencode` | No | V1 adapter, functional |

Claude Code is the default and most-tested runtime. Codex and OpenCode are functional V1 adapters with documented caveats.

---

## Claude Code (default)

### Install

```bash
npm install -g @anthropic-ai/claude-code
```

Verify with upstream docs if install commands change: https://docs.anthropic.com/en/docs/claude-code/setup

### Authenticate

Pick one:

```bash
# Option A: Interactive OAuth (recommended)
claude login

# Option B: API key
export ANTHROPIC_API_KEY=sk-ant-...
```

### Verify

```bash
# Check binary is on PATH
which claude

# Check from Autopilot
autopilot doctor --offline --require-runtime --runtimes claude-code
```

### What runs locally

- The `claude` binary executes in non-interactive mode (`claude -p "prompt" --output-format json`)
- Sessions are persisted locally on the worker machine
- Same-worker continuation uses Claude's `--resume` flag with stored session IDs
- Git worktree isolation is handled by the worker before spawning the runtime
- MCP tools are injected via `--mcp-config` flag — no project config modification needed

### What the orchestrator does not own

- Runtime binary installation
- Anthropic API key or OAuth session
- Local Claude session state
- Runtime process lifecycle (worker manages spawn/kill)

---

## Codex (OpenAI)

### Install

```bash
npm install -g @openai/codex
```

Verify with upstream docs if install commands change: https://github.com/openai/codex

### Authenticate

```bash
export OPENAI_API_KEY=sk-...
```

### Verify

```bash
which codex

autopilot doctor --offline --require-runtime --runtimes codex
```

### What runs locally

- The `codex` binary executes via `codex exec --json "prompt"` with JSONL event streaming
- Runs in unattended mode (`--ask-for-approval never`)
- Sessions are persisted in `~/.codex/sessions/`
- Session resume uses `codex exec resume <session_id> "prompt"`
- Git worktree isolation is handled by the worker before spawning

### MCP config (V1 tradeoff)

Codex reads MCP server configuration from `.codex/config.toml` in the project directory. The Autopilot worker injects MCP config by:

1. Backing up existing `.codex/config.toml` in the run worktree (if present)
2. Writing Autopilot's MCP server config into `.codex/config.toml`
3. Running the Codex adapter
4. Restoring the original config on cleanup

**This means**: if you have a custom `.codex/config.toml` in your project, it will be temporarily replaced during Autopilot runs and restored afterward. This is a documented V1 tradeoff — not a bug.

Config format (TOML):
```toml
# .codex/config.toml
[mcp_servers.autopilot]
command = "bun"
args = ["run", "/path/to/mcp-server/src/index.ts"]

[mcp_servers.autopilot.env]
AUTOPILOT_API_URL = "http://orchestrator:7778"
AUTOPILOT_API_KEY = "worker-secret"
```

### Codex-specific caveats

- No `--max-turns` flag exists — runs continue until the model decides to stop
- JSONL event types differ from Claude Code's JSON output format
- Token usage is reported via `turn.completed` events, not a single summary
- Model override (`--model`) is available but not wired through the orchestrator yet (deferred to Pass 26.1)

---

## OpenCode

### Install

```bash
npm install -g opencode-ai
```

Verify with upstream docs if install commands change: https://opencode.ai/docs/

### Authenticate

OpenCode supports multiple providers. Set the API key for your chosen provider:

```bash
# Anthropic (default for many models)
export ANTHROPIC_API_KEY=sk-ant-...

# OpenAI
export OPENAI_API_KEY=sk-...

# Google
export GOOGLE_API_KEY=...
```

Consult OpenCode documentation for provider-specific auth.

### Verify

```bash
which opencode

autopilot doctor --offline --require-runtime --runtimes opencode
```

### What runs locally

- The `opencode` binary executes via `opencode run "prompt" --format json`
- Session resume uses `opencode run --continue --session <id> "prompt"`
- Model format uses forward-slash notation: `provider/model` (e.g. `anthropic/claude-sonnet-4-5`)
- Git worktree isolation is handled by the worker before spawning

### MCP config (V1 tradeoff)

OpenCode reads MCP configuration from `opencode.jsonc` in the project directory. The same backup/replace/restore approach applies as with Codex:

1. Back up existing `opencode.jsonc` in the run worktree (if present)
2. Write Autopilot's MCP config
3. Run the OpenCode adapter
4. Restore original config on cleanup

Config format (JSON):
```json
{
  "mcp": {
    "autopilot": {
      "type": "local",
      "command": ["bun", "run", "/path/to/mcp-server/src/index.ts"],
      "environment": {
        "AUTOPILOT_API_URL": "http://orchestrator:7778",
        "AUTOPILOT_API_KEY": "worker-secret"
      }
    }
  }
}
```

Key differences from Claude Code MCP format:
- Field is `"mcp"`, not `"mcpServers"`
- Type is `"local"`, not `"stdio"`
- Command is a single array (command + args), not separate fields
- Environment uses `"environment"`, not `"env"`

### OpenCode-specific caveats

- V1 event streaming is start + completion only (no per-tool granularity)
- Token usage reporting may not be available from all providers
- Session persistence behavior may vary — verify with upstream docs
- Model override (`--model provider/model`) is available but not wired through the orchestrator yet (deferred to Pass 26.1)

---

## Runtime selection

Workers specify their runtime when starting:

```bash
# Default (Claude Code)
autopilot worker start --url http://orchestrator:7778 --token <token>

# Explicit runtime
autopilot worker start --url http://orchestrator:7778 --token <token> --runtime codex
autopilot worker start --url http://orchestrator:7778 --token <token> --runtime opencode
```

### What is not implemented yet

- **Runtime selection pipeline** (Pass 26.1): Workflow targeting constraints can already require a specific runtime on a run, but the full agent-level model/provider/variant routing pipeline is deferred. Workers advertise their runtime at enrollment; targeting tags can restrict which workers claim a run.
- **Model override from agent config**: Agent YAML `model` field is parsed but not forwarded to the runtime adapter CLI flags.
- **Per-runtime capability sandboxing**: Beyond prompt-level hints, there is no strict capability subsetting per runtime.
- **Cross-runtime parity**: Claude Code has richer event streaming and MCP injection than Codex/OpenCode.

---

## Doctor checks

Use `autopilot doctor` on worker machines to validate runtime setup:

```bash
# Check all default runtimes (informational)
autopilot doctor --offline

# Require at least one runtime (fail if none found)
autopilot doctor --offline --require-runtime

# Check specific runtimes only
autopilot doctor --offline --runtimes claude-code,codex --require-runtime

# Machine-readable output
autopilot doctor --offline --require-runtime --json
```

Doctor checks for each runtime:
- Binary exists on `PATH` (via `which`)
- At least one supported runtime is available (when `--require-runtime` is set)

Doctor does **not** check:
- Whether the runtime is authenticated (API key/OAuth)
- Whether MCP config is correct
- Runtime version compatibility

---

## Summary

| Aspect | Claude Code | Codex | OpenCode |
|--------|-------------|-------|----------|
| Install | `npm install -g @anthropic-ai/claude-code` | `npm install -g @openai/codex` | `npm install -g opencode-ai` |
| Auth | OAuth or `ANTHROPIC_API_KEY` | `OPENAI_API_KEY` | Provider-specific API key |
| MCP injection | CLI flag (`--mcp-config`) | Backup/replace `.codex/config.toml` | Backup/replace `opencode.jsonc` |
| Session resume | `--resume <id>` | `codex exec resume <id>` | `--continue --session <id>` |
| Event granularity | Full JSON | JSONL stream | Start + completion |
| Model override | Not wired yet | Available (`--model`) | Available (`-m provider/model`) |
| Maturity | Production-tested | V1 functional | V1 functional |

See also:
- [Deployment Variants](./deployment-variants.md) for the full topology guide
- [VPS Dogfood Runbook](./vps-dogfood-runbook.md) for end-to-end deployment walkthrough
- [Release Channels](./release-channels.md) for version management
