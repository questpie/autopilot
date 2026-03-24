const ESC = '\x1b'

const COLORS = {
	reset: `${ESC}[0m`,
	bold: `${ESC}[1m`,
	dim: `${ESC}[2m`,
	red: `${ESC}[31m`,
	green: `${ESC}[32m`,
	yellow: `${ESC}[33m`,
	blue: `${ESC}[34m`,
	magenta: `${ESC}[35m`,
	cyan: `${ESC}[36m`,
	white: `${ESC}[37m`,
	gray: `${ESC}[90m`,
} as const

// ── Core text formatting ──────────────────────────────────

export function header(text: string): string {
	return `${COLORS.bold}${text}${COLORS.reset}`
}

export function dim(text: string): string {
	return `${COLORS.dim}${text}${COLORS.reset}`
}

export function success(text: string): string {
	return `${COLORS.green}${text}${COLORS.reset}`
}

export function error(text: string): string {
	return `${COLORS.red}${text}${COLORS.reset}`
}

export function warning(text: string): string {
	return `${COLORS.yellow}${text}${COLORS.reset}`
}

export function badge(text: string, color?: string): string {
	const c = color && color in COLORS ? COLORS[color as keyof typeof COLORS] : COLORS.magenta
	return `${c}[${text}]${COLORS.reset}`
}

// ── Visual elements ───────────────────────────────────────

/** Colored status dot: ● */
export function dot(color?: string): string {
	const c = color && color in COLORS ? COLORS[color as keyof typeof COLORS] : COLORS.magenta
	return `${c}\u25CF${COLORS.reset}`
}

/** Horizontal separator line */
export function separator(width: number = 50): string {
	return `${COLORS.dim}${'\u2500'.repeat(width)}${COLORS.reset}`
}

/** Section header with separator line */
export function section(text: string): string {
	const label = ` ${text} `
	const lineLen = Math.max(50 - stripAnsi(label).length - 2, 4)
	return `${COLORS.dim}\u2500\u2500${COLORS.reset}${COLORS.bold}${label}${COLORS.reset}${COLORS.dim}${'\u2500'.repeat(lineLen)}${COLORS.reset}`
}

/** Box with rounded corners wrapping lines of text */
export function box(lines: string[], padding: number = 1): string {
	const pad = ' '.repeat(padding)
	const maxLen = Math.max(...lines.map((l) => stripAnsi(l).length), 0)
	const innerWidth = maxLen + padding * 2

	const top = `${COLORS.dim}\u256D${'─'.repeat(innerWidth)}\u256E${COLORS.reset}`
	const bottom = `${COLORS.dim}\u2570${'─'.repeat(innerWidth)}\u256F${COLORS.reset}`
	const body = lines.map((line) => {
		const visible = stripAnsi(line).length
		const rightPad = ' '.repeat(maxLen - visible)
		return `${COLORS.dim}\u2502${COLORS.reset}${pad}${line}${rightPad}${pad}${COLORS.dim}\u2502${COLORS.reset}`
	})

	return [top, ...body, bottom].join('\n')
}

/** Brand header — QUESTPIE Autopilot in a box with optional subtitle */
export function brandHeader(subtitle?: string): string {
	const title = `${COLORS.magenta}${COLORS.bold}Q${COLORS.reset} ${COLORS.bold}QUESTPIE Autopilot${COLORS.reset}`
	const lines = [title]
	if (subtitle) {
		lines.push(`${COLORS.dim}${subtitle}${COLORS.reset}`)
	}
	return box(lines)
}

// ── Spinner ───────────────────────────────────────────────

const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

export function createSpinner(message: string) {
	let frame = 0
	let interval: ReturnType<typeof setInterval> | null = null

	return {
		start() {
			interval = setInterval(() => {
				const f = SPINNER_FRAMES[frame % SPINNER_FRAMES.length]
				process.stderr.write(`\r${COLORS.magenta}${f}${COLORS.reset} ${message}`)
				frame++
			}, 80)
		},
		stop(finalMessage?: string) {
			if (interval) clearInterval(interval)
			process.stderr.write('\r' + ' '.repeat(message.length + 4) + '\r')
			if (finalMessage) {
				console.log(finalMessage)
			}
		},
	}
}

// ── Table ─────────────────────────────────────────────────

export function table(rows: string[][]): string {
	if (rows.length === 0) return ''

	const colCount = Math.max(...rows.map((r) => r.length))
	const widths: number[] = Array.from({ length: colCount }, () => 0)

	for (const row of rows) {
		for (let i = 0; i < row.length; i++) {
			const len = stripAnsi(row[i] ?? '').length
			if (len > widths[i]!) {
				widths[i] = len
			}
		}
	}

	return rows
		.map((row) =>
			row.map((cell, i) => cell.padEnd(widths[i]! + stripAnsi(cell).length - cell.length + 2)).join(''),
		)
		.join('\n')
}

// ── Helpers ───────────────────────────────────────────────

export function stripAnsi(str: string): string {
	return str.replace(/\x1b\[[0-9;]*m/g, '')
}
