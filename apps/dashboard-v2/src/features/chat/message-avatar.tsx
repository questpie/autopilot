import { cn, stringToColor } from '@/lib/utils'

interface MessageAvatarProps {
	from: string
	size?: number
}

/** Deterministic colored avatar circle with the user's initial. */
export function MessageAvatar({ from, size = 32 }: MessageAvatarProps) {
	const avatarColor = stringToColor(from)
	const initial = from.charAt(0).toUpperCase()

	const sizeClass = size <= 28 ? 'size-7 text-[10px]' : 'size-8 text-xs'

	return (
		<div
			className={cn(
				'flex items-center justify-center rounded-full font-heading font-bold',
				sizeClass,
				avatarColor,
			)}
			title={from}
		>
			{initial}
		</div>
	)
}
