# Release Channels and Compatibility

> V1 release/update/channel management for QUESTPIE Autopilot.
> Last updated: 2026-04-07 (Pass 25.7)

---

## Release channels

Autopilot uses two release channels:

| Channel | Meaning | Docker tag | npm tag |
|---------|---------|-----------|---------|
| **stable** | Tested release. Safe for persistent self-hosted use. | `questpie/autopilot:latest` | `@questpie/autopilot@latest` |
| **canary** | Latest build from main. May contain breaking changes. | `questpie/autopilot:canary` | `@questpie/autopilot@canary` |

### What stable means

- Tagged from a tested commit on `main`.
- All CLI tests pass.
- Docker build and healthcheck verified.
- Suitable for persistent self-host deployments.
- No silent autoupdate — operators control when they update.

### What canary means

- Built from the latest `main` commit.
- May include incomplete features or breaking changes.
- Useful for testing upcoming changes before they reach stable.
- Not recommended for deployments you rely on continuously.

### What is not guaranteed yet

- Semantic versioning enforcement across packages (planned).
- Automated release pipeline (releases are currently manual).
- Canary Docker images are not yet published automatically.
- npm canary tags are not yet published automatically.

The channel model is defined so that tooling and docs are ready when automated publishing begins.

---

## Version inspection

### CLI

```bash
# Quick version
autopilot -v

# Detailed version info (local packages + remote orchestrator)
autopilot version

# JSON output
autopilot version --json

# Skip remote check
autopilot version --offline
```

### Update check

```bash
# Check for updates on stable channel
autopilot update check

# Check canary channel
autopilot update check --channel canary

# Machine-readable
autopilot update check --json
```

### Doctor

`autopilot doctor` includes a CLI version check. It prints the current CLI version as the first diagnostic.

---

## Compatibility policy

### Package versions

Autopilot is a monorepo with four packages:

| Package | Role |
|---------|------|
| `@questpie/autopilot` | CLI (operator interface) |
| `@questpie/autopilot-orchestrator` | Control plane (API, state, coordination) |
| `@questpie/autopilot-worker` | Run executor (claims and runs tasks) |
| `@questpie/autopilot-spec` | Shared schemas and types |

### V1 compatibility rule

Packages in this monorepo are versioned independently (e.g. CLI may be 1.x while orchestrator is 2.x). **Compatibility is declared by the CLI's `package.json` dependencies**, not by matching version numbers.

In practice:
- Install from the same release (git tag, npm publish batch, or Docker image build) and you are compatible.
- The CLI declares its compatible orchestrator and worker versions as dependencies. Running mismatched versions from different releases is untested.
- Exact version enforcement is deferred — there is no runtime rejection.

### Safe upgrade order

When updating:

1. **Orchestrator first** — update the Docker image or source, restart.
2. **Workers second** — update CLI on worker machines, restart workers.
3. **Local CLIs last** — update operator machines.

This order ensures the orchestrator API is always at least as new as its clients.

### What is not enforced yet

- The orchestrator does not reject workers with mismatched versions.
- The CLI does not refuse to connect to an older orchestrator.
- Protocol version negotiation is deferred.
- Semantic versioning alignment across packages is planned but not yet active.

`autopilot version` will show the remote orchestrator version alongside local package versions. Mismatch warnings are informational, not blocking.

---

## Docker update and rollback

### Manual update

```bash
# 1. Backup company directory
tar czf autopilot-backup-$(date +%Y%m%d).tar.gz ./company

# 2. Pull latest image
docker compose pull

# 3. Restart
docker compose up -d
```

### Rollback

If an update causes problems, pin the previous image tag in your compose file:

```bash
# 1. Stop the current container
docker compose down

# 2. Pin the previous image tag in docker-compose.yml
#    Change: image: questpie/autopilot:latest
#    To:     image: questpie/autopilot:2.0.0  (or the known-good tag)

# 3. Start with the pinned version
docker compose up -d
```

You must edit the `image:` line in `docker-compose.yml` — `docker compose up -d` always uses the tag configured in the compose file.

### Optional Watchtower auto-update

Watchtower is available as an opt-in profile. It is **not** the default and does **not** run silently.

```bash
# Enable auto-updates (polls every 5 minutes)
docker compose --profile auto-update up -d

# Disable auto-updates
docker compose --profile auto-update down
docker compose up -d
```

Watchtower follows the configured image tag. In our recommended setup it should only be used with floating tags like `:latest`. Pinned version tags (e.g. `:2.0.0`) are safe as long as the registry treats them as immutable.

### Backup before update

Always back up the company directory before updating. The company directory contains:
- Configuration files (`.autopilot/`)
- SQLite database (`.data/autopilot.db`)
- Knowledge base and skills

```bash
# Simple copy
cp -r ./company ./company-backup-$(date +%Y%m%d)

# Compressed archive
tar czf autopilot-backup-$(date +%Y%m%d).tar.gz ./company

# Cloud backup (S3/R2)
aws s3 sync ./company s3://my-bucket/autopilot-backup/
```

---

## CLI / npm update

### Global install (recommended for operators)

```bash
# Update to latest stable
bun add -g @questpie/autopilot@latest

# Update to canary
bun add -g @questpie/autopilot@canary
```

### Source checkout (for development)

```bash
cd ~/autopilot  # or wherever you cloned
git pull origin main
bun install
```

### Verify after update

```bash
autopilot -v
autopilot doctor --offline
```

---

## Summary

| Aspect | V1 state |
|--------|----------|
| Channels | stable / canary defined; automated publishing not yet active |
| Version inspection | `autopilot version`, `autopilot update check`, doctor integration |
| Compatibility | Same release expected; packages versioned independently; informational only |
| Docker update | `docker compose pull && up -d`; pin tag for rollback |
| CLI update | `bun add -g @questpie/autopilot@latest` |
| Auto-update | Watchtower opt-in only; no silent background mutation |
| Enforcement | Deferred — no version rejection or protocol negotiation |
