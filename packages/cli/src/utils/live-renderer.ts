/**
 * LiveRenderer — reusable utility for in-place terminal re-rendering.
 *
 * Tracks how many lines were last written and uses ANSI escape sequences
 * to move up and overwrite them on subsequent calls.
 */
export class LiveRenderer {
	private lineCount = 0

	/** Render lines to stdout, overwriting any previously rendered lines. */
	render(lines: string[]): void {
		if (this.lineCount > 0) {
			// Move cursor to the start of previously rendered content
			process.stdout.write(`\x1b[${this.lineCount}A\x1b[0G`)
		}

		for (const line of lines) {
			// Clear the line, write content, move to next line
			process.stdout.write(`\x1b[2K${line}\n`)
		}

		// If new output is shorter, clear leftover lines from previous render
		for (let i = lines.length; i < this.lineCount; i++) {
			process.stdout.write('\x1b[2K\n')
		}
		if (lines.length < this.lineCount) {
			// Move cursor back up past the cleared lines
			process.stdout.write(`\x1b[${this.lineCount - lines.length}A`)
		}

		this.lineCount = Math.max(lines.length, this.lineCount)
	}

	/** Final render — no more updates expected after this. */
	finish(lines: string[]): void {
		this.render(lines)
		this.lineCount = 0
	}
}
