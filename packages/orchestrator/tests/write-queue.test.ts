import { describe, it, expect } from 'bun:test'
import { WriteQueue } from '../src/fs/write-queue'

describe('WriteQueue', () => {
	it('single lock acquires and releases correctly', async () => {
		const queue = new WriteQueue()
		let executed = false

		await queue.withLock('/test/file.yaml', async () => {
			executed = true
		})

		expect(executed).toBe(true)
		expect(queue.activeLocks).toBe(0)
	})

	it('two concurrent operations on DIFFERENT paths run in parallel', async () => {
		const queue = new WriteQueue()
		const order: string[] = []

		const a = queue.withLock('/test/a.yaml', async () => {
			order.push('a-start')
			await Bun.sleep(50)
			order.push('a-end')
		})

		const b = queue.withLock('/test/b.yaml', async () => {
			order.push('b-start')
			await Bun.sleep(50)
			order.push('b-end')
		})

		await Promise.all([a, b])

		// Both should start before either ends (parallel execution)
		expect(order.indexOf('a-start')).toBeLessThan(order.indexOf('a-end'))
		expect(order.indexOf('b-start')).toBeLessThan(order.indexOf('b-end'))
		// Both started before any ended
		const firstEnd = Math.min(order.indexOf('a-end'), order.indexOf('b-end'))
		expect(order.indexOf('a-start')).toBeLessThan(firstEnd)
		expect(order.indexOf('b-start')).toBeLessThan(firstEnd)
	})

	it('two concurrent operations on SAME path are serialized', async () => {
		const queue = new WriteQueue()
		const order: string[] = []

		const a = queue.withLock('/test/same.yaml', async () => {
			order.push('a-start')
			await Bun.sleep(50)
			order.push('a-end')
		})

		const b = queue.withLock('/test/same.yaml', async () => {
			order.push('b-start')
			await Bun.sleep(10)
			order.push('b-end')
		})

		await Promise.all([a, b])

		// Second must start after first ends (serialized)
		expect(order).toEqual(['a-start', 'a-end', 'b-start', 'b-end'])
	})

	it('three operations on same path execute in FIFO order', async () => {
		const queue = new WriteQueue()
		const order: number[] = []

		const promises = [1, 2, 3].map((n) =>
			queue.withLock('/test/fifo.yaml', async () => {
				order.push(n)
				await Bun.sleep(10)
			}),
		)

		await Promise.all(promises)

		expect(order).toEqual([1, 2, 3])
	})

	it('lock releases even if function throws', async () => {
		const queue = new WriteQueue()

		// First call throws
		await expect(
			queue.withLock('/test/error.yaml', async () => {
				throw new Error('boom')
			}),
		).rejects.toThrow('boom')

		// Lock should be released — second call should succeed
		let executed = false
		await queue.withLock('/test/error.yaml', async () => {
			executed = true
		})

		expect(executed).toBe(true)
		expect(queue.activeLocks).toBe(0)
	})

	it('error in queued operation does not poison subsequent operations', async () => {
		const queue = new WriteQueue()
		const results: string[] = []

		const p1 = queue.withLock('/test/poison.yaml', async () => {
			results.push('first-ok')
			await Bun.sleep(10)
		})

		const p2 = queue.withLock('/test/poison.yaml', async () => {
			throw new Error('second fails')
		})

		const p3 = queue.withLock('/test/poison.yaml', async () => {
			results.push('third-ok')
		})

		await p1
		await expect(p2).rejects.toThrow('second fails')
		await p3

		expect(results).toEqual(['first-ok', 'third-ok'])
		expect(queue.activeLocks).toBe(0)
	})

	it('activeLocks count is correct during operations', async () => {
		const queue = new WriteQueue()

		expect(queue.activeLocks).toBe(0)

		let locksDuringA = 0
		let locksDuringB = 0

		const a = queue.withLock('/test/count-a.yaml', async () => {
			locksDuringA = queue.activeLocks
			await Bun.sleep(50)
		})

		const b = queue.withLock('/test/count-b.yaml', async () => {
			locksDuringB = queue.activeLocks
			await Bun.sleep(50)
		})

		await Promise.all([a, b])

		expect(locksDuringA).toBeGreaterThanOrEqual(1)
		expect(locksDuringB).toBe(2)
		expect(queue.activeLocks).toBe(0)
	})

	it('queueLength is correct during operations', async () => {
		const queue = new WriteQueue()
		let queueLenDuringFirst = -1

		const p1 = queue.withLock('/test/qlen.yaml', async () => {
			await Bun.sleep(50)
			queueLenDuringFirst = queue.queueLength('/test/qlen.yaml')
		})

		// Give p1 a moment to start
		await Bun.sleep(5)

		const p2 = queue.withLock('/test/qlen.yaml', async () => {})
		const p3 = queue.withLock('/test/qlen.yaml', async () => {})

		// After p2 and p3 are queued, check from p1's perspective
		await Promise.all([p1, p2, p3])

		expect(queueLenDuringFirst).toBe(2)
		expect(queue.queueLength('/test/qlen.yaml')).toBe(0)
	})

	it('after all operations complete, no locks remain', async () => {
		const queue = new WriteQueue()

		const promises = Array.from({ length: 5 }, (_, i) =>
			queue.withLock(`/test/file-${i % 2}.yaml`, async () => {
				await Bun.sleep(5)
			}),
		)

		await Promise.all(promises)

		expect(queue.activeLocks).toBe(0)
		expect(queue.queueLength('/test/file-0.yaml')).toBe(0)
		expect(queue.queueLength('/test/file-1.yaml')).toBe(0)
	})

	it('stress: 10 concurrent writes preserve all updates', async () => {
		const queue = new WriteQueue()
		let counter = 0

		const promises = Array.from({ length: 10 }, () =>
			queue.withLock('/test/file.yaml', async () => {
				const current = counter
				await Bun.sleep(10) // Simulate I/O
				counter = current + 1
			}),
		)

		await Promise.all(promises)
		expect(counter).toBe(10) // All 10 increments preserved
	})

	it('mixed: writes to file A and B — serialized per-file, concurrent across files', async () => {
		const queue = new WriteQueue()
		const orderA: number[] = []
		const orderB: number[] = []
		const globalOrder: string[] = []

		const promisesA = Array.from({ length: 5 }, (_, i) =>
			queue.withLock('/test/a.yaml', async () => {
				globalOrder.push(`a-${i}-start`)
				orderA.push(i)
				await Bun.sleep(10)
				globalOrder.push(`a-${i}-end`)
			}),
		)

		const promisesB = Array.from({ length: 5 }, (_, i) =>
			queue.withLock('/test/b.yaml', async () => {
				globalOrder.push(`b-${i}-start`)
				orderB.push(i)
				await Bun.sleep(10)
				globalOrder.push(`b-${i}-end`)
			}),
		)

		await Promise.all([...promisesA, ...promisesB])

		// Each file's operations are in FIFO order
		expect(orderA).toEqual([0, 1, 2, 3, 4])
		expect(orderB).toEqual([0, 1, 2, 3, 4])

		// A and B ran concurrently — both should have started early
		// (a-0 and b-0 should both start before a-4 ends)
		const a0Start = globalOrder.indexOf('a-0-start')
		const b0Start = globalOrder.indexOf('b-0-start')
		const a4End = globalOrder.indexOf('a-4-end')
		expect(a0Start).toBeLessThan(a4End)
		expect(b0Start).toBeLessThan(a4End)

		expect(queue.activeLocks).toBe(0)
	})
})
