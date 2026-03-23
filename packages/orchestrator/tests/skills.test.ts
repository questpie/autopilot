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

	// ── agentskills.io format (primary) ──────────────────────────

	it('should find SKILL.md in skills/ subdirectories', async () => {
		await setup()
		const skillDir = join(root, 'skills', 'code-review')
		await mkdir(skillDir, { recursive: true })

		await writeFile(join(skillDir, 'SKILL.md'), `---
name: code-review
description: |
  How to review code
metadata:
  roles: [reviewer, developer]
---

# Code Review
Content here.`)

		const catalog = await loadSkillCatalog(root)

		expect(catalog.skills).toHaveLength(1)
		expect(catalog.skills[0]!.id).toBe('code-review')
		expect(catalog.skills[0]!.format).toBe('agentskills')
	})

	it('should parse agentskills.io frontmatter with metadata.roles', async () => {
		await setup()
		const skillDir = join(root, 'skills', 'testing')
		await mkdir(skillDir, { recursive: true })

		await writeFile(join(skillDir, 'SKILL.md'), `---
name: testing
description: |
  Testing best practices
license: MIT
metadata:
  author: QUESTPIE
  version: 1.0.0
  tags: [testing, quality]
  roles: [developer, reviewer]
---

# Testing
Some content.`)

		const catalog = await loadSkillCatalog(root)
		const skill = catalog.skills[0]!

		expect(skill.name).toBe('testing')
		expect(skill.description).toContain('Testing best practices')
		expect(skill.roles).toEqual(['developer', 'reviewer'])
		expect(skill.format).toBe('agentskills')
	})

	it('should strip frontmatter from agentskills.io content', async () => {
		await setup()
		const skillDir = join(root, 'skills', 'my-skill')
		await mkdir(skillDir, { recursive: true })

		await writeFile(join(skillDir, 'SKILL.md'), `---
name: my-skill
description: Test skill
metadata:
  roles: [all]
---

# My Skill

Full content here.`)

		const content = await loadSkillContent(root, 'my-skill')

		expect(content).not.toContain('---')
		expect(content).not.toContain('name: my-skill')
		expect(content).toContain('# My Skill')
		expect(content).toContain('Full content here.')
	})

	it('should list available references', async () => {
		await setup()
		const skillDir = join(root, 'skills', 'my-skill')
		const refsDir = join(skillDir, 'references')
		await mkdir(refsDir, { recursive: true })

		await writeFile(join(skillDir, 'SKILL.md'), `---
name: my-skill
description: Test
metadata:
  roles: [all]
---

# My Skill`)

		await writeFile(join(refsDir, 'patterns.md'), '# Patterns')
		await writeFile(join(refsDir, 'examples.md'), '# Examples')

		const content = await loadSkillContent(root, 'my-skill')

		expect(content).toContain('Available References')
		expect(content).toContain('references/patterns.md')
		expect(content).toContain('references/examples.md')
	})

	// ── Legacy format (fallback) ────────────────────────────────

	it('should find legacy markdown files in knowledge/skills/', async () => {
		await setup()
		const knowledgeDir = join(root, 'knowledge', 'skills')
		await mkdir(knowledgeDir, { recursive: true })

		await writeFile(join(knowledgeDir, 'code-review.md'), '# Code Review\nSome content')

		const catalog = await loadSkillCatalog(root)

		expect(catalog.skills).toHaveLength(1)
		expect(catalog.skills[0]!.format).toBe('legacy')
	})

	it('should find legacy files in knowledge/ subdirs', async () => {
		await setup()
		const nestedDir = join(root, 'knowledge', 'backend')
		await mkdir(nestedDir, { recursive: true })

		await writeFile(join(nestedDir, 'api-patterns.md'), '# API Patterns')

		const catalog = await loadSkillCatalog(root)

		expect(catalog.skills).toHaveLength(1)
	})

	it('should return full content for legacy skills', async () => {
		await setup()
		const knowledgeDir = join(root, 'knowledge', 'skills')
		await mkdir(knowledgeDir, { recursive: true })

		const mdContent = '---\nname: Test Skill\ndescription: A test\nroles: [all]\n---\n\n# Test Skill\n\nFull content here.'
		await writeFile(join(knowledgeDir, 'test-skill.md'), mdContent)

		const catalog = await loadSkillCatalog(root)
		const skill = catalog.skills[0]!
		const content = await loadSkillContent(root, skill.id)

		expect(content).toBe(mdContent)
	})

	it('should parse legacy frontmatter metadata', async () => {
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

	// ── Priority / deduplication ────────────────────────────────

	it('should prefer agentskills.io over legacy when both exist', async () => {
		await setup()
		// Create agentskills.io version
		const skillDir = join(root, 'skills', 'code-review')
		await mkdir(skillDir, { recursive: true })
		await writeFile(join(skillDir, 'SKILL.md'), `---
name: code-review
description: agentskills version
metadata:
  roles: [reviewer]
---

# Code Review (new)`)

		// Create legacy version
		const legacyDir = join(root, 'knowledge', 'skills')
		await mkdir(legacyDir, { recursive: true })
		await writeFile(join(legacyDir, 'code-review.md'), '---\nname: Code Review\ndescription: legacy\nroles: [reviewer]\n---\n# old')

		const catalog = await loadSkillCatalog(root)

		// agentskills.io should be loaded, legacy should still be loaded with prefixed id
		const agentSkill = catalog.skills.find((s) => s.id === 'code-review')
		expect(agentSkill).toBeDefined()
		expect(agentSkill!.format).toBe('agentskills')
		expect(agentSkill!.description).toContain('agentskills')
	})

	// ── Claude native format ────────────────────────────────────

	it('should find skills in .claude/skills/', async () => {
		await setup()
		const claudeDir = join(root, '.claude', 'skills')
		await mkdir(claudeDir, { recursive: true })

		await writeFile(join(claudeDir, 'helper.md'), '# Claude Skill\nContent')

		const catalog = await loadSkillCatalog(root)

		const skill = catalog.skills.find((s) => s.format === 'claude')
		expect(skill).toBeDefined()
	})

	// ── Role filtering ──────────────────────────────────────────

	it('should filter skills by role', async () => {
		await setup()
		const skillDir1 = join(root, 'skills', 'review-guide')
		const skillDir2 = join(root, 'skills', 'dev-guide')
		await mkdir(skillDir1, { recursive: true })
		await mkdir(skillDir2, { recursive: true })

		await writeFile(join(skillDir1, 'SKILL.md'), `---
name: review-guide
description: For reviewers
metadata:
  roles: [reviewer]
---
# Review`)

		await writeFile(join(skillDir2, 'SKILL.md'), `---
name: dev-guide
description: For devs
metadata:
  roles: [developer]
---
# Dev`)

		const reviewerSkills = await getSkillsForRole(root, 'reviewer')
		expect(reviewerSkills).toHaveLength(1)
		expect(reviewerSkills[0]!.id).toBe('review-guide')

		const devSkills = await getSkillsForRole(root, 'developer')
		expect(devSkills).toHaveLength(1)
		expect(devSkills[0]!.id).toBe('dev-guide')
	})

	// ── Edge cases ──────────────────────────────────────────────

	it('should return empty catalog when no dirs exist', async () => {
		await setup()

		const catalog = await loadSkillCatalog(root)

		expect(catalog.skills).toEqual([])
	})

	it('should throw for unknown skill_id', async () => {
		await setup()

		expect(loadSkillContent(root, 'nonexistent')).rejects.toThrow('Skill not found: nonexistent')
	})

	it('should track file size in metadata', async () => {
		await setup()
		const skillDir = join(root, 'skills', 'big-skill')
		await mkdir(skillDir, { recursive: true })

		const content = `---
name: big-skill
description: test
metadata:
  roles: [all]
---

# Big Skill
${'x'.repeat(1000)}`
		await writeFile(join(skillDir, 'SKILL.md'), content)

		const catalog = await loadSkillCatalog(root)

		expect(catalog.skills[0]!.size).toBe(content.length)
	})
})
