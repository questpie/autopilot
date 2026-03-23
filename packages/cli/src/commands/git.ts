import { Command } from 'commander'
import simpleGit from 'simple-git'
import { resolve } from 'node:path'
import { program } from '../program'
import { header, dim, error } from '../utils/format'

function getCompanyRoot(): string {
	return resolve(process.cwd())
}

const gitCmd = new Command('git')
	.description('Git operations for the company repository')

gitCmd
	.command('log')
	.description('Show recent git commits')
	.action(async () => {
		try {
			const git = simpleGit(getCompanyRoot())
			const log = await git.log({ maxCount: 20, format: { hash: '%h', message: '%s', date: '%cr', author: '%an' } })
			console.log(header('Git Log'))
			for (const entry of log.all) {
				console.log(`  ${dim(entry.hash)}  ${entry.message}  ${dim(`(${entry.date} by ${entry.author})`)}`)
			}
		} catch (err) {
			console.error(error('Not a git repository or git is not installed'))
		}
	})

gitCmd
	.command('status')
	.description('Show working tree status')
	.action(async () => {
		try {
			const git = simpleGit(getCompanyRoot())
			const status = await git.status()
			console.log(header('Git Status'))
			console.log(`  ${dim('Branch:')} ${status.current}`)
			if (status.modified.length > 0) {
				console.log(`  ${dim('Modified:')}`)
				for (const f of status.modified) console.log(`    M ${f}`)
			}
			if (status.not_added.length > 0) {
				console.log(`  ${dim('Untracked:')}`)
				for (const f of status.not_added) console.log(`    ? ${f}`)
			}
			if (status.created.length > 0) {
				console.log(`  ${dim('Added:')}`)
				for (const f of status.created) console.log(`    A ${f}`)
			}
			if (status.deleted.length > 0) {
				console.log(`  ${dim('Deleted:')}`)
				for (const f of status.deleted) console.log(`    D ${f}`)
			}
			if (status.isClean()) {
				console.log(`  ${dim('Working tree clean')}`)
			}
		} catch (err) {
			console.error(error('Not a git repository or git is not installed'))
		}
	})

gitCmd
	.command('push')
	.description('Push to remote')
	.action(async () => {
		try {
			const git = simpleGit(getCompanyRoot())
			console.log(dim('Pushing to origin main...'))
			await git.push('origin', 'main')
			console.log('Push complete')
		} catch (err) {
			console.error(error(err instanceof Error ? err.message : 'Push failed'))
		}
	})

gitCmd
	.command('diff')
	.description('Show uncommitted changes')
	.action(async () => {
		try {
			const git = simpleGit(getCompanyRoot())
			const diff = await git.diff(['HEAD'])
			if (diff) {
				console.log(diff)
			} else {
				console.log(dim('No changes'))
			}
		} catch (err) {
			console.error(error('Not a git repository or git is not installed'))
		}
	})

program.addCommand(gitCmd)
