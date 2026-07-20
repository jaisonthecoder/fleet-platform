import { Component, type ErrorInfo, type ReactNode } from 'react'
import { AppErrorFallback } from './app-error-fallback'

interface ErrorBoundaryProps {
  children: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
}

/** Catches render-time errors anywhere below and shows an accessible fallback. */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  state: ErrorBoundaryState = { hasError: false }

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Single place to forward to error monitoring (App Insights / Sentry) later.
    console.error('Unhandled UI error', error, info)
  }

  private readonly handleReset = (): void => {
    this.setState({ hasError: false })
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return <AppErrorFallback onReset={this.handleReset} />
    }
    return this.props.children
  }
}
