import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { Input } from '@/components/ui/input'
import { Spinner } from '@/components/ui/spinner'
import { SurfaceSection } from '@/components/ui/surface-section'
import { useDeleteProject, useProjects, useRegisterProject } from '@/hooks/use-projects'
import { FolderGit2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

export function ProjectsSettings() {
	const projectsQuery = useProjects()
	const registerMutation = useRegisterProject()
	const deleteMutation = useDeleteProject()
	const [name, setName] = useState('')
	const [path, setPath] = useState('')

	async function handleRegister() {
		if (!path.trim()) {
			toast.error('Project path is required')
			return
		}

		try {
			await registerMutation.mutateAsync({
				name: name.trim() || undefined,
				path: path.trim(),
			})
			setName('')
			setPath('')
			toast.success('Project registered')
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to register project')
		}
	}

	async function handleDelete(id: string) {
		try {
			await deleteMutation.mutateAsync(id)
			toast.success('Project removed')
		} catch (error) {
			toast.error(error instanceof Error ? error.message : 'Failed to delete project')
		}
	}

	return (
		<div className="space-y-6">
			<SurfaceSection
				title="Project registration"
				description="Register repositories explicitly so project-scoped tasks and config overrides have a durable home. For git-aware setup from the terminal, use `autopilot init` from the repo root."
				contentClassName="space-y-4"
			>
				<div className="grid gap-3 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)_auto]">
					<Input
						value={name}
						onChange={(event) => setName(event.target.value)}
						placeholder="Optional display name"
					/>
					<Input
						value={path}
						onChange={(event) => setPath(event.target.value)}
						placeholder="/absolute/path/to/project"
					/>
					<Button onClick={() => void handleRegister()} loading={registerMutation.isPending}>
						Register
					</Button>
				</div>
			</SurfaceSection>

			<SurfaceSection title="Registered projects" contentClassName="p-0">
				{projectsQuery.isPending ? (
					<div className="flex items-center gap-2 px-4 py-4 text-muted-foreground">
						<Spinner size="sm" />
						<span className="text-sm">Loading projects…</span>
					</div>
				) : projectsQuery.error ? (
					<p className="px-4 py-4 text-sm text-destructive">
						Failed to load projects: {projectsQuery.error.message}
					</p>
				) : !projectsQuery.data || projectsQuery.data.length === 0 ? (
					<EmptyState
						icon={FolderGit2}
						title="No registered projects"
						description="Register a repository above or run `autopilot init` from the repo root."
						height="h-44"
					/>
				) : (
					<div className="divide-y divide-border/60">
						{projectsQuery.data.map((project) => (
							<div key={project.id} className="flex items-start justify-between gap-4 px-4 py-4">
								<div className="min-w-0 flex-1">
									<p className="text-sm font-medium text-foreground">{project.name}</p>
									<p className="mt-1 break-all font-mono text-xs text-muted-foreground">
										{project.path}
									</p>
									<div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
										{project.git_remote ? <span>remote: {project.git_remote}</span> : null}
										{project.default_branch ? <span>branch: {project.default_branch}</span> : null}
									</div>
								</div>
								<Button
									variant="destructive"
									size="sm"
									onClick={() => void handleDelete(project.id)}
									loading={deleteMutation.isPending}
								>
									Remove
								</Button>
							</div>
						))}
					</div>
				)}
			</SurfaceSection>
		</div>
	)
}
