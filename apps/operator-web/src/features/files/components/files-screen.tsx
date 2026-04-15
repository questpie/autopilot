import { useNavigate, useSearch } from '@tanstack/react-router'
import { useSetLayoutMode } from '@/features/shell/layout-mode-context'
import { DirectoryListing } from './directory-listing'
import { FileView } from './file-view'

export function FilesScreen() {
  useSetLayoutMode('immersive')
  const search = useSearch({ from: '/_authed/files' })
  const path = search.path ?? null
  const runId = search.runId ?? null
  const view = search.view ?? null

  const navigate = useNavigate()

  function handleNavigate(nextPath: string | null, type: 'file' | 'directory') {
    if (type === 'file') {
      void navigate({
        to: '/files',
        search: { runId: runId ?? undefined, path: nextPath ?? undefined, view: 'file' },
      })
    } else {
      void navigate({
        to: '/files',
        search: { runId: runId ?? undefined, path: nextPath ?? undefined },
      })
    }
  }

  function handleBack(parentPath: string | null) {
    void navigate({
      to: '/files',
      search: { runId: runId ?? undefined, path: parentPath ?? undefined },
    })
  }

  if (view === 'file' && path) {
    return (
      <FileView
        path={path}
        runId={runId}
        onBack={handleBack}
      />
    )
  }

  return (
    <DirectoryListing
      path={path}
      runId={runId}
      onNavigate={handleNavigate}
    />
  )
}
