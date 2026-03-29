import { useState } from "react"
import { CaretUpDownIcon } from "@phosphor-icons/react"
import { cn } from "@/lib/utils"

interface ModelPickerProps {
  value: string
  onChange: (modelId: string) => void
  className?: string
}

const MODELS = [
  { id: "anthropic/claude-sonnet-4", label: "Claude Sonnet 4" },
  { id: "anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5" },
  { id: "anthropic/claude-haiku-4.5", label: "Claude Haiku 4.5" },
  { id: "openai/gpt-4o", label: "GPT-4o" },
  { id: "openai/gpt-4o-mini", label: "GPT-4o Mini" },
  { id: "openai/o3", label: "o3" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro" },
  { id: "openrouter/auto", label: "Auto (best available)" },
]

/**
 * Simple model picker with popular models + manual input.
 * No backend fetch — just a curated list.
 */
export function ModelPicker({ value, onChange, className }: ModelPickerProps) {
  const [open, setOpen] = useState(false)
  const selected = MODELS.find((m) => m.id === value)

  return (
    <div className={cn("relative", className)}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={cn(
          "flex h-9 w-full items-center justify-between border border-input bg-transparent px-3 py-1 text-sm transition-colors",
          "hover:border-primary/40 focus:outline-none focus:ring-1 focus:ring-ring",
        )}
      >
        <span className="truncate text-left">
          {selected ? (
            <span>
              <span className="font-medium">{selected.label}</span>
              <span className="ml-2 text-[10px] text-muted-foreground">{selected.id}</span>
            </span>
          ) : (
            <span className="text-muted-foreground">{value || "Select model..."}</span>
          )}
        </span>
        <CaretUpDownIcon size={14} className="text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full border border-border bg-background shadow-lg">
          <div className="max-h-64 overflow-y-auto">
            {MODELS.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  onChange(m.id)
                  setOpen(false)
                }}
                className={cn(
                  "flex w-full items-center justify-between px-3 py-1.5 text-left text-sm transition-colors",
                  "hover:bg-primary/5",
                  m.id === value && "bg-primary/10",
                )}
              >
                <span className="font-heading text-xs font-medium">{m.label}</span>
                <span className="text-[10px] text-muted-foreground">{m.id}</span>
              </button>
            ))}
          </div>

          <div className="border-t border-border px-3 py-2">
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="Or type model ID..."
              className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
              onKeyDown={(e) => {
                if (e.key === "Enter") setOpen(false)
              }}
            />
          </div>
        </div>
      )}

      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " " || e.key === "Escape") {
              e.preventDefault()
              setOpen(false)
            }
          }}
          role="button"
          tabIndex={0}
          aria-label="Close model picker"
        />
      )}
    </div>
  )
}
