import { Component, Suspense, lazy, useEffect, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiFetch, queryKeys } from '@/lib/api'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────

export interface WidgetMeta {
	name: string
	title: string
	description?: string
	size: 'small' | 'medium' | 'large'
	refresh?: number
	position?: string
	created_by?: string
}

interface WidgetContainerProps {
	meta: WidgetMeta
	children: ReactNode
}

interface WidgetGridProps {
	widgets: WidgetMeta[]
	columns?: number
}

interface WidgetErrorBoundaryState {
	hasError: boolean
	error?: Error
}

// ── Widget Error Boundary ──────────────────────────────────────

class WidgetErrorBoundary extends Component<
	{ name: string; children: ReactNode },
	WidgetErrorBoundaryState
> {
	constructor(props: { name: string; children: ReactNode }) {
		super(props)
		this.state = { hasError: false }
	}

	static getDerivedStateFromError(error: Error): WidgetErrorBoundaryState {
		return { hasError: true, error }
	}

	render() {
		if (this.state.hasError) {
			return (
				<div className="border border-destructive/30 bg-destructive/5 p-4">
					<div className="font-mono text-[10px] uppercase tracking-[0.12em] text-destructive mb-1">
						Widget Error
					</div>
					<div className="font-mono text-[11px] text-muted-foreground">
						{this.props.name} failed to render
					</div>
					<div className="font-mono text-[10px] text-muted-foreground/60 mt-1 truncate">
						{this.state.error?.message}
					</div>
					<button
						type="button"
						className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-primary hover:underline"
						onClick={() => this.setState({ hasError: false, error: undefined })}
					>
						Retry
					</button>
				</div>
			)
		}
		return this.props.children
	}
}

// ── Widget Loader ──────────────────────────────────────────────

const widgetCache = new Map<string, React.LazyExoticComponent<React.ComponentType>>()

export function useWidgetMeta(name: string) {
	return useQuery({
		queryKey: ['widget-meta', name],
		queryFn: () => apiFetch<WidgetMeta>(`/api/dashboard/widgets/${name}`),
		staleTime: 30_000,
	})
}

function getWidgetComponent(name: string) {
	if (!widgetCache.has(name)) {
		const LazyWidget = lazy(async () => {
			const module = await import(
				/* @vite-ignore */
				`/fs/dashboard/widgets/${name}/widget.tsx`
			)
			return { default: module.default }
		})
		widgetCache.set(name, LazyWidget)
	}
	return widgetCache.get(name)!
}

// ── Widget Container ───────────────────────────────────────────

const SIZE_CLASSES: Record<string, string> = {
	small: 'col-span-1',
	medium: 'col-span-2',
	large: 'col-span-full',
}

export function WidgetContainer({ meta, children }: WidgetContainerProps) {
	return (
		<div className={cn('border border-border bg-card', SIZE_CLASSES[meta.size] ?? 'col-span-1')}>
			<div className="px-4 py-2 border-b border-border flex items-center justify-between">
				<span className="font-mono text-[10px] uppercase tracking-[0.12em] text-muted-foreground">
					{meta.title}
				</span>
				{meta.refresh && (
					<span className="font-mono text-[9px] text-muted-foreground/50">
						{Math.round(meta.refresh / 1000)}s
					</span>
				)}
			</div>
			<div className="p-4">{children}</div>
		</div>
	)
}

// ── Load Widget (full) ─────────────────────────────────────────

export function LoadedWidget({ name, meta }: { name: string; meta?: WidgetMeta }) {
	const { data: fetchedMeta } = useWidgetMeta(name)
	const resolvedMeta = meta ?? fetchedMeta ?? { name, title: name, size: 'medium' as const }
	const WidgetComponent = getWidgetComponent(name)
	const [timedOut, setTimedOut] = useState(false)

	useEffect(() => {
		const timer = setTimeout(() => setTimedOut(true), 5000)
		return () => clearTimeout(timer)
	}, [])

	if (timedOut) {
		return (
			<WidgetContainer meta={resolvedMeta}>
				<div className="font-mono text-[11px] text-muted-foreground">
					Widget timed out
				</div>
			</WidgetContainer>
		)
	}

	return (
		<WidgetErrorBoundary name={name}>
			<WidgetContainer meta={resolvedMeta}>
				<Suspense fallback={<Skeleton className="h-24 w-full" />}>
					<WidgetComponent />
				</Suspense>
			</WidgetContainer>
		</WidgetErrorBoundary>
	)
}

// ── Widget Grid ────────────────────────────────────────────────

export function WidgetGrid({ widgets, columns = 3 }: WidgetGridProps) {
	if (widgets.length === 0) return null

	return (
		<div
			className="grid gap-3"
			style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
		>
			{widgets.map((w) => (
				<LoadedWidget key={w.name} name={w.name} meta={w} />
			))}
		</div>
	)
}
