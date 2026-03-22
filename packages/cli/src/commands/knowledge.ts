import { Command } from 'commander'
import { readdir, readFile, stat, mkdir, writeFile } from 'node:fs/promises'
import { join, dirname } from 'node:path'
import { loadSkillCatalog } from '@questpie/autopilot-orchestrator'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { header, dim, table, success, error, badge } from '../utils/format'

async function buildTree(dir: string, prefix: string = ''): Promise<string[]> {
	let entries: string[]
	try {
		entries = await readdir(dir)
	} catch {
		return []
	}

	entries.sort()
	const lines: string[] = []

	for (let i = 0; i < entries.length; i++) {
		const name = entries[i]!
		const fullPath = join(dir, name)
		const fileStat = await stat(fullPath)
		const isLast = i === entries.length - 1
		const connector = isLast ? '└── ' : '├── '
		const childPrefix = isLast ? '    ' : '│   '

		if (fileStat.isDirectory()) {
			lines.push(`${prefix}${connector}${name}/`)
			const children = await buildTree(fullPath, `${prefix}${childPrefix}`)
			lines.push(...children)
		} else {
			lines.push(`${prefix}${connector}${name}`)
		}
	}

	return lines
}

const knowledgeCmd = new Command('knowledge')
	.description('Manage knowledge documents and skill catalog')
	.action(async () => {
		// Default action: list
		try {
			const root = await findCompanyRoot()
			const dir = join(root, 'knowledge')

			console.log(header('Knowledge'))
			console.log(dim('  knowledge/'))

			const tree = await buildTree(dir)
			if (tree.length === 0) {
				console.log(dim('  (empty)'))
				return
			}

			for (const line of tree) {
				console.log(`  ${line}`)
			}
		} catch (err) {
			console.error(error(err instanceof Error ? err.message : String(err)))
			console.error(dim('Run "autopilot --help" for usage information.'))
			process.exit(1)
		}
	})

knowledgeCmd.addCommand(
	new Command('list')
		.description('List all knowledge documents in tree view')
		.action(async () => {
			try {
				const root = await findCompanyRoot()
				const dir = join(root, 'knowledge')

				console.log(header('Knowledge'))
				console.log(dim('  knowledge/'))

				const tree = await buildTree(dir)
				if (tree.length === 0) {
					console.log(dim('  (empty)'))
					return
				}

				for (const line of tree) {
					console.log(`  ${line}`)
				}
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				console.error(dim('Run "autopilot --help" for usage information.'))
				process.exit(1)
			}
		}),
)

knowledgeCmd.addCommand(
	new Command('show')
		.description('Print the contents of a knowledge document')
		.argument('<path>', 'Relative path within knowledge/ directory')
		.action(async (docPath: string) => {
			try {
				const root = await findCompanyRoot()
				const filePath = join(root, 'knowledge', docPath)

				try {
					const content = await readFile(filePath, 'utf-8')
					console.log(header(`knowledge/${docPath}`))
					console.log('')
					console.log(content)
				} catch {
					console.error(error(`Knowledge doc not found: ${docPath}`))
					console.error(dim('Use "autopilot knowledge list" to see available docs.'))
					process.exit(1)
				}
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				console.error(dim('Run "autopilot --help" for usage information.'))
				process.exit(1)
			}
		}),
)

knowledgeCmd.addCommand(
	new Command('add')
		.description('Add a knowledge document from file or stdin')
		.argument('<path>', 'Relative path within knowledge/ directory')
		.option('--file <filepath>', 'Source file to copy content from')
		.action(async (docPath: string, opts: { file?: string }) => {
			try {
				const root = await findCompanyRoot()
				const targetPath = join(root, 'knowledge', docPath)

				let content: string
				if (opts.file) {
					content = await readFile(opts.file, 'utf-8')
				} else {
					// Read from stdin
					const chunks: Buffer[] = []
					for await (const chunk of process.stdin) {
						chunks.push(chunk as Buffer)
					}
					content = Buffer.concat(chunks).toString('utf-8')
				}

				await mkdir(dirname(targetPath), { recursive: true })
				await writeFile(targetPath, content, 'utf-8')
				console.log(success(`Added knowledge/${docPath}`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				console.error(dim('Run "autopilot --help" for usage information.'))
				process.exit(1)
			}
		}),
)

knowledgeCmd.addCommand(
	new Command('scan')
		.description('Parse knowledge/ and show the skill catalog')
		.action(async () => {
			try {
				const root = await findCompanyRoot()
				const catalog = await loadSkillCatalog(root)

				console.log(header('Skill Catalog'))
				if (catalog.skills.length === 0) {
					console.log(dim('  No skills found'))
					return
				}

				console.log(
					table(
						catalog.skills.map((s) => [
							badge(s.id, 'cyan'),
							s.name,
							dim(s.description || '(no description)'),
							dim(`roles: ${s.roles.join(', ')}`),
						]),
					),
				)
				console.log('')
				console.log(dim(`${catalog.skills.length} skill(s)`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				console.error(dim('Run "autopilot --help" for usage information.'))
				process.exit(1)
			}
		}),
)

program.addCommand(knowledgeCmd)
