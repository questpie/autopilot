import { describe, expect, test } from 'bun:test'
import { runUsesSharedCheckout } from '../src/worker'

describe('runUsesSharedCheckout', () => {
	test('treats taskless query runs as shared-checkout on repo workers', () => {
		expect(runUsesSharedCheckout(
			{ task_id: null, workspace_mode: null },
			{ sharedCheckoutEnabled: true, worktreeIsolationAvailable: true },
		)).toBe(true)
	})

	test('treats workspace_mode:none task runs as shared-checkout', () => {
		expect(runUsesSharedCheckout(
			{ task_id: 'task-1', workspace_mode: 'none' },
			{ sharedCheckoutEnabled: true, worktreeIsolationAvailable: true },
		)).toBe(true)
	})

	test('allows isolated worktree tasks to run alongside a shared-checkout lock', () => {
		expect(runUsesSharedCheckout(
			{ task_id: 'task-2', workspace_mode: 'isolated_worktree' },
			{ sharedCheckoutEnabled: true, worktreeIsolationAvailable: true },
		)).toBe(false)
	})

	test('treats all task runs as shared-checkout when worktree isolation is unavailable', () => {
		expect(runUsesSharedCheckout(
			{ task_id: 'task-3', workspace_mode: 'isolated_worktree' },
			{ sharedCheckoutEnabled: true, worktreeIsolationAvailable: false },
		)).toBe(true)
	})
})
