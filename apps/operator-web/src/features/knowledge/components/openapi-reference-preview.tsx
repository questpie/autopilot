import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'
import { ApiReferenceReact } from '@scalar/api-reference-react'
import '@scalar/api-reference-react/style.css'
import { useMemo } from 'react'

interface OpenApiReferencePreviewProps {
	path: string
	content: string
	variant: 'full' | 'inspector'
}

function nameFromPath(path: string): string {
	return path.split('/').filter(Boolean).pop() ?? path
}

export function OpenApiReferencePreview({ path, content, variant }: OpenApiReferencePreviewProps) {
	const configuration = useMemo(
		() => ({
			title: nameFromPath(path),
			theme: 'none' as const,
			layout: 'modern' as const,
			showSidebar: variant === 'full',
			hideClientButton: false,
			showDeveloperTools: 'never' as const,
			showToolbar: 'never' as const,
			telemetry: false,
			sources: [
				{
					content,
					title: nameFromPath(path),
					slug: nameFromPath(path).replace(/\W+/g, '-').toLowerCase(),
					default: true,
					agent: { disabled: true },
				},
			],
		}),
		[path, content, variant],
	)

	if (!content.trim()) {
		return (
			<div className="flex h-full items-center justify-center gap-2 text-muted-foreground">
				<Spinner size="sm" />
				<span className="text-sm">OpenAPI document is empty.</span>
			</div>
		)
	}

	return (
		<div
			className={cn(
				'openapi-reference h-full min-h-0 overflow-hidden bg-background text-foreground',
				variant === 'inspector' && 'h-96 rounded-lg border border-border',
			)}
		>
			<ApiReferenceReact configuration={configuration} />
		</div>
	)
}
