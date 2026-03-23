import { Command } from 'commander'
import { cp, readFile, writeFile, access, readdir, symlink, mkdir } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import simpleGit from 'simple-git'
import { program } from '../program'
import { header, success, dim, error, warning } from '../utils/format'

const CLI_ROOT = resolve(import.meta.dir, '..', '..')

/**
 * Resolve the template directory.
 * When installed from npm, templates are copied into the package at packages/cli/templates/.
 * In local dev (monorepo), they live at the repo root: ../../templates/.
 */
async function resolveTemplateDir(): Promise<string> {
	const npmPath = resolve(CLI_ROOT, 'templates', 'solo-dev-shop')
	try {
		await access(npmPath)
		return npmPath
	} catch {}
	// Fallback: monorepo layout
	return resolve(CLI_ROOT, '..', '..', 'templates', 'solo-dev-shop')
}


async function printTree(dir: string, prefix: string = '', isLast: boolean = true): Promise<void> {
	const entries = await readdir(dir, { withFileTypes: true })
	const filtered = entries.filter((e) => !e.name.startsWith('.'))
	for (let i = 0; i < filtered.length; i++) {
		const entry = filtered[i]!
		const last = i === filtered.length - 1
		const connector = last ? '└── ' : '├── '
		const childPrefix = last ? '    ' : '│   '

		if (entry.isDirectory()) {
			console.log(`${prefix}${connector}${entry.name}/`)
			await printTree(join(dir, entry.name), `${prefix}${childPrefix}`, last)
		} else {
			console.log(`${prefix}${connector}${dim(entry.name)}`)
		}
	}
}

program.addCommand(
	new Command('init')
		.description('Create a new QUESTPIE Autopilot company directory')
		.argument('[name]', 'Company name (used for directory and company.yaml)', 'My Company')
		.option('-f, --force', 'Overwrite existing directory if it already exists')
		.action(async (name: string, opts: { force?: boolean }) => {
			try {
				const slug = name
					.toLowerCase()
					.replace(/[^a-z0-9]+/g, '-')
					.replace(/^-|-$/g, '')

				const targetDir = resolve(process.cwd(), slug)

				console.log(header('QUESTPIE Autopilot'))
				console.log(dim(`Initializing company: ${name}\n`))

				// Check if directory already exists
				try {
					await access(targetDir)
					if (!opts.force) {
						console.error(warning(`Directory already exists: ${targetDir}`))
						console.error(dim('Use --force to overwrite.'))
						process.exit(1)
					}
					console.log(warning('Directory exists, overwriting...'))
				} catch {
					// Directory doesn't exist, good
				}

				const templateDir = await resolveTemplateDir()

				// Check template exists
				try {
					await access(templateDir)
				} catch {
					console.error(error('Template directory not found.'))
					console.error(dim(`Expected at: ${templateDir}`))
					console.error(dim('Make sure @questpie/autopilot is properly installed.'))
					process.exit(1)
				}

				await cp(templateDir, targetDir, { recursive: true })

				const companyYamlPath = join(targetDir, 'company.yaml')
				let content = await readFile(companyYamlPath, 'utf-8')
				content = content.replace(/name:\s*"My Company"/, `name: "${name}"`)
				content = content.replace(/slug:\s*"my-company"/, `slug: "${slug}"`)
				await writeFile(companyYamlPath, content, 'utf-8')

				// Create .claude/skills symlink → ../skills (Agent Skills standard)
			const claudeDir = join(targetDir, '.claude')
			await mkdir(claudeDir, { recursive: true })
			try {
				await symlink('../skills', join(claudeDir, 'skills'))
			} catch {
				// Symlink may already exist from template copy
			}

			// Initialize git repository
			const gitignoreContent = [
				'# SQLite operational databases',
				'.data/',
				'',
				'# Secrets (encryption key MUST NOT be in git)',
				'secrets/.master-key',
				'',
				'# Dependencies',
				'node_modules/',
				'',
				'# Build artifacts',
				'.turbo/',
				'dashboard/dist/',
				'',
				'# Session streams (too large, append-only)',
				'logs/sessions/*.jsonl',
				'',
				'# OS files',
				'.DS_Store',
				'Thumbs.db',
			].join('\n')
			await writeFile(join(targetDir, '.gitignore'), gitignoreContent, 'utf-8')

			try {
				const git = simpleGit(targetDir)
				await git.init()
				await git.add('-A')
				await git.commit('chore: initial company setup via autopilot init')
				console.log(success('Git repository initialized'))
				console.log(dim('All changes will be auto-committed by the orchestrator'))
			} catch (err) {
				console.log(warning('Git init skipped — git may not be installed'))
			}

			console.log(success('Company initialized successfully!'))
				console.log(dim('Dashboard template installed'))
				console.log('')
				console.log(`  ${dim('Directory:')}  ${targetDir}`)
				console.log(`  ${dim('Company:')}    ${name}`)
				console.log(`  ${dim('Slug:')}       ${slug}`)
				console.log('')

				console.log(dim('Company structure:'))
				console.log(`${slug}/`)
				await printTree(targetDir)
				console.log('')

				console.log(dim('Next steps:'))
				console.log(`  ${dim('1.')} cd ${slug}`)
				console.log(`  ${dim('2.')} autopilot status`)
				console.log(`  ${dim('3.')} autopilot ask "Build me a landing page"`)
				console.log(`  ${dim('4.')} autopilot start`)
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				console.error(dim('Run "autopilot --help" for usage information.'))
				process.exit(1)
			}
		}),
)
