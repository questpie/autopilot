export function Section({
	id,
	children,
}: { id?: string; children: React.ReactNode }) {
	return (
		<section id={id} className="py-12 sm:py-20 border-b border-lp-border">
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
			<h2 className="font-sans text-2xl sm:text-4xl font-black text-white m-0 tracking-tight">
				{children}
			</h2>
			{sub && (
				<p className="font-sans text-sm sm:text-base text-lp-muted mt-2 leading-relaxed">{sub}</p>
			)}
		</div>
	)
}
