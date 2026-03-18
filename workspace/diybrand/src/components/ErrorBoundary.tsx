"use client";

import { Component, type ReactNode, type ErrorInfo } from "react";

type Props = {
  children: ReactNode;
  fallback?: ReactNode;
};

type State = {
  hasError: boolean;
  error: Error | null;
};

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("BrandWizard error boundary caught:", error, info);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="glass neon-glow-pink rounded-2xl p-8 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={{ background: "rgba(247, 37, 133, 0.15)" }}>
            <svg
              className="h-7 w-7"
              style={{ color: "var(--accent-pink)" }}
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
              />
            </svg>
          </div>
          <h3 className="mt-4 text-lg font-semibold text-[var(--text-primary)]">
            Something went wrong
          </h3>
          <p className="mt-2 text-sm" style={{ color: "var(--text-muted)" }}>
            An unexpected error occurred. Your progress has been saved.
          </p>
          <button
            type="button"
            onClick={this.handleReset}
            className="cta-glow mt-6 rounded-lg bg-[var(--primary)] px-6 py-2.5 text-sm font-semibold text-white hover:brightness-110"
          >
            Try again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
