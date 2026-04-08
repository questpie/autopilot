import { describe, expect, test } from 'bun:test'
import { createApp, type Services } from '../src/api/app'
import type { Auth } from '../src/auth'
import type { CompanyDb } from '../src/db'
import type { AuthoredConfig } from '../src/services'

function buildAuthTestApp() {
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
		companyRoot: '/tmp/autopilot-auth-test',
		db: {} as CompanyDb,
		auth: {
			handler: () => new Response('not used'),
			api: {
				getSession: async () => null,
			},
		} as unknown as Auth,
		services: {
			enrollmentService: {
				validateMachineSecret: async () => null,
			},
			runService: {
				get: async () => null,
			},
		} as unknown as Services,
		authoredConfig,
		allowLocalDevBypass: true,
	})
}

describe('local dev auth bypass', () => {
	test('remote forwarded requests cannot use X-Local-Dev on GET /api/runs/:id', async () => {
		const app = buildAuthTestApp()

		const res = await app.request('http://autopilot.example.test/api/runs/run-1', {
			headers: {
				'X-Local-Dev': 'true',
				'X-Forwarded-For': '203.0.113.10',
			},
		})

		expect(res.status).toBe(401)
	})

	test('localhost requests can use X-Local-Dev on GET /api/runs/:id', async () => {
		const app = buildAuthTestApp()

		const res = await app.request('http://localhost/api/runs/run-1', {
			headers: {
				'X-Local-Dev': 'true',
			},
		})

		// The bypass succeeded and the route itself returned not found.
		expect(res.status).toBe(404)
	})
})
