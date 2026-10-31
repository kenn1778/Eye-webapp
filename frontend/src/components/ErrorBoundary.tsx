// ErrorBoundary component
// Catches rendering errors and displays a user‑friendly fallback.
// It logs the error to the console and optionally to analytics.
// The fallback UI is focusable and announces itself via aria‑live.
import { Component } from 'react';

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<{}, State> {
  constructor(props: {}) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_: Error) {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: any) {
    // Log to console for debugging
    console.error('ErrorBoundary caught an error', error, info);
    // TODO: send error to analytics if available
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          role="alert"
          aria-live="assertive"
          style={{ padding: '1rem', textAlign: 'center' }}
        >
          <p>Something went wrong. Please try again later.</p>
          <button onClick={() => window.location.reload()}>Reload</button>
        </div>
      );
    }

    return this.props.children;
  }
}
