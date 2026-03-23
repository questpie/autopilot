import { describe, expect, it } from 'bun:test'
import { buildSystemPrompt } from './build-prompt'
import type { PromptContext } from './prompts/types'

const baseContext: PromptContext = {
	companyName: 'TestCo',
	teamRoster: '- Alice (a1): developer — dev',
	currentTasksSummary: 'No active tasks.',
}

describe('buildSystemPrompt — language instructions', () => {
	it('does not add language instruction when language is undefined', () => {
		const result = buildSystemPrompt('developer', baseContext)
		expect(result).not.toContain('LANGUAGE:')
	})

	it('does not add language instruction when language is "en"', () => {
		const result = buildSystemPrompt('developer', {
			...baseContext,
			language: 'en',
		})
		expect(result).not.toContain('LANGUAGE:')
	})

	it('adds language instruction for non-English language', () => {
		const result = buildSystemPrompt('developer', {
			...baseContext,
			language: 'sk',
		})
		expect(result).toContain('LANGUAGE:')
		expect(result).toContain('primary communication language for this company is sk')
		expect(result).toContain('Respond in sk when communicating with humans')
	})

	it('adds multi-language note when languages has multiple entries', () => {
		const result = buildSystemPrompt('developer', {
			...baseContext,
			language: 'sk',
			languages: ['sk', 'cs', 'en'],
		})
		expect(result).toContain('multiple languages: sk, cs, en')
		expect(result).toContain('Default to sk for human communication')
	})

	it('does not add multi-language note when languages has one entry', () => {
		const result = buildSystemPrompt('developer', {
			...baseContext,
			language: 'sk',
			languages: ['sk'],
		})
		expect(result).toContain('LANGUAGE:')
		expect(result).not.toContain('multiple languages')
	})

	it('adds timezone instruction when timezone is provided', () => {
		const result = buildSystemPrompt('developer', {
			...baseContext,
			timezone: 'Europe/Bratislava',
		})
		expect(result).toContain('TIMEZONE:')
		expect(result).toContain('Europe/Bratislava')
	})

	it('language and timezone are additive — original prompt is preserved', () => {
		const baseResult = buildSystemPrompt('developer', baseContext)
		const extendedResult = buildSystemPrompt('developer', {
			...baseContext,
			language: 'sk',
			timezone: 'Europe/Bratislava',
		})
		expect(extendedResult).toContain(baseResult)
	})
})
