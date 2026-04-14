import type React from 'react'

// ItemRecord and TypeDefinition types — defined inline for now.
// They'll be imported from @questpie/autopilot-spec once the spec agent builds them.

export interface ItemRecord {
  path: string
  is_dir: boolean
  type: string | null
  type_source: string | null
  frontmatter: Record<string, unknown> | null
  body_preview: string | null
  size: number | null
  mtime: string
  hash: string | null
  parent_path: string | null
  indexed_at: string
}

export interface TypeDefinition {
  id: string
  name: string
  description?: string
  category: 'file' | 'folder'
  match: {
    extensions?: string[]
    glob?: string
    is_dir?: boolean
    children_type?: string
  }
  display?: {
    icon?: string
    color?: string
    list_columns?: Array<{
      key: string
      label: string
      align?: 'left' | 'right'
      format?: 'text' | 'number' | 'currency' | 'date' | 'badge'
    }>
    primary_field?: string
    secondary_field?: string
  }
  renderer?: {
    builtin?: string
    generic?: {
      kind: 'detail-card' | 'kanban' | 'table' | 'timeline' | 'gallery'
      config?: Record<string, unknown>
    }
  }
  aggregations?: Array<{
    id: string
    label: string
    query: { type: string; where?: Record<string, unknown> }
    op: 'count' | 'sum' | 'avg' | 'min' | 'max'
    field?: string
    format?: 'text' | 'number' | 'currency'
  }>
}

export interface RendererProps {
  item: ItemRecord
  type: TypeDefinition | undefined
  navigate: (path: string) => void
}

export type RendererComponent = React.ComponentType<RendererProps>

interface RendererEntry {
  id: string
  component: RendererComponent
  match: {
    type?: string
    typeIn?: string[]
    is_dir?: boolean
    fallback?: boolean
  }
  priority: number
}

// Forward-declared so the registry's resolve() can reference it before import.
// The actual component is set by registerFallback() called from renderers/index.ts.
let _fallbackComponent: RendererComponent | null = null

export function registerFallback(component: RendererComponent): void {
  _fallbackComponent = component
}

class RendererRegistryImpl {
  private entries: RendererEntry[] = []

  register(entry: RendererEntry): void {
    this.entries.push(entry)
    this.entries.sort((a, b) => b.priority - a.priority)
  }

  resolve(item: ItemRecord): RendererComponent {
    for (const entry of this.entries) {
      if (this.matches(entry, item)) {
        return entry.component
      }
    }
    // _fallbackComponent is always set by renderers/index.ts before any resolve() call
    if (_fallbackComponent !== null) {
      return _fallbackComponent
    }
    // This path should never be reached in practice; throw loud as per project guidelines
    throw new Error(
      `RendererRegistry: no renderer matched item "${item.path}" and no fallback registered`,
    )
  }

  private matches(entry: RendererEntry, item: ItemRecord): boolean {
    if (entry.match.is_dir != null && entry.match.is_dir !== item.is_dir) return false
    if (entry.match.type != null && entry.match.type !== item.type) return false
    if (entry.match.typeIn != null && !entry.match.typeIn.includes(item.type ?? '')) return false
    if (entry.match.fallback === true) return true
    if (entry.match.type == null && entry.match.typeIn == null) return false
    return true
  }
}

export const rendererRegistry = new RendererRegistryImpl()
