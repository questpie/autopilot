import type * as React from "react"

import { cn } from "@/lib/utils"

interface KbdProps extends React.ComponentProps<"kbd"> {}

export function Kbd({ className, ...props }: KbdProps): React.ReactElement {
  return (
    <kbd
      data-slot="kbd"
      className={cn(
        "bg-muted text-muted-foreground border h-5 rounded-sm px-1.5 font-mono text-[10px] font-medium shadow-xs",
        "pointer-events-none inline-flex items-center select-none",
        className,
      )}
      {...props}
    />
  )
}
