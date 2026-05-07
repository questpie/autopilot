# @questpie/autopilot-spec

Shared Zod schemas and TypeScript contracts for QUESTPIE Autopilot.

This package defines cross-package API and data contracts for tasks, runs, sessions, Knowledge resources, artifacts, workers, runtime selection, workspace inspection, config records, and product primitives.

## Install

```bash
bun add @questpie/autopilot-spec
```

## What's Included

- **Schemas** for product/runtime contracts shared across packages
- **Types** inferred from those schemas
- **Workspace inspection contracts** for read-only project run review
- **Validation helpers** for config, packs, runtime selection, and primitives

Filesystem conventions in this package are compatibility/import/export helpers. They are not the live product source of truth for company config or Knowledge.

## Dependencies

- `zod`
- `yaml`

## Links

- [Architecture](../../docs/architecture.md)
- [Documentation](https://autopilot.questpie.com)

## License

MIT
