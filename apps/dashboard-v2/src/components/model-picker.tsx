import { useMemo, useState } from 'react'
import { CaretUpDownIcon } from '@phosphor-icons/react'
import { useQuery } from '@tanstack/react-query'
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from '@/components/ui/command'
import { Skeleton } from '@/components/ui/skeleton'
import { modelsQuery, type ModelListItem } from '@/lib/models.queries'
import { cn } from '@/lib/utils'

interface ModelPickerProps {
	value: string | null
	onChange?: (modelId: string) => void
	onValueChange?: (modelId: string) => void
	className?: string
}

const FALLBACK_MODELS: ModelListItem[] = [
	{
		id: 'anthropic/claude-sonnet-4',
		name: 'claude-sonnet-4',
		provider: 'Anthropic',
		pricing: { prompt: '3.00', completion: '15.00' },
		context_length: 200000,
		top_provider: true,
	},
	{
		id: 'openai/gpt-4o',
		name: 'gpt-4o',
		provider: 'OpenAI',
		pricing: { prompt: '2.50', completion: '10.00' },
		context_length: 128000,
		top_provider: true,
	},
	{
		id: 'deepseek/deepseek-chat',
		name: 'deepseek-chat',
		provider: 'DeepSeek',
		pricing: { prompt: '0.14', completion: '0.28' },
		context_length: 64000,
		top_provider: false,
	},
]

function formatPricing(model: ModelListItem): string {
	const prompt = model.pricing.prompt
	const completion = model.pricing.completion

	if (!prompt && !completion) {
		return 'Pricing unavailable'
	}

	return `$${prompt ?? '?'} / $${completion ?? '?'} per 1M`
}

export function ModelPicker({
	value,
	onChange,
	onValueChange,
	className,
}: ModelPickerProps) {
	const [open, setOpen] = useState(false)
	const [search, setSearch] = useState('')
	const { data, isLoading, isError } = useQuery(modelsQuery)
	const models = data?.models?.length ? data.models : FALLBACK_MODELS
	const selected = models.find((model) => model.id === value) ?? null

	const visibleModels = useMemo(() => {
		const normalized = search.trim().toLowerCase()
		if (!normalized) return models
		return models.filter((model) => {
			return (
				model.id.toLowerCase().includes(normalized) ||
				model.name.toLowerCase().includes(normalized) ||
				model.provider.toLowerCase().includes(normalized)
			)
		})
	}, [models, search])

	const emitChange = (modelId: string) => {
		onValueChange?.(modelId)
		onChange?.(modelId)
	}

	return (
		<div className={cn('relative', className)}>
			<button
				type="button"
				onClick={() => setOpen((current) => !current)}
				className={cn(
					'flex h-9 w-full items-center justify-between border border-input bg-transparent px-3 py-1 text-sm transition-colors',
					'hover:border-primary/40 focus:outline-none focus:ring-1 focus:ring-ring',
				)}
			>
				<span className="truncate text-left">
					{selected ? (
						<span>
							<span className="font-medium">{selected.name}</span>
							<span className="ml-2 text-[10px] text-muted-foreground">{selected.id}</span>
						</span>
					) : (
						<span className="text-muted-foreground">{value || 'Select model...'}</span>
					)}
				</span>
				<CaretUpDownIcon size={14} className="text-muted-foreground" />
			</button>

			{open ? (
				<div className="absolute z-50 mt-1 w-full border border-border bg-background shadow-lg">
					{isLoading ? (
						<div className="space-y-2 p-3">
							<Skeleton className="h-8 w-full rounded-none" />
							<Skeleton className="h-14 w-full rounded-none" />
							<Skeleton className="h-14 w-full rounded-none" />
						</div>
					) : (
						<Command shouldFilter={false}>
							<CommandInput
								value={search}
								onValueChange={setSearch}
								placeholder="Search models..."
							/>
							<CommandList>
								<CommandEmpty>
									{isError ? 'Unable to load models. You can still type a model ID below.' : 'No models found.'}
								</CommandEmpty>
								<CommandGroup>
									{visibleModels.map((model) => (
										<CommandItem
											key={model.id}
											value={model.id}
											onSelect={() => {
												emitChange(model.id)
												setOpen(false)
											}}
											data-checked={model.id === value || undefined}
											className="items-start"
										>
											<div className="flex min-w-0 flex-1 flex-col gap-1">
												<div className="flex items-center gap-2">
													<span className="truncate font-heading text-xs">{model.name}</span>
													{model.top_provider ? (
														<span className="text-[10px] text-primary">recommended</span>
													) : null}
												</div>
												<div className="flex items-center gap-2 text-[10px] text-muted-foreground">
													<span>{model.provider}</span>
													<span>{formatPricing(model)}</span>
												</div>
											</div>
										</CommandItem>
									))}
								</CommandGroup>
							</CommandList>
						</Command>
					)}

					<div className="border-t border-border px-3 py-2">
						<input
							type="text"
							value={value ?? ''}
							onChange={(event) => emitChange(event.target.value)}
							placeholder="Or type model ID..."
							className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
							onKeyDown={(event) => {
								if (event.key === 'Enter') {
									setOpen(false)
								}
							}}
						/>
					</div>
				</div>
			) : null}

			{open ? (
				<div
					className="fixed inset-0 z-40"
					onClick={() => setOpen(false)}
					onKeyDown={(event) => {
						if (
							event.key === 'Enter' ||
							event.key === ' ' ||
							event.key === 'Escape'
						) {
							event.preventDefault()
							setOpen(false)
						}
					}}
					role="button"
					tabIndex={0}
					aria-label="Close model picker"
				/>
			) : null}
		</div>
	)
}
