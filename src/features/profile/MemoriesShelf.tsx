import { useState } from "react";
import { Plus, Lock } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { AuthedImage } from "@/components/Media";
import { Modal } from "@/components/Modal";
import { api } from "@/lib/api";
import { usePreferences } from "@/providers/PreferencesProvider";
import { useToast } from "@/providers/ToastProvider";
import type { Memory, MomentItem } from "@/types/api";

/**
 * Memories — a person's kept shelves, as their own strip on a profile.
 *
 * Ported from `MemoryShelf` in `app/lib/screens/memories.dart`. The owner asked
 * on 2026-09-28 for Memories to stay where they had always been — *"memories ko
 * alag rakho pehle ki tarah"* — their own strip up the page rather than folded
 * into the row of tabs under it, so this draws above `ProfileShelf`.
 *
 * The card is the rail's own frame: 86 by 129 at a 14-point corner, the chosen
 * picture or the first one there is, and the Memory's name under it. A shelf
 * with nothing on it still draws on my own page, because the card at the end of
 * it is where a Memory is made and the shelf keeps that card — an empty shelf
 * plus a way to fill it is a different and better thing than no shelf.
 *
 * The web has no moment viewer, so the shelf's own viewer is here: the strip of
 * pictures a Memory holds, one at a time, with the app's own bargain for a
 * marked Memory — a flat panel until somebody presses it, and a refusal with
 * the app's sentence for a reader who may not open it at all.
 */

/** The card's own frame, from the rail. See `memoryCardWidth` and its two. */
const CARD_W = 86;
const CARD_H = 129;

/** Where the card's picture comes from: a picture off a phone first, then the chosen item, then the first one there is. */
function coverStill(memory: Memory): string | null {
  const uploaded = memory.cover_upload?.thumbnail_url || memory.cover_upload?.content_url;
  if (uploaded) return uploaded;
  const items = memory.items ?? [];
  const chosen = memory.cover ? items.find((item) => String(item.id) === String(memory.cover)) : null;
  const withStill = items.find((item) => item.asset?.thumbnail_url || item.asset?.content_url);
  const pick = chosen ?? withStill ?? items[0] ?? null;
  if (!pick) return null;
  return pick.asset?.thumbnail_url || pick.asset?.content_url || null;
}

/** One picture in the viewer: an image, a clip, or the words of a note. */
function Item({ item }: { item: MomentItem }) {
  const src = item.asset?.content_url ?? null;
  if (item.kind === "note" || (!src && item.body)) {
    return (
      <p className="whitespace-pre-wrap px-2 py-8 text-center text-[14px] leading-[1.5]">
        {item.body}
      </p>
    );
  }
  if (!src) {
    return <p className="py-12 text-center text-[13px] text-dim">This one is no longer here.</p>;
  }
  if (item.kind === "video" || item.kind === "clip" || item.kind === "vibe") {
    return <video src={src} className="max-h-[70vh] w-full object-contain" controls playsInline />;
  }
  return <AuthedImage src={src} alt="" className="max-h-[70vh] w-full" imgClassName="w-full object-contain" />;
}

export function MemoriesShelf({
  username,
  mine,
  onAdd,
}: {
  username: string;
  /** Whose shelf this is. Only my own gets the card that makes one. */
  mine: boolean;
  /** What adding a Memory means here, or null where it means nothing. */
  onAdd?: (() => void) | null;
}) {
  const { t } = usePreferences();
  const { toast } = useToast();
  const [open, setOpen] = useState<Memory | null>(null);
  const [at, setAt] = useState(0);
  const [lifted, setLifted] = useState(false);
  const [pressed, setPressed] = useState<string | null>(null);

  const shelf = useQuery({
    queryKey: ["profile-memories", username],
    // A failure leaves the shelf out and the next visit asks again: this is the
    // least of the page, and the app swallows the error for the same reason.
    queryFn: () => api.get<{ memories: Memory[] }>(`/moments/memories/users/${encodeURIComponent(username)}/`),
    enabled: Boolean(username),
    retry: false,
  });

  const memories = shelf.data?.memories ?? [];

  /** Nothing to draw and no way to add: the shelf is not there at all. */
  if (!shelf.isLoading && memories.length === 0 && !onAdd) return null;

  function visit(memory: Memory) {
    if (memory.sensitive && !memory.openable) {
      toast({ title: t("This is sensitive content you cannot open."), tone: "error" });
      return;
    }
    setAt(0);
    setLifted(false);
    setOpen(memory);
  }

  const items = open?.items ?? [];
  const current = items[at] ?? null;

  return (
    <section>
      <h2 className="px-[18px] pb-2 text-[13px] font-bold tracking-[0.2px]">{t("Memories")}</h2>
      <div className="no-scrollbar flex overflow-x-auto px-[18px]" style={{ height: CARD_H + 34 }}>
        {memories.map((memory) => {
          const still = coverStill(memory);
          const covered = Boolean(memory.sensitive) && !lifted && pressed !== String(memory.id);
          return (
            <button
              key={String(memory.id)}
              type="button"
              onClick={() => {
                // A marked cover is a flat panel until somebody presses it, and
                // the picture is not built while the panel is on — the cover is
                // the bytes being kept back. My own card says why rather than
                // reading as one that failed to draw.
                if (memory.sensitive && !lifted) {
                  setPressed(String(memory.id));
                  return;
                }
                visit(memory);
              }}
              className="mr-3 w-[86px] shrink-0 text-center"
            >
              <span
                className="relative block overflow-hidden rounded-[14px] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
                style={{ width: CARD_W, height: CARD_H }}
              >
                {covered ? (
                  <span className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 p-2">
                    <Lock className="size-[22px] text-dim" aria-hidden />
                    <span className="text-[9.5px] font-semibold leading-tight text-dim">
                      {mine ? t("Yours. Everybody else sees it covered.") : t("Sensitive content")}
                    </span>
                  </span>
                ) : still ? (
                  <AuthedImage
                    src={still}
                    alt=""
                    className="absolute inset-0 h-full w-full"
                    imgClassName="h-full w-full"
                  />
                ) : null}
              </span>
              <span className="mt-1.5 block truncate text-[11.5px]">
                {memory.title || t("A Memory")}
              </span>
            </button>
          );
        })}
        {onAdd ? (
          <button type="button" onClick={onAdd} className="mr-3 w-[86px] shrink-0 text-center">
            <span
              className="flex items-center justify-center rounded-[14px] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
              style={{ width: CARD_W, height: CARD_H }}
            >
              <Plus className="size-[34px]" aria-hidden />
            </span>
            <span className="mt-1.5 block truncate text-[11.5px]">{t("New")}</span>
          </button>
        ) : null}
      </div>

      <Modal
        open={Boolean(open)}
        onClose={() => setOpen(null)}
        title={open?.title || t("A Memory")}
        size="lg"
      >
        <div className="px-3 pb-4">
          {open?.sensitive && !lifted ? (
            /* The app's own veil, said in the app's own words: "Sensitive
               content", the question, and the two answers. A reader who may not
               open it at all is told that instead of being offered the way in,
               which is what `openable` means. */
            <div className="flex flex-col items-center gap-2 py-14 text-center">
              <Lock className="size-7 text-dim" aria-hidden />
              <p className="text-[14px] font-extrabold">{t("Sensitive content")}</p>
              <p className="max-w-[280px] text-[12.5px] leading-5 text-dim">
                {open.openable
                  ? t("Open it anyway?")
                  : t("This is sensitive content you cannot open.")}
              </p>
              {open.openable ? (
                <div className="mt-2 flex gap-2">
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setOpen(null)}>
                    {t("Not now")}
                  </button>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => setLifted(true)}>
                    {t("Open now")}
                  </button>
                </div>
              ) : null}
            </div>
          ) : current ? (
            <>
              <div className="overflow-hidden rounded-[14px] bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]">
                <Item item={current} />
              </div>
              {items.length > 1 ? (
                <div className="mt-3 flex items-center justify-between">
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={at === 0}
                    onClick={() => setAt((value) => Math.max(0, value - 1))}
                  >
                    {t("Back")}
                  </button>
                  <span className="text-[11.5px] text-dim">
                    {at + 1} / {items.length}
                  </span>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    disabled={at >= items.length - 1}
                    onClick={() => setAt((value) => Math.min(items.length - 1, value + 1))}
                  >
                    {t("Next")}
                  </button>
                </div>
              ) : null}
            </>
          ) : (
            <p className="py-12 text-center text-[13px] text-dim">
              {t("There is nothing left on this shelf.")}
            </p>
          )}
        </div>
      </Modal>
    </section>
  );
}

/** Exported for the shelf's own tests, which measure a card against the rail. */
export const memoryCard = { width: CARD_W, height: CARD_H, radius: 14 } as const;
