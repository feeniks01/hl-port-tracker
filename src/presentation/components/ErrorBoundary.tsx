import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  children: ReactNode;
  label: string;
  resetKey?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = {
    hasError: false,
  };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidUpdate(prevProps: ErrorBoundaryProps) {
    if (this.state.hasError && prevProps.resetKey !== this.props.resetKey) {
      this.setState({ hasError: false });
    }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error(`Error rendering ${this.props.label}`, error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-[20px] border border-rose-500/20 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          {this.props.label} is temporarily unavailable. Refresh to try again.
        </div>
      );
    }

    return this.props.children;
  }
}
