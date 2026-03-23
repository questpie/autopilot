import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { apiFetch } from '@/lib/api'
import { WidgetGrid, type WidgetMeta } from '@/lib/widget-loader'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

// ── Types ──────────────────────────────────────────────────────

export interface LayoutSection {
	id: string
	title: string
	widgets?: string[]
	component?: string
	layout: 'stack' | 'grid' | 'tabs'
	columns?: number
	position?: number
}

export interface LayoutConfig {
	dashboard: {
		sections: LayoutSection[]
	}
	sidebar?: {
		items: Array<{
			id: string
			icon: string
			label: string
			badge?: string
		}>
	}
}

// ── Hook ───────────────────────────────────────────────────────

export function useLayout() {
	return useQuery({
		queryKey: ['dashboard-layout'],
		queryFn: async () => {
			try {
				const data = await apiFetch<LayoutConfig>('/api/dashboard/layout')
				return data
			} catch {
				return null
			}
		},
		staleTime: 30_000,
		retry: false,
	})
}

export function useWidgetList() {
	return useQuery({
		queryKey: ['dashboard-widgets'],
		queryFn: () => apiFetch<WidgetMeta[]>('/api/dashboard/widgets'),
		staleTime: 30_000,
		retry: false,
	})
}

// ── Section Renderers ──────────────────────────────────────────

function StackSection({
	section,
	widgetMetas,
}: {
	section: LayoutSection
	widgetMetas: Map<string, WidgetMeta>
}) {
	const widgets = (section.widgets ?? [])
		.map((name) => widgetMetas.get(name))
		.filter(Boolean) as WidgetMeta[]

	if (widgets.length === 0) return null

	return (
		<div className="space-y-3">
			<WidgetGrid widgets={widgets} columns={1} />
		</div>
	)
}

function GridSection({
	section,
	widgetMetas,
}: {
	section: LayoutSection
	widgetMetas: Map<string, WidgetMeta>
}) {
	const widgets = (section.widgets ?? [])
		.map((name) => widgetMetas.get(name))
		.filter(Boolean) as WidgetMeta[]

	if (widgets.length === 0) return null

	return <WidgetGrid widgets={widgets} columns={section.columns ?? 3} />
}

function TabsSection({
	section,
	widgetMetas,
}: {
	section: LayoutSection
	widgetMetas: Map<string, WidgetMeta>
}) {
	const widgetNames = section.widgets ?? []
	const [activeTab, setActiveTab] = useState(0)

	if (widgetNames.length === 0) return null

	return (
		<Tabs value={activeTab} onValueChange={(val) => setActiveTab(val as number)}>
			<TabsList variant="line">
				{widgetNames.map((name, idx) => {
					const meta = widgetMetas.get(name)
					return (
						<TabsTrigger key={name} value={idx}>
							{meta?.title ?? name}
						</TabsTrigger>
					)
				})}
			</TabsList>
			{widgetNames.map((name, idx) => {
				const meta = widgetMetas.get(name)
				if (!meta) return null
				return (
					<TabsContent key={name} value={idx}>
						<WidgetGrid widgets={[meta]} columns={1} />
					</TabsContent>
				)
			})}
		</Tabs>
	)
}

// ── Layout Renderer ────────────────────────────────────────────

interface LayoutRendererProps {
	coreComponents?: Record<string, React.ComponentType>
}

export function LayoutRenderer({ coreComponents }: LayoutRendererProps) {
	const { data: layout } = useLayout()
	const { data: allWidgets } = useWidgetList()

	if (!layout) return null

	const widgetMetas = new Map<string, WidgetMeta>()
	if (allWidgets) {
		for (const w of allWidgets) {
			widgetMetas.set(w.name, w)
		}
	}

	const sections = [...layout.dashboard.sections].sort(
		(a, b) => (a.position ?? 0) - (b.position ?? 0),
	)

	return (
		<div className="space-y-6">
			{sections.map((section) => {
				// If section references a core component, render it
				if (section.component && coreComponents?.[section.component]) {
					const CoreComp = coreComponents[section.component]!
					return (
						<div key={section.id}>
							<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.12em] mb-2">
								{section.title}
							</div>
							<CoreComp />
						</div>
					)
				}

				// Widget-based section
				if (!section.widgets || section.widgets.length === 0) return null

				return (
					<div key={section.id}>
						<div className="font-mono text-[10px] text-muted-foreground uppercase tracking-[0.12em] mb-2">
							{section.title}
						</div>
						{section.layout === 'stack' && (
							<StackSection section={section} widgetMetas={widgetMetas} />
						)}
						{section.layout === 'grid' && (
							<GridSection section={section} widgetMetas={widgetMetas} />
						)}
						{section.layout === 'tabs' && (
							<TabsSection section={section} widgetMetas={widgetMetas} />
						)}
					</div>
				)
			})}
		</div>
	)
}
