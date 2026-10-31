import { useState, type ReactNode } from "react";
import { ImageOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { useMediaUrl } from "@/lib/media";

interface AuthedImageProps {
  src?: string | null;
  alt: string;
  className?: string;
  imgClassName?: string;
  fallback?: ReactNode;
  loading?: "lazy" | "eager";
  onClick?: () => void;
  aspect?: string;
}

export function AuthedImage({
  src,
  alt,
  className,
  imgClassName,
  fallback,
  loading = "lazy",
  onClick,
  aspect,
}: AuthedImageProps) {
  const media = useMediaUrl(src);
  const [broken, setBroken] = useState(false);

  if (media.failed || broken || !src) {
    return (
      <div
        className={cn("flex items-center justify-center overflow-hidden bg-[color-mix(in_srgb,var(--accent)_9%,var(--card))] text-dim", className)}
        style={aspect ? { aspectRatio: aspect } : undefined}
        aria-label={alt}
        role="img"
      >
        {fallback ?? <ImageOff className="size-5" aria-hidden />}
      </div>
    );
  }

  if (media.loading) {
    return (
      <div className={cn("skeleton overflow-hidden", className)} style={aspect ? { aspectRatio: aspect } : undefined} aria-label={alt} role="img">
        <span className="sr-only">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={media.src ?? undefined}
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
  onEnded?: () => void;
}

export function AuthedVideo({ src, className, controls, autoPlay, muted, loop, playsInline = true, onEnded }: AuthedVideoProps) {
  const media = useMediaUrl(src);
  if (!src) return <div className={cn("bg-solid", className)} />;
  if (media.failed) {
    return (
      <div className={cn("flex items-center justify-center bg-solid text-white/60", className)}>
        <ImageOff className="size-7" aria-hidden />
      </div>
    );
  }
  if (media.loading || !media.src) {
    return <div className={cn("skeleton bg-solid/20", className)} aria-hidden />;
  }
  return (
    <video
      src={media.src}
      className={cn("object-cover", className)}
      controls={controls}
      autoPlay={autoPlay}
      muted={muted}
      loop={loop}
      playsInline={playsInline}
      preload="metadata"
      onEnded={onEnded}
    />
  );
}
