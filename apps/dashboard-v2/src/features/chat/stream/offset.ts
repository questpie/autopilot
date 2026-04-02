import { api } from '@/lib/api'
import { INITIAL_OFFSET, normalizeOffset } from './reducer'

const OFFSET_PERSIST_DEBOUNCE_MS = 250

/** Cross-mount memory: survives component unmount so remounting resumes from last offset. */
export const sessionOffsetMemory = new Map<string, string>()

// ── API persistence ──────────────────────────────────────────────────

async function persistOffset(sessionId: string, offset: string): Promise<string | null> {
	try {
		const res = await api.api['chat-sessions'][':id']['stream-offset'].$patch({
			param: { id: sessionId },
			json: { offset },
		})
		if (!res.ok) return null
		const body = await res.json().catch(() => null)
		return normalizeOffset((body as { streamOffset?: string } | null)?.streamOffset ?? offset)
	} catch {
		return null
	}
}

// ── Offset manager ───────────────────────────────────────────────────

export interface OffsetManager {
	/** Queue an offset for debounced persistence. Pass `immediate` to flush now. */
	queuePersist(value: string, immediate?: boolean): void
	/** Tear down timers and pagehide listener. Flushes pending offset. */
	cleanup(): void
}

export function createOffsetManager(sessionId: string, initialOffset: string): OffsetManager {
	let persistTimer: ReturnType<typeof setTimeout> | null = null
	let pendingOffset: string | null = null
	let persistedOffset = initialOffset

	const flushOffset = async (): Promise<void> => {
		const next = pendingOffset
		if (!next || next === persistedOffset) {
			pendingOffset = null
			return
		}

		const confirmed = await persistOffset(sessionId, next)
		if (!confirmed) return

		persistedOffset = confirmed
		sessionOffsetMemory.set(sessionId, confirmed)
		if (pendingOffset === next) pendingOffset = null

		// If more offsets queued while we were persisting, schedule another flush.
		if (pendingOffset && pendingOffset !== persistedOffset && !persistTimer) {
			persistTimer = setTimeout(() => {
				persistTimer = null
				void flushOffset()
			}, OFFSET_PERSIST_DEBOUNCE_MS)
		}
	}

	const queuePersist = (value: string, immediate = false): void => {
		const normalized = normalizeOffset(value)
		if (normalized === INITIAL_OFFSET || normalized === persistedOffset) return

		pendingOffset = normalized
		sessionOffsetMemory.set(sessionId, normalized)

		if (immediate) {
			if (persistTimer) {
				clearTimeout(persistTimer)
				persistTimer = null
			}
			void flushOffset()
			return
		}

		if (!persistTimer) {
			persistTimer = setTimeout(() => {
				persistTimer = null
				void flushOffset()
			}, OFFSET_PERSIST_DEBOUNCE_MS)
		}
	}

	const handlePageHide = (): void => {
		if (pendingOffset && pendingOffset !== persistedOffset) {
			void flushOffset()
		}
	}

	if (typeof window !== 'undefined') {
		window.addEventListener('pagehide', handlePageHide)
	}

	const cleanup = (): void => {
		if (typeof window !== 'undefined') {
			window.removeEventListener('pagehide', handlePageHide)
		}
		if (persistTimer) {
			clearTimeout(persistTimer)
			persistTimer = null
		}
		if (pendingOffset && pendingOffset !== persistedOffset) {
			void flushOffset()
		}
	}

	return { queuePersist, cleanup }
}
