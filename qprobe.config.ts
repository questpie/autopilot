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
	},
	http: {
		baseUrl: 'http://localhost:7778',
	},
})
