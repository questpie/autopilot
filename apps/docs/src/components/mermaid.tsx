'use client'

import { useMemo } from 'react'
import { renderMermaidSVG } from 'beautiful-mermaid'

export function Mermaid({ chart }: { chart: string }) {
	const svg = useMemo(
		() =>
			renderMermaidSVG(chart, {
				bg: 'var(--color-fd-background)',
				fg: 'var(--color-fd-foreground)',
				transparent: true,
			}),
		[chart],
	)

	return <div dangerouslySetInnerHTML={{ __html: svg }} />
}
