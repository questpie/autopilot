/**
 * Sensitive tool confirmation policy for the MCP server.
 *
 * Some operator tools mutate or destroy state in ways that should not happen
 * silently when an LLM stitches together a control-plane sequence. For those
 * tools we require an explicit `confirm: true` (or a structured
 * `confirmation_token` string) in the call payload. When confirmation is
 * missing, the tool wrapper returns a structured response telling the caller
 * what to do — it does not invoke the underlying handler and does not emit
 * tool_use telemetry against the orchestrator.
 *
 * The policy is intentionally a flat allowlist of tool names plus a single
 * carve-out for `config_set` against high-blast-radius config types.
 */

import { redactArgs } from './redact'

/** Tools that always require confirmation before execution. */
export const SENSITIVE_TOOLS: ReadonlySet<string> = new Set([
	'config_delete',
	'config_seed_default_skills',
	'project_unregister',
	'task_delete',
	'task_cancel',
	'run_cancel',
	'schedule_delete',
	'schedule_trigger',
	'worker_join_token_create',
	'knowledge_delete',
])

/**
 * `config_set` against these config types requires confirmation. Other config
 * types (e.g. `context`, `agents`, `project`, `scripts`) remain unconfirmed.
 */
export const SENSITIVE_CONFIG_SET_TYPES: ReadonlySet<string> = new Set([
	'company',
	'providers',
	'environments',
	'skills',
	'capabilities',
	'workflows',
])

function reasonFor(name: string, args: Record<string, unknown>): string {
	if (name === 'config_set') {
		const type = typeof args.type === 'string' ? args.type : 'unknown'
		return `Updates a sensitive ${type} config record. Pass \`confirm: true\` to acknowledge.`
	}
	switch (name) {
		case 'config_delete':
			return 'Deletes a config record. Pass `confirm: true` to acknowledge.'
		case 'config_seed_default_skills':
			return 'Seeds default skills into the live config. Pass `confirm: true` to acknowledge.'
		case 'project_unregister':
			return 'Unregisters a project from the orchestrator. Pass `confirm: true` to acknowledge.'
		case 'task_delete':
			return 'Deletes a task and cascades related records. Pass `confirm: true` to acknowledge.'
		case 'task_cancel':
			return 'Cancels an active task and settles workflow state. Pass `confirm: true` to acknowledge.'
		case 'run_cancel':
			return 'Cancels an active run and propagates workflow failure handling. Pass `confirm: true` to acknowledge.'
		case 'schedule_delete':
			return 'Deletes a schedule. Pass `confirm: true` to acknowledge.'
		case 'schedule_trigger':
			return 'Manually triggers a schedule outside its cron window. Pass `confirm: true` to acknowledge.'
		case 'worker_join_token_create':
			return 'Creates a worker join token that grants machine enrollment. Pass `confirm: true` to acknowledge.'
		case 'knowledge_delete':
			return 'Deletes a knowledge document. Pass `confirm: true` to acknowledge.'
		default:
			return 'Sensitive operation. Pass `confirm: true` to acknowledge.'
	}
}

export function isSensitive(name: string, args: Record<string, unknown>): boolean {
	if (SENSITIVE_TOOLS.has(name)) return true
	if (name === 'config_set') {
		const type = args.type
		if (typeof type === 'string' && SENSITIVE_CONFIG_SET_TYPES.has(type)) return true
	}
	return false
}

export function isConfirmed(args: Record<string, unknown>): boolean {
	if (args.confirm === true) return true
	const token = args.confirmation_token
	return typeof token === 'string' && token.length > 0
}

export function confirmationRequiredResponse(
	name: string,
	args: Record<string, unknown>,
): { content: Array<{ type: 'text'; text: string }> } {
	const sensitiveArgs = redactArgs(args)
	const payload = {
		confirmation_required: true,
		tool: name,
		reason: reasonFor(name, args),
		instructions:
			'Re-invoke this tool with `confirm: true` (or a non-empty `confirmation_token`) to execute. Until then the operation has not been performed.',
		sensitive_args: sensitiveArgs,
	}
	return {
		content: [{ type: 'text', text: JSON.stringify(payload, null, 2) }],
	}
}
