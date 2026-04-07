/**
 * LiveRenderer — reusable utility for in-place terminal re-rendering.
 *
 * Uses cursor save/restore + erase-to-end for reliable overwriting
 * regardless of content height changes or line wrapping.
 */
export class LiveRenderer {
	private active = false

	/** Render lines to stdout, overwriting any previously rendered output. */
	render(lines: string[]): void {
		if (this.active) {
			// Restore saved cursor position and erase everything below it
			process.stdout.write('\x1b[u\x1b[J')
		} else {
			// First render — save cursor position
			process.stdout.write('\x1b[s')
			this.active = true
		}

		for (const line of lines) {
			process.stdout.write(line + '\n')
		}
	}

	/** Final render — no more updates expected after this. */
	finish(lines: string[]): void {
		if (this.active) {
			process.stdout.write('\x1b[u\x1b[J')
		}

		for (const line of lines) {
			process.stdout.write(line + '\n')
		}
		this.active = false
	}
}
