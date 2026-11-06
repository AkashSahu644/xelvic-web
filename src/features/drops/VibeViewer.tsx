import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bookmark,
  ChartColumn,
  ChevronUp,
  Heart,
  Hourglass,
  MessageCircle,
  Music2,
  Pause,
  Play,
  RotateCcw,
  Send,
  EllipsisVertical,
  SkipForward,
  Video,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { AuthedImage, AuthedVideo } from "@/components/media/Media";
import { VerifiedTick } from "@/components/icons/Tick";
import { dropsService } from "@/services/drops.service";
import { cn } from "@/utils/cn";
import { count } from "@/utils/format";
import { usePreferences } from "@/hooks/usePreferences";
import { useSaved } from "@/hooks/useSaved";
import { savedKindOf } from "@/store/saved";

import type { Drop } from "@/types/api";
import { CommentsModal } from "./CommentsModal";
import { DropMenu } from "./DropMenu";
import { EditDrop } from "./EditDrop";
import { KeepButton } from "./KeepButton";
import { ShareSheet } from "./ShareSheet";
import { StatsSheet } from "./StatsSheet";
import { dropBase, reportDropLook } from "./model";
import { reportVibeLook, reportVibesShown } from "./reco";
import { useVibeEnd, type VibeEnd } from "@/hooks/useVibeEnd";
import { lockScroll } from "@/utils/scrollLock";

/**
 * Vibes: clips walked one at a time, filling the screen.
 *
 * Ported from `VibesScreen` in `screens/vibes.dart`. A swipe up is the next one
 * and a swipe down the last, which is the whole of the navigation — there is no
 * list and no grid, because a Vibe is watched rather than chosen. The shelf on
 * the Drops page is where one is *chosen*, and what it opens is this, turned so
 * that the one that was tapped is the first page and the rest of the shelf
 * below it.
 *
 * **Only one clip plays.** Every slide holds its own player and every player is
 * paused with the clip wound back to the beginning except the one in view; a
 * screen that left a dozen of them running would be a dozen decoders and a
 * machine that gets hot holding a list nobody is watching. Winding back is not
 * tidiness either — coming back to a clip that is already half-way through is
 * coming back to something somebody has not seen.
 *
 * **Nothing is drawn behind the controls.** The app had a flat scrim across the
 * top and took it away on 2026-10-14: a grey wash across the top inch of
 * somebody's clip to make three white icons legible is furniture over a
 * photograph. So the icons and the words carry their own shadow and the clip is
 * the screen. See `_float` at the top of `vibes.dart`.
 */

/** The shadow under every white glyph and every line of white type over a clip. */
const FLOAT = "[text-shadow:0_0_6px_rgba(0,0,0,0.4)]";

/** The rates the panel offers, slowest first — `kRates`. */
const RATES = [0.5, 1, 1.5, 2];

/** What a finger held on the fast pad asks the clip for — `_fastRate`. */
const FAST = 2;

export function VibeViewer({
  vibes,
  index,
  onIndex,
  onClose,
  onRecord,
  onNeedMore,
}: {
  vibes: Drop[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
  /** The bar's camera — a caller that can open the composer passes one. */
  onRecord?: () => void;
  /** A thumb nearing the end of the hand it was dealt — `Drops.vibeBatch`. */
  onNeedMore?: () => void;
}) {
  const scroller = useRef<HTMLDivElement | null>(null);
  const [at, setAt] = useState(index);
  const [muted, setMuted] = useState(true);
  // The menu and the two sheets it can open, hoisted out of the slides: they
  // are about the clip in front, and a sheet drawn inside a snapped slide would
  // scroll away with it.
  const [menuOpen, setMenuOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  // Which clip has its player panel open, if any. Held by the walk rather than
  // by the slide for what it does to the walk: a panel over a clip is a thumb
  // off the list, and the list has to stop answering swipes while it is up — a
  // drag that moved the page under an open scrubber would take the thing being
  // scrubbed away mid-gesture. See `_playerFor` in `vibes.dart`.
  const [playerFor, setPlayerFor] = useState<string | null>(null);
  // The one answer for the whole app, remembered across visits.
  const [ends, setEnds] = useVibeEnd();
  // The one-off line telling a first reader that the walk answers a swipe. It
  // says what the screen does once, for somebody who has not seen one of these
  // before, and then gets out of the way — `_hint`/`_hintGone`.
  const [hint, setHint] = useState(true);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const current = vibes[at];

  // The page the walk is on, kept in step with the scroll rather than with the
  // prop alone: the prop says where it was *opened*, the scroll says where it
  // has been turned to since.
  useEffect(() => {
    setAt(index);
    pageAt.current = index;
  }, [index]);

  // Open on the slide that was tapped, not on the first one.
  useEffect(() => {
    const node = scroller.current;
    if (!node) return;
    node.scrollTo({ top: index * node.clientHeight, behavior: "auto" });
    // Only on the way in: a later change of `index` is the scroll's own doing
    // arriving back round, and scrolling to it again would fight the thumb.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The invite to swipe goes after a moment, and it never comes back: it is an
  // instruction and not a label.
  useEffect(() => {
    const timer = window.setTimeout(() => setHint(false), 2600);
    return () => window.clearTimeout(timer);
  }, []);

  // What the shelf drew is a signal of its own — `Reco.served(vibes,
  // surface: 'vibes')` — because "impressions" counts times drawn rather than
  // times watched, and a clip swiped past still reached somebody. Sent once
  // for the hand the walk opened on, as the app sends it once per page it is
  // handed.
  const served = useRef(false);
  useEffect(() => {
    if (served.current) return;
    served.current = true;
    reportVibesShown(vibes);
  }, [vibes]);

  // Four pages ahead of the thumb is where the next hand is asked for; the app
  // keeps a batch ahead and the walk is not supposed to run out.
  useEffect(() => {
    if (at + 5 >= vibes.length) onNeedMore?.();
  }, [at, vibes.length, onNeedMore]);

  const settle = useRef<number | null>(null);
  // The page the walk was last seen on, so a rest that landed on the page it
  // was already on is not a turn: the scroll announces every stop, including
  // the one the list was opened on.
  const pageAt = useRef(index);
  const turned = useCallback(() => {
    const node = scroller.current;
    if (!node) return;
    const page = Math.max(0, Math.min(vibes.length - 1, Math.round(node.scrollTop / node.clientHeight)));
    setAt(page);
    if (pageAt.current === page) return;
    pageAt.current = page;
    onIndex(page);
    // A turn is somebody who already knows how the walk answers, and a panel
    // belongs to the clip it was opened on.
    setHint(false);
    setPlayerFor(null);
  }, [vibes.length, onIndex]);

  /** Turn to the clip after this one, and answer whether there was one. */
  const nextPage = useCallback(() => {
    const node = scroller.current;
    if (!node || at + 1 >= vibes.length) return false;
    node.scrollTo({ top: (at + 1) * node.clientHeight, behavior: "smooth" });
    return true;
  }, [at, vibes.length]);

  useEffect(() => {
    // Counted, and this is one of the two effects that made counting necessary:
    // it re-runs as the walk moves and as the panels open, and each re-run used
    // to write back the value it had read before whatever opened meanwhile.
    const releaseScroll = lockScroll();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        // A player put down first: the panel is the thing on top of the walk,
        // and closing the whole screen from under it would be one answer to
        // two different questions.
        if (playerFor) {
          setPlayerFor(null);
          return;
        }
        onClose();
        return;
      }
      // The panel has the arrow keys' meaning while it is up: a drag across the
      // page under an open scrubber is the gesture the panel exists to refuse.
      if (playerFor) return;
      const node = scroller.current;
      if (!node) return;
      if (event.key === "ArrowDown" || event.key === "ArrowRight") {
        event.preventDefault();
        node.scrollTo({ top: (at + 1) * node.clientHeight, behavior: "smooth" });
      }
      if (event.key === "ArrowUp" || event.key === "ArrowLeft") {
        event.preventDefault();
        node.scrollTo({ top: Math.max(0, at - 1) * node.clientHeight, behavior: "smooth" });
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      releaseScroll();
    };
  }, [at, onClose, playerFor]);

  return createPortal(
    // `h-[100dvh]` rather than `inset-0`: a fixed box with all four edges pinned
    // resolves against the *layout* viewport, which on a phone is the tall one —
    // so with a browser bar on screen the strip along the bottom (the caption,
    // the comment rail, the clip's own player panel) sat underneath it, and the
    // page's scroll is locked while the walk is up, so nothing could bring them
    // back. The children are `h-full`, so they follow this height.
    <div
      className="fixed inset-x-0 top-0 z-[95] h-[100dvh] bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Vibes"
    >
      {/* A phone-shaped stage rather than controls pinned to the edges of a
          desktop window. The clip is a portrait screen and the bar, rail and
          caption belong to it; on a wide display they were spread across two
          empty black wings with the video stranded in the middle. On a phone
          this is simply the screen. */}
      <div className="relative mx-auto h-full w-full max-w-[480px] overflow-hidden">
      {/* The bar floats over every page rather than sitting in the column: the
          clips are the screen and the controls are drawn on the one in front. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-center gap-1 px-2 pb-2.5 pt-[calc(env(safe-area-inset-top,0px)_+_6px)]">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={cn("pointer-events-auto flex size-12 items-center justify-center rounded-full text-white transition hover:bg-white/10", FLOAT)}
        >
          <X className="size-6" strokeWidth={2.2} aria-hidden />
        </button>
        <span className="flex-1" />
        {/* One menu for everything that is *about* the clip in front of you,
            rather than something done *to* it — the same sheet a card in the
            feed opens, because a Vibe *is* a drop as far as that menu is
            concerned and the server agrees: `Vibe` carries the drop's own
            `comments_off` and `likes_off` for exactly this reason. */}
        <TopButton
          label="More"
          onClick={() => setMenuOpen(true)}
          disabled={!current}
        >
          <EllipsisVertical className="size-6" aria-hidden />
        </TopButton>
        <TopButton label="Your studio" onClick={() => navigate("/app/drops/vibes/studio")}>
          <ChartColumn className="size-6" aria-hidden />
        </TopButton>
        {onRecord ? (
          <TopButton label="New Vibe" onClick={onRecord}>
            <Video className="size-6" aria-hidden />
          </TopButton>
        ) : null}
      </div>

      <div
        ref={scroller}
        onScroll={() => {
          // A frame's rest is what decides the page, not every pixel of the
          // journey: a debounce is the browser's answer to `settle` on a scroll
          // whose end it does not announce.
          if (settle.current) window.clearTimeout(settle.current);
          settle.current = window.setTimeout(turned, 90);
        }}
        // A panel over a clip stops the walk answering swipes. `overflow-hidden`
        // rather than a second scroll listener: the browser refuses the gesture
        // before a single pixel of it is read.
        className={cn(
          "no-scrollbar h-full snap-y snap-mandatory overscroll-contain",
          playerFor ? "overflow-hidden" : "overflow-y-auto",
        )}
      >
        {vibes.map((vibe, page) => (
          <Slide
            key={String(vibe.id)}
            vibe={vibe}
            active={page === at}
            // Only the clip in front and its two neighbours are asked for.
            // The first version mounted a player for every clip in the hand —
            // thirty downloads and thirty decoders for a walk that starts on
            // one — which is why opening Vibes took as long as it did.
            near={Math.abs(page - at) <= 1}
            muted={muted}
            onToggleMute={() => setMuted((value) => !value)}
            playerOpen={playerFor === String(vibe.id)}
            onPlayer={(open) => setPlayerFor(open ? String(vibe.id) : null)}
            ends={ends}
            onEnds={setEnds}
            onNext={nextPage}
            showHint={hint && page === at && page < vibes.length - 1}
          />
        ))}
      </div>
      </div>

      {/* The menu and the two sheets it can open belong to the *walk* rather
          than to a page: the clip in front is the one they are about, and a
          sheet drawn inside a snapped slide would scroll away with it. */}
      {current ? (
        <>
          <DropMenu
            drop={current}
            open={menuOpen}
            onClose={() => setMenuOpen(false)}
            onStats={() => setStatsOpen(true)}
            onEdit={() => setEditOpen(true)}
            onChanged={() => void queryClient.invalidateQueries({ queryKey: ["drops"] })}
          />
          <StatsSheet drop={current} open={statsOpen} onClose={() => setStatsOpen(false)} />
          <EditDrop
            drop={current}
            open={editOpen}
            onClose={() => setEditOpen(false)}
            onSaved={() => void queryClient.invalidateQueries({ queryKey: ["drops"] })}
          />
        </>
      ) : null}
    </div>,
    document.body,
  );
}

/** One icon in the bar over the clip. */
function TopButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        "pointer-events-auto flex size-12 items-center justify-center rounded-full text-white transition hover:bg-white/10 disabled:pointer-events-none disabled:opacity-40",
        FLOAT,
      )}
    >
      {children}
    </button>
  );
}

/** One clip, filling the screen, with everything said about it over the frame. */
function Slide({
  vibe: incoming,
  active,
  near,
  muted,
  onToggleMute,
  playerOpen,
  onPlayer,
  ends,
  onEnds,
  onNext,
  showHint,
}: {
  vibe: Drop;
  active: boolean;
  /** Whether this slide is close enough to the thumb to hold a player. */
  near: boolean;
  muted: boolean;
  onToggleMute: () => void;
  playerOpen: boolean;
  onPlayer: (open: boolean) => void;
  ends: VibeEnd;
  onEnds: (end: VibeEnd) => void;
  onNext: () => boolean;
  showHint: boolean;
}) {
  const { t } = usePreferences();
  const { has, toggle: toggleSaved } = useSaved();
  const [vibe, setVibe] = useState(incoming);
  const [liked, setLiked] = useState(Boolean(incoming.liked));
  const [likes, setLikes] = useState(incoming.likes ?? 0);
  const [comments, setComments] = useState(incoming.comments ?? 0);
  const [shares, setShares] = useState(incoming.shares ?? 0);
  const [paused, setPaused] = useState(false);
  const [atMs, setAtMs] = useState(0);
  const [total, setTotal] = useState(0);
  const [boom, setBoom] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [draft, setDraft] = useState<string | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  // The panel's own clip speed, and a finger borrowed on the fast pad. Two
  // numbers and not one: the hold gives the clip back its chosen rate when it
  // lifts, and a hold on a clip already at 1.5× is 2× rather than 3×. See
  // `_rate`, `_fast` and `_fastRate` in `vibes.dart`.
  const [rate, setRate] = useState(1);
  const [fast, setFast] = useState(false);
  // A thumb on the scrubber holds the clip where it is; letting go seeks.
  const [held, setHeld] = useState(false);
  const [scrub, setScrub] = useState<number | null>(null);
  // How tall the strip at the foot drew itself, so the swipe hint can clear it.
  const [stripHeight, setStripHeight] = useState(0);

  const video = useRef<HTMLVideoElement | null>(null);
  const strip = useRef<HTMLDivElement | null>(null);
  const tap = useRef<number | null>(null);
  const long = useRef<number | null>(null);
  const longFired = useRef(false);
  const seen = useRef(false);

  // The account this look keeps of itself, read from the player rather than
  // from anything the screen guessed: the app's `_deepest`, `_visibleMs`,
  // `_pausedMs`, `_rewinds` and `_ended`. Every one of them is handed over
  // once, when the look ends. See `_report` in `vibes.dart` and `reco.ts`.
  const look = useRef({
    visible: 0,
    running: 0,
    pausedFor: 0,
    pausedRunning: 0,
    deepest: 0,
    rewinds: 0,
    ended: false,
    reported: true,
    autoplay: true,
  });
  // The clip's length as the player last reported it, in milliseconds, kept in
  // a ref as well as in state: the look is reported from a callback that ran
  // long before the length was known.
  const duration = useRef(0);
  // The row this look is about. A ref because the look is reported on the way
  // out, when the prop that was rendered may already have moved on.
  const row = useRef(incoming);

  function startVisible() {
    if (document.hidden || look.current.running) return;
    look.current.running = performance.now();
  }

  function stopVisible() {
    const state = look.current;
    if (!state.running) return;
    state.visible += performance.now() - state.running;
    state.running = 0;
  }

  /**
   * Hand this look over, once.
   *
   * Called from both ends of a look — the walk turning to another page, and the
   * whole screen being left — because those are two different ways of stopping
   * watching and only one of them passes through the page's own effect. The
   * app's `_report` answers the same two calls, and the guard is the same: a
   * clip the swiper comes back to is a second look and is reported again on
   * purpose, but no single look can report twice.
   */
  function reportLook(swiped: boolean) {
    const state = look.current;
    if (state.reported) return;
    state.reported = true;
    stopVisible();
    if (state.pausedRunning) {
      state.pausedFor += performance.now() - state.pausedRunning;
      state.pausedRunning = 0;
    }
    const played = Math.round(state.deepest);
    const length = duration.current;
    reportVibeLook(row.current, {
      ms: played,
      pct: length > 0 ? played / length : 0,
      completed: state.ended,
      visibleMs: Math.round(state.visible),
      durationMs: length > 0 ? length : null,
      // A swipe is a claim, and the two ways a look ends are not one: a clip
      // that reached its end and carried the walk on is not a quick swipe, and
      // leaving the screen never swiped at all.
      toSwipeMs: swiped && !state.ended ? Math.round(state.visible) : null,
      rewinds: state.rewinds,
      pausedMs: Math.round(state.pausedFor),
      autoplay: state.autoplay,
    });
  }

  // Keep the copy in step with what a sheet handed back.
  useEffect(() => {
    row.current = incoming;
    setVibe(incoming);
    setLiked(Boolean(incoming.liked));
    setLikes(incoming.likes ?? 0);
    setComments(incoming.comments ?? 0);
    setShares(incoming.shares ?? 0);
  }, [incoming]);

  /**
   * What a page does as it arrives and as it leaves.
   *
   * Arriving, the clip plays and one look is counted; leaving, it is paused and
   * wound back so the next arrival is the clip from the beginning. The look is
   * counted once per opening — a thumb that scrolled past and back has not
   * watched it twice — and never on my own clip, which is the app's rule and
   * the server's.
   */
  useEffect(() => {
    const element = video.current;
    if (!active) {
      // The look is over before the clip is wound back: what gets reported is
      // how far it got, and a rewind first would be the app counting its own
      // tidying up as the end of somebody's watching.
      reportLook(true);
      if (element) {
        element.pause();
        element.currentTime = 0;
      }
      setPaused(false);
      setAtMs(0);
      setTotal(0);
      // A hold that was never released — the walk turned under it — must not
      // leave the next clip at double speed.
      setFast(false);
      setHeld(false);
      setScrub(null);
      return;
    }
    // A fresh look at a clip starts its own account of itself — the app's
    // `_wake`. A clip the swiper comes back to is watched again, so its count
    // starts again too, and the guard in `reportLook` keeps the previous look
    // from being handed over a second time.
    look.current = {
      visible: 0,
      running: 0,
      pausedFor: 0,
      pausedRunning: 0,
      deepest: 0,
      rewinds: 0,
      ended: false,
      reported: false,
      autoplay: true,
    };
    startVisible();
    setPaused(false);
    if (element) void element.play().catch(() => setPaused(true));
    if (!seen.current && !vibe.mine) {
      seen.current = true;
      void reportDropLook(vibe);
    }
    // The look's helpers read refs and nothing else, so there is nothing in
    // them for this effect to depend on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, vibe]);

  // How long the look has spent with the clip stopped by hand — the app's
  // `_pausedMs`. Read from the player rather than from `paused` alone, because
  // a browser that stops a clip on its own has stopped it just as much.
  useEffect(() => {
    const state = look.current;
    if (paused) {
      if (!state.pausedRunning) state.pausedRunning = performance.now();
      return;
    }
    // Back from a pause: the time it held is no longer part of the watching.
    if (state.pausedRunning) {
      state.pausedFor += performance.now() - state.pausedRunning;
      state.pausedRunning = 0;
    }
  }, [paused]);

  // A tab put away is a clip stopped, and the app counts it as stopped rather
  // than as watched: `visible_ms` is time on screen. Coming back resumes the
  // look, not the clip — a clip the person had paused by hand stays paused.
  useEffect(() => {
    if (!active) return;
    const hidden = () => {
      stopVisible();
      video.current?.pause();
    };
    const shown = () => {
      startVisible();
      if (!video.current?.paused) return;
      if (paused) return;
      void video.current?.play().catch(() => setPaused(true));
    };
    const onVisibility = () => (document.hidden ? hidden() : shown());
    document.addEventListener("visibilitychange", onVisibility);
    if (document.hidden) hidden();
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [active, paused]);

  // Leaving the screen without swiping: the page is unmounted, so this is the
  // only place the look gets its chance to be handed over. The cleanup runs
  // with the state of that render's refs, which is the look's own.
  useEffect(() => {
    return () => reportLook(false);
    // The guard inside `reportLook` makes a second call harmless, so the one
    // way out that does pass through the page's effect is not reported twice.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A thumb on the scrubber holds the clip where it is; letting go hands it
  // back. The seek itself happens on release and not on every frame of the
  // drag: a video asked to decode from the nearest keyframe sixty times a second
  // answers none of them and shows nothing at all.
  useEffect(() => {
    const element = video.current;
    if (!element) return;
    if (held) {
      element.pause();
      return;
    }
    if (active && !paused) void element.play().catch(() => setPaused(true));
  }, [held, active, paused, near]);

  // The rate the clip is running at: the panel's choice, unless a finger is on
  // the fast pad. The same reading is re-applied on every tick in
  // `onTimeUpdate`, because a player that mounts after the first frame is not
  // there when this effect runs. `near` is a dependency for the same reason:
  // a slide swiped towards mounts its player after this has already run once.
  useEffect(() => {
    const element = video.current;
    if (element) element.playbackRate = fast ? FAST : rate;
  }, [fast, rate, active, near]);

  // How tall the strip drew itself. The hint is drawn above the strip and not
  // at a number picked off a screen, because a hint over the suggestion a
  // reader is about to press is a hint in the way of the thing it is inviting.
  useEffect(() => {
    const node = strip.current;
    if (!node) return;
    const read = () => setStripHeight(node.offsetHeight);
    read();
    if (typeof ResizeObserver === "undefined") return;
    const watcher = new ResizeObserver(read);
    watcher.observe(node);
    return () => watcher.disconnect();
  }, []);

  const saved = has(savedKindOf(vibe), vibe.id);

  async function feel(on: boolean) {
    setLiked(on);
    setLikes((value) => Math.max(0, value + (on ? 1 : -1)));
    try {
      const answer = await dropsService.like(dropBase(vibe), vibe.id, on);
      setLiked(answer.liked);
      setLikes(answer.likes);
    } catch {
      // Put back rather than left saying something the server did not agree
      // to: a heart that moved without a row behind it is a lie about the room.
      setLiked(!on);
      setLikes((value) => Math.max(0, value + (on ? -1 : 1)));
    }
  }

  /**
   * A tap pauses or plays; a tap on an open panel puts it away and lets the
   * clip carry on; two taps feel it. One finger, three answers.
   *
   * The first tap of a double tap still waits, and it has to: a tap that acted
   * instantly is a tap that has already decided there was no second one.
   */
  function onTap() {
    if (tap.current) window.clearTimeout(tap.current);
    tap.current = window.setTimeout(() => {
      tap.current = null;
      if (playerOpen) {
        // Away, not paused: a player put down is a clip still being watched.
        onPlayer(false);
        return;
      }
      const element = video.current;
      if (!element) return;
      if (element.paused) {
        void element.play().catch(() => undefined);
        setPaused(false);
      } else {
        element.pause();
        setPaused(true);
      }
    }, 220);
  }

  function onDouble() {
    if (tap.current) {
      window.clearTimeout(tap.current);
      tap.current = null;
    }
    if (longFired.current) return;
    if (!liked) void feel(true);
    setBoom(true);
    window.setTimeout(() => setBoom(false), 620);
  }

  /**
   * The way into the player, which is a hold and only a hold.
   *
   * The app tried a tap as a door and took it back out: a single tap is pause
   * and resume, and a player that appeared on one is a screen that opened
   * itself while somebody was watching. A finger that stays put is somebody who
   * wants to *do* something to the clip rather than watch it, and the thing
   * worth doing is getting at the scrubber and the rate under it. Once it is
   * open a hold still closes it, so the gesture that opened it can put it away.
   */
  function startPress() {
    longFired.current = false;
    if (long.current) window.clearTimeout(long.current);
    long.current = window.setTimeout(() => {
      long.current = null;
      longFired.current = true;
      onPlayer(!playerOpen);
    }, 500);
  }

  function endPress() {
    if (long.current) {
      window.clearTimeout(long.current);
      long.current = null;
    }
  }

  function say(line: string | null) {
    setDraft(line);
    setCommentsOpen(true);
  }

  /** The panel's play/pause. A thumb on the scrubber counts as "not playing". */
  function togglePlay() {
    const playing = !(paused || held);
    if (held) setHeld(false);
    setPaused(playing);
  }

  /** The thumb let go: go where it was put, and give the clip back. */
  function letGo(at: number) {
    const element = video.current;
    setHeld(false);
    setScrub(null);
    if (!element) return;
    const to = Math.max(0, Math.min(total, at)) / 1000;
    // A deliberate backward seek is a rewind, and the app counts them because a
    // clip somebody wound back is a clip that held them. A clip looping is not
    // one: its own end is not a seek.
    if (to < element.currentTime - 0.25) look.current.rewinds += 1;
    try {
      element.currentTime = to;
    } catch {
      // A clip the browser will not seek is a clip left where it was.
    }
    if (active && !paused) void element.play().catch(() => undefined);
  }

  const handle = vibe.author.username;
  const prompts = useMemo(() => vibePrompts(vibe), [vibe]);
  const through = total > 0 ? Math.min(1, atMs / total) : 0;
  const shown = Math.min(total, scrub ?? atMs);

  return (
    <section
      className="relative h-full w-full snap-start snap-always overflow-hidden bg-black"
      aria-label={`${vibe.author.name || handle}'s Vibe`}
    >
      <div
        role="presentation"
        onClick={onTap}
        onDoubleClick={onDouble}
        onPointerDown={startPress}
        onPointerUp={endPress}
        onPointerCancel={endPress}
        onPointerLeave={endPress}
        className="absolute inset-0"
      >
        {near ? (
          <AuthedVideo
            src={vibe.asset?.content_url}
            autoPlay={false}
            loop={ends === "replay"}
            muted={muted}
            playsInline
            videoRef={video}
            onTimeUpdate={() => {
              const element = video.current;
              if (!element) return;
              // The rate is re-applied here as well as when it is chosen: a
              // player that mounts after the first frame was not there when the
              // choice was made.
              const want = fast ? FAST : rate;
              if (element.playbackRate !== want) element.playbackRate = want;
              if (element.duration && Number.isFinite(element.duration)) {
                const running = element.duration * 1000;
                setTotal(running);
                setAtMs(Math.min(running, element.currentTime * 1000));
                // What the look reports: the length as the player gave it, and
                // how far into the clip this look has actually been. The furthest
                // point and not the current one — a clip replayed from the start
                // was still watched to the end. The app's `_deepest`.
                duration.current = Math.round(running);
                look.current.deepest = Math.max(look.current.deepest, element.currentTime * 1000);
              }
            }}
            onEnded={() => {
              // Reaching the end is a fact about the look whether or not the
              // walk goes on from it, and the studio counts it: a clip run to its
              // last frame is not a clip swiped away early.
              look.current.ended = true;
              // A clip that runs out is either carried on or run again, and the
              // walk's end has no next — but it does not stop there either: a
              // player held on its last frame is indistinguishable from a player
              // that has hung. See `_finished` in `vibes.dart`.
              if (ends === "replay") return;
              if (onNext()) return;
              const element = video.current;
              if (!element) return;
              element.currentTime = 0;
              void element.play().catch(() => undefined);
            }}
            className="h-full w-full object-contain"
          />
        ) : (
          // Two screens away in the walk: the clip's own still, and nothing
          // downloading behind it. The player is mounted when the thumb gets
          // within one page, which is when it would be watched.
          <AuthedImage
            src={vibe.asset?.thumbnail_url ?? null}
            alt=""
            className="h-full w-full object-contain"
            quiet
          />
        )}
      </div>

      {/* The one thing on this page that moves while a clip plays, and white on
          white rather than in a theme's colour: the picture under it is
          somebody's and it is free to be any colour at all. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-[2px] bg-white/22">
        <div
          className="h-full bg-white transition-[width] duration-150 ease-linear"
          style={{ width: `${through * 100}%` }}
        />
      </div>

      {paused && !playerOpen ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <span className="flex size-16 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur-sm">
            <svg viewBox="0 0 24 24" className="size-7 fill-current" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </span>
      ) : null}

      {/* The heart a double tap leaves behind: one white glyph that grows past
          its size, settles and fades, and leaves nothing behind. */}
      {boom ? (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <Heart className={cn("size-28 fill-white text-white opacity-0 motion-safe:animate-[vibeBoom_620ms_ease-out]", FLOAT)} />
        </span>
      ) : null}

      {/* The rail: the column of buttons pressed about a clip somebody likes.
          It lifts over the player panel while one is open, because the panel is
          a slab over the foot and the rail is not a thing it is covering. */}
      <div
        className={cn(
          "absolute end-2 z-10 flex flex-col items-end gap-4 transition-[bottom]",
          playerOpen ? "bottom-[176px]" : "bottom-[116px]",
        )}
      >
        {/* The fast pad: the empty room above the Felt button, held to run at
            2×. The owner's words, 2026-10-24: *"vibe me like ya (felt) button
            uske upar jo area khali hai waha hold press jab tak rakho 2x video
            chalne lage ... chhod doge normal play ho jayegi"*. Raw pointer
            events rather than a click: what is wanted is the speed the moment
            the finger lands and the old speed the moment it lifts. */}
        <div
          role="presentation"
          aria-label="Hold to play at double speed"
          onPointerDown={(event) => {
            // Claimed so a thumb that slides off still reports its lift, and
            // so the slide's tap and hold are not also reading this pointer.
            event.currentTarget.setPointerCapture?.(event.pointerId);
            setFast(true);
          }}
          onPointerUp={() => setFast(false)}
          onPointerCancel={() => setFast(false)}
          onPointerLeave={() => setFast(false)}
          className="flex h-[96px] w-[76px] cursor-pointer touch-none select-none items-center justify-center"
        >
          {/* Built only while it is true rather than left at zero opacity: a
              faded-out label is still a label to a screen reader. */}
          {fast ? (
            <span className={cn("text-[13px] font-extrabold text-white", FLOAT)}>2×</span>
          ) : null}
        </div>
        <Rail
          label={t("Felt")}
          count={vibe.likes_off ? null : count(likes)}
          on={liked}
          onClick={() => void feel(!liked)}
          glyph={
            <Heart
              className={cn("size-[30px]", liked ? "fill-accent text-accent" : "text-white")}
              strokeWidth={2}
              aria-hidden
            />
          }
        />
        <Rail
          label={t("Comments")}
          count={count(comments)}
          onClick={() => say(null)}
          glyph={<MessageCircle className="size-[28px] text-white" strokeWidth={2} aria-hidden />}
        />
        <Rail
          label={t("Share")}
          count={count(shares)}
          onClick={() => setShareOpen(true)}
          glyph={<Send className="size-[27px] text-white" strokeWidth={2} aria-hidden />}
        />
        {/* The one glyph on this rail with no number under it, because a save is
            nobody else's business: it is not counted and nobody is told. */}
        <Rail
          label={saved ? t("Saved") : t("Save")}
          on={saved}
          onClick={() => void toggleSaved(savedKindOf(vibe), vibe.id)}
          glyph={
            <Bookmark
              className={cn("size-[27px]", saved ? "fill-white text-white" : "text-white")}
              strokeWidth={2}
              aria-hidden
            />
          }
        />
        <Rail
          label={muted ? t("Unmute") : t("Mute")}
          onClick={onToggleMute}
          glyph={
            muted ? (
              <VolumeX className="size-[27px] text-white" strokeWidth={2} aria-hidden />
            ) : (
              <Volume2 className="size-[27px] text-white" strokeWidth={2} aria-hidden />
            )
          }
        />
      </div>

      {/* Who made it, what it says, and what it was made to. */}
      <div className="absolute inset-x-0 bottom-0 z-10">
        <div className={cn("ps-3.5 pe-[76px]", FLOAT)}>
          <div className="flex items-center gap-2.5">
            <Avatar user={vibe.author} size={36} />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1">
                <span className="truncate text-[14px] font-extrabold">@{handle}</span>
                {vibe.author.verified ? <VerifiedTick size={14} /> : null}
              </span>
            </span>
            {!vibe.mine && vibe.author_kept === false ? <KeepButton author={vibe.author} known /> : null}
          </div>

          {vibe.collab?.people?.length ? (
            <p className="mt-1.5 truncate text-[12px] font-semibold text-white/90">
              with {vibe.collab.people.map((person) => person.name || person.username).join(", ")}
            </p>
          ) : null}

          {/* Three lines of caption until it is asked for the rest. A caption
              over a clip has to be short — the picture is the thing — but the
              poster wrote the rest of it, so the rest is one tap away rather
              than thrown away. */}
          {vibe.body?.trim() ? (
            <div className="mt-2.5">
              <p
                className={cn(
                  "whitespace-pre-wrap break-words text-[13.5px] leading-[1.4] text-white",
                  !expanded && "line-clamp-3",
                )}
                onClick={() => setExpanded((value) => !value)}
              >
                {vibe.body}
              </p>
              {vibe.body.length > 120 ? (
                <button
                  type="button"
                  onClick={() => setExpanded((value) => !value)}
                  className="mt-1 text-[12.5px] font-bold text-white"
                >
                  {expanded ? "Show less" : "Read more"}
                </button>
              ) : null}
            </div>
          ) : null}

          {vibe.mentions?.length ? (
            <p className="mt-2 flex flex-wrap gap-x-2.5 text-[12.5px] font-bold text-white">
              {vibe.mentions.map((person) => (
                <span key={person.id}>@{person.username}</span>
              ))}
            </p>
          ) : null}

          {vibe.music ? (
            <p className="mt-2 flex items-center gap-1.5 truncate text-[12.5px] text-white/88">
              <Music2 className="size-3.5 shrink-0" aria-hidden />
              <span className="truncate">{vibe.music}</span>
            </p>
          ) : null}
        </div>

        {/* The strip at the foot: a door that wears a field's clothes, and the
            two lines a clip suggests somebody might say. */}
        <div ref={strip} className="px-3.5 pb-[calc(env(safe-area-inset-bottom,0px)_+_10px)] pt-2.5">
          <button
            type="button"
            onClick={() => say(null)}
            className="flex h-11 w-full items-center gap-2.5 rounded-full bg-white/14 px-4 text-start text-white transition hover:bg-white/20"
          >
            <MessageCircle className="size-[17px] shrink-0" strokeWidth={2} aria-hidden />
            <span className="text-[14px]">{t("Add comment...")}</span>
          </button>
          {prompts.length ? (
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {prompts.map((line) => (
                <button
                  key={line}
                  type="button"
                  onClick={() => say(line)}
                  className="h-[30px] max-w-full truncate text-[12.5px] font-semibold text-white"
                  title={line}
                >
                  {line}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      </div>

      {/* The one-off line telling a first reader that the walk answers a swipe.
          Above the strip rather than at a number picked off a screen, because a
          hint drawn over the suggestion a reader is about to press is a hint in
          the way of the thing it is inviting them to do. It floats over the
          clip's own foot and goes after a moment, which is all it ever was. */}
      {showHint ? (
        <div
          className="pointer-events-none absolute inset-x-0 z-20 flex flex-col items-center"
          style={{ bottom: stripHeight + 12 }}
        >
          <ChevronUp className="size-[22px] text-white" strokeWidth={2.2} aria-hidden />
          <span className="mt-0.5 text-[12px] font-semibold text-white/86">
            {t("Swipe for the next")}
          </span>
        </div>
      ) : null}

      {/* The player panel: a slab over the foot of the screen, which is what it
          has always done to the name and the caption. It is the stack's last
          child because it is the last thing drawn, and the rail lifts to clear
          it rather than being covered by it. */}
      {playerOpen ? (
        <div
          className="absolute inset-x-0 bottom-0 z-30 rounded-t-[20px] px-3.5 pb-[calc(env(safe-area-inset-bottom,0px)_+_12px)] pt-2.5 text-white"
          style={{ backgroundColor: "rgba(19,19,26,0.94)" }}
        >
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={paused || held ? "Play" : "Pause"}
              title={paused || held ? "Play" : "Pause"}
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10"
            >
              {paused || held ? (
                <Play className="size-7" fill="currentColor" aria-hidden />
              ) : (
                <Pause className="size-7" fill="currentColor" aria-hidden />
              )}
            </button>
            {/* Tabular figures, so the clock either side of the scrubber does
                not jiggle sideways as the seconds tick over. */}
            <span className="num w-9 shrink-0 text-[12px] font-bold">{clock(shown)}</span>
            <input
              type="range"
              min={0}
              max={Math.max(1, total)}
              step={1}
              value={shown}
              aria-label="Seek"
              onPointerDown={() => {
                setHeld(true);
                setScrub(atMs);
              }}
              onChange={(event) => setScrub(Number(event.target.value))}
              onPointerUp={(event) => letGo(Number(event.currentTarget.value))}
              onPointerCancel={(event) => letGo(Number(event.currentTarget.value))}
              onKeyUp={(event) => letGo(Number(event.currentTarget.value))}
              className="h-1 min-w-0 flex-1 cursor-pointer accent-white"
            />
            <span className="num w-9 shrink-0 text-end text-[12px] font-bold">{clock(total)}</span>
          </div>

          <div className="mt-1.5 flex items-center gap-1.5">
            {/* Speed as four chips rather than a slider: there are four rates
                anybody asks a clip for, and a continuous control between them
                would be a dial for 0.97×. */}
            {RATES.map((value) => {
              const on = rate === value;
              return (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRate(value)}
                  aria-pressed={on}
                  aria-label={`${rateLabel(value)} speed`}
                  className={cn(
                    "rounded-[20px] px-3 py-1.5 text-[12.5px] font-extrabold transition",
                    on ? "bg-white text-[#13131a]" : "bg-white/14 text-white hover:bg-white/22",
                  )}
                >
                  {rateLabel(value)}
                </button>
              );
            })}
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => onPlayer(false)}
              className="rounded-full px-2.5 py-1.5 text-[13.5px] font-extrabold text-white transition hover:bg-white/10"
            >
              Done
            </button>
          </div>

          {/* The one setting the reel has, on the panel rather than behind the
              ⋮: the ⋮ is the feed's own menu and this is not a thing to do to a
              clip. The words for the two are not lost by the switch to glyphs —
              they are the line under the control, which changes as the choice
              does. */}
          <div className="mt-2.5">
            <div className="flex items-center gap-2">
              <Hourglass className="size-[18px] shrink-0 text-white" aria-hidden />
              <span className="text-[13px] font-semibold text-white/90">When it ends</span>
              <span className="flex-1" />
              <div className="flex overflow-hidden rounded-[10px] border border-white/22 bg-white/10">
                <EndChoice
                  end="next"
                  icon={<SkipForward className="size-[18px]" aria-hidden />}
                  on={ends === "next"}
                  onChoose={() => onEnds("next")}
                />
                <EndChoice
                  end="replay"
                  icon={<RotateCcw className="size-[18px]" aria-hidden />}
                  on={ends === "replay"}
                  onChoose={() => onEnds("replay")}
                />
              </div>
            </div>
            <p className="mt-0.5 text-[12px] text-white/62">
              {ends === "next" ? "The next Vibe plays" : "This Vibe plays again"}
            </p>
          </div>
        </div>
      ) : null}

      <CommentsModal
        drop={vibe}
        open={commentsOpen}
        draft={draft}
        onClose={() => setCommentsOpen(false)}
        onCommented={() => setComments((value) => value + 1)}
      />
      <ShareSheet
        drop={vibe}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onShared={(sent) => setShares((value) => value + sent)}
      />
    </section>
  );
}

/** One half of "When it ends": a glyph, and whether it is the answer. */
function EndChoice({
  end,
  icon,
  on,
  onChoose,
}: {
  end: VibeEnd;
  icon: React.ReactNode;
  on: boolean;
  onChoose: () => void;
}) {
  const label = end === "next" ? "Next" : "Replay";
  return (
    <button
      type="button"
      onClick={onChoose}
      aria-label={label}
      title={label}
      aria-pressed={on}
      className={cn(
        "flex h-[34px] w-[46px] items-center justify-center transition",
        on ? "bg-accent text-on-accent" : "text-white/72 hover:bg-white/10",
      )}
    >
      {icon}
    </button>
  );
}

/** A position, as a clock reads it. Minutes and seconds, and an hour is not a clip. */
function clock(ms: number): string {
  const seconds = Math.floor(Math.max(0, ms) / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** A rate as the chips write it: `0.5×`, `1×`, `1.5×`, `2×`. */
function rateLabel(rate: number): string {
  return `${rate}×`;
}

/** One button on the rail: a glyph, its number, and the room a thumb needs. */
function Rail({
  label,
  count: number,
  glyph,
  on,
  onClick,
}: {
  label: string;
  count?: string | null;
  glyph: React.ReactNode;
  on?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      aria-pressed={on}
      className={cn(
        "flex w-[46px] flex-col items-center gap-1 text-white drop-shadow-[0_0_6px_rgba(0,0,0,0.4)] transition active:scale-95",
      )}
    >
      {glyph}
      {number ? <span className="num text-[12px] font-extrabold">{number}</span> : null}
    </button>
  );
}

/**
 * A few things worth saying about [vibe], and nothing that is not true of it.
 *
 * Ported verbatim from `vibe_prompts.dart`, and read off the clip's own post —
 * the caption its poster wrote, whether there is a track under it, whether
 * anybody has responded, whether anybody else is on it — and off nothing else.
 * **Nothing here looks at the picture.** A suggestion that said "love the jump
 * at the end" over a clip nobody has watched would be the app inventing a fact
 * about somebody's video, which is the one thing this screen may not do.
 *
 * They are drafts, not comments: pressing one opens the composer with the line
 * already in it and sends nothing.
 */
function vibePrompts(vibe: Drop): string[] {
  const said = (vibe.body ?? "").trim();
  const particular: string[] = [];
  if (said) particular.push("That caption says it all.");
  if (said.endsWith("?")) particular.push("I was going to ask the same thing.");
  if (vibe.music) particular.push("What is this track?");
  if (vibe.comments === 0) particular.push("First one here.");
  if ((vibe.comments ?? 0) >= 25) particular.push("Everyone is right about this.");
  if (vibe.collab) particular.push("Both of you — more of this.");

  const open = ["Where was this shot?", "How long did this take?"];

  const out: string[] = [];
  if (particular.length) {
    // A stable start taken from the Vibe's own id, so one clip's two lines are
    // not the next clip's two and the same clip offers the same two every time.
    const start = stable(vibe.id) % particular.length;
    for (let step = 0; step < particular.length && out.length < 2; step += 1) {
      out.push(particular[(start + step) % particular.length]);
    }
  }
  for (const line of open) {
    if (out.length >= 2) break;
    out.push(line);
  }
  return out;
}

/** A number for a string that is the same in every run — `_stable`. */
function stable(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) & 0x7fffffff;
  }
  return hash;
}