import { z } from 'zod'

export const MemoryDecisionSchema = z.object({
	date: z.string(),
	decision: z.string(),
	reason: z.string(),
	task: z.string().optional(),
})

export const MemoryMistakeSchema = z.object({
	date: z.string(),
	what: z.string(),
	fix: z.string(),
})

export const MemoryFactsSchema = z.record(z.string(), z.array(z.string()))

export const AgentMemorySchema = z.object({
	bio: z.string().optional().describe('1-2 sentence self-description of what this agent does and is currently focused on'),
	facts: MemoryFactsSchema.default({}),
	decisions: z.array(MemoryDecisionSchema).default([]),
	patterns: z.array(z.string()).default([]),
	mistakes: z.array(MemoryMistakeSchema).default([]),
})
