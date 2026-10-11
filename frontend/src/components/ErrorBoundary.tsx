// Global error boundary. Catches render/lazy-load crashes so visitors see
// a friendly recovery screen instead of a blank page or a raw stack trace.

import { Component, type ErrorInfo, type ReactNode } from "react";
import { logError } from "../lib/logger";

type ErrorBoundaryProps = {
  children: ReactNode;
};

type ErrorBoundaryState = {
  hasError: boolean;
  /** True when a lazy chunk failed to download (offline, redeploy, etc.). */
  isChunkError: boolean;
};

function isChunkLoadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("dynamically imported module") ||
    message.includes("Failed to fetch") ||
    message.includes("Importing a module script failed") ||
    message.includes("ChunkLoadError")
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, isChunkError: false };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { hasError: true, isChunkError: isChunkLoadError(error) };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    logError("app", "Render crashed", { message: error.message, componentStack: info.componentStack });
  }

  handleRetry = () => {
    if (this.state.isChunkError) {
      // A stale chunk is the usual cause; a fresh load picks up the new build.
      window.location.reload();
      return;
    }
    this.setState({ hasError: false, isChunkError: false });
  };

  handleHome = () => {
    window.location.assign("/");
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    const { isChunkError } = this.state;
    return (
      <main className="error-boundary" role="alert">
        <div className="error-boundary-card">
          <div className="eyebrow">The EYE</div>
          <h1>{isChunkError ? "Connection interrupted." : "Something went wrong."}</h1>
          <p>
            {isChunkError
              ? "We could not load the latest version of this page. Check your connection and try again."
              : "An unexpected error stopped this page from loading. Your data is safe."}
          </p>
          <div className="error-boundary-actions">
            <button className="button button-dark" type="button" onClick={this.handleRetry}>
              {isChunkError ? "Reload page" : "Try again"}
            </button>
            <button className="button" type="button" onClick={this.handleHome}>
              Go home
            </button>
          </div>
        </div>
      </main>
    );
  }
}
