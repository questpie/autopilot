/**
 * React component for the construct avatar.
 * Always renders at 64×64 full detail, displayed at any size with
 * nearest-neighbor scaling for crisp pixel art.
 */
import { renderDataUrl } from './raster'

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
	const dataUrl = renderDataUrl({ seed, style, theme })

	return (
		<img
			src={dataUrl}
			width={size}
			height={size}
			alt={`Construct avatar for ${seed}`}
			className={className}
			style={{ imageRendering: 'pixelated' }}
		/>
	)
}
