import { test, expect, describe } from 'bun:test'
import { parseStructuredOutput, getOutcome, getSummary } from '../src/structured-output'

describe('parseStructuredOutput', () => {
	test('returns null when no block present', () => {
		expect(parseStructuredOutput('Just some plain text')).toBeNull()
		expect(parseStructuredOutput('')).toBeNull()
	})

	test('extracts outcome tag', () => {
		const result = parseStructuredOutput(`
Some reasoning.

<AUTOPILOT_RESULT>
  <outcome>approved</outcome>
</AUTOPILOT_RESULT>
`)
		expect(result).not.toBeNull()
		expect(getOutcome(result!)).toBe('approved')
		expect(result!.prose).toContain('Some reasoning')
	})

	test('outcome is case-insensitive', () => {
		const result = parseStructuredOutput(`
<AUTOPILOT_RESULT>
  <outcome>Revise</outcome>
</AUTOPILOT_RESULT>
`)
		expect(getOutcome(result!)).toBe('revise')
	})

	test('extracts all simple tags generically', () => {
		const result = parseStructuredOutput(`
<AUTOPILOT_RESULT>
  <outcome>approved</outcome>
  <summary>Plan is good.</summary>
  <feedback>No issues found.</feedback>
  <notes>Consider adding caching later.</notes>
</AUTOPILOT_RESULT>
`)
		expect(result!.tags.outcome).toBe('approved')
		expect(result!.tags.summary).toBe('Plan is good.')
		expect(result!.tags.feedback).toBe('No issues found.')
		expect(result!.tags.notes).toBe('Consider adding caching later.')
		expect(getSummary(result!)).toBe('Plan is good.')
	})

	test('extracts single artifact', () => {
		const result = parseStructuredOutput(`
<AUTOPILOT_RESULT>
  <summary>Prompt generated.</summary>
  <artifact kind="implementation_prompt" title="Implementation Prompt">
1. Modify src/foo.ts
2. Add tests
  </artifact>
</AUTOPILOT_RESULT>
`)
		expect(result!.artifacts.length).toBe(1)
		expect(result!.artifacts[0]!.kind).toBe('implementation_prompt')
		expect(result!.artifacts[0]!.title).toBe('Implementation Prompt')
		expect(result!.artifacts[0]!.content).toContain('Modify src/foo.ts')
	})

	test('extracts multiple artifacts', () => {
		const result = parseStructuredOutput(`
<AUTOPILOT_RESULT>
  <artifact kind="implementation_prompt" title="Prompt">First</artifact>
  <artifact kind="validation_report" title="Report">Second</artifact>
</AUTOPILOT_RESULT>
`)
		expect(result!.artifacts.length).toBe(2)
		expect(result!.artifacts[0]!.kind).toBe('implementation_prompt')
		expect(result!.artifacts[1]!.kind).toBe('validation_report')
	})

	test('preserves prose before and after block', () => {
		const result = parseStructuredOutput(`
Analysis here.

<AUTOPILOT_RESULT>
  <outcome>approved</outcome>
</AUTOPILOT_RESULT>

Trailing text.
`)
		expect(result!.prose).toContain('Analysis here')
		expect(result!.prose).toContain('Trailing text')
		expect(result!.prose).not.toContain('AUTOPILOT_RESULT')
	})

	test('handles missing optional tags', () => {
		const result = parseStructuredOutput(`
<AUTOPILOT_RESULT>
  <outcome>approved</outcome>
</AUTOPILOT_RESULT>
`)
		expect(getOutcome(result!)).toBe('approved')
		expect(getSummary(result!)).toBeNull()
		expect(result!.artifacts).toEqual([])
	})

	test('artifact kind is passed through as-is', () => {
		const result = parseStructuredOutput(`
<AUTOPILOT_RESULT>
  <artifact kind="custom_whatever" title="Custom">content</artifact>
</AUTOPILOT_RESULT>
`)
		expect(result!.artifacts[0]!.kind).toBe('custom_whatever')
	})

	test('tolerates messy whitespace', () => {
		const result = parseStructuredOutput(`
<AUTOPILOT_RESULT>
    <outcome>  revise  </outcome>
    <summary>
      Needs more work.
    </summary>
</AUTOPILOT_RESULT>
`)
		expect(getOutcome(result!)).toBe('revise')
		expect(getSummary(result!)).toBe('Needs more work.')
	})

	test('handles multiline artifact content', () => {
		const result = parseStructuredOutput(`
<AUTOPILOT_RESULT>
  <artifact kind="implementation_prompt" title="Full Prompt">
## Step 1
Modify src/server.ts

## Step 2
Add tests
  </artifact>
</AUTOPILOT_RESULT>
`)
		expect(result!.artifacts[0]!.content).toContain('## Step 1')
		expect(result!.artifacts[0]!.content).toContain('## Step 2')
	})

	test('custom tags are extracted alongside standard ones', () => {
		const result = parseStructuredOutput(`
<AUTOPILOT_RESULT>
  <outcome>revise</outcome>
  <plan>Step 1: do X\nStep 2: do Y</plan>
  <risk_assessment>Low risk — isolated change</risk_assessment>
</AUTOPILOT_RESULT>
`)
		expect(result!.tags.plan).toContain('Step 1')
		expect(result!.tags.risk_assessment).toContain('Low risk')
		expect(getOutcome(result!)).toBe('revise')
	})

	test('parses self-closing artifact tag', () => {
		const result = parseStructuredOutput(`
<AUTOPILOT_RESULT>
  <artifact kind="preview_dir" path="output/deck" entry="presentation.html" title="Deck" />
</AUTOPILOT_RESULT>
`)
		expect(result!.artifacts.length).toBe(1)
		expect(result!.artifacts[0]!.kind).toBe('preview_dir')
		expect(result!.artifacts[0]!.attrs.path).toBe('output/deck')
		expect(result!.artifacts[0]!.attrs.entry).toBe('presentation.html')
		expect(result!.artifacts[0]!.title).toBe('Deck')
		expect(result!.artifacts[0]!.content).toBe('')
	})

	test('handles mix of self-closing and open-close artifact tags', () => {
		const result = parseStructuredOutput(`
<AUTOPILOT_RESULT>
  <artifact kind="preview_dir" path="dist" title="Build" />
  <artifact kind="implementation_prompt" title="Prompt">Do the thing</artifact>
</AUTOPILOT_RESULT>
`)
		expect(result!.artifacts.length).toBe(2)
		// Open-close tags are extracted first, then self-closing
		const dirArt = result!.artifacts.find((a) => a.kind === 'preview_dir')
		const promptArt = result!.artifacts.find((a) => a.kind === 'implementation_prompt')
		expect(dirArt).toBeDefined()
		expect(dirArt!.content).toBe('')
		expect(promptArt).toBeDefined()
		expect(promptArt!.content).toBe('Do the thing')
	})

	test('self-closing tag does not pollute simple tags', () => {
		const result = parseStructuredOutput(`
<AUTOPILOT_RESULT>
  <outcome>approved</outcome>
  <artifact kind="preview_dir" path="dist" title="Build" />
</AUTOPILOT_RESULT>
`)
		expect(result!.artifacts.length).toBe(1)
		expect(result!.tags.outcome).toBe('approved')
		// Tags should not contain artifact-related entries
		expect(result!.tags.artifact).toBeUndefined()
		expect(result!.tags.kind).toBeUndefined()
		expect(result!.tags.path).toBeUndefined()
	})
})
