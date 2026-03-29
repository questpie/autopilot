import { describe, it, expect, afterEach } from 'bun:test'
import { createPin, removePin, listPins, updatePin } from '../src/fs/pins'
import { createDb } from '../src/db'
import type { AutopilotDb } from '../src/db'
import { createTestCompany } from './helpers'

describe('pins', () => {
	let cleanup: () => Promise<void>
	let db: AutopilotDb

	afterEach(async () => {
		if (cleanup) await cleanup()
	})

	async function setup() {
		const ctx = await createTestCompany()
		cleanup = ctx.cleanup
		const result = await createDb(ctx.root)
		db = result.db
	}

	it('should create a pin', async () => {
		await setup()

		const pin = await createPin(db, {
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
		await setup()

		await createPin(db, {
			id: 'pin-1',
			group: 'status',
			title: 'Pin 1',
			type: 'info',
			created_by: 'dev',
		})
		await createPin(db, {
			id: 'pin-2',
			group: 'alerts',
			title: 'Pin 2',
			type: 'warning',
			created_by: 'dev',
		})

		const all = await listPins(db)
		expect(all).toHaveLength(2)
	})

	it('should filter pins by group', async () => {
		await setup()

		await createPin(db, {
			id: 'pin-g1',
			group: 'status',
			title: 'Status pin',
			type: 'info',
			created_by: 'dev',
		})
		await createPin(db, {
			id: 'pin-g2',
			group: 'alerts',
			title: 'Alert pin',
			type: 'warning',
			created_by: 'dev',
		})

		const statusPins = await listPins(db, 'status')
		expect(statusPins).toHaveLength(1)
		expect(statusPins[0]?.title).toBe('Status pin')
	})

	it('should remove a pin', async () => {
		await setup()

		await createPin(db, {
			id: 'pin-rm',
			group: 'status',
			title: 'To remove',
			type: 'info',
			created_by: 'dev',
		})

		await removePin(db, 'pin-rm')

		const pins = await listPins(db)
		expect(pins).toHaveLength(0)
	})

	it('should not throw when removing non-existent pin', async () => {
		await setup()
		await removePin(db, 'pin-nope')
		// no throw = pass
	})

	it('should update a pin', async () => {
		await setup()

		await createPin(db, {
			id: 'pin-upd',
			group: 'status',
			title: 'Original',
			content: 'Original content',
			type: 'info',
			created_by: 'dev',
		})

		const updated = await updatePin(db, 'pin-upd', {
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
		await setup()
		expect(updatePin(db, 'pin-ghost', { title: 'x' })).rejects.toThrow('Pin not found')
	})
})
