import { expect, test } from '@playwright/test'

declare global {
	interface Window {
		__operatorWebFailures: () => string[]
	}
}

test.beforeEach(async ({ page }) => {
	const failures: string[] = []
	page.on('console', (message) => {
		if (message.type() === 'error') failures.push(message.text())
	})
	page.on('pageerror', (error) => failures.push(error.message))
	await page.exposeFunction('__operatorWebFailures', () => failures)
})

test('project registration captures git provider metadata', async ({ page }) => {
	await page.goto('settings?tab=projects')

	await expect(page.getByRole('tab', { name: 'Projects' })).toBeVisible()
	await page.getByPlaceholder('Optional display name').fill('Customer Portal')
	await page.getByPlaceholder('/absolute/path/to/project').fill('/work/customer-portal')
	await page.getByPlaceholder('Git remote URL').fill('git@gitlab.com:acme/customer-portal.git')
	await page.getByPlaceholder('Default branch, e.g. main').fill('trunk')
	await page.getByRole('button', { name: 'Register' }).click()

	await expect(page.getByText('Customer Portal')).toBeVisible()
	await expect(page.getByText('remote: git@gitlab.com:acme/customer-portal.git')).toBeVisible()
	await expect(page.getByText('branch: trunk')).toBeVisible()

	const events = await page.evaluate(() => fetch('/api/__test/events').then((res) => res.json()))
	expect(events.projectRegisters).toContainEqual(
		expect.objectContaining({
			name: 'Customer Portal',
			path: '/work/customer-portal',
			git_remote: 'git@gitlab.com:acme/customer-portal.git',
			default_branch: 'trunk',
		}),
	)

	const failures = await page.evaluate(() => window.__operatorWebFailures())
	expect(failures).toEqual([])
})
