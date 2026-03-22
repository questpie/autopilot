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

export function header(text: string): string {
	return `${COLORS.bold}${text}${COLORS.reset}`
}

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

export function badge(text: string, color?: string): string {
	const c = color && color in COLORS ? COLORS[color as keyof typeof COLORS] : COLORS.magenta
	return `${c}[${text}]${COLORS.reset}`
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

function stripAnsi(str: string): string {
	return str.replace(/\x1b\[[0-9;]*m/g, '')
}
