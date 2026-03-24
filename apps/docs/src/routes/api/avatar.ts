import { createFileRoute } from '@tanstack/react-router'

/**
 * Construct avatar API — deterministic SVG robot from a seed string.
 *
 * Usage:  GET /api/avatar?seed=my-agent&size=120&style=solid&theme=dark
 *   seed   — any string (agent ID, name, etc.) — default 'default'
 *   size   — pixel width/height 16-512 — default 80
 *   style  — 'solid' | 'wireframe' — default 'solid'
 *   theme  — 'dark' | 'light' — default 'dark'
 *
 * Returns image/svg+xml, cacheable for 7 days.
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
}

const HEADS: HeadDef[] = [
	{ x: 3, y: 3, w: 10, h: 10 },
	{ x: 4, y: 2, w: 8, h: 12 },
	{ x: 2, y: 4, w: 12, h: 8 },
	{ x: 3, y: 2, w: 10, h: 11 },
	{ x: 5, y: 1, w: 6, h: 14 },
	{ x: 1, y: 5, w: 14, h: 7 },
	{ x: 4, y: 4, w: 8, h: 9 },
	{ x: 2, y: 3, w: 11, h: 10 },
]

const LED_COLORS = ['#00E676', '#FF3D57', '#FFB300', '#40C4FF'] as const

// ── SVG Builder ────────────────────────────────────────────────────────
function generateSvg(
	seed: string,
	size: number,
	style: 'solid' | 'wireframe',
	theme: 'dark' | 'light',
): string {
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
	const eyeStrokeW = style === 'wireframe' ? strokeW : 0

	// LOD — strip detail at small render sizes to avoid sub-pixel noise
	// S (≤48): head + eyes + brand cutout + LED only
	// M (49-96): + top/side decor, jaw, frame
	// L (97+): everything (bg grid, patterns)
	const lod = size <= 48 ? 'S' : size <= 96 ? 'M' : 'L'

	let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${size}" height="${size}">`
	svg += `<rect width="256" height="256" fill="${bg}" />`

	// 1. Background Grid (L only)
	if (lod === 'L' && dna.bg === 0) {
		svg += `<defs><pattern id="g0" width="16" height="16" patternUnits="userSpaceOnUse"><path d="M 16 0 L 0 0 0 16" fill="none" stroke="${mid}" stroke-width="1" opacity="0.4" /></pattern></defs><rect width="256" height="256" fill="url(#g0)" />`
	} else if (lod === 'L' && dna.bg === 1) {
		svg += `<defs><pattern id="g1" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 32 0 L 0 0 0 32" fill="none" stroke="${mid}" stroke-width="1" opacity="0.6" /></pattern></defs><rect width="256" height="256" fill="url(#g1)" />`
	} else if (lod === 'L' && dna.bg === 2) {
		svg += `<defs><pattern id="g2" width="32" height="32" patternUnits="userSpaceOnUse"><path d="M 15 16 H 17 M 16 15 V 17" stroke="${mid}" stroke-width="2" /></pattern></defs><rect width="256" height="256" fill="url(#g2)" />`
	} else if (lod === 'L' && dna.bg === 3) {
		svg += `<defs><pattern id="g3" width="16" height="16" patternUnits="userSpaceOnUse"><rect x="0" y="0" width="2" height="2" fill="${mid}" opacity="0.8" /></pattern></defs><rect width="256" height="256" fill="url(#g3)" />`
	}

	// 2. Top Decor — M+ only
	if (lod !== 'S' && dna.top === 0) {
		// Antenna
		svg += `<rect x="${(h.x + Math.floor(h.w / 2)) * cell}" y="${(h.y - 2) * cell}" width="${1 * cell}" height="${2 * cell}" fill="none" stroke="${fg}" stroke-width="${strokeW}" stroke-linejoin="miter"/>`
		svg += `<rect x="${(h.x + Math.floor(h.w / 2) - 1) * cell}" y="${(h.y - 3) * cell}" width="${3 * cell}" height="${1 * cell}" fill="${fg}" />`
	} else if (lod !== 'S' && dna.top === 1) {
		// Double Vent
		svg += `<rect x="${(h.x + 1) * cell}" y="${(h.y - 1) * cell}" width="${2 * cell}" height="${1 * cell}" fill="${fg}" />`
		svg += `<rect x="${(h.x + h.w - 4) * cell}" y="${(h.y - 1) * cell}" width="${2 * cell}" height="${1 * cell}" fill="${fg}" />`
	} else if (lod !== 'S' && dna.top === 2) {
		// Flat Heatsink
		svg += `<rect x="${(h.x + 1) * cell}" y="${(h.y - 2) * cell}" width="${(h.w - 2) * cell}" height="${2 * cell}" fill="none" stroke="${fg}" stroke-width="${strokeW}" />`
		svg += `<rect x="${(h.x + 2) * cell}" y="${(h.y - 1.5) * cell}" width="${(h.w - 4) * cell}" height="${1 * cell}" fill="${fg}" />`
	} else if (lod !== 'S' && dna.top === 3) {
		// Offset node
		svg += `<rect x="${(h.x + 1) * cell}" y="${(h.y - 2) * cell}" width="${1 * cell}" height="${2 * cell}" fill="${fg}" />`
	} else if (lod !== 'S' && dna.top === 4) {
		// Stepped Roof
		svg += `<rect x="${(h.x + 2) * cell}" y="${(h.y - 1) * cell}" width="${(h.w - 4) * cell}" height="${1 * cell}" fill="${fillStyle}" stroke="${fg}" stroke-width="${strokeW}" />`
		svg += `<rect x="${(h.x + 3) * cell}" y="${(h.y - 2) * cell}" width="${(h.w - 6) * cell}" height="${1 * cell}" fill="${fg}" />`
	} else if (lod !== 'S' && dna.top === 5) {
		// Radar dish
		svg += `<rect x="${(h.x + h.w - 3) * cell}" y="${(h.y - 3) * cell}" width="${2 * cell}" height="${2 * cell}" fill="none" stroke="${fg}" stroke-width="${strokeW}" />`
		svg += `<rect x="${(h.x + h.w - 2.5) * cell}" y="${(h.y - 2.5) * cell}" width="${1 * cell}" height="${1 * cell}" fill="${fg}" />`
		svg += `<rect x="${(h.x + h.w - 2.5) * cell}" y="${(h.y - 1) * cell}" width="${1 * cell}" height="${1 * cell}" fill="${fg}" />`
	} else if (lod !== 'S' && dna.top === 6) {
		// Handle
		svg += `<rect x="${(h.x + 1) * cell}" y="${(h.y - 2) * cell}" width="${(h.w - 2) * cell}" height="${2 * cell}" fill="none" stroke="${fg}" stroke-width="${strokeW}" />`
		svg += `<rect x="${(h.x + 2) * cell}" y="${(h.y - 1) * cell}" width="${(h.w - 4) * cell}" height="${2 * cell}" fill="${bg}" />`
	}
	// dna.top === 7: no top decor

	// 3. Side Decor — M+ only
	if (lod !== 'S' && dna.side === 0) {
		// Left Nodes
		svg += `<rect x="${(h.x - 2) * cell}" y="${(h.y + 2) * cell}" width="${2 * cell}" height="${3 * cell}" fill="none" stroke="${fg}" stroke-width="${strokeW}" />`
		svg += `<rect x="${(h.x - 3) * cell}" y="${(h.y + 3) * cell}" width="${1 * cell}" height="${1 * cell}" fill="${fg}" />`
	} else if (lod !== 'S' && dna.side === 1) {
		// Left bracket
		svg += `<rect x="${(h.x - 1) * cell}" y="${(h.y + 1) * cell}" width="${1 * cell}" height="${4 * cell}" fill="${fg}" />`
	} else if (lod !== 'S' && dna.side === 2) {
		// Floating blocks
		svg += `<rect x="${(h.x - 2) * cell}" y="${(h.y + 3) * cell}" width="${1 * cell}" height="${1 * cell}" fill="${fg}" />`
		svg += `<rect x="${(h.x - 2) * cell}" y="${(h.y + 5) * cell}" width="${1 * cell}" height="${1 * cell}" fill="${fg}" />`
	} else if (lod !== 'S' && dna.side === 3) {
		// Exhaust
		svg += `<rect x="${(h.x - 2) * cell}" y="${(h.y + 4) * cell}" width="${2 * cell}" height="${2 * cell}" fill="none" stroke="${fg}" stroke-width="${strokeW}" />`
		svg += `<rect x="${(h.x - 1) * cell}" y="${(h.y + 4.5) * cell}" width="${1 * cell}" height="${1 * cell}" fill="${fg}" />`
	} else if (lod !== 'S' && dna.side === 4) {
		// Large Heatsink
		svg += `<rect x="${(h.x - 2) * cell}" y="${(h.y + 2) * cell}" width="${2 * cell}" height="${4 * cell}" fill="${fillStyle}" stroke="${fg}" stroke-width="${strokeW}" />`
		svg += `<rect x="${(h.x - 1.5) * cell}" y="${(h.y + 3) * cell}" width="${1.5 * cell}" height="${0.5 * cell}" fill="${fg}" />`
		svg += `<rect x="${(h.x - 1.5) * cell}" y="${(h.y + 4.5) * cell}" width="${1.5 * cell}" height="${0.5 * cell}" fill="${fg}" />`
	} else if (lod !== 'S' && dna.side === 5) {
		// Both sides pins
		svg += `<rect x="${(h.x - 1) * cell}" y="${(h.y + 2) * cell}" width="${1 * cell}" height="${1 * cell}" fill="${fg}" />`
		svg += `<rect x="${(h.x + h.w) * cell}" y="${(h.y + 2) * cell}" width="${1 * cell}" height="${1 * cell}" fill="${fg}" />`
	} else if (lod !== 'S' && dna.side === 6) {
		// Side Antenna
		svg += `<rect x="${(h.x - 2) * cell}" y="${(h.y + 2) * cell}" width="${2 * cell}" height="${1 * cell}" fill="${fg}" />`
		svg += `<rect x="${(h.x - 3) * cell}" y="${(h.y + 1) * cell}" width="${1 * cell}" height="${3 * cell}" fill="${fillStyle}" stroke="${fg}" stroke-width="${strokeW}" />`
	}
	// dna.side === 7: no side decor

	// 4. Head Base with Brand Cutout
	const headPath = `M ${h.x * cell} ${h.y * cell} H ${(h.x + h.w) * cell} V ${(h.y + h.h - cut) * cell} H ${(h.x + h.w - cut) * cell} V ${(h.y + h.h) * cell} H ${h.x * cell} Z`
	svg += `<path d="${headPath}" fill="${fillStyle}" stroke="${fg}" stroke-width="${strokeW}" stroke-linejoin="miter" />`

	// 5. Pattern (L only, solid only)
	if (lod === 'L' && style === 'solid') {
		if (dna.pattern === 1) {
			// Horizontal Ribbing
			svg += `<rect x="${(h.x + 1) * cell}" y="${(h.y + 1) * cell}" width="${(h.w - cut - 1) * cell}" height="${1 * cell}" fill="${mid}" opacity="0.3" />`
			svg += `<rect x="${(h.x + 1) * cell}" y="${(h.y + 3) * cell}" width="${(h.w - cut - 1) * cell}" height="${1 * cell}" fill="${mid}" opacity="0.3" />`
			svg += `<rect x="${(h.x + 1) * cell}" y="${(h.y + 5) * cell}" width="${(h.w - cut - 1) * cell}" height="${1 * cell}" fill="${mid}" opacity="0.3" />`
		} else if (dna.pattern === 2) {
			// Vertical Shading
			svg += `<rect x="${(h.x + 1) * cell}" y="${(h.y + 1) * cell}" width="${2 * cell}" height="${(h.h - 2) * cell}" fill="${mid}" opacity="0.2" />`
		} else if (dna.pattern === 3) {
			// Inner Dot Grid
			svg += `<defs><pattern id="pg" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="${mid}" opacity="0.3"/></pattern></defs>`
			svg += `<path d="${headPath}" fill="url(#pg)" pointer-events="none" />`
		}
	}

	// 6. Eyes / Sensors (8 variants)
	if (dna.eye === 0) {
		// Wide Visor
		svg += `<rect x="${(h.x + 1) * cell}" y="${(h.y + 2) * cell}" width="${(h.w - 2) * cell}" height="${1 * cell}" fill="${eyeFill}" stroke="${eyeColor}" stroke-width="${eyeStrokeW}" />`
	} else if (dna.eye === 1) {
		// Dual Sensors
		svg += `<rect x="${(h.x + 1) * cell}" y="${(h.y + 2) * cell}" width="${1 * cell}" height="${1 * cell}" fill="${eyeColor}" />`
		svg += `<rect x="${(h.x + h.w - 2) * cell}" y="${(h.y + 2) * cell}" width="${1 * cell}" height="${1 * cell}" fill="${eyeColor}" />`
	} else if (dna.eye === 2) {
		// Asymmetric
		svg += `<rect x="${(h.x + 1) * cell}" y="${(h.y + 2) * cell}" width="${2 * cell}" height="${1 * cell}" fill="${eyeColor}" />`
		svg += `<rect x="${(h.x + h.w - 2) * cell}" y="${(h.y + 2) * cell}" width="${1 * cell}" height="${1 * cell}" fill="${eyeColor}" />`
	} else if (dna.eye === 3) {
		// Cyclops Core
		const cx = h.x + Math.floor(h.w / 2) - 1
		svg += `<rect x="${cx * cell}" y="${(h.y + 2) * cell}" width="${2 * cell}" height="${2 * cell}" fill="none" stroke="${eyeColor}" stroke-width="${strokeW}" />`
		svg += `<rect x="${(cx + 0.5) * cell}" y="${(h.y + 2.5) * cell}" width="${1 * cell}" height="${1 * cell}" fill="${eyeColor}" />`
	} else if (dna.eye === 4) {
		// Grid Matrix
		svg += `<rect x="${(h.x + 1) * cell}" y="${(h.y + 2) * cell}" width="${1 * cell}" height="${1 * cell}" fill="${eyeColor}" />`
		svg += `<rect x="${(h.x + 2.5) * cell}" y="${(h.y + 2) * cell}" width="${1 * cell}" height="${1 * cell}" fill="${eyeColor}" />`
		if (h.w > 6) svg += `<rect x="${(h.x + 4) * cell}" y="${(h.y + 2) * cell}" width="${1 * cell}" height="${1 * cell}" fill="${eyeColor}" />`
	} else if (dna.eye === 5) {
		// Vertical Slit
		const cx = h.x + Math.floor(h.w / 2) - 0.5
		svg += `<rect x="${cx * cell}" y="${(h.y + 1.5) * cell}" width="${1 * cell}" height="${3 * cell}" fill="${eyeColor}" />`
	} else if (dna.eye === 6) {
		// Offset Squares
		svg += `<rect x="${(h.x + 1) * cell}" y="${(h.y + 2) * cell}" width="${1 * cell}" height="${1 * cell}" fill="${eyeColor}" />`
		svg += `<rect x="${(h.x + 2) * cell}" y="${(h.y + 3) * cell}" width="${1 * cell}" height="${1 * cell}" fill="${eyeColor}" />`
	} else if (dna.eye === 7) {
		// Scanning Bar
		svg += `<rect x="${(h.x + 1) * cell}" y="${(h.y + 2) * cell}" width="${(h.w - 2) * cell}" height="${1 * cell}" fill="none" stroke="${eyeColor}" stroke-width="${strokeW}" />`
		svg += `<rect x="${(h.x + 1.5) * cell}" y="${(h.y + 2.25) * cell}" width="${1.5 * cell}" height="${0.5 * cell}" fill="${eyeColor}" />`
	}

	// 7. Jaw / Port — M+ only
	if (lod !== 'S') {
	if (dna.jaw === 0) {
		// Standard block
		svg += `<rect x="${(h.x + 1) * cell}" y="${(jY - 2) * cell}" width="${2 * cell}" height="${1 * cell}" fill="${eyeFill}" stroke="${eyeColor}" stroke-width="${eyeStrokeW}" />`
	} else if (dna.jaw === 1) {
		// Split grille
		svg += `<rect x="${(h.x + 1) * cell}" y="${(jY - 2) * cell}" width="${0.5 * cell}" height="${1 * cell}" fill="${eyeColor}" />`
		svg += `<rect x="${(h.x + 2) * cell}" y="${(jY - 2) * cell}" width="${0.5 * cell}" height="${1 * cell}" fill="${eyeColor}" />`
	} else if (dna.jaw === 2) {
		// Wide slot
		svg += `<rect x="${(h.x + 0.5) * cell}" y="${(jY - 2.5) * cell}" width="${2.5 * cell}" height="${0.5 * cell}" fill="${eyeColor}" />`
	} else if (dna.jaw === 3) {
		// Outline jaw
		svg += `<rect x="${(h.x + 1) * cell}" y="${(jY - 2) * cell}" width="${2 * cell}" height="${1 * cell}" fill="none" stroke="${eyeColor}" stroke-width="${strokeW}" />`
		svg += `<rect x="${(h.x + 1.5) * cell}" y="${(jY - 1.75) * cell}" width="${0.5 * cell}" height="${0.5 * cell}" fill="${eyeColor}" />`
	} else if (dna.jaw === 4) {
		// Barcode
		svg += `<rect x="${(h.x + 1) * cell}" y="${(jY - 2) * cell}" width="${0.25 * cell}" height="${1 * cell}" fill="${eyeColor}" />`
		svg += `<rect x="${(h.x + 1.5) * cell}" y="${(jY - 2) * cell}" width="${0.5 * cell}" height="${1 * cell}" fill="${eyeColor}" />`
		svg += `<rect x="${(h.x + 2.25) * cell}" y="${(jY - 2) * cell}" width="${0.25 * cell}" height="${1 * cell}" fill="${eyeColor}" />`
	} else if (dna.jaw === 5) {
		// Micro-vent
		svg += `<rect x="${(h.x + 1) * cell}" y="${(jY - 3) * cell}" width="${2 * cell}" height="${2 * cell}" fill="none" stroke="${eyeColor}" stroke-width="${strokeW}" />`
		svg += `<rect x="${(h.x + 1) * cell}" y="${(jY - 2) * cell}" width="${2 * cell}" height="${0.25 * cell}" fill="${eyeColor}" />`
	} else if (dna.jaw === 6) {
		// Asym port
		svg += `<rect x="${(h.x + 1) * cell}" y="${(jY - 3) * cell}" width="${1 * cell}" height="${2 * cell}" fill="${eyeColor}" />`
		svg += `<rect x="${(h.x + 2.5) * cell}" y="${(jY - 1.5) * cell}" width="${0.5 * cell}" height="${0.5 * cell}" fill="${eyeColor}" />`
	} else if (dna.jaw === 7) {
		// Heavy Intake
		svg += `<rect x="${(h.x + 1) * cell}" y="${(jY - 2.5) * cell}" width="${2 * cell}" height="${1.5 * cell}" fill="${eyeColor}" />`
	}
	} // end lod !== 'S' jaw block

	// 8. Semantic LED
	svg += `<rect x="${(h.x + 0.5) * cell}" y="${(h.y + 0.5) * cell}" width="${0.5 * cell}" height="${0.5 * cell}" fill="${ledColor}" />`

	// 9. Brand Accent — Purple Missing Piece
	svg += `<rect x="${(h.x + h.w - 2) * cell}" y="${(h.y + h.h - 2) * cell}" width="${2 * cell}" height="${2 * cell}" fill="${brand}" />`

	// 10. Frame border (M+ only)
	if (lod !== 'S') svg += `<rect width="256" height="256" fill="none" stroke="${mid}" stroke-width="8" />`

	svg += '</svg>'
	return svg
}

// ── Route Handler ───────────────────────────────────────────────────────
export const Route = createFileRoute('/api/avatar')({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const url = new URL(request.url)
				const seed = url.searchParams.get('seed') || 'default'
				const sizeParam = Number.parseInt(url.searchParams.get('size') || '80', 10)
				const size = Math.max(16, Math.min(512, Number.isNaN(sizeParam) ? 80 : sizeParam))
				const styleParam = url.searchParams.get('style')
				const style: 'solid' | 'wireframe' = styleParam === 'wireframe' ? 'wireframe' : 'solid'
				const themeParam = url.searchParams.get('theme')
				const theme: 'dark' | 'light' = themeParam === 'light' ? 'light' : 'dark'

				const svg = generateSvg(seed, size, style, theme)

				return new Response(svg, {
					headers: {
						'Content-Type': 'image/svg+xml',
						'Cache-Control': 'public, max-age=604800, s-maxage=604800, immutable',
						'Access-Control-Allow-Origin': '*',
					},
				})
			},
		},
	},
})
