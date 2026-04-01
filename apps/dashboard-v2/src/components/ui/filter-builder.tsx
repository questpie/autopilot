import * as React from "react"
import { PlusIcon, XIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

// ── Types ────────────────────────────────────────────────────────────────────

export interface FilterField {
  key: string
  label: string
  type: "text" | "select" | "number" | "date" | "enum"
  options?: Array<{ value: string; label: string }>
  operators?: string[]
}

export interface FilterValue {
  field: string
  operator: string
  value: string
}

// ── Default operators by field type ──────────────────────────────────────────

const DEFAULT_OPERATORS: Record<FilterField["type"], string[]> = {
  text: ["equals", "contains", "starts_with", "ends_with"],
  number: ["equals", "gt", "gte", "lt", "lte"],
  date: ["equals", "before", "after", "between"],
  enum: ["equals", "in", "not_in"],
  select: ["equals", "in", "not_in"],
}

const OPERATOR_LABELS: Record<string, string> = {
  equals: "equals",
  contains: "contains",
  starts_with: "starts with",
  ends_with: "ends with",
  gt: ">",
  gte: ">=",
  lt: "<",
  lte: "<=",
  before: "before",
  after: "after",
  between: "between",
  in: "in",
  not_in: "not in",
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function getOperatorsForField(field: FilterField): string[] {
  return field.operators ?? DEFAULT_OPERATORS[field.type]
}

function getFieldByKey(
  fields: FilterField[],
  key: string
): FilterField | undefined {
  return fields.find((f) => f.key === key)
}

// ── URL param serialization hook ─────────────────────────────────────────────

/**
 * Serialize filter values to a URL-safe string.
 * Format: field:operator:value separated by `;`
 */
export function serializeFilters(filters: FilterValue[]): string {
  return filters
    .map(
      (f) =>
        `${encodeURIComponent(f.field)}:${encodeURIComponent(f.operator)}:${encodeURIComponent(f.value)}`
    )
    .join(";")
}

/**
 * Deserialize a URL param string back to filter values.
 */
export function deserializeFilters(param: string): FilterValue[] {
  if (!param) return []
  return param
    .split(";")
    .map((segment) => {
      const parts = segment.split(":")
      if (parts.length < 3) return null
      const [field, operator, ...rest] = parts
      return {
        field: decodeURIComponent(field ?? ""),
        operator: decodeURIComponent(operator ?? ""),
        value: decodeURIComponent(rest.join(":")),
      }
    })
    .filter((v): v is FilterValue => v !== null && v.field !== "" && v.operator !== "")
}

/**
 * Hook that manages filter state synced with a URL search param.
 *
 * @param paramName - The query param key to use (default: "filters")
 * @param getSearchParam - Getter for the current search param value
 * @param setSearchParam - Setter to update the search param value
 */
export function useFilterParams(options: {
  paramName?: string
  getSearchParam: (key: string) => string | undefined
  setSearchParam: (key: string, value: string | undefined) => void
}): {
  filters: FilterValue[]
  setFilters: (filters: FilterValue[]) => void
} {
  const { paramName = "filters", getSearchParam, setSearchParam } = options

  const raw = getSearchParam(paramName)
  const filters = React.useMemo(() => deserializeFilters(raw ?? ""), [raw])

  const setFilters = React.useCallback(
    (next: FilterValue[]) => {
      const serialized = serializeFilters(next)
      setSearchParam(paramName, serialized || undefined)
    },
    [paramName, setSearchParam]
  )

  return { filters, setFilters }
}

// ── Value input component ────────────────────────────────────────────────────

function FilterValueInput({
  field,
  value,
  onChange,
}: {
  field: FilterField | undefined
  value: string
  onChange: (value: string) => void
}) {
  if (!field) {
    return <Input placeholder="Value" value={value} onChange={(e) => onChange(e.target.value)} />
  }

  if (field.type === "enum" || field.type === "select") {
    return (
      <Select value={value} onValueChange={(v) => onChange(v ?? "")}>
        <SelectTrigger size="sm" className="min-w-24">
          <SelectValue placeholder="Value" />
        </SelectTrigger>
        <SelectContent>
          {(field.options ?? []).map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  if (field.type === "number") {
    return (
      <Input
        type="number"
        placeholder="Value"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-20 max-w-28"
      />
    )
  }

  if (field.type === "date") {
    return (
      <Input
        type="date"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="min-w-28"
      />
    )
  }

  return (
    <Input
      placeholder="Value"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="min-w-24"
    />
  )
}

// ── Filter row ───────────────────────────────────────────────────────────────

function FilterRow({
  fields,
  filter,
  onChange,
  onRemove,
}: {
  fields: FilterField[]
  filter: FilterValue
  onChange: (updated: FilterValue) => void
  onRemove: () => void
}) {
  const currentField = getFieldByKey(fields, filter.field)
  const operators = currentField ? getOperatorsForField(currentField) : []

  const handleFieldChange = (nextFieldKey: string) => {
    const nextField = getFieldByKey(fields, nextFieldKey)
    const nextOperators = nextField ? getOperatorsForField(nextField) : []
    const firstOperator = nextOperators[0] ?? ""
    onChange({ field: nextFieldKey, operator: firstOperator, value: "" })
  }

  const handleOperatorChange = (nextOperator: string) => {
    onChange({ ...filter, operator: nextOperator })
  }

  const handleValueChange = (nextValue: string) => {
    onChange({ ...filter, value: nextValue })
  }

  return (
    <div className="flex items-center gap-2">
      <Select value={filter.field} onValueChange={(v) => handleFieldChange(v ?? "")}>
        <SelectTrigger size="sm" className="min-w-24">
          <SelectValue placeholder="Field" />
        </SelectTrigger>
        <SelectContent>
          {fields.map((f) => (
            <SelectItem key={f.key} value={f.key}>
              {f.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={filter.operator} onValueChange={(v) => handleOperatorChange(v ?? "")}>
        <SelectTrigger size="sm" className="min-w-20">
          <SelectValue placeholder="Operator" />
        </SelectTrigger>
        <SelectContent>
          {operators.map((op) => (
            <SelectItem key={op} value={op}>
              {OPERATOR_LABELS[op] ?? op}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <FilterValueInput
        field={currentField}
        value={filter.value}
        onChange={handleValueChange}
      />

      <Button
        variant="ghost"
        size="icon-xs"
        onClick={onRemove}
        aria-label="Remove filter"
        className="shrink-0"
      >
        <XIcon size={14} />
      </Button>
    </div>
  )
}

// ── FilterBuilder ────────────────────────────────────────────────────────────

export interface FilterBuilderProps {
  fields: FilterField[]
  value: FilterValue[]
  onChange: (filters: FilterValue[]) => void
  className?: string
}

export function FilterBuilder({
  fields,
  value,
  onChange,
  className,
}: FilterBuilderProps) {
  const addFilter = () => {
    const firstField = fields[0]
    if (!firstField) return
    const operators = getOperatorsForField(firstField)
    onChange([
      ...value,
      { field: firstField.key, operator: operators[0] ?? "equals", value: "" },
    ])
  }

  const updateFilter = (index: number, updated: FilterValue) => {
    const next = value.map((f, i) => (i === index ? updated : f))
    onChange(next)
  }

  const removeFilter = (index: number) => {
    onChange(value.filter((_, i) => i !== index))
  }

  if (value.length === 0) {
    return (
      <div className={cn("flex items-center gap-2", className)}>
        <span className="text-xs text-muted-foreground">No filters applied</span>
        <Button variant="ghost" size="sm" onClick={addFilter}>
          <PlusIcon size={14} data-icon="inline-start" />
          Add filter
        </Button>
      </div>
    )
  }

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-none border border-border bg-muted/30 p-2",
        className
      )}
    >
      {value.map((filter, index) => (
        <FilterRow
          key={index}
          fields={fields}
          filter={filter}
          onChange={(updated) => updateFilter(index, updated)}
          onRemove={() => removeFilter(index)}
        />
      ))}
      <div>
        <Button variant="ghost" size="sm" onClick={addFilter}>
          <PlusIcon size={14} data-icon="inline-start" />
          Add filter
        </Button>
      </div>
    </div>
  )
}
