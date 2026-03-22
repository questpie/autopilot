import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'
import { PinSchema, PATHS, pinPath, PIN_TYPES } from '@questpie/autopilot-spec'
import { readYaml, writeYaml, fileExists } from './yaml'
import { writeQueue } from './write-queue'

export type PinOutput = z.output<typeof PinSchema>

function generatePinId(): string {
	return `pin-${Date.now().toString(36)}`
}

function resolvePath(companyRoot: string, relativePath: string): string {
	return join(companyRoot, relativePath.replace(/^\/company/, ''))
}

function now(): string {
	return new Date().toISOString()
}

export async function createPin(
	companyRoot: string,
	pinData: {
		id?: string
		group: string
		title: string
		content?: string
		type: (typeof PIN_TYPES)[number]
		created_by: string
		created_at?: string
		expires_at?: string
		metadata?: z.input<typeof PinSchema>['metadata']
	},
): Promise<PinOutput> {
	const id = pinData.id ?? generatePinId()
	const timestamp = pinData.created_at ?? now()

	const pin = PinSchema.parse({
		...pinData,
		id,
		created_at: timestamp,
	})

	const filePath = resolvePath(companyRoot, pinPath(pin.id))
	await writeYaml(filePath, pin)
	return pin
}

export async function removePin(companyRoot: string, pinId: string): Promise<void> {
	const filePath = resolvePath(companyRoot, pinPath(pinId))
	await writeQueue.withLock(filePath, async () => {
		if (await fileExists(filePath)) {
			await rm(filePath)
		}
	})
}

export async function listPins(companyRoot: string, group?: string): Promise<PinOutput[]> {
	const dirPath = resolvePath(companyRoot, PATHS.PINS_DIR)
	let files: string[]
	try {
		files = await readdir(dirPath)
	} catch {
		return []
	}

	const pins: PinOutput[] = []
	for (const file of files) {
		if (!file.endsWith('.yaml')) continue
		try {
			const pin = await readYaml(join(dirPath, file), PinSchema)
			if (group && pin.group !== group) continue
			pins.push(pin)
		} catch {
			// skip invalid
		}
	}

	return pins
}

export async function updatePin(
	companyRoot: string,
	pinId: string,
	updates: Partial<{
		group: string
		title: string
		content: string
		type: (typeof PIN_TYPES)[number]
		expires_at: string
		metadata: z.input<typeof PinSchema>['metadata']
	}>,
): Promise<PinOutput> {
	const filePath = resolvePath(companyRoot, pinPath(pinId))

	return writeQueue.withLock(filePath, async () => {
		if (!(await fileExists(filePath))) {
			throw new Error(`Pin not found: ${pinId}`)
		}

		const existing = await readYaml(filePath, PinSchema)
		const updated = PinSchema.parse({
			...existing,
			...updates,
			id: existing.id,
			created_at: existing.created_at,
			created_by: existing.created_by,
		})

		await writeYaml(filePath, updated)
		return updated
	})
}
