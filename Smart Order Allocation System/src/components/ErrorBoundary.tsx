import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught application error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 max-w-lg mx-auto my-12 rounded-xl border shadow-lg text-center" style={{ background: "var(--card)", borderColor: "var(--border)" }}>
          <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-rose-950/60 border border-rose-800 text-rose-400 flex items-center justify-center text-xl">
            ⚠️
          </div>
          <h2 className="text-base font-semibold mb-2" style={{ color: "var(--foreground)" }}>
            Something went wrong rendering this view
          </h2>
          <p className="text-xs mb-4 text-muted-foreground font-mono">
            {this.state.error?.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            className="px-4 py-2 rounded-md text-xs font-semibold cursor-pointer"
            style={{ background: "var(--primary)", color: "var(--primary-foreground)" }}
          >
            ↻ Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
