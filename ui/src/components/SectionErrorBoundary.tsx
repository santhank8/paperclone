import { Component, type ErrorInfo, type ReactNode } from "react";

interface SectionErrorBoundaryProps {
  title: string;
  children: ReactNode;
}

interface SectionErrorBoundaryState {
  hasError: boolean;
}

export class SectionErrorBoundary extends Component<SectionErrorBoundaryProps, SectionErrorBoundaryState> {
  override state: SectionErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): SectionErrorBoundaryState {
    return { hasError: true };
  }

  override componentDidCatch(error: unknown, info: ErrorInfo): void {
    console.error(`${this.props.title} section render failed`, {
      error,
      componentStack: info.componentStack,
    });
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="rounded-md border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          {this.props.title} unavailable
        </div>
      );
    }
    return this.props.children;
  }
}
