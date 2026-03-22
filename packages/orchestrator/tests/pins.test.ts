import { describe, it, expect, afterEach } from 'bun:test'
import { createPin, removePin, listPins, updatePin } from '../src/fs/pins'
import { createTestCompany } from './helpers'

describe('pins', () => {
	let cleanup: () => Promise<void>
	let root: string

	afterEach(async () => {
		if (cleanup) await cleanup()
	})

	it('should create a pin', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		const pin = await createPin(root, {
			group: 'status',
			title: 'Deploy ready',
			content: 'Version 1.2.0 ready for deploy',
			type: 'success',
			created_by: 'devops',
		})

		expect(pin.id).toMatch(/^pin-/)
		expect(pin.group).toBe('status')
		expect(pin.title).toBe('Deploy ready')
		expect(pin.type).toBe('success')
		expect(pin.created_at).toBeDefined()
	})

	it('should list all pins', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		await createPin(root, {
			id: 'pin-1',
			group: 'status',
			title: 'Pin 1',
			type: 'info',
			created_by: 'dev',
		})
		await createPin(root, {
			id: 'pin-2',
			group: 'alerts',
			title: 'Pin 2',
			type: 'warning',
			created_by: 'dev',
		})

		const all = await listPins(root)
		expect(all).toHaveLength(2)
	})

	it('should filter pins by group', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		await createPin(root, {
			id: 'pin-g1',
			group: 'status',
			title: 'Status pin',
			type: 'info',
			created_by: 'dev',
		})
		await createPin(root, {
			id: 'pin-g2',
			group: 'alerts',
			title: 'Alert pin',
			type: 'warning',
			created_by: 'dev',
		})

		const statusPins = await listPins(root, 'status')
		expect(statusPins).toHaveLength(1)
		expect(statusPins[0]?.title).toBe('Status pin')
	})

	it('should remove a pin', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		await createPin(root, {
			id: 'pin-rm',
			group: 'status',
			title: 'To remove',
			type: 'info',
			created_by: 'dev',
		})

		await removePin(root, 'pin-rm')

		const pins = await listPins(root)
		expect(pins).toHaveLength(0)
	})

	it('should not throw when removing non-existent pin', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		await removePin(root, 'pin-nope')
		// no throw = pass
	})

	it('should update a pin', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		await createPin(root, {
			id: 'pin-upd',
			group: 'status',
			title: 'Original',
			content: 'Original content',
			type: 'info',
			created_by: 'dev',
		})

		const updated = await updatePin(root, 'pin-upd', {
			title: 'Updated',
			content: 'New content',
			type: 'success',
		})

		expect(updated.title).toBe('Updated')
		expect(updated.content).toBe('New content')
		expect(updated.type).toBe('success')
		expect(updated.created_by).toBe('dev') // should not change
	})

	it('should throw when updating non-existent pin', async () => {
		const ctx = await createTestCompany()
		root = ctx.root
		cleanup = ctx.cleanup

		expect(updatePin(root, 'pin-ghost', { title: 'x' })).rejects.toThrow('Pin not found')
	})
})
