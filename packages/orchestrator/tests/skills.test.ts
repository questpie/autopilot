import { describe, it, expect, afterEach } from 'bun:test'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { createTestCompany } from './helpers'
import { loadSkillCatalog, loadSkillContent, getSkillsForRole } from '../src/skills'

describe('skills loader', () => {
	let cleanup: () => Promise<void>
	let root: string

	afterEach(async () => {
		if (cleanup) await cleanup()
	})

	async function setup() {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup
		return root
	}

	it('should find markdown files in knowledge/', async () => {
		await setup()
		const knowledgeDir = join(root, 'knowledge')
		await mkdir(knowledgeDir, { recursive: true })

		await writeFile(join(knowledgeDir, 'code-review.md'), '# Code Review\nSome content')
		await writeFile(join(knowledgeDir, 'testing-guide.md'), '# Testing Guide\nMore content')

		const catalog = await loadSkillCatalog(root)

		expect(catalog.skills).toHaveLength(2)
		const ids = catalog.skills.map((s) => s.id).sort()
		expect(ids).toEqual(['knowledge-code-review', 'knowledge-testing-guide'])
	})

	it('should find markdown files in nested knowledge/ subdirs', async () => {
		await setup()
		const nestedDir = join(root, 'knowledge', 'backend')
		await mkdir(nestedDir, { recursive: true })

		await writeFile(join(nestedDir, 'api-patterns.md'), '# API Patterns')

		const catalog = await loadSkillCatalog(root)

		expect(catalog.skills).toHaveLength(1)
		expect(catalog.skills[0]!.id).toBe('knowledge-backend-api-patterns')
	})

	it('should find markdown files in skills/ directory', async () => {
		await setup()
		const skillsDir = join(root, 'skills')
		await mkdir(skillsDir, { recursive: true })

		await writeFile(join(skillsDir, 'deploy-checklist.md'), '# Deploy Checklist')

		const catalog = await loadSkillCatalog(root)

		expect(catalog.skills).toHaveLength(1)
		expect(catalog.skills[0]!.id).toBe('skills-deploy-checklist')
	})

	it('should parse frontmatter metadata', async () => {
		await setup()
		const knowledgeDir = join(root, 'knowledge')
		await mkdir(knowledgeDir, { recursive: true })

		const content = `---
name: Code Review Checklist
description: How to review code effectively
roles: [reviewer, developer]
---

# Code Review Checklist
Step 1...`

		await writeFile(join(knowledgeDir, 'review.md'), content)

		const catalog = await loadSkillCatalog(root)

		expect(catalog.skills).toHaveLength(1)
		const skill = catalog.skills[0]!
		expect(skill.name).toBe('Code Review Checklist')
		expect(skill.description).toBe('How to review code effectively')
		expect(skill.roles).toEqual(['reviewer', 'developer'])
	})

	it('should derive defaults for files without frontmatter', async () => {
		await setup()
		const knowledgeDir = join(root, 'knowledge')
		await mkdir(knowledgeDir, { recursive: true })

		await writeFile(join(knowledgeDir, 'my-guide.md'), '# My Guide\nJust content, no frontmatter.')

		const catalog = await loadSkillCatalog(root)

		expect(catalog.skills).toHaveLength(1)
		const skill = catalog.skills[0]!
		expect(skill.name).toBe('My Guide')
		expect(skill.description).toBe('')
		expect(skill.roles).toEqual(['all'])
	})

	it('should return empty catalog when no dirs exist', async () => {
		await setup()

		const catalog = await loadSkillCatalog(root)

		expect(catalog.skills).toEqual([])
	})

	it('should filter skills by role', async () => {
		await setup()
		const knowledgeDir = join(root, 'knowledge')
		await mkdir(knowledgeDir, { recursive: true })

		await writeFile(
			join(knowledgeDir, 'review.md'),
			'---\nname: Review Guide\ndescription: For reviewers\nroles: [reviewer]\n---\n# Review',
		)
		await writeFile(
			join(knowledgeDir, 'general.md'),
			'# General Knowledge\nNo frontmatter means roles=all',
		)
		await writeFile(
			join(knowledgeDir, 'dev.md'),
			'---\nname: Dev Guide\ndescription: For devs\nroles: [developer]\n---\n# Dev',
		)

		const reviewerSkills = await getSkillsForRole(root, 'reviewer')
		expect(reviewerSkills).toHaveLength(2) // review + general (all)
		const reviewerIds = reviewerSkills.map((s) => s.id).sort()
		expect(reviewerIds).toContain('knowledge-review')
		expect(reviewerIds).toContain('knowledge-general')

		const devSkills = await getSkillsForRole(root, 'developer')
		expect(devSkills).toHaveLength(2) // dev + general (all)
		const devIds = devSkills.map((s) => s.id).sort()
		expect(devIds).toContain('knowledge-dev')
		expect(devIds).toContain('knowledge-general')
	})

	it('should load full skill content', async () => {
		await setup()
		const knowledgeDir = join(root, 'knowledge')
		await mkdir(knowledgeDir, { recursive: true })

		const mdContent = '---\nname: Test Skill\ndescription: A test\nroles: [all]\n---\n\n# Test Skill\n\nFull content here.'
		await writeFile(join(knowledgeDir, 'test-skill.md'), mdContent)

		const content = await loadSkillContent(root, 'knowledge-test-skill')

		expect(content).toBe(mdContent)
	})

	it('should throw for unknown skill_id', async () => {
		await setup()

		expect(loadSkillContent(root, 'nonexistent')).rejects.toThrow('Skill not found: nonexistent')
	})

	it('should track file size in metadata', async () => {
		await setup()
		const knowledgeDir = join(root, 'knowledge')
		await mkdir(knowledgeDir, { recursive: true })

		const content = '# Big Skill\n' + 'x'.repeat(1000)
		await writeFile(join(knowledgeDir, 'big.md'), content)

		const catalog = await loadSkillCatalog(root)

		expect(catalog.skills[0]!.size).toBe(content.length)
	})
})
