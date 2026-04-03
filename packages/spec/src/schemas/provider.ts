import { z } from 'zod'
import { SecretRefSchema } from './secret-ref'

/** Provider kind — determines what operations a provider supports. */
export const ProviderKindSchema = z.enum([
	'notification_channel',
	'intent_channel',
	'conversation_channel',
])

/** A capability a provider declares (e.g. "notify.send"). */
export const ProviderCapabilitySchema = z.object({
	op: z.string().min(1),
})

/** Event filter — which orchestrator events this provider cares about. */
export const ProviderEventFilterSchema = z.object({
	/** Event types to match (e.g. ["run_completed", "task_changed"]). */
	types: z.array(z.string()).min(1),
	/** Optional status filter (e.g. ["failed", "blocked"]). */
	statuses: z.array(z.string()).optional(),
})

/**
 * Provider instance — authored config under `.autopilot/providers/*.yaml`.
 *
 * Providers are the extension point for external channels (notifications,
 * intent intake, conversations). Each provider points to a Bun handler
 * script that does the edge logic.
 */
export const ProviderSchema = z.object({
	/** Unique provider instance ID (e.g. "slack-ops", "webhook-deploys"). */
	id: z.string().regex(/^[a-z0-9-]+$/),
	/** Human-readable name. */
	name: z.string(),
	/** Provider kind. */
	kind: ProviderKindSchema,
	/** Path to the Bun handler script, relative to .autopilot/ directory. */
	handler: z.string().min(1),
	/** Operations this provider supports. */
	capabilities: z.array(ProviderCapabilitySchema).min(1),
	/** Event filters — which orchestrator events trigger this provider. */
	events: z.array(ProviderEventFilterSchema).default([]),
	/** Static config passed to the handler (non-secret). */
	config: z.record(z.string()).default({}),
	/** Secret references resolved on the orchestrator host for this provider. */
	secret_refs: z.array(SecretRefSchema).default([]),
	/** Optional description. */
	description: z.string().default(''),
})

// ─── Handler Contract ────────────────────────────────────────────────────────

/** The typed envelope sent to a handler on stdin. */
export const HandlerEnvelopeSchema = z.object({
	/** Operation name (e.g. "notify.send"). */
	op: z.string(),
	/** Provider instance ID. */
	provider_id: z.string(),
	/** Provider kind. */
	provider_kind: ProviderKindSchema,
	/** Static config from provider YAML. */
	config: z.record(z.string()),
	/** Resolved secret values (name -> value). */
	secrets: z.record(z.string()),
	/** Operation-specific payload. */
	payload: z.record(z.unknown()),
})

/** The typed result a handler returns on stdout. */
export const HandlerResultSchema = z.object({
	/** Whether the operation succeeded. */
	ok: z.boolean(),
	/** External ID returned by the provider (e.g. Slack message ts). */
	external_id: z.string().optional(),
	/** Debug metadata from the handler. */
	metadata: z.record(z.unknown()).optional(),
	/** Error message if ok=false. */
	error: z.string().optional(),
})

// ─── Notification Payload ────────────────────────────────────────────────────

/** Normalized notification payload for notify.send operations. */
export const NotificationPayloadSchema = z.object({
	/** What triggered the notification. */
	event_type: z.string(),
	/** Severity level. */
	severity: z.enum(['info', 'warning', 'error']),
	/** Short title. */
	title: z.string(),
	/** Longer summary. */
	summary: z.string(),
	/** Task ID if applicable. */
	task_id: z.string().optional(),
	/** Run ID if applicable. */
	run_id: z.string().optional(),
	/** Agent that ran. */
	agent_id: z.string().optional(),
	/** Preview URL if available. */
	preview_url: z.string().optional(),
	/** Orchestrator base URL for building links. */
	orchestrator_url: z.string().optional(),
})
