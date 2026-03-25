import { defineConfig } from '@questpie/probe'

export default defineConfig({
	services: {
		autopilot: {
			command: 'cd my-company && bunx autopilot start',
			ready: 'Orchestrator is running',
			port: 7778,
			health: '/api/status',
		},
	},
	baseUrl: 'http://localhost:7778',
})
