import { z } from 'zod'

// ─── Pack Dependency (declared in company.yaml) ───────────────────────────

/** A single pack dependency declared in company.yaml `packs:` array. */
export const PackDependencySchema = z.object({
	/** Pack reference: `<registry-or-owner>/<pack-id>`, e.g. "questpie/claude-code-surface". */
	ref: z.string().min(1),
	/** Semver range or git ref (tag/branch). Defaults to latest. */
	version: z.string().default('latest'),
})

// ─── Registry Config ──────────────────────────────────────────────────────

/** A registry source that packs can be resolved from. */
export const RegistrySchema = z.object({
	/** Unique registry identifier, e.g. "questpie", "acme-private". */
	id: z.string().min(1),
	/** Registry backend type. V1 only supports git. */
	type: z.enum(['git']),
	/** Git remote URL (HTTPS or SSH). */
	url: z.string().min(1),
	/** Whether this is the default registry for unqualified refs. */
	default: z.boolean().default(false),
	/** Resolution priority — higher wins when multiple registries match. */
	priority: z.number().int().default(0),
})

/** Top-level registries config file shape. */
export const RegistriesFileSchema = z.object({
	registries: z.array(RegistrySchema).default([]),
})

// ─── Pack Manifest (pack.yaml inside a pack) ─────────────────────────────

/** Category of distributable pack content. */
export const PackCategorySchema = z.enum([
	'surface',
	'workflow',
	'provider',
	'context',
	'skill',
])

/** An environment variable required by this pack. */
export const PackRequiredEnvSchema = z.object({
	name: z.string().min(1),
	description: z.string().default(''),
})

/** A manual step the user must perform after install. */
export const PackManualStepSchema = z.object({
	description: z.string().min(1),
})

/** A file mapping: source path in the pack → target path under .autopilot/. */
export const PackFileSchema = z.object({
	/** Source path relative to pack root in the registry. */
	src: z.string().min(1),
	/** Destination path relative to .autopilot/ in the target repo. */
	dest: z.string().min(1),
})

/** Pack manifest — the `pack.yaml` file inside a distributable pack. */
export const PackManifestSchema = z.object({
	/** Unique pack identifier, e.g. "claude-code-surface". */
	id: z.string().regex(/^[a-z0-9-]+$/),
	/** Human-readable name. */
	name: z.string().min(1),
	/** Pack category. */
	category: PackCategorySchema,
	/** Semver version string. */
	version: z.string().min(1),
	/** Description of what this pack provides. */
	description: z.string().default(''),
	/** Files to materialize. */
	files: z.array(PackFileSchema).min(1),
	/** Environment variables required by this pack. */
	required_env: z.array(PackRequiredEnvSchema).default([]),
	/** Manual steps the user must perform after install. */
	manual_steps: z.array(PackManualStepSchema).default([]),
})

// ─── Lockfile (.autopilot/packs.lock.yaml) ────────────────────────────────

/** A single resolved pack entry in the lockfile. */
export const PackLockEntrySchema = z.object({
	/** Original ref from company.yaml, e.g. "questpie/claude-code-surface". */
	ref: z.string().min(1),
	/** Registry ID that resolved this pack. */
	registry: z.string().min(1),
	/** Resolved git ref (branch/tag) that was used. */
	resolved_ref: z.string().min(1),
	/** Exact git commit SHA. */
	commit: z.string().min(1),
	/** Files managed by this pack (relative to repo root). */
	managed_files: z.array(z.string()).default([]),
	/** ISO timestamp of when this pack was installed. */
	installed_at: z.string().min(1),
})

/** Top-level lockfile shape. */
export const PackLockfileSchema = z.object({
	packs: z.record(z.string(), PackLockEntrySchema).default({}),
})
