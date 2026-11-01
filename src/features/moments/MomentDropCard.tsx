import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { AuthedImage } from "@/components/Media";
import { VerifiedTick } from "@/components/Tick";
import { SensitiveVeil } from "@/features/drops/SensitiveVeil";
import { useMediaUrl } from "@/lib/media";
import { useAuth } from "@/providers/AuthProvider";
import type { Asset, DropPreview } from "@/types/api";

/**
 * Somebody else's post, drawn on their moment as the way in it is.
 *
 * Ported from `MomentDropCard` in `screens/drop_card.dart`. Putting another
 * person's public post on your own day does not copy it: what is on the moment
 * is a reference — whose post it is and which one — and a tap opens the post
 * itself where it actually lives, at its own route and behind its own gate.
 *
 * Deliberately quiet. No like, no comment, no share row: those belong to the
 * post and are one tap away on its own page. A card on a story that carried a
 * scoreboard would be a feed row wearing a moment.
 *
 * A sound is the one kind that plays *here* rather than only opening, because
 * with no frame of its own it would otherwise be a cover and a glyph that led
 * nowhere; a picture carrying a soundtrack plays it here too, which is what the
 * same post does in the feed. Both hand their state up through `onHolding` so
 * the walk's own clock stops while somebody is listening — the app's
 * `_sharedMoved`, which is the reason a sound on a day is heard rather than
 * stepped past.
 */

/** The tallest and shortest a reshared picture stands inside the card. */
const TALLEST = 1.4;
const SHORTEST = 0.7;

/** The still a reference draws: a sound's own asset is the audio, not a picture. */
function stillOf(drop: DropPreview): Asset | null {
  return drop.kind === "audio" ? drop.cover ?? null : drop.asset ?? null;
}

/** Where the post itself lives — a Vibe is served by its own family of routes. */
export function previewPath(drop: DropPreview): string {
  return drop.kind === "vibe" ? `/app/drops/vibes/${drop.id}` : `/app/drops/${drop.id}`;
}

export function MomentDropCard({
  drop,
  onOpen,
  onHolding,
}: {
  drop: DropPreview;
  onOpen: () => void;
  /** Whether this card is playing something, so the walk can hold its clock. */
  onHolding?: (holding: boolean) => void;
}) {
  const { user } = useAuth();
  const [playing, setPlaying] = useState(false);
  const mine = Boolean(user && drop.author?.id === user.id);
  const note = drop.body?.trim() ?? "";
  const isText = drop.kind === "text";
  const isSound = drop.kind === "audio";
  const soundtrack = drop.soundtrack ?? null;
  const still = stillOf(drop);
  const shape = Math.min(TALLEST, Math.max(SHORTEST, drop.ratio || 1.25));
  const plays = drop.kind === "video" || drop.kind === "vibe" || isSound;

  return (
    <div className="flex w-full justify-center px-6">
      <div className="w-full max-w-[320px]">
        {/* One tap target for the whole card, the way the app's is: a card is a
            way in and a tap is it being taken. Anything inside that plays
            claims its own press, so a play button plays rather than opening. */}
        <div
          role="button"
          tabIndex={0}
          onClick={onOpen}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onOpen();
            }
          }}
          className="block w-full cursor-pointer overflow-hidden rounded-[20px] bg-card text-left shadow-2xl"
        >
          {isText ? (
            <div
              className="flex min-h-[96px] flex-col justify-center px-4 py-[18px]"
              style={{ backgroundColor: "color-mix(in srgb, var(--accent) 10%, transparent)" }}
            >
              <p className="whitespace-pre-wrap text-[15px] leading-[1.45]">{note}</p>
            </div>
          ) : (
            <>
              <SensitiveVeil
                sensitive={drop.sensitive}
                openable={drop.openable}
                cover={still}
                note={mine ? "Yours. Everybody else sees it covered." : null}
                hideable
              >
                <div className="relative w-full overflow-hidden" style={{ aspectRatio: `1 / ${shape}` }}>
                  {still?.thumbnail_url || still?.content_url ? (
                    <AuthedImage
                      src={still.thumbnail_url || still.content_url}
                      alt={note || "A post"}
                      className="size-full object-cover"
                      loading="eager"
                    />
                  ) : (
                    <div className="size-full bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]" />
                  )}
                  {plays ? (
                    <span className="pointer-events-none absolute inset-0 flex items-center justify-center">
                      <Play className="size-[46px] text-white drop-shadow" aria-hidden />
                    </span>
                  ) : null}
                  {drop.tag ? (
                    <span className="absolute left-2.5 top-2.5 rounded-full bg-[rgb(8_8_12_/_0.82)] px-2 py-[3px] text-[9.5px] font-bold tracking-[0.4px] text-white">
                      {drop.tag}
                    </span>
                  ) : null}
                </div>
              </SensitiveVeil>
              {isSound && drop.asset?.content_url ? (
                <SoundRow
                  src={drop.asset.content_url}
                  label={drop.title || note || "A sound"}
                  playing={playing}
                  onPlaying={setPlaying}
                  onHolding={onHolding}
                />
              ) : null}
              {!isSound && soundtrack?.content_url ? (
                <SoundRow
                  src={soundtrack.content_url}
                  label={drop.music || "A soundtrack"}
                  playing={playing}
                  onPlaying={setPlaying}
                  onHolding={onHolding}
                />
              ) : null}
            </>
          )}

          <div className="px-3 pb-3 pt-2.5">
            <div className="flex items-center gap-2.5">
              <Avatar user={drop.author} size={28} />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1">
                  <span className="truncate text-[13px] font-bold">{drop.author?.name || drop.author?.username}</span>
                  {drop.author?.verified ? <VerifiedTick size={12} /> : null}
                </span>
                <span className="block truncate text-[11px] text-dim">@{drop.author?.username}</span>
                {drop.collab ? (
                  <span className="block truncate text-[11px] text-dim">
                    with {(drop.collab.people ?? []).map((person) => person.name || person.username).join(", ")}
                  </span>
                ) : null}
              </span>
            </div>
            {!isText && note ? (
              <p className="mt-2 whitespace-pre-wrap text-[13.5px] leading-[1.4]">{note}</p>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * The one control a sound needs on a card: play, and play again to stop.
 *
 * A real element rather than a glyph, because a glyph that did not play would
 * be the button the brief forbids. The walk's clock is held for exactly as long
 * as the sound is running, so the moment does not step on while somebody is
 * listening to the thing they tapped.
 */
function SoundRow({
  src,
  label,
  playing,
  onPlaying,
  onHolding,
}: {
  src: string;
  label: string;
  playing: boolean;
  onPlaying: (playing: boolean) => void;
  onHolding?: (holding: boolean) => void;
}) {
  const media = useMediaUrl(src);
  const audio = useRef<HTMLAudioElement | null>(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const element = audio.current;
    if (!element) return;
    if (playing) element.play().catch(() => onPlaying(false));
    else element.pause();
    onHolding?.(playing);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, media.src]);

  useEffect(() => () => onHolding?.(false), [onHolding]);

  function toggle(event: React.MouseEvent) {
    event.stopPropagation();
    onPlaying(!playing);
  }

  return (
    <div className="flex items-center gap-2 px-3 pt-3" onClick={(event) => event.stopPropagation()}>
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? "Pause the sound" : "Play the sound"}
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent"
      >
        {playing ? <Pause className="size-4" aria-hidden /> : <Play className="size-4" aria-hidden />}
      </button>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12px] font-semibold">{label}</span>
        <span className="mt-1 block h-[3px] w-full overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--ink)_12%,transparent)]">
          <span className="block h-full bg-accent transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
        </span>
      </span>
      <audio
        ref={audio}
        src={media.src ?? undefined}
        className="hidden"
        onTimeUpdate={() => {
          const element = audio.current;
          if (!element || !element.duration) return;
          setProgress(element.currentTime / element.duration);
        }}
        onEnded={() => onPlaying(false)}
      />
    </div>
  );
}
