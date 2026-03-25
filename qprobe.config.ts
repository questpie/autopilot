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
			cmd: 'bun run serve.ts',
			cwd: 'apps/dashboard',
			ready: 'listening on',
			port: 3001,
			depends: ['autopilot'],
		},
	},
	baseUrl: 'http://localhost:7778',
})
