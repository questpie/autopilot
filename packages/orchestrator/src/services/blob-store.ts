/**
 * Content-addressed blob store backed by the orchestrator filesystem.
 *
 * Layout: <dataDir>/blobs/sha256/<first2>/<full-hash>
 * Deduplication is automatic — identical content produces the same hash/path.
 */
import { createHash } from 'node:crypto'
import { mkdir, readFile, unlink } from 'node:fs/promises'
import { join } from 'node:path'
import { existsSync } from 'node:fs'

export class BlobStore {
	readonly #blobRoot: string

	constructor(dataDir: string) {
		this.#blobRoot = join(dataDir, 'blobs')
	}

	/** Write content, return { storageKey, contentHash, size }. Idempotent — skips if hash exists. */
	async put(content: Buffer): Promise<{ storageKey: string; contentHash: string; size: number }> {
		const hash = createHash('sha256').update(content).digest('hex')
		const contentHash = `sha256:${hash}`
		const storageKey = `sha256/${hash.slice(0, 2)}/${hash}`
		const fullPath = join(this.#blobRoot, storageKey)

		if (!existsSync(fullPath)) {
			await mkdir(join(this.#blobRoot, 'sha256', hash.slice(0, 2)), { recursive: true })
			await Bun.write(fullPath, content)
		}

		return { storageKey, contentHash, size: content.length }
	}

	/** Read blob by storage key. Returns null if missing. */
	async get(storageKey: string): Promise<Buffer | null> {
		const fullPath = join(this.#blobRoot, storageKey)
		try {
			return Buffer.from(await readFile(fullPath))
		} catch {
			return null
		}
	}

	/** Check if a blob exists. */
	exists(storageKey: string): boolean {
		return existsSync(join(this.#blobRoot, storageKey))
	}

	/** Delete a blob by storage key (for future GC). */
	async delete(storageKey: string): Promise<void> {
		const fullPath = join(this.#blobRoot, storageKey)
		try {
			await unlink(fullPath)
		} catch {
			// already gone — not an error
		}
	}
}
