/**
 * Arithmetic generative avatar — deterministic SVG face from a string seed.
 * Brutalist aesthetic: all rects, zero border-radius, sharp geometry.
 * QuestPie brand palette with purple accent hair option.
 */

// ── Hash ────────────────────────────────────────────────────────────────
function hash(seed: string): number {
	let h = 5381
	for (let i = 0; i < seed.length; i++) {
		h = ((h << 5) + h + seed.charCodeAt(i)) >>> 0
	}
	return h
}

/** Deterministic 0–1 float at index `i` from hash `h` */
function t(h: number, i: number): number {
	return (((h * (i + 1) * 2654435761) >>> 0) % 10000) / 10000
}

function pick<T>(arr: readonly T[], v: number): T {
	return arr[Math.floor(v * arr.length) % arr.length]
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

// ── Types ───────────────────────────────────────────────────────────────
type R = { x: number; y: number; w: number; h: number }

// ── Hair styles: fn(faceWidth, faceX, faceY) → rects ───────────────────
type HairFn = (fw: number, fx: number, fy: number) => R[]

const HAIR_STYLES: HairFn[] = [
	// 0: Short crop
	(fw, fx, fy) => [{ x: fx - 2, y: fy - 8, w: fw + 4, h: 12 }],
	// 1: Side swept left
	(fw, fx, fy) => [
		{ x: fx - 2, y: fy - 8, w: fw + 4, h: 12 },
		{ x: fx - 6, y: fy - 4, w: 8, h: 18 },
	],
	// 2: Side swept right
	(fw, fx, fy) => [
		{ x: fx - 2, y: fy - 8, w: fw + 4, h: 12 },
		{ x: fx + fw - 2, y: fy - 4, w: 8, h: 18 },
	],
	// 3: Long / bob
	(fw, fx, fy) => [
		{ x: fx - 3, y: fy - 8, w: fw + 6, h: 12 },
		{ x: fx - 5, y: fy - 2, w: 7, h: 28 },
		{ x: fx + fw - 2, y: fy - 2, w: 7, h: 28 },
	],
	// 4: Flat top / tall
	(fw, fx, fy) => [{ x: fx - 1, y: fy - 14, w: fw + 2, h: 18 }],
	// 5: Bald
	() => [],
	// 6: Mohawk
	(_fw, _fx, fy) => [{ x: 36, y: fy - 14, w: 8, h: 18 }],
	// 7: Wide / afro
	(fw, fx, fy) => [
		{ x: fx - 6, y: fy - 12, w: fw + 12, h: 18 },
		{ x: fx - 4, y: fy + 2, w: 5, h: 8 },
		{ x: fx + fw - 1, y: fy + 2, w: 5, h: 8 },
	],
	// 8: Curtains / middle part
	(fw, fx, fy) => [
		{ x: fx - 3, y: fy - 8, w: (fw + 6) / 2 - 2, h: 12 },
		{ x: 40 + 2, y: fy - 8, w: (fw + 6) / 2 - 2, h: 12 },
		{ x: fx - 4, y: fy - 2, w: 6, h: 14 },
		{ x: fx + fw - 2, y: fy - 2, w: 6, h: 14 },
	],
	// 9: Buzz with widow's peak
	(fw, fx, fy) => [
		{ x: fx - 1, y: fy - 6, w: fw + 2, h: 8 },
		{ x: 37, y: fy - 8, w: 6, h: 6 },
	],
]

// ── Mouth shapes: rects relative to (0,0) ──────────────────────────────
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

// ── Component ───────────────────────────────────────────────────────────
export interface GenerativeAvatarProps {
	seed: string
	size?: number
	className?: string
}

export function GenerativeAvatar({ seed, size = 80, className }: GenerativeAvatarProps) {
	const h = hash(seed)

	// Face shape
	const faceW = lerp(32, 42, t(h, 0))
	const faceH = lerp(38, 48, t(h, 1))
	const faceX = 40 - faceW / 2
	const faceY = 20 + (48 - faceH) / 2

	// Colors
	const skin = pick(SKIN, t(h, 2))
	const hairColor = pick(HAIR, t(h, 3))
	const eyeColor = pick(EYES, t(h, 4))
	const skinDark = darken(skin, 0.15)
	const mouthClr = darken(skin, 0.35)

	// Hair
	const hairFn = pick(HAIR_STYLES, t(h, 5))
	const hairRects = hairFn(faceW, faceX, faceY)

	// Eyes
	const eyeW = lerp(5, 8, t(h, 6))
	const eyeH = lerp(3, 6, t(h, 7))
	const eyeSpacing = lerp(7, 11, t(h, 8))
	const eyeY = faceY + Math.round(faceH * 0.36)

	// Eyebrows
	const browH = lerp(1, 3, t(h, 9))
	const browGap = lerp(3, 5, t(h, 10))

	// Nose
	const noseW = lerp(3, 6, t(h, 11))
	const noseH = lerp(5, 10, t(h, 12))
	const noseY = eyeY + eyeH + 3

	// Mouth
	const mouth = pick(MOUTHS, t(h, 13))
	const mouthY = noseY + noseH + lerp(3, 6, t(h, 14))

	// Accessories
	const hasGlasses = t(h, 15) > 0.7
	const hasFacialHair = t(h, 16) > 0.75
	const facialHairStyle = t(h, 17)

	// Ears
	const earH = lerp(6, 10, t(h, 18))
	const earY = eyeY - 1

	// Pupil offset (gaze direction)
	const gazeX = lerp(-1, 1, t(h, 19))

	return (
		<svg
			viewBox="0 0 80 80"
			width={size}
			height={size}
			className={className}
			xmlns="http://www.w3.org/2000/svg"
			role="img"
			aria-label={`Avatar for ${seed}`}
		>
			{/* Neck */}
			<rect x={36} y={faceY + faceH - 2} width={8} height={14} fill={skin} />

			{/* Ears */}
			<rect x={faceX - 4} y={earY} width={4} height={earH} fill={skin} />
			<rect x={faceX + faceW} y={earY} width={4} height={earH} fill={skin} />
			<rect x={faceX - 3} y={earY + 1} width={2} height={earH - 2} fill={skinDark} opacity={0.3} />
			<rect x={faceX + faceW + 1} y={earY + 1} width={2} height={earH - 2} fill={skinDark} opacity={0.3} />

			{/* Head */}
			<rect x={faceX} y={faceY} width={faceW} height={faceH} fill={skin} />

			{/* Hair */}
			{hairRects.map((r, i) => (
				<rect key={`h${i}`} x={r.x} y={r.y} width={r.w} height={r.h} fill={hairColor} />
			))}

			{/* Eyebrows */}
			<rect x={40 - eyeSpacing - eyeW / 2} y={eyeY - browGap - browH} width={eyeW + 2} height={browH} fill={hairColor} />
			<rect x={40 + eyeSpacing - eyeW / 2 - 2} y={eyeY - browGap - browH} width={eyeW + 2} height={browH} fill={hairColor} />

			{/* Eyes — sclera */}
			<rect x={40 - eyeSpacing - eyeW / 2} y={eyeY} width={eyeW} height={eyeH} fill="#F5F5F5" />
			<rect x={40 + eyeSpacing - eyeW / 2} y={eyeY} width={eyeW} height={eyeH} fill="#F5F5F5" />

			{/* Eyes — pupils */}
			<rect
				x={40 - eyeSpacing - 1.5 + gazeX}
				y={eyeY + Math.max(0, (eyeH - 3) / 2)}
				width={3}
				height={Math.min(eyeH, 3)}
				fill={eyeColor}
			/>
			<rect
				x={40 + eyeSpacing - 1.5 + gazeX}
				y={eyeY + Math.max(0, (eyeH - 3) / 2)}
				width={3}
				height={Math.min(eyeH, 3)}
				fill={eyeColor}
			/>

			{/* Nose */}
			<rect x={40 - noseW / 2} y={noseY} width={noseW} height={noseH} fill={skinDark} opacity={0.3} />
			{/* Nostril hint */}
			<rect x={40 - noseW / 2} y={noseY + noseH - 2} width={noseW} height={2} fill={skinDark} opacity={0.15} />

			{/* Mouth */}
			{mouth.map((r, i) => (
				<rect key={`m${i}`} x={40 + r.x} y={mouthY + r.y} width={r.w} height={r.h} fill={mouthClr} />
			))}

			{/* Glasses */}
			{hasGlasses && (
				<>
					{/* Left lens */}
					<rect
						x={40 - eyeSpacing - eyeW / 2 - 2}
						y={eyeY - 2}
						width={eyeW + 4}
						height={eyeH + 4}
						fill="none"
						stroke="#333"
						strokeWidth={1.5}
					/>
					{/* Right lens */}
					<rect
						x={40 + eyeSpacing - eyeW / 2 - 2}
						y={eyeY - 2}
						width={eyeW + 4}
						height={eyeH + 4}
						fill="none"
						stroke="#333"
						strokeWidth={1.5}
					/>
					{/* Bridge */}
					<rect
						x={40 - eyeSpacing + eyeW / 2 + 2}
						y={eyeY + eyeH / 2 - 0.5}
						width={Math.max(0, 2 * eyeSpacing - eyeW - 4)}
						height={1.5}
						fill="#333"
					/>
					{/* Temple arms */}
					<rect x={faceX - 2} y={eyeY + eyeH / 2 - 0.5} width={4} height={1.5} fill="#333" />
					<rect x={faceX + faceW - 2} y={eyeY + eyeH / 2 - 0.5} width={4} height={1.5} fill="#333" />
				</>
			)}

			{/* Facial hair */}
			{hasFacialHair && facialHairStyle < 0.33 && (
				/* Goatee */
				<rect x={40 - 4} y={mouthY + 3} width={8} height={5} fill={hairColor} opacity={0.6} />
			)}
			{hasFacialHair && facialHairStyle >= 0.33 && facialHairStyle < 0.66 && (
				/* Full beard */
				<>
					<rect x={40 - 8} y={mouthY + 2} width={16} height={6} fill={hairColor} opacity={0.5} />
					<rect x={40 - 6} y={mouthY + 8} width={12} height={3} fill={hairColor} opacity={0.4} />
				</>
			)}
			{hasFacialHair && facialHairStyle >= 0.66 && (
				/* Mustache */
				<rect x={40 - 6} y={mouthY - 3} width={12} height={3} fill={hairColor} opacity={0.6} />
			)}
		</svg>
	)
}
