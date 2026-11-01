import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ImagePlus, LoaderCircle, Plus } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthedImage } from "@/components/Media";
import { Modal } from "@/components/Modal";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/errors";
import { uploadAsset } from "@/lib/upload";
import { useToast } from "@/providers/ToastProvider";
import type { Memory, Moment, MomentItem } from "@/types/api";

/**
 * Keeping a day, or a picture of one, on the shelf that outlives it.
 *
 * Ported from `memory_add.dart`. Three screens behind one door, and the shape is
 * the user's own three asks: choose what to keep (one or several), then choose
 * which Memory it goes into — an old one or a new one — and, for a new one, give
 * it a name and a picture. `keepMoment` is the same flow with the choosing
 * already done, which is what the viewer's three dots does.
 *
 * What is being chosen between is not a list of moments but the *items* the days
 * were made of, one picture at a time, because that is what a Memory holds. The
 * list comes from `/moments/awaiting/`, which is the server's own answer to
 * "what has run out its day and has not been filed" — nothing is moved into a
 * holding area and no job fills one, so the honest shape is a question about
 * rows the server already has.
 */

/** One thing that can be kept: an item, and the still its tile draws. */
export function pickStill(item: MomentItem): string | null {
  const asset = item.asset ?? item.vibe?.asset ?? null;
  return asset?.thumbnail_url || asset?.content_url || null;
}

type AwaitingItem = MomentItem & { moment?: string };

export function AddToMemories({
  open,
  onClose,
  onDone,
  moment,
}: {
  open: boolean;
  onClose: () => void;
  /** Something about the shelf changed and whatever is behind should ask again. */
  onDone?: () => void;
  /**
   * The day being kept. Left out, the picker comes first — which is what the
   * "New" card on my own shelf opens, and what the app's own file does.
   */
  moment?: Moment | null;
}) {
  const [step, setStep] = useState<"pick" | "where" | "name">(moment ? "where" : "pick");
  const [picks, setPicks] = useState<string[]>([]);
  const [title, setTitle] = useState("");
  const [coverItem, setCoverItem] = useState<string | null>(null);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const awaiting = useQuery({
    queryKey: ["moments-awaiting"],
    queryFn: () => api.get<{ items: AwaitingItem[]; count: number }>("/moments/awaiting/"),
    enabled: open && !moment,
    staleTime: 30_000,
  });

  const shelf = useQuery({
    queryKey: ["my-memories"],
    queryFn: () => api.get<{ memories: Memory[] }>("/moments/memories/"),
    enabled: open,
    staleTime: 15_000,
  });

  useEffect(() => {
    if (!open) return;
    setStep(moment ? "where" : "pick");
    setPicks(moment ? moment.items.map((item) => String(item.id)) : []);
    setTitle("");
    setCoverItem(null);
    setCoverFile(null);
    setBusy(false);
    setStage("");
  }, [open, moment]);

  const previews = useMemo(
    () => (coverFile ? URL.createObjectURL(coverFile) : null),
    [coverFile],
  );
  useEffect(() => () => {
    if (previews) URL.revokeObjectURL(previews);
  }, [previews]);

  /** The shelf's own rows: a playlist Memory is not a shelf pictures go on. */
  const memories = (shelf.data?.memories ?? []).filter(
    (memory) => memory.kind !== "playlist" && !memory.playlist,
  );

  const picked = useMemo(() => {
    const rows = moment
      ? moment.items
      : (awaiting.data?.items ?? []).filter((item) => picks.includes(String(item.id)));
    return rows.filter((item) => picks.includes(String(item.id)));
  }, [moment, awaiting.data, picks]);

  function refreshShelf() {
    void queryClient.invalidateQueries({ queryKey: ["my-memories"] });
    void queryClient.invalidateQueries({ queryKey: ["profile-memories"] });
    void queryClient.invalidateQueries({ queryKey: ["moments-awaiting"] });
    onDone?.();
  }

  async function makeNew() {
    const name = title.trim();
    if (busy) return;
    if (!name) {
      toast({ title: "Give it a name", description: "A shelf needs one word to be found by.", tone: "info" });
      return;
    }
    if (!picks.length) {
      toast({ title: "Nothing to keep", description: "Pick at least one picture first.", tone: "info" });
      return;
    }
    setBusy(true);
    try {
      let coverUpload: string | undefined;
      if (coverFile) {
        setStage("Putting the cover up...");
        const asset = await uploadAsset(coverFile);
        coverUpload = String(asset.id);
      }
      setStage("Keeping it...");
      await api.post("/moments/memories/", {
        title: name,
        items: picks,
        ...(coverUpload ? { cover_upload: coverUpload } : coverItem ? { cover: coverItem } : {}),
      });
      refreshShelf();
      toast({ title: "Kept", description: `“${name}” is on your profile now.`, tone: "success" });
      onClose();
    } catch (error) {
      toast({ title: "That was not kept", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
      setStage("");
    }
  }

  async function addTo(memory: Memory) {
    if (busy) return;
    if (!picks.length) return;
    setBusy(true);
    try {
      await api.patch(`/moments/memories/${memory.id}/`, { items: picks });
      refreshShelf();
      toast({ title: `Added to “${memory.title}”`, tone: "success" });
      onClose();
    } catch (error) {
      toast({ title: "That was not added", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  const waiting = awaiting.data?.items ?? [];

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={step === "pick" ? "Add to Memories" : step === "where" ? "Add to Memories" : "New Memory"}
      description={
        step === "pick"
          ? "What has run out its day. Pick one, or as many as you like."
          : step === "where"
            ? "An old shelf, or a new one."
            : "A name, and the picture that stands for it."
      }
      size="lg"
      footer={
        step === "pick" ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11.5px] text-dim">
              {picks.length ? `${picks.length} picked` : "Nothing picked yet"}
            </span>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!picks.length}
              onClick={() => setStep("where")}
            >
              Next
            </button>
          </div>
        ) : step === "name" ? (
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 flex-1 truncate text-[11.5px] text-dim">
              {stage || `${picks.length} ${picks.length === 1 ? "picture" : "pictures"}`}
            </span>
            <button type="button" className="btn btn-primary" onClick={() => void makeNew()} disabled={busy}>
              {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null} Keep
            </button>
          </div>
        ) : (
          <span />
        )
      }
    >
      {step === "pick" ? (
        <div className="p-3">
          {awaiting.isLoading ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4" aria-hidden>
              {[0, 1, 2, 3, 4, 5].map((row) => (
                <div key={row} className="skeleton aspect-square rounded-[12px]" />
              ))}
            </div>
          ) : awaiting.isError ? (
            <p className="px-2 py-8 text-center text-[12.5px] text-dim">{errorMessage(awaiting.error)}</p>
          ) : waiting.length ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {waiting.map((item) => {
                const id = String(item.id);
                const chosen = picks.includes(id);
                const still = pickStill(item);
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={chosen}
                    onClick={() =>
                      setPicks((current) =>
                        current.includes(id) ? current.filter((row) => row !== id) : [...current, id],
                      )
                    }
                    className={cn(
                      "relative aspect-square overflow-hidden rounded-[12px] border bg-[color-mix(in_srgb,var(--accent)_10%,var(--card))] transition",
                      chosen ? "border-accent" : "border-line",
                    )}
                  >
                    {still ? (
                      <AuthedImage src={still} alt="" className="size-full" loading="lazy" />
                    ) : (
                      <span className="flex size-full items-center justify-center p-2 text-center text-[10.5px] leading-tight text-dim">
                        {item.body || "A note"}
                      </span>
                    )}
                    {chosen ? (
                      <span className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-full bg-accent text-on-accent">
                        <Check className="size-3" aria-hidden />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="px-2 py-10 text-center text-[12.5px] text-dim">
              Nothing has run out its day yet. What is up now will be here when it does.
            </p>
          )}
        </div>
      ) : step === "where" ? (
        <div className="p-2">
          {shelf.isLoading ? (
            <div className="space-y-2 p-2" aria-hidden>
              {[0, 1].map((row) => (
                <div key={row} className="skeleton h-12 rounded-[12px]" />
              ))}
            </div>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setStep("name")}
                className="flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent">
                  <Plus className="size-[18px]" aria-hidden />
                </span>
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-extrabold">New Memory</span>
                  <span className="block text-[11px] text-dim">Give it a name and a picture</span>
                </span>
              </button>
              {memories.map((memory) => {
                const still =
                  memory.cover_upload?.thumbnail_url ||
                  memory.cover_upload?.content_url ||
                  (memory.items ?? []).map(pickStill).find(Boolean) ||
                  null;
                return (
                  <button
                    key={String(memory.id)}
                    type="button"
                    disabled={busy}
                    onClick={() => void addTo(memory)}
                    className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] disabled:opacity-50"
                  >
                    <span className="size-9 shrink-0 overflow-hidden rounded-[9px] bg-[color-mix(in_srgb,var(--accent)_10%,var(--card))]">
                      {still ? <AuthedImage src={still} alt="" className="size-9" /> : null}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-bold">{memory.title}</span>
                      <span className="block text-[11px] text-dim">
                        {memory.count ?? memory.items?.length ?? 0} kept
                      </span>
                    </span>
                  </button>
                );
              })}
              {shelf.isError ? (
                <p className="px-3 py-4 text-[12px] text-dim">{errorMessage(shelf.error)}</p>
              ) : null}
            </>
          )}
        </div>
      ) : (
        <div className="space-y-4 p-5">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={24}
            autoFocus
            placeholder="What do you call it?"
            className="field"
            aria-label="Memory name"
          />
          <div>
            <p className="mb-2 text-[12px] text-dim">The picture on the shelf</p>
            <div className="no-scrollbar flex gap-2 overflow-x-auto">
              {coverFile && previews ? (
                <button
                  type="button"
                  aria-pressed
                  onClick={() => setCoverFile(null)}
                  className="relative size-[72px] shrink-0 overflow-hidden rounded-[12px] border-2 border-accent"
                >
                  <img src={previews} alt="" className="size-full object-cover" />
                </button>
              ) : null}
              {picked.map((item) => {
                const id = String(item.id);
                const still = pickStill(item);
                if (!still) return null;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={coverItem === id && !coverFile}
                    onClick={() => {
                      setCoverFile(null);
                      setCoverItem((current) => (current === id ? null : id));
                    }}
                    className={cn(
                      "size-[72px] shrink-0 overflow-hidden rounded-[12px] border-2 transition",
                      coverItem === id && !coverFile ? "border-accent" : "border-transparent",
                    )}
                  >
                    <AuthedImage src={still} alt="" className="size-[72px]" />
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => input.current?.click()}
                className="flex size-[72px] shrink-0 items-center justify-center rounded-[12px] border border-line text-dim transition hover:border-accent hover:text-accent"
                aria-label="Choose a cover from this device"
              >
                <ImagePlus className="size-5" aria-hidden />
              </button>
            </div>
            <input
              ref={input}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  setCoverFile(file);
                  setCoverItem(null);
                }
                event.target.value = "";
              }}
            />
            <p className="mt-2 text-[10.5px] leading-4 text-dim">
              Leave it and the first picture kept stands for the shelf.
            </p>
          </div>
        </div>
      )}
    </Modal>
  );
}
