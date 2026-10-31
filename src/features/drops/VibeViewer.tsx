import { useEffect } from "react";
import { createPortal } from "react-dom";
import { ChevronLeft, ChevronRight, Eye, Music2, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { AuthedVideo } from "@/components/Media";
import { api } from "@/lib/api";
import { count } from "@/lib/format";
import type { Drop } from "@/types/api";

export function VibeViewer({
  vibes,
  index,
  onIndex,
  onClose,
}: {
  vibes: Drop[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
}) {
  const vibe = vibes[index];

  useEffect(() => {
    if (!vibe || vibe.mine) return;
    void api.post(`/drops/vibes/${vibe.id}/seen/`, {}).catch(() => undefined);
  }, [vibe]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        onIndex(Math.min(vibes.length - 1, index + 1));
      }
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        onIndex(Math.max(0, index - 1));
      }
    };
    document.addEventListener("keydown", onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previous;
    };
  }, [index, onClose, onIndex, vibes.length]);

  if (!vibe) return null;

  const author = vibe.author.name || vibe.author.username;

  return createPortal(
    <div className="fixed inset-0 z-[95] bg-black text-white" role="dialog" aria-modal="true" aria-label="Vibes">
      <AuthedVideo
        src={vibe.asset?.content_url}
        autoPlay
        loop
        playsInline
        controls
        className="h-full w-full object-contain"
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-black/65 to-transparent px-4 pb-10 pt-[max(12px,env(safe-area-inset-top))]">
        <button
          type="button"
          onClick={onClose}
          className="pointer-events-auto flex size-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
          aria-label="Close Vibes"
        >
          <X className="size-5" />
        </button>
        <span className="text-[17px] font-extrabold tracking-[-0.02em]">Vibes</span>
        <span className="ml-auto text-[11px] font-bold text-white/70">
          {index + 1} / {vibes.length}
        </span>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/75 to-transparent px-4 pb-[max(88px,calc(64px+env(safe-area-inset-bottom)))] pt-16">
        <div className="flex items-center gap-2.5">
          <Avatar user={vibe.author} size={36} />
          <div className="min-w-0">
            <p className="truncate text-[14px] font-extrabold">{author}</p>
            <p className="truncate text-[11px] text-white/65">@{vibe.author.username}</p>
          </div>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-black/45 px-2 py-1 text-[10.5px] font-bold text-white/85 backdrop-blur">
            <Eye className="size-3" /> {count(vibe.views ?? 0)}
          </span>
        </div>
        {vibe.body.trim() ? <p className="mt-3 max-w-2xl text-[13px] leading-5 text-white/90">{vibe.body}</p> : null}
        {vibe.music ? (
          <p className="mt-2 inline-flex items-center gap-1.5 text-[11.5px] text-white/70">
            <Music2 className="size-3.5" /> {vibe.music}
          </p>
        ) : null}
      </div>

      {index > 0 ? (
        <button
          type="button"
          onClick={() => onIndex(index - 1)}
          className="absolute left-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
          aria-label="Previous Vibe"
        >
          <ChevronLeft className="size-5" />
        </button>
      ) : null}
      {index < vibes.length - 1 ? (
        <button
          type="button"
          onClick={() => onIndex(index + 1)}
          className="absolute right-3 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition hover:bg-black/65"
          aria-label="Next Vibe"
        >
          <ChevronRight className="size-5" />
        </button>
      ) : null}
    </div>,
    document.body,
  );
}
