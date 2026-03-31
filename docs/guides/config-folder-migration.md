# Config Folder Migration

Autopilot now uses folder-based team config for agents, humans, webhooks, and schedules.

## Breaking Change

Legacy monolithic files are not supported:

- `team/agents.yaml`
- `team/humans.yaml`
- `team/webhooks.yaml`
- `team/schedules.yaml`

If any of these files exist, orchestrator startup fails with a migration error.

## New Layout

| Old | New |
| --- | --- |
| `team/agents.yaml` | `team/agents/<agent-id>.yaml` |
| `team/humans.yaml` | `team/humans/<human-id>.yaml` |
| `team/webhooks.yaml` | `team/webhooks/<webhook-id>.yaml` |
| `team/schedules.yaml` | `team/schedules/<schedule-id>.yaml` |

`team/workflows/*.yaml` is unchanged.

## Migration Steps

1. Create target directories:

```bash
mkdir -p team/agents team/humans team/webhooks team/schedules
```

2. Split each array item from the old file into its own YAML file.

3. Name each output file by the entity `id`:

- `team/agents/<id>.yaml`
- `team/humans/<id>.yaml`
- `team/webhooks/<id>.yaml`
- `team/schedules/<id>.yaml`

4. Delete old monolithic files.

5. Start orchestrator and verify no migration errors are logged.

## Validation Checklist

- `team/agents.yaml` does not exist
- `team/humans.yaml` does not exist
- `team/webhooks.yaml` does not exist
- `team/schedules.yaml` does not exist
- each new file parses as valid YAML and includes a stable `id`
