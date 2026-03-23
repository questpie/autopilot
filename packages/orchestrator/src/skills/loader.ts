import { readdir, readFile, stat } from 'node:fs/promises'
import { join, basename } from 'node:path'

/** Metadata for a single skill (knowledge document). */
export interface SkillMetadata {
	id: string
	name: string
	description: string
	path: string
	roles: string[]
	size: number
	/** 'agentskills' | 'legacy' | 'claude' */
	format: string
}

/** Complete catalogue of available skills. */
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

interface AgentSkillsFrontmatter {
	name?: string
	description?: string
	metadata?: {
		roles?: string[]
		tags?: string[]
	}
}

function parseAgentSkillsFrontmatter(content: string): AgentSkillsFrontmatter {
	const match = content.match(/^---\s*\n([\s\S]*?)\n---/)
	if (!match) return {}

	const block = match[1]!
	const lines = block.split('\n')
	const result: AgentSkillsFrontmatter = {}
	let inMetadata = false
	let metadataIndent = 0
	let currentKey = ''
	let inMultilineDescription = false
	let descriptionIndent = 0
	const descriptionLines: string[] = []

	for (const line of lines) {
		const trimmed = line.trim()
		const indent = line.length - line.trimStart().length

		// Handle multi-line description continuation
		if (inMultilineDescription) {
			if (trimmed === '' || indent > descriptionIndent) {
				descriptionLines.push(trimmed)
				continue
			}
			// End of multi-line description
			inMultilineDescription = false
			result.description = descriptionLines.join(' ').trim()
		}

		if (trimmed.startsWith('name:')) {
			result.name = trimmed.slice(5).trim()
			inMetadata = false
		} else if (trimmed.startsWith('description:')) {
			const value = trimmed.slice(12).trim()
			if (value === '|' || value === '>') {
				// Multi-line YAML scalar
				inMultilineDescription = true
				descriptionIndent = indent
				descriptionLines.length = 0
			} else {
				result.description = value
			}
			inMetadata = false
		} else if (trimmed.startsWith('metadata:')) {
			inMetadata = true
			metadataIndent = indent
			result.metadata = {}
		} else if (inMetadata && indent > metadataIndent) {
			if (trimmed.startsWith('roles:')) {
				currentKey = 'roles'
				const inline = trimmed.slice(6).trim()
				const arrayMatch = inline.match(/\[([^\]]*)\]/)
				if (arrayMatch) {
					result.metadata!.roles = arrayMatch[1]!
						.split(',')
						.map((r) => r.trim())
						.filter(Boolean)
				} else if (!inline) {
					result.metadata!.roles = []
				}
			} else if (trimmed.startsWith('tags:')) {
				currentKey = 'tags'
				const inline = trimmed.slice(5).trim()
				const arrayMatch = inline.match(/\[([^\]]*)\]/)
				if (arrayMatch) {
					result.metadata!.tags = arrayMatch[1]!
						.split(',')
						.map((r) => r.trim())
						.filter(Boolean)
				} else if (!inline) {
					result.metadata!.tags = []
				}
			} else if (trimmed.startsWith('- ') && currentKey) {
				const value = trimmed.slice(2).trim()
				if (currentKey === 'roles') {
					result.metadata!.roles = result.metadata!.roles ?? []
					result.metadata!.roles.push(value)
				} else if (currentKey === 'tags') {
					result.metadata!.tags = result.metadata!.tags ?? []
					result.metadata!.tags.push(value)
				}
			} else {
				currentKey = ''
			}
		} else {
			inMetadata = false
			currentKey = ''
		}
	}

	// Finalize if description was still being collected
	if (inMultilineDescription && descriptionLines.length > 0) {
		result.description = descriptionLines.join(' ').trim()
	}

	return result
}

function stripFrontmatter(content: string): string {
	return content.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '')
}

function deriveNameFromFilename(filename: string): string {
	return basename(filename, '.md')
		.replace(/[-_]/g, ' ')
		.replace(/\b\w/g, (c) => c.toUpperCase())
}

function deriveIdFromPath(relativePath: string, prefix: string): string {
	const raw = relativePath
		.replace(/\.md$/, '')
		.replace(/[/\\]/g, '-')
		.toLowerCase()
	return prefix ? `${prefix}-${raw}` : raw
}

/**
 * Scan skills/ directory for agentskills.io format: {subdir}/SKILL.md
 */
async function scanAgentSkillsDir(skillsDir: string): Promise<SkillMetadata[]> {
	const skills: SkillMetadata[] = []

	let entries: string[]
	try {
		entries = await readdir(skillsDir)
	} catch {
		return skills
	}

	for (const dirName of entries) {
		const dirPath = join(skillsDir, dirName)
		const dirStat = await stat(dirPath).catch(() => null)
		if (!dirStat?.isDirectory()) continue

		const skillFile = join(dirPath, 'SKILL.md')
		let content: string
		try {
			content = await readFile(skillFile, 'utf-8')
		} catch {
			continue
		}

		const frontmatter = parseAgentSkillsFrontmatter(content)
		const fileStat = await stat(skillFile)
		const roles = frontmatter.metadata?.roles ?? frontmatter.metadata?.tags ?? ['all']

		skills.push({
			id: dirName,
			name: frontmatter.name ?? deriveNameFromFilename(dirName),
			description: frontmatter.description ?? '',
			path: join('skills', dirName, 'SKILL.md'),
			roles,
			size: fileStat.size,
			format: 'agentskills',
		})
	}

	return skills
}

/**
 * Scan a directory recursively for legacy *.md skill files.
 */
async function scanLegacyDirectory(
	dir: string,
	baseDir: string,
	idPrefix: string,
): Promise<SkillMetadata[]> {
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
			const nested = await scanLegacyDirectory(fullPath, baseDir, idPrefix)
			skills.push(...nested)
		} else if (name.endsWith('.md')) {
			const content = await readFile(fullPath, 'utf-8')
			const frontmatter = parseFrontmatter(content)
			const relativePath = fullPath.slice(baseDir.length + 1)

			skills.push({
				id: deriveIdFromPath(relativePath, idPrefix),
				name: frontmatter.name ?? deriveNameFromFilename(name),
				description: frontmatter.description ?? '',
				path: relativePath,
				roles: frontmatter.roles ?? ['all'],
				size: fileStat.size,
				format: idPrefix === 'claude' ? 'claude' : 'legacy',
			})
		}
	}

	return skills
}

/**
 * Load all skills with priority:
 * 1. {companyRoot}/skills/ — agentskills.io format (SKILL.md per subdir)
 * 2. {companyRoot}/knowledge/ — legacy *.md files (includes knowledge/skills/)
 * 3. {companyRoot}/.claude/skills/ — Claude native format
 */
export async function loadSkillCatalog(companyRoot: string): Promise<SkillCatalog> {
	const primaryDir = join(companyRoot, 'skills')
	const knowledgeDir = join(companyRoot, 'knowledge')
	const claudeDir = join(companyRoot, '.claude', 'skills')

	// Primary: agentskills.io format
	const agentSkills = await scanAgentSkillsDir(primaryDir)

	// Collect ids from primary to avoid duplicates
	const seenIds = new Set(agentSkills.map((s) => s.id))

	// Fallback 1: legacy knowledge/ (full tree)
	const legacySkills = (await scanLegacyDirectory(knowledgeDir, companyRoot, 'legacy')).filter(
		(s) => !seenIds.has(s.id),
	)
	for (const s of legacySkills) seenIds.add(s.id)

	// Fallback 2: .claude/skills/
	const claudeSkills = (await scanLegacyDirectory(claudeDir, companyRoot, 'claude')).filter(
		(s) => !seenIds.has(s.id),
	)

	return {
		skills: [...agentSkills, ...legacySkills, ...claudeSkills],
	}
}

/**
 * Load full content of a specific skill.
 * - agentskills.io: strips frontmatter, appends references listing if available
 * - legacy/claude: returns full content as-is
 */
export async function loadSkillContent(companyRoot: string, skillId: string): Promise<string> {
	const catalog = await loadSkillCatalog(companyRoot)
	const skill = catalog.skills.find((s) => s.id === skillId)

	if (!skill) {
		throw new Error(`Skill not found: ${skillId}`)
	}

	const fullPath = join(companyRoot, skill.path)
	const raw = await readFile(fullPath, 'utf-8')

	if (skill.format !== 'agentskills') {
		return raw
	}

	// Strip frontmatter for agentskills.io format
	let body = stripFrontmatter(raw)

	// Check for references/ directory
	const refsDir = join(companyRoot, 'skills', skillId, 'references')
	try {
		const refEntries = await readdir(refsDir)
		const refFiles = refEntries.filter((f) => !f.startsWith('.'))
		if (refFiles.length > 0) {
			const listing = refFiles.map((f) => `- references/${f}`).join('\n')
			body += `\n\n---\n## Available References\n${listing}`
		}
	} catch {
		// no references directory — that's fine
	}

	return body
}

/** Get skills relevant for a specific agent role */
export async function getSkillsForRole(companyRoot: string, role: string): Promise<SkillMetadata[]> {
	const catalog = await loadSkillCatalog(companyRoot)
	return catalog.skills.filter(
		(s) => s.roles.includes('all') || s.roles.includes(role),
	)
}
