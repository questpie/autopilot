/**
 * LiveRenderer — reusable utility for in-place terminal re-rendering.
 *
 * Tracks how many lines were last written and uses ANSI escape sequences
 * to move up, clear, and re-render them on subsequent calls.
 */
export class LiveRenderer {
	private lineCount = 0

	/** Render lines to stdout, clearing any previously rendered lines first. */
	render(lines: string[]): void {
		this.clearPrevious()

		for (const line of lines) {
			process.stdout.write(line + '\n')
		}
		this.lineCount = lines.length
	}

	/** Final render — no more updates expected after this. */
	finish(lines: string[]): void {
		this.clearPrevious()

		for (const line of lines) {
			process.stdout.write(line + '\n')
		}
		this.lineCount = 0
	}

	private clearPrevious(): void {
		if (this.lineCount === 0) return

		// Move cursor up to the start of previously rendered content
		process.stdout.write(`\x1b[${this.lineCount}A`)

		// Clear each line and move down
		for (let i = 0; i < this.lineCount; i++) {
			process.stdout.write('\x1b[2K\n')
		}

		// Move back up to the top
		process.stdout.write(`\x1b[${this.lineCount}A`)
	}
}
