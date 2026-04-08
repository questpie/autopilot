import { describe, expect, test, beforeAll, afterAll } from 'bun:test'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { mkdir, writeFile, rm } from 'node:fs/promises'
import { parseSkillContent, loadSkillEntries, searchSkills } from '../src/skills'
import { SkillManifestSchema, SkillEntrySchema, SkillHintSchema } from '../src/schemas/skill'

// ─── Schema tests ────────────────────────────────────────────

describe('SkillManifestSchema', () => {
	test('parses full frontmatter', () => {
		const result = SkillManifestSchema.parse({
			name: 'Code Review',
			description: 'Structured review checklist',
			version: '1.2.0',
			tags: ['review', 'quality'],
			roles: ['developer', 'reviewer'],
			author: 'questpie',
			forked_from: 'upstream/code-review',
			scripts: ['lint.sh'],
		})
		expect(result.name).toBe('Code Review')
		expect(result.tags).toEqual(['review', 'quality'])
		expect(result.forked_from).toBe('upstream/code-review')
	})

	test('applies sensible defaults for empty input', () => {
		const result = SkillManifestSchema.parse({})
		expect(result.name).toBe('')
		expect(result.description).toBe('')
		expect(result.version).toBe('')
		expect(result.tags).toEqual([])
		expect(result.roles).toEqual(['all'])
		expect(result.scripts).toEqual([])
		expect(result.author).toBeUndefined()
		expect(result.forked_from).toBeUndefined()
	})
})

describe('SkillHintSchema', () => {
	test('parses a valid hint', () => {
		const result = SkillHintSchema.parse({
			id: 'code-review',
			name: 'Code Review',
			description: 'Structured review checklist',
		})
		expect(result.id).toBe('code-review')
	})
})

// ─── parseSkillContent ───────────────────────────────────────

describe('parseSkillContent', () => {
	test('parses frontmatter + body', () => {
		const raw = `---
name: "Presentation Builder"
description: "Create slide decks"
tags: ["slides", "content"]
---

# Presentation Builder

Build presentations from briefs.`

		const { manifest, body } = parseSkillContent(raw, 'fallback')
		expect(manifest.name).toBe('Presentation Builder')
		expect(manifest.description).toBe('Create slide decks')
		expect(manifest.tags).toEqual(['slides', 'content'])
		expect(body).toContain('# Presentation Builder')
		expect(body).toContain('Build presentations from briefs.')
	})

	test('uses fallback name when frontmatter has no name', () => {
		const raw = `---
description: "Some skill"
---

Body content here.`

		const { manifest } = parseSkillContent(raw, 'my-skill')
		expect(manifest.name).toBe('my-skill')
	})

	test('handles missing frontmatter entirely', () => {
		const raw = `# Just a markdown file

No frontmatter at all.`

		const { manifest, body } = parseSkillContent(raw, 'raw-skill')
		expect(manifest.name).toBe('raw-skill')
		expect(manifest.description).toBe('')
		expect(manifest.roles).toEqual(['all'])
		expect(body).toContain('# Just a markdown file')
	})

	test('handles malformed YAML frontmatter', () => {
		const raw = `---
this is: [not valid: yaml: {{
---

Body.`

		const { manifest, body } = parseSkillContent(raw, 'bad-yaml')
		expect(manifest.name).toBe('bad-yaml')
		expect(body).toBe('Body.')
	})

	test('parses nested metadata: block', () => {
		const raw = `---
name: Workflow Execution Model
description: Core architecture behind workflow-based execution
metadata:
  roles: [all]
  tags: [architecture, workflows, agents]
  version: "2.0.0"
  author: questpie
---

# Workflow Execution`

		const { manifest } = parseSkillContent(raw, 'fallback')
		expect(manifest.name).toBe('Workflow Execution Model')
		expect(manifest.description).toBe('Core architecture behind workflow-based execution')
		expect(manifest.tags).toEqual(['architecture', 'workflows', 'agents'])
		expect(manifest.roles).toEqual(['all'])
		expect(manifest.version).toBe('2.0.0')
		expect(manifest.author).toBe('questpie')
	})

	test('top-level fields override nested metadata', () => {
		const raw = `---
name: My Skill
description: Top-level desc
tags: [top-tag]
metadata:
  tags: [meta-tag]
  roles: [developer]
  author: community
---

Body.`

		const { manifest } = parseSkillContent(raw, 'fallback')
		expect(manifest.tags).toEqual(['top-tag'])
		expect(manifest.roles).toEqual(['developer'])
		expect(manifest.author).toBe('community')
	})

	test('mixed format: top-level name + metadata tags/roles', () => {
		const raw = `---
name: Code Review
description: Review checklist
license: MIT
metadata:
  author: QUESTPIE
  version: 1.0.0
  tags: []
  roles: [developer, reviewer]
---

# Code Review`

		const { manifest } = parseSkillContent(raw, 'fallback')
		expect(manifest.name).toBe('Code Review')
		expect(manifest.description).toBe('Review checklist')
		expect(manifest.version).toBe('1.0.0')
		expect(manifest.author).toBe('QUESTPIE')
		expect(manifest.roles).toEqual(['developer', 'reviewer'])
		expect(manifest.tags).toEqual([])
	})

	test('metadata block ignored when not an object', () => {
		const raw = `---
name: Simple
metadata: not-an-object
---

Body.`

		const { manifest } = parseSkillContent(raw, 'fallback')
		expect(manifest.name).toBe('Simple')
	})
})

// ─── loadSkillEntries ────────────────────────────────────────

describe('loadSkillEntries', () => {
	let testDir: string

	beforeAll(async () => {
		testDir = join(tmpdir(), `skill-test-${Date.now()}`)
		await mkdir(testDir, { recursive: true })

		// Directory-style skill: testDir/code-review/SKILL.md
		await mkdir(join(testDir, 'code-review'))
		await writeFile(
			join(testDir, 'code-review', 'SKILL.md'),
			`---
name: "Code Review Checklist"
description: "Structured code review"
tags: ["review", "quality"]
version: "1.0.0"
---

# Code Review

Check security, performance, correctness.`,
		)

		// Flat-style skill: testDir/brand-voice.md
		await writeFile(
			join(testDir, 'brand-voice.md'),
			`---
name: "Brand Voice"
description: "Apply company brand tone"
tags: ["content", "brand"]
---

# Brand Voice

Use these guidelines...`,
		)

		// Skill with no frontmatter: testDir/quick-notes.md
		await writeFile(
			join(testDir, 'quick-notes.md'),
			`# Quick Notes

Just a raw markdown skill with no frontmatter.`,
		)
	})

	afterAll(async () => {
		await rm(testDir, { recursive: true, force: true })
	})

	test('loads directory-style SKILL.md', async () => {
		const skills = await loadSkillEntries(testDir)
		const entry = skills.get('code-review')
		expect(entry).toBeDefined()
		expect(entry!.id).toBe('code-review')
		expect(entry!.manifest.name).toBe('Code Review Checklist')
		expect(entry!.manifest.tags).toEqual(['review', 'quality'])
		expect(entry!.manifest.version).toBe('1.0.0')
		expect(entry!.body).toContain('# Code Review')
	})

	test('loads flat .md skill files', async () => {
		const skills = await loadSkillEntries(testDir)
		const entry = skills.get('brand-voice')
		expect(entry).toBeDefined()
		expect(entry!.id).toBe('brand-voice')
		expect(entry!.manifest.name).toBe('Brand Voice')
		expect(entry!.manifest.description).toBe('Apply company brand tone')
	})

	test('handles skill with no frontmatter', async () => {
		const skills = await loadSkillEntries(testDir)
		const entry = skills.get('quick-notes')
		expect(entry).toBeDefined()
		expect(entry!.manifest.name).toBe('quick-notes')
		expect(entry!.manifest.roles).toEqual(['all'])
	})

	test('returns empty map for non-existent directory', async () => {
		const skills = await loadSkillEntries('/tmp/does-not-exist-ever')
		expect(skills.size).toBe(0)
	})

	test('loads all skills from directory', async () => {
		const skills = await loadSkillEntries(testDir)
		expect(skills.size).toBe(3)
		expect(Array.from(skills.keys()).sort()).toEqual(['brand-voice', 'code-review', 'quick-notes'])
	})
})

// ─── searchSkills ────────────────────────────────────────────

describe('searchSkills', () => {
	const skills = new Map<string, any>([
		[
			'code-review',
			{
				id: 'code-review',
				manifest: { name: 'Code Review', description: 'Structured code review', tags: ['review', 'quality'], roles: ['all'] },
				body: '...',
				path: '/skills/code-review/SKILL.md',
			},
		],
		[
			'brand-voice',
			{
				id: 'brand-voice',
				manifest: { name: 'Brand Voice', description: 'Apply company tone', tags: ['content', 'brand'], roles: ['all'] },
				body: '...',
				path: '/skills/brand-voice.md',
			},
		],
		[
			'data-analysis',
			{
				id: 'data-analysis',
				manifest: { name: 'Data Analysis', description: 'Explore and visualize data', tags: ['analytics', 'data'], roles: ['all'] },
				body: '...',
				path: '/skills/data-analysis.md',
			},
		],
	])

	test('finds by name', () => {
		const results = searchSkills(skills, 'review')
		expect(results.length).toBe(1)
		expect(results[0]!.id).toBe('code-review')
	})

	test('finds by tag', () => {
		const results = searchSkills(skills, 'brand')
		expect(results.length).toBe(1)
		expect(results[0]!.id).toBe('brand-voice')
	})

	test('finds by description', () => {
		const results = searchSkills(skills, 'visualize')
		expect(results.length).toBe(1)
		expect(results[0]!.id).toBe('data-analysis')
	})

	test('finds by ID', () => {
		const results = searchSkills(skills, 'data-analysis')
		expect(results.length).toBe(1)
		expect(results[0]!.id).toBe('data-analysis')
	})

	test('returns empty for no match', () => {
		const results = searchSkills(skills, 'nonexistent')
		expect(results.length).toBe(0)
	})

	test('ranks ID/name matches higher than description', () => {
		const results = searchSkills(skills, 'data')
		expect(results[0]!.id).toBe('data-analysis')
	})
})

// ─── Prompt hint format ──────────────────────────────────────

describe('prompt hints format', () => {
	test('skill_hints produce name — description format', () => {
		const hints = [
			{ id: 'code-review', name: 'Code Review', description: 'Structured code review' },
			{ id: 'brand-voice', name: 'Brand Voice', description: '' },
		]

		const formatted = hints.map((h) => `- ${h.id} — ${h.description || h.name}`).join('\n')
		expect(formatted).toBe('- code-review — Structured code review\n- brand-voice — Brand Voice')
	})
})
