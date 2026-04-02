/**
 * Webhook action executor — runs outbound HTTP requests as post-run side effects.
 * Secret refs are resolved locally on the worker.
 */

import type { ExternalAction, WorkerEvent, SecretRef } from '@questpie/autopilot-spec'
import { resolveSecretRefs } from '../secrets'

/**
 * Execute a list of external actions (post-run side effects).
 * Each action result is reported as an 'external_action' event.
 */
export async function executeActions(
	actions: ExternalAction[],
	emitEvent: (event: WorkerEvent) => void,
	secretRefs?: SecretRef[],
): Promise<void> {
	const { resolved: secrets, errors } = resolveSecretRefs(secretRefs ?? [])

	for (const err of errors) {
		emitEvent({ type: 'external_action', summary: `Secret resolution warning: ${err}` })
	}

	for (const action of actions) {
		if (action.kind !== 'webhook') {
			emitEvent({ type: 'external_action', summary: `Skipped unknown action kind: ${(action as { kind: string }).kind}` })
			continue
		}

		try {
			const result = await executeWebhook(action, secrets)
			emitEvent({
				type: 'external_action',
				summary: `Webhook ${action.method} ${action.url_ref}: ${result.status}`,
				metadata: {
					action_kind: 'webhook',
					url_ref: action.url_ref,
					method: action.method,
					status: result.status,
					idempotency_key: action.idempotency_key,
				},
			})
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err)
			emitEvent({
				type: 'external_action',
				summary: `Webhook ${action.method} ${action.url_ref} failed: ${msg}`,
				metadata: {
					action_kind: 'webhook',
					url_ref: action.url_ref,
					method: action.method,
					error: msg,
					idempotency_key: action.idempotency_key,
				},
			})
		}
	}
}

async function executeWebhook(
	action: ExternalAction,
	secrets: Map<string, string>,
): Promise<{ status: number; body: string }> {
	const url = secrets.get(action.url_ref)
	if (!url) {
		throw new Error(`Secret ref "${action.url_ref}" not resolved — cannot determine webhook URL`)
	}

	const headers: Record<string, string> = { 'Content-Type': 'application/json' }

	if (action.headers_ref) {
		const headersJson = secrets.get(action.headers_ref)
		if (headersJson) {
			try {
				Object.assign(headers, JSON.parse(headersJson))
			} catch {
				throw new Error(`Headers ref "${action.headers_ref}" is not valid JSON`)
			}
		}
	}

	if (action.idempotency_key) {
		headers['Idempotency-Key'] = action.idempotency_key
	}

	const res = await fetch(url, {
		method: action.method,
		headers,
		body: action.body ?? undefined,
	})

	const body = await res.text()
	return { status: res.status, body }
}
