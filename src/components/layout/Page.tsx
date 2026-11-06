import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { cn } from "@/utils/cn";

export function PageHeader({
  title,
  subtitle,
  back,
  actions,
  children,
  className,
  sticky = true,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  back?: boolean;
  actions?: ReactNode;
  children?: ReactNode;
  className?: string;
  sticky?: boolean;
}) {
  const navigate = useNavigate();
  return (
    <header
      className={cn(
        "z-30 border-b border-line bg-[color-mix(in_srgb,var(--page)_88%,transparent)] backdrop-blur-xl",
        sticky && "sticky top-0",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-[1240px] items-center gap-3 px-4 py-3 md:px-7">
        {back ? (
          <button
            type="button"
            onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/app"))}
            className="icon-btn -ml-2"
            aria-label="Back"
          >
            <ArrowLeft className="size-5" />
          </button>
        ) : null}
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[17px] font-extrabold tracking-[-0.02em]">{title}</h1>
          {subtitle ? <p className="truncate text-xs text-dim">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1.5">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}

export function Tabs({
  tabs,
  value,
  onChange,
  className,
}: {
  tabs: { key: string; label: string; count?: number }[];
  value: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("no-scrollbar flex gap-1 overflow-x-auto", className)} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={value === tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            "relative shrink-0 rounded-full px-3.5 py-2 text-[13px] font-bold transition",
            value === tab.key
              ? "bg-[color-mix(in_srgb,var(--accent)_12%,var(--card))] text-accent"
              : "text-dim hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] hover:text-ink",
          )}
        >
          {tab.label}
          {tab.count ? <span className="ml-1.5 text-[10px] font-extrabold opacity-75">{tab.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cn("h-px w-full bg-line", className)} />;
}
