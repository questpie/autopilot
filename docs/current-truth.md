# Current Truth

This repo contains a mix of current implementation docs, local engineering notes, and older snapshots.

The canonical architecture and planning specs for Autopilot are **not** in this repo-local `local_specs/` tree.

Use this path first:

- `/Users/drepkovsky/questpie/specs/autopilot/`

Start with:

- `/Users/drepkovsky/questpie/specs/autopilot/README.md`
- `/Users/drepkovsky/questpie/specs/autopilot/current-steering.md`
- `/Users/drepkovsky/questpie/specs/autopilot/primitive-roadmap.md`

## Repo-local guidance

- `docs/`:
  public and semi-public documentation, plus some implementation notes
- `docs/internal/`:
  local engineering notes and pass-specific steering; useful, but not canonical product/spec truth
- `local_specs/`:
  historical repo-local snapshot; do not use as the primary source of truth

## Decision rule

If a repo-local document conflicts with:

- `/Users/drepkovsky/questpie/specs/autopilot/current-steering.md`
- `/Users/drepkovsky/questpie/specs/autopilot/README.md`

prefer the external specs.

If a repo-local doc is still useful, treat it as:

- implementation note
- temporary steering note
- historical context

not as the canonical contract for the current system.
