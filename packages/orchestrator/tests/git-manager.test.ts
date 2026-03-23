import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'
import { GitManager } from '../src/git/git-manager'
import { createTestCompany } from './helpers'

describe('GitManager', () => {
	let cleanup: () => Promise<void>
	let root: string

	beforeEach(async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup
	})

	afterEach(async () => {
		if (cleanup) await cleanup()
	})

	it('should initialize as disabled when enabled=false', async () => {
		const manager = new GitManager({
			companyRoot: root,
			enabled: false,
			batchIntervalMs: 5000,
			autoPush: false,
			remote: '',
			branch: 'main',
		})
		await manager.initialize()
		// Should not throw, and queueCommit should be a no-op
		manager.queueCommit(['test.txt'], 'test commit')
		await manager.flush()
	})

	it('should warn when directory is not a git repo', async () => {
		const manager = new GitManager({
			companyRoot: root,
			enabled: true,
			batchIntervalMs: 5000,
			autoPush: false,
			remote: '',
			branch: 'main',
		})
		// root is not a git repo, so initialize should set isGitRepo=false
		await manager.initialize()
		// queueCommit should be a no-op (not a git repo)
		manager.queueCommit(['test.txt'], 'test commit')
		await manager.flush()
	})

	it('should batch commits within the interval', async () => {
		// Initialize a real git repo for this test
		const { execSync } = require('child_process')
		execSync('git init', { cwd: root })
		execSync('git config user.email "test@test.com"', { cwd: root })
		execSync('git config user.name "Test"', { cwd: root })

		// Create initial commit
		await Bun.write(`${root}/init.txt`, 'init')
		execSync('git add -A && git commit -m "init"', { cwd: root })

		const manager = new GitManager({
			companyRoot: root,
			enabled: true,
			batchIntervalMs: 100, // short interval for testing
			autoPush: false,
			remote: '',
			branch: 'main',
		})
		await manager.initialize()

		// Queue multiple commits
		await Bun.write(`${root}/file1.txt`, 'content1')
		manager.queueCommit([`${root}/file1.txt`], 'add file1')

		await Bun.write(`${root}/file2.txt`, 'content2')
		manager.queueCommit([`${root}/file2.txt`], 'add file2')

		// Flush immediately
		await manager.flush()

		// Check git log — should be a single batched commit
		const log = execSync('git log --oneline', { cwd: root, encoding: 'utf-8' })
		const lines = log.trim().split('\n')
		// Should have 2 commits: init + batch
		expect(lines).toHaveLength(2)
		expect(lines[0]).toContain('batch:')
	})

	it('should use single message when only one commit queued', async () => {
		const { execSync } = require('child_process')
		execSync('git init', { cwd: root })
		execSync('git config user.email "test@test.com"', { cwd: root })
		execSync('git config user.name "Test"', { cwd: root })

		await Bun.write(`${root}/init.txt`, 'init')
		execSync('git add -A && git commit -m "init"', { cwd: root })

		const manager = new GitManager({
			companyRoot: root,
			enabled: true,
			batchIntervalMs: 100,
			autoPush: false,
			remote: '',
			branch: 'main',
		})
		await manager.initialize()

		await Bun.write(`${root}/file1.txt`, 'content1')
		manager.queueCommit([`${root}/file1.txt`], 'task: create task-1')

		await manager.flush()

		const log = execSync('git log --oneline', { cwd: root, encoding: 'utf-8' })
		const lines = log.trim().split('\n')
		expect(lines).toHaveLength(2)
		expect(lines[0]).toContain('task: create task-1')
	})

	it('should stop cleanly', async () => {
		const manager = new GitManager({
			companyRoot: root,
			enabled: false,
			batchIntervalMs: 5000,
			autoPush: false,
			remote: '',
			branch: 'main',
		})
		await manager.initialize()
		await manager.stop()
	})
})
