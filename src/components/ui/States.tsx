import type { ReactNode } from "react";
import { AlertTriangle, CloudOff, RefreshCw, ServerOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { ApiError } from "@/utils/errors";

export function EmptyState({
  icon,
  title,
  body,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 py-16 text-center", className)}>
      {icon ? (
        <span className="mb-5 inline-flex size-14 items-center justify-center rounded-2xl accent-soft text-accent">
          {icon}
        </span>
      ) : null}
      <h2 className="text-balance text-xl font-extrabold tracking-tight">{title}</h2>
      {body ? <p className="mt-2 max-w-sm text-pretty text-sm leading-6 text-dim">{body}</p> : null}
      {action ? <div className="mt-6">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  error,
  onRetry,
  className,
  compact,
}: {
  error: unknown;
  onRetry?: () => void;
  className?: string;
  compact?: boolean;
}) {
  const apiError = error instanceof ApiError ? error : null;
  const missing = apiError?.status === 404 || apiError?.status === 405;
  const offline = apiError?.status === 0;
  const Icon = missing ? ServerOff : offline ? CloudOff : AlertTriangle;
  const message = error instanceof Error ? error.message : "That request did not work.";
  return (
    <div className={cn("flex flex-col items-center justify-center px-6 text-center", compact ? "py-8" : "py-16", className)}>
      <span className="mb-4 inline-flex size-12 items-center justify-center rounded-2xl bg-[color-mix(in_srgb,var(--bad)_10%,var(--card))] text-[var(--bad)]">
        <Icon className="size-5" aria-hidden />
      </span>
      <h2 className="text-lg font-extrabold tracking-tight">
        {missing ? "This server does not have that" : offline ? "No connection" : "Something went wrong"}
      </h2>
      <p className="mt-2 max-w-sm text-sm leading-6 text-dim">{message}</p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-5" icon={<RefreshCw className="size-3.5" />} onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}

export function PageSkeleton({ rows = 3 }: { rows?: number }) {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-4 px-4 py-5 md:px-6" aria-hidden>
      {Array.from({ length: rows }).map((_, index) => (
        <div key={index} className="card p-4">
          <div className="flex items-center gap-3">
            <div className="skeleton size-11 rounded-full" />
            <div className="flex-1 space-y-2">
              <div className="skeleton h-3 w-32 rounded-full" />
              <div className="skeleton h-2.5 w-20 rounded-full" />
            </div>
          </div>
          <div className="mt-4 space-y-2">
            <div className="skeleton h-3 w-full rounded-full" />
            <div className="skeleton h-3 w-4/5 rounded-full" />
          </div>
          <div className="skeleton mt-4 aspect-[4/3] w-full rounded-xl" />
        </div>
      ))}
    </div>
  );
}
