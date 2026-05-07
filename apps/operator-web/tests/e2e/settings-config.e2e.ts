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

test('agent setup wizard saves an agent and reloads runtime config', async ({ page }) => {
	await page.goto('settings?tab=config')

	await expect(page.getByRole('tab', { name: 'Configuration' })).toBeVisible()
	await page.getByRole('combobox').nth(1).selectOption('agents')

	await expect(page.getByText('Runtime profile')).toBeVisible()
	await page.getByRole('textbox', { name: 'Agent ID' }).fill('researcher')
	await page.getByRole('textbox', { name: 'Display name' }).fill('Researcher')
	await page.getByRole('combobox', { name: 'Role' }).selectOption('researcher')
	await page.getByRole('combobox', { name: 'Provider hint' }).selectOption('openai')
	await page.getByRole('textbox', { name: 'Model hint' }).fill('gpt-5.2')
	await page.getByRole('combobox', { name: 'Variant' }).selectOption('extended-thinking')
	await page.getByRole('textbox', { name: 'Capability profiles' }).fill('research, web, synthesis')
	await page
		.getByRole('textbox', { name: 'Operating brief' })
		.fill('Researches external context, writes concise synthesis, and records reusable knowledge.')

	await page.getByRole('button', { name: 'Save' }).click()
	await expect(page.getByText('Agents saved and runtime reloaded')).toBeVisible()

	const events = await page.evaluate(() => fetch('/api/__test/events').then((res) => res.json()))
	expect(events.reloadCount).toBeGreaterThan(0)
	expect(events.configSets).toContainEqual(
		expect.objectContaining({
			type: 'agents',
			id: 'researcher',
			data: expect.objectContaining({
				id: 'researcher',
				name: 'Researcher',
				role: 'researcher',
				provider: 'openai',
				model: 'gpt-5.2',
				variant: 'extended-thinking',
				capability_profiles: ['research', 'web', 'synthesis'],
			}),
		}),
	)

	const failures = await page.evaluate(() => window.__operatorWebFailures())
	expect(failures).toEqual([])
})
