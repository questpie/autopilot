export function Tag({
	children,
}: { children: React.ReactNode }) {
	return (
		<span
			className="font-mono text-[10px] font-semibold uppercase text-lp-purple bg-lp-purple-faint border border-lp-purple-glow px-[10px] py-[3px] tracking-[0.15em]"
		>
			{children}
		</span>
	)
}
