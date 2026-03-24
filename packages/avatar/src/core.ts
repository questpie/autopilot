/**
 * Construct avatar core — shared PRNG, data, DNA, color/LOD resolution.
 * Both the string SVG builder and React component consume this.
 */

// ── PRNG Algorithms ────────────────────────────────────────────────────
function xmur3(str: string): () => number {
	let h = 1779033703 ^ str.length
	for (let i = 0; i < str.length; i++) {
		h = Math.imul(h ^ str.charCodeAt(i), 3432918353)
		h = (h << 13) | (h >>> 19)
	}
	return () => {
		h = Math.imul(h ^ (h >>> 16), 2246822507)
		h = Math.imul(h ^ (h >>> 13), 3266489909)
		return (h ^= h >>> 16) >>> 0
	}
}

function mulberry32(a: number): () => number {
	let state = a
	return () => {
		let t = (state += 0x6d2b79f5)
		t = Math.imul(t ^ (t >>> 15), t | 1)
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296
	}
}

// ── Data ───────────────────────────────────────────────────────────────
export interface HeadDef {
	x: number
	y: number
	w: number
	h: number
	name: string
}

export const HEADS: HeadDef[] = [
	{ x: 3, y: 3, w: 10, h: 10, name: 'The Block' },
	{ x: 4, y: 2, w: 8, h: 12, name: 'The Server' },
	{ x: 2, y: 4, w: 12, h: 8, name: 'The Terminal' },
	{ x: 3, y: 2, w: 10, h: 11, name: 'The Dual' },
	{ x: 5, y: 1, w: 6, h: 14, name: 'The Tower' },
	{ x: 1, y: 5, w: 14, h: 7, name: 'The Mainframe' },
	{ x: 4, y: 4, w: 8, h: 9, name: 'The Compact' },
	{ x: 2, y: 3, w: 11, h: 10, name: 'The Offset' },
]

export const LED_COLORS = ['#00E676', '#FF3D57', '#FFB300', '#40C4FF'] as const

export const CELL = 16
export const STROKE_W = 4
export const CUT = 3
export const BRAND = '#B700FF'

// ── Types ──────────────────────────────────────────────────────────────
export type AvatarStyle = 'solid' | 'wireframe'
export type AvatarTheme = 'dark' | 'light'
export type AvatarLod = 'S' | 'M' | 'L'

export interface AvatarDna {
	head: number
	eye: number
	jaw: number
	top: number
	side: number
	pattern: number
	bg: number
	led: number
}

export interface AvatarContext {
	dna: AvatarDna
	head: HeadDef
	lod: AvatarLod
	size: number
	style: AvatarStyle
	seed: string
	// Computed colors
	bg: string
	fg: string
	surface: string
	mid: string
	ledColor: string
	fillStyle: string
	eyeColor: string
	eyeFill: string
	eyeStrokeW: number
	// Derived geometry
	jY: number
	headPath: string
}

// ── DNA Extraction ─────────────────────────────────────────────────────
export function extractDna(seed: string): AvatarDna {
	const seedFn = xmur3(seed || 'QUESTPIE')
	const random = mulberry32(seedFn())

	return {
		head: Math.floor(random() * 8),
		eye: Math.floor(random() * 8),
		jaw: Math.floor(random() * 8),
		top: Math.floor(random() * 8),
		side: Math.floor(random() * 8),
		pattern: Math.floor(random() * 4),
		bg: Math.floor(random() * 4),
		led: Math.floor(random() * 4),
	}
}

// ── Context Resolution ─────────────────────────────────────────────────
export interface ResolveOptions {
	seed: string
	size?: number
	style?: AvatarStyle
	theme?: AvatarTheme
}

export function resolveContext(options: ResolveOptions): AvatarContext {
	const { seed, size = 80, style = 'solid', theme = 'dark' } = options
	const dna = extractDna(seed)

	const isDark = theme === 'dark'
	const bg = isDark ? '#0a0a0a' : '#ffffff'
	const fg = isDark ? '#ffffff' : '#0a0a0a'
	const surface = isDark ? '#111111' : '#f8f8f8'
	const mid = isDark ? '#333333' : '#e5e5e5'
	const ledColor = LED_COLORS[dna.led]!

	const fillStyle = style === 'wireframe' ? 'none' : surface
	const eyeColor = fg
	const eyeFill = style === 'wireframe' ? 'none' : eyeColor
	const eyeStrokeW = style === 'wireframe' ? STROKE_W : 0

	const head = HEADS[dna.head]!
	const jY = head.y + head.h
	const lod: AvatarLod = size <= 48 ? 'S' : size <= 96 ? 'M' : 'L'

	const headPath = `M ${head.x * CELL} ${head.y * CELL} H ${(head.x + head.w) * CELL} V ${(head.y + head.h - CUT) * CELL} H ${(head.x + head.w - CUT) * CELL} V ${(head.y + head.h) * CELL} H ${head.x * CELL} Z`

	return {
		dna,
		head,
		lod,
		size,
		style,
		seed,
		bg,
		fg,
		surface,
		mid,
		ledColor,
		fillStyle,
		eyeColor,
		eyeFill,
		eyeStrokeW,
		jY,
		headPath,
	}
}
