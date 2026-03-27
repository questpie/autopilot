import { useCallback } from "react"
import { useQuery } from "@tanstack/react-query"
import { useNavigate, useMatches } from "@tanstack/react-router"
import { useDraggable, useDroppable } from "@dnd-kit/core"
import { motion, AnimatePresence } from "framer-motion"
import {
  FolderSimpleIcon,
  CaretRightIcon,
  FileIcon,
  FileTextIcon,
  FileImageIcon,
  FileCodeIcon,
  FileLockIcon,
  FilePdfIcon,
  FileDocIcon,
} from "@phosphor-icons/react"
import { useFileUIStore } from "./file-ui.store"
import { directoryQuery, type FsEntry } from "./files.queries"
import { FileTreeContextMenu } from "./file-tree-context-menu"
import { cn } from "@/lib/utils"
import { EASING, DURATION, useMotionPreference } from "@/lib/motion"
import type { Icon } from "@phosphor-icons/react"

function getFileIcon(entry: FsEntry, path: string): Icon {
  if (entry.type === "directory") return FolderSimpleIcon

  const ext = entry.name.split(".").pop()?.toLowerCase() ?? ""
  if (path.startsWith("secrets/")) return FileLockIcon
  if (["md", "txt"].includes(ext)) return FileTextIcon
  if (["png", "jpg", "jpeg", "gif", "svg", "webp"].includes(ext)) return FileImageIcon
  if (["ts", "tsx", "js", "jsx", "css", "html"].includes(ext)) return FileCodeIcon
  if (ext === "pdf") return FilePdfIcon
  if (["yaml", "yml", "json"].includes(ext)) return FileDocIcon
  return FileIcon
}

interface FileTreeItemProps {
  entry: FsEntry
  parentPath: string
  depth: number
}

export function FileTreeItem({ entry, parentPath, depth }: FileTreeItemProps) {
  const navigate = useNavigate()
  const matches = useMatches()
  const currentPath = matches[matches.length - 1]?.pathname ?? ""
  const { shouldReduce } = useMotionPreference()

  const fullPath = parentPath ? `${parentPath}/${entry.name}` : entry.name
  const routePath = `/files/${fullPath}`

  const expandedPaths = useFileUIStore((s) => s.expandedPaths)
  const togglePath = useFileUIStore((s) => s.togglePath)
  const isExpanded = expandedPaths.has(fullPath)
  const isActive = currentPath === routePath || currentPath === `${routePath}/`

  const isDir = entry.type === "directory"
  const IconCmp = getFileIcon(entry, fullPath)

  // DnD Kit: every item is draggable, directories are also droppable
  const { attributes, listeners, setNodeRef: setDragRef, isDragging } = useDraggable({
    id: fullPath,
  })
  const { setNodeRef: setDropRef, isOver } = useDroppable({
    id: fullPath,
    disabled: !isDir,
  })

  // Load children when expanded
  const { data: children } = useQuery({
    ...directoryQuery(fullPath),
    enabled: isDir && isExpanded,
  })

  const handleClick = useCallback(() => {
    if (isDir) {
      togglePath(fullPath)
    }
    void navigate({ to: "/files/$", params: { _splat: fullPath } })
  }, [isDir, togglePath, fullPath, navigate])

  const sortedChildren = children
    ? [...children].sort((a, b) => {
        if (a.type !== b.type) return a.type === "directory" ? -1 : 1
        return a.name.localeCompare(b.name)
      })
    : []

  return (
    <div
      ref={(node) => {
        setDragRef(node)
        if (isDir) setDropRef(node)
      }}
      className={cn(isDragging && "opacity-40")}
    >
      <FileTreeContextMenu path={fullPath} isDirectory={isDir}>
        <button
          type="button"
          onClick={handleClick}
          className={cn(
            "group flex w-full items-center gap-1.5 py-1 pr-2 font-heading text-xs transition-colors",
            isActive
              ? "bg-primary/5 text-foreground"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
            isOver && isDir && "ring-2 ring-inset ring-primary bg-primary/5",
          )}
          style={{ paddingLeft: `${depth * 12 + 8}px` }}
          title={fullPath}
          {...attributes}
          {...listeners}
        >
          {isDir && (
            <CaretRightIcon
              size={10}
              className={cn(
                "shrink-0 transition-transform",
                isExpanded && "rotate-90",
              )}
            />
          )}
          {!isDir && <span className="w-[10px] shrink-0" />}
          <IconCmp size={14} weight={isActive ? "fill" : "regular"} className="shrink-0" />
          <span className="truncate">{entry.name}</span>
        </button>
      </FileTreeContextMenu>

      {/* Children — animated expand/collapse */}
      {isDir && (
        <AnimatePresence initial={false}>
          {isExpanded && sortedChildren.length > 0 && (
            <motion.div
              key="children"
              initial={shouldReduce ? false : { height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{
                height: { duration: DURATION.normal, ease: EASING.enter },
                opacity: { duration: DURATION.fast },
              }}
              className="overflow-hidden"
            >
              {sortedChildren.map((child) => (
                <FileTreeItem
                  key={child.name}
                  entry={child}
                  parentPath={fullPath}
                  depth={depth + 1}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      )}
    </div>
  )
}
