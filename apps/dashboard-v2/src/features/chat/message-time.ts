/** Format an ISO timestamp to HH:MM. */
export function formatTimestamp(iso: string): string {
	const date = new Date(iso)
	return date.toLocaleTimeString('en-US', {
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	})
}

/** Format an ISO timestamp to a full absolute date string. */
export function formatAbsoluteTimestamp(iso: string): string {
	const date = new Date(iso)
	return date.toLocaleString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		hour12: false,
	})
}

/** Format an ISO timestamp as a relative time (e.g. "5m ago"). */
export function formatRelativeTime(iso: string): string {
	const now = Date.now()
	const then = new Date(iso).getTime()
	const diffMs = now - then
	const diffMin = Math.floor(diffMs / 60000)
	if (diffMin < 1) return 'just now'
	if (diffMin < 60) return `${diffMin}m ago`
	const diffHr = Math.floor(diffMin / 60)
	if (diffHr < 24) return `${diffHr}h ago`
	const diffDays = Math.floor(diffHr / 24)
	return `${diffDays}d ago`
}
