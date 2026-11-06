import { useEffect, useState } from "react";
import { Clapperboard, Image as ImageIcon, Play } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { AuthedImage } from "@/components/media/Media";
import { Modal } from "@/components/overlays/Modal";
import { cn } from "@/utils/cn";
import { errorMessage } from "@/utils/errors";
import { useToast } from "@/hooks/useToast";
import { dropsService } from "@/services/drops.service";
import type { Drop } from "@/types/api";
import { dropIsPicture, dropIsSound, dropIsVibe, dropStill } from "./model";

/**
 * A second thought about one's own post — the words and what it says about
 * itself, and nothing about what it *is*.
 *
 * `PATCH /drops/{id}/` (or `/drops/vibes/{id}/`) takes the caption, a sound's
 * name and shelf, the place, the two doors — comments and the felt count — and,
 * for a Vibe, the poster's own sensitive mark. It cannot change the picture,
 * the clip or the poll: `DropEditSerializer` says so in its own docstring, and
 * an edit is a reword rather than a new post wearing the first one's hearts.
 *
 * **Only what changed is sent.** Every field on that serializer is optional with
 * no default precisely so that a request that has no opinion leaves the column
 * alone — a form that echoed every field back would be a form that could clear a
 * sensitive mark somebody else put there by saving a caption. So each field is
 * compared against what the server sent and left out when it is the same, which
 * also keeps a blank `title` off a picture drop, where the server would rightly
 * clear it.
 *
 * The piece itself is drawn read-only at the top, from the post's own bytes,
 * because an edit changes the words under it and never the frame — the app
 * draws the same still for the same reason (`_editPiece` in `drop_post.dart`).
 */

/** The shelves a sound may be filed under — `kSoundKinds` in `drop_post.dart`. */
const SOUND_KINDS: { key: string; label: string }[] = [
  { key: "general", label: "Audio" },
  { key: "music", label: "Music" },
  { key: "podcast", label: "Podcast" },
  { key: "news", label: "News" },
  { key: "story", label: "Story" },
  { key: "devotional", label: "Devotional" },
  { key: "sports", label: "Sports" },
  { key: "education", label: "Education" },
  { key: "tone", label: "Tone" },
  { key: "audiobook", label: "Audiobook" },
  { key: "interview", label: "Interview" },
  { key: "comedy", label: "Comedy" },
];

/** The bar's word for what is being edited — `_editTitle`. */
function editTitle(drop: Drop | null): string {
  if (!drop) return "Edit";
  if (dropIsVibe(drop)) return "Edit Vibe";
  if (dropIsSound(drop)) return "Edit audio";
  if (drop.kind === "text") return "Edit note";
  return "Edit drop";
}

/**
 * Whether the form draws a place row — `_editingPlace`.
 *
 * The kinds whose own composer draws one: a picture, a clip and a note. A Vibe
 * has no place at all, and a sound's and a poll's composers have no such row, so
 * offering one here would be a field the poster never saw the first time.
 */
function editsPlace(drop: Drop): boolean {
  return drop.kind === "image" || drop.kind === "video" || drop.kind === "text";
}

/**
 * The post a bare id names, from whichever of the two tables holds it.
 *
 * `?edit=<id>` is a link somebody was handed and an id is all it carries: a
 * drop and a Vibe are two tables under two families of routes, and the URL does
 * not say which. The page that opens the sheet usually has the post in hand and
 * never comes here at all; this is the path for a link opened cold, where the
 * only honest thing to do is ask, and the Vibe's own route is only asked when
 * the drop's has said there is nothing there. A genuinely missing id therefore
 * costs one extra request and reports the *first* error, which is the one that
 * names the address the link actually used.
 */
async function readById(id: string): Promise<Drop | null> {
  try {
    const answer = await dropsService.detail("drops", id);
    return answer.drop ?? null;
  } catch (first) {
    try {
      const answer = await dropsService.detail("drops/vibes", id);
      return answer.vibe ?? answer.drop ?? null;
    } catch {
      throw first;
    }
  }
}

export function EditDrop({
  drop: handed,
  dropId,
  open,
  onClose,
  onSaved,
}: {
  /** The post as the card already holds it, when the caller has it. */
  drop?: Drop | null;
  /** The id to read when the caller does not have the post in hand. */
  dropId?: string;
  open: boolean;
  onClose: () => void;
  onSaved?: (drop: Drop) => void;
}) {
  const { toast } = useToast();
  const [drop, setDrop] = useState<Drop | null>(handed ?? null);
  const [reading, setReading] = useState(false);
  const [body, setBody] = useState("");
  const [title, setTitle] = useState("");
  const [soundKind, setSoundKind] = useState("general");
  const [place, setPlace] = useState("");
  const [commentsOff, setCommentsOff] = useState(false);
  const [likesOff, setLikesOff] = useState(false);
  const [sensitive, setSensitive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);

  // Seed the form from the post, once per opening. A deep link (`?edit=`) has
  // no post in hand and reads the server's own copy — an edit that started from
  // a guessed caption would save the guess back.
  useEffect(() => {
    if (!open) return;
    if (handed) {
      setDrop(handed);
      return;
    }
    if (!dropId) return;
    let live = true;
    setReading(true);
    void readById(dropId)
      .then((answer) => {
        if (live) setDrop(answer);
      })
      .catch((error) => {
        if (live) setTrouble(errorMessage(error));
      })
      .finally(() => {
        if (live) setReading(false);
      });
    return () => {
      live = false;
    };
  }, [open, handed, dropId]);

  useEffect(() => {
    if (!drop) return;
    setBody(drop.body ?? "");
    setTitle(drop.title ?? "");
    setSoundKind(drop.sound_kind || "general");
    setPlace(drop.place ?? "");
    setCommentsOff(Boolean(drop.comments_off));
    setLikesOff(Boolean(drop.likes_off));
    setSensitive(Boolean(drop.sensitive));
    setTrouble(null);
  }, [drop]);

  async function save() {
    if (!drop || busy) return;
    const base = dropIsVibe(drop) ? "drops/vibes" : "drops";
    const payload: Record<string, unknown> = {};

    // Only the fields that differ, which is what "a field left out is left
    // alone" is for.
    if (body !== (drop.body ?? "")) payload.body = body;
    if (dropIsSound(drop)) {
      if (title !== (drop.title ?? "")) payload.title = title;
      if (soundKind !== (drop.sound_kind || "general")) payload.sound_kind = soundKind;
    } else if (editsPlace(drop)) {
      if (place !== (drop.place ?? "")) payload.place = place;
    }
    if (commentsOff !== Boolean(drop.comments_off)) payload.comments_off = commentsOff;
    if (likesOff !== Boolean(drop.likes_off)) payload.likes_off = likesOff;
    if (dropIsVibe(drop) && sensitive !== Boolean(drop.sensitive)) payload.sensitive = sensitive;

    if (!Object.keys(payload).length) {
      onClose();
      return;
    }

    setBusy(true);
    setTrouble(null);
    try {
      const answer = await dropsService.edit(base, drop.id, payload);
      const fresh = ("vibe" in answer ? answer.vibe : answer.drop)!;
      toast({ title: "Saved.", tone: "success" });
      onSaved?.(fresh);
      onClose();
    } catch (error) {
      // The words stay on the screen and the sentence says what happened; a
      // toast saying "Saved" over a refused edit is the one thing this form
      // must never do.
      setTrouble(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const piece = drop ? still(drop) : null;
  const clip = Boolean(drop && (drop.kind === "video" || dropIsVibe(drop)));

  return (
    <Modal open={open} onClose={onClose} title={editTitle(drop)} size="lg">
      {!drop ? (
        <div className="space-y-3 px-4 py-5" aria-hidden>
          {reading ? (
            <>
              <div className="skeleton h-40 w-full rounded-[14px]" />
              <div className="skeleton h-24 w-full rounded-[12px]" />
            </>
          ) : (
            <p className="text-[13px] text-dim">{trouble ?? "This post could not be read."}</p>
          )}
        </div>
      ) : (
        <div className="space-y-4 px-4 py-4 sm:px-5">
          {/* What an edit is not changing, drawn from the post's own bytes so
              the form reads as the post being changed rather than a blank one. */}
          {piece ? (
            <div className="overflow-hidden rounded-[14px] border border-line">
              <div className="relative bg-black/5">
                <AuthedImage
                  src={piece}
                  alt=""
                  className="w-full"
                  imgClassName="mx-auto max-h-[320px] w-full object-contain"
                />
                {clip ? (
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                    {/* A mark rather than a player: an edit cannot page through
                        the run behind the frame and nothing else on this form
                        would say a clip is there. */}
                    <span className="flex size-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur">
                      <Play className="size-5 fill-current" aria-hidden />
                    </span>
                  </span>
                ) : null}
              </div>
              <p className="px-3 py-2 text-[12px] leading-[1.4] text-dim">
                {clip
                  ? "The clip stays as it is — an edit changes the words and the details under them."
                  : "The picture stays as it is — an edit changes the words and the details under them."}
              </p>
            </div>
          ) : dropIsPicture(drop) ? (
            <p className="flex items-center gap-2 text-[12px] text-dim">
              <ImageIcon className="size-4" aria-hidden /> The picture stays as it is.
            </p>
          ) : drop.kind === "text" ? null : (
            <p className="flex items-center gap-2 text-[12px] text-dim">
              <Clapperboard className="size-4" aria-hidden /> What this is stays as it is.
            </p>
          )}

          {/* A sound's name and shelf, drawn above the words exactly as the
              composer draws them — the same three fields, in the same order. */}
          {dropIsSound(drop) ? (
            <>
              <label className="block">
                <span className="field-label">Name</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  maxLength={140}
                  placeholder="What is it called?"
                  className="field min-h-10 py-2 text-[13px]"
                />
              </label>
              <div>
                <p className="field-label">Category</p>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {SOUND_KINDS.map((kind) => {
                    const on = soundKind === kind.key;
                    return (
                      <button
                        key={kind.key}
                        type="button"
                        aria-pressed={on}
                        onClick={() => setSoundKind(kind.key)}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-[12px] transition",
                          on
                            ? "border-accent bg-accent font-bold text-on-accent"
                            : "border-line bg-card font-semibold text-dim hover:text-ink",
                        )}
                      >
                        {kind.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          ) : null}

          <label className="block">
            <span className="field-label">Words</span>
            <textarea
              value={body}
              onChange={(event) => setBody(event.target.value)}
              rows={4}
              maxLength={4000}
              placeholder="Say something"
              className="field min-h-[96px] resize-y text-[14px] leading-6"
            />
            <span className="mt-1 block text-end text-[10px] text-dim">{body.length}/4000</span>
          </label>

          {editsPlace(drop) ? (
            <label className="block">
              <span className="field-label">
                Place <span className="font-normal opacity-60">optional</span>
              </span>
              <input
                value={place}
                onChange={(event) => setPlace(event.target.value)}
                maxLength={60}
                placeholder="Where was this?"
                className="field min-h-10 py-2 text-[13px]"
              />
            </label>
          ) : null}

          <div className="space-y-1 rounded-[12px] border border-line p-1">
            <Toggle
              label="Turn off comments"
              line="The count stays; the sheet refuses."
              on={commentsOff}
              onChange={setCommentsOff}
            />
            <Toggle
              label="Hide the felt count"
              line="Only you will see how many felt it."
              on={likesOff}
              onChange={setLikesOff}
            />
            {dropIsVibe(drop) ? (
              <Toggle
                label="Mark as sensitive"
                line="It goes behind the cover for people who have not opened it."
                on={sensitive}
                onChange={setSensitive}
              />
            ) : null}
          </div>

          {trouble ? (
            <p className="rounded-[10px] bg-[color-mix(in_srgb,var(--bad)_8%,transparent)] px-3 py-2 text-[11.5px] text-[var(--bad)]">
              {trouble}
            </p>
          ) : null}

          <div className="flex justify-end gap-2 pt-1">
            <Button variant="ghost" size="sm" onClick={onClose} disabled={busy}>
              Cancel
            </Button>
            <Button size="sm" loading={busy} onClick={() => void save()}>
              Save
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

/** One switch in the form's own box — the app's rows, with the same two lines. */
function Toggle({
  label,
  line,
  on,
  onChange,
}: {
  label: string;
  line: string;
  on: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      onClick={() => onChange(!on)}
      className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-start transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
    >
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-bold">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-[1.3] text-dim">{line}</span>
      </span>
      <span
        aria-hidden
        className={cn(
          "relative h-[22px] w-[38px] shrink-0 rounded-full transition",
          on ? "bg-accent" : "bg-[color-mix(in_srgb,var(--ink)_18%,transparent)]",
        )}
      >
        <span
          className={cn(
            "absolute top-[2px] size-[18px] rounded-full bg-white shadow transition-all",
            on ? "start-[18px]" : "start-[2px]",
          )}
        />
      </span>
    </button>
  );
}

/** The still a post's own editor draws — its picture, or a sound's cover. */
function still(drop: Drop) {
  const asset = dropStill(drop);
  return asset?.thumbnail_url || asset?.content_url || null;
}