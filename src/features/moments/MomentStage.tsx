import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/cn";
import { useMediaUrl } from "@/lib/media";
import { MomentDropCard } from "./MomentDropCard";
import { MomentPollCard } from "./MomentPollCard";
import type { Asset, DropPreview, MomentItem, MomentPoll } from "@/types/api";

/**
 * The picture half of the walk — what is actually on the day.
 *
 * Ported from `_stage`, `_picture`, `_songCover`, `_caption`, `_whoIsIn` and the
 * two credit rows in `screens/moment_view.dart`. The rules it keeps are the
 * app's, and each of them was a decision made in the app for a reason:
 *
 * - **The media is drawn inside a box of its own shape.** A moment's picture is
 *   baked into a 9:16 frame by the editor, so drawing it to the edges of a
 *   taller screen crops both sides. Filling the box exactly crops nothing, and
 *   the page shows a strip of its own ground above and below instead.
 * - **A song's sleeve is the one picture that is not drawn that way.** A square
 *   cover covering a tall screen loses the two fifths hanging off the sides, so
 *   it is set inside the page, square, with the track's name under it — the same
 *   report the app answers on 2026-10-15.
 * - **A small copy of the picture is under the large one.** The large one is a
 *   download; until it lands the page is not empty, because the item's own
 *   preview is drawn in the meantime, `cover`-fitted, under it.
 * - **A note and a poll are the whole of the moment**, so they sit centred on an
 *   empty page: the note in white words on the black stage, the poll on the
 *   theme's own ground — a poll is a card of the app, and the app's ink on the
 *   app's page is the only place its options and its tally are readable.
 */

/** The words of a note are held off the sides rather than run to them. */
const NOTE_MARGIN = 44;
/** …and bounded in width, because a browser window is a note a metre wide. */
const NOTE_COLUMN = 520;
/** A sleeve's name sits under it, in from the edges. */
const SONG_COVER_GAP = 18;
const SONG_COVER_MARGIN = 28;
/** What the editor bakes every picture into, when nothing says otherwise. */
const FRAME_W = 9;
const FRAME_H = 16;

export function isVideoItem(item: MomentItem): boolean {
  return item.kind === "video";
}

export function isTextItem(item: MomentItem): boolean {
  return item.kind === "text" || item.kind === "note";
}

export function isPollItem(item: MomentItem): boolean {
  return item.kind === "poll" || Boolean(item.poll);
}

export function isDropItem(item: MomentItem): boolean {
  return Boolean(item.drop);
}

/** A square cover with a sound under it — `MomentItem.isSongCover`. */
export function isSongCover(item: MomentItem): boolean {
  const width = item.asset?.width ?? 0;
  return Boolean(item.sound) && !isVideoItem(item) && width > 0 && width === item.asset?.height;
}

/** The shape of the media as the file itself is shaped, for the box it sits in. */
export function mediaShape(item: MomentItem): { w: number; h: number } {
  const w = item.asset?.width ?? 0;
  const h = item.asset?.height ?? 0;
  if (w > 0 && h > 0) return { w, h };
  return { w: FRAME_W, h: FRAME_H };
}

export function MomentStage({
  item,
  poll,
  onPoll,
  playing,
  clipRef,
  onClipEnded,
  onOpenDrop,
  onHoldSound,
}: {
  item: MomentItem;
  /** The poll as the server last answered it, when it has been voted on here. */
  poll?: MomentPoll | null;
  onPoll?: (poll: MomentPoll) => void;
  /** Whether the walk's clock is running, which is what plays what plays. */
  playing: boolean;
  clipRef?: (element: HTMLVideoElement | null) => void;
  onClipEnded?: () => void;
  onOpenDrop?: (drop: DropPreview) => void;
  /** A card that is playing something of its own, so the walk can hold its clock. */
  onHoldSound?: (holding: boolean) => void;
}) {
  const soundUrl = item.sound?.content_url ?? item.sound_url ?? null;
  /** The poll as it now stands, whichever copy is the newer one. */
  const shownPoll = poll ?? item.poll ?? null;

  if (isSongCover(item)) {
    return (
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="flex w-full flex-col items-center">
          <div
            className="relative w-full overflow-hidden"
            style={{ aspectRatio: "1 / 1", width: `min(100%, calc(100dvh * 1))` }}
          >
            <Picture item={item} />
          </div>
          {item.body?.trim() ? (
            <p
              className="line-clamp-2 text-center text-[17px] font-semibold leading-[1.25] text-white"
              style={{
                marginTop: SONG_COVER_GAP,
                paddingInline: SONG_COVER_MARGIN,
                textShadow: "0 0 4px rgba(0,0,0,0.8)",
              }}
            >
              {item.body}
            </p>
          ) : null}
          <SoundTrack url={soundUrl} item={item} playing={playing} />
        </div>
      </div>
    );
  }

  return (
    <div className="absolute inset-0">
      {isTextItem(item) ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center" style={{ maxWidth: NOTE_COLUMN, paddingInline: NOTE_MARGIN }}>
            {item.body?.trim() ? (
              <p className="whitespace-pre-wrap text-center text-[26px] font-semibold leading-[1.3] text-white">
                {item.body}
              </p>
            ) : null}
            <WhoIsIn item={item} />
          </div>
        </div>
      ) : isPollItem(item) && shownPoll ? (
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="max-h-full w-full overflow-y-auto px-7 py-10">
            <div className="mx-auto rounded-[22px] bg-paper px-[18px] pb-3.5 pt-[18px] text-ink">
              <MomentPollCard itemId={String(item.id)} poll={shownPoll} onPoll={onPoll} />
            </div>
          </div>
        </div>
      ) : isDropItem(item) && item.drop ? (
        <div className="absolute inset-0 flex items-center justify-center overflow-y-auto py-6">
          <MomentDropCard
            drop={item.drop}
            onOpen={() => onOpenDrop?.(item.drop as DropPreview)}
            onHolding={onHoldSound}
          />
        </div>
      ) : (
        <div className="absolute inset-0 flex items-center justify-center">
          <div
            className="relative shrink-0 overflow-hidden"
            style={{
              aspectRatio: `${mediaShape(item).w} / ${mediaShape(item).h}`,
              width: `min(100%, calc(100dvh * ${mediaShape(item).w / mediaShape(item).h}))`,
            }}
          >
            <Picture
              item={item}
              playing={playing}
              clipRef={clipRef}
              onClipEnded={onClipEnded}
            />
          </div>
        </div>
      )}
      <SoundTrack url={soundUrl} item={item} playing={playing} />
    </div>
  );
}

/**
 * The picture itself: the clip when it is one, the still otherwise.
 *
 * The small copy rides under the large one, and it is asked for by *preview* —
 * deliberately not by the full address, which would be asking the network for
 * the large picture in order to put it under the large picture.
 */
function Picture({
  item,
  playing = true,
  clipRef,
  onClipEnded,
}: {
  item: MomentItem;
  playing?: boolean;
  clipRef?: (element: HTMLVideoElement | null) => void;
  onClipEnded?: () => void;
}) {
  const full = useMediaUrl(item.asset?.content_url ?? null);
  const preview = useMediaUrl(item.asset?.thumbnail_url ?? null);
  const [landed, setLanded] = useState(false);

  if (isVideoItem(item)) {
    return <Clip item={item} playing={playing} clipRef={clipRef} onClipEnded={onClipEnded} />;
  }

  if (full.failed || (!full.src && !preview.src)) {
    return (
      <div className="absolute inset-0 bg-[color-mix(in_srgb,var(--ink)_8%,transparent)]" aria-hidden />
    );
  }

  return (
    <div className="absolute inset-0">
      {preview.src ? (
        <img
          src={preview.src}
          alt=""
          aria-hidden
          draggable={false}
          className={cn("absolute inset-0 size-full object-cover", landed && "hidden")}
        />
      ) : null}
      {full.src ? (
        <img
          src={full.src}
          alt={item.body || "A moment"}
          draggable={false}
          onLoad={() => setLanded(true)}
          className={cn(
            "absolute inset-0 size-full object-cover transition-opacity duration-200",
            landed ? "opacity-100" : "opacity-0",
          )}
        />
      ) : (
        <div className="skeleton absolute inset-0" aria-hidden />
      )}
    </div>
  );
}

/**
 * A clip, played over the window the editor kept.
 *
 * The window is the whole point: a clip trimmed to its last four seconds plays
 * those four and stops there, which is also how long the item is on screen. The
 * bar reads off the element's own clock rather than off a timer, so a clip that
 * was dragged backwards reports where it actually is.
 */
function Clip({
  item,
  playing,
  clipRef,
  onClipEnded,
}: {
  item: MomentItem;
  playing: boolean;
  clipRef?: (element: HTMLVideoElement | null) => void;
  onClipEnded?: () => void;
}) {
  const media = useMediaUrl(item.asset?.content_url ?? null);
  const element = useRef<HTMLVideoElement | null>(null);
  const start = item.clip_start_ms ?? 0;

  useEffect(() => {
    const node = element.current;
    if (!node) return;
    const seek = () => {
      if (start > 0) node.currentTime = start / 1000;
    };
    node.addEventListener("loadedmetadata", seek);
    if (node.readyState >= 1) seek();
    return () => node.removeEventListener("loadedmetadata", seek);
  }, [start, media.src]);

  useEffect(() => {
    const node = element.current;
    if (!node || !media.src) return;
    if (playing) void node.play().catch(() => undefined);
    else node.pause();
  }, [playing, media.src]);

  if (!media.src) {
    return <div className="absolute inset-0 bg-solid" aria-hidden />;
  }

  return (
    <video
      ref={(node) => {
        element.current = node;
        clipRef?.(node);
      }}
      src={media.src}
      className="absolute inset-0 size-full object-cover"
      playsInline
      preload="auto"
      muted={item.muted}
      onEnded={onClipEnded}
    />
  );
}

/**
 * The music somebody put on an item, played over the window the poster kept.
 *
 * A second upload of its own rather than a property of the first, so it has an
 * address of its own — and a window of its own, which is where it starts and
 * where it stops. Nothing loops: the item's own hold is worked out from the same
 * window, so the walk moves on exactly when the music does.
 */
function SoundTrack({
  url,
  item,
  playing,
}: {
  url: string | null;
  item: MomentItem;
  playing: boolean;
}) {
  const media = useMediaUrl(url);
  const element = useRef<HTMLAudioElement | null>(null);
  const start = item.sound_start_ms ?? 0;
  const end = item.sound_end_ms ?? 0;

  useEffect(() => {
    const node = element.current;
    if (!node) return;
    const seek = () => {
      if (start > 0) node.currentTime = start / 1000;
    };
    node.addEventListener("loadedmetadata", seek);
    if (node.readyState >= 1) seek();
    return () => node.removeEventListener("loadedmetadata", seek);
  }, [start, media.src]);

  useEffect(() => {
    const node = element.current;
    if (!node || !media.src) return;
    if (playing) void node.play().catch(() => undefined);
    else node.pause();
  }, [playing, media.src]);

  if (!media.src) return null;

  return (
    <audio
      ref={element}
      src={media.src}
      className="hidden"
      aria-hidden
      onTimeUpdate={() => {
        const node = element.current;
        if (node && end > start && node.currentTime * 1000 >= end) node.pause();
      }}
    />
  );
}

/** The people an item puts in the picture, said under it in handles. */
export function WhoIsIn({ item, className }: { item: MomentItem; className?: string }) {
  const people = item.mentions ?? [];
  if (!people.length) return null;
  return (
    <p
      dir="ltr"
      className={cn("mt-1.5 text-[13px] font-semibold text-white", className)}
      style={{ textShadow: "0 0 4px rgba(0,0,0,0.8)" }}
    >
      {people.map((person) => `@${person.username}`).join("  ")}
    </p>
  );
}

/** The still an item would draw as a cover, for anything that needs one. */
export function itemCover(item: MomentItem): Asset | null {
  return item.asset ?? item.vibe?.asset ?? null;
}
