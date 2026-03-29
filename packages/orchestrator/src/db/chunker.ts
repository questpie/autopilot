/**
 * D26: Text chunking for embedding system.
 *
 * Splits text into paragraph-level chunks with configurable max tokens
 * and overlap. Markdown-aware: respects section headings.
 */

export interface ChunkOptions {
	/** Maximum tokens (approx characters / 4) per chunk. Default: 512 */
	maxTokens?: number
	/** Overlap tokens between adjacent chunks. Default: 64 */
	overlapTokens?: number
}

export interface Chunk {
	index: number
	content: string
	/** Section heading this chunk belongs to (if markdown). */
	section?: string
}

const DEFAULT_MAX_TOKENS = 512
const DEFAULT_OVERLAP_TOKENS = 64
/** Rough approximation: 1 token ≈ 4 characters */
const CHARS_PER_TOKEN = 4

/**
 * Split text into paragraph-level chunks with overlap.
 * Markdown-aware: keeps section headings with their content.
 */
export function chunkText(text: string, options?: ChunkOptions): Chunk[] {
	const maxChars = (options?.maxTokens ?? DEFAULT_MAX_TOKENS) * CHARS_PER_TOKEN
	const overlapChars = (options?.overlapTokens ?? DEFAULT_OVERLAP_TOKENS) * CHARS_PER_TOKEN

	if (text.length <= maxChars) {
		return [{ index: 0, content: text }]
	}

	// Split into sections by markdown headings
	const sections = splitMarkdownSections(text)
	const chunks: Chunk[] = []

	for (const section of sections) {
		const sectionChunks = chunkSection(section.content, maxChars, overlapChars)
		for (const content of sectionChunks) {
			chunks.push({
				index: chunks.length,
				content,
				section: section.heading,
			})
		}
	}

	return chunks
}

interface Section {
	heading?: string
	content: string
}

/**
 * Split markdown text into sections by headings.
 * Non-markdown text becomes a single section.
 */
function splitMarkdownSections(text: string): Section[] {
	const lines = text.split('\n')
	const sections: Section[] = []
	let currentHeading: string | undefined
	let currentLines: string[] = []

	for (const line of lines) {
		const headingMatch = line.match(/^#{1,3}\s+(.+)$/)
		if (headingMatch) {
			// Flush previous section
			if (currentLines.length > 0) {
				sections.push({
					heading: currentHeading,
					content: currentLines.join('\n').trim(),
				})
			}
			currentHeading = headingMatch[1]!.trim()
			currentLines = [line]
		} else {
			currentLines.push(line)
		}
	}

	// Flush final section
	if (currentLines.length > 0) {
		sections.push({
			heading: currentHeading,
			content: currentLines.join('\n').trim(),
		})
	}

	// If no sections found, return the whole text
	if (sections.length === 0) {
		return [{ content: text }]
	}

	return sections.filter((s) => s.content.length > 0)
}

/**
 * Split a section into chunks by paragraphs, respecting max size and overlap.
 */
function chunkSection(text: string, maxChars: number, overlapChars: number): string[] {
	if (text.length <= maxChars) return [text]

	// Split by paragraphs (double newline)
	const paragraphs = text.split(/\n\n+/).filter((p) => p.trim().length > 0)
	const chunks: string[] = []
	let current = ''

	for (const para of paragraphs) {
		if (current.length + para.length + 2 > maxChars && current.length > 0) {
			chunks.push(current.trim())
			// Overlap: keep the last N chars from previous chunk
			if (overlapChars > 0 && current.length > overlapChars) {
				current = current.slice(-overlapChars) + '\n\n' + para
			} else {
				current = para
			}
		} else {
			current = current ? `${current}\n\n${para}` : para
		}
	}

	if (current.trim().length > 0) {
		chunks.push(current.trim())
	}

	// Handle case where single paragraph exceeds max — split by sentences
	return chunks.flatMap((chunk) => {
		if (chunk.length <= maxChars) return [chunk]
		return splitBySentence(chunk, maxChars, overlapChars)
	})
}

/**
 * D28: Code-aware chunking — splits source code by function/class boundaries.
 * Falls back to paragraph chunking if no code structures are found.
 */
export function chunkCode(code: string, filePath: string, options?: ChunkOptions): Chunk[] {
	const maxChars = (options?.maxTokens ?? DEFAULT_MAX_TOKENS) * CHARS_PER_TOKEN

	// Try to split by function/class definitions
	const codeChunks = splitCodeBlocks(code, filePath)

	if (codeChunks.length <= 1) {
		// No code structures found — fall back to text chunking with file path context
		return chunkText(code, options).map((c) => ({
			...c,
			section: filePath,
		}))
	}

	const result: Chunk[] = []
	for (const block of codeChunks) {
		if (block.content.length <= maxChars) {
			result.push({
				index: result.length,
				content: block.content,
				section: `${filePath}:${block.name}`,
			})
		} else {
			// Large function — sub-chunk it
			const subChunks = chunkText(block.content, options)
			for (const sub of subChunks) {
				result.push({
					index: result.length,
					content: sub.content,
					section: `${filePath}:${block.name}`,
				})
			}
		}
	}

	return result
}

interface CodeBlock {
	name: string
	content: string
}

/**
 * Extract function/class/method blocks from source code.
 * Supports TypeScript, JavaScript, Python, Go, Rust patterns.
 */
function splitCodeBlocks(code: string, filePath: string): CodeBlock[] {
	const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
	const lines = code.split('\n')
	const blocks: CodeBlock[] = []

	// Regex patterns for function/class starts
	const patterns: RegExp[] = []

	if (['ts', 'tsx', 'js', 'jsx', 'mts', 'mjs'].includes(ext)) {
		patterns.push(
			/^(?:export\s+)?(?:async\s+)?function\s+(\w+)/,
			/^(?:export\s+)?(?:class|interface|type|enum)\s+(\w+)/,
			/^(?:export\s+)?const\s+(\w+)\s*[:=]/,
		)
	} else if (ext === 'py') {
		patterns.push(
			/^(?:async\s+)?def\s+(\w+)/,
			/^class\s+(\w+)/,
		)
	} else if (ext === 'go') {
		patterns.push(
			/^func\s+(?:\(\w+\s+\*?\w+\)\s+)?(\w+)/,
			/^type\s+(\w+)\s+struct/,
		)
	} else if (ext === 'rs') {
		patterns.push(
			/^(?:pub\s+)?(?:async\s+)?fn\s+(\w+)/,
			/^(?:pub\s+)?(?:struct|enum|trait|impl)\s+(\w+)/,
		)
	}

	if (patterns.length === 0) return []

	let currentBlock: CodeBlock | null = null
	let currentLines: string[] = []

	for (const line of lines) {
		let matched = false
		for (const pattern of patterns) {
			const match = line.match(pattern)
			if (match) {
				// Flush previous block
				if (currentBlock) {
					currentBlock.content = currentLines.join('\n')
					if (currentBlock.content.trim()) blocks.push(currentBlock)
				}
				currentBlock = { name: match[1] ?? 'anonymous', content: '' }
				currentLines = [line]
				matched = true
				break
			}
		}
		if (!matched) {
			currentLines.push(line)
		}
	}

	// Flush final block
	if (currentBlock) {
		currentBlock.content = currentLines.join('\n')
		if (currentBlock.content.trim()) blocks.push(currentBlock)
	}

	return blocks
}

/**
 * Fallback: split by sentences when a paragraph exceeds max chunk size.
 */
function splitBySentence(text: string, maxChars: number, overlapChars: number): string[] {
	const sentences = text.match(/[^.!?]+[.!?]+\s*/g) ?? [text]
	const chunks: string[] = []
	let current = ''

	for (const sentence of sentences) {
		if (current.length + sentence.length > maxChars && current.length > 0) {
			chunks.push(current.trim())
			if (overlapChars > 0 && current.length > overlapChars) {
				current = current.slice(-overlapChars) + sentence
			} else {
				current = sentence
			}
		} else {
			current += sentence
		}
	}

	if (current.trim().length > 0) {
		chunks.push(current.trim())
	}

	return chunks
}
