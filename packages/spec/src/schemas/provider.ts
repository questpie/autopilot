import { z } from 'zod'
import { SecretRefSchema } from './secret-ref'

/** JSON-safe value — anything serializable to JSON. */
const JsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
	z.union([z.string(), z.number(), z.boolean(), z.null(), z.array(JsonValueSchema), z.record(JsonValueSchema)]),
)

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
	/** Path to the Bun handler script, must be under handlers/ (relative to .autopilot/). */
	handler: z.string().min(1).refine(
		(p) => p.startsWith('handlers/') && !p.includes('..'),
		{ message: 'Handler path must start with "handlers/" and must not contain ".."' },
	),
	/** Operations this provider supports. */
	capabilities: z.array(ProviderCapabilitySchema).min(1),
	/** Event filters — which orchestrator events trigger this provider. */
	events: z.array(ProviderEventFilterSchema).default([]),
	/** Static config passed to the handler (non-secret, JSON-safe). */
	config: z.record(JsonValueSchema).default({}),
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
	/** Static config from provider YAML (JSON-safe). */
	config: z.record(JsonValueSchema),
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

// ─── Intake Contract ─────────────────────────────────────────────────────────

/** Normalized task fields returned by an intake handler. */
export const IntakeTaskInputSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	type: z.string().min(1),
	priority: z.string().optional(),
	assigned_to: z.string().optional(),
	workflow_id: z.string().optional(),
	metadata: z.record(z.unknown()).optional(),
})

/**
 * Result from an intent.ingest handler invocation.
 *
 * Handlers return either:
 * - action "task.create" with normalized task fields → orchestrator creates a real task
 * - action "noop" → payload was not actionable, nothing happens
 */
export const IntakeResultSchema = z.discriminatedUnion('action', [
	z.object({
		action: z.literal('task.create'),
		input: IntakeTaskInputSchema,
	}),
	z.object({
		action: z.literal('noop'),
		reason: z.string().optional(),
	}),
])

// ─── Conversation Contract ───────────────────────────────────────────────────

/**
 * Result from a conversation.ingest handler invocation.
 *
 * Handlers return a normalized action that the orchestrator dispatches
 * through existing task primitives using the conversation binding.
 */
export const ConversationResultSchema = z.discriminatedUnion('action', [
	z.object({
		action: z.literal('task.reply'),
		conversation_id: z.string(),
		thread_id: z.string().optional(),
		message: z.string().min(1),
	}),
	z.object({
		action: z.literal('task.approve'),
		conversation_id: z.string(),
		thread_id: z.string().optional(),
	}),
	z.object({
		action: z.literal('task.reject'),
		conversation_id: z.string(),
		thread_id: z.string().optional(),
		message: z.string().optional(),
	}),
	z.object({
		action: z.literal('noop'),
		reason: z.string().optional(),
	}),
])

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
	/** Direct link to the task API endpoint. */
	task_url: z.string().optional(),
	/** Run ID if applicable. */
	run_id: z.string().optional(),
	/** Direct link to the run API endpoint. */
	run_url: z.string().optional(),
	/** Agent that ran. */
	agent_id: z.string().optional(),
	/** Preview URL if available (durable orchestrator-backed). */
	preview_url: z.string().optional(),
	/** Orchestrator base URL for building links. */
	orchestrator_url: z.string().optional(),
})
