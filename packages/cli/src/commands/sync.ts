import { Command } from 'commander'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, cpSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { success, dim, error, warning, separator } from '../utils/format'

const MARKER_START = '<!-- autopilot:start -->'
const MARKER_END = '<!-- autopilot:end -->'

/**
 * Generate or update a file with a marked autopilot section.
 * If the file exists, replaces content between markers (or prepends if no markers).
 * If the file doesn't exist, creates it with just the autopilot section.
 */
function upsertMarkedSection(filePath: string, title: string, content: string): void {
	const section = `${MARKER_START}\n## ${title}\n\n> Generated from .autopilot/ — do not edit this section manually.\n\n${content}\n${MARKER_END}`

	if (!existsSync(filePath)) {
		writeFileSync(filePath, section + '\n')
		return
	}

	const existing = readFileSync(filePath, 'utf-8')
	const startIdx = existing.indexOf(MARKER_START)
	const endIdx = existing.indexOf(MARKER_END)

	if (startIdx !== -1 && endIdx !== -1) {
		// Replace existing marked section
		const before = existing.slice(0, startIdx)
		const after = existing.slice(endIdx + MARKER_END.length)
		writeFileSync(filePath, before + section + after)
	} else {
		// Prepend the section
		writeFileSync(filePath, section + '\n\n' + existing)
	}
}

/**
 * Copy skills from .autopilot/skills/ to a target directory (additive — does not delete existing).
 */
function syncSkills(sourceDir: string, targetDir: string): number {
	if (!existsSync(sourceDir)) return 0
	mkdirSync(targetDir, { recursive: true })

	let count = 0
	for (const entry of readdirSync(sourceDir, { withFileTypes: true })) {
		const src = join(sourceDir, entry.name)
		const dest = join(targetDir, entry.name)
		if (entry.isDirectory()) {
			// Standard SKILL.md format: directory with SKILL.md inside
			cpSync(src, dest, { recursive: true })
			count++
		} else if (entry.name.endsWith('.md')) {
			// Flat .md skill file
			cpSync(src, dest)
			count++
		}
	}
	return count
}

const syncCmd = new Command('sync')
	.description('Generate compatibility files (CLAUDE.md, AGENTS.md) and sync skills to runtime paths')
	.option('--cwd <dir>', 'Working directory (defaults to cwd)')
	.action(async (opts: { cwd?: string }) => {
		try {
			const cwd = resolve(opts.cwd ?? process.cwd())
			const companyRoot = await findCompanyRoot(cwd)

			console.log(dim(`Company root: ${companyRoot}`))
			console.log(separator())

			const autopilotDir = join(companyRoot, '.autopilot')

			// ── Generate CLAUDE.md from .autopilot/context/ ──────────────
			const contextDir = join(autopilotDir, 'context')
			if (existsSync(contextDir)) {
				const contextFiles = readdirSync(contextDir)
					.filter((f) => f.endsWith('.md') || f.endsWith('.txt'))
					.sort()

				if (contextFiles.length > 0) {
					const parts: string[] = []
					for (const f of contextFiles) {
						const content = readFileSync(join(contextDir, f), 'utf-8').trim()
						const name = f.replace(/\.(md|txt)$/, '')
						parts.push(`### ${name}\n\n${content}`)
					}

					upsertMarkedSection(
						join(companyRoot, 'CLAUDE.md'),
						'Autopilot Context',
						parts.join('\n\n'),
					)
					console.log(success(`CLAUDE.md updated (${contextFiles.length} context files)`))
				} else {
					console.log(dim('  No context files in .autopilot/context/'))
				}
			} else {
				console.log(dim('  No .autopilot/context/ directory'))
			}

			// ── Generate AGENTS.md from .autopilot/agents/ ──────────────
			const agentsDir = join(autopilotDir, 'agents')
			if (existsSync(agentsDir)) {
				const agentFiles = readdirSync(agentsDir)
					.filter((f) => f.endsWith('.yaml') || f.endsWith('.yml'))
					.sort()

				if (agentFiles.length > 0) {
					const { parse: parseYaml } = await import('yaml')
					const lines: string[] = []
					for (const f of agentFiles) {
						const raw = readFileSync(join(agentsDir, f), 'utf-8')
						const parsed = parseYaml(raw)
						const id = parsed?.id ?? f.replace(/\.ya?ml$/, '')
						const name = parsed?.name ?? id
						const role = parsed?.role ?? ''
						const desc = parsed?.description ?? ''
						lines.push(`- **${name}** (\`${id}\`) — ${role}${desc ? `: ${desc}` : ''}`)
					}

					upsertMarkedSection(
						join(companyRoot, 'AGENTS.md'),
						'Autopilot Agents',
						lines.join('\n'),
					)
					console.log(success(`AGENTS.md updated (${agentFiles.length} agents)`))
				} else {
					console.log(dim('  No agent files in .autopilot/agents/'))
				}
			} else {
				console.log(dim('  No .autopilot/agents/ directory'))
			}

			// ── Sync skills to .claude/skills/ and .agents/skills/ ──────
			const skillsDir = join(autopilotDir, 'skills')
			if (existsSync(skillsDir)) {
				const claudeCount = syncSkills(skillsDir, join(companyRoot, '.claude', 'skills'))
				const agentsCount = syncSkills(skillsDir, join(companyRoot, '.agents', 'skills'))

				if (claudeCount > 0 || agentsCount > 0) {
					console.log(success(`Skills synced: ${claudeCount} → .claude/skills/, ${agentsCount} → .agents/skills/`))
				} else {
					console.log(dim('  No skills to sync'))
				}
			} else {
				console.log(dim('  No .autopilot/skills/ directory'))
			}

			console.log('')
			console.log(success('Sync complete'))
		} catch (err) {
			console.error(error(err instanceof Error ? err.message : String(err)))
			process.exit(1)
		}
	})

program.addCommand(syncCmd)
