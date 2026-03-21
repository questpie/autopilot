# QUESTPIE Autopilot

Local-first workflow engine for coding agents.

QUESTPIE Autopilot helps you turn software delivery into a structured loop:
- plan
- import or create a project workspace
- run agents against real tasks
- validate outputs
- monitor progress from a terminal UI

It is built for developers who want more than chat and copy-paste.

## What It Does

Autopilot gives you:
- a local project workspace
- task readiness and dependency tracking
- agent execution with Claude Code CLI or Codex CLI
- validation steps and run history
- local state, logs, and event streams
- a terminal UI for monitoring and control

## Install

Bun is required.

```bash
bun add -g @questpie/autopilot
```

## Core Experience

The intended default flow is:

```bash
qap
```

That should open the terminal UI.

You can also use the CLI directly:

```bash
qap --help
qap ui
qap project init
qap project import
qap project list
qap project use
qap status
qap next
qap run
qap run-task TASK-001
```

## Project Setup

Autopilot is designed around AI-assisted project setup.

Instead of manually authoring internal project files, the tool should be able to:
- read your repo
- read planning or prompt artifacts
- read optional tracker context
- create the local project workspace it needs

## Current Status

Autopilot is in active alpha development.

Today, the core engine already has:
- task state machine
- readiness engine
- local state persistence
- event logging
- Claude Code CLI runner
- Codex CLI runner
- targeted task execution
- dry-run support

## First Public Alpha

The first public alpha is focused on three things:
- terminal UI
- project management
- planning workflow

In practical terms, that means:
- `qap` opens a usable TUI
- projects can be initialized or imported locally
- planning exists as a real workflow, even if still minimal

## Philosophy

Autopilot is intentionally:
- local-first
- tracker-optional
- model-agnostic
- artifact-driven
- developer-controlled

Your local workspace is the source of truth.
External systems are optional integrations.

## Roadmap

Near-term:
- `qap` default TUI
- local project workspaces
- AI-assisted project init/import
- OpenTUI-based cockpit

Later:
- richer planning flows
- stronger validation workflows
- SDK-backed runners
- remote monitoring and control
