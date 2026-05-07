/**
 * Invite API tests.
 *
 * Verifies the public/protected route boundary, owner/admin enforcement,
 * and role validation for the custom invite endpoints.
 *
 * The acceptance flow that creates a Better Auth user is not exercised here —
 * that requires a real Better Auth instance. We test the auth/role boundary
 * and the invite-token state machine.
 */
import { afterAll, beforeAll, beforeEach, describe, expect, test } from 'bun:test'
import { mkdir, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { randomBytes } from 'node:crypto'
import { eq } from 'drizzle-orm'
import { type AppType, createApp, type Services } from '../src/api/app'
import type { Auth } from '../src/auth'
import type { Actor } from '../src/auth/types'
import { type CompanyDbResult, createCompanyDb } from '../src/db'
import * as authSchema from '../src/db/auth-schema'
import type { AuthoredConfig } from '../src/services'

let testDir: string
let dbResult: CompanyDbResult
let app: AppType
let currentSessionActor: Actor | null = null

function makeActor(role: Actor['role'], id?: string): Actor {
	return {
		id: id ?? `actor-${role}`,
		type: 'human',
		name: `Test ${role}`,
		role,
		source: 'api',
	}
}

function buildAuthStub(): Auth {
	return {
		handler: () => new Response('not used'),
		api: {
			getSession: async () =>
				currentSessionActor
					? {
							user: {
								id: currentSessionActor.id,
								email: `${currentSessionActor.id}@test.local`,
								name: currentSessionActor.name,
								role: currentSessionActor.role,
							},
						}
					: null,
			// Stubbed for /accept; we don't exercise the full signup flow here.
			signUpEmail: async () => ({ user: { id: 'new-user-id' } }),
		},
	} as unknown as Auth
}

function buildApp(): AppType {
	const authoredConfig: AuthoredConfig = {
		company: {},
		agents: new Map(),
		workflows: new Map(),
		environments: new Map(),
		providers: new Map(),
		capabilityProfiles: new Map(),
		skills: new Map(),
		context: new Map(),
	}
	return createApp({
		companyRoot: testDir,
		db: dbResult.db,
		auth: buildAuthStub(),
		services: {
			enrollmentService: { validateMachineSecret: async () => null },
			runService: { get: async () => null },
		} as unknown as Services,
		authoredConfig,
	})
}

async function insertInvite(opts: {
	email: string
	role?: string
	token?: string
	expiresAt?: Date | null
	acceptedAt?: Date | null
}) {
	const id = randomBytes(16).toString('hex')
	const token = opts.token ?? randomBytes(32).toString('hex')
	const now = new Date()
	const expiresAt =
		opts.expiresAt === undefined
			? new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
			: opts.expiresAt
	await dbResult.db.insert(authSchema.invite).values({
		id,
		email: opts.email.toLowerCase(),
		role: opts.role ?? 'member',
		token,
		invitedBy: null,
		createdAt: now,
		updatedAt: now,
		expiresAt,
		acceptedAt: opts.acceptedAt ?? null,
	})
	return { id, token }
}

beforeAll(async () => {
	testDir = join(tmpdir(), `autopilot-invites-api-${Date.now()}`)
	await mkdir(testDir, { recursive: true })
	dbResult = await createCompanyDb(testDir)
	app = buildApp()
})

afterAll(async () => {
	dbResult.raw.close()
	await rm(testDir, { recursive: true, force: true })
})

beforeEach(async () => {
	currentSessionActor = null
	await dbResult.db.delete(authSchema.invite)
})

describe('invites API — public routes', () => {
	test('GET /api/invites/validate works without auth', async () => {
		const { token } = await insertInvite({ email: 'guest@example.com', role: 'member' })

		const res = await app.request(`http://localhost/api/invites/validate?token=${token}`)
		expect(res.status).toBe(200)
		const body = (await res.json()) as { email: string; role: string }
		expect(body.email).toBe('guest@example.com')
		expect(body.role).toBe('member')
	})

	test('GET /api/invites/validate without token returns 400', async () => {
		const res = await app.request('http://localhost/api/invites/validate')
		expect(res.status).toBe(400)
	})

	test('GET /api/invites/validate with unknown token returns 404', async () => {
		const res = await app.request('http://localhost/api/invites/validate?token=does-not-exist')
		expect(res.status).toBe(404)
	})

	test('GET /api/invites/validate with expired token returns 410', async () => {
		const { token } = await insertInvite({
			email: 'expired@example.com',
			expiresAt: new Date(Date.now() - 1000),
		})
		const res = await app.request(`http://localhost/api/invites/validate?token=${token}`)
		expect(res.status).toBe(410)
	})

	test('POST /api/invites/accept missing body returns 400', async () => {
		const res = await app.request('http://localhost/api/invites/accept', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: '{}',
		})
		expect(res.status).toBe(400)
	})

	test('POST /api/invites/accept with mismatched email returns 400', async () => {
		const { token } = await insertInvite({ email: 'real@example.com', role: 'member' })
		const res = await app.request('http://localhost/api/invites/accept', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				token,
				name: 'Imposter',
				email: 'wrong@example.com',
				password: 'aPassword123!',
			}),
		})
		expect(res.status).toBe(400)
	})
})

describe('invites API — protected routes', () => {
	test('GET /api/invites without auth returns 401', async () => {
		const res = await app.request('http://localhost/api/invites')
		expect(res.status).toBe(401)
	})

	test('GET /api/invites as member returns 403', async () => {
		currentSessionActor = makeActor('member')
		const res = await app.request('http://localhost/api/invites')
		expect(res.status).toBe(403)
	})

	test('GET /api/invites as viewer returns 403', async () => {
		currentSessionActor = makeActor('viewer')
		const res = await app.request('http://localhost/api/invites')
		expect(res.status).toBe(403)
	})

	test('GET /api/invites as owner returns 200', async () => {
		await insertInvite({ email: 'list-target@example.com' })
		currentSessionActor = makeActor('owner')
		const res = await app.request('http://localhost/api/invites')
		expect(res.status).toBe(200)
		const list = (await res.json()) as Array<{ email: string }>
		expect(list.some((row) => row.email === 'list-target@example.com')).toBe(true)
	})

	test('POST /api/invites as admin creates an invite', async () => {
		currentSessionActor = makeActor('admin')
		const res = await app.request('http://localhost/api/invites', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'new@example.com', role: 'admin' }),
		})
		expect(res.status).toBe(201)
		const invite = (await res.json()) as { email: string; role: string; token: string }
		expect(invite.email).toBe('new@example.com')
		expect(invite.role).toBe('admin')
		expect(invite.token).toBeTruthy()
	})

	test('POST /api/invites as member returns 403', async () => {
		currentSessionActor = makeActor('member')
		const res = await app.request('http://localhost/api/invites', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'new@example.com' }),
		})
		expect(res.status).toBe(403)
	})

	test('POST /api/invites rejects non-product roles', async () => {
		currentSessionActor = makeActor('owner')
		const res = await app.request('http://localhost/api/invites', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'bad@example.com', role: 'superuser' }),
		})
		expect(res.status).toBe(400)
	})

	test('POST /api/invites accepts each product role', async () => {
		currentSessionActor = makeActor('owner')
		for (const role of ['owner', 'admin', 'member', 'viewer']) {
			await dbResult.db.delete(authSchema.invite).where(eq(authSchema.invite.email, `${role}@example.com`))
			const res = await app.request('http://localhost/api/invites', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ email: `${role}@example.com`, role }),
			})
			expect(res.status).toBe(201)
		}
	})

	test('POST /api/invites refuses duplicate active invite', async () => {
		await insertInvite({ email: 'dup@example.com' })
		currentSessionActor = makeActor('owner')
		const res = await app.request('http://localhost/api/invites', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ email: 'dup@example.com' }),
		})
		expect(res.status).toBe(409)
	})

	test('DELETE /api/invites/:id without auth returns 401', async () => {
		const { id } = await insertInvite({ email: 'rm@example.com' })
		const res = await app.request(`http://localhost/api/invites/${id}`, { method: 'DELETE' })
		expect(res.status).toBe(401)
	})

	test('DELETE /api/invites/:id as member returns 403', async () => {
		const { id } = await insertInvite({ email: 'rm@example.com' })
		currentSessionActor = makeActor('member')
		const res = await app.request(`http://localhost/api/invites/${id}`, { method: 'DELETE' })
		expect(res.status).toBe(403)
	})

	test('DELETE /api/invites/:id as owner removes the invite', async () => {
		const { id } = await insertInvite({ email: 'rm@example.com' })
		currentSessionActor = makeActor('owner')
		const res = await app.request(`http://localhost/api/invites/${id}`, { method: 'DELETE' })
		expect(res.status).toBe(200)

		const after = await dbResult.db
			.select()
			.from(authSchema.invite)
			.where(eq(authSchema.invite.id, id))
			.get()
		expect(after).toBeUndefined()
	})

	test('DELETE /api/invites/:id with non-existent id returns 404', async () => {
		currentSessionActor = makeActor('owner')
		const res = await app.request('http://localhost/api/invites/does-not-exist', {
			method: 'DELETE',
		})
		expect(res.status).toBe(404)
	})
})
