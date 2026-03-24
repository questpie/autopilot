import { CodeBlock } from '@/components/landing/CodeBlock'

export interface UseCaseField {
	label: string
	value: string
}

export interface UseCaseCardProps {
	number: string
	title: string
	fields: UseCaseField[]
	outcome: string
	codeTitle: string
	code: string
}

export function UseCaseCard({
	number,
	title,
	fields,
	outcome,
	codeTitle,
	code,
}: UseCaseCardProps) {
	return (
		<div className="grid grid-cols-1 md:grid-cols-2 gap-0  mb-6">
			<div className="bg-lp-card p-6 md:p-8 flex flex-col justify-center border-lp-border border border-r-0">
				<div className="font-mono text-lg text-white font-bold tracking-[-0.03em] mb-4">
					<span className="text-lp-purple">{number}</span> / {title}
				</div>
				<div className="font-sans text-[13px] text-lp-muted leading-relaxed space-y-3">
					{fields.map((field) => (
						<div key={field.label}>
							<span className="font-mono text-[11px] text-lp-purple font-bold tracking-[0.15em]">
								{field.label}
							</span>
							<div className="text-lp-fg mt-1">{field.value}</div>
						</div>
					))}
					<div className="pt-2 border-t border-lp-border">
						<strong className="text-lp-purple font-mono text-[11px] font-bold tracking-[0.15em]">
							OUTCOME
						</strong>{' '}
						<span className="text-lp-fg">{outcome}</span>
					</div>
				</div>
			</div>
			<CodeBlock title={codeTitle}>{code}</CodeBlock>
		</div>
	)
}
