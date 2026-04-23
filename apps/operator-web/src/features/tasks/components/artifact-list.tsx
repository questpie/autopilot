import { useState } from 'react'
import {
  FileArrowUp,
  Globe,
  FileText,
  TestTube,
  Image,
  File,
  ArrowSquareOut,
  DownloadSimple,
} from '@phosphor-icons/react'
import type { Artifact, ArtifactKind } from '@/api/types'
import { getArtifactContentUrl } from '@/api/runs.api'
import { useArtifactContent } from '@/hooks/use-artifact-content'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Spinner } from '@/components/ui/spinner'
import { surfaceCardVariants } from '@/components/ui/surface-card'
import { cn } from '@/lib/utils'
import { setDraggedChatAttachment } from '@/features/chat/lib/chat-dnd'
import { DiffViewer } from './diff-viewer'

// ── icon mapping ──────────────────────────────────────────────────────────────

function artifactIcon(kind: ArtifactKind) {
  switch (kind) {
    case 'changed_file':
      return FileArrowUp
    case 'preview_url':
      return Globe
    case 'doc':
    case 'diff_summary':
    case 'implementation_prompt':
    case 'validation_report':
      return FileText
    case 'test_report':
      return TestTube
    case 'preview_file':
      return Image
    case 'external_receipt':
      return ArrowSquareOut
    default:
      return File
  }
}

// ── diff kinds ────────────────────────────────────────────────────────────────

const DIFF_KINDS: ArtifactKind[] = ['changed_file', 'diff_summary']

function isDiffKind(kind: ArtifactKind): boolean {
  return DIFF_KINDS.includes(kind)
}

// ── diff content dialog ───────────────────────────────────────────────────────

interface DiffDialogProps {
  artifact: Artifact | null
  onClose: () => void
}

function DiffContentDialog({ artifact, onClose }: DiffDialogProps) {
  // Fetch from blob only when ref_value is empty and blob_id is set
  const needsBlob = artifact !== null && !artifact.ref_value && artifact.blob_id !== null

  const { data: blobContent, isLoading, error } = useArtifactContent(
    needsBlob && artifact
      ? { runId: artifact.run_id, artifactId: artifact.id }
      : null
  )

  if (!artifact) return null

  const diffText = artifact.ref_value || blobContent || ''

  return (
    <Dialog open={!!artifact} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-4xl max-h-[80vh] flex flex-col overflow-hidden p-0">
        <DialogHeader className="px-4 pt-4 pb-3 shrink-0">
          <DialogTitle className="text-sm font-semibold">{artifact.title}</DialogTitle>
        </DialogHeader>
        <div className="flex-1 overflow-auto min-h-0">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Spinner size="default" className="text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="px-4 py-4 text-sm text-destructive">
              Failed to load diff content: {error instanceof Error ? error.message : String(error)}
            </div>
          ) : (
            <DiffViewer diff={diffText} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ── inline content dialog ─────────────────────────────────────────────────────

interface InlineDialogProps {
  artifact: Artifact | null
  onClose: () => void
}

function InlineContentDialog({ artifact, onClose }: InlineDialogProps) {
  if (!artifact) return null

  return (
    <Dialog open={!!artifact} onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-sm font-semibold">{artifact.title}</DialogTitle>
        </DialogHeader>
        <pre className="mt-2 whitespace-pre-wrap break-words font-mono text-[12px] text-foreground">
          {artifact.ref_value || '(empty)'}
        </pre>
      </DialogContent>
    </Dialog>
  )
}

// ── single artifact card ──────────────────────────────────────────────────────

interface ArtifactCardProps {
  artifact: Artifact
  onInlineOpen: (artifact: Artifact) => void
  onDiffOpen: (artifact: Artifact) => void
}

function ArtifactCard({ artifact, onInlineOpen, onDiffOpen }: ArtifactCardProps) {
  const Icon = artifactIcon(artifact.kind)

  function handleClick() {
    if (artifact.ref_kind === 'url') {
      window.open(artifact.ref_value, '_blank', 'noopener,noreferrer')
    } else if (artifact.ref_kind === 'file') {
      const encoded = encodeURIComponent(artifact.ref_value)
      window.location.href = `/files?path=${encoded}&view=file`
    } else if (artifact.ref_kind === 'inline') {
      if (isDiffKind(artifact.kind)) {
        onDiffOpen(artifact)
      } else {
        onInlineOpen(artifact)
      }
    } else if (artifact.ref_kind === 'base64') {
      const url = getArtifactContentUrl(artifact.run_id, artifact.id)
      const a = document.createElement('a')
      a.href = url
      a.download = artifact.title
      a.click()
    }
  }

  // Truncate ref_value for display
  const displayRef = artifact.ref_value
    ? artifact.ref_value.length > 60
      ? `…${artifact.ref_value.slice(-57)}`
      : artifact.ref_value
    : null

  return (
    <button
      type="button"
      onClick={handleClick}
      draggable
      onDragStart={(e) => {
        setDraggedChatAttachment(e.dataTransfer, {
          type: 'ref',
          source: 'drag',
          label: artifact.title,
          refType: 'artifact',
          refId: artifact.id,
          metadata: {
            artifactId: artifact.id,
            runId: artifact.run_id,
            kind: artifact.kind,
            refKind: artifact.ref_kind,
            refValue: artifact.ref_value,
          },
        })
      }}
      className={cn(
        surfaceCardVariants({ size: 'sm', interactive: true }),
        'w-full text-left',
        'flex items-start gap-2.5',
      )}
    >
      <Icon size={14} className="shrink-0 mt-0.5 text-muted-foreground" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="truncate text-sm font-medium text-foreground">{artifact.title}</span>
          <Badge variant="outline" className="shrink-0 capitalize">
            {artifact.kind}
          </Badge>
        </div>
        {displayRef && (
	          <p className="mt-0.5 truncate text-xs text-muted-foreground/70">{displayRef}</p>
        )}
      </div>
      {artifact.ref_kind === 'url' && (
        <ArrowSquareOut size={12} className="shrink-0 mt-0.5 text-muted-foreground" />
      )}
      {artifact.ref_kind === 'base64' && (
        <DownloadSimple size={12} className="shrink-0 mt-0.5 text-muted-foreground" />
      )}
    </button>
  )
}

// ── public component ──────────────────────────────────────────────────────────

interface ArtifactListProps {
  artifacts: Artifact[]
}

export function ArtifactList({ artifacts }: ArtifactListProps) {
  const [inlineArtifact, setInlineArtifact] = useState<Artifact | null>(null)
  const [diffArtifact, setDiffArtifact] = useState<Artifact | null>(null)

  if (artifacts.length === 0) return null

  return (
    <>
      <div className="space-y-1">
        {artifacts.map((art) => (
          <ArtifactCard
            key={art.id}
            artifact={art}
            onInlineOpen={setInlineArtifact}
            onDiffOpen={setDiffArtifact}
          />
        ))}
      </div>
      <InlineContentDialog
        artifact={inlineArtifact}
        onClose={() => setInlineArtifact(null)}
      />
      <DiffContentDialog
        artifact={diffArtifact}
        onClose={() => setDiffArtifact(null)}
      />
    </>
  )
}
