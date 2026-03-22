import { z } from 'zod'
import { GATE_TYPES } from '../constants'

export const ApprovalGateSchema = z.object({
	gate: z.enum(GATE_TYPES),
	description: z.string().default(''),
	required_roles: z.array(z.string()).default([]),
	human_required: z.boolean().default(true),
	auto_approve_after: z.string().optional(),
})

export const ApprovalGatesFileSchema = z.object({
	gates: z.array(ApprovalGateSchema),
})
