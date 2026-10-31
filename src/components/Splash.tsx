import { BrandMark } from "@/components/Brand";

export function Splash({ label = "Opening Xelvic" }: { label?: string }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-page text-center">
      <BrandMark size={52} />
      <div>
        <p className="text-sm font-extrabold tracking-tight">Xelvic</p>
        <p className="mt-1 text-xs text-dim">{label}</p>
      </div>
      <span className="mt-2 size-5 animate-spin rounded-full border-2 border-[var(--line)] border-t-[var(--accent)]" aria-label="Loading" />
    </div>
  );
}
