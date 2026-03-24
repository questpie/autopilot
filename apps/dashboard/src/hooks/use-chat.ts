import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { apiFetch, apiFetchText, apiPost, queryKeys } from '@/lib/api'
import type { ChatMessage } from '@/lib/types'

interface FsEntry {
	name: string
	type: string
}

function parseYamlMessage(yaml: string): Record<string, string> {
	const result: Record<string, string> = {}
	let currentKey = ''
	let currentValue = ''

	for (const line of yaml.split('\n')) {
		const match = line.match(/^(\w+):\s*(.*)$/)
		if (match) {
			if (currentKey) {
				result[currentKey] = currentValue.trim()
			}
			currentKey = match[1]
			let val = match[2]
			// Handle quoted strings
			if (val.startsWith('"') && !val.endsWith('"')) {
				currentValue = val.slice(1)
				continue
			}
			if (val.startsWith('"') && val.endsWith('"')) {
				val = val.slice(1, -1)
			}
			currentValue = val
		} else if (currentKey && line.startsWith('  ')) {
			// Continuation of multiline string
			currentValue += '\n' + line.trimStart()
		}
	}
	if (currentKey) {
		result[currentKey] = currentValue.trim().replace(/"$/, '')
	}
	return result
}

async function fetchChannelMessages(channel: string): Promise<ChatMessage[]> {
	try {
		const files = await apiFetch<FsEntry[]>(`/fs/comms/channels/${channel}`)
		const msgFiles = files
			.filter((f) => f.name.endsWith('.yaml') && f.name.startsWith('msg-'))
			.sort((a, b) => a.name.localeCompare(b.name))

		const messages = await Promise.all(
			msgFiles.map(async (f) => {
				try {
					const yaml = await apiFetchText(`/fs/comms/channels/${channel}/${f.name}`)
					const raw = parseYamlMessage(yaml)
					return {
						id: raw.id ?? f.name,
						timestamp: raw.at ?? '',
						sender: raw.from ?? 'unknown',
						content: raw.content ?? '',
						channel: raw.channel ?? channel,
						type: (raw.external === 'true' ? 'human' : 'agent') as ChatMessage['type'],
					} satisfies ChatMessage
				} catch {
					return null
				}
			}),
		)

		return messages
			.filter((m): m is ChatMessage => m !== null && m.content !== '')
			.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
	} catch {
		return []
	}
}

export function useChat(channel: string) {
	return useQuery({
		queryKey: queryKeys.chat(channel),
		queryFn: () => fetchChannelMessages(channel),
	})
}

export function useSendMessage() {
	const queryClient = useQueryClient()

	return useMutation({
		mutationFn: ({ message, channel }: { message: string; channel: string }) =>
			apiPost<{ routed_to: string; reason: string }>('/api/chat', { message, channel }),
		onSettled: (_data, _err, variables) => {
			queryClient.invalidateQueries({ queryKey: queryKeys.chat(variables.channel) })
		},
	})
}
