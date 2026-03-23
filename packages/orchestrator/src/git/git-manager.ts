import simpleGit, { type SimpleGit } from 'simple-git'

interface CommitEntry {
	files: string[]
	message: string
	author?: { name: string; email: string }
}

export interface GitManagerOptions {
	companyRoot: string
	enabled: boolean
	batchIntervalMs: number
	autoPush: boolean
	remote: string
	branch: string
}

export class GitManager {
	private git: SimpleGit
	private commitQueue: CommitEntry[] = []
	private commitTimer: Timer | null = null
	private options: GitManagerOptions
	private isGitRepo = false

	constructor(options: GitManagerOptions) {
		this.options = options
		this.git = simpleGit(options.companyRoot)
	}

	/** Check if company directory is a git repo. */
	async initialize(): Promise<void> {
		if (!this.options.enabled) {
			console.log('[git] auto-commit disabled')
			return
		}
		try {
			await this.git.status()
			this.isGitRepo = true
			console.log('[git] initialized — auto-commit enabled')
		} catch {
			this.isGitRepo = false
			console.warn('[git] company directory is not a git repo — auto-commit disabled')
			console.warn('[git] run "git init" in company directory to enable')
		}
	}

	/**
	 * Queue a commit. Commits are batched per `batchIntervalMs` (default 5s).
	 * Multiple changes within the interval are combined into a single commit.
	 */
	queueCommit(
		files: string[],
		message: string,
		author?: { name: string; email: string },
	): void {
		if (!this.isGitRepo || !this.options.enabled) return

		this.commitQueue.push({ files, message, author })

		if (!this.commitTimer) {
			this.commitTimer = setTimeout(() => this.flushCommits(), this.options.batchIntervalMs)
		}
	}

	/** Immediately flush all queued commits. Called on graceful shutdown. */
	async flush(): Promise<void> {
		if (this.commitTimer) {
			clearTimeout(this.commitTimer)
			this.commitTimer = null
		}
		await this.flushCommits()
	}

	private async flushCommits(): Promise<void> {
		const batch = [...this.commitQueue]
		this.commitQueue = []
		this.commitTimer = null

		if (batch.length === 0) return

		try {
			// Dedupe files
			const allFiles = [...new Set(batch.flatMap(b => b.files))]

			// Build commit message
			let message: string
			if (batch.length === 1) {
				message = batch[0]!.message
			} else {
				message = `batch: ${batch.map(b => b.message).join(', ')}`
			}

			// Determine author — use first entry's author, fallback to system
			const author = batch[0]?.author ?? {
				name: 'Autopilot',
				email: 'system@autopilot.local',
			}

			// Stage only changed files (not -A to avoid unintended files)
			for (const file of allFiles) {
				try {
					await this.git.add(file)
				} catch {
					// File might have been deleted — try git rm
					try {
						await this.git.rm(file)
					} catch {
						// File doesn't exist in git either — skip
					}
				}
			}

			// Check if there's anything staged
			const status = await this.git.status()
			if (status.staged.length === 0) return

			// Commit
			await this.git.commit(message, undefined, {
				'--author': `${author.name} <${author.email}>`,
			})

			console.log(`[git] committed: ${message} (${allFiles.length} files)`)

			// Auto-push if configured
			if (this.options.autoPush && this.options.remote) {
				try {
					await this.git.push(this.options.remote, this.options.branch)
					console.log(`[git] pushed to ${this.options.remote}/${this.options.branch}`)
				} catch (err) {
					console.error('[git] push failed:', err instanceof Error ? err.message : err)
				}
			}
		} catch (err) {
			console.error('[git] commit failed:', err instanceof Error ? err.message : err)
		}
	}

	/** Stop the timer and flush remaining commits. */
	async stop(): Promise<void> {
		await this.flush()
	}
}
