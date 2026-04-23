import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { basename, join, resolve } from 'node:path'
import { PATHS } from '@questpie/autopilot-spec'
import { Command } from 'commander'
import { stringify as stringifyYaml } from 'yaml'
import { program } from '../program'
import { getBaseUrl } from '../utils/client'
import { dim, error, success, warning } from '../utils/format'
import { getAuthHeaders } from './auth'

function projectHeaders(): Record<string, string> {
	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		...getAuthHeaders(),
	}
	if (!headers.Authorization && !headers['X-API-Key']) {
		headers['X-Local-Dev'] = 'true'
	}
	return headers
}

function git(args: string[], cwd: string): { ok: boolean; stdout: string; stderr: string } {
	const result = Bun.spawnSync(['git', ...args], {
		cwd,
		stdout: 'pipe',
		stderr: 'pipe',
	})
	return {
		ok: result.exitCode === 0,
		stdout: result.stdout.toString().trim(),
		stderr: result.stderr.toString().trim(),
	}
}

function detectRepoRoot(from: string): string | null {
	const result = git(['rev-parse', '--show-toplevel'], from)
	return result.ok && result.stdout ? result.stdout : null
}

function detectRemote(repoRoot: string): string | null {
	const result = git(['config', '--get', 'remote.origin.url'], repoRoot)
	return result.ok && result.stdout ? result.stdout : null
}

function detectDefaultBranch(repoRoot: string): string | null {
	const headRef = git(['symbolic-ref', 'refs/remotes/origin/HEAD'], repoRoot)
	if (headRef.ok && headRef.stdout) {
		const ref = headRef.stdout.split('/').pop()
		if (ref) return ref
	}

	const localBranch = git(['branch', '--show-current'], repoRoot)
	return localBranch.ok && localBranch.stdout ? localBranch.stdout : null
}

const initCmd = new Command('init')
	.description('Register the current git project with the orchestrator')
	.argument('[path]', 'Project path (defaults to current directory)')
	.option('--name <name>', 'Project display name')
	.option('--url <url>', 'Remote orchestrator URL')
	.option('--no-scaffold', 'Do not create .autopilot/project.yaml when missing')
	.action(
		async (
			pathArg: string | undefined,
			opts: { name?: string; url?: string; scaffold?: boolean },
		) => {
			try {
				const startPath = resolve(pathArg ?? process.cwd())
				const repoRoot = detectRepoRoot(startPath)

				if (!repoRoot) {
					console.error(error('No git repository detected.'))
					console.error(
						dim('  Run this command inside the project repository you want to register.'),
					)
					process.exit(1)
				}

				const projectName = opts.name?.trim() || basename(repoRoot)
				const gitRemote = detectRemote(repoRoot)
				const defaultBranch = detectDefaultBranch(repoRoot)

				const res = await fetch(`${opts.url ?? getBaseUrl()}/api/projects`, {
					method: 'POST',
					headers: projectHeaders(),
					body: JSON.stringify({
						name: projectName,
						path: repoRoot,
						git_remote: gitRemote ?? undefined,
						default_branch: defaultBranch ?? undefined,
					}),
				})

				if (!res.ok) {
					throw new Error(`Failed to register project (${res.status}): ${await res.text()}`)
				}

				const project = (await res.json()) as {
					id: string
					name: string
					path: string
					git_remote: string | null
					default_branch: string | null
				}

				const projectYamlPath = join(repoRoot, PATHS.PROJECT_CONFIG)
				let scaffolded = false
				if (opts.scaffold !== false && !existsSync(projectYamlPath)) {
					mkdirSync(join(repoRoot, PATHS.AUTOPILOT_DIR), { recursive: true })
					writeFileSync(
						projectYamlPath,
						stringifyYaml({
							name: project.name,
							description: '',
							defaults: {},
						}),
						'utf-8',
					)
					scaffolded = true
				}

				console.log(success(`Project registered: ${project.id}`))
				console.log(dim(`  Name:   ${project.name}`))
				console.log(dim(`  Path:   ${project.path}`))
				if (project.git_remote) console.log(dim(`  Remote: ${project.git_remote}`))
				if (project.default_branch) console.log(dim(`  Branch: ${project.default_branch}`))
				if (scaffolded) console.log(warning(`  Scaffolded ${projectYamlPath}`))
			} catch (err) {
				console.error(error(err instanceof Error ? err.message : String(err)))
				process.exit(1)
			}
		},
	)

program.addCommand(initCmd)
