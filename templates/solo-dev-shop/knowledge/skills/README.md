# Skills Library

## What Are Skills?

Skills are markdown-based knowledge documents that agents load into their context before performing specific tasks. They encode **institutional knowledge** — the kind of hard-won best practices, templates, and checklists that senior engineers carry in their heads.

When an agent is assigned a role (e.g., `developer`, `reviewer`, `planner`), it loads all skills tagged for that role. This ensures consistent quality across all work, regardless of which agent performs it.

## Directory Structure

```
knowledge/skills/
├── README.md                  # This file
├── api-design.md              # REST API patterns and conventions
├── code-review.md             # Code review checklist and feedback patterns
├── deployment.md              # Safe deployment procedures
├── document-creation.md       # Specs, ADRs, and structured documents
├── git-workflow.md            # Branching, commits, and PR conventions
├── incident-response.md       # Production incident handling
├── project-scoping.md         # Feature scoping and estimation
├── release-notes.md           # Changelog and release note writing
├── security-checklist.md      # Security review for code and infra
└── testing-strategy.md        # Test writing and organization
```

## Frontmatter Format

Every skill file uses YAML frontmatter to declare metadata:

```yaml
---
name: Human-Readable Skill Name
description: One-line summary of what this skill covers
roles: [developer, reviewer, planner]
---
```

### Supported Roles

| Role         | Description                              |
| ------------ | ---------------------------------------- |
| `strategist` | High-level product and business planning |
| `planner`    | Task breakdown and implementation plans  |
| `developer`  | Writing and modifying code               |
| `reviewer`   | Code review and quality assurance        |
| `devops`     | Infrastructure and deployment            |
| `marketing`  | User-facing communications               |
| `all`        | Loaded for every role                    |

## How to Add a New Skill

1. Create a new `.md` file in this directory.
2. Add the YAML frontmatter with `name`, `description`, and `roles`.
3. Write actionable, practical content (aim for 200-400 lines).
4. Include code examples, templates, and checklists where appropriate.
5. Keep language direct and imperative — write for someone doing the work right now.

### Writing Guidelines

- **Be specific.** "Validate all user input" is vague. "Use zod schemas at API boundaries to validate request bodies" is actionable.
- **Include templates.** Copy-pasteable templates save time and enforce consistency.
- **Add examples.** Show what good looks like, and what bad looks like.
- **Keep it current.** Skills should reflect the team's actual stack and practices.
- **Stay under 400 lines.** If a skill grows beyond that, split it into multiple files.

## How Skills Are Loaded

The orchestrator reads the `roles` array from each skill's frontmatter and injects the content into the agent's system prompt when it matches the agent's assigned role. Skills tagged with `all` are always loaded.

Skills are loaded once at task start and remain in context for the duration of the task. They do not update mid-task.
