import { readFile, readdir, stat } from 'node:fs/promises'
import { basename, dirname, join, relative } from 'node:path'
import { Command } from 'commander'
import { program } from '../program'
import { getBaseUrl } from '../utils/client'
import { error, section, success } from '../utils/format'
import { getAuthHeaders } from './auth'

function authHeaders(): Record<string, string> {
	const headers: Record<string, string> = {
		...getAuthHeaders(),
		'Content-Type': 'application/json',
	}
	if (!headers.Authorization && !headers.Cookie) headers['X-Local-Dev'] = 'true'
	return headers
}

function mimeFor(path: string): string {
	const lower = path.toLowerCase()
	if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'text/markdown'
	if (lower.endsWith('.yaml') || lower.endsWith('.yml')) return 'text/yaml'
	if (lower.endsWith('.json')) return 'application/json'
	if (lower.endsWith('.txt')) return 'text/plain'
	return 'application/octet-stream'
}

async function collectFiles(path: string): Promise<string[]> {
	const info = await stat(path)
	if (info.isFile()) return [path]
	const entries = await readdir(path, { withFileTypes: true })
	const files: string[] = []
	for (const entry of entries) {
		if (entry.name.startsWith('.')) continue
		const child = join(path, entry.name)
		if (entry.isDirectory()) files.push(...(await collectFiles(child)))
		if (entry.isFile()) files.push(child)
	}
	return files
}

const knowledgeCmd = new Command('knowledge').description('Manage knowledge documents')

knowledgeCmd.addCommand(
	new Command('import')
		.description('Import files into knowledge storage')
		.argument('<path>', 'File or directory to import')
		.option('--prefix <path>', 'Virtual knowledge path prefix')
		.option('--scope <scope>', 'Scope type: company, project, or task', 'company')
		.option('--scope-id <id>', 'Scope ID for project/task scope')
		.option('--project <id>', 'Project scope ID')
		.option('--task <id>', 'Task scope ID')
		.action(
			async (
				inputPath: string,
				opts: {
					prefix?: string
					scope?: string
					scopeId?: string
					project?: string
					task?: string
				},
			) => {
				try {
					const files = await collectFiles(inputPath)
					const base = (await stat(inputPath)).isDirectory() ? inputPath : dirname(inputPath)
					const headers = authHeaders()
					let imported = 0

					for (const file of files) {
						const rel = relative(base, file).replace(/\\/g, '/')
						const virtualPath = [opts.prefix?.replace(/\/+$/, ''), rel].filter(Boolean).join('/')
						const url = new URL(`/api/knowledge/${virtualPath}`, getBaseUrl())
						const scopeType =
							opts.scope === 'project' || opts.project
								? 'project'
								: opts.scope === 'task' || opts.task
									? 'task'
									: 'company'
						if (scopeType !== 'company') url.searchParams.set('scope_type', scopeType)
						const scopeId = opts.scopeId ?? (scopeType === 'project' ? opts.project : opts.task)
						if (scopeId) url.searchParams.set('scope_id', scopeId)

						const res = await fetch(url, {
							method: 'PUT',
							headers,
							body: JSON.stringify({
								content: await readFile(file, 'utf-8'),
								title: basename(file),
								mime_type: mimeFor(file),
							}),
						})
						if (!res.ok)
							throw new Error(`Failed to import ${file}: ${res.status} ${await res.text()}`)
						imported++
					}

					console.log(section('Knowledge Import'))
					console.log(success(`Imported ${imported} file(s)`))
				} catch (err) {
					console.error(error(err instanceof Error ? err.message : String(err)))
					process.exit(1)
				}
			},
		),
)

program.addCommand(knowledgeCmd)
