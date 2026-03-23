import { useState, useCallback, useMemo } from 'react'
import type { Agent } from '@/lib/types'

export interface MentionState {
	active: boolean
	query: string
	startIndex: number
	selectedIndex: number
}

const INITIAL: MentionState = {
	active: false,
	query: '',
	startIndex: -1,
	selectedIndex: 0,
}

export function useMention(agents: Agent[] | undefined) {
	const [state, setState] = useState<MentionState>(INITIAL)

	const filtered = useMemo(() => {
		if (!state.active || !agents) return []
		const q = state.query.toLowerCase()
		return agents.filter(
			(a) =>
				a.name.toLowerCase().includes(q) ||
				a.id.toLowerCase().includes(q) ||
				a.role.toLowerCase().includes(q),
		)
	}, [agents, state.active, state.query])

	const open = useCallback((startIndex: number) => {
		setState({ active: true, query: '', startIndex, selectedIndex: 0 })
	}, [])

	const close = useCallback(() => {
		setState(INITIAL)
	}, [])

	const setQuery = useCallback((query: string) => {
		setState((s) => ({ ...s, query, selectedIndex: 0 }))
	}, [])

	const moveUp = useCallback(() => {
		setState((s) => ({
			...s,
			selectedIndex: s.selectedIndex <= 0 ? filtered.length - 1 : s.selectedIndex - 1,
		}))
	}, [filtered.length])

	const moveDown = useCallback(() => {
		setState((s) => ({
			...s,
			selectedIndex: s.selectedIndex >= filtered.length - 1 ? 0 : s.selectedIndex + 1,
		}))
	}, [filtered.length])

	return { state, filtered, open, close, setQuery, moveUp, moveDown }
}
