import { normalize } from 'node:path'

export class WriteQueue {
	private locks = new Map<string, { queue: Array<() => void> }>()

	/**
	 * Execute a function while holding an exclusive lock on the given file path.
	 * Multiple callers on different paths run concurrently.
	 * Multiple callers on the same path are serialized (FIFO).
	 */
	async withLock<T>(filePath: string, fn: () => Promise<T>): Promise<T> {
		const key = normalize(filePath)

		// If no lock exists, we're first — create entry and run immediately
		if (!this.locks.has(key)) {
			this.locks.set(key, { queue: [] })
			try {
				return await fn()
			} finally {
				this.release(key)
			}
		}

		// Lock exists — wait in queue
		return new Promise<T>((resolve, reject) => {
			this.locks.get(key)!.queue.push(async () => {
				try {
					resolve(await fn())
				} catch (err) {
					reject(err)
				} finally {
					this.release(key)
				}
			})
		})
	}

	private release(key: string) {
		const lock = this.locks.get(key)
		if (!lock) return

		const next = lock.queue.shift()
		if (next) {
			next() // Wake next waiter
		} else {
			this.locks.delete(key) // No waiters, clean up
		}
	}

	/** Number of paths currently locked */
	get activeLocks(): number {
		return this.locks.size
	}

	/** Number of waiters queued for a specific path */
	queueLength(filePath: string): number {
		const key = normalize(filePath)
		return this.locks.get(key)?.queue.length ?? 0
	}
}

/** Global write queue instance for the orchestrator */
export const writeQueue = new WriteQueue()
