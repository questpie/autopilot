export function QSymbol({ size = 20 }: { size?: number }) {
	return (
		<svg width={size} height={size} viewBox="0 0 24 24" fill="none">
			<path
				d="M22 10V2H2V22H10"
				stroke="currentColor"
				strokeWidth={2}
				strokeLinecap="square"
			/>
			<path d="M23 13H13V23H23V13Z" fill="#B700FF" />
		</svg>
	)
}
