import { Command } from 'commander'
import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs'
import { join } from 'node:path'
import { homedir } from 'node:os'
import { program } from '../program'
import { header, dim, success, error, badge } from '../utils/format'
import { getClient, getBaseUrl } from '../utils/client'

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

			// For email/password login, prompt inline
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
					const body = await res.json().catch(() => ({ error: 'Unknown error' })) as { error: string }
					console.error(error(`Login failed: ${body.error}`))
					process.exit(1)
				}

				const data = await res.json() as { token?: string }
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
				process.exit(1)
			}
		}),
)

authCmd.addCommand(
	new Command('setup')
		.description('Create the initial owner account (first run)')
		.option('--port <port>', 'Orchestrator port', '7778')
		.option('--url <url>', 'Remote orchestrator URL (e.g. https://autopilot.mycompany.com)')
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
					const body = await res.json().catch(() => ({ error: 'Unknown error' })) as { error: string }
					console.error(error(`Setup failed: ${body.error}`))
					process.exit(1)
				}

				const data = await res.json() as { token?: string }
				if (data.token) {
					saveCredentials({ type: 'bearer', token: data.token, ...credBase })
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
			console.log(`  ${badge('URL', 'cyan')}: ${creds.url ?? `http://localhost:${creds.port}`}`)

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

// ── 2FA commands ─────────────────────────────────────────────────────────

const twoFactorCmd = new Command('2fa')
	.description('Two-factor authentication management')

twoFactorCmd.addCommand(
	new Command('enable')
		.description('Enable 2FA (TOTP)')
		.action(async () => {
			const baseUrl = getBaseUrl()
			const headers = { ...getAuthHeaders(), 'Content-Type': 'application/json' }

			try {
				const res = await fetch(`${baseUrl}/api/auth/two-factor/enable`, {
					method: 'POST',
					headers,
				})

				if (!res.ok) {
					const body = await res.json().catch(() => ({ error: 'Unknown error' })) as { error: string }
					console.error(error(`Failed: ${body.error}`))
					process.exit(1)
				}

				const data = await res.json() as { totpURI?: string; backupCodes?: string[] }
				console.log(header('2FA Enabled'))

				if (data.totpURI) {
					console.log('\n  Copy this URI into your authenticator app:\n')
					console.log(`  ${data.totpURI}\n`)
				}

				if (data.backupCodes?.length) {
					console.log(dim('  Backup codes (save these securely):'))
					for (const code of data.backupCodes) {
						console.log(`    ${code}`)
					}
					console.log()
				}

				// Prompt for verification
				const code = prompt('Enter verification code: ')
				if (code) {
					const verifyRes = await fetch(`${baseUrl}/api/auth/two-factor/verify`, {
						method: 'POST',
						headers,
						body: JSON.stringify({ code }),
					})
					if (verifyRes.ok) {
						console.log(success('2FA verified and active'))
					} else {
						console.error(error('Verification failed — 2FA not activated'))
					}
				}
			} catch {
				console.error(error('Could not connect to orchestrator'))
				process.exit(1)
			}
		}),
)

twoFactorCmd.addCommand(
	new Command('disable')
		.description('Disable 2FA')
		.action(async () => {
			const code = prompt('Enter TOTP code: ')
			if (!code) {
				console.error(error('Code required'))
				process.exit(1)
			}

			try {
				const baseUrl = getBaseUrl()
				const res = await fetch(`${baseUrl}/api/auth/two-factor/disable`, {
					method: 'POST',
					headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
					body: JSON.stringify({ code }),
				})

				if (res.ok) {
					console.log(success('2FA disabled'))
				} else {
					const body = await res.json().catch(() => ({ error: 'Unknown error' })) as { error: string }
					console.error(error(`Failed: ${body.error}`))
				}
			} catch {
				console.error(error('Could not connect to orchestrator'))
				process.exit(1)
			}
		}),
)

twoFactorCmd.addCommand(
	new Command('verify')
		.description('Verify a TOTP code')
		.action(async () => {
			const code = prompt('Enter TOTP code: ')
			if (!code) {
				console.error(error('Code required'))
				process.exit(1)
			}

			try {
				const baseUrl = getBaseUrl()
				const res = await fetch(`${baseUrl}/api/auth/two-factor/verify`, {
					method: 'POST',
					headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
					body: JSON.stringify({ code }),
				})

				if (res.ok) {
					console.log(success('2FA verified'))
				} else {
					const body = await res.json().catch(() => ({ error: 'Unknown error' })) as { error: string }
					console.error(error(`Verification failed: ${body.error}`))
				}
			} catch {
				console.error(error('Could not connect to orchestrator'))
				process.exit(1)
			}
		}),
)

authCmd.addCommand(twoFactorCmd)

// ── Session commands ─────────────────────────────────────────────────────

authCmd.addCommand(
	new Command('sessions')
		.description('List active sessions')
		.action(async () => {
			try {
				const client = getClient()
				const res = await client.api.sessions.$get()

				if (!res.ok) {
					console.error(error('Failed to list sessions'))
					process.exit(1)
				}

				const sessions = await res.json() as Array<{ id: string; createdAt?: string; userAgent?: string; ipAddress?: string }>
				console.log(header('Active Sessions'))

				if (sessions.length === 0) {
					console.log(dim('  No active sessions'))
					return
				}

				console.log(dim('  ID                 Created              User-Agent           IP'))
				for (const s of sessions) {
					const id = (s.id ?? '').slice(0, 17).padEnd(17)
					const created = (s.createdAt ?? '').slice(0, 19).padEnd(19)
					const ua = (s.userAgent ?? '').slice(0, 19).padEnd(19)
					const ip = s.ipAddress ?? ''
					console.log(`  ${id}  ${created}  ${ua}  ${ip}`)
				}
			} catch {
				console.error(error('Could not connect to orchestrator'))
				process.exit(1)
			}
		}),
)

authCmd.addCommand(
	new Command('revoke')
		.description('Revoke a session by ID')
		.argument('<id>', 'Session ID to revoke')
		.action(async (id: string) => {
			try {
				const client = getClient()
				const res = await client.api.sessions[':id'].$delete({ param: { id } })

				if (res.ok) {
					console.log(success(`Session ${id} revoked`))
				} else {
					console.error(error('Failed to revoke session'))
				}
			} catch {
				console.error(error('Could not connect to orchestrator'))
				process.exit(1)
			}
		}),
)

authCmd.addCommand(
	new Command('revoke-all')
		.description('Revoke all sessions')
		.action(async () => {
			try {
				const client = getClient()
				const res = await client.api.sessions.$delete()

				if (res.ok) {
					console.log(success('All sessions revoked'))
				} else {
					console.error(error('Failed to revoke sessions'))
				}
			} catch {
				console.error(error('Could not connect to orchestrator'))
				process.exit(1)
			}
		}),
)

program.addCommand(authCmd)
