import { useState, useCallback } from "react"
import { toast } from "sonner"
import {
  ArrowBendUpLeftIcon,
  PushPinIcon,
  CopySimpleIcon,
  TrashIcon,
} from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"

interface MessageContextMenuProps {
  messageContent: string
  onReply?: () => void
  onPin?: () => void
  onDelete?: () => void
  children: React.ReactNode
}

export function MessageContextMenu({
  messageContent,
  onReply,
  onPin,
  onDelete,
  children,
}: MessageContextMenuProps) {
  const { t } = useTranslation()
  const [menuPos, setMenuPos] = useState<{ x: number; y: number } | null>(null)

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    setMenuPos({ x: e.clientX, y: e.clientY })
  }, [])

  const closeMenu = useCallback(() => setMenuPos(null), [])

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(messageContent)
    toast.success(t("chat.text_copied"))
    closeMenu()
  }, [messageContent, t, closeMenu])

  return (
    <>
      <div onContextMenu={handleContextMenu}>{children}</div>

      {menuPos && (
        <>
          <div
            className="fixed inset-0 z-50"
            onClick={closeMenu}
            onContextMenu={(e) => {
              e.preventDefault()
              closeMenu()
            }}
          />
          <div
            className="fixed z-50 min-w-[160px] border border-border bg-popover py-1 shadow-md"
            style={{ left: menuPos.x, top: menuPos.y }}
          >
            {onReply && (
              <button
                type="button"
                onClick={() => {
                  onReply()
                  closeMenu()
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 font-heading text-xs text-foreground hover:bg-muted/50"
              >
                <ArrowBendUpLeftIcon size={14} />
                {t("chat.reply")}
              </button>
            )}
            {onPin && (
              <button
                type="button"
                onClick={() => {
                  onPin()
                  closeMenu()
                }}
                className="flex w-full items-center gap-2 px-3 py-1.5 font-heading text-xs text-foreground hover:bg-muted/50"
              >
                <PushPinIcon size={14} />
                {t("chat.pin_message")}
              </button>
            )}
            <button
              type="button"
              onClick={handleCopy}
              className="flex w-full items-center gap-2 px-3 py-1.5 font-heading text-xs text-foreground hover:bg-muted/50"
            >
              <CopySimpleIcon size={14} />
              {t("chat.copy_text")}
            </button>
            {onDelete && (
              <>
                <div className="my-1 border-t border-border" />
                <button
                  type="button"
                  onClick={() => {
                    onDelete()
                    closeMenu()
                  }}
                  className="flex w-full items-center gap-2 px-3 py-1.5 font-heading text-xs text-destructive hover:bg-muted/50"
                >
                  <TrashIcon size={14} />
                  {t("chat.delete_message")}
                </button>
              </>
            )}
          </div>
        </>
      )}
    </>
  )
}
