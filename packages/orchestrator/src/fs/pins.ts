/**
 * Pins module — CRUD operations backed by SQLite.
 *
 * Migrated from YAML files to SQLite for atomic concurrent operations.
 * On first call, existing YAML pins are migrated to the DB automatically.
 */
import { readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { PinSchema, PATHS, pinPath, PIN_TYPES } from '@questpie/autopilot-spec'
import { readYaml, fileExists } from './yaml'
import { eventBus } from '../events'
import type { AutopilotDb } from '../db'
import { pins as pinsTable } from '../db/schema'

/** Resolved (validated) dashboard pin object. */
export type PinOutput = z.output<typeof PinSchema>

function generatePinId(): string {
	return `pin-${Date.now().toString(36)}`
}

// ── Migration ────────────────────────────────────────────────────────────────

let migrationDone = false

/**
 * Migrate existing YAML pin files to SQLite (idempotent).
 * Called once on first listPins/createPin. Removes YAML files after migration.
 */
export async function migrateYamlPins(companyRoot: string, db: AutopilotDb): Promise<void> {
	if (migrationDone) return
	migrationDone = true

	const dirPath = join(companyRoot, PATHS.PINS_DIR)
	let files: string[]
	try {
		files = await readdir(dirPath)
	} catch {
		return // No pins directory — nothing to migrate
	}

	for (const file of files) {
		if (!file.endsWith('.yaml')) continue
		try {
			const pin = await readYaml(join(dirPath, file), PinSchema)
			// Insert if not already present
			const existing = await db.select().from(pinsTable).where(eq(pinsTable.id, pin.id)).limit(1).execute()
			if (existing.length === 0) {
				await db.insert(pinsTable).values({
					id: pin.id,
					title: pin.title,
					content: pin.content ?? null,
					type: pin.type,
					group_id: pin.group,
					metadata: JSON.stringify(pin.metadata ?? {}),
					created_by: pin.created_by,
					created_at: new Date(pin.created_at).getTime(),
					updated_at: new Date(pin.created_at).getTime(),
					expires_at: pin.expires_at ? new Date(pin.expires_at).getTime() : null,
				}).execute()
			}
			// Remove the YAML file after successful migration
			await rm(join(dirPath, file)).catch(() => {})
		} catch {
			// Skip invalid YAML files
		}
	}
}

// ── DB ↔ PinOutput conversion ────────────────────────────────────────────────

interface PinRow {
	id: string
	title: string
	content: string | null
	type: string
	group_id: string | null
	metadata: string | null
	created_by: string | null
	created_at: number
	updated_at: number
	expires_at: number | null
}

function rowToPin(row: PinRow): PinOutput {
	return PinSchema.parse({
		id: row.id,
		group: row.group_id ?? 'overview',
		title: row.title,
		content: row.content ?? '',
		type: row.type,
		created_by: row.created_by ?? 'system',
		created_at: new Date(row.created_at).toISOString(),
		expires_at: row.expires_at ? new Date(row.expires_at).toISOString() : undefined,
		metadata: row.metadata ? JSON.parse(row.metadata) : {},
	})
}

// ── CRUD ─────────────────────────────────────────────────────────────────────

/** Create a new dashboard pin and write it to the DB. */
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
	db?: AutopilotDb,
): Promise<PinOutput> {
	const id = pinData.id ?? generatePinId()
	const now = Date.now()
	const createdAtMs = pinData.created_at ? new Date(pinData.created_at).getTime() : now
	const expiresAtMs = pinData.expires_at ? new Date(pinData.expires_at).getTime() : null

	if (db) {
		await db.insert(pinsTable).values({
			id,
			title: pinData.title,
			content: pinData.content ?? null,
			type: pinData.type,
			group_id: pinData.group,
			metadata: JSON.stringify(pinData.metadata ?? {}),
			created_by: pinData.created_by,
			created_at: createdAtMs,
			updated_at: now,
			expires_at: expiresAtMs,
		}).execute()

		eventBus.emit({ type: 'pin_changed', pinId: id, action: 'created' })

		return PinSchema.parse({
			id,
			group: pinData.group,
			title: pinData.title,
			content: pinData.content ?? '',
			type: pinData.type,
			created_by: pinData.created_by,
			created_at: new Date(createdAtMs).toISOString(),
			expires_at: expiresAtMs ? new Date(expiresAtMs).toISOString() : undefined,
			metadata: pinData.metadata ?? {},
		})
	}

	// Fallback: write YAML (for backward compat with agent tools that don't pass db)
	const { writeYaml } = await import('./yaml')
	const pin = PinSchema.parse({
		...pinData,
		id,
		created_at: new Date(createdAtMs).toISOString(),
	})
	const filePath = join(companyRoot, pinPath(pin.id))
	await writeYaml(filePath, pin)
	eventBus.emit({ type: 'pin_changed', pinId: pin.id, action: 'created' })
	return pin
}

/** Delete a pin from the DB (no-op if already gone). */
export async function removePin(
	companyRoot: string,
	pinId: string,
	db?: AutopilotDb,
): Promise<void> {
	if (db) {
		await db.delete(pinsTable).where(eq(pinsTable.id, pinId)).execute()
	} else {
		const filePath = join(companyRoot, pinPath(pinId))
		if (await fileExists(filePath)) {
			await rm(filePath)
		}
	}
	eventBus.emit({ type: 'pin_changed', pinId, action: 'removed' })
}

/** List all pins, optionally filtered by group. */
export async function listPins(
	companyRoot: string,
	group?: string,
	db?: AutopilotDb,
): Promise<PinOutput[]> {
	if (db) {
		// Ensure YAML migration happened
		await migrateYamlPins(companyRoot, db)

		const now = Date.now()
		let rows: PinRow[]

		if (group) {
			rows = await db
				.select()
				.from(pinsTable)
				.where(eq(pinsTable.group_id, group))
				.execute() as PinRow[]
		} else {
			rows = await db.select().from(pinsTable).execute() as PinRow[]
		}

		// Filter out expired pins
		return rows
			.filter((r) => !r.expires_at || r.expires_at > now)
			.map(rowToPin)
	}

	// Fallback: read from YAML
	const dirPath = join(companyRoot, PATHS.PINS_DIR)
	let yamlFiles: string[]
	try {
		yamlFiles = await readdir(dirPath)
	} catch {
		return []
	}

	const result: PinOutput[] = []
	for (const file of yamlFiles) {
		if (!file.endsWith('.yaml')) continue
		try {
			const pin = await readYaml(join(dirPath, file), PinSchema)
			if (group && pin.group !== group) continue
			result.push(pin)
		} catch {
			// skip invalid
		}
	}
	return result
}

/**
 * Apply partial updates to an existing pin.
 *
 * @throws If the pin does not exist.
 */
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
	db?: AutopilotDb,
): Promise<PinOutput> {
	if (db) {
		const existing = await db.select().from(pinsTable).where(eq(pinsTable.id, pinId)).limit(1).execute()
		if (existing.length === 0) {
			throw new Error(`Pin not found: ${pinId}`)
		}

		const _row = existing[0]! as PinRow
		const now = Date.now()
		const updateValues: Record<string, unknown> = { updated_at: now }

		if (updates.group !== undefined) updateValues.group_id = updates.group
		if (updates.title !== undefined) updateValues.title = updates.title
		if (updates.content !== undefined) updateValues.content = updates.content
		if (updates.type !== undefined) updateValues.type = updates.type
		if (updates.expires_at !== undefined) updateValues.expires_at = new Date(updates.expires_at).getTime()
		if (updates.metadata !== undefined) updateValues.metadata = JSON.stringify(updates.metadata)

		await db.update(pinsTable).set(updateValues).where(eq(pinsTable.id, pinId)).execute()

		// Re-read and return
		const updated = await db.select().from(pinsTable).where(eq(pinsTable.id, pinId)).limit(1).execute()
		eventBus.emit({ type: 'pin_changed', pinId, action: 'updated' })
		return rowToPin(updated[0]! as PinRow)
	}

	// Fallback: YAML-based update
	const filePath = join(companyRoot, pinPath(pinId))
	if (!(await fileExists(filePath))) {
		throw new Error(`Pin not found: ${pinId}`)
	}

	const existingPin = await readYaml(filePath, PinSchema)
	const updatedPin = PinSchema.parse({
		...existingPin,
		...updates,
		id: existingPin.id,
		created_at: existingPin.created_at,
		created_by: existingPin.created_by,
	})

	const { writeYaml } = await import('./yaml')
	await writeYaml(filePath, updatedPin)
	return updatedPin
}
