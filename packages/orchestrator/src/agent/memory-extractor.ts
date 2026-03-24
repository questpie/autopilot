import Anthropic from '@anthropic-ai/sdk'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { parse as parseYaml, stringify as stringifyYaml } from 'yaml'
import type { StorageBackend } from '../fs/storage'

/**
 * Extract structured memory from a completed agent session.
 *
 * Uses Claude Haiku to distill the session's activity log into facts,
 * decisions, mistakes, and patterns, then merges the result into the
 * agent's persistent `memory.yaml`.
 */
export async function extractMemory(
	companyRoot: string,
	agentId: string,
	sessionId: string,
	storage: StorageBackend,
): Promise<void> {
	// 1. Read recent activity for this agent's session
	const activities = await storage.readActivity({
		agent: agentId,
		limit: 100,
	})

	if (activities.length === 0) return

	const sessionSummary = activities
		.map((a) => `[${a.type}] ${a.summary}`)
		.join('\n')

	// 2. Call Haiku for extraction
	const client = new Anthropic()
	const response = await client.messages.create({
		model: 'claude-haiku-4-5-20250514',
		max_tokens: 2000,
		messages: [{
			role: 'user',
			content: `Extract structured memory from this agent session log. Return YAML with these sections:

facts: (new things learned, as category -> array of strings)
decisions: (decisions made, as array of {date, decision, reason})
mistakes: (mistakes made, as array of {date, what, fix})
patterns: (patterns noticed, as array of strings)

Session log:
${sessionSummary}

Return ONLY valid YAML, no markdown fences.`,
		}],
	})

	const textBlock = response.content.find((b) => b.type === 'text')
	if (!textBlock || textBlock.type !== 'text') return

	// 3. Parse extracted memory
	let extracted: Record<string, unknown>
	try {
		extracted = parseYaml(textBlock.text) as Record<string, unknown>
	} catch {
		return // Haiku output wasn't valid YAML, skip
	}

	// 4. Load existing memory
	const memoryDir = join(companyRoot, 'context', 'memory', agentId)
	const memoryPath = join(memoryDir, 'memory.yaml')
	await mkdir(memoryDir, { recursive: true })

	let existing: Record<string, unknown> = {}
	try {
		const content = await readFile(memoryPath, 'utf-8')
		existing = (parseYaml(content) as Record<string, unknown>) ?? {}
	} catch {
		// No existing memory, start fresh
	}

	// 5. Merge new into existing (append-only)
	const merged = mergeMemory(existing, extracted)

	// 6. Write back
	await writeFile(memoryPath, stringifyYaml(merged, { lineWidth: 120 }))

	// 7. Write session summary
	const summaryPath = join(memoryDir, 'sessions', `${sessionId}.yaml`)
	await mkdir(dirname(summaryPath), { recursive: true })
	await writeFile(summaryPath, stringifyYaml({
		session_id: sessionId,
		date: new Date().toISOString(),
		summary: sessionSummary,
		extracted,
	}, { lineWidth: 120 }))
}

/**
 * Merge extracted memory into existing memory (append-only).
 *
 * - `facts`: per-category arrays are union-deduplicated.
 * - `decisions` / `mistakes`: appended.
 * - `patterns`: appended and deduplicated.
 */
export function mergeMemory(
	existing: Record<string, unknown>,
	extracted: Record<string, unknown>,
): Record<string, unknown> {
	const result = { ...existing }

	// Merge facts (merge arrays per category)
	if (extracted.facts && typeof extracted.facts === 'object') {
		const existingFacts = (result.facts as Record<string, string[]>) ?? {}
		const newFacts = extracted.facts as Record<string, string[]>
		for (const [category, items] of Object.entries(newFacts)) {
			if (!Array.isArray(items)) continue
			existingFacts[category] = [
				...new Set([...(existingFacts[category] ?? []), ...items]),
			]
		}
		result.facts = existingFacts
	}

	// Append decisions
	if (Array.isArray(extracted.decisions)) {
		result.decisions = [...((result.decisions as unknown[]) ?? []), ...extracted.decisions]
	}

	// Append mistakes
	if (Array.isArray(extracted.mistakes)) {
		result.mistakes = [...((result.mistakes as unknown[]) ?? []), ...extracted.mistakes]
	}

	// Append patterns (deduplicate)
	if (Array.isArray(extracted.patterns)) {
		result.patterns = [
			...new Set([...((result.patterns as string[]) ?? []), ...extracted.patterns]),
		]
	}

	return result
}
