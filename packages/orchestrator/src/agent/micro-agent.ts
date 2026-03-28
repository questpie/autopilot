import { z } from 'zod'
import { createHash } from 'node:crypto'
import { logger } from '../logger'
import { loadCompany } from '../fs/company'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MicroAgentConfig<T = unknown> {
	id: string
	description: string
	systemPrompt: string
	outputSchema: z.ZodType<T>
	maxTokens: number
}

type ProviderChoice = 'auto' | 'gemini' | 'haiku' | 'none'

// ---------------------------------------------------------------------------
// Cache (5-minute TTL)
// ---------------------------------------------------------------------------

const CACHE_TTL_MS = 5 * 60 * 1000

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
// Provider implementations
// ---------------------------------------------------------------------------

async function classifyWithGemini<T>(
	config: MicroAgentConfig<T>,
	input: string,
): Promise<T | null> {
	const apiKey = process.env.GEMINI_API_KEY
	if (!apiKey) return null

	const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`

	const response = await fetch(url, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			contents: [
				{
					parts: [{ text: `${config.systemPrompt}\n\nInput:\n${input}\n\nRespond with ONLY valid JSON, no markdown fences.` }],
				},
			],
			generationConfig: {
				maxOutputTokens: config.maxTokens,
				temperature: 0,
			},
		}),
	})

	if (!response.ok) {
		logger.warn('micro-agent', `Gemini HTTP ${response.status}`, {
			configId: config.id,
			status: response.status,
		})
		return null
	}

	const data = (await response.json()) as {
		candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>
	}

	const text = data.candidates?.[0]?.content?.parts?.[0]?.text
	if (!text) return null

	return parseAndValidate(config, text)
}

async function classifyWithHaiku<T>(
	config: MicroAgentConfig<T>,
	input: string,
): Promise<T | null> {
	const apiKey = process.env.ANTHROPIC_API_KEY
	if (!apiKey) return null

	const { default: Anthropic } = await import('@anthropic-ai/sdk')
	const client = new Anthropic()

	const response = await client.messages.create({
		model: 'claude-haiku-4-5-20250514',
		max_tokens: config.maxTokens,
		messages: [
			{
				role: 'user',
				content: `${config.systemPrompt}\n\nInput:\n${input}\n\nRespond with ONLY valid JSON, no markdown fences.`,
			},
		],
	})

	const textBlock = response.content.find((b) => b.type === 'text')
	if (!textBlock || textBlock.type !== 'text') return null

	return parseAndValidate(config, textBlock.text)
}

// ---------------------------------------------------------------------------
// JSON parsing + Zod validation
// ---------------------------------------------------------------------------

function parseAndValidate<T>(config: MicroAgentConfig<T>, raw: string): T | null {
	try {
		// Strip markdown fences if the model included them anyway
		const cleaned = raw.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim()
		const parsed = JSON.parse(cleaned)
		const result = config.outputSchema.safeParse(parsed)
		if (!result.success) {
			logger.warn('micro-agent', 'schema validation failed', {
				configId: config.id,
				errors: result.error.issues.map((i) => i.message),
			})
			return null
		}
		return result.data
	} catch (err) {
		logger.warn('micro-agent', 'JSON parse failed', {
			configId: config.id,
			error: err instanceof Error ? err.message : String(err),
		})
		return null
	}
}

// ---------------------------------------------------------------------------
// MicroAgentRunner
// ---------------------------------------------------------------------------

export class MicroAgentRunner {
	private providerChoice: ProviderChoice

	constructor(providerChoice: ProviderChoice = 'auto') {
		this.providerChoice = providerChoice
	}

	/**
	 * Classify an input using a lightweight LLM. Returns `T` on success, `null`
	 * on any error. Never throws.
	 */
	async classify<T>(config: MicroAgentConfig<T>, input: string): Promise<T | null> {
		try {
			if (this.providerChoice === 'none') return null

			// Check cache
			const key = cacheKey(config.id, input)
			const cached = cacheGet<T>(key)
			if (cached !== undefined) {
				logger.debug('micro-agent', 'cache hit', { configId: config.id })
				return cached
			}

			const result = await this.runProviders(config, input)

			if (result !== null) {
				cacheSet(key, result)
			}

			return result
		} catch (err) {
			logger.error('micro-agent', 'classify failed', {
				configId: config.id,
				error: err instanceof Error ? err.message : String(err),
			})
			return null
		}
	}

	private async runProviders<T>(config: MicroAgentConfig<T>, input: string): Promise<T | null> {
		switch (this.providerChoice) {
			case 'gemini':
				return classifyWithGemini(config, input)
			case 'haiku':
				return classifyWithHaiku(config, input)
			case 'auto':
			default: {
				// Gemini Flash first, then Haiku fallback
				const geminiResult = await classifyWithGemini(config, input)
				if (geminiResult !== null) return geminiResult

				logger.debug('micro-agent', 'Gemini unavailable, falling back to Haiku', {
					configId: config.id,
				})
				return classifyWithHaiku(config, input)
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Singleton factory
// ---------------------------------------------------------------------------

const runners = new Map<string, MicroAgentRunner>()

export async function getMicroAgent(companyRoot: string): Promise<MicroAgentRunner> {
	const existing = runners.get(companyRoot)
	if (existing) return existing

	let providerChoice: ProviderChoice = 'auto'
	try {
		const company = await loadCompany(companyRoot)
		const raw = (company.settings as Record<string, unknown>)?.micro_agents as
			| { provider?: string }
			| undefined
		if (raw?.provider && ['auto', 'gemini', 'haiku', 'none'].includes(raw.provider)) {
			providerChoice = raw.provider as ProviderChoice
		}
	} catch {
		// No company config or missing field — default to auto
	}

	const runner = new MicroAgentRunner(providerChoice)
	runners.set(companyRoot, runner)
	logger.info('micro-agent', `initialized (provider=${providerChoice})`)
	return runner
}

// ---------------------------------------------------------------------------
// Pre-defined configs
// ---------------------------------------------------------------------------

export const NOTIFICATION_CLASSIFIER: MicroAgentConfig<{
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

export const MESSAGE_ROUTER: MicroAgentConfig<{
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

export const ESCALATION_CLASSIFIER: MicroAgentConfig<{
	should_escalate: boolean
	reason: string
	escalate_to: 'human' | 'meta' | 'none'
	urgency: 'immediate' | 'soon' | 'normal'
}> = {
	id: 'escalation-classifier',
	description: 'Determines if an agent situation requires escalation to a human or meta-agent',
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
