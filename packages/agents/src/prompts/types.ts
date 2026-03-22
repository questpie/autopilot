import type { AGENT_ROLES } from '@questpie/autopilot-spec'

export type AgentRole = (typeof AGENT_ROLES)[number]

export interface PromptContext {
	/** Company name, e.g. "QUESTPIE" */
	companyName: string
	/** Formatted team roster string listing all agents and their roles */
	teamRoster: string
	/** Summary of currently active tasks relevant to this agent */
	currentTasksSummary: string
	/** Additional context injected by the orchestrator */
	additionalContext?: string
}

export type PromptTemplate = (context: PromptContext) => string
