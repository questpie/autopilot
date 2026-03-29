import { z } from 'zod'
import { createHash } from 'node:crypto'
import { chat } from '@tanstack/ai'
import { openRouterText } from '@tanstack/ai-openrouter'
import { logger } from '../logger'
import { loadCompany } from '../fs/company'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ClassifyConfig<T = unknown> {
	id: string
	description: string
	systemPrompt: string
	outputSchema: z.ZodType<T>
	maxTokens: number
}

const DEFAULT_UTILITY_MODEL = 'google/gemma-3-4b-it:free'

// ---------------------------------------------------------------------------
// Cache (5-minute TTL)
// ---------------------------------------------------------------------------

let CACHE_TTL_MS = 5 * 60 * 1000

interface CacheEntry {
	value: unknown
	expiresAt: number
}

const cache = new Map<string, CacheEntry>()

function cacheKey(configId: string, input: string): string {
	const hash = createHash('sha256').update(input).digest('hex').slice(0, 16)
	return `${configId}:${hash}`
}

function cacheGet<T>(key: string): T | undefined {
	const entry = cache.get(key)
	if (!entry) return undefined
	if (Date.now() > entry.expiresAt) {
		cache.delete(key)
		return undefined
	}
	return entry.value as T
}

function cacheSet(key: string, value: unknown): void {
	cache.set(key, { value, expiresAt: Date.now() + CACHE_TTL_MS })
}

// ---------------------------------------------------------------------------
// Core: classify — one function, uses chat() directly
// ---------------------------------------------------------------------------

/**
 * Classify an input using the utility model via TanStack AI chat().
 *
 * Same API as agent sessions — just different model + no tools.
 * Returns `T` on success, `null` on any error. Never throws.
 */
export async function classify<T>(
	config: ClassifyConfig<T>,
	input: string,
	model?: string,
): Promise<T | null> {
	try {
		const key = cacheKey(config.id, input)
		const cached = cacheGet<T>(key)
		if (cached !== undefined) return cached

		if (!process.env.OPENROUTER_API_KEY) {
			return null
		}

		const m = model ?? DEFAULT_UTILITY_MODEL
		const result = await chat({
			adapter: openRouterText(m as Parameters<typeof openRouterText>[0]),
			messages: [{
				role: 'user',
				content: `${config.systemPrompt}\n\nInput:\n${input}\n\nRespond with ONLY valid JSON, no markdown fences.`,
			}],
			stream: false,
		}) as string

		if (!result) return null

		const parsed = parseAndValidate(config, result)
		if (parsed !== null) cacheSet(key, parsed)
		return parsed
	} catch (err) {
		logger.error('classify', `${config.id} failed`, {
			error: err instanceof Error ? err.message : String(err),
		})
		return null
	}
}

/**
 * Get the utility model name from company config.
 * Falls back to DEFAULT_UTILITY_MODEL if not configured.
 */
export async function getUtilityModel(companyRoot: string): Promise<string> {
	try {
		const company = await loadCompany(companyRoot)
		const settings = company.settings as Record<string, unknown>
		if (typeof settings.utility_model === 'string') return settings.utility_model

		const microConfig = settings.micro_agents as { cache_ttl?: number } | undefined
		if (microConfig?.cache_ttl) CACHE_TTL_MS = microConfig.cache_ttl * 1000
	} catch {
		// defaults
	}
	return DEFAULT_UTILITY_MODEL
}

// ---------------------------------------------------------------------------
// JSON parsing + Zod validation
// ---------------------------------------------------------------------------

function parseAndValidate<T>(config: ClassifyConfig<T>, raw: string): T | null {
	try {
		const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
		const parsed = JSON.parse(cleaned)
		const result = config.outputSchema.safeParse(parsed)
		if (!result.success) {
			logger.warn('classify', `${config.id} schema validation failed`, {
				errors: result.error.issues.map((i) => i.message),
			})
			return null
		}
		return result.data
	} catch (err) {
		logger.warn('classify', `${config.id} JSON parse failed`, {
			error: err instanceof Error ? err.message : String(err),
		})
		return null
	}
}

// ---------------------------------------------------------------------------
// Pre-defined configs (same as before, just exported)
// ---------------------------------------------------------------------------

export const NOTIFICATION_CLASSIFIER: ClassifyConfig<{
	priority: 'critical' | 'high' | 'normal' | 'low'
	channels: string[]
	summary: string
}> = {
	id: 'notification-classifier',
	description: 'Classifies events into notification priority and target channels',
	systemPrompt: `You are a notification classifier for a software development team.
Given an event description, determine:
1. priority: "critical" (outage/security), "high" (blocking issue), "normal" (standard update), "low" (informational)
2. channels: array of notification channels to use (e.g. ["slack", "email"], ["slack"], ["email"])
3. summary: a one-line human-readable summary (max 120 chars)

Return JSON: {"priority": "...", "channels": [...], "summary": "..."}`,
	outputSchema: z.object({
		priority: z.enum(['critical', 'high', 'normal', 'low']),
		channels: z.array(z.string()),
		summary: z.string().max(200),
	}),
	maxTokens: 256,
}

export const MESSAGE_ROUTER: ClassifyConfig<{
	agent_id: string
	reason: string
	confidence: number
}> = {
	id: 'message-router',
	description: 'Routes an incoming message to the most appropriate agent',
	systemPrompt: `You are a message router for an AI-powered software team.
Given a message and context about available agents, determine which agent should handle it.
Consider role expertise, recent conversation context, and topic relevance.

Return JSON: {"agent_id": "...", "reason": "brief reason", "confidence": 0.0-1.0}`,
	outputSchema: z.object({
		agent_id: z.string(),
		reason: z.string(),
		confidence: z.number().min(0).max(1),
	}),
	maxTokens: 256,
}

export const ESCALATION_CLASSIFIER: ClassifyConfig<{
	should_escalate: boolean
	reason: string
	escalate_to: 'human' | 'meta' | 'none'
	urgency: 'immediate' | 'soon' | 'normal'
}> = {
	id: 'escalation-classifier',
	description: 'Determines if an agent situation requires escalation',
	systemPrompt: `You are an escalation classifier for an AI development team.
Given a situation description, determine if it needs to be escalated.
Escalate when: agent is stuck, approval is needed, security issue detected, budget exceeded, or repeated failures.

Return JSON: {"should_escalate": true/false, "reason": "...", "escalate_to": "human"|"meta"|"none", "urgency": "immediate"|"soon"|"normal"}`,
	outputSchema: z.object({
		should_escalate: z.boolean(),
		reason: z.string(),
		escalate_to: z.enum(['human', 'meta', 'none']),
		urgency: z.enum(['immediate', 'soon', 'normal']),
	}),
	maxTokens: 256,
}

export const BLOCKED_TASK_CLASSIFIER: ClassifyConfig<{
	action: 'escalate' | 'reassign' | 'wait'
	reason: string
	reassign_to?: string
}> = {
	id: 'blocked-task-classifier',
	description: 'Determines the best action for a blocked task',
	systemPrompt: `You are a blocked-task classifier for an AI development team.
Given a blocked task with details, decide the best course of action:
- "escalate": notify the owner/admins
- "reassign": suggest reassigning (provide reassign_to)
- "wait": the blocker is legitimate and recent

Return JSON: {"action": "escalate"|"reassign"|"wait", "reason": "brief explanation", "reassign_to": "agent_id or omit"}`,
	outputSchema: z.object({
		action: z.enum(['escalate', 'reassign', 'wait']),
		reason: z.string(),
		reassign_to: z.string().optional(),
	}),
	maxTokens: 256,
}
