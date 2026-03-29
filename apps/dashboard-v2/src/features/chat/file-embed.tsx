import { lazy, useState, useCallback, memo, Suspense } from "react"
import {
  FileTextIcon,
  FileCodeIcon,
  ImageIcon,
  FilePdfIcon,
  FileIcon,
  FileZipIcon,
  FileCsvIcon,
  DownloadSimpleIcon,
  ArrowSquareOutIcon,
  ImageBrokenIcon,
  CaretDownIcon,
} from "@phosphor-icons/react"
import { cn } from "@/lib/utils"
import { API_BASE } from "@/lib/api"

// Lazy-loaded — only needed when user clicks an image
const ImageLightbox = lazy(() => import("./image-lightbox").then((m) => ({ default: m.ImageLightbox })))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico"])
const CODE_EXTENSIONS = new Set([
  "ts", "tsx", "js", "jsx", "mjs", "cjs",
  "py", "rs", "go", "java", "kt", "rb", "c", "cpp", "h", "hpp",
  "css", "scss", "html", "json", "yaml", "yml", "toml", "xml",
  "sh", "bash", "zsh", "sql", "md", "mdx", "graphql", "prisma",
  "vue", "svelte", "astro",
])
const PDF_EXTENSIONS = new Set(["pdf"])
const ARCHIVE_EXTENSIONS = new Set(["zip", "tar", "gz", "bz2", "7z", "rar"])
const CSV_EXTENSIONS = new Set(["csv", "tsv"])

function getExtension(path: string): string {
  const dot = path.lastIndexOf(".")
  if (dot === -1) return ""
  return path.slice(dot + 1).toLowerCase()
}

function getFileName(path: string): string {
  return path.split("/").pop() ?? path
}

function getFileIcon(ext: string) {
  if (IMAGE_EXTENSIONS.has(ext)) return ImageIcon
  if (CODE_EXTENSIONS.has(ext)) return FileCodeIcon
  if (PDF_EXTENSIONS.has(ext)) return FilePdfIcon
  if (ARCHIVE_EXTENSIONS.has(ext)) return FileZipIcon
  if (CSV_EXTENSIONS.has(ext)) return FileCsvIcon
  if (["txt", "log", "doc", "docx", "rtf"].includes(ext)) return FileTextIcon
  return FileIcon
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function isImage(ext: string): boolean {
  return IMAGE_EXTENSIONS.has(ext)
}

function isCode(ext: string): boolean {
  return CODE_EXTENSIONS.has(ext)
}

function resolveUrl(path: string): string {
  if (path.startsWith("http://") || path.startsWith("https://")) return path
  return `${API_BASE}/api/files${path.startsWith("/") ? "" : "/"}${path}`
}

// ---------------------------------------------------------------------------
// Generic file embed (non-image, non-code)
// ---------------------------------------------------------------------------

interface FileEmbedCardProps {
  path: string
  size?: number
}

export const FileEmbedCard = memo(function FileEmbedCard({ path, size }: FileEmbedCardProps) {
  const ext = getExtension(path)
  const fileName = getFileName(path)
  const Icon = getFileIcon(ext)
  const url = resolveUrl(path)

  return (
    <div className="mt-1.5 inline-flex w-full max-w-sm items-center gap-2.5 rounded border border-border bg-muted/5 px-3 py-2">
      <Icon size={20} className="shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-foreground">
          {fileName}
        </span>
      </div>
      {size != null && (
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {formatFileSize(size)}
        </span>
      )}
      <a
        href={url}
        download={fileName}
        onClick={(e) => e.stopPropagation()}
        className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
        aria-label={`Download ${fileName}`}
        title="Download"
      >
        <DownloadSimpleIcon size={14} />
      </a>
    </div>
  )
})

// ---------------------------------------------------------------------------
// Image embed
// ---------------------------------------------------------------------------

interface ImageEmbedProps {
  path: string
  alt?: string
}

export const ImageEmbed = memo(function ImageEmbed({ path, alt }: ImageEmbedProps) {
  const [lightbox, setLightbox] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [error, setError] = useState(false)

  const fileName = getFileName(path)
  const url = resolveUrl(path)

  const handleLoad = useCallback(() => setLoaded(true), [])
  const handleError = useCallback(() => setError(true), [])
  const openLightbox = useCallback(() => setLightbox(true), [])
  const closeLightbox = useCallback(() => setLightbox(false), [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault()
        openLightbox()
      }
    },
    [openLightbox],
  )

  if (error) {
    return (
      <div className="mt-1.5 inline-flex items-center gap-2 rounded border border-border bg-muted/5 px-3 py-2 text-xs text-muted-foreground">
        <ImageBrokenIcon size={16} />
        <span className="truncate">{fileName}</span>
      </div>
    )
  }

  return (
    <>
      <div className="mt-1.5">
        {/* Skeleton placeholder while loading */}
        {!loaded && (
          <div className="h-[200px] w-full max-w-md animate-pulse rounded bg-muted/20" />
        )}
        <img
          src={url}
          alt={alt ?? fileName}
          onLoad={handleLoad}
          onError={handleError}
          onClick={openLightbox}
          onKeyDown={handleKeyDown}
          role="button"
          tabIndex={0}
          aria-label={`View ${alt ?? fileName}`}
          className={cn(
            "max-h-[300px] max-w-full cursor-pointer rounded object-cover transition-opacity",
            loaded ? "opacity-100" : "absolute opacity-0",
          )}
        />
      </div>
      {lightbox && (
        <Suspense fallback={null}>
          <ImageLightbox src={url} alt={alt ?? fileName} onClose={closeLightbox} />
        </Suspense>
      )}
    </>
  )
})

// ---------------------------------------------------------------------------
// Code / artifact embed (for agent write_file results)
// ---------------------------------------------------------------------------

interface CodeEmbedProps {
  path: string
  /** Optional code content preview */
  content?: string
  /** Optional callback when "Open" is clicked */
  onOpen?: (path: string) => void
}

const CODE_PREVIEW_LINES = 8

export const CodeEmbed = memo(function CodeEmbed({ path, content, onOpen }: CodeEmbedProps) {
  const [expanded, setExpanded] = useState(false)
  const fileName = getFileName(path)
  const ext = getExtension(path)
  const Icon = getFileIcon(ext)

  const lines = content?.split("\n") ?? []
  const isLong = lines.length > CODE_PREVIEW_LINES
  const displayLines = expanded ? lines : lines.slice(0, CODE_PREVIEW_LINES)

  return (
    <div className="mt-1.5 w-full max-w-lg overflow-hidden rounded border border-border bg-muted/5">
      {/* Header */}
      <div className="flex items-center gap-2 border-b border-border px-3 py-1.5">
        <Icon size={14} className="shrink-0 text-muted-foreground" />
        <span className="min-w-0 flex-1 truncate font-heading text-xs text-foreground">
          {fileName}
        </span>
        {onOpen && (
          <button
            type="button"
            onClick={() => onOpen(path)}
            className="flex items-center gap-1 text-[10px] text-primary/80 transition-colors hover:text-primary"
          >
            <ArrowSquareOutIcon size={12} />
            open
          </button>
        )}
      </div>

      {/* Code preview */}
      {content && (
        <>
          <div className="overflow-x-auto p-2 font-mono text-[11px] leading-relaxed">
            <table className="border-collapse">
              <tbody>
                {displayLines.map((line, i) => (
                  <tr key={i}>
                    <td className="select-none pr-3 text-right text-[10px] text-muted-foreground/40 tabular-nums">
                      {i + 1}
                    </td>
                    <td className="whitespace-pre text-foreground/80">{line}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Expand / collapse */}
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="flex w-full items-center justify-center gap-1 border-t border-border py-1 font-heading text-[10px] text-muted-foreground transition-colors hover:text-foreground"
            >
              <CaretDownIcon
                size={10}
                className={cn("transition-transform", expanded && "rotate-180")}
              />
              {expanded ? "Show less" : `${lines.length - CODE_PREVIEW_LINES} more lines`}
            </button>
          )}
        </>
      )}
    </div>
  )
})

// ---------------------------------------------------------------------------
// Smart embed picker — renders the appropriate embed based on file type
// ---------------------------------------------------------------------------

export interface FileAttachment {
  path: string
  size?: number
  /** Optional code content for artifact / write_file results */
  content?: string
}

interface FileEmbedsProps {
  attachments: FileAttachment[]
  onOpenFile?: (path: string) => void
}

export const FileEmbeds = memo(function FileEmbeds({ attachments, onOpenFile }: FileEmbedsProps) {
  if (attachments.length === 0) return null

  return (
    <div className="flex flex-col gap-1">
      {attachments.map((att) => {
        const ext = getExtension(att.path)

        if (isImage(ext)) {
          return <ImageEmbed key={att.path} path={att.path} />
        }

        if (isCode(ext) && att.content) {
          return (
            <CodeEmbed
              key={att.path}
              path={att.path}
              content={att.content}
              onOpen={onOpenFile}
            />
          )
        }

        return <FileEmbedCard key={att.path} path={att.path} size={att.size} />
      })}
    </div>
  )
})
