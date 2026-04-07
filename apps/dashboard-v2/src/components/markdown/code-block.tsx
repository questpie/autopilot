import { useState, useCallback } from "react"
import { m, AnimatePresence } from "framer-motion"
import { CopyIcon, CheckIcon, CaretDownIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"
import { useTranslation } from "@/lib/i18n"
import { cn } from "@/lib/utils"
import {
  type MarkdownMode,
  MAX_COLLAPSED_LINES,
  COLLAPSED_SHOW_LINES,
} from "./markdown-config"

/** Code block with copy, language tag, line numbers, and collapse. */
export function CodeBlock({
  className,
  children,
  mode,
}: {
  className?: string
  children: React.ReactNode
  mode: MarkdownMode
}) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const language = className?.replace("language-", "") ?? ""
  const code = String(children).replace(/\n$/, "")
  const lines = code.split("\n")
  const isLong = lines.length > MAX_COLLAPSED_LINES
  const shouldCollapse = isLong && !expanded

  const displayCode = shouldCollapse
    ? lines.slice(0, COLLAPSED_SHOW_LINES).join("\n")
    : code

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [code])

  return (
    <div className="group/code relative my-2 border border-border bg-card">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border px-3 py-1">
        {language && (
          <span className="font-heading text-[10px] text-muted-foreground">
            {language}
          </span>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-5 gap-1 px-1.5 text-[10px] opacity-0 transition-opacity group-hover/code:opacity-100 md:opacity-0"
        >
          <AnimatePresence mode="wait" initial={false}>
            <m.span
              key={copied ? "check" : "copy"}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 0.15 }}
              className="inline-flex items-center gap-1"
            >
              {copied ? (
                <>
                  <CheckIcon size={10} />
                  {t("common.copied")}
                </>
              ) : (
                <>
                  <CopyIcon size={10} />
                  {t("common.copy")}
                </>
              )}
            </m.span>
          </AnimatePresence>
        </Button>
      </div>

      {/* Code content */}
      <div
        className={cn(
          "overflow-x-auto p-3 font-mono text-[13px] leading-relaxed",
          mode === "inline" && "max-h-[200px] overflow-y-auto",
        )}
      >
        <pre className="m-0">
          <code className={className}>
            {mode === "full" && lines.length > 1 ? (
              // Line numbers in full mode
              <table className="border-collapse">
                <tbody>
                  {(shouldCollapse ? lines.slice(0, COLLAPSED_SHOW_LINES) : lines).map(
                    (line, i) => (
                      <tr key={i}>
                        <td className="select-none pr-4 text-right text-[10px] text-muted-foreground/50 tabular-nums">
                          {i + 1}
                        </td>
                        <td className="whitespace-pre">{line}</td>
                      </tr>
                    ),
                  )}
                </tbody>
              </table>
            ) : (
              displayCode
            )}
          </code>
        </pre>
      </div>

      {/* Expand button for long blocks */}
      {isLong && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="flex w-full items-center justify-center gap-1 border-t border-border py-1.5 font-heading text-[10px] text-muted-foreground transition-colors hover:text-foreground"
        >
          <CaretDownIcon
            size={10}
            className={cn("transition-transform", expanded && "rotate-180")}
          />
          {expanded
            ? t("markdown.show_less")
            : t("markdown.show_more_lines", { count: lines.length - COLLAPSED_SHOW_LINES })}
        </button>
      )}
    </div>
  )
}
