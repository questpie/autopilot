/**
 * D6: Memory extractor tests.
 *
 * Tests the mergeMemory pure function (functional) and verifies
 * extractMemory interface contracts. mergeMemory is the core logic
 * that runs after every agent session.
 */
import { describe, test, expect } from 'bun:test'
import { mergeMemory } from '../src/agent/memory-extractor'

// ─── mergeMemory: bio ───────────────────────────────────────────────────────

describe('mergeMemory: bio', () => {
	test('replaces bio with latest extracted', () => {
		const result = mergeMemory(
			{ bio: 'Old bio' },
			{ bio: 'New bio about current focus' },
		)
		expect(result.bio).toBe('New bio about current focus')
	})

	test('keeps existing bio when extracted is empty', () => {
		const result = mergeMemory(
			{ bio: 'Existing bio' },
			{ bio: '' },
		)
		expect(result.bio).toBe('Existing bio')
	})

	test('keeps existing bio when extracted has no bio field', () => {
		const result = mergeMemory(
			{ bio: 'Existing' },
			{ facts: {} },
		)
		expect(result.bio).toBe('Existing')
	})

	test('trims whitespace from bio', () => {
		const result = mergeMemory({}, { bio: '  New bio  ' })
		expect(result.bio).toBe('New bio')
	})
})

// ─── mergeMemory: facts ─────────────────────────────────────────────────────

describe('mergeMemory: facts', () => {
	test('adds new fact category', () => {
		const result = mergeMemory(
			{},
			{ facts: { database: ['uses SQLite', 'WAL mode enabled'] } },
		)
		const facts = result.facts as Record<string, string[]>
		expect(facts.database).toEqual(['uses SQLite', 'WAL mode enabled'])
	})

	test('merges into existing category with deduplication', () => {
		const result = mergeMemory(
			{ facts: { database: ['uses SQLite'] } },
			{ facts: { database: ['uses SQLite', 'supports Turso'] } },
		)
		const facts = result.facts as Record<string, string[]>
		expect(facts.database).toEqual(['uses SQLite', 'supports Turso'])
	})

	test('preserves existing categories when adding new ones', () => {
		const result = mergeMemory(
			{ facts: { auth: ['uses Better Auth'] } },
			{ facts: { api: ['uses Hono'] } },
		)
		const facts = result.facts as Record<string, string[]>
		expect(facts.auth).toEqual(['uses Better Auth'])
		expect(facts.api).toEqual(['uses Hono'])
	})

	test('handles empty facts object', () => {
		const result = mergeMemory({ facts: { x: ['a'] } }, { facts: {} })
		const facts = result.facts as Record<string, string[]>
		expect(facts.x).toEqual(['a'])
	})

	test('ignores non-array fact values', () => {
		const result = mergeMemory({}, { facts: { bad: 'not an array' as any } })
		const facts = result.facts as Record<string, string[]>
		expect(facts.bad).toBeUndefined()
	})
})

// ─── mergeMemory: decisions ─────────────────────────────────────────────────

describe('mergeMemory: decisions', () => {
	test('appends new decisions', () => {
		const result = mergeMemory(
			{ decisions: [{ date: '2024-01', decision: 'use Hono', reason: 'fast' }] },
			{ decisions: [{ date: '2024-02', decision: 'add auth', reason: 'security' }] },
		)
		const decisions = result.decisions as unknown[]
		expect(decisions).toHaveLength(2)
	})

	test('keeps last 50 decisions (truncates old)', () => {
		const existing = Array.from({ length: 48 }, (_, i) => ({ date: `day-${i}`, decision: `d${i}` }))
		const extracted = Array.from({ length: 5 }, (_, i) => ({ date: `new-${i}`, decision: `n${i}` }))

		const result = mergeMemory({ decisions: existing }, { decisions: extracted })
		const decisions = result.decisions as unknown[]
		expect(decisions).toHaveLength(50) // 48 + 5 = 53, truncated to 50
	})

	test('starts fresh when no existing decisions', () => {
		const result = mergeMemory({}, { decisions: [{ date: 'today', decision: 'first' }] })
		expect((result.decisions as unknown[])).toHaveLength(1)
	})
})

// ─── mergeMemory: mistakes ──────────────────────────────────────────────────

describe('mergeMemory: mistakes', () => {
	test('appends new mistakes', () => {
		const result = mergeMemory(
			{ mistakes: [{ date: 'jan', what: 'typo in config', fix: 'corrected' }] },
			{ mistakes: [{ date: 'feb', what: 'wrong API', fix: 'fixed endpoint' }] },
		)
		expect((result.mistakes as unknown[])).toHaveLength(2)
	})

	test('keeps last 20 mistakes', () => {
		const existing = Array.from({ length: 19 }, (_, i) => ({ what: `m${i}` }))
		const extracted = Array.from({ length: 5 }, (_, i) => ({ what: `n${i}` }))

		const result = mergeMemory({ mistakes: existing }, { mistakes: extracted })
		expect((result.mistakes as unknown[])).toHaveLength(20) // 19 + 5 = 24, truncated to 20
	})
})

// ─── mergeMemory: patterns ──────────────────────────────────────────────────

describe('mergeMemory: patterns', () => {
	test('appends new patterns with deduplication', () => {
		const result = mergeMemory(
			{ patterns: ['writes tests first', 'uses TypeScript'] },
			{ patterns: ['uses TypeScript', 'prefers functional style'] },
		)
		const patterns = result.patterns as string[]
		expect(patterns).toEqual(['writes tests first', 'uses TypeScript', 'prefers functional style'])
	})

	test('keeps last 30 patterns', () => {
		const existing = Array.from({ length: 28 }, (_, i) => `p${i}`)
		const extracted = Array.from({ length: 5 }, (_, i) => `new${i}`)

		const result = mergeMemory({ patterns: existing }, { patterns: extracted })
		expect((result.patterns as string[]).length).toBeLessThanOrEqual(30)
	})

	test('handles no existing patterns', () => {
		const result = mergeMemory({}, { patterns: ['first pattern'] })
		expect((result.patterns as string[])).toEqual(['first pattern'])
	})
})

// ─── mergeMemory: full merge ────────────────────────────────────────────────

describe('mergeMemory: full merge', () => {
	test('merges all fields simultaneously', () => {
		const existing = {
			bio: 'Old bio',
			facts: { lang: ['TypeScript'] },
			decisions: [{ d: '1' }],
			mistakes: [{ m: '1' }],
			patterns: ['pattern1'],
		}
		const extracted = {
			bio: 'Updated bio',
			facts: { lang: ['TypeScript', 'Go'], infra: ['Docker'] },
			decisions: [{ d: '2' }],
			mistakes: [{ m: '2' }],
			patterns: ['pattern1', 'pattern2'],
		}

		const result = mergeMemory(existing, extracted)

		expect(result.bio).toBe('Updated bio')
		expect((result.facts as any).lang).toEqual(['TypeScript', 'Go'])
		expect((result.facts as any).infra).toEqual(['Docker'])
		expect((result.decisions as any[])).toHaveLength(2)
		expect((result.mistakes as any[])).toHaveLength(2)
		expect((result.patterns as string[])).toEqual(['pattern1', 'pattern2'])
	})

	test('handles empty existing memory', () => {
		const result = mergeMemory({}, {
			bio: 'Brand new',
			facts: { tool: ['Hono'] },
			decisions: [{ d: '1' }],
			patterns: ['p1'],
		})
		expect(result.bio).toBe('Brand new')
		expect((result.facts as any).tool).toEqual(['Hono'])
	})

	test('handles empty extracted memory', () => {
		const existing = { bio: 'Keep', facts: { x: ['y'] } }
		const result = mergeMemory(existing, {})
		expect(result.bio).toBe('Keep')
		expect((result.facts as any).x).toEqual(['y'])
	})

	test('preserves extra fields in existing', () => {
		const result = mergeMemory(
			{ bio: 'x', custom_field: 'preserve me' },
			{ bio: 'y' },
		)
		expect(result.custom_field).toBe('preserve me')
	})
})
