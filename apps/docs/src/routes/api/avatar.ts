import { createFileRoute } from '@tanstack/react-router'

/**
 * Generative avatar API — deterministic SVG face from a seed string.
 *
 * Usage:  GET /api/avatar?seed=my-agent&size=120
 *   seed  — any string (agent ID, name, email hash, etc.)
 *   size  — pixel width/height of the output SVG (default 80, max 512)
 *
 * Returns image/svg+xml, cacheable for 7 days.
 */

// ── Hash ────────────────────────────────────────────────────────────────
function hash(seed: string): number {
	let h = 5381
	for (let i = 0; i < seed.length; i++) {
		h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0
	}
	return h
}

function t(h: number, i: number): number {
	return (((h * (i + 1) * 2654435761) >>> 0) % 10000) / 10000
}

function pick<T>(arr: readonly T[], v: number): T {
	return arr[Math.floor(v * arr.length) % arr.length]!
}

function lerp(a: number, b: number, v: number): number {
	return Math.round(a + (b - a) * v)
}

function darken(hex: string, amount: number): string {
	const r = parseInt(hex.slice(1, 3), 16)
	const g = parseInt(hex.slice(3, 5), 16)
	const b = parseInt(hex.slice(5, 7), 16)
	const f = 1 - amount
	return `#${(Math.round(r * f) | 0).toString(16).padStart(2, '0')}${(Math.round(g * f) | 0).toString(16).padStart(2, '0')}${(Math.round(b * f) | 0).toString(16).padStart(2, '0')}`
}

// ── Palettes ────────────────────────────────────────────────────────────
const SKIN = ['#FDDCB5', '#F0C8A0', '#E0B08A', '#D4A574', '#C68642', '#8D5524', '#6B3A1F', '#5C3018'] as const
const HAIR = ['#0A0A0A', '#1A1209', '#2C1810', '#4A2C1A', '#8B4513', '#C4956A', '#9E9E9E', '#B700FF'] as const
const EYES = ['#1A1A1A', '#2C1810', '#2D4A3E', '#3D2B1F', '#4A6741'] as const

type R = { x: number; y: number; w: number; h: number }
type HairFn = (fw: number, fx: number, fy: number) => R[]

const HAIR_STYLES: HairFn[] = [
	(fw, fx, fy) => [{ x: fx - 2, y: fy - 8, w: fw + 4, h: 12 }],
	(fw, fx, fy) => [
		{ x: fx - 2, y: fy - 8, w: fw + 4, h: 12 },
		{ x: fx - 6, y: fy - 4, w: 8, h: 18 },
	],
	(fw, fx, fy) => [
		{ x: fx - 2, y: fy - 8, w: fw + 4, h: 12 },
		{ x: fx + fw - 2, y: fy - 4, w: 8, h: 18 },
	],
	(fw, fx, fy) => [
		{ x: fx - 3, y: fy - 8, w: fw + 6, h: 12 },
		{ x: fx - 5, y: fy - 2, w: 7, h: 28 },
		{ x: fx + fw - 2, y: fy - 2, w: 7, h: 28 },
	],
	(fw, fx, fy) => [{ x: fx - 1, y: fy - 14, w: fw + 2, h: 18 }],
	() => [],
	(_fw, _fx, fy) => [{ x: 36, y: fy - 14, w: 8, h: 18 }],
	(fw, fx, fy) => [
		{ x: fx - 6, y: fy - 12, w: fw + 12, h: 18 },
		{ x: fx - 4, y: fy + 2, w: 5, h: 8 },
		{ x: fx + fw - 1, y: fy + 2, w: 5, h: 8 },
	],
	(fw, fx, fy) => [
		{ x: fx - 3, y: fy - 8, w: (fw + 6) / 2 - 2, h: 12 },
		{ x: 42, y: fy - 8, w: (fw + 6) / 2 - 2, h: 12 },
		{ x: fx - 4, y: fy - 2, w: 6, h: 14 },
		{ x: fx + fw - 2, y: fy - 2, w: 6, h: 14 },
	],
	(fw, fx, fy) => [
		{ x: fx - 1, y: fy - 6, w: fw + 2, h: 8 },
		{ x: 37, y: fy - 8, w: 6, h: 6 },
	],
]

const MOUTHS: R[][] = [
	[{ x: -7, y: 0, w: 14, h: 2 }],
	[{ x: -9, y: 0, w: 18, h: 2 }],
	[{ x: -5, y: 0, w: 10, h: 2 }],
	[
		{ x: -7, y: 0, w: 14, h: 2 },
		{ x: -7, y: 2, w: 3, h: 2 },
		{ x: 4, y: 2, w: 3, h: 2 },
	],
	[{ x: -6, y: 0, w: 12, h: 3 }],
]

// ── SVG Builder ─────────────────────────────────────────────────────────
function rect(x: number, y: number, w: number, h: number, fill: string, opts = ''): string {
	return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"${opts}/>`
}

function generateSvg(seed: string, size: number): string {
	const h = hash(seed)

	const faceW = lerp(32, 42, t(h, 0))
	const faceH = lerp(38, 48, t(h, 1))
	const faceX = 40 - faceW / 2
	const faceY = 20 + (48 - faceH) / 2

	const skin = pick(SKIN, t(h, 2))
	const hairColor = pick(HAIR, t(h, 3))
	const eyeColor = pick(EYES, t(h, 4))
	const skinDark = darken(skin, 0.15)
	const mouthClr = darken(skin, 0.35)

	const hairRects = pick(HAIR_STYLES, t(h, 5))(faceW, faceX, faceY)

	const eyeW = lerp(5, 8, t(h, 6))
	const eyeH = lerp(3, 6, t(h, 7))
	const eyeSpacing = lerp(7, 11, t(h, 8))
	const eyeY = faceY + Math.round(faceH * 0.36)

	const browH = lerp(1, 3, t(h, 9))
	const browGap = lerp(3, 5, t(h, 10))

	const noseW = lerp(3, 6, t(h, 11))
	const noseH = lerp(5, 10, t(h, 12))
	const noseY = eyeY + eyeH + 3

	const mouth = pick(MOUTHS, t(h, 13))
	const mouthY = noseY + noseH + lerp(3, 6, t(h, 14))

	const hasGlasses = t(h, 15) > 0.7
	const hasFH = t(h, 16) > 0.75
	const fhStyle = t(h, 17)

	const earH = lerp(6, 10, t(h, 18))
	const earY = eyeY - 1
	const gazeX = lerp(-1, 1, t(h, 19))

	let s = `<svg viewBox="0 0 80 80" width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">`

	// Neck
	s += rect(36, faceY + faceH - 2, 8, 14, skin)

	// Ears
	s += rect(faceX - 4, earY, 4, earH, skin)
	s += rect(faceX + faceW, earY, 4, earH, skin)
	s += rect(faceX - 3, earY + 1, 2, earH - 2, skinDark, ' opacity="0.3"')
	s += rect(faceX + faceW + 1, earY + 1, 2, earH - 2, skinDark, ' opacity="0.3"')

	// Head
	s += rect(faceX, faceY, faceW, faceH, skin)

	// Hair
	for (const r of hairRects) s += rect(r.x, r.y, r.w, r.h, hairColor)

	// Eyebrows
	s += rect(40 - eyeSpacing - eyeW / 2, eyeY - browGap - browH, eyeW + 2, browH, hairColor)
	s += rect(40 + eyeSpacing - eyeW / 2 - 2, eyeY - browGap - browH, eyeW + 2, browH, hairColor)

	// Eyes — sclera
	s += rect(40 - eyeSpacing - eyeW / 2, eyeY, eyeW, eyeH, '#F5F5F5')
	s += rect(40 + eyeSpacing - eyeW / 2, eyeY, eyeW, eyeH, '#F5F5F5')

	// Eyes — pupils
	const pupilY = eyeY + Math.max(0, (eyeH - 3) / 2)
	const pupilH = Math.min(eyeH, 3)
	s += rect(40 - eyeSpacing - 1.5 + gazeX, pupilY, 3, pupilH, eyeColor)
	s += rect(40 + eyeSpacing - 1.5 + gazeX, pupilY, 3, pupilH, eyeColor)

	// Nose
	s += rect(40 - noseW / 2, noseY, noseW, noseH, skinDark, ' opacity="0.3"')
	s += rect(40 - noseW / 2, noseY + noseH - 2, noseW, 2, skinDark, ' opacity="0.15"')

	// Mouth
	for (const r of mouth) s += rect(40 + r.x, mouthY + r.y, r.w, r.h, mouthClr)

	// Glasses
	if (hasGlasses) {
		const gx1 = 40 - eyeSpacing - eyeW / 2 - 2
		const gx2 = 40 + eyeSpacing - eyeW / 2 - 2
		const gw = eyeW + 4
		const gh = eyeH + 4
		s += `<rect x="${gx1}" y="${eyeY - 2}" width="${gw}" height="${gh}" fill="none" stroke="#555" stroke-width="1.5"/>`
		s += `<rect x="${gx2}" y="${eyeY - 2}" width="${gw}" height="${gh}" fill="none" stroke="#555" stroke-width="1.5"/>`
		s += rect(40 - eyeSpacing + eyeW / 2 + 2, eyeY + eyeH / 2 - 0.5, Math.max(0, 2 * eyeSpacing - eyeW - 4), 1.5, '#555')
		s += rect(faceX - 2, eyeY + eyeH / 2 - 0.5, 4, 1.5, '#555')
		s += rect(faceX + faceW - 2, eyeY + eyeH / 2 - 0.5, 4, 1.5, '#555')
	}

	// Facial hair
	if (hasFH && fhStyle < 0.33) {
		s += rect(36, mouthY + 3, 8, 5, hairColor, ' opacity="0.6"')
	} else if (hasFH && fhStyle < 0.66) {
		s += rect(32, mouthY + 2, 16, 6, hairColor, ' opacity="0.5"')
		s += rect(34, mouthY + 8, 12, 3, hairColor, ' opacity="0.4"')
	} else if (hasFH) {
		s += rect(34, mouthY - 3, 12, 3, hairColor, ' opacity="0.6"')
	}

	s += '</svg>'
	return s
}

// ── Route Handler ───────────────────────────────────────────────────────
export const Route = createFileRoute('/api/avatar')({
	server: {
		handlers: {
			GET: async ({ request }) => {
				const url = new URL(request.url)
				const seed = url.searchParams.get('seed') || 'default'
				const sizeParam = parseInt(url.searchParams.get('size') || '80', 10)
				const size = Math.max(16, Math.min(512, Number.isNaN(sizeParam) ? 80 : sizeParam))

				const svg = generateSvg(seed, size)

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
