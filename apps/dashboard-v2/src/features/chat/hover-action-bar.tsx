import { useCallback } from "react"
import { toast } from "sonner"
import {
  ArrowBendUpLeftIcon,
  PushPinIcon,
  DotsThreeIcon,
  CopySimpleIcon,
  TrashIcon,
} from "@phosphor-icons/react"
import { useTranslation } from "@/lib/i18n"
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip"

interface HoverActionBarProps {
  messageContent: string
  onReply?: () => void
  onPin?: () => void
  onDelete?: () => void
}

function ActionButton({
  label,
  onClick,
  children,
}: {
  label: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        onClick={onClick}
        className="flex size-7 items-center justify-center text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="top" sideOffset={4}>
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

export function HoverActionBar({
  messageContent,
  onReply,
  onPin,
  onDelete,
}: HoverActionBarProps) {
  const { t } = useTranslation()

  const handleCopy = useCallback(() => {
    void navigator.clipboard.writeText(messageContent)
    toast.success(t("chat.text_copied"))
  }, [messageContent, t])

  return (
    <div className="absolute -top-3 right-2 z-10 hidden items-center gap-0.5 border border-border bg-card shadow-sm group-hover:flex">
      {onReply && (
        <ActionButton label={t("chat.reply")} onClick={onReply}>
          <ArrowBendUpLeftIcon size={14} />
        </ActionButton>
      )}

      {onPin && (
        <ActionButton label={t("chat.pin_message")} onClick={onPin}>
          <PushPinIcon size={14} />
        </ActionButton>
      )}

      <DropdownMenu>
        <DropdownMenuTrigger
          className="flex size-7 items-center justify-center text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
        >
          <DotsThreeIcon size={14} weight="bold" />
        </DropdownMenuTrigger>
        <DropdownMenuContent side="bottom" align="end" sideOffset={4}>
          <DropdownMenuItem onClick={handleCopy}>
            <CopySimpleIcon size={14} />
            {t("chat.copy_text")}
          </DropdownMenuItem>
          {onDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={onDelete}>
                <TrashIcon size={14} />
                {t("chat.delete_message")}
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}
