import { Component } from "react"
import { ArrowClockwiseIcon, WarningIcon } from "@phosphor-icons/react"
import { Button } from "@/components/ui/button"

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Error boundary that catches render errors and shows inline recovery UI.
 * Displays a warning icon, error message, and retry button.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div className="flex flex-col items-center justify-center gap-3 p-6 text-center">
          <WarningIcon size={24} className="text-destructive" />
          <div className="flex flex-col gap-1">
            <p className="font-heading text-sm font-medium text-foreground">
              Something went wrong
            </p>
            {this.state.error && (
              <p className="max-w-md text-xs text-muted-foreground">
                {this.state.error.message}
              </p>
            )}
          </div>
          <Button variant="outline" size="sm" onClick={this.handleRetry}>
            <ArrowClockwiseIcon size={14} />
            Retry
          </Button>
        </div>
      )
    }

    return this.props.children
  }
}
