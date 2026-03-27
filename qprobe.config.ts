import { defineConfig } from '@questpie/probe'

export default defineConfig({
	services: {
		autopilot: {
			cmd: 'bunx autopilot start --no-dashboard',
			cwd: 'test-company',
			ready: 'Orchestrator is running',
			port: 7778,
			health: '/api/status',
		},
		dashboard: {
			cmd: 'node .output/server/index.mjs',
			cwd: 'apps/dashboard-v2',
			ready: 'listening on',
			port: 3000,
			depends: ['autopilot'],
		},
	},
	baseUrl: 'http://localhost:7778',
})
