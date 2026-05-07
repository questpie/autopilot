import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
	testDir: './tests/e2e',
	testMatch: '**/*.e2e.ts',
	timeout: 30_000,
	expect: {
		timeout: 7_500,
	},
	webServer: {
		command: 'bun tests/e2e/dev-server.ts',
		url: 'http://127.0.0.1:3001/app/settings?tab=config',
		timeout: 120_000,
		reuseExistingServer: !process.env.CI,
	},
	use: {
		baseURL: 'http://127.0.0.1:3001/app/',
		trace: 'retain-on-failure',
	},
	projects: [
		{
			name: 'chromium',
			use: { ...devices['Desktop Chrome'] },
		},
	],
})
