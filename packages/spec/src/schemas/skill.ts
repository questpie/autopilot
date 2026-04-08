import { z } from 'zod'

/**
 * Skill manifest — parsed from SKILL.md YAML frontmatter.
 *
 * Fields are intentionally lenient: upstream skills from skills.sh may only
 * have a subset of these fields. Missing fields fall back to sensible defaults.
 */
export const SkillManifestSchema = z.object({
	name: z.string().default(''),
	description: z.string().default(''),
	version: z.string().default(''),
	tags: z.array(z.string()).default([]),
	roles: z.array(z.string()).default(['all']),
	author: z.string().optional(),
	forked_from: z.string().optional(),
	scripts: z.array(z.string()).default([]),
})

/**
 * A parsed, indexed skill entry — the runtime representation of an installed skill.
 */
export const SkillEntrySchema = z.object({
	/** Skill identifier derived from directory/file name. */
	id: z.string(),
	/** Parsed frontmatter manifest. */
	manifest: SkillManifestSchema,
	/** Markdown body (after frontmatter). */
	body: z.string(),
	/** Absolute filesystem path to the SKILL.md or .md file. */
	path: z.string(),
})

/**
 * Compact skill hint for prompt injection — just enough to tell the agent
 * what a skill does without dumping the full body.
 */
export const SkillHintSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string(),
})
