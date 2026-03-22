import type { StreamChunk } from '@questpie/autopilot-spec'

export interface SessionStream {
	sessionId: string
	agentId: string
	listeners: Set<(chunk: StreamChunk) => void>
}

export class SessionStreamManager {
	private streams: Map<string, SessionStream> = new Map()

	createStream(sessionId: string, agentId: string): SessionStream {
		const stream: SessionStream = {
			sessionId,
			agentId,
			listeners: new Set(),
		}
		this.streams.set(sessionId, stream)
		return stream
	}

	emit(sessionId: string, chunk: StreamChunk): void {
		const stream = this.streams.get(sessionId)
		if (!stream) return

		for (const listener of stream.listeners) {
			try {
				listener(chunk)
			} catch (err) {
				console.error(`[session-stream] listener error for ${sessionId}:`, err)
			}
		}
	}

	subscribe(sessionId: string, listener: (chunk: StreamChunk) => void): () => void {
		const stream = this.streams.get(sessionId)
		if (!stream) {
			return () => {}
		}

		stream.listeners.add(listener)

		return () => {
			stream.listeners.delete(listener)
		}
	}

	endStream(sessionId: string): void {
		const stream = this.streams.get(sessionId)
		if (!stream) return

		stream.listeners.clear()
		this.streams.delete(sessionId)
	}

	getActiveStreams(): Array<{ sessionId: string; agentId: string }> {
		return [...this.streams.values()].map(({ sessionId, agentId }) => ({
			sessionId,
			agentId,
		}))
	}
}
