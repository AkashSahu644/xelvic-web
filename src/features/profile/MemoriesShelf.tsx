import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  BookmarkPlus,
  ImagePlus,
  Lock,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AuthedImage } from "@/components/media/Media";
import { ConfirmDialog, Modal } from "@/components/overlays/Modal";
import { SheetRow } from "@/features/profile/parts";
import { AddToMemories, pickStill } from "@/features/moments/AddToMemories";
import { memoryAsMoment } from "@/features/moments/memory";
import { MomentViewer } from "@/features/moments/MomentViewer";
import { cn } from "@/utils/cn";
import { errorMessage } from "@/utils/errors";
import { uploadAsset } from "@/utils/upload";
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/hooks/usePreferences";
import { useToast } from "@/hooks/useToast";
import { momentsService } from "@/services/moments.service";
import type { Memory, MomentItem, UserCard } from "@/types/api";

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
 * What a card opens is the *same* viewer a moment opens in, told which of the
 * two it is holding — see `MomentViewer` and `isMemory`. A Memory is drawn as a
 * walk of the things it kept, answered and shared at routes of its own, and a
 * Memory of a playlist is not a walk at all: it opens where that playlist lives.
 *
 * A long press on my own card is the other half of it — `manageMemory` on the
 * phone — and it is a long press rather than a corner button because the card
 * *is* somebody's photograph, and a button over one would be an icon sitting on
 * it. Nothing on the card says it can be held: that is the same bargain the app
 * makes with a hold everywhere else.
 */

/** The card's own frame, from the rail. See `memoryCardWidth` and its two. */
const CARD_W = 86;
const CARD_H = 129;

/** How long a press is held before it counts as "change this shelf" — `kHoldToPause`. */
const HOLD_MS = 480;

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

/** One picture on a cover's grid — the item itself, or a note's words. */
function coverChoices(memory: Memory): MomentItem[] {
  return (memory.items ?? []).filter((item) => pickStill(item) != null);
}

export function MemoriesShelf({
  username,
  mine,
  onAdd,
  author,
}: {
  username: string;
  /** Whose shelf this is. Only my own gets the card that makes one, and the long press. */
  mine: boolean;
  /** What adding a Memory means here, or null where it means nothing. */
  onAdd?: (() => void) | null;
  /** The person whose page this is, so the viewer can head the walk with their face. */
  author?: UserCard | null;
}) {
  const { t } = usePreferences();
  const { toast } = useToast();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [viewing, setViewing] = useState<Memory | null>(null);
  const [lifted, setLifted] = useState(false);
  const [pressed, setPressed] = useState<string | null>(null);
  /** The shelf whose long-press sheet is up. */
  const [managing, setManaging] = useState<Memory | null>(null);
  /** Which of the four doors behind it is open. */
  const [adding, setAdding] = useState<Memory | null>(null);
  const [renaming, setRenaming] = useState<Memory | null>(null);
  const [name, setName] = useState("");
  const [covering, setCovering] = useState<Memory | null>(null);
  const [removing, setRemoving] = useState<Memory | null>(null);
  const [busy, setBusy] = useState(false);
  const coverInput = useRef<HTMLInputElement>(null);
  const holdTimer = useRef<number | null>(null);
  /** Whether the press that just ended became the long press. */
  const consumed = useRef(false);

  const shelf = useQuery({
    queryKey: ["profile-memories", username],
    // A failure leaves the shelf out and the next visit asks again: this is the
    // least of the page, and the app swallows the error for the same reason.
    queryFn: () => momentsService.memoriesByUser(username),
    enabled: Boolean(username),
    retry: false,
  });

  useEffect(
    () => () => {
      if (holdTimer.current) window.clearTimeout(holdTimer.current);
    },
    [],
  );

  const memories = shelf.data?.memories ?? [];
  const who: UserCard | null = mine ? user ?? author ?? null : author ?? null;

  /** Nothing to draw and no way to add: the shelf is not there at all. */
  if (!shelf.isLoading && memories.length === 0 && !onAdd) return null;

  /** Something on or off the shelf: every reader of it asks again. */
  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["profile-memories"] });
    void queryClient.invalidateQueries({ queryKey: ["my-memories"] });
  }

  function visit(memory: Memory) {
    setLifted(false);
    // A Memory of a playlist is not a strip of pictures: it opens the playlist
    // it kept, where that playlist already lives.
    const held = memory.playlist;
    if (held) {
      navigate(`/app/audio/${held.id}`);
      return;
    }
    // A marked Memory this reader may not open is not opened at all. There is no
    // uncovered version to fall back to and a viewer that did not know the flags
    // would draw the strip bare — so the tap stops here and says why.
    if (memory.sensitive && !memory.openable) {
      toast({ title: t("This is sensitive content you cannot open."), tone: "error" });
      return;
    }
    if (!(memory.items ?? []).length) {
      toast({ title: t("There is nothing left on this shelf."), tone: "info" });
      return;
    }
    setViewing(memory);
  }

  function holdDown(memory: Memory) {
    if (!mine) return;
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    holdTimer.current = window.setTimeout(() => {
      consumed.current = true;
      setManaging(memory);
    }, HOLD_MS);
  }

  function holdUp() {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    holdTimer.current = null;
    // Whatever this press was, the click the browser sends next is the same
    // gesture finishing rather than a second one.
    window.setTimeout(() => {
      consumed.current = false;
    }, 400);
  }

  /** Run one of the four and say what happened — `_patched` in `memory_add.dart`. */
  async function change(act: () => Promise<unknown>, done?: string) {
    if (busy) return;
    setBusy(true);
    try {
      await act();
      refresh();
      if (done) toast({ title: done, tone: "success" });
      return true;
    } catch (error) {
      toast({ title: errorMessage(error), tone: "error" });
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function rename() {
    const memory = renaming;
    const title = name.trim();
    if (!memory || !title) return;
    if (await change(() => momentsService.editMemory(memory.id, { title }), t("Done"))) {
      setRenaming(null);
    }
  }

  async function setCover(memory: Memory, patch: { cover?: string; cover_upload?: string }, file?: File) {
    if (busy) return;
    setBusy(true);
    try {
      let upload: string | undefined;
      if (file) {
        upload = String((await uploadAsset(file)).id);
      }
      await momentsService.editMemory(
        memory.id,
        upload ? { cover_upload: upload } : patch.cover ? { cover: patch.cover } : {},
      );
      refresh();
      setCovering(null);
      toast({ title: t("Done"), tone: "success" });
    } catch (error) {
      toast({ title: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    const memory = removing;
    if (!memory) return;
    if (await change(() => momentsService.dropMemory(memory.id), t("Done"))) {
      setRemoving(null);
    }
  }

  const current = viewing;
  const walk = current ? [memoryAsMoment(current, who, mine, username)] : [];

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
                if (consumed.current) {
                  consumed.current = false;
                  return;
                }
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
              onPointerDown={() => holdDown(memory)}
              onPointerUp={holdUp}
              onPointerCancel={holdUp}
              onContextMenu={(event) => {
                if (!mine) return;
                event.preventDefault();
                setManaging(memory);
              }}
              aria-label={mine ? `${memory.title || t("A Memory")} — hold to change it` : undefined}
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

      {/* The walk itself, which is the same viewer a moment opens in. */}
      {current ? (
        <MomentViewer
          moments={walk}
          onClose={() => {
            setViewing(null);
            setLifted(false);
            setPressed(null);
          }}
          onChanged={refresh}
        />
      ) : null}

      {/* The long press on my own card: the four things a shelf can become. */}
      <Modal
        open={Boolean(managing)}
        onClose={() => setManaging(null)}
        title={managing?.title || t("A Memory")}
        description={
          managing?.playlist
            ? t("A playlist you kept.")
            : `${managing?.count ?? managing?.items?.length ?? 0} kept`
        }
        size="sm"
      >
        <div className="pb-2">
          {/* A playlist Memory holds no moments, so there is nothing to add to
              it and no picture of its own to choose — the same two rows the
              app leaves out for one. */}
          {managing && !managing.playlist ? (
            <SheetRow
              icon={<BookmarkPlus className="size-[18px]" />}
              label={t("Add more to it")}
              line={t("Put more of your moments into this Memory.")}
              onClick={() => {
                setAdding(managing);
                setManaging(null);
              }}
            />
          ) : null}
          <SheetRow
            icon={<Pencil className="size-[18px]" />}
            label={t("Rename")}
            line={t("Call it something else.")}
            onClick={() => {
              setName(managing?.title ?? "");
              setRenaming(managing);
              setManaging(null);
            }}
          />
          {managing && !managing.playlist ? (
            <SheetRow
              icon={<ImagePlus className="size-[18px]" />}
              label={t("Change the cover")}
              line={t("Pick which of its pictures stands for it.")}
              onClick={() => {
                setCovering(managing);
                setManaging(null);
              }}
            />
          ) : null}
          <SheetRow
            icon={<Trash2 className="size-[18px]" />}
            label={t("Remove")}
            line={t("Take it off your profile. The moments stay where they are.")}
            onClick={() => {
              setRemoving(managing);
              setManaging(null);
            }}
          />
        </div>
      </Modal>

      {/* "Add more to it" — the picker, with the shelf already decided. */}
      <AddToMemories
        open={Boolean(adding)}
        into={adding}
        onClose={() => setAdding(null)}
        onDone={refresh}
      />

      <Modal
        open={Boolean(renaming)}
        onClose={busy ? () => undefined : () => setRenaming(null)}
        title={t("Rename")}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => setRenaming(null)}
            >
              {t("Cancel")}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !name.trim()}
              onClick={() => void rename()}
            >
              {t("Save")}
            </button>
          </div>
        }
      >
        <div className="p-5">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={24}
            autoFocus
            placeholder={t("A name for it")}
            className="field"
            aria-label={t("Rename")}
          />
        </div>
      </Modal>

      {/* "Change the cover" — one of its own pictures, or one off this device. */}
      <Modal
        open={Boolean(covering)}
        onClose={busy ? () => undefined : () => setCovering(null)}
        title={t("Change the cover")}
        description={t("Pick which of its pictures stands for it.")}
        size="md"
      >
        <div className="p-3">
          {covering && coverChoices(covering).length ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {coverChoices(covering).map((item) => {
                const id = String(item.id);
                const on = String(covering.cover ?? "") === id;
                return (
                  <button
                    key={id}
                    type="button"
                    aria-pressed={on}
                    disabled={busy}
                    onClick={() => void setCover(covering, { cover: id })}
                    className={cn(
                      "relative aspect-square overflow-hidden rounded-[12px] border-2 transition",
                      on ? "border-accent" : "border-transparent",
                    )}
                  >
                    <AuthedImage src={pickStill(item) ?? ""} alt="" className="size-full" />
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="px-2 py-8 text-center text-[12.5px] text-dim">
              {t("This Memory has no pictures of its own to choose from.")}
            </p>
          )}
          <button
            type="button"
            disabled={busy}
            onClick={() => coverInput.current?.click()}
            className="mt-3 flex w-full items-center gap-3 rounded-[12px] border border-line px-3 py-2.5 text-left text-[13px] font-semibold transition hover:border-accent hover:text-accent disabled:opacity-50"
          >
            <ImagePlus className="size-[18px]" aria-hidden />
            {t("Use a picture from this device")}
          </button>
          <input
            ref={coverInput}
            type="file"
            accept="image/*"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file && covering) void setCover(covering, {}, file);
            }}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={busy ? () => undefined : () => setRemoving(null)}
        onConfirm={() => void remove()}
        title={t("Remove this Memory?")}
        body={t("It comes off your profile. The moments it holds stay exactly where they are.")}
        confirmLabel={t("Remove")}
        destructive
        loading={busy}
        icon={<Trash2 className="size-4" aria-hidden />}
      />
    </section>
  );
}

/** Exported for the shelf's own tests, which measure a card against the rail. */
export const memoryCard = { width: CARD_W, height: CARD_H, radius: 14 } as const;