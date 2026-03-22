import { mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import { PATHS } from '@questpie/autopilot-spec'

/** A single entry in the append-only JSONL activity feed. */
export interface ActivityEntry {
	at: string
	agent: string
	type: string
	summary: string
	details?: Record<string, unknown>
}

function resolvePath(companyRoot: string, relativePath: string): string {
	return join(companyRoot, relativePath.replace(/^\/company/, ''))
}

function now(): string {
	return new Date().toISOString()
}

function dateFromIso(iso: string): string {
	return iso.slice(0, 10)
}

function activityFilePath(companyRoot: string, date: string): string {
	return join(resolvePath(companyRoot, PATHS.ACTIVITY_DIR), `${date}.jsonl`)
}

/**
 * Append an entry to today's JSONL activity log.
 *
 * Each day gets its own file (`<date>.jsonl`) inside the activity directory.
 */
export async function appendActivity(
	companyRoot: string,
	entry: Omit<ActivityEntry, 'at'> & { at?: string },
): Promise<ActivityEntry> {
	const timestamp = entry.at ?? now()
	const full: ActivityEntry = { ...entry, at: timestamp }
	const date = dateFromIso(timestamp)
	const filePath = activityFilePath(companyRoot, date)

	const dirPath = resolvePath(companyRoot, PATHS.ACTIVITY_DIR)
	await mkdir(dirPath, { recursive: true })

	const line = JSON.stringify(full) + '\n'
	const file = Bun.file(filePath)

	if (await file.exists()) {
		const existing = await file.text()
		await Bun.write(filePath, existing + line)
	} else {
		await Bun.write(filePath, line)
	}

	return full
}

/** Filter options for {@link readActivity}. */
export interface ReadActivityOptions {
	date?: string
	limit?: number
	agent?: string
	type?: string
}

/**
 * Read activity entries from a day's JSONL file, with optional filters.
 *
 * Defaults to today. Returns an empty array if the file does not exist.
 */
export async function readActivity(
	companyRoot: string,
	options?: ReadActivityOptions,
): Promise<ActivityEntry[]> {
	const date = options?.date ?? dateFromIso(now())
	const filePath = activityFilePath(companyRoot, date)
	const file = Bun.file(filePath)

	if (!(await file.exists())) {
		return []
	}

	const content = await file.text()
	const lines = content.trim().split('\n').filter(Boolean)
	let entries: ActivityEntry[] = lines.map((line) => JSON.parse(line) as ActivityEntry)

	if (options?.agent) {
		entries = entries.filter((e) => e.agent === options.agent)
	}
	if (options?.type) {
		entries = entries.filter((e) => e.type === options.type)
	}
	if (options?.limit) {
		entries = entries.slice(-options.limit)
	}

	return entries
}
