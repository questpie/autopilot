/**
 * Structured output parser for agent results.
 *
 * Agents can include an <AUTOPILOT_RESULT> block in their output.
 * The parser extracts ALL tags generically as key-value pairs.
 *
 * Two tag kinds:
 * - Simple tags: <tagname>content</tagname> → tags.tagname = "content"
 * - Artifact tags: <artifact kind="..." title="...">content</artifact> → artifacts[]
 *
 * Special tags (interpreted by the engine, but parsed the same way):
 * - `outcome` — drives workflow transitions
 * - `artifact` — registered through the artifact system
 *
 * Everything else is just a named tag. The engine/step can use any tag name
 * declared in the step's output definition.
 */

export interface ParsedArtifact {
	kind: string
	title: string
	content: string
	attrs: Record<string, string>
}

export interface StructuredOutput {
	/** All extracted simple tags: tagname → content. */
	tags: Record<string, string>
	/** Extracted artifact tags (have attributes + content). */
	artifacts: ParsedArtifact[]
	/** The original text with the AUTOPILOT_RESULT block removed. */
	prose: string
}

/**
 * Parse structured output from agent text.
 * Returns null if no <AUTOPILOT_RESULT> block is found.
 */
export function parseStructuredOutput(text: string): StructuredOutput | null {
	const blockMatch = text.match(/<AUTOPILOT_RESULT>([\s\S]*?)<\/AUTOPILOT_RESULT>/i)
	if (!blockMatch) return null

	const block = blockMatch[1]!
	const prose = text.replace(blockMatch[0], '').trim()

	const artifacts = extractArtifacts(block)
	// Remove artifact tags from block before extracting simple tags (avoid double-parse)
	const blockWithoutArtifacts = block
		.replace(/<artifact\s+(?:[^>](?!\/))*[^>/]>[\s\S]*?<\/artifact>/gi, '')
		.replace(/<artifact\s+[\s\S]*?\s*\/>/gi, '')
	const tags = extractAllTags(blockWithoutArtifacts)

	return { tags, artifacts, prose }
}

// ─── Convenience accessors (for common special tags) ────────────────────

/** Get the workflow outcome from parsed output. */
export function getOutcome(output: StructuredOutput): string | null {
	const v = output.tags.outcome
	return v ? v.toLowerCase() : null
}

/** Get the summary from parsed output. */
export function getSummary(output: StructuredOutput): string | null {
	return output.tags.summary ?? null
}

// ─── Internal ───────────────────────────────────────────────────────────

/** Extract all simple tags (non-artifact) from the block. */
function extractAllTags(block: string): Record<string, string> {
	const tags: Record<string, string> = {}
	const re = /<(\w[\w-]*)(?:\s[^>]*)?>(?!\s*<)([\s\S]*?)<\/\1>/gi
	let match: RegExpExecArray | null
	while ((match = re.exec(block)) !== null) {
		const name = match[1]!.toLowerCase()
		tags[name] = match[2]!.trim()
	}
	return tags
}

/** Extract all <artifact> tags with their attributes and content. */
function extractArtifacts(block: string): ParsedArtifact[] {
	const results: ParsedArtifact[] = []

	// Open-close tags: <artifact ...>content</artifact> (excludes self-closing />)
	const reOpenClose = /<artifact\s+((?:[^>](?!\/))*[^>/])>([\s\S]*?)<\/artifact>/gi
	let match: RegExpExecArray | null
	while ((match = reOpenClose.exec(block)) !== null) {
		const attrs = parseAttributes(match[1]!)
		results.push({
			kind: attrs.kind ?? 'other',
			title: attrs.title ?? 'Untitled',
			content: match[2]!.trim(),
			attrs,
		})
	}

	// Self-closing tags: <artifact ... />
	const reSelfClose = /<artifact\s+([\s\S]*?)\s*\/>/gi
	while ((match = reSelfClose.exec(block)) !== null) {
		const attrs = parseAttributes(match[1]!)
		results.push({
			kind: attrs.kind ?? 'other',
			title: attrs.title ?? 'Untitled',
			content: '',
			attrs,
		})
	}

	return results
}

/** Parse HTML-style attributes from a string. */
function parseAttributes(str: string): Record<string, string> {
	const attrs: Record<string, string> = {}
	const re = /(\w[\w-]*)="([^"]*)"/g
	let match: RegExpExecArray | null
	while ((match = re.exec(str)) !== null) {
		attrs[match[1]!] = match[2]!
	}
	return attrs
}
