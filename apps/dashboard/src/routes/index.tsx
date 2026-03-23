import { createFileRoute } from '@tanstack/react-router'
import { useState, useEffect } from 'react'
import { apiFetch } from '@/lib/api'
import { TaskCard } from '@/components/TaskCard'
import { ActivityItem } from '@/components/ActivityItem'
import { PinCard } from '@/components/PinCard'

export const Route = createFileRoute('/')({
	component: DashboardPage,
})

interface Task {
	id: string
	title: string
	status: string
	agent?: string
	priority?: string
}

interface Activity {
	agent: string
	role?: string
	action: string
	timestamp: string
	detail?: string
}

interface Pin {
	id: string
	type: string
	title: string
	content?: string
}

function DashboardPage() {
	const [tasks, setTasks] = useState<Task[]>([])
	const [activity, setActivity] = useState<Activity[]>([])
	const [pins, setPins] = useState<Pin[]>([])

	useEffect(() => {
		apiFetch<Task[]>('/api/tasks').then(setTasks).catch(() => {})
		apiFetch<Pin[]>('/api/pins').then(setPins).catch(() => {})
	}, [])

	useEffect(() => {
		let active = true
		const fetchActivity = () => {
			apiFetch<Activity[]>('/api/activity')
				.then((data) => {
					if (active) setActivity(data)
				})
				.catch(() => {})
		}
		fetchActivity()
		const interval = setInterval(fetchActivity, 5000)
		return () => {
			active = false
			clearInterval(interval)
		}
	}, [])

	return (
		<div className="grid grid-cols-1 lg:grid-cols-3 gap-4 h-full">
			{/* Left: Tasks */}
			<div className="flex flex-col gap-1">
				<h2 className="text-xs font-mono text-ghost uppercase tracking-wider mb-2">
					Tasks
				</h2>
				<div className="flex flex-col gap-2 overflow-y-auto">
					{tasks.length === 0 && (
						<p className="text-xs text-ghost py-4">No tasks found</p>
					)}
					{tasks.map((task) => (
						<TaskCard
							key={task.id}
							id={task.id}
							title={task.title}
							status={task.status}
							agent={task.agent}
							priority={task.priority}
						/>
					))}
				</div>
			</div>

			{/* Center: Activity */}
			<div className="flex flex-col gap-1">
				<h2 className="text-xs font-mono text-ghost uppercase tracking-wider mb-2">
					Activity
				</h2>
				<div className="flex flex-col overflow-y-auto">
					{activity.length === 0 && (
						<p className="text-xs text-ghost py-4">No activity yet</p>
					)}
					{activity.map((item, i) => (
						<ActivityItem
							key={`${item.timestamp}-${i}`}
							agent={item.agent}
							role={item.role}
							action={item.action}
							timestamp={item.timestamp}
							detail={item.detail}
						/>
					))}
				</div>
			</div>

			{/* Right: Pins */}
			<div className="flex flex-col gap-1">
				<h2 className="text-xs font-mono text-ghost uppercase tracking-wider mb-2">
					Board Pins
				</h2>
				<div className="flex flex-col gap-2 overflow-y-auto">
					{pins.length === 0 && (
						<p className="text-xs text-ghost py-4">No pins yet</p>
					)}
					{pins.map((pin) => (
						<PinCard
							key={pin.id}
							type={pin.type}
							title={pin.title}
							content={pin.content}
						/>
					))}
				</div>
			</div>
		</div>
	)
}
