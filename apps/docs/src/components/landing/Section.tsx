export function Section({
	id,
	children,
}: { id?: string; children: React.ReactNode }) {
	return (
		<section
			id={id}
			className="border-t border-lp-border px-4 py-16 md:px-8 md:py-24"
		>
			{children}
		</section>
	)
}

export function SectionHeader({
	num,
	children,
	sub,
}: { num?: string; children: React.ReactNode; sub?: string }) {
	return (
		<div className="mb-12">
			{num && (
				<div className="text-lp-purple mb-4 font-mono text-sm tracking-[3px]">
					{num}
				</div>
			)}
			<h2 className="font-mono text-2xl sm:text-4xl font-bold text-white m-0 tracking-[-0.03em]">
				{children}
			</h2>
			{sub && (
				<p className="font-sans text-base sm:text-lg text-lp-muted mt-4 leading-relaxed max-w-2xl">
					{sub}
				</p>
			)}
		</div>
	)
}
