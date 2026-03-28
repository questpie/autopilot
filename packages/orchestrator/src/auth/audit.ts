/**
 * Audit log — append-only JSONL storage.
 *
 * Events are written to logs/audit/YYYY-MM-DD.jsonl.
 * Agent scope is DENIED for logs/audit/** (hardcoded deny pattern).
 */
import { appendFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { AuditEvent } from './types'
import { logger } from '../logger'

/**
 * Write an audit event to the daily JSONL log file.
 */
export async function logAudit(
	companyRoot: string,
	event: AuditEvent,
): Promise<void> {
	const date = event.ts.slice(0, 10)
	const dir = join(companyRoot, 'logs', 'audit')
	const filePath = join(dir, `${date}.jsonl`)

	try {
		await mkdir(dir, { recursive: true })
		const line = JSON.stringify(event) + '\n'
		await appendFile(filePath, line, 'utf-8')
	} catch (err) {
		logger.error('audit', 'failed to write audit event', { error: err instanceof Error ? err.message : String(err) })
	}
}

/**
 * Read audit events from a specific date.
 */
export async function readAuditLog(
	companyRoot: string,
	date: string,
): Promise<AuditEvent[]> {
	const filePath = join(companyRoot, 'logs', 'audit', `${date}.jsonl`)
	try {
		const content = await Bun.file(filePath).text()
		return content
			.split('\n')
			.filter((line) => line.trim())
			.map((line) => JSON.parse(line) as AuditEvent)
	} catch {
		return []
	}
}
