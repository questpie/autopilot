# Current Truth

This repo contains current implementation docs, local engineering notes, and some historical product docs.

The canonical architecture and planning specs for Autopilot are in the company-level specs directory, not in repo-local snapshots.

Use this path first:

- `/Users/drepkovsky/questpie/specs/autopilot/`

Start with:

- `/Users/drepkovsky/questpie/specs/autopilot/README.md`
- `/Users/drepkovsky/questpie/specs/autopilot/core-architecture-cleanup-proposal.md`
- `/Users/drepkovsky/questpie/specs/autopilot/config-and-state-boundaries.md`
- `/Users/drepkovsky/questpie/specs/autopilot/primitive-roadmap.md`

Repo-local research map:

- `docs/source-of-truth-map.md` — current vs target state ownership, including DB/Knowledge/git/ephemeral FS and agent-install/spawn-agent boundaries

## Repo-local guidance

- `docs/`:
  public and semi-public documentation, plus some implementation notes
- `docs/internal/`:
  local engineering notes and pass-specific steering; useful, but not canonical product/spec truth
- repo-local historical snapshots:
  removed from the active planning surface; do not recreate them as primary source of truth

## Decision rule

If a repo-local document conflicts with:

- `/Users/drepkovsky/questpie/specs/autopilot/README.md`
- `/Users/drepkovsky/questpie/specs/autopilot/core-architecture-cleanup-proposal.md`
- `/Users/drepkovsky/questpie/specs/autopilot/config-and-state-boundaries.md`

prefer the external specs.

If a repo-local doc is still useful, treat it as:

- implementation note
- temporary steering note
- historical context

not as the canonical contract for the current system.
