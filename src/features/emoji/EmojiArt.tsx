/**
 * One emoji, drawn with Google's own artwork and — where Google animates it and
 * something has asked it to — moving.
 *
 * Three layers, in the order they earn their place:
 *
 * 1. **The character itself.** Written into the tile on the first frame, so it
 *    is something the instant the picker opens and stays something if the
 *    network is slow, blocked or gone. It is also the honest fallback for the
 *    fourteen emoji Google draws no picture of.
 * 2. **Google's still drawing**, laid over the character once it has loaded.
 *    This is what makes an emoji the machine's own font would draw as a box look
 *    like the emoji, whatever fonts the machine has.
 * 3. **Google's animation**, played over the drawing, for the 605 emoji that
 *    have one — and only when something asks for it.
 *
 * **What asks for it is `motion.ts`'s decision, not this file's**, and it is a
 * different answer for a tile than for an emoji in a sentence: a tile in the
 * picker moves while it is on screen, and an emoji in a message moves while a
 * pointer is on it and once when its message is sent or arrives. That second
 * rule is the owner's: *"ye jo continue animate ho raha hai jabki send karne par
 * aur hover karne par animate hona chahiye"*. The player is still only fetched
 * by something that needs it, so a chat that is only read never pays for it.
 *
 * `prefers-reduced-motion` is obeyed by not playing anything at all — the still
 * drawing is already there, so nothing has to be replaced, only withheld. A
 * hover does not override it: the setting is a person saying they do not want
 * things moving, and a pointer crossing a grid is exactly the accident it was
 * written for.
 */
import { useEffect, useRef, useState } from "react";
import { cn } from "@/utils/cn";
// From `cdn.ts` and not `model.ts`: this component draws an emoji in a message
// as well as one in the picker, and reaching through the picker's arithmetic
// for a URL would put the picker's whole table on the chat screen.
import { motionUrl, stillUrl } from "./cdn";
import { giveBack, MOST_MOVING, spare, wanted, type Mode, type Phase } from "./motion";
import { lottiePlayer, type LottieInstance } from "./player";

type Watcher = (seen: boolean) => void;

const watching = new Map<Element, Watcher>();
let observer: IntersectionObserver | null = null;

/**
 * One IntersectionObserver for every emoji in the app.
 *
 * A hundred observers watching a hundred emoji is a hundred callbacks on every
 * scroll frame; this is one. The margin is a screen's worth of slack, so a tile
 * has its animation ready by the time it is properly visible rather than
 * starting it in front of somebody.
 */
function watch(element: Element, tell: Watcher): () => void {
  observer ??= new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        watching.get(entry.target)?.(entry.isIntersecting);
      }
    },
    { rootMargin: "200px" },
  );
  watching.set(element, tell);
  observer.observe(element);
  return () => {
    watching.delete(element);
    observer?.unobserve(element);
  };
}

function prefersStill(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/** Emoji currently running an animation, across the whole app. */
let moving = 0;

export function EmojiArt({
  char,
  /** Google animates this one — `hasMotion` in the generated table. */
  motion,
  /** Google draws this one at all — `hasStill`. */
  still = true,
  /** A tile in the picker, or an emoji inside something somebody said. */
  mode = "tile",
  /**
   * Play this one through, once, right now.
   *
   * A token rather than a flag, so that the same message can be sent twice and
   * be celebrated twice. It is how a sent or just-arrived message says "this
   * one is new" — see `Arrival` in `ChatPage`.
   */
  burst,
  className,
}: {
  char: string;
  motion: boolean;
  still?: boolean;
  mode?: Mode;
  burst?: number;
  className?: string;
}) {
  const holder = useRef<HTMLSpanElement>(null);
  const stage = useRef<HTMLSpanElement>(null);
  const [drawn, setDrawn] = useState(false);
  const [animated, setAnimated] = useState(false);

  // The pointer's own arrival and departure, and the burst, handed to the
  // effect below through refs so the handlers can be written once on the
  // element and still do nothing at all for an emoji with nothing to play.
  const arrived = useRef<() => void>(() => {});
  const departed = useRef<() => void>(() => {});
  const cheer = useRef<() => void>(() => {});

  useEffect(() => {
    if (!motion || prefersStill()) return;
    const tile = holder.current;
    const canvas = stage.current;
    if (!tile || !canvas) return;

    // `phase` is what this one is doing, and it is a local rather than state
    // because it changes inside a promise and in the observer's callback: a
    // re-render must never be what decides whether a player is running.
    let phase: Phase = "off";
    let instance: LottieInstance | null = null;
    let gone = false;
    let inView = false;
    let hovered = false;
    /** Started because a pointer was on it, so the place may have to go back. */
    let byPointer = false;

    const release = () => {
      if (phase === "off") return;
      phase = "off";
      moving -= 1;
    };

    const start = (options: { once: boolean }) => {
      if (phase !== "off" || !spare(moving, hovered)) return;
      phase = "loading";
      byPointer = hovered;
      moving += 1;
      void lottiePlayer().then((player) => {
        // The finger may have scrolled straight past while the player was
        // still arriving, in which case this one is no longer wanted.
        if (phase !== "loading" || gone || !canvas.isConnected) {
          release();
          return;
        }
        try {
          instance = player.loadAnimation({
            container: canvas,
            renderer: "svg",
            loop: !options.once,
            autoplay: true,
            path: motionUrl(char),
            rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
          });
          if (options.once) {
            // A burst is over when the animation is: the drawing behind it is
            // already there, so stopping is a return to stillness and not a
            // gap where something used to be.
            instance.addEventListener("complete", () => {
              if (phase === "off") return;
              stop();
              sync();
            });
          }
          phase = "playing";
          setAnimated(true);
        } catch {
          release();
        }
      });
    };

    const stop = () => {
      instance?.destroy();
      instance = null;
      byPointer = false;
      release();
      canvas.replaceChildren();
      if (!gone) setAnimated(false);
    };

    /** Whether this one should be moving, asked of everything that decides it. */
    const sync = () => {
      if (!wanted(mode, inView, hovered)) {
        stop();
        return;
      }
      if (phase === "off") {
        start({ once: false });
        return;
      }
      if (giveBack(byPointer, hovered, moving, MOST_MOVING)) stop();
    };

    const leave = watch(tile, (seen) => {
      inView = seen;
      sync();
    });
    arrived.current = () => {
      hovered = true;
      sync();
    };
    departed.current = () => {
      hovered = false;
      sync();
    };
    cheer.current = () => {
      if (phase === "off") start({ once: true });
    };

    return () => {
      gone = true;
      arrived.current = () => {};
      departed.current = () => {};
      cheer.current = () => {};
      leave();
      stop();
    };
  }, [char, motion, mode]);

  // The burst is a token: every new value is one more play. Nothing happens on
  // the first render of something that was never told to celebrate.
  useEffect(() => {
    if (burst === undefined) return;
    cheer.current();
  }, [burst]);

  return (
    <span
      ref={holder}
      onPointerEnter={() => arrived.current()}
      onPointerLeave={() => departed.current()}
      className={cn("relative grid size-full place-items-center leading-none", className)}
      aria-hidden={mode === "tile" ? true : undefined}
    >
      <span className={cn("col-start-1 row-start-1", mode === "tile" && "select-none")}>{char}</span>
      {still ? (
        <img
          src={stillUrl(char)}
          alt=""
          draggable={false}
          loading="lazy"
          decoding="async"
          onLoad={() => setDrawn(true)}
          onError={() => setDrawn(false)}
          className={cn(
            "col-start-1 row-start-1 size-full object-contain transition-opacity duration-100",
            drawn ? "opacity-100" : "opacity-0",
            animated && "invisible",
          )}
        />
      ) : null}
      <span ref={stage} className="col-start-1 row-start-1 size-full" />
    </span>
  );
}
