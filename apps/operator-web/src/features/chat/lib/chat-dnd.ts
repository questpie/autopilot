import type { ChatAttachment } from '@/api/types'

export const CHAT_ATTACHMENT_DRAG_MIME = 'application/x-questpie-chat-attachment'

export function setDraggedChatAttachment(dataTransfer: DataTransfer, attachment: ChatAttachment) {
	dataTransfer.effectAllowed = 'copy'
	dataTransfer.setData(CHAT_ATTACHMENT_DRAG_MIME, JSON.stringify(attachment))
}

export function readDraggedChatAttachment(dataTransfer: DataTransfer): ChatAttachment | null {
	const raw = dataTransfer.getData(CHAT_ATTACHMENT_DRAG_MIME)
	if (!raw) return null

	try {
		const parsed = JSON.parse(raw) as ChatAttachment
		return parsed && typeof parsed === 'object' ? parsed : null
	} catch {
		return null
	}
}
