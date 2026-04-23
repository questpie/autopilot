import { ArrowLeft, ClockCounterClockwise } from '@phosphor-icons/react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { SearchInput } from '@/components/ui/search-input'
import { EmptyState } from '@/components/ui/empty-state'
import { useNavigate } from '@tanstack/react-router'
import type { ConversationViewModel } from '@/api/conversations.api'
import { setDraggedChatAttachment } from '../lib/chat-dnd'

interface ChatSessionListProps {
	conversations: ConversationViewModel[]
	searchQuery: string
	onSearchChange: (q: string) => void
	onSelect: (id: string) => void
	onNew: () => void
	onBack?: () => void
	title?: string
	newLabel?: string
	emptyTitle?: string
	emptyDescription?: string
	showHeader?: boolean
}

export function ChatSessionList({
	conversations,
	searchQuery,
	onSearchChange,
	onSelect,
	onNew,
	onBack,
	title = 'History',
	newLabel = 'New conversation',
	emptyTitle = 'No conversations yet',
	emptyDescription = 'Start a new one from the Chat screen.',
	showHeader = true,
}: ChatSessionListProps) {
	const navigate = useNavigate()

	function goBack() {
		if (onBack) {
			onBack()
			return
		}
		void navigate({ to: '/chat', search: {} })
	}

	return (
		<div className="flex h-full flex-col">
			{/* Page header */}
			{showHeader && (
				<div className="flex h-12 shrink-0 items-center gap-3 px-4">
					<Button size="icon-xs" variant="ghost" onClick={goBack} title="Back to Chat">
						<ArrowLeft size={14} weight="bold" />
					</Button>
					<h1 className="flex-1 text-sm font-semibold text-foreground">{title}</h1>
					<Button size="xs" variant="default" onClick={onNew}>
						{newLabel}
					</Button>
				</div>
			)}

			{/* Search */}
			<div className="shrink-0 px-3 pb-2 pt-3">
				<SearchInput
					value={searchQuery}
					onChange={(e) => onSearchChange(e.target.value)}
					placeholder="Search conversations..."
					onClear={searchQuery ? () => onSearchChange('') : undefined}
				/>
			</div>

			{/* List */}
			<div className="flex-1 overflow-y-auto">
				{conversations.length === 0 ? (
					<EmptyState
						icon={ClockCounterClockwise}
						title={emptyTitle}
						description={emptyDescription}
						height="h-full"
					/>
				) : (
					<div className="px-1 pb-3">
						{conversations.map((conv) => (
							<button
								key={conv.session.id}
								type="button"
								onClick={() => onSelect(conv.session.id)}
								draggable
								onDragStart={(e) => {
									setDraggedChatAttachment(e.dataTransfer, {
										type: 'ref',
										source: 'drag',
										label: conv.title || 'Conversation',
										refType: 'session',
										refId: conv.session.id,
										metadata: { sessionId: conv.session.id, title: conv.title },
									})
								}}
								className={cn(
									'w-full rounded-md px-3 py-2 text-left transition-[background-color,color]',
									'hover:bg-muted/50',
								)}
							>
								<div className="flex items-center justify-between gap-3">
									<span className="truncate text-xs font-medium text-foreground flex-1">
										{conv.title || 'New conversation'}
									</span>
									<span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
										{conv.time}
									</span>
								</div>
								{conv.lastPreview && (
									<p className="mt-0.5 truncate text-[10px] text-muted-foreground">
										{conv.lastPreview}
									</p>
								)}
							</button>
						))}
					</div>
				)}
			</div>
		</div>
	)
}
