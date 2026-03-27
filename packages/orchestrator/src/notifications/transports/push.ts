/**
 * PWA Push transport — sends Web Push notifications via the web-push library.
 *
 * VAPID keys are generated on first startup and stored in .auth/vapid-keys.json.
 * Public key is exposed via the API for client-side subscription registration.
 */
import webpush from 'web-push'
import { join } from 'node:path'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { eq } from 'drizzle-orm'
import { pushSubscriptions } from '../../db/schema'
import type { AutopilotDb } from '../../db'

// ── Types ───────────────────────────────────────────────────────────────────

interface VapidKeys {
	publicKey: string
	privateKey: string
}

interface PushPayload {
	title: string
	body: string
	icon?: string
	badge?: string
	tag?: string
	data?: Record<string, unknown>
	actions?: Array<{ action: string; title: string }>
}

// ── VAPID Key Management ────────────────────────────────────────────────────

let cachedKeys: VapidKeys | null = null

function vapidKeysPath(companyRoot: string): string {
	return join(companyRoot, '.auth', 'vapid-keys.json')
}

/**
 * Get or generate VAPID keys. Generated once on first call, then cached.
 * Stored in .auth/vapid-keys.json for persistence across restarts.
 */
export async function getVapidKeys(companyRoot: string): Promise<VapidKeys | null> {
	if (cachedKeys) return cachedKeys

	const keysPath = vapidKeysPath(companyRoot)

	// Try to read existing keys
	try {
		if (existsSync(keysPath)) {
			const raw = await readFile(keysPath, 'utf-8')
			const parsed = JSON.parse(raw) as VapidKeys
			if (parsed.publicKey && parsed.privateKey) {
				cachedKeys = parsed
				return cachedKeys
			}
		}
	} catch {
		// Regenerate if file is corrupt
	}

	// Generate new keys
	try {
		const generated = webpush.generateVAPIDKeys()
		const keys: VapidKeys = {
			publicKey: generated.publicKey,
			privateKey: generated.privateKey,
		}

		// Persist to disk
		const authDir = join(companyRoot, '.auth')
		await mkdir(authDir, { recursive: true })
		await writeFile(keysPath, JSON.stringify(keys, null, 2), 'utf-8')

		cachedKeys = keys
		console.log('[push] VAPID keys generated and saved to .auth/vapid-keys.json')
		return cachedKeys
	} catch (err) {
		console.error('[push] failed to generate VAPID keys:', err instanceof Error ? err.message : err)
		return null
	}
}

// ── Push Sending ────────────────────────────────────────────────────────────

/**
 * Send a push notification to all subscriptions for a given user.
 * Returns true if at least one push was sent successfully.
 * Cleans up expired/invalid subscriptions automatically.
 */
export async function sendPushToUser(
	db: AutopilotDb,
	companyRoot: string,
	userId: string,
	payload: PushPayload,
): Promise<boolean> {
	const keys = await getVapidKeys(companyRoot)
	if (!keys) return false

	// Configure web-push with VAPID details
	const vapidSubject = 'mailto:autopilot@questpie.com'

	const subscriptions = await db
		.select()
		.from(pushSubscriptions)
		.where(eq(pushSubscriptions.user_id, userId))

	if (subscriptions.length === 0) return false

	const payloadStr = JSON.stringify(payload)
	let anySent = false

	for (const sub of subscriptions) {
		const pushSubscription = {
			endpoint: sub.endpoint,
			keys: {
				p256dh: sub.keys_p256dh,
				auth: sub.keys_auth,
			},
		}

		try {
			await webpush.sendNotification(pushSubscription, payloadStr, {
				vapidDetails: {
					subject: vapidSubject,
					publicKey: keys.publicKey,
					privateKey: keys.privateKey,
				},
				TTL: 60 * 60, // 1 hour
			})
			anySent = true
		} catch (err) {
			const statusCode = (err as { statusCode?: number }).statusCode
			if (statusCode === 404 || statusCode === 410) {
				// Subscription expired — clean up
				console.log(`[push] removing expired subscription: ${sub.id}`)
				await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, sub.id))
			} else {
				console.error(`[push] send failed for ${sub.id}:`, err instanceof Error ? err.message : err)
			}
		}
	}

	return anySent
}
