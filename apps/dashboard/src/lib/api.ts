export const API_URL = 'http://localhost:7778'

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
	const res = await fetch(`${API_URL}${path}`, {
		...init,
		headers: {
			'Content-Type': 'application/json',
			...init?.headers,
		},
	})
	if (!res.ok) {
		throw new Error(`API error: ${res.status} ${res.statusText}`)
	}
	return res.json()
}
