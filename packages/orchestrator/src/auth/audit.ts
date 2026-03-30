/**
 * Audit log — append-only encrypted JSONL storage.
 *
 * Events are written to logs/audit/YYYY-MM-DD.jsonl.
 * Each line is individually encrypted via AES-256-GCM (base64-encoded).
 * Agent scope is DENIED for logs/audit/** (hardcoded deny pattern).
 * Logs older than 90 days are automatically rotated (deleted).
 */
import { appendFile, mkdir, readdir, unlink, chmod } from 'node:fs/promises'
import { join } from 'node:path'
import type { AuditEvent } from './types'
import { encryptToBase64, decryptFromBase64 } from './crypto'
import { logger } from '../logger'

const RETENTION_DAYS = 90

/**
 * Write an audit event to the daily JSONL log file.
 * The JSON payload is encrypted per-line using the master key.
 */
export async function logAudit(
	companyRoot: string,
	event: AuditEvent,
	masterKey: CryptoKey,
): Promise<void> {
	const date = event.ts.slice(0, 10)
	const dir = join(companyRoot, 'logs', 'audit')
	const filePath = join(dir, `${date}.jsonl`)

	try {
		await mkdir(dir, { recursive: true })
		const encrypted = await encryptToBase64(JSON.stringify(event), masterKey)
		await appendFile(filePath, encrypted + '\n', 'utf-8')
		await chmod(filePath, 0o600)
	} catch (err) {
		logger.error('audit', 'failed to write audit event', { error: err instanceof Error ? err.message : String(err) })
	}
}

/**
 * Read and decrypt audit events from a specific date.
 */
export async function readAuditLog(
	companyRoot: string,
	date: string,
	masterKey: CryptoKey,
): Promise<AuditEvent[]> {
	const filePath = join(companyRoot, 'logs', 'audit', `${date}.jsonl`)
	try {
		const content = await Bun.file(filePath).text()
		const lines = content.split('\n').filter((line) => line.trim())
		const events: AuditEvent[] = []
		for (const line of lines) {
			try {
				const decrypted = await decryptFromBase64(line.trim(), masterKey)
				events.push(JSON.parse(decrypted) as AuditEvent)
			} catch {
				// Skip corrupted or unreadable lines
				logger.warn('audit', 'skipping unreadable audit log line')
			}
		}
		return events
	} catch {
		return []
	}
}

/**
 * Delete audit log files older than RETENTION_DAYS (90 days).
 */
export async function rotateAuditLogs(companyRoot: string): Promise<number> {
	const dir = join(companyRoot, 'logs', 'audit')
	const cutoff = new Date()
	cutoff.setDate(cutoff.getDate() - RETENTION_DAYS)
	const cutoffStr = cutoff.toISOString().slice(0, 10)

	let deleted = 0
	try {
		const files = await readdir(dir)
		for (const file of files) {
			if (!file.endsWith('.jsonl')) continue
			const fileDate = file.replace('.jsonl', '')
			if (fileDate < cutoffStr) {
				await unlink(join(dir, file))
				deleted++
			}
		}
	} catch {
		// Directory may not exist yet
	}
	if (deleted > 0) {
		logger.info('audit', `rotated ${deleted} audit log file(s) older than ${RETENTION_DAYS} days`)
	}
	return deleted
}
