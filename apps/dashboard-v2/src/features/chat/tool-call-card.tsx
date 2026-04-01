import { useState } from 'react'
import {
	ChatCircleIcon,
	CheckIcon,
	FileTextIcon,
	GlobeIcon,
	MagnifyingGlassIcon,
	PencilSimpleIcon,
	TerminalIcon,
	WrenchIcon,
	XIcon,
} from '@phosphor-icons/react'
import { Link } from '@tanstack/react-router'
import { Spinner } from '@/components/ui/spinner'
import { cn } from '@/lib/utils'

interface ToolCallLink {
	label: string
	to: '/fs'
}

interface ToolCallCardProps {
	tool: string
	params?: Record<string, unknown>
	status: 'running' | 'completed' | 'error'
	result?: string
	links?: ToolCallLink[]
	className?: string
}

const TOOL_ICONS = {
	bash: TerminalIcon,
	read: FileTextIcon,
	write: PencilSimpleIcon,
	edit: PencilSimpleIcon,
	search: MagnifyingGlassIcon,
	web_search: GlobeIcon,
	message: ChatCircleIcon,
}

function formatParams(params?: Record<string, unknown>): string | null {
	if (!params) return null
	const entries = Object.entries(params)
	if (entries.length === 0) return null
	return entries
		.map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
		.join(' · ')
}

export function extractToolLinks(
	tool: string,
	params?: Record<string, unknown>,
): ToolCallLink[] {
	const path = params?.path ?? params?.file_path ?? params?.filePath
	if (
		typeof path === 'string' &&
		(tool === 'read' || tool === 'write' || tool === 'edit')
	) {
		return [{ label: path, to: '/fs' }]
	}

	return []
}

export function ToolCallCard({
	tool,
	params,
	status,
	result,
	links,
	className,
}: ToolCallCardProps): React.JSX.Element {
	const Icon = TOOL_ICONS[tool as keyof typeof TOOL_ICONS] ?? WrenchIcon
	const resultLineCount = result ? result.split('\n').length : 0
	const [open, setOpen] = useState(status === 'running' || resultLineCount <= 5)
	const formattedParams = formatParams(params)

	return (
		<div className={cn('border border-border bg-card', className)}>
			<button
				type="button"
				onClick={() => {
					if (status !== 'running' && result) {
						setOpen((current) => !current)
					}
				}}
				className="flex w-full items-start gap-2 px-3 py-2 text-left"
			>
				<div className="mt-0.5 shrink-0">
					{status === 'running' ? (
						<Spinner size="sm" />
					) : status === 'error' ? (
						<XIcon size={14} className="text-destructive" />
					) : (
						<CheckIcon size={14} className="text-success" />
					)}
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex min-w-0 items-center gap-2">
						<Icon size={14} className="shrink-0 text-muted-foreground" />
						<span className="truncate font-heading text-xs text-foreground" title={tool}>
							{tool}
						</span>
						{links?.length ? (
							<Link
								to={links[0].to}
								className="truncate font-mono text-[10px] text-primary hover:underline"
								title={links[0].label}
							>
								{links[0].label}
							</Link>
						) : null}
					</div>
					{formattedParams ? (
						<div className="mt-1 truncate font-mono text-[11px] text-muted-foreground">
							{formattedParams}
						</div>
					) : null}
				</div>
			</button>

			{result && open ? (
				<div className="border-t border-border px-3 py-2">
					<pre
						className={cn(
							'max-h-52 overflow-auto whitespace-pre-wrap break-words font-mono text-[11px] leading-relaxed',
							status === 'error' ? 'text-destructive' : 'text-muted-foreground',
						)}
					>
						{result || '(no output)'}
					</pre>
				</div>
			) : null}
		</div>
	)
}
