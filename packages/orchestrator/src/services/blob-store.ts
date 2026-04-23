/**
 * Content-addressed blob store backed by FlyDrive.
 *
 * Layout: <dataDir>/blobs/sha256/<first2>/<full-hash>
 * Deduplication is automatic — identical content produces the same hash/path.
 */
import { createHash } from 'node:crypto'
import { existsSync } from 'node:fs'
import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { Disk } from 'flydrive'
import { FSDriver } from 'flydrive/drivers/fs'
import { S3Driver } from 'flydrive/drivers/s3'

type BlobDriver = 'fs' | 's3' | 'r2'

function getBlobDriver(): BlobDriver {
	const driver = process.env.AUTOPILOT_BLOB_DRIVER ?? 'fs'
	if (driver === 'fs' || driver === 's3' || driver === 'r2') return driver
	throw new Error(`Unsupported AUTOPILOT_BLOB_DRIVER: ${driver}`)
}

function requireEnv(name: string, fallback?: string): string {
	const value = process.env[name] ?? fallback
	if (!value) throw new Error(`${name} is required for AUTOPILOT_BLOB_DRIVER`)
	return value
}

export class BlobStore {
	readonly #blobRoot: string
	readonly #disk: Disk
	readonly #isLocal: boolean

	constructor(dataDir: string) {
		this.#blobRoot = join(dataDir, 'blobs')
		const driver = getBlobDriver()
		this.#isLocal = driver === 'fs'
		this.#disk = new Disk(
			driver === 'fs'
				? new FSDriver({ location: pathToFileURL(`${this.#blobRoot}/`), visibility: 'private' })
				: new S3Driver({
						bucket: requireEnv('AUTOPILOT_BLOB_S3_BUCKET'),
						region:
							process.env.AUTOPILOT_BLOB_S3_REGION ?? (driver === 'r2' ? 'auto' : 'us-east-1'),
						endpoint: process.env.AUTOPILOT_BLOB_S3_ENDPOINT,
						forcePathStyle: process.env.AUTOPILOT_BLOB_S3_FORCE_PATH_STYLE === 'true',
						credentials: {
							accessKeyId: requireEnv(
								'AUTOPILOT_BLOB_S3_ACCESS_KEY_ID',
								process.env.AWS_ACCESS_KEY_ID,
							),
							secretAccessKey: requireEnv(
								'AUTOPILOT_BLOB_S3_SECRET_ACCESS_KEY',
								process.env.AWS_SECRET_ACCESS_KEY,
							),
						},
						visibility: 'private',
						supportsACL: driver === 's3',
					}),
		)
	}

	/** Write content, return { storageKey, contentHash, size }. Idempotent — skips if hash exists. */
	async put(content: Buffer): Promise<{ storageKey: string; contentHash: string; size: number }> {
		const hash = createHash('sha256').update(content).digest('hex')
		const contentHash = `sha256:${hash}`
		const storageKey = `sha256/${hash.slice(0, 2)}/${hash}`

		if (this.#isLocal && !existsSync(join(this.#blobRoot, storageKey))) {
			await mkdir(join(this.#blobRoot, 'sha256', hash.slice(0, 2)), { recursive: true })
		}
		await this.#disk.put(storageKey, content)

		return { storageKey, contentHash, size: content.length }
	}

	/** Read blob by storage key. Returns null if missing. */
	async get(storageKey: string): Promise<Buffer | null> {
		try {
			return Buffer.from(await this.#disk.getBytes(storageKey))
		} catch {
			return null
		}
	}

	/** Check if a blob exists. */
	exists(storageKey: string): boolean {
		if (!this.#isLocal) return false
		return existsSync(join(this.#blobRoot, storageKey))
	}

	/** Delete a blob by storage key (for future GC). */
	async delete(storageKey: string): Promise<void> {
		try {
			await this.#disk.delete(storageKey)
		} catch {
			// already gone — not an error
		}
	}
}
