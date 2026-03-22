import { describe, expect, it } from 'bun:test'
import { header, table, badge, dim, success, error, warning } from '../src/utils/format'

describe('format utilities', () => {
	it('header returns a string with bold formatting', () => {
		const result = header('Test Header')
		expect(typeof result).toBe('string')
		expect(result).toContain('Test Header')
		expect(result).toContain('\x1b[1m')
	})

	it('table formats rows into aligned columns', () => {
		const result = table([
			['Name', 'Role'],
			['Alice', 'Developer'],
			['Bob', 'Designer'],
		])
		expect(typeof result).toBe('string')
		expect(result).toContain('Alice')
		expect(result).toContain('Developer')
	})

	it('table handles empty input', () => {
		expect(table([])).toBe('')
	})

	it('badge wraps text in brackets with color', () => {
		const result = badge('info')
		expect(result).toContain('[info]')
	})

	it('badge accepts a color parameter', () => {
		const result = badge('ok', 'green')
		expect(result).toContain('[ok]')
		expect(result).toContain('\x1b[32m')
	})

	it('dim returns dimmed text', () => {
		const result = dim('faded')
		expect(result).toContain('faded')
		expect(result).toContain('\x1b[2m')
	})

	it('success returns green text', () => {
		const result = success('done')
		expect(result).toContain('done')
		expect(result).toContain('\x1b[32m')
	})

	it('error returns red text', () => {
		const result = error('fail')
		expect(result).toContain('fail')
		expect(result).toContain('\x1b[31m')
	})

	it('warning returns yellow text', () => {
		const result = warning('warn')
		expect(result).toContain('warn')
		expect(result).toContain('\x1b[33m')
	})
})
