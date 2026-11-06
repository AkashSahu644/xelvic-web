import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  Crop,
  FlipHorizontal2,
  GripVertical,
  Grid3x3,
  Maximize2,
  Mic,
  MicOff,
  Minimize,
  Minimize2,
  MonitorOff,
  MonitorUp,
  Phone,
  PhoneOff,
  PictureInPicture2,
  Settings2,
  Square,
  SwitchCamera,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Spinner } from "@/components/ui/Button";
import { AudioSurface, VideoSurface } from "@/features/media/surfaces";
import { useCall } from "@/hooks/useCall";
import { useToast } from "@/hooks/useToast";
import type { CallQuality } from "./quality";
import { qualityLine } from "./quality";
import { askCallNotices, callNoticesAllowed, callNoticesSupported } from "./notice";
import { errorMessage } from "@/utils/errors";
import { duration } from "@/utils/format";
import { cn } from "@/utils/cn";
import type { CallSeat } from "@/services/calls.service";
import {
  callTitle,
  otherSeats,
  personName,
  ringLine,
  seatIsHere,
  sourceChanged,
} from "./model";
import { clampSpot, dockEdge, homeSpot, type Spot } from "./minibar";

/**
 * The call screen.
 *
 * Full screen on purpose, and above everything else: a call somebody has
 * picked up is the thing they are doing now, whatever page they were on when
 * it arrived. It draws the phone's own phases — dialling, ringing, live and the
 * goodbye for a moment — and the same buttons, because the two apps are the
 * same account talking to the same people.
 *
 * Two things about the picture are worth knowing before reading on, because
 * they are what the layout is built around.
 *
 *   * **A picture is never cropped unless somebody asks for it.** A phone
 *     films 9:16 and a laptop 16:9, and a grid that fills both into equal
 *     rectangles cuts a face out of one of them. So the default is *fit* —
 *     `object-contain`, the whole picture with bars — and *fill* is a switch
 *     somebody turns on deliberately.
 *   * **One picture is the stage, the rest are thumbnails.** A call of three
 *     or four fits in a grid; a call between a laptop and a phone does not,
 *     because the two frames share no shape. The largest end gets the screen
 *     and the others get a rail that swaps which one that is.
 *
 * Nothing here is simulated. The clock only runs once the server has said the
 * call is up, the name comes from the server's own party frame, the quality
 * line comes from the browser's own `getStats()`, and a call that could not be
 * answered is put back down with the reason on screen rather than a green tick.
 */

/**
 * How far a press has to travel before it is a drag.
 *
 * A press that becomes a move on its first pixel makes every button inside the
 * small window unreliable — a finger lands with a few pixels of drift and the
 * tap becomes a shove. Six is under the smallest thing worth dragging and over
 * the drift of a deliberate press.
 */
const DRAG_SLOP = 6;

export function CallOverlay() {
  const call = useCall();
  const { toast } = useToast();
  const [now, setNow] = useState(() => Date.now());
  const [layout, setLayout] = useState<"spotlight" | "grid">("spotlight");
  const [fit, setFit] = useState<"fit" | "fill">("fit");
  const [focus, setFocus] = useState<string | null>(null);
  const [devicesOpen, setDevicesOpen] = useState(false);
  const [full, setFull] = useState(false);
  const [notices, setNotices] = useState(() => callNoticesAllowed());
  const [inPicture, setInPicture] = useState(false);
  const [minimized, setMinimized] = useState(false);
  /**
   * Where the small window has been dragged to, or `null` while it is still
   * drawn by its opening rule in the corner.
   *
   * Kept here and not in the engine for the phone's reason
   * (`call_window.dart`): where somebody parked a window is not a fact about
   * the call — it is sent nowhere, it is forgotten when the call ends, and
   * nothing else has an opinion about it.
   */
  const [miniSpot, setMiniSpot] = useState<Spot | null>(null);
  /** The edge the window was pushed into, or `null` while it floats. */
  const [dock, setDock] = useState<"left" | "right" | null>(null);
  /** The window's own size, measured once it is on the page. */
  const [miniSize, setMiniSize] = useState({ width: 0, height: 0 });
  /** The page's own size, so a rotation or a resized window re-places the bar. */
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === "undefined" ? 0 : window.innerWidth,
    height: typeof window === "undefined" ? 0 : window.innerHeight,
  }));
  const miniRef = useRef<HTMLDivElement>(null);
  /** The raw drag, before it is clamped for drawing — this is what docks. */
  const spotNow = useRef<Spot | null>(null);
  /** A press that is being held, and whether it has become a drag yet. */
  const dragFrom = useRef<{ x: number; y: number; spot: Spot } | null>(null);
  const dragMoved = useRef(false);
  /** A drag ends as a click in some browsers; that click is not a press. */
  const swallow = useRef(false);
  /** The far end's picture shape (height ÷ width), or 0 until the browser says. */
  const shapeSeen = useRef(0);
  const rootRef = useRef<HTMLDivElement>(null);
  /** The one picture on screen, for the corner-of-the-screen window. */
  const pictureRef = useRef<HTMLVideoElement | null>(null);
  const takePicture = useCallback((element: HTMLVideoElement | null) => {
    pictureRef.current = element;
  }, []);

  const live = call.phase === "live";

  // A call's view choices belong to that call. They used to live in this
  // component for as long as the tab did, so a "Fill" somebody chose once kept
  // cropping every call after it — and a shared screen drawn to fill a phone
  // held upright is only its middle, which is the owner's report of 2026-11-06.
  // The next call opens at the default the screen's own comment states.
  useEffect(() => {
    if (call.phase !== "idle" && call.phase !== "over") return;
    setFit("fit");
    setLayout("spotlight");
    setFocus(null);
    setMinimized(false);
    setMiniSpot(null);
    setDock(null);
    spotNow.current = null;
    shapeSeen.current = 0;
  }, [call.phase]);

  // A drag that was still in the air when the screen went away — a call that
  // ended, a page that was left — must not leave the page with its text
  // unselectable.
  useEffect(() => () => {
    document.body.style.userSelect = "";
  }, []);

  // A bar dragged to a corner is still inside the first screen it met unless
  // the page tells it otherwise: a rotation, a window being narrowed and a
  // keyboard opening all move the edge it was kept clear of.
  useEffect(() => {
    const measure = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });
    window.addEventListener("resize", measure);
    window.visualViewport?.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("resize", measure);
      window.visualViewport?.removeEventListener("resize", measure);
    };
  }, []);

  // The window's own size, for the clamp. Measured rather than assumed: the
  // bar is a row of things whose widths depend on the call — a video call
  // carries a picture and a camera button that an audio call does not.
  useEffect(() => {
    if (!minimized) return;
    const element = miniRef.current;
    if (!element) return;
    const measure = () => {
      const width = element.offsetWidth;
      const height = element.offsetHeight;
      setMiniSize((seen) =>
        seen.width === width && seen.height === height ? seen : { width, height },
      );
    };
    measure();
    const watcher = new ResizeObserver(measure);
    watcher.observe(element);
    return () => watcher.disconnect();
  }, [minimized, dock]);

  /**
   * The far end's picture changed shape.
   *
   * A camera does not change its own frame mid-call, so a picture that does is
   * the far end switching what it sends — a camera for a screen, or back. A
   * screen is wide and the stage is usually upright, so drawn to fill it shows
   * its middle alone. The picture therefore returns to "fit" — the whole
   * picture, letterboxed — the moment the far end's frame changes shape.
   */
  function remoteShapeChanged(tall: number) {
    const before = shapeSeen.current;
    shapeSeen.current = tall;
    if (sourceChanged(before, tall)) setFit("fit");
  }

  /**
   * A press on the small window, before it has become a drag.
   *
   * The bar is measured at the moment the press lands rather than read back
   * from `miniSpot`: until it has been moved it is placed by CSS, and its
   * rectangle is the only thing that knows where that is.
   */
  function startMiniDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    const element = miniRef.current;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    dragFrom.current = {
      x: event.clientX,
      y: event.clientY,
      spot: { left: rect.left, top: rect.top },
    };
    spotNow.current = { left: rect.left, top: rect.top };
    dragMoved.current = false;
    swallow.current = false;
  }

  function moveMiniDrag(event: React.PointerEvent<HTMLDivElement>) {
    const from = dragFrom.current;
    if (!from) return;
    const dx = event.clientX - from.x;
    const dy = event.clientY - from.y;
    if (!dragMoved.current) {
      // A few pixels of travel is how a press on the bar's own buttons stays a
      // press: a finger that never moves never becomes a drag.
      if (Math.hypot(dx, dy) < DRAG_SLOP) return;
      dragMoved.current = true;
      swallow.current = true;
      // A drag with a mouse otherwise drags a selection out of the page under
      // it, and a page with its text selected is a page somebody has to click
      // again before it works.
      document.body.style.userSelect = "none";
      // Captured, so the window keeps following the pointer after it leaves
      // its own rectangle — which happens almost immediately.
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    // Added to where the press began, not to where it is now: two pointer
    // moves can arrive inside one frame, and a delta added to a stale base
    // makes the window lag behind the finger.
    const spot = { left: from.spot.left + dx, top: from.spot.top + dy };
    spotNow.current = spot;
    setMiniSpot(spot);
  }

  function endMiniDrag(event: React.PointerEvent<HTMLDivElement>) {
    const from = dragFrom.current;
    dragFrom.current = null;
    document.body.style.userSelect = "";
    if (!from || !dragMoved.current) return;
    dragMoved.current = false;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    // The raw spot, not the drawn one: drawing is clamped, so a clamped spot
    // could never report a shove into an edge.
    const spot = spotNow.current;
    if (!spot) return;
    const edge = dockEdge(spot, miniSize, viewport);
    if (edge) setDock(edge);
  }

  /**
   * A drag is not a press on whatever it started over.
   *
   * A captured pointer ends its press on the bar rather than on the button it
   * began on, so the button usually never hears about it. This is for the
   * browser that still delivers the click: it is stopped here instead of
   * muting somebody's microphone because their finger slipped.
   */
  function keepDragFromPressing(event: React.MouseEvent<HTMLDivElement>) {
    if (!swallow.current) return;
    swallow.current = false;
    event.preventDefault();
    event.stopPropagation();
  }

  useEffect(() => {
    if (!live) return;
    setNow(Date.now());
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [live]);

  // The clock is on the tab's own title, so a call that is running can be seen
  // from the tab bar of every other window — the same reason the phone puts it
  // on the lock screen.
  const titleBefore = useRef<string | null>(null);
  useEffect(() => () => {
    if (titleBefore.current !== null) {
      document.title = titleBefore.current;
      titleBefore.current = null;
    }
  }, []);

  useEffect(() => {
    const onChange = () => setFull(document.fullscreenElement === rootRef.current);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  // Whether the picture is in the corner window is the browser's answer and not
  // this tab's: it can be closed from the window itself, and a label that said
  // "Leave picture in picture" after that would be a button that lies.
  useEffect(() => {
    const onEnter = () => setInPicture(true);
    const onLeave = () => setInPicture(false);
    document.addEventListener("enterpictureinpicture", onEnter);
    document.addEventListener("leavepictureinpicture", onLeave);
    return () => {
      document.removeEventListener("enterpictureinpicture", onEnter);
      document.removeEventListener("leavepictureinpicture", onLeave);
    };
  }, []);

  useEffect(() => {
    if (live) return;
    if (titleBefore.current === null) return;
    document.title = titleBefore.current;
    titleBefore.current = null;
  }, [live]);

  const seats = otherSeats(call.party, call.selfId).filter(seatIsHere);
  const others = seats.length ? seats : otherSeats(call.party, call.selfId);
  const lead = others[0] ?? null;
  const title = live
    ? callTitle(call.party, call.selfId, call.kind)
    : lead
      ? personName(lead)
      : "Calling...";
  const line = live
    ? duration(call.since === null ? 0 : (now - call.since) / 1000)
    : call.phase === "over"
      ? call.note
      : !lead
        ? "Calling..."
        : ringLine({
            phase: call.phase,
            seat: lead,
            kind: call.kind,
            answered: call.since !== null,
          });

  // The clock, on the tab's own title: a call that is running can be seen from
  // every other window's tab bar, which is the only place a browser has for the
  // phone's lock screen.
  useEffect(() => {
    if (!live) return;
    if (titleBefore.current === null) titleBefore.current = document.title;
    document.title = `${line} · ${title}`;
  }, [live, line, title]);

  if (call.phase === "idle") return null;

  const video = call.kind === "video";
  const selfStream = call.engine.selfStream();

  // A call somebody has put aside to read a message or look something up. The
  // phone has three sizes for a call — a page, a window and a small mark — and
  // this is the window: the picture if there is one, the clock, and the three
  // things somebody might need without coming back (the microphone, the camera
  // and the red button). Tapping it returns to the call.
  //
  // It moves. The phone's window can be dragged anywhere and pushed against an
  // edge, where it folds to a tab; this one follows the same rules through
  // `minibar.ts`, and it is the answer to "minimize karne par use drag aur drop
  // nahi kar pa raha hoon". A drag is read from pointer events on the bar
  // itself, and it only becomes a drag after six pixels of travel — anything
  // less is a press on one of the buttons inside it.
  //
  // The sound is carried by `<audio>` elements here rather than by the picture:
  // the full screen's `<video>` elements are gone while this is up, and a call
  // that went quiet because its screen was out of the way would be a call
  // somebody thinks has dropped. They are drawn beside the window rather than
  // inside it, so folding the window into an edge tab does not take the voice
  // with it.
  if (minimized) {
    const showing = others.find((seat) => seat.user === focus) ?? others[0] ?? null;
    const picture = showing
      ? call.engine.streamFor(showing.user)?.getVideoTracks().length
        ? call.engine.streamFor(showing.user)
        : null
      : null;
    const sound = others.map((seat) => (
      <AudioSurface key={seat.user} stream={call.engine.streamFor(seat.user)} />
    ));

    // Folded against an edge: one tab, at the height it was let go at, and a
    // press brings the window back. A press and not a drag, for the phone's own
    // reason (`call_window.dart`): a browser's and a device's back gesture both
    // own the strip along the edge, and a tab that had to be dragged out of it
    // would fight them for every pull.
    if (dock) {
      const leant = clampSpot(
        miniSpot ?? homeSpot(miniSize, viewport),
        { width: 28, height: 64 },
        viewport,
      );
      return (
        <>
          {sound}
          <button
            type="button"
            onClick={() => setDock(null)}
            aria-label="Back to the call"
            title="Back to the call"
            style={{ top: leant.top }}
            className={cn(
              "fixed z-[95] flex h-16 w-7 items-center justify-center bg-[#080b11]/95 text-white/70 shadow-2xl ring-1 ring-white/15 backdrop-blur transition hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
              dock === "left" ? "left-0 rounded-r-2xl" : "right-0 rounded-l-2xl",
            )}
          >
            {dock === "left" ? (
              <ChevronRight className="size-4" aria-hidden />
            ) : (
              <ChevronLeft className="size-4" aria-hidden />
            )}
          </button>
        </>
      );
    }

    // Drawn where it was dragged to, clamped so it can always be reached. Until
    // it has been moved it keeps its opening rule — the bottom right corner,
    // or the whole width of a phone — in the classes below.
    const placed = miniSpot ? clampSpot(miniSpot, miniSize, viewport) : null;
    return (
      <>
        {sound}
        <div
          ref={miniRef}
          role="group"
          aria-label="Call in progress"
          onPointerDown={startMiniDrag}
          onPointerMove={moveMiniDrag}
          onPointerUp={endMiniDrag}
          onPointerCancel={endMiniDrag}
          onClickCapture={keepDragFromPressing}
          style={placed ? { left: placed.left, top: placed.top } : undefined}
          className={cn(
            "fixed z-[95] flex max-w-[calc(100vw-1.5rem)] touch-none select-none items-center gap-1.5 rounded-2xl bg-[#080b11]/95 p-2 text-white shadow-2xl ring-1 ring-white/15 backdrop-blur sm:max-w-[440px]",
            placed
              ? "cursor-grab active:cursor-grabbing"
              : "inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] mx-auto sm:inset-x-auto sm:right-4",
          )}
        >
          <span
            className="grid h-9 w-4 shrink-0 place-items-center text-white/25"
            aria-hidden
            title="Drag to move"
          >
            <GripVertical className="size-4" />
          </span>
          <button
            type="button"
            onClick={() => setMinimized(false)}
            className="flex min-w-0 flex-1 items-center gap-2 rounded-xl p-1 text-left transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40"
            aria-label="Back to the call"
          >
            <span className="relative grid size-12 shrink-0 place-items-center overflow-hidden rounded-lg bg-white/10">
              {picture ? (
                <VideoSurface
                  stream={picture}
                  muted
                  mirror={call.remoteMirrored}
                  className="size-full object-cover"
                />
              ) : (
                <Phone className="size-5 text-white/70" aria-hidden />
              )}
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-bold">{title}</span>
              <span className="block truncate text-[11px] font-semibold tabular-nums text-white/60">
                {line}
              </span>
            </span>
          </button>
          <MiniButton
            label={call.muted ? "Unmute" : "Mute"}
            onClick={() => call.engine.toggleMute()}
          >
            {call.muted ? <MicOff className="size-5" aria-hidden /> : <Mic className="size-5" aria-hidden />}
          </MiniButton>
          {video ? (
            <MiniButton
              label={call.cameraOn ? "Turn camera off" : "Turn camera on"}
              onClick={() => call.engine.toggleCamera()}
            >
              {call.cameraOn ? <Video className="size-5" aria-hidden /> : <VideoOff className="size-5" aria-hidden />}
            </MiniButton>
          ) : null}
          <MiniButton label="Hang up" tone="red" onClick={() => void call.engine.hangUp()}>
            <PhoneOff className="size-5" aria-hidden />
          </MiniButton>
        </div>
      </>
    );
  }

  // Drawn once the server has said the call is up. Every other phase is the
  // hero below, because a ringing call has nothing to show but a face.
  const staged = live && video;
  const focused = others.find((seat) => seat.user === focus) ?? lead;
  const rail = others.filter((seat) => seat.user !== focused?.user);
  // One picture on screen and no more. In a grid of four there is no single
  // picture to lift into a corner window, and offering to lift one of them
  // would be offering something this screen cannot answer.
  const onePicture = others.length === 1 || layout === "spotlight";
  // Whether a picture is arriving at all — the Mirror pill turns over what the
  // other side is sending, so it is offered once there is something to turn
  // over. The engine publishes as tracks arrive, so this keeps up on its own.
  const arriving = others.some(
    (seat) => (call.engine.streamFor(seat.user)?.getVideoTracks().length ?? 0) > 0,
  );

  /** The browser's own corner window, for looking at something else meanwhile. */
  function togglePicture() {
    const element = pictureRef.current;
    if (document.pictureInPictureElement) {
      void document.exitPictureInPicture().catch(() => undefined);
      return;
    }
    if (!element || typeof element.requestPictureInPicture !== "function") return;
    void element.requestPictureInPicture().catch(() => {
      toast({
        title: "The picture would not come out of the page.",
        description: "This browser refused the corner window.",
        tone: "error",
      });
    });
  }

  function accept() {
    call.engine.pickUp().catch((error: unknown) => {
      toast({
        title: "That call could not be answered.",
        description: errorMessage(error),
        tone: "error",
      });
    });
  }

  async function askForNotices() {
    const answer = await askCallNotices();
    setNotices(answer === "granted");
    if (answer === "granted") {
      call.engine.refreshNotice();
      return;
    }
    if (answer === "blocked") {
      toast({
        title: "Call notifications are turned off for this site.",
        description: "Your browser will not ask again — the switch is in its site settings.",
        tone: "error",
      });
    }
  }

  function toggleFull() {
    if (document.fullscreenElement) {
      void document.exitFullscreen().catch(() => undefined);
      return;
    }
    void rootRef.current?.requestFullscreen?.().catch(() => undefined);
  }

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[95] flex flex-col bg-[#080b11] text-white"
      role="dialog"
      aria-modal="true"
      aria-label={live ? "Call" : "Calling"}
    >
      {staged ? (
        <div className="relative flex min-h-0 flex-1 flex-col">
          {/* Over the picture rather than above it: a bar that takes a strip of
              a phone's screen is a bar that takes a strip of the picture. */}
          <div className="pointer-events-none absolute inset-x-0 top-0 z-20 bg-gradient-to-b from-black/60 via-black/25 to-transparent px-4 pb-10 pt-3">
            <div className="pointer-events-auto flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate text-[15px] font-bold drop-shadow">
                  {title}
                </p>
                <p className="text-[12px] font-semibold tabular-nums text-white/70">
                  {line}
                </p>
              </div>
              <QualityPill quality={call.quality} />
            </div>
          </div>

          <div className="relative min-h-0 flex-1 overflow-hidden">
            {others.length === 0 ? (
              <div className="grid h-full place-items-center">
                <Spinner className="size-7 text-white/70" />
              </div>
            ) : layout === "grid" || others.length === 1 ? (
              <div
                className={cn(
                  "grid h-full w-full auto-rows-fr gap-1.5 p-1.5",
                  layout === "grid" && others.length > 1
                    ? others.length <= 4
                      ? "grid-cols-1 sm:grid-cols-2"
                      : "grid-cols-2 sm:grid-cols-3"
                    : "grid-cols-1",
                )}
              >
                {(layout === "grid" && others.length > 1 ? others : [focused]).map(
                  (seat) =>
                    seat ? (
                      <RemoteTile
                        key={seat.user}
                        seat={seat}
                        stream={call.engine.streamFor(seat.user)}
                        fit={fit}
                        featured
                        mirror={call.remoteMirrored}
                        onShape={remoteShapeChanged}
                        onElement={onePicture ? takePicture : undefined}
                      />
                    ) : null,
                )}
              </div>
            ) : (
              <>
                {focused ? (
                  <RemoteTile
                    seat={focused}
                    stream={call.engine.streamFor(focused.user)}
                    fit={fit}
                    featured
                    bare
                    mirror={call.remoteMirrored}
                    onShape={remoteShapeChanged}
                    onElement={takePicture}
                  />
                ) : null}
                {rail.length ? (
                  <div className="absolute left-2 top-14 z-10 flex max-h-[calc(100%-4.5rem)] flex-col gap-1.5 overflow-y-auto">
                    {rail.map((seat) => (
                      <button
                        key={seat.user}
                        type="button"
                        onClick={() => setFocus(seat.user)}
                        className="h-16 w-24 shrink-0 overflow-hidden rounded-xl border border-white/15 opacity-85 transition hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 sm:h-20 sm:w-32"
                        aria-label={`Show ${personName(seat)}`}
                      >
                        <RemoteTile
                          seat={seat}
                          stream={call.engine.streamFor(seat.user)}
                          fit="fill"
                          mirror={call.remoteMirrored}
                        />
                      </button>
                    ))}
                  </div>
                ) : null}
              </>
            )}

            {selfStream && (call.cameraOn || call.sharing) ? (
              <SelfView
                stream={selfStream}
                mirror={!call.sharing && call.mirrored}
                label={call.sharing ? "Your screen" : "You"}
              />
            ) : null}
          </div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-5 px-6 text-center">
          {others.length > 0 ? (
            <div className="flex items-center justify-center -space-x-4">
              {others.slice(0, 4).map((seat) => (
                <Avatar
                  key={seat.user}
                  user={seat}
                  size={others.length > 1 ? 60 : 96}
                  className={cn(
                    "ring-4 ring-[#080b11]",
                    call.phase !== "live" && "animate-pulse",
                  )}
                />
              ))}
            </div>
          ) : (
            <div className="grid size-24 place-items-center rounded-full bg-white/10">
              <Phone className="size-9 text-white/70" aria-hidden />
            </div>
          )}
          <div className="max-w-[420px]">
            <p className="text-[22px] font-extrabold tracking-[-0.3px]">
              {title}
            </p>
            <p
              className={cn(
                "mt-1 text-[13.5px] font-semibold",
                call.phase === "over"
                  ? "text-white/80"
                  : "text-white/60 tabular-nums",
              )}
            >
              {line}
            </p>
            <QualityPill quality={call.quality} quiet />
            {call.mediaError ? (
              <p className="mt-2 text-[12px] font-medium text-amber-300/90">
                {call.mediaError}
              </p>
            ) : null}
          </div>
          {/* The sound of everybody who is not this tab, in a call with no
              picture of its own. Drawn rather than heard: an `<audio>` with no
              controls is exactly the element media is supposed to play in. */}
          {others.map((seat) => (
            <AudioSurface
              key={seat.user}
              stream={call.engine.streamFor(seat.user)}
            />
          ))}
        </div>
      )}

      {/* A ring the browser refused is a call nobody heard. One tap starts it
          for real; the pill is only there because a sound was actually
          blocked, never as decoration. */}
      {call.ringBlocked ? (
        <button
          type="button"
          onClick={() => call.engine.allowRing()}
          className="mx-4 mb-2 flex items-center justify-center gap-2 rounded-2xl bg-amber-400/15 px-4 py-2.5 text-[12.5px] font-semibold text-amber-200 ring-1 ring-amber-300/30 transition hover:bg-amber-400/25"
        >
          <Bell className="size-4" aria-hidden />
          Your browser blocked the ring — tap to hear it
        </button>
      ) : null}

      {/* A ring that cannot be answered from the notification surface is a ring
          that only reaches a tab somebody is already looking at. Offered once,
          on the ring, and never asked for on its own. */}
      {call.phase === "ringing" && !notices && callNoticesSupported() ? (
        <button
          type="button"
          onClick={() => void askForNotices()}
          className="mx-4 mb-2 flex items-center justify-center gap-2 rounded-2xl bg-white/10 px-4 py-2.5 text-[12.5px] font-semibold text-white/85 ring-1 ring-white/15 transition hover:bg-white/15"
        >
          <Bell className="size-4" aria-hidden />
          Show calls as notifications so you can answer from anywhere
        </button>
      ) : null}

      {live && call.sharing ? (
        <p className="mx-4 mb-2 rounded-2xl bg-sky-400/15 px-4 py-2 text-center text-[12.5px] font-semibold text-sky-200 ring-1 ring-sky-300/25">
          You are sharing your screen
        </p>
      ) : null}

      {staged && call.mediaError ? (
        <p className="px-6 pb-2 text-center text-[12px] font-medium text-amber-300/90">
          {call.mediaError}
        </p>
      ) : null}

      {devicesOpen ? (
        <DevicePanel
          cameras={call.devices.cameras}
          mics={call.devices.mics}
          speakers={call.devices.speakers}
          cameraId={call.cameraId}
          micId={call.micId}
          speakerId={call.speakerId}
          onCamera={(id) =>
            void call.engine.useCamera(id).catch((error: unknown) => {
              toast({
                title: "That camera would not open.",
                description: errorMessage(error),
                tone: "error",
              });
            })
          }
          onMic={(id) =>
            void call.engine.useMicrophone(id).catch((error: unknown) => {
              toast({
                title: "That microphone would not open.",
                description: errorMessage(error),
                tone: "error",
              });
            })
          }
          onSpeaker={(id) => call.engine.useSpeaker(id)}
          onClose={() => setDevicesOpen(false)}
        />
      ) : null}

      <div className="shrink-0 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-2">
        {live ? (
          <div className="mb-3 flex flex-wrap items-center justify-center gap-1.5">
            {others.length > 1 ? (
              <Pill
                active={layout === "grid"}
                label={layout === "grid" ? "Grid" : "Spotlight"}
                icon={
                  layout === "grid" ? (
                    <Grid3x3 className="size-4" aria-hidden />
                  ) : (
                    <Square className="size-4" aria-hidden />
                  )
                }
                onClick={() =>
                  setLayout((one) => (one === "grid" ? "spotlight" : "grid"))
                }
              />
            ) : null}
            {video ? (
              <Pill
                active={fit === "fill"}
                label={fit === "fit" ? "Fit" : "Fill"}
                icon={<Crop className="size-4" aria-hidden />}
                onClick={() =>
                  setFit((one) => (one === "fit" ? "fill" : "fit"))
                }
              />
            ) : null}
            {typeof navigator !== "undefined" &&
            navigator.mediaDevices &&
            "getDisplayMedia" in navigator.mediaDevices ? (
              <Pill
                active={call.sharing}
                label={call.sharing ? "Stop sharing" : "Share screen"}
                icon={
                  call.sharing ? (
                    <MonitorOff className="size-4" aria-hidden />
                  ) : (
                    <MonitorUp className="size-4" aria-hidden />
                  )
                }
                onClick={() =>
                  call.sharing
                    ? call.engine.stopSharing()
                    : void call.engine.shareScreen()
                }
              />
            ) : null}
            {call.devices.cameras.length > 1 ? (
              <Pill
                label="Flip camera"
                icon={<SwitchCamera className="size-4" aria-hidden />}
                onClick={() => void call.engine.switchCamera()}
              />
            ) : null}
            {/* The mirror is about the pictures *arriving* here, not about this
                tab's own — so the pill waits until one has arrived, and stays
                whether or not this tab's own camera is on. */}
            {video && arriving ? (
              <Pill
                active={call.remoteMirrored}
                label="Mirror"
                icon={<FlipHorizontal2 className="size-4" aria-hidden />}
                onClick={() => call.engine.toggleRemoteMirror()}
              />
            ) : null}
            <Pill
              label="Devices"
              icon={<Settings2 className="size-4" aria-hidden />}
              onClick={() => {
                setDevicesOpen((open) => !open);
                void call.engine.listDevices();
              }}
            />
            {/* A call somebody wants to keep while they look at something else:
                the picture leaves the page into the browser's own corner
                window, and the call carries on. Offered only when there is one
                picture to move. */}
            {video &&
            onePicture &&
            typeof document !== "undefined" &&
            document.pictureInPictureEnabled ? (
              <Pill
                active={inPicture}
                label={inPicture ? "Leave picture" : "Picture in picture"}
                icon={<PictureInPicture2 className="size-4" aria-hidden />}
                onClick={togglePicture}
              />
            ) : null}
            {/* The call kept, the screen given back. The phone's three sizes
                are a page, a window and a small mark; this is the window, and
                tapping it returns to the page. Without it a call somebody left
                to read a message could not be come back to at all — the
                owner's report of 2026-11-06. */}
            <Pill
              label="Minimize"
              icon={<Minimize className="size-4" aria-hidden />}
              onClick={() => setMinimized(true)}
            />
            <Pill
              label={full ? "Exit full screen" : "Full screen"}
              icon={
                full ? (
                  <Minimize2 className="size-4" aria-hidden />
                ) : (
                  <Maximize2 className="size-4" aria-hidden />
                )
              }
              onClick={toggleFull}
            />
          </div>
        ) : null}

        {/* The buttons. The same three the phone has: the microphone, the camera
            — which on an audio call is the way into one — and the red one. */}
        <div className="flex items-center justify-center gap-4">
          {call.phase === "ringing" ? (
            <>
              <CallButton
                tone="red"
                label="Decline"
                onClick={() => void call.engine.turnDown()}
                icon={<PhoneOff className="size-6" aria-hidden />}
              />
              <CallButton
                tone="green"
                label="Accept"
                onClick={accept}
                icon={<Phone className="size-6" aria-hidden />}
              />
            </>
          ) : call.phase === "dialling" ? (
            <CallButton
              tone="red"
              label="Cancel"
              onClick={() => void call.engine.hangUp()}
              icon={<PhoneOff className="size-6" aria-hidden />}
            />
          ) : call.phase === "live" ? (
            <>
              <CallButton
                tone={call.muted ? "on" : "soft"}
                label={call.muted ? "Unmute" : "Mute"}
                onClick={() => call.engine.toggleMute()}
                icon={
                  call.muted ? (
                    <MicOff className="size-6" aria-hidden />
                  ) : (
                    <Mic className="size-6" aria-hidden />
                  )
                }
              />
              <CallButton
                tone="red"
                label="Hang up"
                onClick={() => void call.engine.hangUp()}
                icon={<PhoneOff className="size-6" aria-hidden />}
              />
              <CallButton
                tone={call.cameraOn ? "on" : "soft"}
                label={call.cameraOn ? "Turn camera off" : "Turn camera on"}
                onClick={() => call.engine.toggleCamera()}
                icon={
                  call.cameraOn ? (
                    <Video className="size-6" aria-hidden />
                  ) : (
                    <VideoOff className="size-6" aria-hidden />
                  )
                }
              />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** What the browser says about the link, and only when it is saying something. */
function QualityPill({
  quality,
  quiet,
}: {
  quality: CallQuality;
  quiet?: boolean;
}) {
  const line = qualityLine(quality);
  if (!line) return null;
  const weak = quality.level === "weak";
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold",
        quiet && "mt-2",
        weak
          ? "bg-amber-400/15 text-amber-200 ring-1 ring-amber-300/30"
          : "bg-white/10 text-white/75",
      )}
      title={
        quality.rttMs === null
          ? undefined
          : `${quality.rttMs} ms round trip${
              quality.lossPercent === null
                ? ""
                : ` · ${quality.lossPercent.toFixed(1)}% lost`
            }`
      }
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          weak ? "bg-amber-300" : "bg-emerald-400",
        )}
        aria-hidden
      />
      {line}
    </span>
  );
}

function Pill({
  label,
  icon,
  onClick,
  active,
}: {
  label: string;
  icon: ReactNode;
  onClick: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[12px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
        active
          ? "bg-white text-[#080b11]"
          : "bg-white/12 text-white/85 hover:bg-white/20",
      )}
    >
      {icon}
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}

/**
 * One round icon button, for the small window a call is kept in.
 *
 * The toolbar's `Pill` shows its word beside the glyph, which is right on the
 * call screen and too wide for a bar sitting over somebody's page. Here the
 * glyph is the whole control and the word is its name for a screen reader.
 */
function MiniButton({
  label,
  tone,
  onClick,
  children,
}: {
  label: string;
  tone?: "red";
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
        tone === "red"
          ? "bg-[#ef4444] text-white hover:bg-[#dc2626]"
          : "bg-white/12 text-white/85 hover:bg-white/20",
      )}
    >
      {children}
    </button>
  );
}

function CallButton({
  tone,
  label,
  icon,
  onClick,
}: {
  tone: "red" | "green" | "soft" | "on";
  label: string;
  icon: ReactNode;
  onClick: () => void;
}) {
  const colour =
    tone === "red"
      ? "#ef4444"
      : tone === "green"
        ? "#22c55e"
        : tone === "on"
          ? "#ffffff"
          : "rgba(255,255,255,0.14)";
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={cn(
        "grid size-14 place-items-center rounded-full transition duration-200 hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40",
        tone === "on" && "text-[#080b11]",
      )}
      style={{ backgroundColor: colour }}
    >
      {icon}
    </button>
  );
}

/**
 * One other person's picture.
 *
 * `bare` is the spotlight itself, which is already on the call screen's own
 * background — a card behind a picture that is trying to be the screen is a
 * card drawn for nothing.
 */
function RemoteTile({
  seat,
  stream,
  fit,
  featured,
  bare,
  mirror,
  onShape,
  onElement,
}: {
  seat: CallSeat;
  stream: MediaStream | null;
  fit: "fit" | "fill";
  featured?: boolean;
  bare?: boolean;
  /**
   * Whether this picture is drawn turned over — the Mirror pill, which is about
   * the pictures arriving here and not about this tab's own. The owner's report
   * of 2026-11-06: *"mirror par click karne par jo flip ho raha hai wo mere
   * video card me raha hai jabki reciever user video card me hona chahiye"*.
   */
  mirror?: boolean;
  /** This picture's own shape, once the browser knows it. See
   * `remoteShapeChanged`. */
  onShape?: (tall: number) => void;
  /** Handed the picture element, when this tile is the only picture. */
  onElement?: (element: HTMLVideoElement | null) => void;
}) {
  const picture = stream?.getVideoTracks().length ? stream : null;
  return (
    <div
      className={cn(
        "relative h-full min-h-0 w-full overflow-hidden",
        bare ? "absolute inset-0" : "rounded-2xl bg-[#11161f]",
      )}
    >
      {picture ? (
        <VideoSurface
          stream={picture}
          onElement={onElement}
          onShape={onShape}
          mirror={mirror}
          className={cn(
            "absolute inset-0 h-full w-full",
            fit === "fill" ? "object-cover" : "object-contain",
          )}
        />
      ) : (
        <div className="grid h-full w-full place-items-center">
          {stream ? (
            <Avatar user={seat} size={featured ? 96 : 48} />
          ) : (
            <Spinner className="size-5 text-white/45" />
          )}
        </div>
      )}
      {stream && !picture ? <AudioSurface stream={stream} /> : null}
      <span className="absolute bottom-2 left-2 max-w-[80%] truncate rounded-full bg-black/45 px-2.5 py-1 text-[11.5px] font-semibold text-white/90 backdrop-blur">
        {personName(seat)}
      </span>
    </div>
  );
}

/**
 * This tab's own camera, small and out of the way.
 *
 * `mirror` here is the lens's own answer and nothing to do with the Mirror
 * pill, which turns over the pictures arriving rather than this one: the phone
 * mirrors this tile and only this tile.
 *
 * Draggable and resizable because it has to be: a laptop propped on a desk and
 * a phone held in a hand put the two pictures in different places, and a small
 * view pinned to one corner sits on top of somebody's face on one of them. The
 * corner it starts in is the bottom right — the one a call app has always used
 * — and the drag and the grip move it from there.
 */
function SelfView({
  stream,
  mirror,
  label,
}: {
  stream: MediaStream;
  mirror: boolean;
  label: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [pos, setPos] = useState<{ x: number; y: number } | null>(null);
  const [aspect, setAspect] = useState(4 / 3);
  const drag = useRef<{
    mode: "move" | "size";
    atX: number;
    atY: number;
    fromX: number;
    fromY: number;
    fromWidth: number;
  } | null>(null);

  // Placed once the stage has a size, and put back inside it whenever the
  // window changes shape — a self view dragged off the edge on a phone turned
  // sideways is a self view nobody can reach.
  useEffect(() => {
    const parent = box.current?.parentElement;
    if (!parent) return;
    const place = () => {
      const area = parent.getBoundingClientRect();
      if (!area.width || !area.height) return;
      const next =
        width ||
        Math.round(Math.min(240, Math.max(96, area.width * 0.26)));
      if (!width) setWidth(next);
      const tall = next / aspect;
      setPos((was) =>
        was
          ? {
              x: Math.max(8, Math.min(was.x, Math.max(8, area.width - next - 8))),
              y: Math.max(8, Math.min(was.y, Math.max(8, area.height - tall - 8))),
            }
          : {
              x: Math.max(8, area.width - next - 12),
              y: Math.max(8, area.height - tall - 12),
            },
      );
    };
    place();
    const watcher = new ResizeObserver(place);
    watcher.observe(parent);
    return () => watcher.disconnect();
  }, [width, aspect]);

  function begin(mode: "move" | "size") {
    return (event: React.PointerEvent<HTMLDivElement>) => {
      const area = box.current?.parentElement?.getBoundingClientRect();
      if (!area || !pos) return;
      event.preventDefault();
      event.stopPropagation();
      (event.currentTarget as HTMLElement).setPointerCapture?.(event.pointerId);
      drag.current = {
        mode,
        atX: event.clientX,
        atY: event.clientY,
        fromX: pos.x,
        fromY: pos.y,
        fromWidth: width,
      };
    };
  }

  function move(event: React.PointerEvent<HTMLDivElement>) {
    const held = drag.current;
    const area = box.current?.parentElement?.getBoundingClientRect();
    if (!held || !area) return;
    if (held.mode === "size") {
      const next = Math.max(
        88,
        Math.min(held.fromWidth + (event.clientX - held.atX), area.width * 0.62),
      );
      setWidth(Math.round(next));
      return;
    }
    const tall = held.fromWidth / aspect;
    setPos({
      x: Math.max(
        8,
        Math.min(held.fromX + (event.clientX - held.atX), area.width - held.fromWidth - 8),
      ),
      y: Math.max(
        8,
        Math.min(held.fromY + (event.clientY - held.atY), area.height - tall - 8),
      ),
    });
  }

  function end(event: React.PointerEvent<HTMLDivElement>) {
    if (!drag.current) return;
    drag.current = null;
    (event.currentTarget as HTMLElement).releasePointerCapture?.(event.pointerId);
  }

  const tall = width ? width / aspect : 120;

  return (
    <div
      ref={box}
      onPointerDown={begin("move")}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      className={cn(
        "absolute z-30 touch-none overflow-hidden rounded-2xl border border-white/20 bg-black/60 shadow-xl",
        "cursor-grab active:cursor-grabbing",
        pos ? "opacity-100" : "opacity-0",
      )}
      style={{
        left: pos?.x ?? 0,
        top: pos?.y ?? 0,
        width: width || 160,
        height: tall,
      }}
      aria-label={label}
    >
      <VideoSurface
        stream={stream}
        muted
        mirror={mirror}
        className="h-full w-full object-cover"
        onShape={(tallShape) => setAspect(tallShape)}
      />
      <span className="pointer-events-none absolute bottom-1 left-1.5 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-bold text-white/85">
        {label}
      </span>
      <div
        onPointerDown={begin("size")}
        className="absolute bottom-0 right-0 grid size-6 cursor-nwse-resize place-items-center rounded-tl-lg bg-white/25"
        aria-hidden
      >
        <span className="block size-1.5 rounded-full bg-white/80" />
      </div>
    </div>
  );
}

/** Which camera, microphone and speaker, when there is more than one of any. */
function DevicePanel({
  cameras,
  mics,
  speakers,
  cameraId,
  micId,
  speakerId,
  onCamera,
  onMic,
  onSpeaker,
  onClose,
}: {
  cameras: { id: string; label: string }[];
  mics: { id: string; label: string }[];
  speakers: { id: string; label: string }[];
  cameraId: string | null;
  micId: string | null;
  speakerId: string | null;
  onCamera: (id: string) => void;
  onMic: (id: string) => void;
  onSpeaker: (id: string) => void;
  onClose: () => void;
}) {
  return (
    <div className="mx-4 mb-2 rounded-2xl border border-white/10 bg-[#0f141c]/95 p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[12.5px] font-bold">Devices</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="rounded-full p-1 text-white/60 hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        <DeviceChoice
          label="Camera"
          devices={cameras}
          value={cameraId}
          onChange={onCamera}
        />
        <DeviceChoice
          label="Microphone"
          devices={mics}
          value={micId}
          onChange={onMic}
        />
        <DeviceChoice
          label="Speaker"
          devices={speakers}
          value={speakerId}
          onChange={onSpeaker}
        />
      </div>
      {cameras.length === 0 && mics.length === 0 ? (
        <p className="mt-2 text-[11.5px] font-medium text-white/50">
          Your browser is not showing any devices yet — it does that until the
          microphone has been allowed once.
        </p>
      ) : null}
    </div>
  );
}

function DeviceChoice({
  label,
  devices,
  value,
  onChange,
}: {
  label: string;
  devices: { id: string; label: string }[];
  value: string | null;
  onChange: (id: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-[11px] font-semibold text-white/55">
        {label}
      </span>
      <select
        value={value ?? ""}
        onChange={(event) => {
          if (event.target.value) onChange(event.target.value);
        }}
        disabled={devices.length === 0}
        className="w-full rounded-xl border border-white/12 bg-white/8 px-2.5 py-2 text-[12px] font-medium text-white disabled:opacity-50"
      >
        {devices.length === 0 ? (
          <option value="">None found</option>
        ) : (
          <>
            <option value="">Browser default</option>
            {devices.map((device) => (
              <option key={device.id} value={device.id}>
                {device.label}
              </option>
            ))}
          </>
        )}
      </select>
    </label>
  );
}

/** One person's picture, attached the moment it arrives. */

export default CallOverlay;