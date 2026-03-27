/**
 * SSEClient with exponential backoff reconnection.
 * Base: 1s, max: 30s, with jitter.
 * Tracks retry count and supports manual retry after max retries.
 */
export type SSEStatus = "connected" | "reconnecting" | "offline"

export interface SSEClientOptions {
  url: string
  onMessage: (event: MessageEvent) => void
  onStatusChange: (status: SSEStatus, retryCount: number) => void
  /** Maximum reconnect attempts before going offline (default: 5) */
  maxRetries?: number
}

export class SSEClient {
  private eventSource: EventSource | null = null
  private reconnectAttempts = 0
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private lastEventId: string | null = null
  private disposed = false
  private readonly options: SSEClientOptions
  private readonly maxRetries: number

  private static readonly BASE_DELAY = 1000
  private static readonly MAX_DELAY = 30000

  constructor(options: SSEClientOptions) {
    this.options = options
    this.maxRetries = options.maxRetries ?? 5
  }

  get retryCount(): number {
    return this.reconnectAttempts
  }

  connect(): void {
    if (this.disposed) return
    this.cleanup()

    const url = new URL(this.options.url)
    if (this.lastEventId) {
      url.searchParams.set("lastEventId", this.lastEventId)
    }

    const es = new EventSource(url.toString(), { withCredentials: true })
    this.eventSource = es

    es.onopen = () => {
      this.reconnectAttempts = 0
      this.options.onStatusChange("connected", 0)
    }

    es.onmessage = (event: MessageEvent) => {
      if (event.lastEventId) {
        this.lastEventId = event.lastEventId
      }
      this.options.onMessage(event)
    }

    es.onerror = () => {
      this.cleanup()
      if (this.disposed) return

      if (this.reconnectAttempts >= this.maxRetries) {
        this.options.onStatusChange("offline", this.reconnectAttempts)
        return
      }

      this.options.onStatusChange("reconnecting", this.reconnectAttempts)
      this.scheduleReconnect()
    }
  }

  /** Manual retry — resets attempt counter and reconnects. */
  retry(): void {
    this.disposed = false
    this.reconnectAttempts = 0
    this.connect()
  }

  disconnect(): void {
    this.disposed = true
    this.cleanup()
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.options.onStatusChange("offline", this.reconnectAttempts)
  }

  private cleanup(): void {
    if (this.eventSource) {
      this.eventSource.close()
      this.eventSource = null
    }
  }

  private scheduleReconnect(): void {
    const delay = Math.min(
      SSEClient.BASE_DELAY * 2 ** this.reconnectAttempts +
        Math.random() * 1000,
      SSEClient.MAX_DELAY,
    )
    this.reconnectAttempts++
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      this.connect()
    }, delay)
  }
}
