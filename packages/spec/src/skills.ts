import { existsSync } from 'node:fs'
import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { parse as parseYaml } from 'yaml'
import { SkillManifestSchema } from './schemas/skill'
import type { SkillEntry } from './types'

/**
 * Merge top-level frontmatter fields with nested `metadata:` block.
 * Top-level takes precedence; metadata provides fallbacks.
 *
 * Supports both authoring styles:
 *   - Top-level: `tags: [review]`
 *   - Nested:    `metadata: { tags: [review] }`
 *   - Mixed:     top-level `tags` wins over `metadata.tags`
 */
function mergeMetadata(parsed: Record<string, unknown>): Record<string, unknown> {
	const meta = parsed.metadata
	if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return parsed

	const { metadata: _, ...topLevel } = parsed
	const merged: Record<string, unknown> = { ...(meta as Record<string, unknown>) }

	// Top-level fields override metadata fields
	for (const [key, value] of Object.entries(topLevel)) {
		if (value !== undefined && value !== null && value !== '') {
			merged[key] = value
		}
	}

	return merged
}

/**
 * Parse SKILL.md frontmatter + body from raw file content.
 * Handles missing or malformed frontmatter gracefully.
 *
 * Supports nested `metadata:` block — see {@link mergeMetadata}.
 */
export function parseSkillContent(raw: string, fallbackName: string): { manifest: SkillEntry['manifest']; body: string } {
	const fmMatch = raw.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/)
	if (!fmMatch) {
		return {
			manifest: SkillManifestSchema.parse({ name: fallbackName }),
			body: raw.trim(),
		}
	}

	let parsed: Record<string, unknown> = {}
	try {
		parsed = parseYaml(fmMatch[1]!) ?? {}
	} catch {
		// Malformed YAML — use defaults
	}

	const merged = mergeMetadata(parsed)

	const manifest = SkillManifestSchema.parse({
		...merged,
		name: merged.name || fallbackName,
	})

	return { manifest, body: (fmMatch[2] ?? '').trim() }
}

/**
 * Load all skills from a single directory.
 *
 * Supports both formats:
 *   - `dir/<name>/SKILL.md`  (standard directory format)
 *   - `dir/<name>.md`        (flat file format)
 *
 * Returns a map of skill ID → SkillEntry.
 */
export async function loadSkillEntries(dir: string): Promise<Map<string, SkillEntry>> {
	const result = new Map<string, SkillEntry>()
	const absDir = resolve(dir)

	if (!existsSync(absDir)) return result

	let entries: string[]
	try {
		entries = await readdir(absDir)
	} catch {
		return result
	}

	for (const entry of entries) {
		let id: string
		let filePath: string

		// Standard: dir/<name>/SKILL.md
		const skillMdPath = join(absDir, entry, 'SKILL.md')
		if (existsSync(skillMdPath)) {
			id = entry
			filePath = skillMdPath
		} else if (entry.endsWith('.md')) {
			// Flat: dir/<name>.md
			id = entry.replace(/\.md$/, '')
			filePath = join(absDir, entry)
		} else {
			continue
		}

		const raw = await readFile(filePath, 'utf-8')
		const { manifest, body } = parseSkillContent(raw, id)
		result.set(id, { id, manifest, body, path: filePath })
	}

	return result
}

/**
 * Search skill entries by keyword query.
 * Matches against id, name, description, and tags.
 */
export function searchSkills(skills: Map<string, SkillEntry>, query: string): SkillEntry[] {
	const q = query.toLowerCase()
	const results: Array<{ entry: SkillEntry; score: number }> = []

	for (const entry of skills.values()) {
		let score = 0
		if (entry.id.toLowerCase().includes(q)) score += 10
		if (entry.manifest.name.toLowerCase().includes(q)) score += 8
		if (entry.manifest.tags.some(t => t.toLowerCase().includes(q))) score += 6
		if (entry.manifest.description.toLowerCase().includes(q)) score += 3
		if (score > 0) results.push({ entry, score })
	}

	return results
		.sort((a, b) => b.score - a.score)
		.map(r => r.entry)
}
