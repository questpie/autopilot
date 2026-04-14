import { useState } from 'react'
import { ArrowUp, ArrowDown } from '@phosphor-icons/react'
import { Spinner } from '@/components/ui/spinner'
import { EmptyState } from '@/components/ui/empty-state'
import { Badge } from '@/components/ui/badge'
import { useItemChildren } from '@/hooks/use-items'
import type { RendererProps, ItemRecord } from '@/lib/renderer-registry'
import { cn } from '@/lib/utils'

type ColumnFormat = 'text' | 'number' | 'currency' | 'date' | 'badge'

interface Column {
  key: string
  label: string
  align?: 'left' | 'right'
  format?: ColumnFormat
}

function formatCellValue(raw: unknown, format: ColumnFormat): React.ReactNode {
  if (raw == null) return <span className="text-muted-foreground">—</span>

  if (format === 'badge') {
    return (
      <Badge variant="outline" className="font-mono text-[10px]">
        {String(raw)}
      </Badge>
    )
  }

  if (format === 'date') {
    const d = new Date(String(raw))
    return isNaN(d.getTime()) ? String(raw) : d.toLocaleDateString()
  }

  if (format === 'currency') {
    const n = Number(raw)
    return isNaN(n)
      ? String(raw)
      : n.toLocaleString(undefined, { style: 'currency', currency: 'USD' })
  }

  if (format === 'number') {
    const n = Number(raw)
    return isNaN(n) ? String(raw) : n.toLocaleString()
  }

  return String(raw)
}

function compareValues(a: unknown, b: unknown): number {
  if (a == null && b == null) return 0
  if (a == null) return 1
  if (b == null) return -1
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b))
}

interface SortState {
  key: string
  dir: 'asc' | 'desc'
}

interface TableHeaderCellProps {
  column: Column
  sort: SortState | null
  onSort: (key: string) => void
}

function TableHeaderCell({ column, sort, onSort }: TableHeaderCellProps) {
  const isActive = sort?.key === column.key
  return (
    <th
      className={cn(
        'border-b border-border px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground',
        column.align === 'right' ? 'text-right' : 'text-left',
      )}
    >
      <button
        type="button"
        className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
        onClick={() => onSort(column.key)}
      >
        {column.label}
        {isActive ? (
          sort?.dir === 'asc' ? (
            <ArrowUp size={10} />
          ) : (
            <ArrowDown size={10} />
          )
        ) : null}
      </button>
    </th>
  )
}

interface TableRowProps {
  item: ItemRecord
  columns: Column[]
  navigate: (path: string) => void
}

function TableRow({ item, columns, navigate }: TableRowProps) {
  const frontmatter = item.frontmatter ?? {}
  return (
    <tr
      className="cursor-pointer border-b border-border transition-colors hover:bg-muted"
      onClick={() => navigate(item.path)}
    >
      {columns.map((col) => (
        <td
          key={col.key}
          className={cn(
            'px-3 py-2 font-mono text-xs text-foreground',
            col.align === 'right' ? 'text-right' : 'text-left',
          )}
        >
          {formatCellValue(frontmatter[col.key], col.format ?? 'text')}
        </td>
      ))}
    </tr>
  )
}

export function GenericTableRenderer({ item, type, navigate }: RendererProps) {
  const { data, isLoading } = useItemChildren(item.path)
  const [sort, setSort] = useState<SortState | null>(null)

  const rawColumns = type?.display?.list_columns
  const columns: Column[] =
    rawColumns != null && rawColumns.length > 0
      ? rawColumns
      : [{ key: 'path', label: 'Path', format: 'text' }]

  function handleSort(key: string) {
    setSort((prev) => {
      if (prev?.key === key) {
        return { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' }
      }
      return { key, dir: 'asc' }
    })
  }

  const items = data?.items ?? []
  const sorted = sort
    ? [...items].sort((a, b) => {
        const aVal = sort.key === 'path' ? a.path : (a.frontmatter?.[sort.key] ?? null)
        const bVal = sort.key === 'path' ? b.path : (b.frontmatter?.[sort.key] ?? null)
        const cmp = compareValues(aVal, bVal)
        return sort.dir === 'asc' ? cmp : -cmp
      })
    : items

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="shrink-0 border-b border-border px-4 py-2.5">
        <p className="font-mono text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          {type?.name ?? 'Items'}
        </p>
        <p className="mt-0.5 truncate font-mono text-xs text-foreground">{item.path}</p>
      </div>

      <div className="flex-1 overflow-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Spinner size="default" className="text-muted-foreground" />
          </div>
        ) : sorted.length === 0 ? (
          <EmptyState title="No items" description="This folder has no items." height="h-48" />
        ) : (
          <table className="w-full border-collapse">
            <thead className="sticky top-0 bg-background">
              <tr>
                {columns.map((col) => (
                  <TableHeaderCell key={col.key} column={col} sort={sort} onSort={handleSort} />
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((child) => (
                <TableRow key={child.path} item={child} columns={columns} navigate={navigate} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
