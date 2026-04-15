import type * as React from "react"

import { cn } from "@/lib/utils"

interface ToolbarProps extends React.ComponentProps<"div"> {}

export function Toolbar({ className, ...props }: ToolbarProps): React.ReactElement {
  return (
    <div
      data-slot="toolbar"
      className={cn(
        "bg-muted/40",
        "flex items-center gap-2 p-1",
        className,
      )}
      {...props}
    />
  )
}

interface ToolbarSectionProps extends React.ComponentProps<"div"> {}

export function ToolbarSection({ className, ...props }: ToolbarSectionProps): React.ReactElement {
  return (
    <div
      data-slot="toolbar-section"
      className={cn("flex items-center gap-1", className)}
      {...props}
    />
  )
}

interface ToolbarSeparatorProps extends React.ComponentProps<"div"> {}

export function ToolbarSeparator({ className, ...props }: ToolbarSeparatorProps): React.ReactElement {
  return (
    <div
      data-slot="toolbar-separator"
      className={cn("bg-border h-4 w-px", className)}
      {...props}
    />
  )
}

interface ToolbarGroupProps extends React.ComponentProps<"div"> {}

export function ToolbarGroup({ className, ...props }: ToolbarGroupProps): React.ReactElement {
  return (
    <div
      data-slot="toolbar-group"
      className={cn("flex items-center", className)}
      {...props}
    />
  )
}
