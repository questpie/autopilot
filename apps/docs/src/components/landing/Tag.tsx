export function Tag({
	children,
}: { children: React.ReactNode }) {
	return (
		<span
			className="font-mono text-[10px] font-bold uppercase border border-lp-border text-lp-ghost px-2 py-0.5 tracking-[0.15em]"
		>
			{children}
		</span>
	)
}
