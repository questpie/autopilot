/**
 * A truth read whose access was denied: a non-retryable realtime admission
 * rejection (RealtimeTopicRejectedError carries `retryable:false`) or a REST 403.
 * Per ADR 0022's owner decision this denies only THAT surface — the session
 * continues. A 401 is deliberately NOT surface-denied: an invalid session stays
 * the pathless guard's concern, which keeps the existing /sign-in redirect.
 *
 * Shared by every LIVE truth surface (the company shell + the spaces directory),
 * so the "access to one thing changed" vs "the session ended" split is decided in
 * exactly ONE place rather than re-implemented per route.
 */
export function isSurfaceDenied(error: unknown): boolean {
	if (!error || typeof error !== "object") return false;
	if ("retryable" in error && (error as { retryable?: unknown }).retryable === false) return true;
	return "status" in error && (error as { status?: unknown }).status === 403;
}
