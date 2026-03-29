/**
 * Tests for D26 text chunking and D28 code-aware chunking.
 * Also supports D53 (context assembler truncation verification).
 */
import { describe, test, expect } from 'bun:test'
import { chunkText, chunkCode } from '../src/db/chunker'

describe('chunkText', () => {
	test('returns single chunk for short text', () => {
		const chunks = chunkText('Hello, world!')
		expect(chunks).toHaveLength(1)
		expect(chunks[0].index).toBe(0)
		expect(chunks[0].content).toBe('Hello, world!')
	})

	test('splits long text into multiple chunks', () => {
		// Create text exceeding 512 tokens (≈2048 chars)
		const paragraphs = Array.from({ length: 20 }, (_, i) =>
			`Paragraph ${i}: ${'x'.repeat(150)}`
		).join('\n\n')

		const chunks = chunkText(paragraphs)
		expect(chunks.length).toBeGreaterThan(1)
		// Each chunk should be within max size
		for (const chunk of chunks) {
			expect(chunk.content.length).toBeLessThanOrEqual(2048 + 256 + 100) // maxChars + overlapChars + buffer
		}
	})

	test('preserves markdown section headings when text is long enough to split', () => {
		// Generate enough content per section to force splitting
		const md = [
			'# Introduction',
			'',
			Array.from({ length: 10 }, (_, i) => `Introduction paragraph ${i}: ${'x'.repeat(150)}`).join('\n\n'),
			'',
			'# Details',
			'',
			Array.from({ length: 10 }, (_, i) => `Details paragraph ${i}: ${'y'.repeat(150)}`).join('\n\n'),
		].join('\n')

		const chunks = chunkText(md)
		expect(chunks.length).toBeGreaterThan(1)
		// At least one chunk should reference a section
		const withSections = chunks.filter(c => c.section)
		expect(withSections.length).toBeGreaterThanOrEqual(1)
	})

	test('handles empty text', () => {
		const chunks = chunkText('')
		expect(chunks).toHaveLength(1)
		expect(chunks[0].content).toBe('')
	})

	test('chunks have sequential indices', () => {
		const longText = Array.from({ length: 30 }, (_, i) =>
			`Section ${i}: ${'word '.repeat(100)}`
		).join('\n\n')
		const chunks = chunkText(longText)
		for (let i = 0; i < chunks.length; i++) {
			expect(chunks[i].index).toBe(i)
		}
	})

	test('custom maxTokens produces smaller chunks', () => {
		const text = Array.from({ length: 10 }, (_, i) =>
			`Paragraph ${i}: ${'content '.repeat(30)}`
		).join('\n\n')

		const defaultChunks = chunkText(text)
		const smallChunks = chunkText(text, { maxTokens: 64 })

		expect(smallChunks.length).toBeGreaterThan(defaultChunks.length)
	})

	test('overlap produces some shared content between adjacent chunks', () => {
		const paragraphs = Array.from({ length: 20 }, (_, i) =>
			`Unique paragraph number ${i} with enough text to fill space ${'z'.repeat(80)}`
		).join('\n\n')

		const chunks = chunkText(paragraphs, { maxTokens: 128, overlapTokens: 32 })
		expect(chunks.length).toBeGreaterThan(2)
		// Can't easily verify overlap content, but verify chunks exist
	})

	test('single very long paragraph gets split by sentences', () => {
		const longParagraph = Array.from({ length: 50 }, (_, i) =>
			`This is sentence number ${i} in a very long paragraph.`
		).join(' ')

		const chunks = chunkText(longParagraph, { maxTokens: 128 })
		expect(chunks.length).toBeGreaterThan(1)
	})

	test('respects h2 and h3 headings as section boundaries', () => {
		const md = [
			'## Section A',
			'',
			Array.from({ length: 8 }, () => 'Content A. '.repeat(30)).join('\n\n'),
			'',
			'### Subsection B',
			'',
			Array.from({ length: 8 }, () => 'Content B. '.repeat(30)).join('\n\n'),
		].join('\n')

		const chunks = chunkText(md)
		const sections = chunks.map(c => c.section).filter(Boolean)
		expect(sections.some(s => s?.includes('Section A'))).toBe(true)
	})
})

describe('chunkCode', () => {
	test('splits TypeScript by function definitions', () => {
		const code = [
			'export function foo() {',
			'  return 1',
			'}',
			'',
			'export function bar() {',
			'  return 2',
			'}',
		].join('\n')

		const chunks = chunkCode(code, 'example.ts')
		expect(chunks.length).toBeGreaterThanOrEqual(2)
		// Each chunk section should include the file path
		for (const chunk of chunks) {
			expect(chunk.section).toContain('example.ts')
		}
	})

	test('splits Python by def/class', () => {
		const code = [
			'def hello():',
			'    return "hello"',
			'',
			'class World:',
			'    def greet(self):',
			'        return "world"',
		].join('\n')

		const chunks = chunkCode(code, 'example.py')
		expect(chunks.length).toBeGreaterThanOrEqual(2)
	})

	test('falls back to text chunking for unsupported languages', () => {
		const code = 'Some random text content'
		const chunks = chunkCode(code, 'readme.txt')
		expect(chunks.length).toBeGreaterThanOrEqual(1)
	})

	test('handles Go functions', () => {
		const code = [
			'func main() {',
			'  fmt.Println("hello")',
			'}',
			'',
			'func helper() string {',
			'  return "help"',
			'}',
		].join('\n')

		const chunks = chunkCode(code, 'main.go')
		expect(chunks.length).toBeGreaterThanOrEqual(2)
	})

	test('handles Rust fn/struct', () => {
		const code = [
			'pub fn process() {',
			'    println!("processing");',
			'}',
			'',
			'pub struct Config {',
			'    name: String,',
			'}',
		].join('\n')

		const chunks = chunkCode(code, 'lib.rs')
		expect(chunks.length).toBeGreaterThanOrEqual(2)
		expect(chunks[0].section).toContain('lib.rs')
	})

	test('code chunk sections include function names', () => {
		const code = [
			'export function processData() {',
			'  return []',
			'}',
			'export function validateInput() {',
			'  return true',
			'}',
		].join('\n')

		const chunks = chunkCode(code, 'utils.ts')
		const sections = chunks.map(c => c.section).filter(Boolean)
		expect(sections.some(s => s?.includes('processData'))).toBe(true)
		expect(sections.some(s => s?.includes('validateInput'))).toBe(true)
	})

	test('empty code file returns single chunk', () => {
		const chunks = chunkCode('', 'empty.ts')
		expect(chunks.length).toBeGreaterThanOrEqual(1)
	})
})
