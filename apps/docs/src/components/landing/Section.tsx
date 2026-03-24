export function Section({
	id,
	children,
}: { id?: string; children: React.ReactNode }) {
	return (
		<section
			id={id}
			className="py-12 sm:py-20 border-b border-lp-border"
		>
			{children}
		</section>
	)
}

export function SectionHeader({
	children,
	sub,
}: { children: React.ReactNode; sub?: string }) {
	return (
		<div className="mb-8">
			<h2 className="font-mono text-[24px] font-bold text-white m-0 tracking-[-0.03em] leading-[1.2]">
				{children}
			</h2>
			{sub && (
				<p className="font-sans text-[14px] text-lp-muted mt-2 leading-relaxed">
					{sub}
				</p>
			)}
		</div>
	)
}
