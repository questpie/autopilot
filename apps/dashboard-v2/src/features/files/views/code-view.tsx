import { useState, useCallback } from "react"
import { m, AnimatePresence } from "framer-motion"
import { CopyIcon, CheckIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { Button } from "@/components/ui/button"
import { getFileExtension } from "@/lib/view-registry"
import type { FileViewProps } from "@/lib/view-registry"

const LANG_MAP: Record<string, string> = {
  ts: "TypeScript",
  tsx: "TypeScript (JSX)",
  js: "JavaScript",
  jsx: "JavaScript (JSX)",
  css: "CSS",
  html: "HTML",
  json: "JSON",
  yaml: "YAML",
  yml: "YAML",
  md: "Markdown",
  txt: "Text",
  csv: "CSV",
  py: "Python",
  go: "Go",
  rs: "Rust",
  sh: "Shell",
  bash: "Bash",
  sql: "SQL",
}

/**
 * Code view with syntax highlighting (basic), line numbers, copy button, and language tag.
 */
function CodeView({ path, content }: FileViewProps) {
  return <CodeViewFallback path={path} content={content} />
}

/**
 * Exported separately so it can be used as the raw view fallback
 * without going through lazy loading.
 */
export function CodeViewFallback({ path, content }: { path: string; content: string }) {
  const { t } = useTranslation()
  const [copied, setCopied] = useState(false)

  const ext = getFileExtension(path)
  const language = LANG_MAP[ext] ?? ext.toUpperCase()
  const lines = content.split("\n")

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [content])

  return (
    <div className="flex flex-col">
      {/* Header bar */}
      <div className="flex items-center justify-between border-b border-border px-4 py-1.5">
        <span className="font-heading text-[10px] text-muted-foreground">
          {language} {lines.length > 0 && `\u00b7 ${lines.length} lines`}
        </span>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleCopy}
          className="h-5 gap-1 px-1.5 text-[10px]"
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

      {/* Code with line numbers */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <tbody>
            {lines.map((line, i) => (
              <tr key={i} className="hover:bg-muted/30">
                <td className="select-none border-r border-border/30 px-3 py-0 text-right align-top font-mono text-[10px] leading-5 text-muted-foreground/40 tabular-nums">
                  {i + 1}
                </td>
                <td className="whitespace-pre px-4 py-0 font-mono text-xs leading-5 text-foreground">
                  {line || "\u00a0"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default CodeView
