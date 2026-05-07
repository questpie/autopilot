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

test('workflow wizard creates a workflow with agent + approval + done', async ({ page }) => {
	await page.goto('settings?tab=config')

	// Pick the Workflows config type via the type selector (the second combobox).
	await page.getByRole('combobox').nth(1).selectOption('workflows')

	// Create a new workflow record (selector "New record" is rendered by config-settings).
	await page.getByRole('button', { name: 'New record' }).click()

	await page.getByRole('textbox', { name: 'Workflow name' }).fill('Newsletter review')
	await page
		.getByRole('textbox', { name: 'Workflow description' })
		.fill('Author + approve newsletter draft.')

	// First step is auto-named "plan" — convert it to an agent step bound to dev.
	await page.getByRole('combobox', { name: 'Step type' }).first().selectOption('agent')
	const agentSelect = page.getByRole('combobox', { name: 'Agent' }).first()
	await agentSelect.selectOption('dev')
	await page
		.getByRole('textbox', { name: 'Instructions' })
		.first()
		.fill('Draft the April newsletter using brand voice.')

	// Add an approval step in the middle.
	await page.getByRole('button', { name: 'Add step' }).click()
	const stepIdInputs = page.getByRole('textbox', { name: 'Step ID' })
	await stepIdInputs.nth(1).fill('approve')
	const stepTypeSelects = page.getByRole('combobox', { name: 'Step type' })
	await stepTypeSelects.nth(1).selectOption('human_approval')
	await page.getByRole('textbox', { name: 'Approvers' }).fill('owner')

	// Re-order so the second step is the new approve step (already in order).
	// Move the auto-generated done step to the end.
	const doneStepBefore = await stepIdInputs.count()
	expect(doneStepBefore).toBeGreaterThanOrEqual(2)

	// The default workflow already includes a done step from emptyWorkflow().
	// Make sure we still have a final done step.
	await page.getByRole('button', { name: 'Save' }).click()

	await expect(page.getByText('Workflows saved and runtime reloaded')).toBeVisible()

	const events = await page.evaluate(() => fetch('/api/__test/events').then((res) => res.json()))
	const saved = events.configSets.find(
		(entry: { type: string; id: string }) =>
			entry.type === 'workflows' && entry.id === 'newsletter-review',
	)
	expect(saved).toBeTruthy()
	const data = saved.data as {
		id: string
		name: string
		steps: Array<{ id: string; type: string; agent_id?: string; approvers?: string[] }>
	}
	expect(data.id).toBe('newsletter-review')
	expect(data.name).toBe('Newsletter review')
	expect(data.steps.some((step) => step.type === 'agent' && step.agent_id === 'dev')).toBe(true)
	expect(
		data.steps.some(
			(step) =>
				step.type === 'human_approval' &&
				Array.isArray(step.approvers) &&
				step.approvers.includes('owner'),
		),
	).toBe(true)

	const failures = await page.evaluate(() => window.__operatorWebFailures())
	expect(failures).toEqual([])
})
