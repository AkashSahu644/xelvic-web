import { useCallback, useEffect, useRef, useState, type ReactNode, type Ref } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/utils/cn";
import { useMediaUrl } from "@/hooks/useMediaUrl";
import { peekMedia } from "@/utils/mediaCache";
import { claimEar, releaseEar } from "@/utils/playback";

interface AuthedImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
  fallback?: ReactNode;
  loading?: "lazy" | "eager";
  onClick?: () => void;
  aspect?: string;
  /**
   * Whether a picture that has not arrived yet draws a skeleton.
   *
   * The feed draws a second, sharper copy of a photograph over its own preview
   * (the app's `dropPictureTile`), and the copy has to arrive silently: a
   * skeleton on top of the preview would be the thumbnail covered up by the
   * thing that was meant to improve it. A quiet picture draws nothing until it
   * has bytes.
   */
  quiet?: boolean;
}

/**
 * A picture behind the account's own credentials.
 *
 * **The bytes are asked for when the picture comes near the screen**, not when
 * it is mounted. That distinction is the whole of a slow feed: a hundred cards
 * mount at once, and the first version of this component fetched every one of
 * their pictures on mount — the browser's own `loading="lazy"` can save the
 * *paint* of a picture but not a request this component makes by hand. A page
 * of thirty drops with a gallery in it was sixty requests before anything was
 * read, which is exactly what "loading is slow like the app never was" was.
 *
 * Sixteen hundred pixels of lead is about three screens of scrolling on a
 * phone. The first byte here takes a few hundred milliseconds and these reads
 * are authenticated (so the browser does not cache them on its own), which
 * means a picture asked for when it is *reached* is a picture that arrives
 * after the reader has already looked at an empty tile. Asked for when it is
 * three screens away, it is in hand by the time it is scrolled to. The disk
 * copy in `utils/mediaCache.ts` is what makes a second view immediate.
 */
export function AuthedImage({
  src,
  alt,
  className,
  imgClassName,
  fallback,
  loading = "lazy",
  onClick,
  aspect,
  quiet,
}: AuthedImageProps) {
  const [near, setNear] = useState(() => Boolean(src && /^(data:|blob:)/i.test(src)));
  const anchor = useRef<HTMLElement | null>(null);
  const attach = useCallback((node: HTMLElement | null) => {
    anchor.current = node;
  }, []);
  const media = useMediaUrl(src, near);
  const [broken, setBroken] = useState(false);

  useEffect(() => {
    if (!src || near) return;
    // Already in hand: no reason to wait for the scroll to notice.
    if (peekMedia(src)) {
      setNear(true);
      return;
    }
    const node = anchor.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setNear(true);
      return;
    }
    const watcher = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setNear(true);
          watcher.disconnect();
        }
      },
      { rootMargin: "1600px 0px" },
    );
    watcher.observe(node);
    return () => watcher.disconnect();
  }, [src, near]);

  if (media.failed || broken || !src) {
    // A quiet picture is an underlay: the still behind a clip, or the preview
    // under the full photograph. There is nothing for it to say, and a broken
    // icon under the thing that covers it is furniture nobody asked for.
    if (quiet) {
      return <div ref={attach} className={cn("overflow-hidden", className)} aria-hidden />;
    }
    return (
      <div
        ref={attach}
        className={cn("flex items-center justify-center overflow-hidden bg-[color-mix(in_srgb,var(--accent)_9%,var(--card))] text-dim", className)}
        style={aspect ? { aspectRatio: aspect } : undefined}
        aria-label={alt}
        role="img"
      >
        {fallback ?? <ImageOff className="size-5" aria-hidden />}
      </div>
    );
  }

  if (!media.src) {
    return quiet ? (
      <div
        ref={attach}
        className={cn("overflow-hidden", className)}
        style={aspect ? { aspectRatio: aspect } : undefined}
        aria-label={alt}
        role="img"
      />
    ) : (
      <div
        ref={attach}
        className={cn("skeleton overflow-hidden", className)}
        style={aspect ? { aspectRatio: aspect } : undefined}
        aria-label={alt}
        role="img"
      >
        <span className="sr-only">{alt}</span>
      </div>
    );
  }

  return (
    <img
      ref={attach}
      src={media.src}
      alt={alt}
      loading={loading}
      decoding="async"
      onError={() => setBroken(true)}
      onClick={onClick}
      className={cn("object-cover", className, imgClassName)}
      style={aspect ? { aspectRatio: aspect } : undefined}
    />
  );
}

interface AuthedVideoProps {
  src?: string | null;
  poster?: string | null;
  className?: string;
  controls?: boolean;
  autoPlay?: boolean;
  muted?: boolean;
  loop?: boolean;
  playsInline?: boolean;
  preload?: "none" | "metadata" | "auto";
  /** Draw nothing, rather than a skeleton, while the bytes are crossing. */
  quiet?: boolean;
  onEnded?: () => void;
  /**
   * The element itself, for the two screens that drive a clip rather than hand
   * it to the browser's own controls — the Vibes reel, which pauses on a tap,
   * winds back when it is left, and draws its own progress. Everything else
   * leaves it out and the clip is the browser's.
   */
  videoRef?: Ref<HTMLVideoElement>;
  onTimeUpdate?: () => void;
}

/**
 * A clip behind the account's own credentials.
 *
 * Every clip that is heard goes through here, so this is where the app's
 * one-ear rule lives: the moment this element starts it claims the ear, and
 * whatever was playing — another card's clip, a soundtrack in the music bar —
 * stops first. Pausing or reaching the end gives the ear back. See
 * `src/lib/playback.ts` for why that rule is an element registry rather than a
 * provider of its own.
 */
export function AuthedVideo({
  src,
  poster,
  className,
  controls,
  autoPlay,
  muted,
  loop,
  playsInline = true,
  preload = "metadata",
  quiet,
  onEnded,
  videoRef,
  onTimeUpdate,
}: AuthedVideoProps) {
  const media = useMediaUrl(src);
  const own = useRef<HTMLVideoElement | null>(null);
  const attach = useCallback(
    (node: HTMLVideoElement | null) => {
      own.current = node;
      if (typeof videoRef === "function") videoRef(node);
      else if (videoRef) (videoRef as { current: HTMLVideoElement | null }).current = node;
    },
    [videoRef],
  );

  // A clip unmounted mid-play must give the ear back, or the next clip would
  // claim an ear that is already free — harmless — or leave this element in the
  // registry for a page that no longer exists.
  useEffect(() => {
    const node = own.current;
    return () => {
      if (node) releaseEar(node);
    };
  }, []);

  if (!src) return <div className={cn("bg-solid", className)} />;
  if (media.failed) {
    return (
      <div className={cn("flex items-center justify-center bg-solid text-white/60", className)}>
        <ImageOff className="size-7" aria-hidden />
      </div>
    );
  }
  if (media.loading || !media.src) {
    // A feed draws the clip's own still underneath and lets it show through:
    // a skeleton over that would hide the preview the still exists for.
    return quiet ? (
      <div className={className} aria-hidden />
    ) : (
      <div className={cn("skeleton bg-solid/20", className)} aria-hidden />
    );
  }
  return (
    <video
      ref={attach}
      src={media.src}
      poster={poster ?? undefined}
      className={cn("object-cover", className)}
      controls={controls}
      autoPlay={autoPlay}
      muted={muted}
      loop={loop}
      playsInline={playsInline}
      preload={preload}
      onPlay={(event) => claimEar(event.currentTarget)}
      onPause={(event) => releaseEar(event.currentTarget)}
      onEnded={(event) => {
        releaseEar(event.currentTarget);
        onEnded?.();
      }}
      onTimeUpdate={onTimeUpdate}
    />
  );
}
