import { Command } from 'commander'
import { join } from 'node:path'
import { program } from '../program'
import { section, dim, table, error, success, separator } from '../utils/format'
import { findProjectRoot } from '../utils/find-root'
import { getBaseUrl } from '../utils/client'
import { getAuthHeaders } from './auth'

// ─── Git helpers ─────────────────────────────────────────────────────────

interface ParsedWorktree {
	path: string
	branch: string
	head: string
	taskId: string
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

/**
 * Parse `git worktree list --porcelain` output into structured entries.
 * Only returns worktrees on autopilot/* branches.
 */
function listWorktrees(repoRoot: string): ParsedWorktree[] {
	const result = git(['worktree', 'list', '--porcelain'], repoRoot)
	if (!result.ok) return []

	const entries: ParsedWorktree[] = []
	let current: Partial<ParsedWorktree> = {}

	for (const line of result.stdout.split('\n')) {
		if (line.startsWith('worktree ')) {
			current.path = line.slice('worktree '.length)
		} else if (line.startsWith('HEAD ')) {
			current.head = line.slice('HEAD '.length)
		} else if (line.startsWith('branch ')) {
			// branch refs/heads/autopilot/some-task-id
			const fullRef = line.slice('branch '.length)
			const branchName = fullRef.replace('refs/heads/', '')
			current.branch = branchName
		} else if (line === '') {
			// End of entry
			if (current.path && current.branch?.startsWith('autopilot/')) {
				const taskId = current.branch.replace('autopilot/', '')
				entries.push({
					path: current.path,
					branch: current.branch,
					head: current.head ?? '',
					taskId,
				})
			}
			current = {}
		}
	}

	// Handle last entry if no trailing newline
	if (current.path && current.branch?.startsWith('autopilot/')) {
		const taskId = current.branch.replace('autopilot/', '')
		entries.push({
			path: current.path,
			branch: current.branch,
			head: current.head ?? '',
			taskId,
		})
	}

	return entries
}

function getDirtyFiles(worktreePath: string): string[] {
	const result = git(['-C', worktreePath, 'status', '--porcelain'], worktreePath)
	if (!result.ok || result.stdout === '') return []
	return result.stdout.split('\n').filter(Boolean)
}

function getCommitsAhead(worktreePath: string, branch: string, base: string): number {
	const result = git(['-C', worktreePath, 'rev-list', '--count', `${base}..${branch}`], worktreePath)
	if (!result.ok) return 0
	return parseInt(result.stdout, 10) || 0
}

async function resolveProjectRoot(): Promise<string> {
	const root = await findProjectRoot()
	if (!root) {
		console.error(error('Not inside an Autopilot project.'))
		console.error(dim('  Run this command from within a project directory.'))
		process.exit(1)
	}
	return root
}

function findWorktree(worktrees: ParsedWorktree[], taskId: string): ParsedWorktree | undefined {
	return worktrees.find((w) => w.taskId === taskId)
}

// ─── Commands ────────────────────────────────────────────────────────────

const workspaceCmd = new Command('workspace').description('Inspect and manage task worktrees')

// ── workspace list ───────────────────────────────────────────────────────

workspaceCmd
	.command('list')
	.description('List all active task worktrees')
	.action(async () => {
		try {
			const root = await resolveProjectRoot()
			const worktrees = listWorktrees(root)

			console.log(section('Workspaces'))

			if (worktrees.length === 0) {
				console.log(dim('  No active task worktrees found.'))
				console.log(dim('  Worktrees are created when tasks run.'))
				return
			}

			const rows = worktrees.map((w) => {
				const dirty = getDirtyFiles(w.path)
				const ahead = getCommitsAhead(w.path, w.branch, 'main')
				const statusParts: string[] = []
				if (ahead > 0) statusParts.push(`${ahead} ahead`)
				const dirtyLabel = dirty.length > 0 ? `${dirty.length} files` : dim('clean')
				return [dim(w.taskId), w.branch, statusParts.join(', ') || dim('even'), dirtyLabel]
			})

			console.log(table([['Task ID', 'Branch', 'Status', 'Dirty'].map((h) => dim(h)), ...rows]))
			console.log('')
			console.log(separator())
			console.log(dim(`  ${worktrees.length} workspace(s)`))
		} catch (err) {
			console.error(error(err instanceof Error ? err.message : String(err)))
			process.exit(1)
		}
	})

// ── workspace show <task-id> ─────────────────────────────────────────────

workspaceCmd
	.command('show')
	.description('Show workspace detail for a task')
	.argument('<task-id>', 'Task ID')
	.action(async (taskId: string) => {
		try {
			const root = await resolveProjectRoot()
			const worktrees = listWorktrees(root)
			const wt = findWorktree(worktrees, taskId)

			if (!wt) {
				console.error(error(`No workspace found for task: ${taskId}`))
				console.error(dim('  Run `autopilot workspace list` to see active workspaces.'))
				process.exit(1)
			}

			const dirty = getDirtyFiles(wt.path)
			const ahead = getCommitsAhead(wt.path, wt.branch, 'main')

			console.log(section(`Workspace: ${taskId}`))
			console.log('')
			console.log(`  ${dim('Task:')}      ${wt.taskId}`)
			console.log(`  ${dim('Branch:')}    ${wt.branch}`)
			console.log(`  ${dim('Path:')}      ${wt.path}`)
			console.log(`  ${dim('Ahead:')}     ${ahead} commit(s) ahead of main`)
			console.log(`  ${dim('Dirty:')}     ${dirty.length} file(s)`)

			if (dirty.length > 0) {
				console.log('')
				for (const line of dirty) {
					console.log(`    ${line}`)
				}
			}

			// Show recent commits on this branch
			if (ahead > 0) {
				const logResult = git(
					['-C', wt.path, 'log', '--oneline', `main..${wt.branch}`],
					wt.path,
				)
				if (logResult.ok && logResult.stdout) {
					console.log('')
					console.log(dim('  Commits:'))
					for (const line of logResult.stdout.split('\n')) {
						console.log(`    ${line}`)
					}
				}
			}
		} catch (err) {
			console.error(error(err instanceof Error ? err.message : String(err)))
			process.exit(1)
		}
	})

// ── workspace diff <task-id> ─────────────────────────────────────────────

workspaceCmd
	.command('diff')
	.description('Show git diff of task worktree vs base branch')
	.argument('<task-id>', 'Task ID')
	.option('--base <branch>', 'Base branch to diff against', 'main')
	.option('--stat', 'Show diffstat summary only')
	.action(async (taskId: string, opts: { base: string; stat?: boolean }) => {
		try {
			const root = await resolveProjectRoot()
			const worktrees = listWorktrees(root)
			const wt = findWorktree(worktrees, taskId)

			if (!wt) {
				console.error(error(`No workspace found for task: ${taskId}`))
				console.error(dim('  Run `autopilot workspace list` to see active workspaces.'))
				process.exit(1)
			}

			const ahead = getCommitsAhead(wt.path, wt.branch, opts.base)

			console.log(section(`Diff: ${taskId}`))
			console.log('')
			console.log(`  ${dim('Branch:')} ${wt.branch}`)
			console.log(`  ${dim('Base:')}   ${opts.base} (${ahead} commits ahead)`)
			console.log('')

			// Always show stat summary first
			const statResult = git(
				['-C', wt.path, 'diff', '--stat', `${opts.base}...${wt.branch}`],
				wt.path,
			)
			if (statResult.ok && statResult.stdout) {
				console.log(statResult.stdout)
			} else if (!statResult.ok) {
				// Fall back to diff against working tree if branch comparison fails
				const fallbackStat = git(['-C', wt.path, 'diff', '--stat', opts.base], wt.path)
				if (fallbackStat.ok && fallbackStat.stdout) {
					console.log(fallbackStat.stdout)
				}
			}

			// Show full diff unless --stat only
			if (!opts.stat) {
				console.log('')
				console.log(separator(70))
				console.log('')

				const diffResult = git(
					['-C', wt.path, 'diff', `${opts.base}...${wt.branch}`],
					wt.path,
				)
				if (diffResult.ok && diffResult.stdout) {
					console.log(diffResult.stdout)
				} else if (!diffResult.ok) {
					const fallbackDiff = git(['-C', wt.path, 'diff', opts.base], wt.path)
					if (fallbackDiff.ok && fallbackDiff.stdout) {
						console.log(fallbackDiff.stdout)
					} else {
						console.log(dim('  No diff to show.'))
					}
				} else {
					console.log(dim('  No diff to show.'))
				}
			}
		} catch (err) {
			console.error(error(err instanceof Error ? err.message : String(err)))
			process.exit(1)
		}
	})

// ── workspace cleanup [task-id] ────────────────────────────────────────

function removeWorktreeAndBranch(
	repoRoot: string,
	wt: ParsedWorktree,
): { removed: boolean; error?: string } {
	const removeResult = git(['worktree', 'remove', wt.path, '--force'], repoRoot)
	if (!removeResult.ok) {
		return { removed: false, error: `Failed to remove worktree: ${removeResult.stderr}` }
	}
	const branchResult = git(['branch', '-D', wt.branch], repoRoot)
	if (!branchResult.ok) {
		// Worktree removed but branch deletion failed — not fatal
		return { removed: true, error: `Worktree removed but branch deletion failed: ${branchResult.stderr}` }
	}
	return { removed: true }
}

async function fetchTaskStatus(
	taskId: string,
): Promise<{ status: string } | null> {
	const baseUrl = getBaseUrl()
	const headers = getAuthHeaders()
	try {
		const res = await fetch(`${baseUrl}/api/tasks/${taskId}`, { headers })
		if (!res.ok) return null
		const data = (await res.json()) as { status?: string }
		return data.status ? { status: data.status } : null
	} catch (err) {
		console.debug('[workspace] fetchTaskStatus failed:', err instanceof Error ? err.message : String(err))
		return null
	}
}

workspaceCmd
	.command('cleanup')
	.description('Remove worktrees for completed/failed tasks')
	.argument('[task-id]', 'Task ID (if omitted, cleans up all done/failed)')
	.action(async (taskId?: string) => {
		try {
			const root = await resolveProjectRoot()
			const worktrees = listWorktrees(root)

			if (worktrees.length === 0) {
				console.log(dim('  No active task worktrees found.'))
				return
			}

			if (taskId) {
				// ── Single task cleanup ──
				const wt = findWorktree(worktrees, taskId)
				if (!wt) {
					console.error(error(`No workspace found for task: ${taskId}`))
					process.exit(1)
				}

				const result = removeWorktreeAndBranch(root, wt)
				if (!result.removed) {
					console.error(error(result.error ?? 'Unknown error'))
					process.exit(1)
				}

				console.log(success(`Removed worktree: ${wt.path}`))
				console.log(success(`Deleted branch: ${wt.branch}`))
				if (result.error) {
					console.log(dim(`  Note: ${result.error}`))
				}
				return
			}

			// ── Bulk cleanup: remove worktrees for done/failed tasks ──
			console.log(section('Workspace Cleanup'))
			console.log(dim('  Checking task statuses...'))
			console.log('')

			let removed = 0
			let skipped = 0

			for (const wt of worktrees) {
				const task = await fetchTaskStatus(wt.taskId)
				if (!task) {
					console.log(dim(`  ${wt.taskId}: could not fetch status, skipping`))
					skipped++
					continue
				}

				if (task.status !== 'done' && task.status !== 'failed') {
					console.log(dim(`  ${wt.taskId}: ${task.status}, skipping`))
					skipped++
					continue
				}

				const result = removeWorktreeAndBranch(root, wt)
				if (result.removed) {
					console.log(success(`  ${wt.taskId}: removed (${task.status})`))
					if (result.error) {
						console.log(dim(`    Note: ${result.error}`))
					}
					removed++
				} else {
					console.log(error(`  ${wt.taskId}: ${result.error}`))
					skipped++
				}
			}

			console.log('')
			console.log(separator())
			console.log(dim(`  ${removed} removed, ${skipped} skipped`))
		} catch (err) {
			console.error(error(err instanceof Error ? err.message : String(err)))
			process.exit(1)
		}
	})

// ── workspace merge <task-id> ──────────────────────────────────────────

workspaceCmd
	.command('merge')
	.description('Merge task branch into current branch and clean up worktree')
	.argument('<task-id>', 'Task ID')
	.option('--no-ff', 'Create a merge commit even if fast-forward is possible')
	.action(async (taskId: string, opts: { ff: boolean }) => {
		try {
			const root = await resolveProjectRoot()
			const worktrees = listWorktrees(root)
			const wt = findWorktree(worktrees, taskId)

			if (!wt) {
				console.error(error(`No workspace found for task: ${taskId}`))
				console.error(dim('  Run `autopilot workspace list` to see active workspaces.'))
				process.exit(1)
			}

			// ── Check worktree is clean ──
			const dirty = getDirtyFiles(wt.path)
			if (dirty.length > 0) {
				console.error(error(`Workspace for ${taskId} has ${dirty.length} dirty file(s). Commit or stash changes first.`))
				for (const line of dirty) {
					console.error(`    ${line}`)
				}
				process.exit(1)
			}

			// ── Merge ──
			const mergeArgs = ['merge', wt.branch]
			if (!opts.ff) {
				mergeArgs.push('--no-ff')
			}

			const mergeResult = git(mergeArgs, root)
			if (!mergeResult.ok) {
				// Abort the merge to avoid leaving dirty state
				git(['merge', '--abort'], root)
				console.error(error(`Merge conflict or failure merging ${wt.branch}`))
				console.error(dim(`  ${mergeResult.stderr}`))
				console.error(dim('  Merge was aborted. Resolve manually if needed.'))
				process.exit(1)
			}

			console.log(success(`Merged ${wt.branch} into current branch`))

			// ── Cleanup worktree + branch ──
			const cleanupResult = removeWorktreeAndBranch(root, wt)
			if (cleanupResult.removed) {
				console.log(success(`Removed worktree: ${wt.path}`))
				console.log(success(`Deleted branch: ${wt.branch}`))
				if (cleanupResult.error) {
					console.log(dim(`  Note: ${cleanupResult.error}`))
				}
			} else {
				console.log(dim(`  Note: merge succeeded but cleanup failed: ${cleanupResult.error}`))
			}
		} catch (err) {
			console.error(error(err instanceof Error ? err.message : String(err)))
			process.exit(1)
		}
	})

program.addCommand(workspaceCmd)
