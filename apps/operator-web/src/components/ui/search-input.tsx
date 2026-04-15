import type * as React from "react"
import { MagnifyingGlass, SpinnerGap, X } from "@phosphor-icons/react"

import { cn } from "@/lib/utils"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import { Kbd } from "@/components/ui/kbd"

interface SearchInputProps extends Omit<React.ComponentProps<"input">, "type"> {
  shortcut?: string
  onClear?: () => void
  isLoading?: boolean
  containerClassName?: string
}

export function SearchInput({
  shortcut,
  onClear,
  isLoading = false,
  containerClassName,
  className,
  value,
  ...props
}: SearchInputProps): React.ReactElement {
  const hasValue = value !== undefined && value !== ""
  const showClearButton = hasValue && onClear
  const showShortcut = shortcut && !hasValue

  return (
    <InputGroup
      data-slot="search-input"
      className={cn("bg-transparent", containerClassName)}
    >
      <InputGroupAddon align="inline-start">
        {isLoading ? (
          <SpinnerGap className="text-muted-foreground size-4 animate-spin" />
        ) : (
          <MagnifyingGlass className="text-muted-foreground size-4" />
        )}
      </InputGroupAddon>

      <InputGroupInput
        placeholder="Search..."
        value={value}
        className={cn("bg-transparent", className)}
        {...props}
      />

      {(showClearButton || showShortcut) && (
        <InputGroupAddon align="inline-end">
          {showClearButton && (
            <InputGroupButton
              onClick={onClear}
              size="icon-xs"
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </InputGroupButton>
          )}
          {showShortcut && <Kbd>{shortcut}</Kbd>}
        </InputGroupAddon>
      )}
    </InputGroup>
  )
}
