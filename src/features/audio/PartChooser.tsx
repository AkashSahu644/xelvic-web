import { useEffect, useRef, useState } from "react";
import { ChevronDown, Pause, Play, User, X } from "lucide-react";
import { Spinner } from "@/components/ui/Button";
import { cn } from "@/utils/cn";
import { errorMessage } from "@/utils/errors";
import { useToast } from "@/hooks/useToast";
import type { Track } from "@/types/api";
import { PartLengthMenu } from "./PartLengthMenu";
import { SOUND_BASE_MS, type SoundWindow } from "./audioWindow";
import { useSoundPreview } from "./preview";
import {
  AudioArt,
  audioClock,
  fetchAudioFile,
  readAudioDuration,
} from "./soundBits";

/**
 * "Choose a part" — `_WindowViewState`, ported, and one sheet for the whole web.
 *
 * It used to live inside `camera/PhotoEditor.tsx`, where it was written, and it
 * is the same question on the Spark card page: which slice of this file plays
 * under the thing being posted. A second copy would be a second drag surface
 * with its own arithmetic, and the arithmetic is the part that is easy to get
 * wrong — see `audioWindow.ts`.
 *
 * The sheet owns three things the caller should not have to:
 *
 * - **how long the file is.** A row off a shelf usually carries `seconds` and
 *   often does not; a file the person just handed over never does. When nobody
 *   knows, the bytes are fetched and measured here, and the strip stands behind
 *   a "Reading audio..." scrim rather than drawing a window over a length it
 *   has not been told. A file whose metadata will not load is *refused*: the
 *   sheet closes and says why, because a part chosen on a guessed length is a
 *   part that plays the wrong music.
 * - **the audition.** It plays the sound while the strip is open, follows the
 *   playhead across the strip, and hands the player to the caller on "Use" —
 *   see `preview.ts` for why that is a hand-over rather than a stop.
 * - **the window's own limits.** The strip cannot be dragged past either end of
 *   the file, and the part's length is capped by what the caller asked for.
 *
 * What it does *not* own is what the window means. A window is a start and an
 * end in milliseconds and nothing else; whether that becomes `sound_start_ms`
 * on a moment or a pair of numbers in a photo editor's document is the
 * caller's business.
 */

export interface PartChooserProps {
  open: boolean;
  /** The sound being windowed, or null while none is. */
  track: Track | null;
  /**
   * How long the file is, when the caller already knows.
   *
   * A picker that measured the file it just uploaded hands the number over;
   * anything else passes zero and lets the sheet find out.
   */
  knownDurationMs?: number;
  /** How long a part the caller needs. See `audioWindow.ts` for the rules. */
  spanMs?: number;
  /** The window to open on, when there is one already. Both zero means none. */
  initialStartMs?: number;
  initialEndMs?: number;
  onApply: (window: SoundWindow) => void;
  onClose: () => void;
  contained?: boolean;
}

export function PartChooser({
  open,
  track,
  knownDurationMs = 0,
  spanMs = SOUND_BASE_MS,
  initialStartMs = 0,
  initialEndMs = 0,
  onApply,
  onClose,
  contained = false,
}: PartChooserProps) {
  const { toast } = useToast();
  const { player, start, stop, handOver } = useSoundPreview();
  const requestRef = useRef(0);
  const dragRef = useRef<"start" | "end" | "head" | "window" | null>(null);
  const dragOffsetRef = useRef(0);
  const stripRef = useRef<HTMLDivElement>(null);
  const waveRef = useRef<HTMLDivElement>(null);
  /** The pill the part-length menu hangs off — it is measured, not positioned. */
  const windowButtonRef = useRef<HTMLButtonElement>(null);

  const [durationMs, setDurationMs] = useState(0);
  const [startMs, setStartMs] = useState(0);
  const [endMs, setEndMs] = useState(0);
  const [windowMs, setWindowMs] = useState(spanMs);
  const [windowOpen, setWindowOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const title = (track?.title ?? "").trim() || "Audio";

  /**
   * Open on the file's own length and the caller's own part.
   *
   * Keyed on `track` rather than on `open`, because a chooser reopening on the
   * same sound — the way back from a row that already has a window — must not
   * reset the window it was just handed; and a chooser reopening on a *new*
   * sound must, or the second song opens on the first one's part.
   */
  useEffect(() => {
    if (!open || !track) return;
    const request = ++requestRef.current;
    const seconds =
      track.seconds && track.seconds > 0 ? Math.round(track.seconds * 1000) : 0;
    const known = Math.max(0, knownDurationMs || seconds);
    const hasWindow = initialEndMs > initialStartMs;
    const part = hasWindow
      ? Math.min(initialEndMs - initialStartMs, known || Infinity)
      : Math.min(spanMs, known || spanMs);

    setDurationMs(known);
    setLoading(known === 0);
    setWindowOpen(false);
    dragRef.current = null;
    setWindowMs(part);
    setStartMs(hasWindow ? Math.max(0, initialStartMs) : 0);
    setEndMs(hasWindow ? Math.max(0, initialEndMs) : part);
    start(track);

    // Nobody has said how long it is: the bytes come down and it is measured.
    if (known > 0) return;
    void (async () => {
      try {
        const file = await fetchAudioFile(track);
        const measured = await readAudioDuration(file);
        if (request !== requestRef.current) return;
        const next = Math.min(spanMs, measured);
        setDurationMs(measured);
        setWindowMs(next);
        setStartMs(0);
        setEndMs(next);
      } catch (cause) {
        if (request !== requestRef.current) return;
        // Refused rather than guessed at: see the header. The sheet goes, and
        // the sentence is the only thing that makes it a bug report.
        stop();
        onClose();
        toast({
          title: "That audio has no length to read.",
          description: errorMessage(cause),
          tone: "error",
        });
      } finally {
        if (request === requestRef.current) setLoading(false);
      }
    })();
    // `start` and `stop` are stable per player; the window props are read once
    // on purpose, so a caller re-rendering does not restart the sheet.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, track, knownDurationMs, spanMs, initialStartMs, initialEndMs]);

  /**
   * A sheet closed by its caller rather than by its own button — the editor's
   * `exitTool`, a route change, the page going away — gives the ear back too.
   * Without this the audition would outlive the sheet it belongs to and go on
   * playing under a screen with no way to stop it.
   */
  useEffect(() => {
    if (open) return;
    stop();
  }, [open, stop]);

  // The strip follows the playhead, and follows the window while it is being
  // dragged — a part dragged off the visible minute would otherwise be a part
  // nobody can see they are choosing.
  const limitMs = Math.max(1, durationMs);
  const startPct = (startMs / limitMs) * 100;
  const endPct = (endMs / limitMs) * 100;
  const playing =
    Boolean(track) && player.current?.id === track?.id && player.playing;
  const headMs =
    track && player.current?.id === track.id
      ? Math.min(Math.max(player.time * 1000, 0), durationMs)
      : startMs;
  const headPct = Math.min(Math.max((headMs / limitMs) * 100, 0), 100);

  useEffect(() => {
    if (!open || !track) return;
    const scroller = stripRef.current;
    const wave = waveRef.current;
    if (!scroller || !wave) return;
    const viewport = scroller.getBoundingClientRect();
    const bars = wave.getBoundingClientRect();
    const focusPct =
      dragRef.current === "window"
        ? (startPct + endPct) / 2
        : !player.playing
          ? startPct
          : headPct;
    const focusX = bars.left - viewport.left + (focusPct / 100) * bars.width;
    const edge = 44;
    if (focusX < edge) {
      scroller.scrollLeft = Math.max(0, scroller.scrollLeft + focusX - edge);
    } else if (focusX > viewport.width - edge) {
      scroller.scrollLeft += focusX - (viewport.width - edge);
    }
  }, [player.playing, endPct, headPct, open, startPct, track]);

  const durationSec = durationMs / 1000;
  const trackWidth = Math.max(320, durationSec * 5);
  const seed = Number(track?.seed ?? track?.id ?? 1) || 1;
  const barCount = Math.max(72, Math.min(1600, Math.ceil(trackWidth / 2.5)));
  /**
   * The bars themselves.
   *
   * Drawn from the sound's own number, not from its samples: this client does
   * not decode audio to draw a strip, and a shape that pretended to be the
   * waveform would be a picture of data nobody read. It is deterministic, so
   * the same sound draws the same strip every time it is opened — which is what
   * makes it usable as a ruler even though it is an ornament.
   */
  const wave = Array.from({ length: barCount }, (_, index) => {
    const position = index / Math.max(1, barCount - 1);
    const envelope = Math.pow(Math.sin(Math.PI * position), 0.35);
    const pulse =
      0.5 + 0.5 * Math.abs(Math.sin((index + 1) * 0.71 + seed * 0.37));
    const detail = 0.3 + 0.7 * Math.abs(Math.sin((index + 1) * 0.23 + seed));
    return 18 + envelope * (0.38 + 0.62 * pulse) * detail * 74;
  });
  const labelStepSec = durationSec > 300 ? 30 : 10;
  const labels = (() => {
    if (!durationSec) return [0];
    const values: number[] = [];
    for (let second = 0; second <= durationSec; second += labelStepSec) {
      values.push(second);
    }
    const end = Math.round(durationSec);
    if (values[values.length - 1] < end) values.push(end);
    return values;
  })();

  function close() {
    requestRef.current += 1;
    setWindowOpen(false);
    stop();
    onClose();
  }

  function pointerMs(event: React.PointerEvent<HTMLElement>) {
    const rect =
      waveRef.current?.getBoundingClientRect() ??
      stripRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const ratio = (event.clientX - rect.left) / Math.max(1, rect.width);
    return Math.min(Math.max(ratio, 0), 1) * durationMs;
  }

  function update(which: "start" | "end" | "head", value: number) {
    const limit = Math.max(0, durationMs);
    const minGap = Math.min(1000, limit);
    if (which === "head") {
      player.seek(Math.min(Math.max(value, startMs), endMs || limit) / 1000);
      return;
    }
    if (which === "start") {
      const nextStart = Math.min(Math.max(value, 0), Math.max(0, limit - windowMs));
      setStartMs(nextStart);
      setEndMs(Math.min(limit, nextStart + windowMs));
      return;
    }
    setEndMs(
      Math.min(
        Math.max(value, Math.min(limit, startMs + minGap)),
        Math.min(limit, startMs + windowMs),
      ),
    );
  }

  function beginDrag(
    which: "start" | "end" | "head" | "window",
    event: React.PointerEvent<HTMLElement>,
  ) {
    if (!durationMs) return;
    event.preventDefault();
    event.stopPropagation();
    dragRef.current = which;
    if (which === "window") {
      dragOffsetRef.current = pointerMs(event) - startMs;
    } else {
      update(which, pointerMs(event));
    }
    stripRef.current?.setPointerCapture?.(event.pointerId);
  }

  function moveDrag(event: React.PointerEvent<HTMLElement>) {
    const which = dragRef.current;
    if (!which) return;
    if (which === "window") {
      const limit = Math.max(0, durationMs);
      const length = Math.min(
        Math.max(1000, endMs - startMs || windowMs),
        limit,
      );
      const nextStart = Math.min(
        Math.max(pointerMs(event) - dragOffsetRef.current, 0),
        Math.max(0, limit - length),
      );
      setStartMs(nextStart);
      setEndMs(Math.min(limit, nextStart + length));
      return;
    }
    update(which, pointerMs(event));
  }

  function endDrag() {
    dragRef.current = null;
  }

  function chooseWindow(next: number) {
    const limit = Math.max(0, durationMs);
    const nextStart = Math.min(Math.max(startMs, 0), Math.max(0, limit - next));
    setStartMs(nextStart);
    setWindowMs(next);
    setEndMs(Math.min(limit, nextStart + next));
    setWindowOpen(false);
  }

  function use() {
    if (!track || !durationMs) return;
    // Handed over rather than stopped: what plays from here is the part that
    // was just chosen, from its own beginning, and how it is closed later is
    // the caller's business.
    handOver();
    if (player.current?.id !== track.id) player.play(track, [track]);
    else if (!player.playing) player.toggle();
    player.seek(startMs / 1000);
    onApply({ startMs, endMs });
  }

  if (!open) return null;

  return (
    <>
      <div
        className={cn(
          "inset-0 z-[85] flex items-end bg-black/45",
          contained ? "absolute" : "fixed",
        )}
        onClick={close}
      >
        <section
          role="dialog"
          aria-modal="true"
          aria-label="Choose a part"
          className="flex max-h-[86%] w-full flex-col overflow-y-auto overscroll-contain rounded-t-[28px] bg-card pb-[max(14px,env(safe-area-inset-bottom))] text-ink shadow-2xl"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-center justify-between px-5 pb-3 pt-2">
            <h2 className="text-[19px] font-black tracking-tight">
              Choose a part
            </h2>
            <button
              type="button"
              onClick={close}
              className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-dim hover:bg-surface-3"
              aria-label="Close choose a part"
            >
              <X className="size-5" />
            </button>
          </div>
          <div className="mx-5 flex items-center gap-3 rounded-lg border border-line bg-surface-3 px-2 py-1.5">
            <AudioArt track={track} className="size-[54px] shrink-0 rounded-lg" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-md font-black leading-tight">{title}</p>
              <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-semibold text-dim">
                <User className="size-3 shrink-0" />
                {track?.artist || "Your audio"}
              </p>
              <p className="text-[10px] font-semibold text-dim">
                {audioClock(durationSec)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                if (!track) return;
                if (player.current?.id === track.id && player.playing)
                  player.toggle();
                else start(track);
              }}
              className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-chip text-accent"
              aria-label={playing ? "Pause audio" : "Play audio"}
            >
              {playing ? (
                <Pause className="size-5 fill-current" />
              ) : (
                <Play className="size-5 fill-current pl-0.5" />
              )}
            </button>
          </div>
          <div className="mt-2 px-5">
            <div
              ref={stripRef}
              className="relative h-[80px] touch-none select-none overflow-x-auto overflow-y-hidden rounded-lg border border-line bg-surface-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              onPointerDown={(event) => beginDrag("head", event)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              onWheel={(event) => {
                if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
                  event.currentTarget.scrollLeft += event.deltaY;
                }
              }}
            >
              <div
                className="relative h-full"
                style={{ width: `${trackWidth}px`, minWidth: "100%" }}
              >
                <div
                  ref={waveRef}
                  className="absolute inset-x-4 bottom-3.5 top-0 flex items-end gap-[1px]"
                >
                  {wave.map((height, index) => {
                    const position = ((index + 0.5) / wave.length) * 100;
                    const active = position >= startPct && position <= endPct;
                    return (
                      <span
                        key={index}
                        className={cn(
                          "min-w-0 flex-1 rounded-full",
                          active ? "bg-accent" : "bg-line",
                        )}
                        style={{
                          height: `${height}%`,
                          transformOrigin: "bottom",
                          willChange:
                            playing && active ? "transform" : undefined,
                          animation:
                            playing && active
                              ? `trim-wave-bounce ${620 + (index % 7) * 90}ms ease-in-out ${(index % 11) * 45}ms infinite alternate`
                              : undefined,
                        }}
                      />
                    );
                  })}
                </div>
                {durationMs ? (
                  <>
                    <div className="pointer-events-none absolute inset-x-4 bottom-3.5 top-3">
                      <button
                        type="button"
                        onPointerDown={(event) => beginDrag("window", event)}
                        className="pointer-events-auto absolute inset-y-0 cursor-grab touch-none rounded-[5px] border-y-[2px] border-x-[4px] border-accent active:cursor-grabbing"
                        style={{
                          left: `${startPct}%`,
                          right: `${100 - endPct}%`,
                        }}
                        aria-label="Move selected audio part"
                      />
                    </div>
                    <div className="pointer-events-none absolute inset-x-4 bottom-[14px] h-[2px] rounded-full bg-[color-mix(in_srgb,var(--accent)_20%,transparent)]">
                      <div
                        className="absolute inset-y-0 rounded-full bg-accent"
                        style={{
                          left: `${startPct}%`,
                          right: `${100 - endPct}%`,
                        }}
                      />
                    </div>
                  </>
                ) : null}
                {durationMs ? (
                  <div className="pointer-events-none absolute inset-x-4 bottom-3.5 top-4">
                    <div
                      className="absolute inset-y-0 z-20 w-[2px] -translate-x-1/2 rounded-full bg-[var(--ink)] shadow-[0_0_6px_rgba(0,0,0,.3)] transition-[left] duration-150 ease-linear"
                      style={{ left: `${headPct}%` }}
                    >
                      <span className="absolute -top-1.5 left-1/2 -translate-x-1/2 rounded-full bg-[var(--ink)]" />
                    </div>
                  </div>
                ) : null}
                <div className="pointer-events-none absolute inset-x-4 bottom-0 h-4 text-[9px] font-semibold text-dim">
                  {labels.map((second) => {
                    const pct = (second * 1000 * 100) / limitMs;
                    return (
                      <span
                        key={second}
                        className="absolute bottom-0 flex flex-col items-center gap-1"
                        style={{
                          left: `${pct}%`,
                          transform:
                            pct <= 0
                              ? "translateX(0)"
                              : pct >= 100
                                ? "translateX(-100%)"
                                : "translateX(-50%)",
                        }}
                      >
                        <span className="h-1 w-px bg-line" />
                        {audioClock(second)}
                      </span>
                    );
                  })}
                </div>
                {loading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[color-mix(in_srgb,var(--card)_80%,transparent)] backdrop-blur-[2px]">
                    <Spinner className="size-5 text-accent" />
                    <span className="text-[10px] font-bold text-dim">
                      Reading audio...
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2 px-5">
            {/* The two times, and nothing else — the phone draws this as a
                plain pill and not as a control, because the one control on
                this line is the length beside it. */}
            <div className="flex h-10 flex-1 items-center justify-center rounded-full bg-accent-chip px-4 text-[13px] font-black text-accent">
              {audioClock(startMs / 1000)} – {audioClock(endMs / 1000)}
            </div>
            <button
              ref={windowButtonRef}
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setWindowOpen(true);
              }}
              onPointerDown={(event) => event.stopPropagation()}
              aria-haspopup="menu"
              aria-expanded={windowOpen}
              className="flex h-10 shrink-0 items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--accent)_30%,var(--line))] bg-card px-4 text-[13px] font-black text-accent"
              aria-label="Audio part length"
            >
              {windowMs / 1000} s
              <ChevronDown className="size-4" />
            </button>
            <button
              type="button"
              onClick={use}
              disabled={loading || !durationMs}
              className="h-10 shrink-0 rounded-full bg-accent px-6 text-[14px] font-black text-on-accent disabled:opacity-40"
            >
              Use
            </button>
          </div>
        </section>
      </div>

      {windowOpen ? (
        <PartLengthMenu
          anchor={windowButtonRef.current}
          value={windowMs}
          onPick={chooseWindow}
          onClose={() => setWindowOpen(false)}
        />
      ) : null}
    </>
  );
}
