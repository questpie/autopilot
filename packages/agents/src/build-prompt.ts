import { AGENT_ROLES } from '@questpie/autopilot-spec'
import {
	ceoPrompt,
	strategistPrompt,
	plannerPrompt,
	developerPrompt,
	reviewerPrompt,
	devopsPrompt,
	marketingPrompt,
	designPrompt,
} from './prompts'
import type { AgentRole, PromptContext, PromptTemplate } from './prompts/types'

const PROMPT_MAP: Record<AgentRole, PromptTemplate> = {
	meta: ceoPrompt,
	strategist: strategistPrompt,
	planner: plannerPrompt,
	developer: developerPrompt,
	reviewer: reviewerPrompt,
	devops: devopsPrompt,
	marketing: marketingPrompt,
	design: designPrompt,
} as const

/**
 * Build a complete system prompt for the given agent role.
 *
 * @param role - One of the 8 AGENT_ROLES from @questpie/autopilot-spec
 * @param context - Company name, team roster, and task summary to inject
 * @returns The assembled system prompt string
 * @throws Error if the role is not a valid agent role
 */
export function buildSystemPrompt(role: AgentRole, context: PromptContext): string {
	if (!AGENT_ROLES.includes(role)) {
		throw new Error(`Unknown agent role: ${role}. Valid roles: ${AGENT_ROLES.join(', ')}`)
	}

	const template = PROMPT_MAP[role]
	return template(context)
}
