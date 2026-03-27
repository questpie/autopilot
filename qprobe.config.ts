import { defineConfig } from '@questpie/probe'

export default defineConfig({
	services: {
		orchestrator: {
			cmd: 'bun run ../packages/cli/bin/autopilot.ts start --no-dashboard',
			cwd: 'test-comp',
			ready: 'Orchestrator is running',
			port: 7778,
			health: '/api/status',
		},
		dashboard: {
			cmd: 'bun node_modules/.bin/vite dev --port 3001',
			cwd: 'apps/dashboard-v2',
			ready: 'Local',
			port: 3001,
			depends: ['orchestrator'],
		},
	},
	http: {
		baseUrl: 'http://localhost:7778',
	},
})
