/**
 * SVG string builder — used by API routes and server-side rendering.
 * Consumes shared core for PRNG, DNA, and color resolution.
 */
import { BRAND, CELL, STROKE_W, type ResolveOptions, resolveContext } from './core'

export type { ResolveOptions as GenerateAvatarOptions }

export function generateAvatarSvg(options: ResolveOptions): string {
	const c = resolveContext(options)
	const { dna, head: h, lod, size, style, seed } = c
	const { bg, fg, mid, ledColor, fillStyle, eyeColor, eyeFill, eyeStrokeW, jY, headPath } = c

	let svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="${size}" height="${size}" role="img" aria-label="Construct avatar for ${seed}">`
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
		svg += `<rect x="${(h.x + Math.floor(h.w / 2)) * CELL}" y="${(h.y - 2) * CELL}" width="${CELL}" height="${2 * CELL}" fill="none" stroke="${fg}" stroke-width="${STROKE_W}" stroke-linejoin="miter"/>`
		svg += `<rect x="${(h.x + Math.floor(h.w / 2) - 1) * CELL}" y="${(h.y - 3) * CELL}" width="${3 * CELL}" height="${CELL}" fill="${fg}" />`
	} else if (lod !== 'S' && dna.top === 1) {
		svg += `<rect x="${(h.x + 1) * CELL}" y="${(h.y - 1) * CELL}" width="${2 * CELL}" height="${CELL}" fill="${fg}" />`
		svg += `<rect x="${(h.x + h.w - 4) * CELL}" y="${(h.y - 1) * CELL}" width="${2 * CELL}" height="${CELL}" fill="${fg}" />`
	} else if (lod !== 'S' && dna.top === 2) {
		svg += `<rect x="${(h.x + 1) * CELL}" y="${(h.y - 2) * CELL}" width="${(h.w - 2) * CELL}" height="${2 * CELL}" fill="none" stroke="${fg}" stroke-width="${STROKE_W}" />`
		svg += `<rect x="${(h.x + 2) * CELL}" y="${(h.y - 1.5) * CELL}" width="${(h.w - 4) * CELL}" height="${CELL}" fill="${fg}" />`
	} else if (lod !== 'S' && dna.top === 3) {
		svg += `<rect x="${(h.x + 1) * CELL}" y="${(h.y - 2) * CELL}" width="${CELL}" height="${2 * CELL}" fill="${fg}" />`
	} else if (lod !== 'S' && dna.top === 4) {
		svg += `<rect x="${(h.x + 2) * CELL}" y="${(h.y - 1) * CELL}" width="${(h.w - 4) * CELL}" height="${CELL}" fill="${fillStyle}" stroke="${fg}" stroke-width="${STROKE_W}" />`
		svg += `<rect x="${(h.x + 3) * CELL}" y="${(h.y - 2) * CELL}" width="${(h.w - 6) * CELL}" height="${CELL}" fill="${fg}" />`
	} else if (lod !== 'S' && dna.top === 5) {
		svg += `<rect x="${(h.x + h.w - 3) * CELL}" y="${(h.y - 3) * CELL}" width="${2 * CELL}" height="${2 * CELL}" fill="none" stroke="${fg}" stroke-width="${STROKE_W}" />`
		svg += `<rect x="${(h.x + h.w - 2.5) * CELL}" y="${(h.y - 2.5) * CELL}" width="${CELL}" height="${CELL}" fill="${fg}" />`
		svg += `<rect x="${(h.x + h.w - 2.5) * CELL}" y="${(h.y - 1) * CELL}" width="${CELL}" height="${CELL}" fill="${fg}" />`
	} else if (lod !== 'S' && dna.top === 6) {
		svg += `<rect x="${(h.x + 1) * CELL}" y="${(h.y - 2) * CELL}" width="${(h.w - 2) * CELL}" height="${2 * CELL}" fill="none" stroke="${fg}" stroke-width="${STROKE_W}" />`
		svg += `<rect x="${(h.x + 2) * CELL}" y="${(h.y - 1) * CELL}" width="${(h.w - 4) * CELL}" height="${2 * CELL}" fill="${bg}" />`
	}

	// 3. Side Decor — M+ only
	if (lod !== 'S' && dna.side === 0) {
		svg += `<rect x="${(h.x - 2) * CELL}" y="${(h.y + 2) * CELL}" width="${2 * CELL}" height="${3 * CELL}" fill="none" stroke="${fg}" stroke-width="${STROKE_W}" />`
		svg += `<rect x="${(h.x - 3) * CELL}" y="${(h.y + 3) * CELL}" width="${CELL}" height="${CELL}" fill="${fg}" />`
	} else if (lod !== 'S' && dna.side === 1) {
		svg += `<rect x="${(h.x - 1) * CELL}" y="${(h.y + 1) * CELL}" width="${CELL}" height="${4 * CELL}" fill="${fg}" />`
	} else if (lod !== 'S' && dna.side === 2) {
		svg += `<rect x="${(h.x - 2) * CELL}" y="${(h.y + 3) * CELL}" width="${CELL}" height="${CELL}" fill="${fg}" />`
		svg += `<rect x="${(h.x - 2) * CELL}" y="${(h.y + 5) * CELL}" width="${CELL}" height="${CELL}" fill="${fg}" />`
	} else if (lod !== 'S' && dna.side === 3) {
		svg += `<rect x="${(h.x - 2) * CELL}" y="${(h.y + 4) * CELL}" width="${2 * CELL}" height="${2 * CELL}" fill="none" stroke="${fg}" stroke-width="${STROKE_W}" />`
		svg += `<rect x="${(h.x - 1) * CELL}" y="${(h.y + 4.5) * CELL}" width="${CELL}" height="${CELL}" fill="${fg}" />`
	} else if (lod !== 'S' && dna.side === 4) {
		svg += `<rect x="${(h.x - 2) * CELL}" y="${(h.y + 2) * CELL}" width="${2 * CELL}" height="${4 * CELL}" fill="${fillStyle}" stroke="${fg}" stroke-width="${STROKE_W}" />`
		svg += `<rect x="${(h.x - 1.5) * CELL}" y="${(h.y + 3) * CELL}" width="${1.5 * CELL}" height="${0.5 * CELL}" fill="${fg}" />`
		svg += `<rect x="${(h.x - 1.5) * CELL}" y="${(h.y + 4.5) * CELL}" width="${1.5 * CELL}" height="${0.5 * CELL}" fill="${fg}" />`
	} else if (lod !== 'S' && dna.side === 5) {
		svg += `<rect x="${(h.x - 1) * CELL}" y="${(h.y + 2) * CELL}" width="${CELL}" height="${CELL}" fill="${fg}" />`
		svg += `<rect x="${(h.x + h.w) * CELL}" y="${(h.y + 2) * CELL}" width="${CELL}" height="${CELL}" fill="${fg}" />`
	} else if (lod !== 'S' && dna.side === 6) {
		svg += `<rect x="${(h.x - 2) * CELL}" y="${(h.y + 2) * CELL}" width="${2 * CELL}" height="${CELL}" fill="${fg}" />`
		svg += `<rect x="${(h.x - 3) * CELL}" y="${(h.y + 1) * CELL}" width="${CELL}" height="${3 * CELL}" fill="${fillStyle}" stroke="${fg}" stroke-width="${STROKE_W}" />`
	}

	// 4. Head Base with Brand Cutout
	svg += `<path d="${headPath}" fill="${fillStyle}" stroke="${fg}" stroke-width="${STROKE_W}" stroke-linejoin="miter" />`

	// 5. Pattern (L only, solid only)
	if (lod === 'L' && style === 'solid') {
		if (dna.pattern === 1) {
			svg += `<rect x="${(h.x + 1) * CELL}" y="${(h.y + 1) * CELL}" width="${(h.w - 3 - 1) * CELL}" height="${CELL}" fill="${mid}" opacity="0.3" />`
			svg += `<rect x="${(h.x + 1) * CELL}" y="${(h.y + 3) * CELL}" width="${(h.w - 3 - 1) * CELL}" height="${CELL}" fill="${mid}" opacity="0.3" />`
			svg += `<rect x="${(h.x + 1) * CELL}" y="${(h.y + 5) * CELL}" width="${(h.w - 3 - 1) * CELL}" height="${CELL}" fill="${mid}" opacity="0.3" />`
		} else if (dna.pattern === 2) {
			svg += `<rect x="${(h.x + 1) * CELL}" y="${(h.y + 1) * CELL}" width="${2 * CELL}" height="${(h.h - 2) * CELL}" fill="${mid}" opacity="0.2" />`
		} else if (dna.pattern === 3) {
			svg += `<defs><pattern id="pg" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="2" height="2" fill="${mid}" opacity="0.3"/></pattern></defs>`
			svg += `<path d="${headPath}" fill="url(#pg)" pointer-events="none" />`
		}
	}

	// 6. Eyes / Sensors
	if (dna.eye === 0) {
		svg += `<rect x="${(h.x + 1) * CELL}" y="${(h.y + 2) * CELL}" width="${(h.w - 2) * CELL}" height="${CELL}" fill="${eyeFill}" stroke="${eyeColor}" stroke-width="${eyeStrokeW}" />`
	} else if (dna.eye === 1) {
		svg += `<rect x="${(h.x + 1) * CELL}" y="${(h.y + 2) * CELL}" width="${CELL}" height="${CELL}" fill="${eyeColor}" />`
		svg += `<rect x="${(h.x + h.w - 2) * CELL}" y="${(h.y + 2) * CELL}" width="${CELL}" height="${CELL}" fill="${eyeColor}" />`
	} else if (dna.eye === 2) {
		svg += `<rect x="${(h.x + 1) * CELL}" y="${(h.y + 2) * CELL}" width="${2 * CELL}" height="${CELL}" fill="${eyeColor}" />`
		svg += `<rect x="${(h.x + h.w - 2) * CELL}" y="${(h.y + 2) * CELL}" width="${CELL}" height="${CELL}" fill="${eyeColor}" />`
	} else if (dna.eye === 3) {
		const cx = h.x + Math.floor(h.w / 2) - 1
		svg += `<rect x="${cx * CELL}" y="${(h.y + 2) * CELL}" width="${2 * CELL}" height="${2 * CELL}" fill="none" stroke="${eyeColor}" stroke-width="${STROKE_W}" />`
		svg += `<rect x="${(cx + 0.5) * CELL}" y="${(h.y + 2.5) * CELL}" width="${CELL}" height="${CELL}" fill="${eyeColor}" />`
	} else if (dna.eye === 4) {
		svg += `<rect x="${(h.x + 1) * CELL}" y="${(h.y + 2) * CELL}" width="${CELL}" height="${CELL}" fill="${eyeColor}" />`
		svg += `<rect x="${(h.x + 2.5) * CELL}" y="${(h.y + 2) * CELL}" width="${CELL}" height="${CELL}" fill="${eyeColor}" />`
		if (h.w > 6) svg += `<rect x="${(h.x + 4) * CELL}" y="${(h.y + 2) * CELL}" width="${CELL}" height="${CELL}" fill="${eyeColor}" />`
	} else if (dna.eye === 5) {
		const cx = h.x + Math.floor(h.w / 2) - 0.5
		svg += `<rect x="${cx * CELL}" y="${(h.y + 1.5) * CELL}" width="${CELL}" height="${3 * CELL}" fill="${eyeColor}" />`
	} else if (dna.eye === 6) {
		svg += `<rect x="${(h.x + 1) * CELL}" y="${(h.y + 2) * CELL}" width="${CELL}" height="${CELL}" fill="${eyeColor}" />`
		svg += `<rect x="${(h.x + 2) * CELL}" y="${(h.y + 3) * CELL}" width="${CELL}" height="${CELL}" fill="${eyeColor}" />`
	} else if (dna.eye === 7) {
		svg += `<rect x="${(h.x + 1) * CELL}" y="${(h.y + 2) * CELL}" width="${(h.w - 2) * CELL}" height="${CELL}" fill="none" stroke="${eyeColor}" stroke-width="${STROKE_W}" />`
		svg += `<rect x="${(h.x + 1.5) * CELL}" y="${(h.y + 2.25) * CELL}" width="${1.5 * CELL}" height="${0.5 * CELL}" fill="${eyeColor}" />`
	}

	// 7. Jaw / Port — M+ only
	if (lod !== 'S') {
		if (dna.jaw === 0) {
			svg += `<rect x="${(h.x + 1) * CELL}" y="${(jY - 2) * CELL}" width="${2 * CELL}" height="${CELL}" fill="${eyeFill}" stroke="${eyeColor}" stroke-width="${eyeStrokeW}" />`
		} else if (dna.jaw === 1) {
			svg += `<rect x="${(h.x + 1) * CELL}" y="${(jY - 2) * CELL}" width="${0.5 * CELL}" height="${CELL}" fill="${eyeColor}" />`
			svg += `<rect x="${(h.x + 2) * CELL}" y="${(jY - 2) * CELL}" width="${0.5 * CELL}" height="${CELL}" fill="${eyeColor}" />`
		} else if (dna.jaw === 2) {
			svg += `<rect x="${(h.x + 0.5) * CELL}" y="${(jY - 2.5) * CELL}" width="${2.5 * CELL}" height="${0.5 * CELL}" fill="${eyeColor}" />`
		} else if (dna.jaw === 3) {
			svg += `<rect x="${(h.x + 1) * CELL}" y="${(jY - 2) * CELL}" width="${2 * CELL}" height="${CELL}" fill="none" stroke="${eyeColor}" stroke-width="${STROKE_W}" />`
			svg += `<rect x="${(h.x + 1.5) * CELL}" y="${(jY - 1.75) * CELL}" width="${0.5 * CELL}" height="${0.5 * CELL}" fill="${eyeColor}" />`
		} else if (dna.jaw === 4) {
			svg += `<rect x="${(h.x + 1) * CELL}" y="${(jY - 2) * CELL}" width="${0.25 * CELL}" height="${CELL}" fill="${eyeColor}" />`
			svg += `<rect x="${(h.x + 1.5) * CELL}" y="${(jY - 2) * CELL}" width="${0.5 * CELL}" height="${CELL}" fill="${eyeColor}" />`
			svg += `<rect x="${(h.x + 2.25) * CELL}" y="${(jY - 2) * CELL}" width="${0.25 * CELL}" height="${CELL}" fill="${eyeColor}" />`
		} else if (dna.jaw === 5) {
			svg += `<rect x="${(h.x + 1) * CELL}" y="${(jY - 3) * CELL}" width="${2 * CELL}" height="${2 * CELL}" fill="none" stroke="${eyeColor}" stroke-width="${STROKE_W}" />`
			svg += `<rect x="${(h.x + 1) * CELL}" y="${(jY - 2) * CELL}" width="${2 * CELL}" height="${0.25 * CELL}" fill="${eyeColor}" />`
		} else if (dna.jaw === 6) {
			svg += `<rect x="${(h.x + 1) * CELL}" y="${(jY - 3) * CELL}" width="${CELL}" height="${2 * CELL}" fill="${eyeColor}" />`
			svg += `<rect x="${(h.x + 2.5) * CELL}" y="${(jY - 1.5) * CELL}" width="${0.5 * CELL}" height="${0.5 * CELL}" fill="${eyeColor}" />`
		} else if (dna.jaw === 7) {
			svg += `<rect x="${(h.x + 1) * CELL}" y="${(jY - 2.5) * CELL}" width="${2 * CELL}" height="${1.5 * CELL}" fill="${eyeColor}" />`
		}
	}

	// 8. Semantic LED
	svg += `<rect x="${(h.x + 0.5) * CELL}" y="${(h.y + 0.5) * CELL}" width="${0.5 * CELL}" height="${0.5 * CELL}" fill="${ledColor}" />`

	// 9. Brand Accent — Purple Missing Piece
	svg += `<rect x="${(h.x + h.w - 2) * CELL}" y="${(h.y + h.h - 2) * CELL}" width="${2 * CELL}" height="${2 * CELL}" fill="${BRAND}" />`

	// 10. Frame border (M+ only)
	if (lod !== 'S') svg += `<rect width="256" height="256" fill="none" stroke="${mid}" stroke-width="8" />`

	svg += '</svg>'
	return svg
}
