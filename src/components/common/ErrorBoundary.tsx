import { Component, type ErrorInfo, type ReactNode } from "react";
import { BrandMark } from "@/components/icons/Brand";

interface Props {
  children: ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("Xelvic render error", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-page px-6 text-center">
          <BrandMark size={52} />
          <div>
            <h1 className="text-xl font-extrabold tracking-tight">Something broke on this screen</h1>
            <p className="mt-2 max-w-md text-sm leading-6 text-dim">
              The rest of Xelvic is still here. Reload the page and try again.
            </p>
            <pre className="mt-4 max-w-md overflow-auto rounded-xl bg-black/5 p-3 text-left text-[11px] text-dim">
              {this.state.error.message}
            </pre>
          </div>
          <button type="button" className="btn btn-primary" onClick={() => window.location.reload()}>
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
