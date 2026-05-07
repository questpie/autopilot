import { describe, expect, test } from 'bun:test'
import { createApp, type Services } from '../src/api/app'
import type { AuthoredConfig } from '../src/services'

function authoredConfig(): AuthoredConfig {
	return {
		company: {},
		agents: new Map(),
		workflows: new Map(),
		environments: new Map(),
		providers: new Map(),
		capabilityProfiles: new Map(),
		skills: new Map(),
		context: new Map(),
	}
}

describe('task graph route order', () => {
	test('/api/tasks/relations reaches the graph route, not /api/tasks/:id', async () => {
		const app = createApp({
			companyRoot: '/tmp/autopilot-route-order',
			db: {} as never,
			auth: {} as never,
			allowLocalDevBypass: true,
			authoredConfig: authoredConfig(),
			services: {
				enrollmentService: { validateMachineSecret: async () => null },
				runService: { get: async () => null },
				taskRelationService: {
					listAll: async () => [{ id: 'rel-1', relation_type: 'decomposes_to' }],
				},
				taskService: {
					get: async () => {
						throw new Error('generic task detail route caught /relations')
					},
				},
			} as unknown as Services,
		})

		const res = await app.request('http://localhost/api/tasks/relations', {
			headers: { 'X-Local-Dev': 'true' },
		})
		const body = (await res.json()) as Array<{ id: string }>

		expect(res.status).toBe(200)
		expect(body).toEqual([{ id: 'rel-1', relation_type: 'decomposes_to' }])
	})
})
