/**
 * React component for the construct avatar.
 * Renders as a crisp pixel-art PNG with nearest-neighbor scaling.
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
	const resolution = size <= 48 ? 16 : size <= 96 ? 32 : 64
	const dataUrl = renderDataUrl({ seed, resolution, style, theme })

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
