/**
 * React component for the construct avatar.
 * Thin wrapper around the SVG string builder — single source of truth.
 */
import { generateAvatarSvg } from './generate'

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
	const svg = generateAvatarSvg({ seed, size, style, theme })

	return (
		<div
			className={className}
			style={{ width: size, height: size, lineHeight: 0 }}
			role="img"
			aria-label={`Construct avatar for ${seed}`}
			dangerouslySetInnerHTML={{ __html: svg }}
		/>
	)
}
