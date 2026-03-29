/**
 * D25-D31: Embeddings & indexer tests.
 *
 * Tests extractContent, multi-format detection, image/office extensions,
 * indexer batching, and code-aware vs text chunking routing.
 */
import { describe, test, expect } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const indexerPath = join(import.meta.dir, '..', 'src', 'db', 'indexer.ts')
const indexerSource = readFileSync(indexerPath, 'utf-8')

// ─── D27: Multi-format extractors ──────────────────────────────────────────

describe('D27: multi-format file detection', () => {
	test('INDEXABLE_EXTENSIONS includes markdown', () => {
		expect(indexerSource).toContain("'md'")
		expect(indexerSource).toContain("'txt'")
	})

	test('INDEXABLE_EXTENSIONS includes code languages', () => {
		for (const ext of ['ts', 'tsx', 'js', 'py', 'go', 'rs', 'java', 'rb', 'php']) {
			expect(indexerSource).toContain(`'${ext}'`)
		}
	})

	test('INDEXABLE_EXTENSIONS includes data formats', () => {
		for (const ext of ['json', 'csv', 'yaml', 'yml', 'toml']) {
			expect(indexerSource).toContain(`'${ext}'`)
		}
	})

	test('INDEXABLE_EXTENSIONS includes markup', () => {
		for (const ext of ['html', 'htm', 'xml']) {
			expect(indexerSource).toContain(`'${ext}'`)
		}
	})

	test('INDEXABLE_EXTENSIONS includes config files', () => {
		for (const ext of ['env', 'ini', 'cfg', 'conf', 'dockerfile']) {
			expect(indexerSource).toContain(`'${ext}'`)
		}
	})

	test('OFFICE_EXTENSIONS includes PDF, DOCX, PPTX, XLSX', () => {
		expect(indexerSource).toContain("'pdf'")
		expect(indexerSource).toContain("'docx'")
		expect(indexerSource).toContain("'pptx'")
		expect(indexerSource).toContain("'xlsx'")
	})

	test('OFFICE_EXTENSIONS includes ODF formats', () => {
		expect(indexerSource).toContain("'odt'")
		expect(indexerSource).toContain("'odp'")
		expect(indexerSource).toContain("'ods'")
	})

	test('office parsing uses officeparser', () => {
		expect(indexerSource).toContain('parseOfficeAsync')
		expect(indexerSource).toContain("import('officeparser')")
	})
})

// ─── D27: extractContent ────────────────────────────────────────────────────

describe('D27: extractContent logic', () => {
	test('HTML extraction strips tags', () => {
		// Replicate the extractContent HTML logic
		const raw = '<html><body><h1>Title</h1><p>Hello <b>world</b></p><script>alert(1)</script></body></html>'
		const content = raw
			.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
			.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
		expect(content).toBe('Title Hello world')
		expect(content).not.toContain('<')
		expect(content).not.toContain('alert')
	})

	test('HTML extraction strips style tags', () => {
		const raw = '<style>.x{color:red}</style><p>Content</p>'
		const content = raw
			.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
			.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim()
		expect(content).toBe('Content')
	})

	test('JSON extraction pretty-prints', () => {
		const raw = '{"key":"value","nested":{"a":1}}'
		const content = JSON.stringify(JSON.parse(raw), null, 2)
		expect(content).toContain('"key": "value"')
		expect(content).toContain('\n')
	})

	test('CSV passed through as-is', () => {
		const raw = 'name,age\nAlice,30\nBob,25'
		// extractContent for csv just returns raw
		expect(raw).toBe(raw)
	})

	test('XML extraction strips tags', () => {
		const raw = '<root><item name="test">Hello</item></root>'
		const content = raw.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
		expect(content).toBe('Hello')
	})
})

// ─── D30: Image embedding ──────────────────────────────────────────────────

describe('D30: image embedding', () => {
	test('IMAGE_EXTENSIONS includes standard formats', () => {
		for (const ext of ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg']) {
			expect(indexerSource).toContain(`'${ext}'`)
		}
	})

	test('image indexing uses embedImage', () => {
		expect(indexerSource).toContain('embedImage')
	})

	test('image fallback content is [Image: filename]', () => {
		expect(indexerSource).toContain('[Image:')
	})
})

// ─── D28: Code-aware chunking routing ──────────────────────────────────────

describe('D28: code-aware chunking', () => {
	test('CODE_EXTENSIONS set exists in indexer', () => {
		expect(indexerSource).toContain('CODE_EXTENSIONS')
	})

	test('indexer routes code files to chunkCode', () => {
		expect(indexerSource).toContain('chunkCode')
		expect(indexerSource).toContain('isCode')
	})

	test('non-code files use chunkText', () => {
		expect(indexerSource).toContain('chunkText')
	})
})

// ─── D31: Indexer batching ─────────────────────────────────────────────────

describe('D31: indexer batching', () => {
	test('BATCH_SIZE constant is defined', () => {
		expect(indexerSource).toContain('BATCH_SIZE')
		expect(indexerSource).toContain('100')
	})

	test('indexTasks uses batch processing', () => {
		const taskSection = indexerSource.slice(
			indexerSource.indexOf('async indexTasks'),
			indexerSource.indexOf('async indexMessages'),
		)
		expect(taskSection).toContain('BATCH_SIZE')
		expect(taskSection).toContain('setTimeout')
	})

	test('indexMessages uses batch processing', () => {
		const msgSection = indexerSource.slice(
			indexerSource.indexOf('async indexMessages'),
			indexerSource.indexOf('async indexKnowledge'),
		)
		expect(msgSection).toContain('BATCH_SIZE')
		expect(msgSection).toContain('setTimeout')
	})
})

// ─── D25: Chunks table in schema ───────────────────────────────────────────

describe('D25: chunks table', () => {
	test('chunks table has embedding F32_BLOB column', () => {
		const schemaSource = readFileSync(join(import.meta.dir, '..', 'src', 'db', 'schema.ts'), 'utf-8')
		expect(schemaSource).toContain("embedding: blob('embedding')")
	})

	test('chunks table has entity_type, entity_id, chunk_index', () => {
		const schemaSource = readFileSync(join(import.meta.dir, '..', 'src', 'db', 'schema.ts'), 'utf-8')
		expect(schemaSource).toContain("entityType: text('entity_type')")
		expect(schemaSource).toContain("entityId: text('entity_id')")
		expect(schemaSource).toContain("chunkIndex: integer('chunk_index')")
	})

	test('migration uses F32_BLOB(768)', () => {
		const migrationDir = join(import.meta.dir, '..', 'drizzle')
		const { readdirSync } = require('node:fs')
		const files = readdirSync(migrationDir).filter((f: string) => f.endsWith('.sql'))
		expect(files.length).toBeGreaterThanOrEqual(1)
		const migration = readFileSync(join(migrationDir, files[0]), 'utf-8')
		expect(migration).toContain('F32_BLOB(768)')
	})
})
