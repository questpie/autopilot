import { Command } from 'commander'
import { program } from '../program'
import { dim, header, section, success, warning } from '../utils/format'
import { loadPackageVersions } from './version'

export type Channel = 'stable' | 'canary'

export function parseChannel(value: string): Channel {
	const lower = value.toLowerCase()
	if (lower === 'stable' || lower === 'canary') return lower
	throw new Error(`Unknown channel "${value}". Use "stable" or "canary".`)
}

function npmTag(channel: Channel): string {
	return channel === 'canary' ? 'canary' : 'latest'
}

export interface NpmRegistryVersion {
	version: string
	tag: string
}

export async function checkNpmVersion(channel: Channel): Promise<NpmRegistryVersion | null> {
	const tag = npmTag(channel)
	try {
		const res = await fetch(`https://registry.npmjs.org/@questpie/autopilot/${tag}`)
		if (!res.ok) return null
		const data = (await res.json()) as { version?: string }
		if (!data.version) return null
		return { version: data.version, tag }
	} catch {
		return null
	}
}

export interface UpdateCheckResult {
	currentVersion: string
	channel: Channel
	latestVersion: string | null
	source: 'npm'
	updateAvailable: boolean
	error?: string
}

export async function checkForUpdate(channel: Channel): Promise<UpdateCheckResult> {
	const versions = loadPackageVersions()
	const current = versions.cli

	const npm = await checkNpmVersion(channel)
	if (!npm) {
		return {
			currentVersion: current,
			channel,
			latestVersion: null,
			source: 'npm',
			updateAvailable: false,
			error: `Could not reach npm registry for @questpie/autopilot@${npmTag(channel)}`,
		}
	}

	return {
		currentVersion: current,
		channel,
		latestVersion: npm.version,
		source: 'npm',
		updateAvailable: npm.version !== current,
	}
}

function printUpdateCheck(result: UpdateCheckResult): void {
	console.log(header('Autopilot Update Check'))
	console.log('')
	console.log(section(`Channel: ${result.channel}`))
	console.log(`  Current:  ${result.currentVersion}`)

	if (result.error) {
		console.log(`  ${warning(result.error)}`)
		console.log('')
		console.log(dim('This is a network issue, not a problem with your installation.'))
		return
	}

	console.log(`  Latest:   ${result.latestVersion}`)
	console.log('')

	if (result.updateAvailable) {
		console.log(warning(`Update available: ${result.currentVersion} → ${result.latestVersion}`))
		console.log('')
		console.log(section('How to update'))
		console.log(`  ${dim('CLI (npm/bun):')}`)
		console.log(`    bun add -g @questpie/autopilot@${npmTag(result.channel)}`)
		console.log('')
		console.log(`  ${dim('Docker:')}`)
		console.log(`    docker compose pull && docker compose up -d`)
		console.log('')
		console.log(dim('Always update orchestrator first, then workers, then CLIs.'))
	} else {
		console.log(success('You are running the latest version.'))
	}
}

const updateCmd = new Command('update')
	.description('Check for available updates')

async function runUpdateCheck(opts: { channel: string; json?: boolean }): Promise<void> {
	let channel: Channel
	try {
		channel = parseChannel(opts.channel)
	} catch (err) {
		console.error(`Error: ${err instanceof Error ? err.message : String(err)}`)
		process.exit(1)
	}
	const result = await checkForUpdate(channel)

	if (opts.json) {
		console.log(JSON.stringify(result, null, '\t'))
	} else {
		printUpdateCheck(result)
	}
}

updateCmd
	.command('check')
	.description('Check if a newer Autopilot version is available')
	.option('--channel <channel>', 'Release channel: stable or canary', 'stable')
	.option('--json', 'Print machine-readable JSON')
	.action(runUpdateCheck)

updateCmd
	.command('status')
	.description('Alias for update check')
	.option('--channel <channel>', 'Release channel: stable or canary', 'stable')
	.option('--json', 'Print machine-readable JSON')
	.action(runUpdateCheck)

program.addCommand(updateCmd)
