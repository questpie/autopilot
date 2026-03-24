/**
 * React component for the construct avatar.
 * Uses shared core for PRNG, DNA, and color resolution.
 */
import { BRAND, CELL, CUT, STROKE_W, type ResolveOptions, resolveContext } from './core'

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
	const c = resolveContext({ seed, size, style, theme })
	const { dna, head: h, lod } = c
	const { bg, fg, mid, ledColor, fillStyle, eyeColor, eyeFill, eyeStrokeW, jY, headPath } = c

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
		topDecor.push(
			<rect key={k()} x={(h.x + Math.floor(h.w / 2)) * CELL} y={(h.y - 2) * CELL} width={CELL} height={2 * CELL} fill="none" stroke={fg} strokeWidth={STROKE_W} strokeLinejoin="miter" />,
		)
		topDecor.push(
			<rect key={k()} x={(h.x + Math.floor(h.w / 2) - 1) * CELL} y={(h.y - 3) * CELL} width={3 * CELL} height={CELL} fill={fg} />,
		)
	} else if (dna.top === 1) {
		topDecor.push(<rect key={k()} x={(h.x + 1) * CELL} y={(h.y - 1) * CELL} width={2 * CELL} height={CELL} fill={fg} />)
		topDecor.push(<rect key={k()} x={(h.x + h.w - 4) * CELL} y={(h.y - 1) * CELL} width={2 * CELL} height={CELL} fill={fg} />)
	} else if (dna.top === 2) {
		topDecor.push(
			<rect key={k()} x={(h.x + 1) * CELL} y={(h.y - 2) * CELL} width={(h.w - 2) * CELL} height={2 * CELL} fill="none" stroke={fg} strokeWidth={STROKE_W} />,
		)
		topDecor.push(
			<rect key={k()} x={(h.x + 2) * CELL} y={(h.y - 1.5) * CELL} width={(h.w - 4) * CELL} height={CELL} fill={fg} />,
		)
	} else if (dna.top === 3) {
		topDecor.push(<rect key={k()} x={(h.x + 1) * CELL} y={(h.y - 2) * CELL} width={CELL} height={2 * CELL} fill={fg} />)
	} else if (dna.top === 4) {
		topDecor.push(
			<rect key={k()} x={(h.x + 2) * CELL} y={(h.y - 1) * CELL} width={(h.w - 4) * CELL} height={CELL} fill={fillStyle} stroke={fg} strokeWidth={STROKE_W} />,
		)
		topDecor.push(
			<rect key={k()} x={(h.x + 3) * CELL} y={(h.y - 2) * CELL} width={(h.w - 6) * CELL} height={CELL} fill={fg} />,
		)
	} else if (dna.top === 5) {
		topDecor.push(
			<rect key={k()} x={(h.x + h.w - 3) * CELL} y={(h.y - 3) * CELL} width={2 * CELL} height={2 * CELL} fill="none" stroke={fg} strokeWidth={STROKE_W} />,
		)
		topDecor.push(<rect key={k()} x={(h.x + h.w - 2.5) * CELL} y={(h.y - 2.5) * CELL} width={CELL} height={CELL} fill={fg} />)
		topDecor.push(<rect key={k()} x={(h.x + h.w - 2.5) * CELL} y={(h.y - 1) * CELL} width={CELL} height={CELL} fill={fg} />)
	} else if (dna.top === 6) {
		topDecor.push(
			<rect key={k()} x={(h.x + 1) * CELL} y={(h.y - 2) * CELL} width={(h.w - 2) * CELL} height={2 * CELL} fill="none" stroke={fg} strokeWidth={STROKE_W} />,
		)
		topDecor.push(
			<rect key={k()} x={(h.x + 2) * CELL} y={(h.y - 1) * CELL} width={(h.w - 4) * CELL} height={2 * CELL} fill={bg} />,
		)
	}

	// 3. Side Decor
	const sideDecor: React.ReactNode[] = []

	if (dna.side === 0) {
		sideDecor.push(
			<rect key={k()} x={(h.x - 2) * CELL} y={(h.y + 2) * CELL} width={2 * CELL} height={3 * CELL} fill="none" stroke={fg} strokeWidth={STROKE_W} />,
		)
		sideDecor.push(<rect key={k()} x={(h.x - 3) * CELL} y={(h.y + 3) * CELL} width={CELL} height={CELL} fill={fg} />)
	} else if (dna.side === 1) {
		sideDecor.push(<rect key={k()} x={(h.x - 1) * CELL} y={(h.y + 1) * CELL} width={CELL} height={4 * CELL} fill={fg} />)
	} else if (dna.side === 2) {
		sideDecor.push(<rect key={k()} x={(h.x - 2) * CELL} y={(h.y + 3) * CELL} width={CELL} height={CELL} fill={fg} />)
		sideDecor.push(<rect key={k()} x={(h.x - 2) * CELL} y={(h.y + 5) * CELL} width={CELL} height={CELL} fill={fg} />)
	} else if (dna.side === 3) {
		sideDecor.push(
			<rect key={k()} x={(h.x - 2) * CELL} y={(h.y + 4) * CELL} width={2 * CELL} height={2 * CELL} fill="none" stroke={fg} strokeWidth={STROKE_W} />,
		)
		sideDecor.push(<rect key={k()} x={(h.x - 1) * CELL} y={(h.y + 4.5) * CELL} width={CELL} height={CELL} fill={fg} />)
	} else if (dna.side === 4) {
		sideDecor.push(
			<rect key={k()} x={(h.x - 2) * CELL} y={(h.y + 2) * CELL} width={2 * CELL} height={4 * CELL} fill={fillStyle} stroke={fg} strokeWidth={STROKE_W} />,
		)
		sideDecor.push(<rect key={k()} x={(h.x - 1.5) * CELL} y={(h.y + 3) * CELL} width={1.5 * CELL} height={0.5 * CELL} fill={fg} />)
		sideDecor.push(<rect key={k()} x={(h.x - 1.5) * CELL} y={(h.y + 4.5) * CELL} width={1.5 * CELL} height={0.5 * CELL} fill={fg} />)
	} else if (dna.side === 5) {
		sideDecor.push(<rect key={k()} x={(h.x - 1) * CELL} y={(h.y + 2) * CELL} width={CELL} height={CELL} fill={fg} />)
		sideDecor.push(<rect key={k()} x={(h.x + h.w) * CELL} y={(h.y + 2) * CELL} width={CELL} height={CELL} fill={fg} />)
	} else if (dna.side === 6) {
		sideDecor.push(<rect key={k()} x={(h.x - 2) * CELL} y={(h.y + 2) * CELL} width={2 * CELL} height={CELL} fill={fg} />)
		sideDecor.push(
			<rect key={k()} x={(h.x - 3) * CELL} y={(h.y + 1) * CELL} width={CELL} height={3 * CELL} fill={fillStyle} stroke={fg} strokeWidth={STROKE_W} />,
		)
	}

	// 4. Pattern elements (only in solid mode)
	const patternElements: React.ReactNode[] = []
	const patternDefs: React.ReactNode[] = []

	if (style === 'solid') {
		if (dna.pattern === 1) {
			patternElements.push(
				<rect key={k()} x={(h.x + 1) * CELL} y={(h.y + 1) * CELL} width={(h.w - CUT - 1) * CELL} height={CELL} fill={mid} opacity="0.3" />,
			)
			patternElements.push(
				<rect key={k()} x={(h.x + 1) * CELL} y={(h.y + 3) * CELL} width={(h.w - CUT - 1) * CELL} height={CELL} fill={mid} opacity="0.3" />,
			)
			patternElements.push(
				<rect key={k()} x={(h.x + 1) * CELL} y={(h.y + 5) * CELL} width={(h.w - CUT - 1) * CELL} height={CELL} fill={mid} opacity="0.3" />,
			)
		} else if (dna.pattern === 2) {
			patternElements.push(
				<rect key={k()} x={(h.x + 1) * CELL} y={(h.y + 1) * CELL} width={2 * CELL} height={(h.h - 2) * CELL} fill={mid} opacity="0.2" />,
			)
		} else if (dna.pattern === 3) {
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
		eyeElements.push(
			<rect key={k()} x={(h.x + 1) * CELL} y={(h.y + 2) * CELL} width={(h.w - 2) * CELL} height={CELL} fill={eyeFill} stroke={eyeColor} strokeWidth={eyeStrokeW} />,
		)
	} else if (dna.eye === 1) {
		eyeElements.push(<rect key={k()} x={(h.x + 1) * CELL} y={(h.y + 2) * CELL} width={CELL} height={CELL} fill={eyeColor} />)
		eyeElements.push(<rect key={k()} x={(h.x + h.w - 2) * CELL} y={(h.y + 2) * CELL} width={CELL} height={CELL} fill={eyeColor} />)
	} else if (dna.eye === 2) {
		eyeElements.push(<rect key={k()} x={(h.x + 1) * CELL} y={(h.y + 2) * CELL} width={2 * CELL} height={CELL} fill={eyeColor} />)
		eyeElements.push(<rect key={k()} x={(h.x + h.w - 2) * CELL} y={(h.y + 2) * CELL} width={CELL} height={CELL} fill={eyeColor} />)
	} else if (dna.eye === 3) {
		const cx = h.x + Math.floor(h.w / 2) - 1
		eyeElements.push(
			<rect key={k()} x={cx * CELL} y={(h.y + 2) * CELL} width={2 * CELL} height={2 * CELL} fill="none" stroke={eyeColor} strokeWidth={STROKE_W} />,
		)
		eyeElements.push(<rect key={k()} x={(cx + 0.5) * CELL} y={(h.y + 2.5) * CELL} width={CELL} height={CELL} fill={eyeColor} />)
	} else if (dna.eye === 4) {
		eyeElements.push(<rect key={k()} x={(h.x + 1) * CELL} y={(h.y + 2) * CELL} width={CELL} height={CELL} fill={eyeColor} />)
		eyeElements.push(<rect key={k()} x={(h.x + 2.5) * CELL} y={(h.y + 2) * CELL} width={CELL} height={CELL} fill={eyeColor} />)
		if (h.w > 6) {
			eyeElements.push(<rect key={k()} x={(h.x + 4) * CELL} y={(h.y + 2) * CELL} width={CELL} height={CELL} fill={eyeColor} />)
		}
	} else if (dna.eye === 5) {
		const cx = h.x + Math.floor(h.w / 2) - 0.5
		eyeElements.push(<rect key={k()} x={cx * CELL} y={(h.y + 1.5) * CELL} width={CELL} height={3 * CELL} fill={eyeColor} />)
	} else if (dna.eye === 6) {
		eyeElements.push(<rect key={k()} x={(h.x + 1) * CELL} y={(h.y + 2) * CELL} width={CELL} height={CELL} fill={eyeColor} />)
		eyeElements.push(<rect key={k()} x={(h.x + 2) * CELL} y={(h.y + 3) * CELL} width={CELL} height={CELL} fill={eyeColor} />)
	} else if (dna.eye === 7) {
		eyeElements.push(
			<rect key={k()} x={(h.x + 1) * CELL} y={(h.y + 2) * CELL} width={(h.w - 2) * CELL} height={CELL} fill="none" stroke={eyeColor} strokeWidth={STROKE_W} />,
		)
		eyeElements.push(<rect key={k()} x={(h.x + 1.5) * CELL} y={(h.y + 2.25) * CELL} width={1.5 * CELL} height={0.5 * CELL} fill={eyeColor} />)
	}

	// 6. Jaw / Port
	const jawElements: React.ReactNode[] = []

	if (dna.jaw === 0) {
		jawElements.push(
			<rect key={k()} x={(h.x + 1) * CELL} y={(jY - 2) * CELL} width={2 * CELL} height={CELL} fill={eyeFill} stroke={eyeColor} strokeWidth={eyeStrokeW} />,
		)
	} else if (dna.jaw === 1) {
		jawElements.push(<rect key={k()} x={(h.x + 1) * CELL} y={(jY - 2) * CELL} width={0.5 * CELL} height={CELL} fill={eyeColor} />)
		jawElements.push(<rect key={k()} x={(h.x + 2) * CELL} y={(jY - 2) * CELL} width={0.5 * CELL} height={CELL} fill={eyeColor} />)
	} else if (dna.jaw === 2) {
		jawElements.push(<rect key={k()} x={(h.x + 0.5) * CELL} y={(jY - 2.5) * CELL} width={2.5 * CELL} height={0.5 * CELL} fill={eyeColor} />)
	} else if (dna.jaw === 3) {
		jawElements.push(
			<rect key={k()} x={(h.x + 1) * CELL} y={(jY - 2) * CELL} width={2 * CELL} height={CELL} fill="none" stroke={eyeColor} strokeWidth={STROKE_W} />,
		)
		jawElements.push(<rect key={k()} x={(h.x + 1.5) * CELL} y={(jY - 1.75) * CELL} width={0.5 * CELL} height={0.5 * CELL} fill={eyeColor} />)
	} else if (dna.jaw === 4) {
		jawElements.push(<rect key={k()} x={(h.x + 1) * CELL} y={(jY - 2) * CELL} width={0.25 * CELL} height={CELL} fill={eyeColor} />)
		jawElements.push(<rect key={k()} x={(h.x + 1.5) * CELL} y={(jY - 2) * CELL} width={0.5 * CELL} height={CELL} fill={eyeColor} />)
		jawElements.push(<rect key={k()} x={(h.x + 2.25) * CELL} y={(jY - 2) * CELL} width={0.25 * CELL} height={CELL} fill={eyeColor} />)
	} else if (dna.jaw === 5) {
		jawElements.push(
			<rect key={k()} x={(h.x + 1) * CELL} y={(jY - 3) * CELL} width={2 * CELL} height={2 * CELL} fill="none" stroke={eyeColor} strokeWidth={STROKE_W} />,
		)
		jawElements.push(<rect key={k()} x={(h.x + 1) * CELL} y={(jY - 2) * CELL} width={2 * CELL} height={0.25 * CELL} fill={eyeColor} />)
	} else if (dna.jaw === 6) {
		jawElements.push(<rect key={k()} x={(h.x + 1) * CELL} y={(jY - 3) * CELL} width={CELL} height={2 * CELL} fill={eyeColor} />)
		jawElements.push(<rect key={k()} x={(h.x + 2.5) * CELL} y={(jY - 1.5) * CELL} width={0.5 * CELL} height={0.5 * CELL} fill={eyeColor} />)
	} else if (dna.jaw === 7) {
		jawElements.push(<rect key={k()} x={(h.x + 1) * CELL} y={(jY - 2.5) * CELL} width={2 * CELL} height={1.5 * CELL} fill={eyeColor} />)
	}

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
			<rect width="256" height="256" fill={bg} />

			{lod === 'L' && (bgGridDefs.length > 0 || patternDefs.length > 0) && (
				<defs>
					{bgGridDefs}
					{patternDefs}
				</defs>
			)}
			{lod === 'L' && bgGridRects}

			{lod !== 'S' && topDecor}
			{lod !== 'S' && sideDecor}

			<path d={headPath} fill={fillStyle} stroke={fg} strokeWidth={STROKE_W} strokeLinejoin="miter" />

			{lod === 'L' && patternElements}

			{eyeElements}

			{lod !== 'S' && jawElements}

			<rect x={(h.x + 0.5) * CELL} y={(h.y + 0.5) * CELL} width={0.5 * CELL} height={0.5 * CELL} fill={ledColor} />

			<rect x={(h.x + h.w - 2) * CELL} y={(h.y + h.h - 2) * CELL} width={2 * CELL} height={2 * CELL} fill={BRAND} />

			{lod !== 'S' && <rect width="256" height="256" fill="none" stroke={mid} strokeWidth="8" />}
		</svg>
	)
}
