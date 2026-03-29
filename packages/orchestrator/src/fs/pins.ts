/**
 * Pins module — CRUD operations backed by SQLite only.
 * No YAML fallbacks — all pin data lives in the database.
 */
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { PinSchema, PIN_TYPES } from '@questpie/autopilot-spec'
import { eventBus } from '../events'
import type { AutopilotDb } from '../db'
import { pins as pinsTable } from '../db/schema'

/** Resolved (validated) dashboard pin object. */
export type PinOutput = z.output<typeof PinSchema>

function generatePinId(): string {
	return `pin-${Date.now().toString(36)}`
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

/** Create a new dashboard pin. */
export async function createPin(
	db: AutopilotDb,
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
	const now = Date.now()
	const createdAtMs = pinData.created_at ? new Date(pinData.created_at).getTime() : now
	const expiresAtMs = pinData.expires_at ? new Date(pinData.expires_at).getTime() : null

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

/** Delete a pin from the DB (no-op if already gone). */
export async function removePin(
	db: AutopilotDb,
	pinId: string,
): Promise<void> {
	await db.delete(pinsTable).where(eq(pinsTable.id, pinId)).execute()
	eventBus.emit({ type: 'pin_changed', pinId, action: 'removed' })
}

/** List all pins, optionally filtered by group. Auto-expires old pins. */
export async function listPins(
	db: AutopilotDb,
	group?: string,
): Promise<PinOutput[]> {
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

/**
 * Apply partial updates to an existing pin.
 * @throws If the pin does not exist.
 */
export async function updatePin(
	db: AutopilotDb,
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
	const existing = await db.select().from(pinsTable).where(eq(pinsTable.id, pinId)).limit(1).execute()
	if (existing.length === 0) {
		throw new Error(`Pin not found: ${pinId}`)
	}

	const now = Date.now()
	const updateValues: Record<string, unknown> = { updated_at: now }

	if (updates.group !== undefined) updateValues.group_id = updates.group
	if (updates.title !== undefined) updateValues.title = updates.title
	if (updates.content !== undefined) updateValues.content = updates.content
	if (updates.type !== undefined) updateValues.type = updates.type
	if (updates.expires_at !== undefined) updateValues.expires_at = new Date(updates.expires_at).getTime()
	if (updates.metadata !== undefined) updateValues.metadata = JSON.stringify(updates.metadata)

	await db.update(pinsTable).set(updateValues).where(eq(pinsTable.id, pinId)).execute()

	const updated = await db.select().from(pinsTable).where(eq(pinsTable.id, pinId)).limit(1).execute()
	eventBus.emit({ type: 'pin_changed', pinId, action: 'updated' })
	return rowToPin(updated[0]! as PinRow)
}
