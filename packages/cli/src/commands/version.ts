import { Command } from 'commander'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { loadCredentials } from './auth'
import { program } from '../program'
import { badge, dim, header, section, table } from '../utils/format'

interface PackageVersions {
	cli: string
	orchestrator: string | null
	worker: string | null
	spec: string | null
}

function readPkgVersion(absPath: string): string | null {
	try {
		if (!existsSync(absPath)) return null
		const pkg = JSON.parse(readFileSync(absPath, 'utf-8')) as { version?: string }
		return pkg.version ?? null
	} catch {
		return null
	}
}

export function loadPackageVersions(): PackageVersions {
	const cliPkg = resolve(import.meta.dir, '..', '..', 'package.json')
	const cliVersion = readPkgVersion(cliPkg)
	if (!cliVersion) throw new Error('Could not read CLI package.json version')

	return {
		cli: cliVersion,
		orchestrator: readPkgVersion(resolve(import.meta.dir, '..', '..', '..', 'orchestrator', 'package.json')),
		worker: readPkgVersion(resolve(import.meta.dir, '..', '..', '..', 'worker', 'package.json')),
		spec: readPkgVersion(resolve(import.meta.dir, '..', '..', '..', 'spec', 'package.json')),
	}
}

interface OrchestratorVersion {
	version: string
	ok: boolean
}

async function fetchOrchestratorVersion(url: string): Promise<OrchestratorVersion | null> {
	try {
		const res = await fetch(`${url.replace(/\/$/, '')}/api/health`)
		if (!res.ok) return null
		const data = (await res.json()) as { ok?: boolean; version?: string }
		if (!data.version) return null
		return { version: data.version, ok: data.ok ?? false }
	} catch {
		return null
	}
}

export interface VersionResult {
	cli: string
	packages: PackageVersions
	orchestrator?: { url: string; version: string; ok: boolean } | { url: string; error: string }
}

export async function getVersionInfo(options: { url?: string; offline?: boolean }): Promise<VersionResult> {
	const versions = loadPackageVersions()
	const result: VersionResult = { cli: versions.cli, packages: versions }

	if (options.offline) return result

	const url = options.url ?? process.env.ORCHESTRATOR_URL ?? loadCredentials()?.url
	if (!url) return result

	const remote = await fetchOrchestratorVersion(url)
	if (remote) {
		result.orchestrator = { url, version: remote.version, ok: remote.ok }
	} else {
		result.orchestrator = { url, error: 'Could not reach orchestrator or version not available' }
	}

	return result
}

function versionOrUnknown(v: string | null): string {
	return v ?? dim('(not available)')
}

function printVersion(result: VersionResult): void {
	console.log(header('Autopilot Version'))
	console.log('')
	console.log(section('Local packages'))

	const rows: string[][] = [
		[badge('cli', 'magenta'), `@questpie/autopilot`, result.packages.cli],
		[badge('orch', 'blue'), `@questpie/autopilot-orchestrator`, versionOrUnknown(result.packages.orchestrator)],
		[badge('work', 'cyan'), `@questpie/autopilot-worker`, versionOrUnknown(result.packages.worker)],
		[badge('spec', 'gray'), `@questpie/autopilot-spec`, versionOrUnknown(result.packages.spec)],
	]
	console.log(table(rows))

	if (!result.packages.orchestrator && !result.packages.worker && !result.packages.spec) {
		console.log('')
		console.log(dim('Sibling package versions not available (published CLI install). Use --url to check remote orchestrator.'))
	}

	if (result.orchestrator) {
		console.log('')
		console.log(section('Remote orchestrator'))
		if ('version' in result.orchestrator) {
			const localOrch = result.packages.orchestrator
			let suffix = ''
			if (localOrch != null && result.orchestrator.version === localOrch) {
				suffix = dim(' (matches local)')
			} else if (localOrch != null) {
				suffix = ` ${badge('mismatch', 'yellow')} local is ${localOrch}`
			}
			console.log(`  URL:      ${result.orchestrator.url}`)
			console.log(`  Version:  ${result.orchestrator.version}${suffix}`)
		} else {
			console.log(`  URL:      ${result.orchestrator.url}`)
			console.log(`  ${dim(result.orchestrator.error)}`)
		}
	}

	console.log('')
	console.log(dim('Worker version reporting is not yet implemented. Workers run independently on host machines.'))
}

const versionCmd = new Command('version')
	.description('Show Autopilot package versions and remote orchestrator version')
	.option('--url <url>', 'Check a specific orchestrator URL')
	.option('--offline', 'Skip remote orchestrator check')
	.option('--json', 'Print machine-readable JSON')
	.action(async (opts: { url?: string; offline?: boolean; json?: boolean }) => {
		const result = await getVersionInfo(opts)

		if (opts.json) {
			console.log(JSON.stringify(result, null, '\t'))
		} else {
			printVersion(result)
		}
	})

program.addCommand(versionCmd)
