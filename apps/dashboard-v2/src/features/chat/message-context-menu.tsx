import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  ArrowBendUpLeftIcon,
  ChatTeardropIcon,
  CopyIcon,
  LinkIcon,
  PencilIcon,
  PushPinIcon,
  PushPinSlashIcon,
  TrashIcon,
  ArrowBendUpRightIcon,
  BookmarkSimpleIcon,
  SmileySticker,
} from "@phosphor-icons/react"
import { memo, useCallback, type ReactNode } from "react"
import { Menu as MenuPrimitive } from "@base-ui/react/menu"

interface MessageActionsMenuProps {
  trigger: ReactNode
  messageId: string
  messageContent: string
  messageFrom: string
  /** Current user ID */
  currentUserId: string
  isPinned?: boolean
  isBookmarked?: boolean
  onReply?: () => void
  onThread?: () => void
  onReact?: () => void
  onEdit?: () => void
  onDelete?: () => void
  onPin?: () => void
  onUnpin?: () => void
  onBookmark?: () => void
  onRemoveBookmark?: () => void
  onForward?: () => void
  onCopyText?: () => void
  onCopyLink?: () => void
  /** Side for dropdown positioning */
  side?: "top" | "bottom" | "left" | "right"
  align?: "start" | "center" | "end"
}

export const MessageActionsMenu = memo(function MessageActionsMenu({
  trigger,
  messageId,
  messageContent,
  messageFrom,
  currentUserId,
  isPinned = false,
  isBookmarked = false,
  onReply,
  onThread,
  onReact,
  onEdit,
  onDelete,
  onPin,
  onUnpin,
  onBookmark,
  onRemoveBookmark,
  onForward,
  onCopyText,
  onCopyLink,
  side = "bottom",
  align = "end",
}: MessageActionsMenuProps) {
  const isOwn = messageFrom === currentUserId

  const handleCopyText = useCallback(() => {
    navigator.clipboard.writeText(messageContent)
    onCopyText?.()
  }, [messageContent, onCopyText])

  const handleCopyLink = useCallback(() => {
    const url = `${window.location.origin}${window.location.pathname}?msg=${messageId}`
    navigator.clipboard.writeText(url)
    onCopyLink?.()
  }, [messageId, onCopyLink])

  const showCommunicationSeparator = onReply || onThread || onReact
  const showOwnerSeparator = isOwn && (onEdit || onDelete)

  return (
    <DropdownMenu>
      <MenuPrimitive.Trigger render={<span />}>{trigger}</MenuPrimitive.Trigger>
      <DropdownMenuContent side={side} align={align} sideOffset={4}>
        {/* Reply & Thread */}
        {onReply && (
          <DropdownMenuItem onClick={onReply}>
            <ArrowBendUpLeftIcon size={14} />
            Reply
          </DropdownMenuItem>
        )}
        {onThread && (
          <DropdownMenuItem onClick={onThread}>
            <ChatTeardropIcon size={14} />
            Start Thread
          </DropdownMenuItem>
        )}
        {onReact && (
          <DropdownMenuItem onClick={onReact}>
            <SmileySticker size={14} />
            Add Reaction
          </DropdownMenuItem>
        )}

        {showCommunicationSeparator && <DropdownMenuSeparator />}

        {/* Edit & Delete (own messages only) */}
        {isOwn && onEdit && (
          <DropdownMenuItem onClick={onEdit}>
            <PencilIcon size={14} />
            Edit Message
          </DropdownMenuItem>
        )}
        {isOwn && onDelete && (
          <DropdownMenuItem variant="destructive" onClick={onDelete}>
            <TrashIcon size={14} />
            Delete Message
          </DropdownMenuItem>
        )}

        {showOwnerSeparator && <DropdownMenuSeparator />}

        {/* Pin */}
        {!isPinned && onPin && (
          <DropdownMenuItem onClick={onPin}>
            <PushPinIcon size={14} />
            Pin Message
          </DropdownMenuItem>
        )}
        {isPinned && onUnpin && (
          <DropdownMenuItem onClick={onUnpin}>
            <PushPinSlashIcon size={14} />
            Unpin Message
          </DropdownMenuItem>
        )}

        {/* Bookmark */}
        {!isBookmarked && onBookmark && (
          <DropdownMenuItem onClick={onBookmark}>
            <BookmarkSimpleIcon size={14} />
            Bookmark
          </DropdownMenuItem>
        )}
        {isBookmarked && onRemoveBookmark && (
          <DropdownMenuItem onClick={onRemoveBookmark}>
            <BookmarkSimpleIcon size={14} weight="fill" />
            Remove Bookmark
          </DropdownMenuItem>
        )}

        {/* Forward */}
        {onForward && (
          <DropdownMenuItem onClick={onForward}>
            <ArrowBendUpRightIcon size={14} />
            Forward
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        {/* Copy actions */}
        <DropdownMenuItem onClick={handleCopyText}>
          <CopyIcon size={14} />
          Copy Text
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleCopyLink}>
          <LinkIcon size={14} />
          Copy Link
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
})
