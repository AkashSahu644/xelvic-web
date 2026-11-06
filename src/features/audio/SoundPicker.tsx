import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Bookmark, Music2, Pause, Play, Plus, Search } from "lucide-react";
import { Spinner } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { errorMessage } from "@/utils/errors";
import { kindOf, uploadAsset } from "@/utils/upload";
import { audioService } from "@/services/audio.service";
import { savedService } from "@/services/saved.service";
import { savedKindOfSound } from "@/store/saved";
import { usePlayer } from "@/hooks/usePlayer";
import { useSaved } from "@/hooks/useSaved";
import { useToast } from "@/hooks/useToast";
import type { AudioHome, Track } from "@/types/api";
import { boardUploads, fetchUploads, keptToTrack } from "./audioShelf";
import { AudioArt, audioClock, audioPlays, readAudioDuration } from "./soundBits";

/**
 * The sheet that puts a sound under something — `screens/audio_picker.dart`,
 * ported.
 *
 * One sheet for every place the web lays a sound under a post, exactly as the
 * phone has one: it used to open inside the camera's editor and nowhere else,
 * and a second copy of it would be a second chance for the same shelf to read
 * differently in two rooms. The shelves themselves are `audioShelf.ts` beside
 * this file, which is where the rules about *which* rows each chip holds live.
 *
 * Three chips and three shelves, as the phone has them: the uploads everybody
 * posted, the week's chart of them, and this account's own saved sounds. The
 * shipped catalogue is on none of them — it stood beside real uploads and made
 * the sheet read as an inventory rather than somebody's music.
 *
 * A search takes the place of all three, and it asks the *uploads* shelf
 * whichever chip is lit, because a search that reached into the shipped
 * catalogue would answer with songs nobody can put under a post. The 250 ms
 * settle is the phone's own (`_settle`), kept so a word being typed is one ask
 * rather than one per letter.
 *
 * What it answers with is a row and the length that row already knew. A row off
 * a shelf usually carries `seconds` and sometimes does not; a file off the
 * device never does and is measured. Both halves travel together because the
 * part chooser behind this sheet cannot offer a window into a length it has not
 * been told — see `audioWindow.ts`.
 */

/**
 * The weekly board's answer, kept for the session.
 *
 * Module-level rather than in the sheet's state, because the sheet unmounts
 * between two openings and the chart does not change between them. The phone
 * caches it the same way (`Audio.it.load`).
 */
let audioHomeCache: { at: number; home: AudioHome } | null = null;

/**
 * A chosen sound: the row, plus the asset it is already stored as when this
 * account uploaded it a moment ago.
 *
 * The asset id matters and is not an optimisation. A sound is posted by asset
 * id, and a row off a shelf has no asset id of its own — only an address — so
 * the bytes come down and go up again. A file the person just handed over has
 * already been through that once, and uploading it a second time to post it
 * would be the same sound stored twice under two ids.
 *
 * `seconds` is the row's own length and is the *only* place a length lives: a
 * file uploaded here is measured as it is handed over and stamped with what was
 * read, so the part chooser never has to fetch the bytes a second time to learn
 * something this sheet already knew. A row whose length nobody could read keeps
 * a zero, and the chooser measures it when it opens — see `PartChooser`.
 */
export type PickedSound = Track & { assetId?: string };

export interface SoundPickerProps {
  open: boolean;
  /** The sound already on the thing being edited, if any — the tick on its row. */
  selectedId?: string | null;
  onClose: () => void;
  /**
   * A row was chosen. The sheet does not close itself: whether a part chooser
   * comes next is the caller's business, and on this client it always does.
   */
  onPick: (track: PickedSound) => void;
  /**
   * Whether the `+` is offered.
   *
   * On for a Spark card, whose sound is a song somebody owns laid under their
   * own picture. The phone's own reason for the switch is the same one: a drop
   * composer's soundtrack may only be one of the app's own, because the poster
   * is putting a bed under a photo and not publishing a file.
   */
  allowUpload?: boolean;
  contained?: boolean;
}

export function SoundPicker({
  open,
  selectedId = null,
  onClose,
  onPick,
  allowUpload = true,
  contained = false,
}: SoundPickerProps) {
  const player = usePlayer();
  const { toast } = useToast();
  const { has: isKept, toggle: toggleKept } = useSaved();
  const inputRef = useRef<HTMLInputElement>(null);
  /**
   * Whether *this sheet* put something on the player.
   *
   * The player is the app's one music bar, shared with every list behind this
   * sheet, so a sheet that closed the player on the way out would be stopping
   * music it never started. The phone's picker keeps the same flag.
   */
  const startedRef = useRef(false);
  const closePlayer = player.close;

  const [home, setHome] = useState<AudioHome | null>(null);
  const [homeSettled, setHomeSettled] = useState(false);
  const [homeTrouble, setHomeTrouble] = useState<string | null>(null);
  const [list, setList] = useState<Track[]>([]);
  const [shelfLoading, setShelfLoading] = useState(false);
  const [results, setResults] = useState<Track[]>([]);
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState<"all" | "trending" | "saved">("all");
  const [heroIndex, setHeroIndex] = useState(0);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);

  // Every opening starts on the first chip with an empty box, which is what the
  // phone's sheet does: a search left standing from last time would open the
  // sheet on somebody else's question.
  useEffect(() => {
    if (!open) return;
    setTab("all");
    setQuery("");
    setResults([]);
    setHeroIndex(0);
  }, [open]);

  /**
   * The tab's own payload, read when the sheet opens.
   *
   * One thing in here is the sheet's and not the tab's: the weekly board, which
   * rides inside `GET /audio/` rather than behind an endpoint of its own — so
   * the Trending chip has nothing left to ask for and has to wait on this read
   * instead. It says when it has settled, either way, so the chip can tell
   * "still in the air" from "came back empty" and not draw an empty week over
   * an ask that has not finished.
   *
   * The answer is kept for the session. It is a chart of the week and a list of
   * moods: nothing in it moves between two openings of a picker, and the phone
   * caches it the same way (`Audio.it.load`).
   */
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    const cached = audioHomeCache;
    if (cached) {
      setHome(cached.home);
      setHomeTrouble(null);
      setHomeSettled(true);
    } else {
      setHomeSettled(false);
    }
    void audioService
      .home()
      .then((answer) => {
        audioHomeCache = { at: Date.now(), home: answer };
        if (cancelled) return;
        setHome(answer);
        setHomeTrouble(null);
      })
      .catch((cause: unknown) => {
        if (cancelled) return;
        // A cached answer stays: a chart read an hour ago is a better week to
        // draw than an empty one, and the chip says nothing about a read that
        // is not the one it is showing.
        if (!cached) setHome(null);
        setHomeTrouble(errorMessage(cause));
      })
      .finally(() => {
        if (!cancelled) setHomeSettled(true);
      });
    return () => {
      cancelled = true;
    };
  }, [open]);

  /**
   * The shelf the lit chip names, read once per change of chip.
   *
   * A search takes the place of all three — see the effect below — so this one
   * stands down while the box has words in it.
   */
  useEffect(() => {
    if (!open || query.trim()) return;
    let cancelled = false;
    /**
     * The last chip's rows go before the ask, not after it.
     *
     * Left standing they are drawn under the spinner as if they were this
     * chip's answer — tap "Saved" and the sheet shows the uploads shelf while
     * it waits. The phone's `_load` clears `_rows` here for the same reason.
     */
    setList([]);
    setTrouble(null);
    // The chart rides inside the tab's own payload and that ask is already in
    // the air when the sheet opens, so there is nothing second to ask for:
    // stand here, spinner up, rather than draw an empty week over a read that
    // has not finished.
    if (tab === "trending" && !home && !homeSettled) {
      setShelfLoading(true);
      return;
    }
    setShelfLoading(true);
    void (async () => {
      try {
        if (tab === "trending") {
          // A board that would not come down is said, not drawn as an empty
          // chart — the two are different things and only one of them is true.
          if (homeTrouble) throw new Error(homeTrouble);
          if (!cancelled) setList(boardUploads(home?.trending));
          return;
        }
        if (tab === "saved") {
          const shelf = await savedService.shelf();
          if (cancelled) return;
          setList(
            (shelf.items ?? [])
              .map(keptToTrack)
              .filter((row): row is Track => Boolean(row)),
          );
          return;
        }
        const tracks = await fetchUploads();
        if (!cancelled) setList(tracks);
      } catch (cause) {
        if (cancelled) return;
        /**
         * A failed read leaves nothing behind it — no stand-in, no list from
         * the chip before. A sheet quietly answering a question nobody asked,
         * looking like it worked, is the same lie as a fallback list with a
         * shorter life. The phone says the read did not land and draws nothing;
         * so does this.
         */
        setList([]);
        setTrouble(errorMessage(cause));
      } finally {
        if (!cancelled) setShelfLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, tab, query, home, homeSettled, homeTrouble]);

  /**
   * A typed ask, made of the uploads shelf whichever chip is lit.
   *
   * The delay is the phone's 250 ms `_settle`, kept so a word being typed is
   * one ask rather than one per letter. Waiting starts with the keystroke
   * rather than with the ask: the screen is doing nothing else for those 260 ms,
   * and a box that shows neither rows nor a spinner for that long reads as a
   * search that answered nothing.
   */
  useEffect(() => {
    if (!open) return;
    const words = query.trim();
    if (!words) {
      setResults([]);
      setLoading(false);
      return;
    }
    setResults([]);
    setLoading(true);
    setTrouble(null);
    const timer = window.setTimeout(() => {
      void fetchUploads(words)
        .then((tracks) => setResults(tracks))
        .catch((cause: unknown) => {
          setResults([]);
          setTrouble(errorMessage(cause));
        })
        .finally(() => setLoading(false));
    }, 260);
    return () => window.clearTimeout(timer);
  }, [open, query]);

  // The sheet gives the ear back when it goes: closing on the way to somewhere
  // else would otherwise leave a sound playing from a sheet nobody can see.
  useEffect(
    () => () => {
      if (startedRef.current) {
        startedRef.current = false;
        closePlayer();
      }
    },
    [closePlayer],
  );

  function stopPreview() {
    if (!startedRef.current) return;
    startedRef.current = false;
    closePlayer();
  }

  function preview(track: Track) {
    startedRef.current = true;
    player.play(track, [track]);
  }

  function dismiss() {
    stopPreview();
    onClose();
  }

  function choose(track: PickedSound) {
    // The audition goes before the answer, not after it: the caller's next move
    // is the part chooser, which previews the window it is offering, and a
    // player already on this track would be *toggled* off by the same call
    // rather than moved to the window.
    stopPreview();
    onPick(track);
  }

  async function upload(file: File) {
    if (kindOf(file) !== "audio") {
      toast({ title: "Pick an audio file.", tone: "error" });
      return;
    }
    setUploading(true);
    try {
      const asset = await uploadAsset(file, { kind: "audio" });
      // Measured before the row is built rather than after, so the length the
      // chooser is handed is the row's own `seconds` and not a second fact
      // travelling beside it. A file the browser cannot measure is not refused
      // here: it is still a sound, and the chooser has the whole file to offer
      // when nobody can say how long it is. The refusal lives where the length
      // is *needed* — the strip that would otherwise be drawn on a guess.
      const measured = await readAudioDuration(file).catch(() => 0);
      choose({
        id: asset.id,
        title: asset.original_name || file.name,
        artist: "Your audio",
        kind: "audio",
        stream: asset.content_url ?? undefined,
        seconds: measured ? Math.max(1, Math.round(measured / 1000)) : 0,
        assetId: String(asset.id),
      });
    } catch (cause) {
      toast({
        title: "That audio did not upload",
        description: errorMessage(cause),
        tone: "error",
      });
    } finally {
      setUploading(false);
    }
  }

  if (!open) return null;

  const hasQuery = Boolean(query.trim());
  /**
   * What the sheet draws: a search's answer, or the lit chip's shelf.
   *
   * No merging and no second source. A search replaces the chip rather than
   * filtering it — the phone's rule — and what a chip draws is one list that
   * came from one read.
   */
  const visible = hasQuery ? results : list;
  const listLoading = hasQuery ? loading : shelfLoading;
  /**
   * The swipeable card above the list, and it is the list's own first four rows.
   *
   * Not a second shelf: the card and the row under it were two different
   * answers, one recent play pinned above a list of something else. The phone's
   * `_carousel` is `rows.take(4)` and it stands down while there is a query,
   * because a search is already narrowed and a card would be the first match
   * drawn twice.
   */
  const heroes = hasQuery || visible.length < 2 ? [] : visible.slice(0, 4);
  const activeHero = heroes[heroIndex] ? heroIndex : 0;
  const featured = heroes[activeHero] ?? null;

  const sheet = (
    <div
      className={cn(
        "inset-0 z-[80] flex items-end bg-black/55",
        contained ? "absolute" : "fixed",
      )}
      onClick={dismiss}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label="Audio"
        className="flex max-h-[86%] min-h-[52%] w-full flex-col rounded-t-[28px] bg-card pb-[max(8px,env(safe-area-inset-bottom))] text-ink shadow-lg"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mx-auto mt-1 h-1.5 w-12 rounded-full bg-[color-mix(in_srgb,var(--ink)_15%,transparent)]" />
        <div className="flex items-center justify-between px-5 pb-1">
          <h2 className="text-[24px] font-black tracking-tight">Audio</h2>
          {allowUpload ? (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex size-10 items-center justify-center rounded-full text-ink hover:bg-surface-2"
              aria-label="Upload audio"
            >
              <Plus className="size-5" />
            </button>
          ) : null}
        </div>
        <div className="mx-5 mt-1 flex max-h-12 items-center gap-3 rounded-lg border border-line bg-card px-4 py-2 focus-within:ring-1 focus-within:ring-accent">
          <Search className="size-4 shrink-0 text-dim" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search..."
            aria-label="Search audio"
            className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none placeholder:text-dim"
          />
        </div>
        <div className="mt-2 flex gap-2 px-5">
          {[
            { key: "all" as const, label: "All audio" },
            { key: "trending" as const, label: "Trending" },
            { key: "saved" as const, label: "Saved" },
          ].map((chip) => (
            <button
              key={chip.key}
              type="button"
              onClick={() => setTab(chip.key)}
              className={cn(
                "h-8 rounded-full px-4 text-[13px] font-extrabold",
                tab === chip.key
                  ? "bg-accent text-on-accent shadow-sm"
                  : "border border-line bg-card text-dim",
              )}
            >
              {chip.label}
            </button>
          ))}
        </div>
        {featured ? (
          <>
            <div className="mx-4 mt-2 rounded-lg border border-accent/25 bg-accent-chip px-3 py-1.5">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    const playing =
                      player.current?.id === featured.id && player.playing;
                    if (playing) player.toggle();
                    else preview(featured);
                  }}
                  className="relative size-[56px] shrink-0 overflow-hidden rounded-xl bg-surface-2 text-ink"
                  aria-label={
                    player.current?.id === featured.id && player.playing
                      ? `Pause ${featured.title}`
                      : `Play ${featured.title}`
                  }
                >
                  <AudioArt track={featured} eager className="size-full" />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex size-10 items-center justify-center rounded-full bg-white/50 shadow-sm">
                      {player.current?.id === featured.id && player.playing ? (
                        <Pause className="size-4 fill-current" />
                      ) : (
                        <Play className="size-5 fill-current pl-0.5" />
                      )}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => choose(featured)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-lg font-black uppercase leading-[1.05] tracking-tight">
                    {featured.title}
                  </span>
                  <span className="flex items-center gap-1.5 text-sm font-semibold text-dim">
                    <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm bg-[#1c9bb5] text-white">
                      <Music2Glyph size={9} />
                    </span>
                    <span className="truncate">{featured.artist}</span>
                  </span>
                  <span className="block text-xs font-medium text-dim">
                    {audioPlays(featured)} · {audioClock(featured.seconds)}
                  </span>
                </button>
              </div>
            </div>
            {heroes.length > 1 ? (
              <div className="mt-2 flex justify-center gap-1.5">
                {heroes.map((track, index) => (
                  <button
                    key={String(track.id)}
                    type="button"
                    onClick={() => setHeroIndex(index)}
                    className={cn(
                      "h-1.5 rounded-full",
                      activeHero === index ? "w-4 bg-accent" : "w-1.5 bg-line",
                    )}
                    aria-label={`Featured ${index + 1}: ${track.title}`}
                  />
                ))}
              </div>
            ) : null}
          </>
        ) : null}
        <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-1">
          {listLoading ? (
            <div className="flex justify-center py-10">
              <Spinner className="size-6 text-accent" />
            </div>
          ) : null}
          {!listLoading && visible.length === 0 ? (
            <p className="py-10 text-center text-[13px] font-bold text-dim">
              {trouble
                ? trouble
                : hasQuery
                  ? `Nothing matched "${query.trim()}".`
                  : "Nothing here yet."}
            </p>
          ) : null}
          {visible.map((track) => {
            const playing = player.current?.id === track.id && player.playing;
            const selected = String(selectedId) === String(track.id);
            const kept = isKept(savedKindOfSound(track), String(track.id));
            return (
              <div
                key={String(track.id)}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-2 py-1 hover:bg-[var(--accent-soft)]",
                  selected && "bg-[var(--accent-soft)]",
                )}
              >
                <button
                  type="button"
                  onClick={() => (playing ? player.toggle() : preview(track))}
                  className="relative flex size-[40px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-2"
                  aria-label={playing ? `Pause ${track.title}` : `Play ${track.title}`}
                >
                  <AudioArt track={track} className="size-full" />
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex size-8 items-center justify-center rounded-full text-white">
                      {playing ? (
                        <Pause size={17} className="fill-current" />
                      ) : (
                        <Play size={17} className="fill-current pl-0.5" />
                      )}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => choose(track)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate text-sm font-black leading-tight">
                    {track.title}
                  </span>
                  <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-dim">
                    <span className="flex h-3 w-3 shrink-0 items-center justify-center rounded-sm bg-[#1c9bb5] text-white">
                      <Music2Glyph size={8} />
                    </span>
                    <span className="truncate">
                      {track.artist} · {audioPlays(track)} ·{" "}
                      {audioClock(track.seconds)}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    void toggleKept(savedKindOfSound(track), String(track.id))
                  }
                  className={cn(
                    "flex size-8 items-center justify-center rounded-full",
                    kept ? "text-accent" : "text-dim",
                  )}
                  aria-label={kept ? "Remove from saved audio" : "Save audio"}
                >
                  <Bookmark className={cn("size-4", kept && "fill-current")} />
                </button>
              </div>
            );
          })}
        </div>
        {uploading ? (
          <div className="flex items-center justify-center gap-2 py-3 text-[11px] font-bold text-dim">
            <Spinner className="size-4 text-accent" />
            Uploading audio...
          </div>
        ) : null}
        <input
          ref={inputRef}
          type="file"
          accept="audio/*"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void upload(file);
          }}
        />
      </section>
    </div>
  );

  return contained ? sheet : createPortal(sheet, document.body);
}

/**
 * The little music mark that says a row is a sound and not an episode.
 *
 * The same glyph `AudioArt` draws on a coverless sleeve, at the size of a badge
 * rather than a picture — 8 or 9 px inside a 12 px tile, which is the one place
 * in the app where a music note is punctuation.
 */
function Music2Glyph({ size }: { size: number }) {
  return <Music2 size={size} aria-hidden />;
}
