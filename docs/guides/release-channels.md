# Release Channels and Compatibility

> V1 release/update/channel management for QUESTPIE Autopilot.
> Last updated: 2026-04-07 (Pass 25.11)

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
- Stable release automation is limited to the Changesets workflow.
- Canary Docker images are not yet published automatically.
- npm canary tags are published through the release workflow when Changesets pre-mode is active, or through the local fallback scripts.

The channel model is defined so that tooling and docs stay aligned while release automation matures.

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

## Publishing (maintainer reference)

### How releases work

Releases are managed by [Changesets](https://github.com/changesets/changesets) and published via GitHub Actions.

| Step | What happens |
|------|-------------|
| Add changeset | `bunx changeset` — describe the change and affected packages |
| Push to main | CI runs typecheck + tests. Release workflow creates a "Version Packages" PR. |
| Merge version PR | Release workflow publishes to npm with provenance attestation. |

### Canary releases (scripted, local)

Use the release scripts via `bun run` for local canary publishing. CI publishing uses Trusted Publishing automatically — see "npm authentication" below.

```bash
# 1. Pre-flight check
bun run release:check

# 2. Enter pre mode + version (creates commits, does not publish)
bun run release:canary:version

# 3. Publish to npm with canary dist-tag (dependency order, stops on failure)
bun run release:canary:publish
bun run release:canary:publish -- --dry-run   # preview without publishing

# 4. Verify install
bun run release:canary:verify

# 5. Push, exit pre mode, optionally tag
bun run release:canary:finish
bun run release:canary:finish -- --github-release   # also creates canary-YYYY-MM-DD tag and GitHub release
```

### Canary releases (manual fallback)

If scripts fail or you need more control:

```bash
bunx changeset pre enter canary
git add .changeset/pre.json && git commit -m "chore: enter changesets canary pre mode"
bunx changeset version
bun install
git add -A && git commit -m "chore: version canary alpha packages"
cd packages/spec && npm publish --tag canary --access public && cd ../..
cd packages/worker && npm publish --tag canary --access public && cd ../..
cd packages/orchestrator && npm publish --tag canary --access public && cd ../..
cd packages/mcp-server && npm publish --tag canary --access public && cd ../..
cd packages/cli && npm publish --tag canary --access public && cd ../..
bunx changeset pre exit
git add .changeset/pre.json && git commit -m "chore: exit changesets canary pre mode"
git push origin main
```

### Stable releases

Stable releases follow the normal Changesets flow — no pre mode. Push changeset to main, merge the generated version PR, workflow publishes to npm `@latest`.

### Published packages

| Package | npm name | Published |
|---------|----------|-----------|
| CLI | `@questpie/autopilot` | Yes |
| Spec | `@questpie/autopilot-spec` | Yes |
| Orchestrator | `@questpie/autopilot-orchestrator` | Yes |
| Worker | `@questpie/autopilot-worker` | Yes |
| MCP Server | `@questpie/autopilot-mcp` | Yes |

Private/ignored: `dashboard-v2`, `@questpie/autopilot-docs`.

### npm authentication

The release workflow uses **npm Trusted Publishing (OIDC)** — no `NPM_TOKEN` secret is needed for publishing. GitHub Actions exchanges a short-lived OIDC token with the npm registry automatically.

Requirements:
- `permissions.id-token: write` in the workflow
- `environment: npm` on the job
- npm CLI >= 11.5.1 (the workflow upgrades npm explicitly since Node 22 ships npm 10.x)
- Trusted Publishing configured per package in the npm UI

`changesets/action@v1` detects the OIDC environment and skips `.npmrc` token generation when no `NPM_TOKEN` is set.

### npm Trusted Publishing setup

Trusted Publishing is configured per package in the npm UI (`npmjs.com → Package Settings → Publishing access → Add a trusted publisher`):

- [x] `@questpie/autopilot` — repo: `questpie/autopilot`, workflow: `release.yml`, environment: `npm`
- [x] `@questpie/autopilot-spec` — same settings
- [x] `@questpie/autopilot-orchestrator` — same settings
- [x] `@questpie/autopilot-worker` — same settings
- [x] `@questpie/autopilot-mcp` — same settings

### Token notes

- **CI publishing does not use npm tokens.** Trusted Publishing handles auth via OIDC.
- **Manual fallback** (`scripts/release/canary-publish.ts`) uses local npm auth (`npm login`). This is for emergency use only.
- **If a local npm token was previously used and may be compromised:** revoke it in npm UI (`npmjs.com → Access Tokens`). Do not store tokens in `.npmrc` or commit them to git.
- **If the workflow ever needs private dependencies at install time**, use a read-only token for the install step only — not for publish.

### Failure and rollback policy

- **No unpublish by default.** Fix forward with the next canary or patch.
- **Partial publish** (some packages published, others failed): rerun the workflow after fixing the cause. Already-published versions are idempotent — npm skips them.
- **Bad canary**: publish a new canary version with the fix. Operators update with `bun add -g @questpie/autopilot@canary`.
- **Bad stable**: publish a patch release. Pin Docker image to previous tag for immediate rollback.

---

## Summary

| Aspect | V1 state |
|--------|----------|
| Channels | stable / canary defined; stable CI publishing, local canary scripts |
| Version inspection | `autopilot version`, `autopilot update check`, doctor integration |
| Compatibility | Same release expected; packages versioned independently; informational only |
| Docker update | `docker compose pull && up -d`; pin tag for rollback |
| CLI update | `bun add -g @questpie/autopilot@latest` or `@canary` |
| Auto-update | Watchtower opt-in only; no silent background mutation |
| Publishing | GitHub Actions + Changesets + npm Trusted Publishing (OIDC) |
| Enforcement | Deferred — no version rejection or protocol negotiation |
