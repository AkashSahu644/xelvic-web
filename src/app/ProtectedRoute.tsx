import type { ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { Splash } from "@/components/Splash";
import { ErrorState } from "@/components/States";
import { useAuth } from "@/providers/AuthProvider";

export function ProtectedRoute({ children }: { children: ReactNode }) {
  const { status, user, error, retry, logout } = useAuth();
  const location = useLocation();

  if (status === "loading") return <Splash label="Restoring your session" />;
  if (status === "error") {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-page px-6">
        <ErrorState error={new Error(error || "Could not restore your session.")} onRetry={retry} />
        <button type="button" className="btn btn-ghost -mt-6" onClick={() => void logout()}>
          Sign out instead
        </button>
      </div>
    );
  }
  if (status !== "authenticated" || !user) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/signin?next=${next}`} replace />;
  }
  return <>{children}</>;
}

export function PublicOnly({ children }: { children: ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") return <Splash label="Restoring your session" />;
  if (status === "authenticated") return <Navigate to="/app/drops" replace />;
  return <>{children}</>;
}

export function NotFoundPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-page px-6 text-center">
      <p className="text-[11px] font-extrabold uppercase tracking-[0.22em] text-dim">404</p>
      <h1 className="mt-3 text-3xl font-extrabold tracking-tight">This page is not here</h1>
      <p className="mt-2 max-w-sm text-sm leading-6 text-dim">The address may be old, or the thing it pointed at is gone.</p>
      <Link to="/" className="btn btn-primary mt-6">
        Back to Xelvic
      </Link>
    </div>
  );
}
