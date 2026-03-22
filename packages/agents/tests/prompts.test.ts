import { describe, expect, it } from 'bun:test'
import { AGENT_ROLES } from '@questpie/autopilot-spec'
import {
	buildSystemPrompt,
	ceoPrompt,
	strategistPrompt,
	plannerPrompt,
	developerPrompt,
	reviewerPrompt,
	devopsPrompt,
	marketingPrompt,
	designPrompt,
} from '../src/index'
import type { AgentRole, PromptContext } from '../src/index'

const TEST_CONTEXT: PromptContext = {
	companyName: 'TestCorp',
	teamRoster: '- CEO (meta)\n- Ivan (strategist)\n- Adam (planner)\n- Peter (developer)\n- Marek (reviewer)\n- Ops (devops)\n- Marketer (marketing)\n- Designer (design)',
	currentTasksSummary: 'No active tasks.',
}

const ROLE_PROMPT_MAP: Record<AgentRole, (ctx: PromptContext) => string> = {
	meta: ceoPrompt,
	strategist: strategistPrompt,
	planner: plannerPrompt,
	developer: developerPrompt,
	reviewer: reviewerPrompt,
	devops: devopsPrompt,
	marketing: marketingPrompt,
	design: designPrompt,
}

const ROLE_NAMES: Record<AgentRole, string> = {
	meta: 'CEO Agent',
	strategist: 'Ivan',
	planner: 'Adam',
	developer: 'Peter',
	reviewer: 'Marek',
	devops: 'Ops',
	marketing: 'Marketer',
	design: 'Designer',
}

const ROLE_DESCRIPTIONS: Record<AgentRole, string> = {
	meta: 'meta-orchestrator',
	strategist: 'Business Strategist',
	planner: 'Implementation Planner',
	developer: 'Senior Fullstack Developer',
	reviewer: 'Code Reviewer',
	devops: 'DevOps Engineer',
	marketing: 'Marketing Specialist',
	design: 'UI/UX Designer',
}

describe('Agent prompt templates', () => {
	for (const role of AGENT_ROLES) {
		describe(`${role} prompt`, () => {
			it('returns a non-empty string', () => {
				const prompt = ROLE_PROMPT_MAP[role](TEST_CONTEXT)
				expect(typeof prompt).toBe('string')
				expect(prompt.length).toBeGreaterThan(100)
			})

			it('contains the agent name', () => {
				const prompt = ROLE_PROMPT_MAP[role](TEST_CONTEXT)
				expect(prompt).toContain(ROLE_NAMES[role])
			})

			it('contains the role description', () => {
				const prompt = ROLE_PROMPT_MAP[role](TEST_CONTEXT)
				expect(prompt).toContain(ROLE_DESCRIPTIONS[role])
			})

			it('contains the company name from context', () => {
				const prompt = ROLE_PROMPT_MAP[role](TEST_CONTEXT)
				expect(prompt).toContain('TestCorp')
			})

			it('contains the team roster from context', () => {
				const prompt = ROLE_PROMPT_MAP[role](TEST_CONTEXT)
				expect(prompt).toContain('Ivan (strategist)')
			})

			it('mentions primitives or tool calls', () => {
				const prompt = ROLE_PROMPT_MAP[role](TEST_CONTEXT)
				const hasPrimitives = prompt.includes('primitives') || prompt.includes('tool call')
				expect(hasPrimitives).toBe(true)
			})

			it('mentions memory isolation', () => {
				const prompt = ROLE_PROMPT_MAP[role](TEST_CONTEXT)
				expect(prompt).toContain('Memory Isolation')
				expect(prompt).toContain('memory.yaml')
				expect(prompt).toContain('cannot access other agents')
			})

			it('defines filesystem scope', () => {
				const prompt = ROLE_PROMPT_MAP[role](TEST_CONTEXT)
				expect(prompt).toContain('Filesystem Scope')
			})

			it('includes rules section', () => {
				const prompt = ROLE_PROMPT_MAP[role](TEST_CONTEXT)
				expect(prompt).toContain('## Rules')
			})
		})
	}
})

describe('buildSystemPrompt', () => {
	for (const role of AGENT_ROLES) {
		it(`builds prompt for ${role} role`, () => {
			const prompt = buildSystemPrompt(role, TEST_CONTEXT)
			expect(typeof prompt).toBe('string')
			expect(prompt.length).toBeGreaterThan(100)
			expect(prompt).toContain('TestCorp')
		})
	}

	it('produces same output as direct template call', () => {
		for (const role of AGENT_ROLES) {
			const direct = ROLE_PROMPT_MAP[role](TEST_CONTEXT)
			const built = buildSystemPrompt(role, TEST_CONTEXT)
			expect(built).toBe(direct)
		}
	})

	it('throws for invalid role', () => {
		expect(() => {
			buildSystemPrompt('nonexistent' as AgentRole, TEST_CONTEXT)
		}).toThrow('Unknown agent role')
	})

	it('injects different company names correctly', () => {
		const ctx1 = { ...TEST_CONTEXT, companyName: 'QUESTPIE' }
		const ctx2 = { ...TEST_CONTEXT, companyName: 'AcmeCo' }

		const prompt1 = buildSystemPrompt('meta', ctx1)
		const prompt2 = buildSystemPrompt('meta', ctx2)

		expect(prompt1).toContain('QUESTPIE')
		expect(prompt1).not.toContain('AcmeCo')
		expect(prompt2).toContain('AcmeCo')
		expect(prompt2).not.toContain('QUESTPIE')
	})
})
