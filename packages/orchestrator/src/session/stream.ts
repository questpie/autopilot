import type { StreamChunk } from '@questpie/autopilot-spec'
import { createSessionStream, appendToSessionStream } from './durable'
import { logger } from '../logger'

/** A live session stream that listeners can subscribe to. */
export interface SessionStream {
	sessionId: string
	agentId: string
	listeners: Set<(chunk: StreamChunk) => void>
}

/**
 * Manages real-time event streams for agent sessions.
 *
 * The CLI `attach` command subscribes to a stream to show live tool calls
 * and text output while an agent is running.
 */
export class SessionStreamManager {
	private streams: Map<string, SessionStream> = new Map()

	/** Open a new stream for the given session. Also creates a durable stream. */
	createStream(sessionId: string, agentId: string): SessionStream {
		const stream: SessionStream = {
			sessionId,
			agentId,
			listeners: new Set(),
		}
		this.streams.set(sessionId, stream)

		// Create durable stream (fire-and-forget)
		createSessionStream(sessionId).catch((err) => {
			logger.warn('session-stream', `failed to create durable stream for ${sessionId}`, {
				error: err instanceof Error ? err.message : String(err),
			})
		})

		return stream
	}

	/** Push a chunk to all listeners AND to the durable stream. */
	emit(sessionId: string, chunk: StreamChunk): void {
		const stream = this.streams.get(sessionId)
		if (!stream) return

		// Emit to in-memory listeners (CLI attach, dashboard SSE)
		for (const listener of stream.listeners) {
			try {
				listener(chunk)
			} catch (err) {
				logger.error('session-stream', `listener error for ${sessionId}`, { error: err instanceof Error ? err.message : String(err) })
			}
		}

		// Persist to durable stream (fire-and-forget)
		appendToSessionStream(sessionId, chunk).catch(() => {})
	}

	/** Subscribe to a session stream. Returns an unsubscribe function. */
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

	/** Close a stream, clear listeners, and remove it from the map. */
	endStream(sessionId: string): void {
		const stream = this.streams.get(sessionId)
		if (!stream) return

		stream.listeners.clear()
		this.streams.delete(sessionId)
	}

	/** List all currently active session streams. */
	getActiveStreams(): Array<{ sessionId: string; agentId: string }> {
		return [...this.streams.values()].map(({ sessionId, agentId }) => ({
			sessionId,
			agentId,
		}))
	}
}

import { container } from '../container'

export const streamManagerFactory = container.register('streamManager', () => {
	return new SessionStreamManager()
})
