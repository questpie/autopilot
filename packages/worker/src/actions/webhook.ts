/**
 * Action executor — runs post-run side effects (webhooks, scripts).
 * Secret refs are resolved locally on the worker.
 */

import type {
	ExternalAction,
	RunArtifact,
	ScriptAction,
	ScriptRefAction,
	SecretRef,
	StandaloneScript,
	WebhookAction,
	WorkerEvent,
} from '@questpie/autopilot-spec'
import { resolveSecretRefs } from '../secrets'
import { executeScriptAction, type ScriptActionContext, type ScriptActionResult } from './script'

// ─── Action result (merged across all actions) ─────────────────────────────

export interface ActionsMergedResult {
	/** Artifacts to append to the run completion. */
	artifacts: RunArtifact[]
	/** Outputs to merge into the run completion. */
	outputs: Record<string, string>
	/** Last non-empty script summary, if any. */
	summary?: string
}

// ─── Execute all actions ───────────────────────────────────────────────────

export interface ExecuteActionsOptions {
	actions: ExternalAction[]
	emitEvent: (event: WorkerEvent) => void
	secretRefs?: SecretRef[]
	preResolvedSharedSecrets?: Record<string, string>
	/** Required for script actions. Absolute path to run workspace. */
	workspacePath?: string
	/** Artifacts from the just-completed run (for script input_artifacts). */
	runArtifacts?: RunArtifact[]
	/** Pre-resolved standalone script definitions for script_ref actions. */
	resolvedScripts?: StandaloneScript[]
}

/**
 * Execute a list of external actions (post-run side effects).
 * Returns merged result from all script actions.
 */
export async function executeActions(opts: ExecuteActionsOptions): Promise<ActionsMergedResult> {
	const { actions, emitEvent, workspacePath, runArtifacts = [], resolvedScripts = [] } = opts
	const { resolved: secrets, errors } = resolveSecretRefs(
		opts.secretRefs ?? [],
		opts.preResolvedSharedSecrets,
	)

	for (const err of errors) {
		emitEvent({ type: 'external_action', summary: `Secret resolution warning: ${err}` })
	}

	const merged: ActionsMergedResult = { artifacts: [], outputs: {} }

	for (const action of actions) {
		switch (action.kind) {
			case 'webhook':
				await runWebhook(action, secrets, emitEvent)
				break

			case 'script': {
				if (!workspacePath) {
					throw new Error(
						`Script action "${action.script}" requires a workspace but none is available`,
					)
				}
				const ctx: ScriptActionContext = { workspacePath, secrets, runArtifacts }
				try {
					const result = await executeScriptAction(action, ctx, emitEvent)
					mergeScriptResult(merged, result, action.script)
					emitEvent({
						type: 'external_action',
						summary: `Script ${action.runner} ${action.script}: success`,
						metadata: {
							action_kind: 'script',
							script: action.script,
							runner: action.runner,
							artifacts_count: result.artifacts.length,
							outputs_count: Object.keys(result.outputs).length,
						},
					})
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err)
					throw new Error(`Script action "${action.script}" failed: ${msg}`)
				}
				break
			}

			case 'script_ref': {
				if (!workspacePath) {
					throw new Error(
						`Script ref action "${action.script_id}" requires a workspace but none is available`,
					)
				}
				const scriptDef = resolvedScripts.find((s) => s.id === action.script_id)
				if (!scriptDef) {
					throw new Error(`Script ref "${action.script_id}" not found in resolved_scripts`)
				}
				const mergedAction = resolveScriptRef(action, scriptDef)
				const ctx: ScriptActionContext = { workspacePath, secrets, runArtifacts }
				try {
					const result = await executeScriptAction(mergedAction, ctx, emitEvent)
					mergeScriptResult(merged, result, scriptDef.entry_point)
					emitEvent({
						type: 'external_action',
						summary: `Script ref ${action.script_id}: success`,
						metadata: {
							action_kind: 'script_ref',
							script_id: action.script_id,
							runner: scriptDef.runner,
							artifacts_count: result.artifacts.length,
							outputs_count: Object.keys(result.outputs).length,
						},
					})
				} catch (err) {
					const msg = err instanceof Error ? err.message : String(err)
					throw new Error(`Script ref action "${action.script_id}" failed: ${msg}`)
				}
				break
			}

			default:
				emitEvent({
					type: 'external_action',
					summary: `Skipped unknown action kind: ${(action as { kind: string }).kind}`,
				})
		}
	}

	return merged
}

function resolveScriptRef(ref: ScriptRefAction, script: StandaloneScript): ScriptAction {
	return {
		kind: 'script',
		script: script.entry_point,
		runner: script.runner,
		args: ref.args.length > 0 ? ref.args : [],
		timeout_ms: ref.timeout_ms ?? script.sandbox?.timeout_ms,
		env: { ...script.env, ...ref.env },
		secret_env: { ...script.secret_env, ...ref.secret_env },
		input_artifacts: ref.input_artifacts,
	}
}

// ─── Output merge with collision detection ─────────────────────────────────

/**
 * Merge script action outputs into runtime outputs, hard-failing on collision.
 * Used by the worker after both the adapter and post-run actions have completed.
 */
export function mergeOutputs(
	runtimeOutputs: Record<string, string>,
	scriptOutputs: Record<string, string>,
): Record<string, string> {
	for (const key of Object.keys(scriptOutputs)) {
		if (key in runtimeOutputs) {
			throw new Error(
				`Output key collision: script action set "${key}" which already exists in runtime outputs`,
			)
		}
	}
	return { ...runtimeOutputs, ...scriptOutputs }
}

// ─── Merge logic (across script actions) ───────────────────────────────────

function mergeScriptResult(
	merged: ActionsMergedResult,
	result: ScriptActionResult,
	scriptName: string,
): void {
	// Artifacts: append
	merged.artifacts.push(...result.artifacts)

	// Summary: last non-empty wins
	if (result.summary) {
		merged.summary = result.summary
	}

	// Outputs: collision = hard failure
	for (const [key, value] of Object.entries(result.outputs)) {
		if (key in merged.outputs) {
			throw new Error(
				`Output key collision: "${key}" already set by a previous action (script: ${scriptName})`,
			)
		}
		merged.outputs[key] = value
	}
}

// ─── Webhook execution ─────────────────────────────────────────────────────

async function runWebhook(
	action: WebhookAction,
	secrets: Map<string, string>,
	emitEvent: (event: WorkerEvent) => void,
): Promise<void> {
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

async function executeWebhook(
	action: WebhookAction,
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
