import { Component, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

interface Props {
	children: ReactNode
	fallback?: ReactNode
}

interface State {
	hasError: boolean
	error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
	constructor(props: Props) {
		super(props)
		this.state = { hasError: false }
	}

	static getDerivedStateFromError(error: Error): State {
		return { hasError: true, error }
	}

	render() {
		if (this.state.hasError) {
			return (
				this.props.fallback ?? (
					<div className="flex flex-col items-center justify-center py-16 px-4 text-center">
						<div className="text-destructive mb-4 text-2xl">{'\u26A0'}</div>
						<div className="font-mono text-[13px] font-semibold text-foreground mb-1">
							Something went wrong
						</div>
						<div className="text-sm text-muted-foreground max-w-[320px] mb-4">
							{this.state.error?.message ?? 'An unexpected error occurred.'}
						</div>
						<Button
							size="sm"
							variant="outline"
							onClick={() => this.setState({ hasError: false, error: undefined })}
						>
							Retry
						</Button>
					</div>
				)
			)
		}

		return this.props.children
	}
}
