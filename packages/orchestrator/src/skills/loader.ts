import { readdir, readFile, stat } from 'node:fs/promises'
import { join, basename } from 'node:path'

export interface SkillMetadata {
	id: string
	name: string
	description: string
	path: string
	roles: string[]
	size: number
}

export interface SkillCatalog {
	skills: SkillMetadata[]
}

interface ParsedFrontmatter {
	name?: string
	description?: string
	roles?: string[]
}

function parseFrontmatter(content: string): ParsedFrontmatter {
	const match = content.match(/^---\s*\n([\s\S]*?)\n---/)
	if (!match) return {}

	const block = match[1]!
	const result: ParsedFrontmatter = {}

	for (const line of block.split('\n')) {
		const trimmed = line.trim()
		if (trimmed.startsWith('name:')) {
			result.name = trimmed.slice(5).trim()
		} else if (trimmed.startsWith('description:')) {
			result.description = trimmed.slice(12).trim()
		} else if (trimmed.startsWith('roles:')) {
			const rolesStr = trimmed.slice(6).trim()
			const arrayMatch = rolesStr.match(/\[([^\]]*)\]/)
			if (arrayMatch) {
				result.roles = arrayMatch[1]!
					.split(',')
					.map((r) => r.trim())
					.filter(Boolean)
			}
		}
	}

	return result
}

function deriveNameFromFilename(filename: string): string {
	return basename(filename, '.md')
		.replace(/[-_]/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase())
}

function deriveIdFromPath(relativePath: string): string {
	return relativePath
		.replace(/\.md$/, '')
		.replace(/[/\\]/g, '-')
		.toLowerCase()
}

async function scanDirectory(dir: string, baseDir: string): Promise<SkillMetadata[]> {
	const skills: SkillMetadata[] = []

	let entries: string[]
	try {
		entries = await readdir(dir)
	} catch {
		return skills
	}

	for (const name of entries) {
		const fullPath = join(dir, name)
		const fileStat = await stat(fullPath)

		if (fileStat.isDirectory()) {
			const nested = await scanDirectory(fullPath, baseDir)
			skills.push(...nested)
		} else if (name.endsWith('.md')) {
			const content = await readFile(fullPath, 'utf-8')
			const frontmatter = parseFrontmatter(content)
			const relativePath = fullPath.slice(baseDir.length + 1)

			skills.push({
				id: deriveIdFromPath(relativePath),
				name: frontmatter.name ?? deriveNameFromFilename(name),
				description: frontmatter.description ?? '',
				path: relativePath,
				roles: frontmatter.roles ?? ['all'],
				size: fileStat.size,
			})
		}
	}

	return skills
}

/** Load all skills from /knowledge/ and /skills/ directories */
export async function loadSkillCatalog(companyRoot: string): Promise<SkillCatalog> {
	const knowledgeDir = join(companyRoot, 'knowledge')
	const skillsDir = join(companyRoot, 'skills')

	const [knowledgeSkills, dirSkills] = await Promise.all([
		scanDirectory(knowledgeDir, companyRoot),
		scanDirectory(skillsDir, companyRoot),
	])

	return {
		skills: [...knowledgeSkills, ...dirSkills],
	}
}

/** Load full content of a specific skill */
export async function loadSkillContent(companyRoot: string, skillId: string): Promise<string> {
	const catalog = await loadSkillCatalog(companyRoot)
	const skill = catalog.skills.find((s) => s.id === skillId)

	if (!skill) {
		throw new Error(`Skill not found: ${skillId}`)
	}

	return readFile(join(companyRoot, skill.path), 'utf-8')
}

/** Get skills relevant for a specific agent role */
export async function getSkillsForRole(companyRoot: string, role: string): Promise<SkillMetadata[]> {
	const catalog = await loadSkillCatalog(companyRoot)
	return catalog.skills.filter(
		(s) => s.roles.includes('all') || s.roles.includes(role),
	)
}
