import { useNavigate } from '@tanstack/react-router'
import { Spinner } from '@/components/ui/spinner'
import { rendererRegistry } from '@/lib/renderer-registry'
import { useItem } from '@/hooks/use-items'
import { useType } from '@/hooks/use-types'

// Import to trigger renderer registration
import './renderers'

interface ItemViewProps {
  path: string
}

export function ItemView({ path }: ItemViewProps) {
  const { data: item, isLoading, error } = useItem(path)
  const { data: type } = useType(item?.type)
  const navigate = useNavigate()

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Spinner />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2">
        <p className="font-mono text-xs text-destructive">Failed to load item</p>
        <p className="font-mono text-[10px] text-muted-foreground">{error.message}</p>
      </div>
    )
  }

  if (!item) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="font-mono text-xs text-muted-foreground">Item not found: {path}</p>
      </div>
    )
  }

  const Renderer = rendererRegistry.resolve(item)
  return (
    <Renderer
      item={item}
      type={type}
      navigate={(newPath) => void navigate({ to: '/files', search: { path: newPath } })}
    />
  )
}
