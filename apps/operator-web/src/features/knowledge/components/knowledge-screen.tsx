import { useSetLayoutMode } from '@/features/shell/layout-mode-context'
import { useKnowledgePreferences } from '@/hooks/use-knowledge-preferences'
import { useNavigate, useSearch } from '@tanstack/react-router'
import { type SavedKnowledgeLocation, getBaseName, getParentPath } from '../lib/knowledge-locations'
import { KnowledgeBrowser } from './knowledge-browser'
import { ResourceView } from './resource-view'

export function KnowledgeScreen() {
	useSetLayoutMode('immersive')
	const search = useSearch({ from: '/_authed/knowledge' })
	const path = search.path ?? null
	const runId = search.runId ?? null
	const projectId = search.projectId ?? null
	const view = search.view ?? null
	const selectedPath = search.selected ?? null
	const knowledgePreferences = useKnowledgePreferences()

	const navigate = useNavigate()

	const currentView = view === 'resource' && path ? 'resource' : 'browser'
	const currentPath = currentView === 'resource' ? getParentPath(path) : path
	const activeSelectedPath = currentView === 'resource' ? path : selectedPath

	function remember(location: SavedKnowledgeLocation) {
		knowledgePreferences.addRecent(location)
	}

	function handleNavigate(nextPath: string | null, type: 'file' | 'directory') {
		if (type === 'file') {
			remember({
				path: nextPath,
				runId,
				type,
				label: getBaseName(nextPath, 'File'),
				viewedAt: new Date().toISOString(),
			})
			void navigate({
				to: '/knowledge',
				search: {
					runId: runId ?? undefined,
					projectId: projectId ?? undefined,
					path: nextPath ?? undefined,
					view: 'resource',
				},
			})
		} else {
			remember({
				path: nextPath,
				runId,
				type,
				label: getBaseName(nextPath, runId ? 'Project run' : 'Knowledge'),
				viewedAt: new Date().toISOString(),
			})
			void navigate({
				to: '/knowledge',
				search: {
					runId: runId ?? undefined,
					projectId: projectId ?? undefined,
					path: nextPath ?? undefined,
				},
			})
		}
	}

	function handleBack(parentPath: string | null) {
		void navigate({
			to: '/knowledge',
			search: {
				runId: runId ?? undefined,
				projectId: projectId ?? undefined,
				path: parentPath ?? undefined,
				selected: path ?? undefined,
			},
		})
	}

	function handleSelectItem(nextPath: string) {
		void navigate({
			to: '/knowledge',
			search: {
				runId: runId ?? undefined,
				projectId: projectId ?? undefined,
				path: currentPath ?? undefined,
				selected: nextPath,
			},
		})
	}

	function handleTogglePinned(location: SavedKnowledgeLocation) {
		knowledgePreferences.togglePinned(location)
	}

	return (
		<div className="h-full min-h-0">
			{currentView === 'resource' && path ? (
				<ResourceView
					path={path}
					runId={runId}
					projectId={projectId}
					onBack={handleBack}
					onOpenFile={(nextPath) => handleNavigate(nextPath, 'file')}
				/>
			) : (
				<KnowledgeBrowser
					path={currentPath}
					runId={runId}
					projectId={projectId}
					selectedPath={activeSelectedPath}
					isSelectionPinned={
						activeSelectedPath
							? knowledgePreferences.isPinned({
									path: activeSelectedPath,
									runId,
									type: 'file',
								}) ||
								knowledgePreferences.isPinned({
									path: activeSelectedPath,
									runId,
									type: 'directory',
								})
							: knowledgePreferences.isPinned({
									path: currentPath,
									runId,
									type: 'directory',
								})
					}
					onTogglePinned={handleTogglePinned}
					onSelectItem={handleSelectItem}
					onOpenItem={handleNavigate}
				/>
			)}
		</div>
	)
}
