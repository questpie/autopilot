import { Command } from 'commander'
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { program } from '../program'
import { header, dim, success, error, badge } from '../utils/format'
import { getBaseUrl } from '../utils/client'

interface Credentials {
	type: 'bearer' | 'api-key'
	token?: string
	key?: string
	port: number
	url?: string
}

const CREDS_DIR = join(homedir(), '.autopilot')
const CREDS_PATH = join(CREDS_DIR, 'credentials.json')

export function saveCredentials(creds: Credentials): void {
	mkdirSync(CREDS_DIR, { recursive: true })
	writeFileSync(CREDS_PATH, JSON.stringify(creds, null, '\t'), 'utf-8')
	chmodSync(CREDS_PATH, 0o600)
}

export function loadCredentials(): Credentials | null {
	if (!existsSync(CREDS_PATH)) return null
	try {
		return JSON.parse(readFileSync(CREDS_PATH, 'utf-8')) as Credentials
	} catch (err) {
		console.warn(`[auth] failed to parse credentials at ${CREDS_PATH}:`, err instanceof Error ? err.message : String(err))
		return null
	}
}

export function getAuthHeaders(): Record<string, string> {
	const creds = loadCredentials()
	if (!creds) return {}
	if (creds.type === 'bearer' && creds.token) {
		return { Authorization: `Bearer ${creds.token}` }
	}
	if (creds.type === 'api-key' && creds.key) {
		return { 'X-API-Key': creds.key }
	}
	return {}
}

const authCmd = new Command('auth').description('Authentication and credential management')

authCmd.addCommand(
	new Command('login')
		.description('Login to the orchestrator')
		.option('--api-key <key>', 'Login with an API key')
		.option('--port <port>', 'Orchestrator port', '7778')
		.option('--url <url>', 'Remote orchestrator URL (e.g. https://autopilot.mycompany.com)')
		.action(async (opts: { apiKey?: string; port: string; url?: string }) => {
			const port = parseInt(opts.port, 10)
			const baseUrl = opts.url ?? getBaseUrl(port)
			const credBase = opts.url ? { port, url: opts.url } : { port }

			if (opts.apiKey) {
				saveCredentials({ type: 'api-key', key: opts.apiKey, ...credBase })
				console.log(success('API key saved'))
				return
			}

			const email = prompt('Email: ')
			const password = prompt('Password: ')

			if (!email || !password) {
				console.error(error('Email and password are required'))
				process.exit(1)
			}

			try {
				const res = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email, password }),
				})

				if (!res.ok) {
					const body = (await res.json().catch(() => ({ error: 'Unknown error' }))) as {
						error: string
					}
					console.error(error(`Login failed: ${body.error}`))
					process.exit(1)
				}

				const data = (await res.json()) as { token?: string }
				if (data.token) {
					saveCredentials({ type: 'bearer', token: data.token, ...credBase })
					console.log(success('Logged in successfully'))
				} else {
					console.error(error('Login response did not contain a token'))
					process.exit(1)
				}
			} catch (err) {
				console.error(error('Could not connect to orchestrator. Is it running?'))
				console.error(dim(`Tried ${baseUrl}`))
				console.debug('[auth login]', err instanceof Error ? err.message : String(err))
				process.exit(1)
			}
		}),
)

authCmd.addCommand(
	new Command('setup')
		.description('Create the initial owner account (first run)')
		.option('--port <port>', 'Orchestrator port', '7778')
		.option('--url <url>', 'Remote orchestrator URL')
		.action(async (opts: { port: string; url?: string }) => {
			const port = parseInt(opts.port, 10)
			const baseUrl = opts.url ?? getBaseUrl(port)
			const credBase = opts.url ? { port, url: opts.url } : { port }

			console.log(header('First-Time Setup'))
			console.log(dim('  Create the owner account for this autopilot instance.\n'))

			const name = prompt('Your name: ')
			const email = prompt('Email: ')
			const password = prompt('Password: ')

			if (!name || !email || !password) {
				console.error(error('All fields are required'))
				process.exit(1)
			}

			try {
				const res = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ name, email, password }),
				})

				if (!res.ok) {
					const body = (await res.json().catch(() => ({ error: 'Unknown error' }))) as {
						error: string
					}
					console.error(error(`Setup failed: ${body.error}`))
					process.exit(1)
				}

				const data = (await res.json()) as { token?: string }
				if (data.token) {
					saveCredentials({ type: 'bearer', token: data.token, ...credBase })
				}
				console.log(success('Owner account created'))
				console.log(dim('  You can now use all autopilot commands.'))
			} catch (err) {
				console.error(error('Could not connect to orchestrator. Is it running?'))
				console.debug('[auth setup]', err instanceof Error ? err.message : String(err))
				process.exit(1)
			}
		}),
)

authCmd.addCommand(
	new Command('status')
		.description('Show current authentication status')
		.action(async () => {
			console.log(header('Auth Status'))

			const creds = loadCredentials()
			if (!creds) {
				console.log(dim('  Not logged in'))
				console.log(dim('  Run "autopilot auth login" to authenticate.'))
				return
			}

			console.log(`  ${badge('Type', 'cyan')}: ${creds.type}`)
			console.log(`  ${badge('URL', 'cyan')}: ${creds.url ?? `http://localhost:${creds.port}`}`)

			if (creds.type === 'bearer') {
				console.log(`  ${badge('Token', 'cyan')}: ${creds.token?.slice(0, 8)}...`)
			} else {
				console.log(`  ${badge('Key', 'cyan')}: ${creds.key?.slice(0, 8)}...`)
			}
		}),
)

async function logoutAction(): Promise<void> {
	const { rm } = await import('node:fs/promises')
	try {
		await rm(CREDS_PATH)
		console.log(success('Logged out'))
	} catch (err) {
		if (err instanceof Error && 'code' in err && err.code === 'ENOENT') {
			console.log(dim('  Not logged in'))
		} else {
			console.error(error(`Failed to remove credentials: ${err instanceof Error ? err.message : String(err)}`))
			process.exit(1)
		}
	}
}

authCmd.addCommand(
	new Command('logout')
		.description('Clear stored credentials')
		.action(logoutAction),
)

program.addCommand(authCmd)

// Top-level login/logout aliases for convenience
program.addCommand(
	new Command('login')
		.description('Login to the orchestrator (shortcut for "auth login")')
		.option('--api-key <key>', 'Login with an API key')
		.option('--port <port>', 'Orchestrator port', '7778')
		.option('--url <url>', 'Remote orchestrator URL')
		.action(async (opts: { apiKey?: string; port: string; url?: string }) => {
			const port = parseInt(opts.port, 10)
			const baseUrl = opts.url ?? getBaseUrl(port)
			const credBase = opts.url ? { port, url: opts.url } : { port }

			if (opts.apiKey) {
				saveCredentials({ type: 'api-key', key: opts.apiKey, ...credBase })
				console.log(success('API key saved'))
				return
			}

			const email = prompt('Email: ')
			const password = prompt('Password: ')

			if (!email || !password) {
				console.error(error('Email and password are required'))
				process.exit(1)
			}

			try {
				const res = await fetch(`${baseUrl}/api/auth/sign-in/email`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email, password }),
				})

				if (!res.ok) {
					const body = (await res.json().catch(() => ({ error: 'Unknown error' }))) as {
						error: string
					}
					console.error(error(`Login failed: ${body.error}`))
					process.exit(1)
				}

				const data = (await res.json()) as { token?: string }
				if (data.token) {
					saveCredentials({ type: 'bearer', token: data.token, ...credBase })
					console.log(success('Logged in successfully'))
				} else {
					console.error(error('Login response did not contain a token'))
					process.exit(1)
				}
			} catch (err) {
				console.error(error('Could not connect to orchestrator. Is it running?'))
				console.error(dim(`Tried ${baseUrl}`))
				console.debug('[login]', err instanceof Error ? err.message : String(err))
				process.exit(1)
			}
		}),
)

program.addCommand(
	new Command('logout')
		.description('Clear stored credentials (shortcut for "auth logout")')
		.action(logoutAction),
)
