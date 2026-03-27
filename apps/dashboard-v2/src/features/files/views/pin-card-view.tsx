import { useMemo } from "react"
import { PushPinIcon, LinkIcon, CalendarIcon } from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import { Badge } from "@/components/ui/badge"
import { MarkdownRenderer } from "@/components/markdown-renderer"
import type { FileViewProps } from "@/lib/view-registry"

interface PinData {
  title: string
  type: string
  content: string
  url: string
  pinned_by: string
  pinned_at: string
  expires: string
}

/**
 * Parse pin YAML metadata (simple key: value + multiline content).
 */
function parsePinYaml(raw: string): PinData {
  const pin: PinData = {
    title: "",
    type: "text",
    content: "",
    url: "",
    pinned_by: "",
    pinned_at: "",
    expires: "",
  }

  const lines = raw.split("\n")
  let inContent = false
  const contentLines: string[] = []

  for (const line of lines) {
    if (inContent) {
      contentLines.push(line)
      continue
    }

    const colonIdx = line.indexOf(":")
    if (colonIdx === -1) continue
    const key = line.slice(0, colonIdx).trim()
    const value = line.slice(colonIdx + 1).trim().replace(/^["']|["']$/g, "")

    if (key === "content" && value.endsWith("|")) {
      inContent = true
      continue
    }

    if (key in pin) {
      ;(pin as Record<string, unknown>)[key] = value
    }
  }

  if (contentLines.length > 0) {
    pin.content = contentLines.join("\n").trim()
  }

  return pin
}

/**
 * Pin card view — renders a pinned item as it appears on the dashboard.
 * Shows title, type, content (markdown), and pin metadata.
 */
function PinCardView({ path, content }: FileViewProps) {
  const { t } = useTranslation()
  const pin = useMemo(() => parsePinYaml(content), [content])

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex flex-col gap-4 border border-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex size-10 items-center justify-center bg-amber-500/10">
            <PushPinIcon size={20} weight="fill" className="text-amber-500" />
          </div>
          <div className="flex flex-col">
            <span className="font-heading text-base font-bold text-foreground">
              {pin.title || t("files.untitled_pin")}
            </span>
            <span className="text-[10px] text-muted-foreground">{path}</span>
          </div>
        </div>

        {/* Pin metadata */}
        <div className="flex flex-wrap items-center gap-3">
          {pin.type && (
            <Badge variant="outline" className="rounded-none text-[9px]">
              {pin.type}
            </Badge>
          )}

          {pin.pinned_by && (
            <span className="font-heading text-[10px] text-muted-foreground">
              {t("files.pinned_by")}: {pin.pinned_by}
            </span>
          )}

          {pin.pinned_at && (
            <div className="flex items-center gap-1">
              <CalendarIcon size={10} className="text-muted-foreground" />
              <span className="font-heading text-[10px] text-muted-foreground">
                {pin.pinned_at}
              </span>
            </div>
          )}

          {pin.url && (
            <a
              href={pin.url}
              className="flex items-center gap-1 font-heading text-[10px] text-primary hover:underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              <LinkIcon size={10} />
              {t("common.link")}
            </a>
          )}
        </div>

        {/* Pin content rendered as markdown */}
        {pin.content && (
          <div className="border-t border-border pt-3">
            <MarkdownRenderer content={pin.content} mode="inline" />
          </div>
        )}
      </div>
    </div>
  )
}

export default PinCardView
