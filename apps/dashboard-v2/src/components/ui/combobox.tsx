import * as React from "react"
import {
  CaretUpDownIcon,
  PlusIcon,
  XIcon,
} from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import { Badge } from "@/components/ui/badge"
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Spinner } from "@/components/ui/spinner"

export interface ComboboxOption {
  value: string
  label: string
  icon?: React.ReactNode
  description?: string
}

interface ComboboxBaseProps {
  options: ComboboxOption[]
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  onCreate?: (query: string) => void
  isLoading?: boolean
  disabled?: boolean
  className?: string
}

interface ComboboxProps extends ComboboxBaseProps {
  value: string
  onValueChange: (value: string) => void
  clearable?: boolean
}

interface ComboboxMultiProps extends ComboboxBaseProps {
  value: string[]
  onValueChange: (value: string[]) => void
}

/** Shared dropdown content used by both Combobox and ComboboxMulti */
function ComboboxDropdown({
  options,
  search,
  onSearchChange,
  searchPlaceholder,
  emptyText,
  isLoading,
  isChecked,
  onSelect,
  onCreate,
}: {
  options: ComboboxOption[]
  search: string
  onSearchChange: (value: string) => void
  searchPlaceholder: string
  emptyText: string
  isLoading: boolean
  isChecked: (value: string) => boolean
  onSelect: (value: string) => void
  onCreate?: (query: string) => void
}) {
  const showCreate =
    onCreate &&
    search.length > 0 &&
    !options.some(
      (opt) => opt.label.toLowerCase() === search.toLowerCase()
    )

  return (
    <Command shouldFilter={!isLoading}>
      <CommandInput
        placeholder={searchPlaceholder}
        value={search}
        onValueChange={onSearchChange}
      />
      <CommandList>
        <CommandEmpty>
          {isLoading ? (
            <span className="flex items-center justify-center gap-2">
              <Spinner size="sm" />
              Loading...
            </span>
          ) : (
            emptyText
          )}
        </CommandEmpty>
        <CommandGroup>
          {options.map((option) => (
            <CommandItem
              key={option.value}
              value={option.label}
              data-checked={isChecked(option.value)}
              onSelect={() => onSelect(option.value)}
            >
              {option.icon && (
                <span className="shrink-0">{option.icon}</span>
              )}
              <span className="flex flex-col">
                <span>{option.label}</span>
                {option.description && (
                  <span className="text-muted-foreground">
                    {option.description}
                  </span>
                )}
              </span>
            </CommandItem>
          ))}
          {showCreate && (
            <CommandItem
              value={`__create__${search}`}
              onSelect={() => {
                onCreate(search)
                onSearchChange("")
              }}
            >
              <PlusIcon className="size-4" />
              <span>
                Create &ldquo;{search}&rdquo;
              </span>
            </CommandItem>
          )}
        </CommandGroup>
      </CommandList>
    </Command>
  )
}

function TriggerIndicator({ isLoading }: { isLoading: boolean }) {
  if (isLoading) {
    return <Spinner size="sm" />
  }
  return <CaretUpDownIcon className="size-4 text-muted-foreground" />
}

const triggerStyles =
  "flex w-full items-center justify-between gap-1.5 rounded-none border border-input bg-transparent px-2.5 text-xs transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30 dark:hover:bg-input/50"

function Combobox({
  options,
  value,
  onValueChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results found",
  onCreate,
  isLoading = false,
  disabled = false,
  clearable = false,
  className,
}: ComboboxProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const selected = options.find((opt) => opt.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(triggerStyles, "h-8 whitespace-nowrap", className)}
      >
        <span
          className={cn(
            "flex-1 truncate text-left",
            !selected && "text-muted-foreground"
          )}
        >
          {selected ? (
            <span className="flex items-center gap-1.5">
              {selected.icon}
              {selected.label}
            </span>
          ) : (
            placeholder
          )}
        </span>
        <span className="flex shrink-0 items-center gap-0.5">
          {clearable && value && (
            <button
              type="button"
              className="rounded-none p-0.5 text-muted-foreground hover:text-foreground"
              onClick={(e) => {
                e.stopPropagation()
                onValueChange("")
              }}
              aria-label="Clear selection"
            >
              <XIcon className="size-3" />
            </button>
          )}
          <TriggerIndicator isLoading={isLoading} />
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) p-0" align="start">
        <ComboboxDropdown
          options={options}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={searchPlaceholder}
          emptyText={emptyText}
          isLoading={isLoading}
          isChecked={(v) => v === value}
          onSelect={(optionValue) => {
            onValueChange(optionValue === value ? "" : optionValue)
            setOpen(false)
            setSearch("")
          }}
          onCreate={
            onCreate
              ? (query) => {
                  onCreate(query)
                  setOpen(false)
                }
              : undefined
          }
        />
      </PopoverContent>
    </Popover>
  )
}

function ComboboxMulti({
  options,
  value,
  onValueChange,
  placeholder = "Select...",
  searchPlaceholder = "Search...",
  emptyText = "No results found",
  onCreate,
  isLoading = false,
  disabled = false,
  className,
}: ComboboxMultiProps) {
  const [open, setOpen] = React.useState(false)
  const [search, setSearch] = React.useState("")

  const selectedOptions = options.filter((opt) => value.includes(opt.value))

  const handleToggle = (optionValue: string) => {
    if (value.includes(optionValue)) {
      onValueChange(value.filter((v) => v !== optionValue))
    } else {
      onValueChange([...value, optionValue])
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        disabled={disabled}
        className={cn(
          triggerStyles,
          "min-h-8 py-1 whitespace-normal",
          className
        )}
      >
        <span className="flex flex-1 flex-wrap items-center gap-1">
          {selectedOptions.length > 0 ? (
            selectedOptions.map((opt) => (
              <Badge
                key={opt.value}
                variant="secondary"
                className="gap-0.5 pr-1"
              >
                {opt.icon}
                {opt.label}
                <button
                  type="button"
                  className="rounded-none p-0 text-muted-foreground hover:text-foreground"
                  onClick={(e) => {
                    e.stopPropagation()
                    onValueChange(value.filter((v) => v !== opt.value))
                  }}
                  aria-label={`Remove ${opt.label}`}
                >
                  <XIcon className="size-3" />
                </button>
              </Badge>
            ))
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        <span className="shrink-0">
          <TriggerIndicator isLoading={isLoading} />
        </span>
      </PopoverTrigger>
      <PopoverContent className="w-(--anchor-width) p-0" align="start">
        <ComboboxDropdown
          options={options}
          search={search}
          onSearchChange={setSearch}
          searchPlaceholder={searchPlaceholder}
          emptyText={emptyText}
          isLoading={isLoading}
          isChecked={(v) => value.includes(v)}
          onSelect={handleToggle}
          onCreate={onCreate}
        />
      </PopoverContent>
    </Popover>
  )
}

export { Combobox, ComboboxMulti }
