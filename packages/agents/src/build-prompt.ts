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
	const sections: string[] = [template(context)]

	// Language instructions (additive — only for non-English)
	if (context.language && context.language !== 'en') {
		const langLines: string[] = [
			`LANGUAGE: The primary communication language for this company is ${context.language}. Respond in ${context.language} when communicating with humans. Use English for code, technical terms, and tool outputs.`,
		]

		if (context.languages && context.languages.length > 1) {
			langLines.push(
				`The company operates in multiple languages: ${context.languages.join(', ')}. Default to ${context.language} for human communication.`,
			)
		}

		sections.push(langLines.join('\n'))
	}

	// Timezone instruction
	if (context.timezone) {
		sections.push(`TIMEZONE: The company operates in the ${context.timezone} timezone.`)
	}

	return sections.join('\n\n')
}
