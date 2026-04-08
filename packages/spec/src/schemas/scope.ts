import { z } from 'zod'
import { CompanyOwnerSchema } from './company'
import { PackDependencySchema } from './pack'
import { RetryPolicySchema } from './workflow'

/**
 * Configuration for a named task queue controlling concurrency.
 */
export const QueueConfigSchema = z.object({
	/** Maximum number of tasks in this queue that can have active (running/claimed) runs at once. */
	max_concurrent: z.number().int().positive().default(1),
	/** Ordering for picking the next task from the queue. */
	priority_order: z.enum(['fifo', 'priority']).default('fifo'),
})

export type QueueConfig = z.infer<typeof QueueConfigSchema>

/**
 * Configuration for a conversation command (e.g. /deploy, /create).
 */
export const ConversationCommandConfigSchema = z.object({
	action: z.enum(['task.create']),
	workflow_id: z.string().optional(),
	type: z.string().default('task'),
	title_template: z.string().default('{{args}}'),
	description_template: z.string().default('{{args}}'),
	instructions: z.string().optional(),
	capability_profiles: z.array(z.string()).default([]),
})

/**
 * Defaults that can be set at company or project scope.
 * Project values override company values when set.
 */
export const ScopeDefaultsSchema = z.object({
	/** Default runtime for auto-created runs. */
	runtime: z.string().optional(),
	/** Default workflow ID for new tasks. */
	workflow: z.string().optional(),
	/** Default agent ID for new task ownership. */
	task_assignee: z.string().optional(),
	/** Default retry policy for workflow steps that don't declare their own. */
	retry_policy: RetryPolicySchema.optional(),
})

/**
 * Schema for `.autopilot/company.yaml` — company scope marker and config.
 */
export const CompanyScopeSchema = z.object({
	name: z.string().min(1),
	slug: z.string().regex(/^[a-z0-9-]+$/),
	description: z.string().default(''),
	timezone: z.string().default('UTC'),
	language: z.string().default('en'),
	owner: CompanyOwnerSchema.default({}),
	defaults: ScopeDefaultsSchema.default({}),
	/** Desired pack dependencies — resolved by `autopilot sync`. */
	packs: z.array(PackDependencySchema).default([]),
	/** Context hints — key → relative path from company root. Agents receive these as navigation aids. */
	context_hints: z.record(z.string(), z.string()).default({}),
	/** Named task queues for concurrency control. Key = queue name. */
	queues: z.record(z.string(), QueueConfigSchema).default({}),
	/** Context file names (from .autopilot/context/) always injected into every run prompt. */
	global_context: z.array(z.string()).default([]),
	/** Conversation command definitions — key = command name (e.g. "deploy"). */
	conversation_commands: z.record(z.string(), ConversationCommandConfigSchema).default({}),
})

/**
 * Schema for `.autopilot/project.yaml` — project scope marker and overrides.
 */
export const ProjectScopeSchema = z.object({
	name: z.string().min(1),
	description: z.string().default(''),
	defaults: ScopeDefaultsSchema.default({}),
})
