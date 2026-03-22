'use client'

import { useState } from 'react'

export function WaitlistForm() {
	const [email, setEmail] = useState('')
	const [submitted, setSubmitted] = useState(false)

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault()
		if (email) {
			setSubmitted(true)
		}
	}

	if (submitted) {
		return (
			<div className="border border-purple bg-purple-faint p-6 text-center">
				<div className="font-mono text-sm text-purple mb-1">REGISTERED</div>
				<div className="font-sans text-fg text-sm">
					We'll notify you when QUESTPIE Autopilot launches.
				</div>
			</div>
		)
	}

	return (
		<form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-0" id="waitlist">
			<input
				type="email"
				value={email}
				onChange={(e) => setEmail(e.target.value)}
				placeholder="you@company.com"
				required
				className="flex-1 bg-surface border border-border px-4 py-3 font-mono text-sm text-fg placeholder:text-dim outline-none focus:border-purple"
			/>
			<button
				type="submit"
				className="bg-purple text-bg font-mono text-sm px-6 py-3 cursor-pointer hover:bg-purple-light transition-colors border-none"
			>
				Join Waitlist
			</button>
		</form>
	)
}
