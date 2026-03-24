# @questpie/autopilot-spec

Zod schemas, TypeScript types, filesystem conventions, and validators for QUESTPIE Autopilot.

This package defines the shared contract used across all Autopilot packages — the shape of tasks, agents, workflows, messages, company config, and the filesystem layout.

## Install

```bash
bun add @questpie/autopilot-spec
```

## What's included

- **Schemas** — Zod schemas for tasks, agents, workflows, messages, channels, knowledge entries, artifacts, and company configuration
- **Types** — TypeScript types inferred from all schemas
- **Filesystem conventions** — path constants and directory structure definitions for company directories
- **Validators** — parsing and validation utilities for YAML frontmatter and config files

## Dependencies

- `zod` — schema definition and validation
- `yaml` — YAML parsing for frontmatter-based config files

## Links

- [GitHub](https://github.com/questpie/autopilot)
- [Documentation](https://autopilot.questpie.com)

## License

MIT
