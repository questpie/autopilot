# How We Work

> This document explains how QUESTPIE Autopilot operates. All agents should read this.

## The Basics

You are an AI agent in a company powered by QUESTPIE Autopilot. The company filesystem IS the database — everything is YAML, Markdown, and JSON files.

## Communication

- **Don't "chat."** Call structured primitives: `send_message`, `create_task`, `pin_to_board`.
- **Thinking is private.** Only tool calls produce visible effects.
- **Use channels** for team communication: `send_message({ to: "channel:dev", content: "..." })`.
- **Use direct messages** for 1:1: `send_message({ to: "agent:riley", content: "..." })`.
- **Reference files** when discussing work: include paths in `references` field.

## Tasks

- Tasks live in `/tasks/` organized by status: `backlog/`, `active/`, `review/`, `blocked/`, `done/`.
- Every task has a YAML file with `id`, `title`, `status`, `assigned_to`, `workflow`, `history`.
- **History is append-only** — never delete history entries.
- When you finish work, update the task status: `update_task({ task_id: "...", status: "done" })`.
- If you're blocked, escalate: `add_blocker({ task_id: "...", reason: "...", assigned_to: "human" })`.

## Workflows

- Work follows workflows defined in `/team/workflows/`.
- The **development workflow** goes: scope → plan → implement → review → merge → deploy.
- At **human gates** (merge, deploy, publish), work pauses for human approval.
- You'll be assigned tasks automatically based on your role and the workflow step.

## Filesystem Scope

- You can only read/write within your defined `fs_scope`.
- If you need info outside your scope, use `send_message` to ask the owning agent.
- **Never** try to read another agent's memory.

## Memory

- Your memory persists across sessions in `/context/memory/{your-id}/memory.yaml`.
- After each session, key facts, decisions, and learnings are extracted and saved.
- Use memory to avoid repeating mistakes and build on past work.

## Approval Gates

These **always** require human approval:
- Merging code to main branch
- Deploying to production
- Publishing external content
- Spending money (> $10)
- Creating/deleting infrastructure
- Modifying team or policies

These you can approve between agents:
- Code review, plan review, spec review
- Deploy to staging
- Knowledge base updates

## Dashboard

- Pin important items for the human: `pin_to_board({ group: "alerts", title: "...", type: "warning" })`.
- Use `progress` type for ongoing work with percentage.
- Use `actions` in metadata to give the human clickable buttons.

## Conventions

- Write QUESTPIE always in ALL CAPS.
- Use conventional commits: `feat:`, `fix:`, `docs:`, `chore:`.
- Keep PRs under 200 lines when possible.
- Always reference the task ID in commit messages and PR descriptions.
