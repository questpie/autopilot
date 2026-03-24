import { X } from 'lucide-react'
import { useNavigate } from '@tanstack/react-router'
import type { Pin } from '@/lib/types'
import { AgentAvatar } from './agent-avatar'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { renderMarkdown, PROSE_CLASSES } from '@/lib/markdown'
import { cn } from '@/lib/utils'

interface PinDetailPanelProps {
	pin: Pin
	agentRole?: string
	onClose: () => void
}

export function PinDetailPanel({ pin, agentRole, onClose }: PinDetailPanelProps) {
	const navigate = useNavigate()
	const timeAgo = pin.created_at ? formatTimeAgo(pin.created_at) : ''

	const handleAction = (action: { label: string; url?: string; action?: string }) => {
		if (action.url) {
			window.open(action.url, '_blank')
		} else if (action.action) {
			const match = action.action.match(/^open:(.+)$/)
			if (match) {
				const filePath = match[1].replace(/^\//, '')
				navigate({ to: '/files', search: { file: filePath } })
			}
		}
	}

	return (
		<>
			<div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
			<div className="fixed top-0 right-0 h-screen w-[480px] max-w-full bg-background border-l border-border z-50 flex flex-col animate-[slide-in-right_0.3s_ease-out]">
				{/* Header */}
				<div className="flex items-start justify-between p-4 border-b border-border">
					<div className="flex items-start gap-3">
						<span className="text-xl shrink-0 mt-0.5">
							{PIN_TYPE_ICONS[pin.type] ?? '\uD83D\uDCCC'}
						</span>
						<div>
							<h2 className="text-sm font-semibold">{pin.title}</h2>
							{pin.created_by && (
								<div className="flex items-center gap-2 mt-1">
									<AgentAvatar name={pin.created_by} size="sm" />
									<span className="font-mono text-[10px] text-muted-foreground">
										{pin.created_by} {timeAgo && `\u00B7 ${timeAgo}`}
									</span>
								</div>
							)}
						</div>
					</div>
					<Button size="icon-sm" variant="ghost" onClick={onClose}>
						<X size={16} />
					</Button>
				</div>

				{/* Content */}
				<div className="flex-1 overflow-y-auto p-4">
					{pin.content && (
						<div
							className={PROSE_CLASSES}
							dangerouslySetInnerHTML={{ __html: renderMarkdown(pin.content) }}
						/>
					)}

					{pin.metadata?.progress !== undefined && (
						<>
							<Separator className="my-4" />
							<div>
								<div className="flex items-center justify-between mb-1">
									<span className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.1em]">
										Progress
									</span>
									<span className="font-mono text-[11px] font-semibold">
										{pin.metadata.progress}%
									</span>
								</div>
								<div className="h-1.5 bg-secondary w-full">
									<div
										className="h-full bg-primary transition-all"
										style={{ width: `${pin.metadata.progress}%` }}
									/>
								</div>
							</div>
						</>
					)}
				</div>

				{/* Actions */}
				{pin.metadata?.actions && pin.metadata.actions.length > 0 && (
					<div className="p-4 border-t border-border flex gap-2">
						{pin.metadata.actions.map((action) => (
							<Button
								key={action.label}
								variant="outline"
								className="flex-1"
								onClick={() => handleAction(action)}
							>
								{action.label}
							</Button>
						))}
					</div>
				)}
			</div>
		</>
	)
}

const PIN_TYPE_ICONS: Record<string, string> = {
	update: '\uD83D\uDCCC',
	success: '\u2705',
	warning: '\u26A0\uFE0F',
	error: '\u274C',
	question: '\u2753',
	info: '\u2139\uFE0F',
}

function formatTimeAgo(timestamp: string): string {
	const date = new Date(timestamp)
	if (Number.isNaN(date.getTime())) return ''
	const diff = Date.now() - date.getTime()
	const mins = Math.floor(diff / 60000)
	if (mins < 1) return 'just now'
	if (mins < 60) return `${mins}m ago`
	const hours = Math.floor(mins / 60)
	if (hours < 24) return `${hours}h ago`
	return `${Math.floor(hours / 24)}d ago`
}
