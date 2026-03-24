/**
 * Construct avatar generator — deterministic SVG robot from a string seed.
 * Brutalist aesthetic: all rects, zero border-radius, sharp geometry.
 * Uses xmur3 + mulberry32 PRNG for 2M+ unique variations.
 * Ported from the QUESTPIE AI Studio construct generator.
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
interface HeadDef {
	x: number
	y: number
	w: number
	h: number
	name: string
}

const HEADS: HeadDef[] = [
	{ x: 3, y: 3, w: 10, h: 10, name: 'The Block' },
	{ x: 4, y: 2, w: 8, h: 12, name: 'The Server' },
	{ x: 2, y: 4, w: 12, h: 8, name: 'The Terminal' },
	{ x: 3, y: 2, w: 10, h: 11, name: 'The Dual' },
	{ x: 5, y: 1, w: 6, h: 14, name: 'The Tower' },
	{ x: 1, y: 5, w: 14, h: 7, name: 'The Mainframe' },
	{ x: 4, y: 4, w: 8, h: 9, name: 'The Compact' },
	{ x: 2, y: 3, w: 11, h: 10, name: 'The Offset' },
]

const LED_COLORS = ['#00E676', '#FF3D57', '#FFB300', '#40C4FF'] as const

// ── Component ──────────────────────────────────────────────────────────
export interface GenerativeAvatarProps {
	seed: string
	size?: number
	style?: 'solid' | 'wireframe'
	theme?: 'dark' | 'light'
	className?: string
}

export function GenerativeAvatar({
	seed,
	size = 80,
	style = 'solid',
	theme = 'dark',
	className,
}: GenerativeAvatarProps) {
	const seedFn = xmur3(seed || 'QUESTPIE')
	const random = mulberry32(seedFn())

	// Extract 8 DNA attributes
	const dna = {
		head: Math.floor(random() * 8),
		eye: Math.floor(random() * 8),
		jaw: Math.floor(random() * 8),
		top: Math.floor(random() * 8),
		side: Math.floor(random() * 8),
		pattern: Math.floor(random() * 4),
		bg: Math.floor(random() * 4),
		led: Math.floor(random() * 4),
	}

	// Colors based on theme
	const isDark = theme === 'dark'
	const bg = isDark ? '#0a0a0a' : '#ffffff'
	const fg = isDark ? '#ffffff' : '#0a0a0a'
	const surface = isDark ? '#111111' : '#f8f8f8'
	const mid = isDark ? '#333333' : '#e5e5e5'
	const brand = '#B700FF'
	const ledColor = LED_COLORS[dna.led]!

	const cell = 16
	const strokeW = 4
	const fillStyle = style === 'wireframe' ? 'none' : surface

	const h = HEADS[dna.head]!
	const cut = 3
	const jY = h.y + h.h

	const eyeColor = fg
	const eyeFill = style === 'wireframe' ? 'none' : eyeColor
	const eyeStrokeWidth = style === 'wireframe' ? strokeW : 0

	// Head path for the cutout shape
	const headPath = `M ${h.x * cell} ${h.y * cell} H ${(h.x + h.w) * cell} V ${(h.y + h.h - cut) * cell} H ${(h.x + h.w - cut) * cell} V ${(h.y + h.h) * cell} H ${h.x * cell} Z`

	// Build elements arrays for cleaner JSX
	const elements: React.ReactNode[] = []
	let key = 0
	const k = () => `e${key++}`

	// 1. Background Grid
	const bgGridDefs: React.ReactNode[] = []
	const bgGridRects: React.ReactNode[] = []

	if (dna.bg === 0) {
		bgGridDefs.push(
			<pattern key={k()} id="g0" width="16" height="16" patternUnits="userSpaceOnUse">
				<path d="M 16 0 L 0 0 0 16" fill="none" stroke={mid} strokeWidth="1" opacity="0.4" />
			</pattern>,
		)
		bgGridRects.push(<rect key={k()} width="256" height="256" fill="url(#g0)" />)
	} else if (dna.bg === 1) {
		bgGridDefs.push(
			<pattern key={k()} id="g1" width="32" height="32" patternUnits="userSpaceOnUse">
				<path d="M 32 0 L 0 0 0 32" fill="none" stroke={mid} strokeWidth="1" opacity="0.6" />
			</pattern>,
		)
		bgGridRects.push(<rect key={k()} width="256" height="256" fill="url(#g1)" />)
	} else if (dna.bg === 2) {
		bgGridDefs.push(
			<pattern key={k()} id="g2" width="32" height="32" patternUnits="userSpaceOnUse">
				<path d="M 15 16 H 17 M 16 15 V 17" stroke={mid} strokeWidth="2" />
			</pattern>,
		)
		bgGridRects.push(<rect key={k()} width="256" height="256" fill="url(#g2)" />)
	} else if (dna.bg === 3) {
		bgGridDefs.push(
			<pattern key={k()} id="g3" width="16" height="16" patternUnits="userSpaceOnUse">
				<rect x="0" y="0" width="2" height="2" fill={mid} opacity="0.8" />
			</pattern>,
		)
		bgGridRects.push(<rect key={k()} width="256" height="256" fill="url(#g3)" />)
	}

	// 2. Top Decor
	const topDecor: React.ReactNode[] = []

	if (dna.top === 0) {
		// Antenna
		topDecor.push(
			<rect
				key={k()}
				x={(h.x + Math.floor(h.w / 2)) * cell}
				y={(h.y - 2) * cell}
				width={1 * cell}
				height={2 * cell}
				fill="none"
				stroke={fg}
				strokeWidth={strokeW}
				strokeLinejoin="miter"
			/>,
		)
		topDecor.push(
			<rect
				key={k()}
				x={(h.x + Math.floor(h.w / 2) - 1) * cell}
				y={(h.y - 3) * cell}
				width={3 * cell}
				height={1 * cell}
				fill={fg}
			/>,
		)
	} else if (dna.top === 1) {
		// Double Vent
		topDecor.push(
			<rect key={k()} x={(h.x + 1) * cell} y={(h.y - 1) * cell} width={2 * cell} height={1 * cell} fill={fg} />,
		)
		topDecor.push(
			<rect
				key={k()}
				x={(h.x + h.w - 4) * cell}
				y={(h.y - 1) * cell}
				width={2 * cell}
				height={1 * cell}
				fill={fg}
			/>,
		)
	} else if (dna.top === 2) {
		// Flat Heatsink
		topDecor.push(
			<rect
				key={k()}
				x={(h.x + 1) * cell}
				y={(h.y - 2) * cell}
				width={(h.w - 2) * cell}
				height={2 * cell}
				fill="none"
				stroke={fg}
				strokeWidth={strokeW}
			/>,
		)
		topDecor.push(
			<rect
				key={k()}
				x={(h.x + 2) * cell}
				y={(h.y - 1.5) * cell}
				width={(h.w - 4) * cell}
				height={1 * cell}
				fill={fg}
			/>,
		)
	} else if (dna.top === 3) {
		// Offset node
		topDecor.push(
			<rect key={k()} x={(h.x + 1) * cell} y={(h.y - 2) * cell} width={1 * cell} height={2 * cell} fill={fg} />,
		)
	} else if (dna.top === 4) {
		// Stepped Roof
		topDecor.push(
			<rect
				key={k()}
				x={(h.x + 2) * cell}
				y={(h.y - 1) * cell}
				width={(h.w - 4) * cell}
				height={1 * cell}
				fill={fillStyle}
				stroke={fg}
				strokeWidth={strokeW}
			/>,
		)
		topDecor.push(
			<rect
				key={k()}
				x={(h.x + 3) * cell}
				y={(h.y - 2) * cell}
				width={(h.w - 6) * cell}
				height={1 * cell}
				fill={fg}
			/>,
		)
	} else if (dna.top === 5) {
		// Radar dish
		topDecor.push(
			<rect
				key={k()}
				x={(h.x + h.w - 3) * cell}
				y={(h.y - 3) * cell}
				width={2 * cell}
				height={2 * cell}
				fill="none"
				stroke={fg}
				strokeWidth={strokeW}
			/>,
		)
		topDecor.push(
			<rect
				key={k()}
				x={(h.x + h.w - 2.5) * cell}
				y={(h.y - 2.5) * cell}
				width={1 * cell}
				height={1 * cell}
				fill={fg}
			/>,
		)
		topDecor.push(
			<rect
				key={k()}
				x={(h.x + h.w - 2.5) * cell}
				y={(h.y - 1) * cell}
				width={1 * cell}
				height={1 * cell}
				fill={fg}
			/>,
		)
	} else if (dna.top === 6) {
		// Handle
		topDecor.push(
			<rect
				key={k()}
				x={(h.x + 1) * cell}
				y={(h.y - 2) * cell}
				width={(h.w - 2) * cell}
				height={2 * cell}
				fill="none"
				stroke={fg}
				strokeWidth={strokeW}
			/>,
		)
		topDecor.push(
			<rect
				key={k()}
				x={(h.x + 2) * cell}
				y={(h.y - 1) * cell}
				width={(h.w - 4) * cell}
				height={2 * cell}
				fill={bg}
			/>,
		)
	}
	// dna.top === 7: no top decor

	// 3. Side Decor
	const sideDecor: React.ReactNode[] = []

	if (dna.side === 0) {
		// Left Nodes
		sideDecor.push(
			<rect
				key={k()}
				x={(h.x - 2) * cell}
				y={(h.y + 2) * cell}
				width={2 * cell}
				height={3 * cell}
				fill="none"
				stroke={fg}
				strokeWidth={strokeW}
			/>,
		)
		sideDecor.push(
			<rect
				key={k()}
				x={(h.x - 3) * cell}
				y={(h.y + 3) * cell}
				width={1 * cell}
				height={1 * cell}
				fill={fg}
			/>,
		)
	} else if (dna.side === 1) {
		// Left bracket
		sideDecor.push(
			<rect
				key={k()}
				x={(h.x - 1) * cell}
				y={(h.y + 1) * cell}
				width={1 * cell}
				height={4 * cell}
				fill={fg}
			/>,
		)
	} else if (dna.side === 2) {
		// Floating blocks
		sideDecor.push(
			<rect
				key={k()}
				x={(h.x - 2) * cell}
				y={(h.y + 3) * cell}
				width={1 * cell}
				height={1 * cell}
				fill={fg}
			/>,
		)
		sideDecor.push(
			<rect
				key={k()}
				x={(h.x - 2) * cell}
				y={(h.y + 5) * cell}
				width={1 * cell}
				height={1 * cell}
				fill={fg}
			/>,
		)
	} else if (dna.side === 3) {
		// Exhaust
		sideDecor.push(
			<rect
				key={k()}
				x={(h.x - 2) * cell}
				y={(h.y + 4) * cell}
				width={2 * cell}
				height={2 * cell}
				fill="none"
				stroke={fg}
				strokeWidth={strokeW}
			/>,
		)
		sideDecor.push(
			<rect
				key={k()}
				x={(h.x - 1) * cell}
				y={(h.y + 4.5) * cell}
				width={1 * cell}
				height={1 * cell}
				fill={fg}
			/>,
		)
	} else if (dna.side === 4) {
		// Large Heatsink
		sideDecor.push(
			<rect
				key={k()}
				x={(h.x - 2) * cell}
				y={(h.y + 2) * cell}
				width={2 * cell}
				height={4 * cell}
				fill={fillStyle}
				stroke={fg}
				strokeWidth={strokeW}
			/>,
		)
		sideDecor.push(
			<rect
				key={k()}
				x={(h.x - 1.5) * cell}
				y={(h.y + 3) * cell}
				width={1.5 * cell}
				height={0.5 * cell}
				fill={fg}
			/>,
		)
		sideDecor.push(
			<rect
				key={k()}
				x={(h.x - 1.5) * cell}
				y={(h.y + 4.5) * cell}
				width={1.5 * cell}
				height={0.5 * cell}
				fill={fg}
			/>,
		)
	} else if (dna.side === 5) {
		// Both sides pins
		sideDecor.push(
			<rect
				key={k()}
				x={(h.x - 1) * cell}
				y={(h.y + 2) * cell}
				width={1 * cell}
				height={1 * cell}
				fill={fg}
			/>,
		)
		sideDecor.push(
			<rect
				key={k()}
				x={(h.x + h.w) * cell}
				y={(h.y + 2) * cell}
				width={1 * cell}
				height={1 * cell}
				fill={fg}
			/>,
		)
	} else if (dna.side === 6) {
		// Side Antenna
		sideDecor.push(
			<rect
				key={k()}
				x={(h.x - 2) * cell}
				y={(h.y + 2) * cell}
				width={2 * cell}
				height={1 * cell}
				fill={fg}
			/>,
		)
		sideDecor.push(
			<rect
				key={k()}
				x={(h.x - 3) * cell}
				y={(h.y + 1) * cell}
				width={1 * cell}
				height={3 * cell}
				fill={fillStyle}
				stroke={fg}
				strokeWidth={strokeW}
			/>,
		)
	}
	// dna.side === 7: no side decor

	// 4. Pattern elements (only in solid mode)
	const patternElements: React.ReactNode[] = []
	const patternDefs: React.ReactNode[] = []

	if (style === 'solid') {
		if (dna.pattern === 1) {
			// Horizontal Ribbing
			patternElements.push(
				<rect
					key={k()}
					x={(h.x + 1) * cell}
					y={(h.y + 1) * cell}
					width={(h.w - cut - 1) * cell}
					height={1 * cell}
					fill={mid}
					opacity="0.3"
				/>,
			)
			patternElements.push(
				<rect
					key={k()}
					x={(h.x + 1) * cell}
					y={(h.y + 3) * cell}
					width={(h.w - cut - 1) * cell}
					height={1 * cell}
					fill={mid}
					opacity="0.3"
				/>,
			)
			patternElements.push(
				<rect
					key={k()}
					x={(h.x + 1) * cell}
					y={(h.y + 5) * cell}
					width={(h.w - cut - 1) * cell}
					height={1 * cell}
					fill={mid}
					opacity="0.3"
				/>,
			)
		} else if (dna.pattern === 2) {
			// Vertical Shading
			patternElements.push(
				<rect
					key={k()}
					x={(h.x + 1) * cell}
					y={(h.y + 1) * cell}
					width={2 * cell}
					height={(h.h - 2) * cell}
					fill={mid}
					opacity="0.2"
				/>,
			)
		} else if (dna.pattern === 3) {
			// Inner Dot Grid
			patternDefs.push(
				<pattern key={k()} id="pg" width="8" height="8" patternUnits="userSpaceOnUse">
					<rect width="2" height="2" fill={mid} opacity="0.3" />
				</pattern>,
			)
			patternElements.push(<path key={k()} d={headPath} fill="url(#pg)" pointerEvents="none" />)
		}
	}

	// 5. Eyes / Sensors
	const eyeElements: React.ReactNode[] = []

	if (dna.eye === 0) {
		// Wide Visor
		eyeElements.push(
			<rect
				key={k()}
				x={(h.x + 1) * cell}
				y={(h.y + 2) * cell}
				width={(h.w - 2) * cell}
				height={1 * cell}
				fill={eyeFill}
				stroke={eyeColor}
				strokeWidth={eyeStrokeWidth}
			/>,
		)
	} else if (dna.eye === 1) {
		// Dual Sensors
		eyeElements.push(
			<rect
				key={k()}
				x={(h.x + 1) * cell}
				y={(h.y + 2) * cell}
				width={1 * cell}
				height={1 * cell}
				fill={eyeColor}
			/>,
		)
		eyeElements.push(
			<rect
				key={k()}
				x={(h.x + h.w - 2) * cell}
				y={(h.y + 2) * cell}
				width={1 * cell}
				height={1 * cell}
				fill={eyeColor}
			/>,
		)
	} else if (dna.eye === 2) {
		// Asymmetric
		eyeElements.push(
			<rect
				key={k()}
				x={(h.x + 1) * cell}
				y={(h.y + 2) * cell}
				width={2 * cell}
				height={1 * cell}
				fill={eyeColor}
			/>,
		)
		eyeElements.push(
			<rect
				key={k()}
				x={(h.x + h.w - 2) * cell}
				y={(h.y + 2) * cell}
				width={1 * cell}
				height={1 * cell}
				fill={eyeColor}
			/>,
		)
	} else if (dna.eye === 3) {
		// Cyclops Core
		const cx = h.x + Math.floor(h.w / 2) - 1
		eyeElements.push(
			<rect
				key={k()}
				x={cx * cell}
				y={(h.y + 2) * cell}
				width={2 * cell}
				height={2 * cell}
				fill="none"
				stroke={eyeColor}
				strokeWidth={strokeW}
			/>,
		)
		eyeElements.push(
			<rect
				key={k()}
				x={(cx + 0.5) * cell}
				y={(h.y + 2.5) * cell}
				width={1 * cell}
				height={1 * cell}
				fill={eyeColor}
			/>,
		)
	} else if (dna.eye === 4) {
		// Grid Matrix
		eyeElements.push(
			<rect
				key={k()}
				x={(h.x + 1) * cell}
				y={(h.y + 2) * cell}
				width={1 * cell}
				height={1 * cell}
				fill={eyeColor}
			/>,
		)
		eyeElements.push(
			<rect
				key={k()}
				x={(h.x + 2.5) * cell}
				y={(h.y + 2) * cell}
				width={1 * cell}
				height={1 * cell}
				fill={eyeColor}
			/>,
		)
		if (h.w > 6) {
			eyeElements.push(
				<rect
					key={k()}
					x={(h.x + 4) * cell}
					y={(h.y + 2) * cell}
					width={1 * cell}
					height={1 * cell}
					fill={eyeColor}
				/>,
			)
		}
	} else if (dna.eye === 5) {
		// Vertical Slit
		const cx = h.x + Math.floor(h.w / 2) - 0.5
		eyeElements.push(
			<rect
				key={k()}
				x={cx * cell}
				y={(h.y + 1.5) * cell}
				width={1 * cell}
				height={3 * cell}
				fill={eyeColor}
			/>,
		)
	} else if (dna.eye === 6) {
		// Offset Squares
		eyeElements.push(
			<rect
				key={k()}
				x={(h.x + 1) * cell}
				y={(h.y + 2) * cell}
				width={1 * cell}
				height={1 * cell}
				fill={eyeColor}
			/>,
		)
		eyeElements.push(
			<rect
				key={k()}
				x={(h.x + 2) * cell}
				y={(h.y + 3) * cell}
				width={1 * cell}
				height={1 * cell}
				fill={eyeColor}
			/>,
		)
	} else if (dna.eye === 7) {
		// Scanning Bar
		eyeElements.push(
			<rect
				key={k()}
				x={(h.x + 1) * cell}
				y={(h.y + 2) * cell}
				width={(h.w - 2) * cell}
				height={1 * cell}
				fill="none"
				stroke={eyeColor}
				strokeWidth={strokeW}
			/>,
		)
		eyeElements.push(
			<rect
				key={k()}
				x={(h.x + 1.5) * cell}
				y={(h.y + 2.25) * cell}
				width={1.5 * cell}
				height={0.5 * cell}
				fill={eyeColor}
			/>,
		)
	}

	// 6. Jaw / Port
	const jawElements: React.ReactNode[] = []

	if (dna.jaw === 0) {
		// Standard block
		jawElements.push(
			<rect
				key={k()}
				x={(h.x + 1) * cell}
				y={(jY - 2) * cell}
				width={2 * cell}
				height={1 * cell}
				fill={eyeFill}
				stroke={eyeColor}
				strokeWidth={eyeStrokeWidth}
			/>,
		)
	} else if (dna.jaw === 1) {
		// Split grille
		jawElements.push(
			<rect
				key={k()}
				x={(h.x + 1) * cell}
				y={(jY - 2) * cell}
				width={0.5 * cell}
				height={1 * cell}
				fill={eyeColor}
			/>,
		)
		jawElements.push(
			<rect
				key={k()}
				x={(h.x + 2) * cell}
				y={(jY - 2) * cell}
				width={0.5 * cell}
				height={1 * cell}
				fill={eyeColor}
			/>,
		)
	} else if (dna.jaw === 2) {
		// Wide slot
		jawElements.push(
			<rect
				key={k()}
				x={(h.x + 0.5) * cell}
				y={(jY - 2.5) * cell}
				width={2.5 * cell}
				height={0.5 * cell}
				fill={eyeColor}
			/>,
		)
	} else if (dna.jaw === 3) {
		// Outline jaw
		jawElements.push(
			<rect
				key={k()}
				x={(h.x + 1) * cell}
				y={(jY - 2) * cell}
				width={2 * cell}
				height={1 * cell}
				fill="none"
				stroke={eyeColor}
				strokeWidth={strokeW}
			/>,
		)
		jawElements.push(
			<rect
				key={k()}
				x={(h.x + 1.5) * cell}
				y={(jY - 1.75) * cell}
				width={0.5 * cell}
				height={0.5 * cell}
				fill={eyeColor}
			/>,
		)
	} else if (dna.jaw === 4) {
		// Barcode
		jawElements.push(
			<rect
				key={k()}
				x={(h.x + 1) * cell}
				y={(jY - 2) * cell}
				width={0.25 * cell}
				height={1 * cell}
				fill={eyeColor}
			/>,
		)
		jawElements.push(
			<rect
				key={k()}
				x={(h.x + 1.5) * cell}
				y={(jY - 2) * cell}
				width={0.5 * cell}
				height={1 * cell}
				fill={eyeColor}
			/>,
		)
		jawElements.push(
			<rect
				key={k()}
				x={(h.x + 2.25) * cell}
				y={(jY - 2) * cell}
				width={0.25 * cell}
				height={1 * cell}
				fill={eyeColor}
			/>,
		)
	} else if (dna.jaw === 5) {
		// Micro-vent
		jawElements.push(
			<rect
				key={k()}
				x={(h.x + 1) * cell}
				y={(jY - 3) * cell}
				width={2 * cell}
				height={2 * cell}
				fill="none"
				stroke={eyeColor}
				strokeWidth={strokeW}
			/>,
		)
		jawElements.push(
			<rect
				key={k()}
				x={(h.x + 1) * cell}
				y={(jY - 2) * cell}
				width={2 * cell}
				height={0.25 * cell}
				fill={eyeColor}
			/>,
		)
	} else if (dna.jaw === 6) {
		// Asym port
		jawElements.push(
			<rect
				key={k()}
				x={(h.x + 1) * cell}
				y={(jY - 3) * cell}
				width={1 * cell}
				height={2 * cell}
				fill={eyeColor}
			/>,
		)
		jawElements.push(
			<rect
				key={k()}
				x={(h.x + 2.5) * cell}
				y={(jY - 1.5) * cell}
				width={0.5 * cell}
				height={0.5 * cell}
				fill={eyeColor}
			/>,
		)
	} else if (dna.jaw === 7) {
		// Heavy Intake
		jawElements.push(
			<rect
				key={k()}
				x={(h.x + 1) * cell}
				y={(jY - 2.5) * cell}
				width={2 * cell}
				height={1.5 * cell}
				fill={eyeColor}
			/>,
		)
	}

	// LOD — strip detail at small render sizes to avoid sub-pixel noise
	// S (≤48): head + eyes + brand cutout + LED only
	// M (49-96): + top/side decor, jaw, frame
	// L (97+): everything (bg grid, patterns)
	const lod = size <= 48 ? 'S' : size <= 96 ? 'M' : 'L'

	return (
		<svg
			viewBox="0 0 256 256"
			width={size}
			height={size}
			className={className}
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label={`Construct avatar for ${seed}`}
		>
			{/* Background */}
			<rect width="256" height="256" fill={bg} />

			{/* Background Grid + Pattern Defs (L only) */}
			{lod === 'L' && (bgGridDefs.length > 0 || patternDefs.length > 0) && (
				<defs>
					{bgGridDefs}
					{patternDefs}
				</defs>
			)}
			{lod === 'L' && bgGridRects}

			{/* Top Decor (M+) */}
			{lod !== 'S' && topDecor}

			{/* Side Decor (M+) */}
			{lod !== 'S' && sideDecor}

			{/* Head Base with Brand Cutout */}
			<path d={headPath} fill={fillStyle} stroke={fg} strokeWidth={strokeW} strokeLinejoin="miter" />

			{/* Patterns (L only) */}
			{lod === 'L' && patternElements}

			{/* Eyes / Sensors */}
			{eyeElements}

			{/* Jaw / Port (M+) */}
			{lod !== 'S' && jawElements}

			{/* Semantic LED */}
			<rect x={(h.x + 0.5) * cell} y={(h.y + 0.5) * cell} width={0.5 * cell} height={0.5 * cell} fill={ledColor} />

			{/* Brand Accent — Purple Missing Piece */}
			<rect x={(h.x + h.w - 2) * cell} y={(h.y + h.h - 2) * cell} width={2 * cell} height={2 * cell} fill={brand} />

			{/* Frame border (M+) */}
			{lod !== 'S' && <rect width="256" height="256" fill="none" stroke={mid} strokeWidth="8" />}
		</svg>
	)
}
