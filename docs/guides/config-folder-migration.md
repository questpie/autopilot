# Config Import Boundary

Autopilot no longer treats config folders as live runtime truth.

## Current Model

- DB-backed config records are canonical after bootstrap/import.
- `.autopilot/` bundles may seed config into the database.
- `autopilot sync` and `autopilot agent ...` may materialize local compatibility files for coding agents.
- Editing generated local files is not the supported way to update product config.

## Migrating Old Folder Config

1. Start the current orchestrator against the old local bundle once.
2. Let the server import supported `.autopilot/` records into DB config tables.
3. Verify config through Operator Settings or `/api/config/*`.
4. Stop relying on folder edits for live reload.
5. Use DB/API/operator config changes going forward.

## What Stays In Files

- import/export packs
- local fixtures
- generated `AGENTS.md` / native skill / MCP files
- project Git workspaces created by workers

Everything else should move through DB-backed config or Knowledge resources.
