import { Command } from 'commander'
import { existsSync, readFileSync, readdirSync } from 'node:fs'
import { join, resolve } from 'node:path'
import { PATHS } from '@questpie/autopilot-spec'
import { loadCredentials } from './auth'
import { program } from '../program'
import { findCompanyRoot } from '../utils/find-root'
import { badge, dim, error, header, section, success, table, warning } from '../utils/format'

type DoctorStatus = 'pass' | 'warn' | 'fail'

export interface DoctorCheck {
	id: string
	status: DoctorStatus
	title: string
	message: string
	fix?: string
}

export interface DoctorOptions {
	cwd?: string
	companyRoot?: string
	url?: string
	offline?: boolean
	runtimes?: string[]
	requireRuntime?: boolean
	env?: NodeJS.ProcessEnv
}

interface DoctorContext {
	cwd: string
	env: NodeJS.ProcessEnv
	dotEnv: Record<string, string>
	effectiveEnv: Record<string, string | undefined>
	companyRoot?: string
}

const DEFAULT_RUNTIMES = ['claude-code', 'codex', 'opencode'] as const
const RUNTIME_BINARIES: Record<string, string> = {
	'claude-code': 'claude',
	codex: 'codex',
	opencode: 'opencode',
}

export async function runDoctorChecks(options: DoctorOptions = {}): Promise<DoctorCheck[]> {
	const cwd = resolve(options.cwd ?? process.cwd())
	const env = options.env ?? process.env
	const dotEnv = loadDotEnv(cwd)
	const effectiveEnv = { ...dotEnv, ...env }
	const ctx: DoctorContext = {
		cwd,
		env,
		dotEnv,
		effectiveEnv,
		companyRoot: await resolveCompanyRoot(options.companyRoot, cwd),
	}

	const checks: DoctorCheck[] = []

	checkCompanyRoot(ctx, checks)
	checkAuthAndSecretEnv(ctx, checks)
	checkUrlEnv(ctx, checks)
	checkDockerFiles(ctx, checks)
	checkRuntimeBinaries(options.runtimes ?? [...DEFAULT_RUNTIMES], checks, options.requireRuntime ?? false)
	await checkOrchestratorHealth(options, ctx, checks)

	return checks
}

async function resolveCompanyRoot(companyRoot: string | undefined, cwd: string): Promise<string | undefined> {
	if (companyRoot) return resolve(companyRoot)
	try {
		return await findCompanyRoot(cwd)
	} catch {
		return undefined
	}
}

function loadDotEnv(cwd: string): Record<string, string> {
	const file = join(cwd, '.env')
	if (!existsSync(file)) return {}

	const result: Record<string, string> = {}
	for (const line of readFileSync(file, 'utf-8').split(/\r?\n/)) {
		const trimmed = line.trim()
		if (!trimmed || trimmed.startsWith('#')) continue
		const match = trimmed.match(/^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/)
		if (!match) continue
		const [, key, rawValue] = match
		result[key!] = rawValue!.replace(/^["']|["']$/g, '')
	}
	return result
}

function checkCompanyRoot(ctx: DoctorContext, checks: DoctorCheck[]): void {
	if (!ctx.companyRoot) {
		checks.push({
			id: 'company-root',
			status: 'fail',
			title: 'Company root',
			message: 'No .autopilot/company.yaml found from the current directory.',
			fix: 'Run `autopilot bootstrap --yes` or pass `--company-root <path>`.',
		})
		return
	}

	const companyConfig = join(ctx.companyRoot, PATHS.COMPANY_CONFIG)
	checks.push({
		id: 'company-root',
		status: existsSync(companyConfig) ? 'pass' : 'fail',
		title: 'Company root',
		message: existsSync(companyConfig)
			? `Found ${PATHS.COMPANY_CONFIG} at ${ctx.companyRoot}.`
			: `Missing ${PATHS.COMPANY_CONFIG} at ${ctx.companyRoot}.`,
		fix: existsSync(companyConfig) ? undefined : 'Run `autopilot bootstrap --yes --cwd <path>`.',
	})

	const agentsDir = join(ctx.companyRoot, PATHS.AGENTS_DIR)
	const workflowsDir = join(ctx.companyRoot, PATHS.WORKFLOWS_DIR)
	checks.push(hasYamlFiles(agentsDir)
		? pass('agents', 'Agents config', `Found agent definitions in ${PATHS.AGENTS_DIR}.`)
		: warn('agents', 'Agents config', `No agent YAML files found in ${PATHS.AGENTS_DIR}.`, 'Run `autopilot bootstrap --yes` or add an agent definition.'))
	checks.push(hasYamlFiles(workflowsDir)
		? pass('workflows', 'Workflow config', `Found workflow definitions in ${PATHS.WORKFLOWS_DIR}.`)
		: warn('workflows', 'Workflow config', `No workflow YAML files found in ${PATHS.WORKFLOWS_DIR}.`, 'Run `autopilot bootstrap --yes` or add a workflow definition.'))
}

function hasYamlFiles(dir: string): boolean {
	if (!existsSync(dir)) return false
	return readdirSync(dir).some((file) => file.endsWith('.yaml') || file.endsWith('.yml'))
}

function checkAuthAndSecretEnv(ctx: DoctorContext, checks: DoctorCheck[]): void {
	const nodeEnv = ctx.effectiveEnv.NODE_ENV ?? 'development'
	const production = nodeEnv === 'production'
	const masterKey = ctx.effectiveEnv.AUTOPILOT_MASTER_KEY
	const authSecret = ctx.effectiveEnv.BETTER_AUTH_SECRET

	if (!masterKey) {
		checks.push(production
			? fail('master-key', 'Shared secret encryption key', 'AUTOPILOT_MASTER_KEY is missing in production.', 'Generate one with `openssl rand -hex 32`.')
			: warn('master-key', 'Shared secret encryption key', 'AUTOPILOT_MASTER_KEY is not set; shared secret operations will fail until configured.', 'Generate one with `openssl rand -hex 32`.'))
	} else if (!/^[0-9a-fA-F]{64}$/.test(masterKey)) {
		checks.push(fail('master-key', 'Shared secret encryption key', 'AUTOPILOT_MASTER_KEY must be exactly 64 hex characters.', 'Generate one with `openssl rand -hex 32`.'))
	} else {
		checks.push(pass('master-key', 'Shared secret encryption key', 'AUTOPILOT_MASTER_KEY has the expected 64-hex format.'))
	}

	if (!authSecret) {
		checks.push(production
			? fail('auth-secret', 'Better Auth secret', 'BETTER_AUTH_SECRET is missing in production.', 'Generate one with `openssl rand -hex 32`.')
			: warn('auth-secret', 'Better Auth secret', 'BETTER_AUTH_SECRET is not set; production auth will fail until configured.', 'Generate one with `openssl rand -hex 32`.'))
	} else if (authSecret.length < 32) {
		checks.push(fail('auth-secret', 'Better Auth secret', 'BETTER_AUTH_SECRET must be at least 32 characters.', 'Generate one with `openssl rand -hex 32`.'))
	} else {
		checks.push(pass('auth-secret', 'Better Auth secret', 'BETTER_AUTH_SECRET is configured.'))
	}
}

function checkUrlEnv(ctx: DoctorContext, checks: DoctorCheck[]): void {
	const orchestratorUrl = ctx.effectiveEnv.ORCHESTRATOR_URL
	const corsOrigin = ctx.effectiveEnv.CORS_ORIGIN

	if (orchestratorUrl) {
		checks.push(isValidUrl(orchestratorUrl)
			? pass('orchestrator-url', 'Orchestrator URL', `ORCHESTRATOR_URL is ${orchestratorUrl}.`)
			: fail('orchestrator-url', 'Orchestrator URL', 'ORCHESTRATOR_URL is not a valid URL.', 'Use a full URL such as `https://autopilot.example.com` or `http://SERVER_IP:7778`.'))
	} else {
		checks.push(warn('orchestrator-url', 'Orchestrator URL', 'ORCHESTRATOR_URL is not set; rendered links may fall back to localhost.', 'Set ORCHESTRATOR_URL for VPS, reverse-proxy, LAN, or Tailscale deployments.'))
	}

	if (!corsOrigin) {
		checks.push(warn('cors-origin', 'CORS origin', 'CORS_ORIGIN is not set; the API will fall back to the orchestrator origin.', 'Set CORS_ORIGIN when operators use a separate browser/API origin.'))
		return
	}

	const invalid = corsOrigin
		.split(',')
		.map((value) => value.trim())
		.filter(Boolean)
		.filter((value) => !isValidUrl(value))

	checks.push(invalid.length === 0
		? pass('cors-origin', 'CORS origin', 'CORS_ORIGIN contains valid URL values.')
		: fail('cors-origin', 'CORS origin', `CORS_ORIGIN contains invalid URL values: ${invalid.join(', ')}.`, 'Use comma-separated full URLs.'))
}

function checkDockerFiles(ctx: DoctorContext, checks: DoctorCheck[]): void {
	const dockerCompose = join(ctx.cwd, 'docker-compose.yml')
	const deployCompose = join(ctx.cwd, 'deploy', 'docker-compose.yml')
	const dockerfile = join(ctx.cwd, 'Dockerfile')
	const entrypoint = join(ctx.cwd, 'docker-entrypoint.sh')

	if (!existsSync(dockerCompose) && !existsSync(deployCompose) && !existsSync(dockerfile)) {
		checks.push(warn('docker-files', 'Docker packaging files', 'No Docker packaging files found in the current directory.', 'Run this check from the Autopilot repo root to validate Docker packaging.'))
		return
	}

	checks.push(existsSync(dockerfile)
		? pass('dockerfile', 'Dockerfile', 'Dockerfile exists.')
		: warn('dockerfile', 'Dockerfile', 'Dockerfile is missing.', 'Use repo Docker packaging or documented deploy files.'))
	checks.push(existsSync(entrypoint)
		? pass('docker-entrypoint', 'Docker entrypoint', 'docker-entrypoint.sh exists.')
		: warn('docker-entrypoint', 'Docker entrypoint', 'docker-entrypoint.sh is missing.', 'Use the repo entrypoint for orchestrator-only Docker boot.'))

	for (const [id, file] of [['compose-root', dockerCompose], ['compose-deploy', deployCompose]] as const) {
		if (!existsSync(file)) continue
		const content = readFileSync(file, 'utf-8')
		checks.push(content.includes('/api/health')
			? pass(id, file.endsWith('deploy/docker-compose.yml') ? 'Deploy compose healthcheck' : 'Root compose healthcheck', `${file} uses /api/health.`)
			: fail(id, file.endsWith('deploy/docker-compose.yml') ? 'Deploy compose healthcheck' : 'Root compose healthcheck', `${file} does not reference /api/health.`, 'Use /api/health for Docker healthchecks.'))
	}
}

function checkRuntimeBinaries(runtimes: string[], checks: DoctorCheck[], requireRuntime: boolean): void {
	if (runtimes.length === 0) {
		checks.push(warn('runtime-any', 'Worker runtime availability', 'Runtime binary checks were skipped.'))
		return
	}

	let foundAny = false
	for (const runtime of runtimes) {
		const binary = RUNTIME_BINARIES[runtime] ?? runtime
		const found = which(binary)
		if (found) foundAny = true
		checks.push(found
			? pass(`runtime-${runtime}`, `Runtime: ${runtime}`, `Found ${binary} at ${found}.`)
			: warn(`runtime-${runtime}`, `Runtime: ${runtime}`, `${binary} was not found in PATH.`, runtimeInstallHint(runtime)))
	}

	if (!foundAny) {
		const check = requireRuntime ? fail : warn
		checks.push(check('runtime-any', 'Worker runtime availability', 'No supported runtime binary was found in PATH.', 'Install and authenticate at least one runtime on worker machines, or omit --require-runtime on orchestrator-only hosts.'))
	} else {
		checks.push(pass('runtime-any', 'Worker runtime availability', 'At least one supported runtime binary is available.'))
	}
}

async function checkOrchestratorHealth(options: DoctorOptions, ctx: DoctorContext, checks: DoctorCheck[]): Promise<void> {
	if (options.offline) {
		checks.push(warn('orchestrator-health', 'Orchestrator health', 'Skipped because --offline was set.'))
		return
	}

	const url = options.url ?? ctx.effectiveEnv.ORCHESTRATOR_URL ?? loadCredentials()?.url
	if (!url) {
		checks.push(warn('orchestrator-health', 'Orchestrator health', 'No orchestrator URL configured for health check.', 'Pass `--url <orchestrator-url>` or set ORCHESTRATOR_URL.'))
		return
	}
	if (!isValidUrl(url)) {
		checks.push(fail('orchestrator-health', 'Orchestrator health', `Cannot check invalid URL: ${url}.`, 'Pass a full URL such as `http://localhost:7778`.'))
		return
	}

	try {
		const res = await fetch(`${url.replace(/\/$/, '')}/api/health`)
		checks.push(res.ok
			? pass('orchestrator-health', 'Orchestrator health', `${url} responded on /api/health.`)
			: fail('orchestrator-health', 'Orchestrator health', `${url}/api/health returned HTTP ${res.status}.`, 'Check orchestrator logs and URL routing.'))
	} catch (err) {
		checks.push(fail('orchestrator-health', 'Orchestrator health', `Could not reach ${url}/api/health: ${err instanceof Error ? err.message : String(err)}`, 'Start the orchestrator or pass the reachable URL.'))
	}
}

function which(binary: string): string | null {
	const result = Bun.spawnSync(['which', binary], { stdout: 'pipe', stderr: 'pipe' })
	if (result.exitCode !== 0) return null
	return result.stdout.toString().trim() || null
}

function runtimeInstallHint(runtime: string): string {
	switch (runtime) {
		case 'claude-code':
			return 'Install Claude Code and run `claude login`.'
		case 'codex':
			return 'Install Codex and configure OpenAI auth.'
		case 'opencode':
			return 'Install OpenCode and configure provider auth.'
		default:
			return `Install runtime binary for ${runtime}.`
	}
}

function isValidUrl(value: string): boolean {
	try {
		new URL(value)
		return true
	} catch {
		return false
	}
}

function pass(id: string, title: string, message: string): DoctorCheck {
	return { id, status: 'pass', title, message }
}

function warn(id: string, title: string, message: string, fix?: string): DoctorCheck {
	return { id, status: 'warn', title, message, fix }
}

function fail(id: string, title: string, message: string, fix?: string): DoctorCheck {
	return { id, status: 'fail', title, message, fix }
}

function printDoctor(checks: DoctorCheck[]): void {
	console.log(header('Autopilot Doctor'))
	console.log('')
	console.log(section('Checks'))
	console.log(table(checks.map((check) => [
		statusBadge(check.status),
		check.title,
		check.message,
	])))

	const fixes = checks.filter((check) => check.fix)
	if (fixes.length > 0) {
		console.log('')
		console.log(section('Suggested Fixes'))
		for (const check of fixes) {
			console.log(`  ${statusBadge(check.status)} ${check.title}: ${dim(check.fix!)}`)
		}
	}

	const failed = checks.filter((check) => check.status === 'fail').length
	const warned = checks.filter((check) => check.status === 'warn').length
	console.log('')
	if (failed > 0) {
		console.log(error(`${failed} failing check(s), ${warned} warning(s).`))
	} else if (warned > 0) {
		console.log(warning(`No failing checks. ${warned} warning(s).`))
	} else {
		console.log(success('All checks passed.'))
	}
}

function statusBadge(status: DoctorStatus): string {
	switch (status) {
		case 'pass':
			return badge('pass', 'green')
		case 'warn':
			return badge('warn', 'yellow')
		case 'fail':
			return badge('fail', 'red')
	}
}

const doctorCmd = new Command('doctor')
	.description('Validate local Autopilot setup and deployment prerequisites')
	.option('--company-root <path>', 'Explicit company root path')
	.option('--url <url>', 'Check a reachable orchestrator URL')
	.option('--offline', 'Skip orchestrator health check')
	.option('--runtimes <list>', 'Comma-separated runtimes to check', DEFAULT_RUNTIMES.join(','))
	.option('--require-runtime', 'Fail when no runtime binary is found')
	.option('--json', 'Print machine-readable JSON')
	.action(async (opts: {
		companyRoot?: string
		url?: string
		offline?: boolean
		runtimes: string
		requireRuntime?: boolean
		json?: boolean
	}) => {
		const runtimes = opts.runtimes.split(',').map((value) => value.trim()).filter(Boolean)
		const checks = await runDoctorChecks({
			companyRoot: opts.companyRoot,
			url: opts.url,
			offline: opts.offline,
			runtimes,
			requireRuntime: opts.requireRuntime,
		})

		if (opts.json) {
			console.log(JSON.stringify({ checks }, null, '\t'))
		} else {
			printDoctor(checks)
		}

		if (checks.some((check) => check.status === 'fail')) {
			process.exit(1)
		}
	})

program.addCommand(doctorCmd)
