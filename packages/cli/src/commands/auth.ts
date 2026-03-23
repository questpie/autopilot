import { Command } from 'commander'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { program } from '../program'
import { header, dim, success, error, badge } from '../utils/format'

interface Credentials {
	type: 'bearer' | 'api-key'
	token?: string
	key?: string
	port: number
}

const CREDS_DIR = join(homedir(), '.autopilot')
const CREDS_PATH = join(CREDS_DIR, 'credentials.json')

export function saveCredentials(creds: Credentials): void {
	mkdirSync(CREDS_DIR, { recursive: true })
	writeFileSync(CREDS_PATH, JSON.stringify(creds, null, '\t'), 'utf-8')
}

export function loadCredentials(): Credentials | null {
	if (!existsSync(CREDS_PATH)) return null
	try {
		return JSON.parse(readFileSync(CREDS_PATH, 'utf-8')) as Credentials
	} catch {
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

const authCmd = new Command('auth')
	.description('Authentication and authorization management')

authCmd.addCommand(
	new Command('login')
		.description('Login to the orchestrator')
		.option('--api-key <key>', 'Login with an API key')
		.option('--port <port>', 'Orchestrator port', '7778')
		.action(async (opts: { apiKey?: string; port: string }) => {
			const port = parseInt(opts.port, 10)

			if (opts.apiKey) {
				saveCredentials({ type: 'api-key', key: opts.apiKey, port })
				console.log(success('API key saved'))
				return
			}

			// For email/password login, prompt inline
			const email = prompt('Email: ')
			const password = prompt('Password: ')

			if (!email || !password) {
				console.error(error('Email and password are required'))
				process.exit(1)
			}

			try {
				const res = await fetch(`http://localhost:${port}/api/auth/sign-in/email`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ email, password }),
				})

				if (!res.ok) {
					const body = await res.json().catch(() => ({ error: 'Unknown error' })) as { error: string }
					console.error(error(`Login failed: ${body.error}`))
					process.exit(1)
				}

				const data = await res.json() as { token?: string }
				if (data.token) {
					saveCredentials({ type: 'bearer', token: data.token, port })
					console.log(success('Logged in successfully'))
				} else {
					console.error(error('Login response did not contain a token'))
					process.exit(1)
				}
			} catch (err) {
				console.error(error('Could not connect to orchestrator. Is it running?'))
				console.error(dim(`Tried http://localhost:${port}`))
				process.exit(1)
			}
		}),
)

authCmd.addCommand(
	new Command('setup')
		.description('Create the initial owner account (first run)')
		.option('--port <port>', 'Orchestrator port', '7778')
		.action(async (opts: { port: string }) => {
			const port = parseInt(opts.port, 10)

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
				const res = await fetch(`http://localhost:${port}/api/auth/sign-up/email`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ name, email, password }),
				})

				if (!res.ok) {
					const body = await res.json().catch(() => ({ error: 'Unknown error' })) as { error: string }
					console.error(error(`Setup failed: ${body.error}`))
					process.exit(1)
				}

				const data = await res.json() as { token?: string }
				if (data.token) {
					saveCredentials({ type: 'bearer', token: data.token, port })
				}
				console.log(success('Owner account created'))
				console.log(dim('  You can now use all autopilot commands.'))
			} catch (err) {
				console.error(error('Could not connect to orchestrator. Is it running?'))
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
			console.log(`  ${badge('Port', 'cyan')}: ${creds.port}`)

			if (creds.type === 'bearer') {
				console.log(`  ${badge('Token', 'cyan')}: ${creds.token?.slice(0, 8)}...`)
			} else {
				console.log(`  ${badge('Key', 'cyan')}: ${creds.key?.slice(0, 8)}...`)
			}
		}),
)

authCmd.addCommand(
	new Command('logout')
		.description('Clear stored credentials')
		.action(async () => {
			const { rm } = await import('node:fs/promises')
			try {
				await rm(CREDS_PATH)
				console.log(success('Logged out'))
			} catch {
				console.log(dim('  Not logged in'))
			}
		}),
)

program.addCommand(authCmd)
