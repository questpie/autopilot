import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect, useRef } from 'react'
import { apiFetch, API_URL } from '@/lib/api'
import { ChatBubble } from '@/components/ChatBubble'

export const Route = createFileRoute('/chat')({
	component: ChatPage,
})

interface Message {
	id?: string
	sender: string
	role?: string
	message: string
	timestamp: string
	isHuman: boolean
}

function ChatPage() {
	const [messages, setMessages] = useState<Message[]>([])
	const [input, setInput] = useState('')
	const [sending, setSending] = useState(false)
	const bottomRef = useRef<HTMLDivElement>(null)

	useEffect(() => {
		let active = true
		const poll = () => {
			apiFetch<Message[]>('/api/activity')
				.then((data) => {
					if (!active) return
					const chatMessages: Message[] = data.map((item: any) => ({
						id: item.id ?? `${item.timestamp}-${item.agent}`,
						sender: item.agent ?? 'System',
						role: item.role,
						message: item.action ?? item.message ?? '',
						timestamp: item.timestamp ?? '',
						isHuman: false,
					}))
					setMessages((prev) => {
						const humanMessages = prev.filter((m) => m.isHuman)
						return [...humanMessages, ...chatMessages].sort(
							(a, b) => a.timestamp.localeCompare(b.timestamp)
						)
					})
				})
				.catch(() => {})
		}
		poll()
		const interval = setInterval(poll, 5000)
		return () => {
			active = false
			clearInterval(interval)
		}
	}, [])

	useEffect(() => {
		bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
	}, [messages])

	const handleSend = async () => {
		const text = input.trim()
		if (!text || sending) return

		const userMessage: Message = {
			sender: 'You',
			message: text,
			timestamp: new Date().toISOString(),
			isHuman: true,
		}

		setMessages((prev) => [...prev, userMessage])
		setInput('')
		setSending(true)

		try {
			await fetch(`${API_URL}/api/chat`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ message: text }),
			})
		} catch {
			// Chat endpoint may not exist yet
		} finally {
			setSending(false)
		}
	}

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && !e.shiftKey) {
			e.preventDefault()
			handleSend()
		}
	}

	return (
		<div className="flex flex-col h-full">
			{/* Messages */}
			<div className="flex-1 overflow-y-auto pb-4">
				{messages.length === 0 && (
					<div className="flex items-center justify-center h-full">
						<p className="text-ghost text-sm">No messages yet. Start a conversation.</p>
					</div>
				)}
				{messages.map((msg, i) => (
					<ChatBubble
						key={msg.id ?? i}
						sender={msg.sender}
						role={msg.role}
						message={msg.message}
						timestamp={msg.timestamp}
						isHuman={msg.isHuman}
					/>
				))}
				<div ref={bottomRef} />
			</div>

			{/* Input */}
			<div className="border-t border-border pt-3 shrink-0">
				<div className="flex gap-2">
					<textarea
						value={input}
						onChange={(e) => setInput(e.target.value)}
						onKeyDown={handleKeyDown}
						placeholder="Send a message..."
						rows={1}
						className="flex-1 bg-card border border-border px-3 py-2 text-sm text-fg placeholder-ghost resize-none focus:outline-none focus:border-purple"
					/>
					<button
						onClick={handleSend}
						disabled={sending || !input.trim()}
						className="px-4 py-2 bg-purple text-white text-sm font-semibold hover:bg-purple-dark transition-colors disabled:opacity-40"
					>
						{sending ? '...' : 'Send'}
					</button>
				</div>
			</div>
		</div>
	)
}
