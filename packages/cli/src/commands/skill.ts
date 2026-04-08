import { Command } from 'commander'
import { join } from 'node:path'
import { program } from '../program'
import { section, dim, error, badge, table } from '../utils/format'
import { findCompanyRoot } from '../utils/find-root'
import { PATHS, loadSkillEntries, searchSkills } from '@questpie/autopilot-spec'
import type { SkillEntry } from '@questpie/autopilot-spec'

/** Load all skills from the company skills directory. */
async function loadLocalSkills(): Promise<Map<string, SkillEntry>> {
	const root = await findCompanyRoot()
	return loadSkillEntries(join(root, PATHS.SKILLS_DIR))
}

/** Format a single skill entry as a table row. */
function formatSkillRow(entry: SkillEntry): string[] {
	const name = entry.manifest.name || entry.id
	const desc = dim(entry.manifest.description || '—')
	const tags =
		entry.manifest.tags.length > 0
			? entry.manifest.tags.map((t) => badge(t, 'cyan')).join(' ')
			: dim('—')
	return [name, desc, tags]
}

const skillCmd = new Command('skill').description('Inspect locally available skills')

// ── list ──────────────────────────────────────────────────

skillCmd.addCommand(
	new Command('list')
		.description('List all locally installed skills')
		.action(async () => {
			try {
				const skills = await loadLocalSkills()
				if (skills.size === 0) {
					console.log(dim('No repo-local skills found in .autopilot/skills/'))
					console.log(dim('Discover public skills with: autopilot skill discover <query>'))
					console.log(dim('Add repo-local skills by authoring or syncing them into .autopilot/skills/'))
					return
				}

				console.log(section(`Skills (${skills.size})`))
				const rows = Array.from(skills.values()).map(formatSkillRow)
				console.log(table(rows))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

// ── show ──────────────────────────────────────────────────

skillCmd.addCommand(
	new Command('show')
		.description('Show full content of a skill')
		.argument('<id>', 'Skill identifier')
		.action(async (id: string) => {
			try {
				const skills = await loadLocalSkills()
				const entry = skills.get(id)
				if (!entry) {
					console.error(error(`Skill "${id}" not found`))
					console.log(dim(`Available: ${Array.from(skills.keys()).join(', ') || 'none'}`))
					process.exit(1)
				}

				const m = entry.manifest
				console.log(section(m.name || id))
				if (m.description) console.log(dim(m.description))
				console.log('')

				const meta: string[] = []
				if (m.version) meta.push(`Version: ${m.version}`)
				if (m.author) meta.push(`Author: ${m.author}`)
				if (m.forked_from) meta.push(`Forked from: ${m.forked_from}`)
				if (m.roles.length > 0 && !(m.roles.length === 1 && m.roles[0] === 'all')) {
					meta.push(`Roles: ${m.roles.join(', ')}`)
				}
				if (m.tags.length > 0)
					meta.push(`Tags: ${m.tags.map((t) => badge(t, 'cyan')).join(' ')}`)
				if (meta.length > 0) {
					console.log(meta.join('\n'))
					console.log('')
				}

				console.log(dim(`Path: ${entry.path}`))
				console.log('')
				console.log(entry.body)
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

// ── find ──────────────────────────────────────────────────

skillCmd.addCommand(
	new Command('find')
		.description('Search locally installed skills by keyword')
		.argument('<query>', 'Search query')
		.action(async (query: string) => {
			try {
				const skills = await loadLocalSkills()
				if (skills.size === 0) {
					console.log(dim('No repo-local skills in .autopilot/skills/'))
					console.log(dim('Search the public ecosystem with: autopilot skill discover <query>'))
					return
				}

				const results = searchSkills(skills, query)
				if (results.length === 0) {
					console.log(dim(`No repo-local skills matching "${query}"`))
					console.log(dim(`Search the public ecosystem with: autopilot skill discover ${query}`))
					return
				}

				console.log(section(`Local results for "${query}" (${results.length})`))
				const rows = results.map(formatSkillRow)
				console.log(table(rows))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		}),
)

// ── discover ──────────────────────────────────────────────

skillCmd.addCommand(
	new Command('discover')
		.description('Search the public skill ecosystem (wraps bunx skills find)')
		.argument('<query>', 'Search query')
		.action(async (query: string) => {
			try {
				const proc = Bun.spawn(['bunx', 'skills', 'find', query], {
					stdout: 'inherit',
					stderr: 'inherit',
					stdin: 'inherit',
				})
				const exitCode = await proc.exited
				if (exitCode !== 0) {
					console.log('')
					console.log(dim('If bunx skills is not installed, run: bun add -g skills'))
				}
			} catch (err) {
				console.error(error('Failed to run upstream skills CLI'))
				console.log(dim('Install with: bun add -g skills'))
				console.log(dim(`Or search directly: bunx skills find ${query}`))
			}
		}),
)

program.addCommand(skillCmd)
