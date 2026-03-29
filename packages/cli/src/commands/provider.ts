import { Command } from 'commander'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { program } from '../program'
import { header, dim, success, error, badge, separator, dot } from '../utils/format'
import { findCompanyRoot } from '../utils/find-root'

// ── Provider definitions ─────────────────────────────────────────────────

type ProviderName = 'openrouter'

interface ProviderDef {
	displayName: string
	envKey: string
	keyPrefix: string
}

const PROVIDERS: Record<ProviderName, ProviderDef> = {
	openrouter: {
		displayName: 'OpenRouter',
		envKey: 'OPENROUTER_API_KEY',
		keyPrefix: 'sk-or-',
	},
}

const VALID_PROVIDERS = Object.keys(PROVIDERS) as ProviderName[]

// ── Helpers ──────────────────────────────────────────────────────────────

function validateProvider(name: string): ProviderName {
	if (!VALID_PROVIDERS.includes(name as ProviderName)) {
		console.error(error(`Unknown provider: ${name}`))
		console.error(dim(`  Valid providers: ${VALID_PROVIDERS.join(', ')}`))
		process.exit(1)
	}
	return name as ProviderName
}

function readEnvFile(envPath: string): string {
	if (!existsSync(envPath)) return ''
	return readFileSync(envPath, 'utf-8')
}

function setEnvVar(envPath: string, key: string, value: string): void {
	let content = readEnvFile(envPath)
	const regex = new RegExp(`^${key}=.*$`, 'm')

	if (regex.test(content)) {
		content = content.replace(regex, `${key}=${value}`)
	} else {
		content = content.trimEnd() + (content.length > 0 ? '\n' : '') + `${key}=${value}\n`
	}

	writeFileSync(envPath, content, 'utf-8')
}

function removeEnvVar(envPath: string, key: string): void {
	if (!existsSync(envPath)) return
	let content = readFileSync(envPath, 'utf-8')
	const regex = new RegExp(`^${key}=.*\n?`, 'm')
	content = content.replace(regex, '')
	writeFileSync(envPath, content, 'utf-8')
}

function getEnvValue(envPath: string, key: string): string | undefined {
	const content = readEnvFile(envPath)
	const match = content.match(new RegExp(`^${key}=(.*)$`, 'm'))
	return match?.[1]
}

function maskKey(key: string): string {
	if (key.length <= 8) return '***'
	return `${key.slice(0, 8)}...(${key.length} chars)`
}

// ── Command ──────────────────────────────────────────────────────────────

const providerCmd = new Command('provider').description(
	'Manage AI provider authentication (OpenRouter)',
)

// ── provider set <provider> --api-key <key> ──────────────────────────────

providerCmd.addCommand(
	new Command('set')
		.description('Set a provider API key directly')
		.argument('<provider>', `Provider name (${VALID_PROVIDERS.join(', ')})`)
		.requiredOption('--api-key <key>', 'API key for the provider')
		.action(async (name: string, opts: { apiKey: string }) => {
			const providerName = validateProvider(name)
			const provider = PROVIDERS[providerName]

			let envPath: string
			try {
				const root = await findCompanyRoot()
				envPath = join(root, '.env')
			} catch {
				// Fall back to cwd if no company root
				envPath = join(process.cwd(), '.env')
				console.log(dim(`  No company.yaml found, using ${envPath}`))
			}

			setEnvVar(envPath, provider.envKey, opts.apiKey)
			process.env[provider.envKey] = opts.apiKey

			console.log(success(`${provider.envKey} saved to ${envPath}`))
			console.log(dim('  The key is also set in the current process environment.'))
		}),
)

// ── provider status ──────────────────────────────────────────────────────

providerCmd.addCommand(
	new Command('status')
		.description('Show which providers are configured')
		.action(async () => {
			console.log(header('Provider Status'))
			console.log()

			let envPath: string | null = null
			try {
				const root = await findCompanyRoot()
				envPath = join(root, '.env')
			} catch {
				// no company root
			}

			for (const [name, provider] of Object.entries(PROVIDERS)) {
				const envFromFile = envPath ? getEnvValue(envPath, provider.envKey) : undefined
				const envFromProcess = process.env[provider.envKey]
				const apiKey = envFromFile ?? envFromProcess

				const statusDot = apiKey ? dot('green') : dot('red')
				console.log(`  ${statusDot} ${badge(name, 'cyan')} ${provider.displayName}`)

				if (apiKey) {
					console.log(`      API Key: ${dim(maskKey(apiKey))}`)
					if (envFromFile) {
						console.log(`      Source:  ${dim(envPath!)}`)
					} else {
						console.log(`      Source:  ${dim('environment variable')}`)
					}
				} else {
					console.log(`      API Key: ${dim('not set')}`)
				}

				console.log()
			}

			console.log(separator())
			console.log(dim('  Use "autopilot provider set openrouter --api-key <key>" to set your API key'))
			console.log(dim('  Get your key at https://openrouter.ai/keys'))
		}),
)

// ── provider remove <provider> ───────────────────────────────────────────

providerCmd.addCommand(
	new Command('remove')
		.description('Clear provider credentials')
		.argument('<provider>', `Provider name (${VALID_PROVIDERS.join(', ')})`)
		.action(async (name: string) => {
			const providerName = validateProvider(name)
			const provider = PROVIDERS[providerName]

			console.log(header(`Remove ${provider.displayName} credentials`))

			// Remove API key from .env
			let envPath: string | null = null
			try {
				const root = await findCompanyRoot()
				envPath = join(root, '.env')
			} catch {
				// no company root
			}

			if (envPath && existsSync(envPath)) {
				const existing = getEnvValue(envPath, provider.envKey)
				if (existing) {
					removeEnvVar(envPath, provider.envKey)
					console.log(success(`  Removed ${provider.envKey} from ${envPath}`))
				}
			}

			delete process.env[provider.envKey]
			console.log('\n' + success('Done'))
		}),
)

program.addCommand(providerCmd)
