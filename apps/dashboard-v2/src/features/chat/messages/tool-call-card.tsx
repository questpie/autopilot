import { useEffect, useState } from 'react'
import {
	CaretDownIcon,
	CaretRightIcon,
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
import { formatToolCallParams, getToolCallDisplay } from './metadata'

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
	displayLabel?: string
	displayMeta?: string
	open?: boolean
	onOpenChange?: (open: boolean) => void
	className?: string
}

const TOOL_ICONS = {
	bash: TerminalIcon,
	read: FileTextIcon,
	read_file: FileTextIcon,
	write: PencilSimpleIcon,
	write_file: PencilSimpleIcon,
	edit: PencilSimpleIcon,
	edit_file: PencilSimpleIcon,
	search: MagnifyingGlassIcon,
	web_search: GlobeIcon,
	message: ChatCircleIcon,
}

export function extractToolLinks(
	tool: string,
	params?: Record<string, unknown>,
): ToolCallLink[] {
	const path = getToolCallDisplay({ tool, params }).path
	if (
		typeof path === 'string' &&
		(tool === 'read' ||
			tool === 'read_file' ||
			tool === 'write' ||
			tool === 'write_file' ||
			tool === 'edit' ||
			tool === 'edit_file')
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
	displayLabel,
	displayMeta,
	open,
	onOpenChange,
	className,
}: ToolCallCardProps): React.JSX.Element {
	const Icon = TOOL_ICONS[tool as keyof typeof TOOL_ICONS] ?? WrenchIcon
	const display = getToolCallDisplay({ tool, params, displayLabel, displayMeta })
	const [internalOpen, setInternalOpen] = useState(status === 'running' || status === 'error')
	const isOpen = open ?? internalOpen
	const formattedParams = display.params ?? formatToolCallParams(params)
	const hasDetails = !!result || !!formattedParams || !!links?.length

	useEffect(() => {
		if (open === undefined && (status === 'running' || status === 'error')) {
			setInternalOpen(true)
		}
	}, [open, status])

	const setOpen = (nextOpen: boolean) => {
		if (open === undefined) {
			setInternalOpen(nextOpen)
		}
		onOpenChange?.(nextOpen)
	}

	return (
		<div
			className={cn(
				'border-l border-border/60 pl-2.5',
				status === 'running' && 'border-primary/50',
				status === 'error' && 'border-destructive/50',
				className,
			)}
		>
			<button
				type="button"
				onClick={() => {
					if (status !== 'running' && hasDetails) {
						setOpen(!isOpen)
					}
				}}
				className={cn(
					'flex w-full items-start gap-2 py-1.5 text-left',
					status !== 'running' && hasDetails ? 'cursor-pointer' : 'cursor-default',
				)}
			>
				<div className="mt-0.5 shrink-0">
					{status === 'running' ? (
						<Spinner size="sm" />
					) : status === 'error' ? (
						<XIcon size={12} className="text-destructive" />
					) : (
						<CheckIcon size={12} className="text-success" />
					)}
				</div>
				<div className="min-w-0 flex-1">
					<div className="flex min-w-0 items-center gap-1.5">
						<Icon size={12} className="shrink-0 text-muted-foreground" />
						<span
							className="truncate font-heading text-[11px] leading-5 text-foreground"
							title={display.label}
						>
							{display.label}
						</span>
						{status !== 'running' && hasDetails ? (
							isOpen ? (
								<CaretDownIcon size={12} className="shrink-0 text-muted-foreground" />
							) : (
								<CaretRightIcon size={12} className="shrink-0 text-muted-foreground" />
							)
						) : null}
					</div>
					{display.detail ? (
						<div
							className="mt-0.5 truncate text-[10px] leading-4 text-muted-foreground"
							title={display.detail}
						>
							{display.detail}
						</div>
					) : null}
				</div>
			</button>

			{hasDetails && isOpen ? (
				<div className="space-y-1.5 pb-1.5 pl-5 pr-2">
					{formattedParams ? (
						<div className="break-words font-mono text-[10px] leading-4 text-muted-foreground">
							{formattedParams}
						</div>
					) : null}
					{result ? (
						<pre
							className={cn(
								'max-h-40 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-4',
								status === 'error' ? 'text-destructive' : 'text-muted-foreground',
							)}
						>
							{result || '(no output)'}
						</pre>
					) : null}
					{links?.length ? (
						<Link
							to={links[0].to}
							className="inline-flex text-[10px] font-heading text-primary hover:underline"
							title={links[0].label}
						>
							Open in files
						</Link>
					) : null}
				</div>
			) : null}
		</div>
	)
}
