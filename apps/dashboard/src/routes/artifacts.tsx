import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { TopBar } from '@/components/layout/top-bar'
import { EmptyState } from '@/components/feedback/empty-state'
import { ErrorBoundary } from '@/components/feedback/error-boundary'
import { Skeleton } from '@/components/ui/skeleton'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useArtifacts, useStartArtifact, useStopArtifact } from '@/hooks/use-artifacts'
import type { Artifact } from '@/lib/types'

export const Route = createFileRoute('/artifacts')({
	component: ArtifactsPage,
})

function ArtifactsPage() {
	const { data: artifacts, isLoading, isError } = useArtifacts()

	return (
		<ErrorBoundary>
			<TopBar title="Artifacts" />
			<div className="flex-1 overflow-y-auto p-6">
				{isLoading ? (
					<div className="grid grid-cols-3 gap-4">
						{Array.from({ length: 3 }).map((_, i) => (
							<Skeleton key={i} className="h-40" />
						))}
					</div>
				) : isError ? (
					<EmptyState
						icon={'\u26A0'}
						title="Cannot load artifacts"
						description="Make sure the orchestrator is running."
					/>
				) : !artifacts || artifacts.length === 0 ? (
					<EmptyState
						title="No artifacts"
						description="Artifacts will appear here when agents build them."
					/>
				) : (
					<div className="grid grid-cols-3 gap-4">
						{artifacts.map((artifact) => (
							<ArtifactCard key={artifact.id} artifact={artifact} />
						))}
					</div>
				)}
			</div>
		</ErrorBoundary>
	)
}

function ArtifactCard({ artifact }: { artifact: Artifact }) {
	const startArtifact = useStartArtifact()
	const stopArtifact = useStopArtifact()
	const [showPreview, setShowPreview] = useState(false)

	const statusColors: Record<string, string> = {
		running: 'text-success',
		stopped: 'text-muted-foreground',
		starting: 'text-warning',
	}

	return (
		<div className="border border-border bg-card p-4 space-y-3">
			<div className="flex items-start justify-between">
				<div>
					<div className="text-sm font-medium">{artifact.name}</div>
					<div className="font-mono text-[10px] text-muted-foreground">{artifact.id}</div>
				</div>
				<Badge
					variant={artifact.status === 'running' ? 'default' : 'outline'}
					className="font-mono text-[9px]"
				>
					<span className={statusColors[artifact.status] ?? ''}>
						{artifact.status.toUpperCase()}
					</span>
				</Badge>
			</div>

			{artifact.type && (
				<div className="font-mono text-[10px] text-muted-foreground">
					type: {artifact.type}
				</div>
			)}
			{artifact.serve && (
				<div className="font-mono text-[10px] text-muted-foreground truncate">
					serve: {artifact.serve}
				</div>
			)}
			{artifact.port && (
				<div className="font-mono text-[10px] text-info">
					port: {artifact.port}
				</div>
			)}

			<div className="flex gap-2 pt-2 border-t border-border">
				{artifact.status === 'running' ? (
					<>
						<Button
							size="sm"
							variant="outline"
							onClick={() => setShowPreview(!showPreview)}
						>
							{showPreview ? 'Hide Preview' : 'Preview'}
						</Button>
						<Button
							size="sm"
							variant="destructive"
							onClick={() => stopArtifact.mutate(artifact.id)}
							disabled={stopArtifact.isPending}
						>
							Stop
						</Button>
					</>
				) : (
					<Button
						size="sm"
						onClick={() => startArtifact.mutate(artifact.id)}
						disabled={startArtifact.isPending}
					>
						{startArtifact.isPending ? 'Starting...' : 'Start'}
					</Button>
				)}
			</div>

			{showPreview && artifact.status === 'running' && artifact.port && (
				<div className="border border-border mt-2">
					<iframe
						src={`http://localhost:${artifact.port}`}
						className="w-full h-[300px] bg-white"
						title={artifact.name}
					/>
				</div>
			)}
		</div>
	)
}
