import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { initialsOf } from "@/lib/format";
import { useMediaUrl } from "@/lib/media";
import type { UserCard } from "@/types/api";

interface AvatarProps {
  user?: Pick<UserCard, "name" | "username" | "avatar"> | null;
  src?: string | null;
  name?: string;
  size?: number;
  className?: string;
  ring?: boolean;
  muted?: boolean;
  online?: boolean;
  badge?: ReactNode;
}

export function Avatar({
  user,
  src,
  name,
  size = 44,
  className,
  ring,
  muted,
  online,
  badge,
}: AvatarProps) {
  const displayName = name || user?.name || user?.username || "";
  const initial = initialsOf(displayName);
  const media = useMediaUrl(src ?? user?.avatar);
  const [broken, setBroken] = useState(false);
  const image = media.src && !media.failed && !broken;

  return (
    <span
      className={cn("relative inline-flex shrink-0", className)}
      style={{ width: size, height: size }}
    >
      <span
        className={cn(
          "flex h-full w-full items-center justify-center overflow-hidden rounded-full",
          ring && "p-[2px]",
          ring && "story-ring",
          muted && "opacity-60",
        )}
      >
        <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,var(--card))]">
          {image ? (
            <img
              src={media.src ?? undefined}
              alt={displayName}
              className="h-full w-full object-cover"
              onError={() => setBroken(true)}
              loading="lazy"
              decoding="async"
              draggable={false}
            />
          ) : (
            <span
              className="font-extrabold tracking-tight text-accent"
              style={{ fontSize: Math.max(11, size * 0.32) }}
              aria-hidden
            >
              {initial || "?"}
            </span>
          )}
        </span>
      </span>
      {online ? (
        <span
          className="absolute bottom-0 right-0 rounded-full border-2 border-[var(--card)] bg-[var(--good)]"
          style={{ width: Math.max(9, size * 0.26), height: Math.max(9, size * 0.26) }}
          aria-label="Online"
        />
      ) : null}
      {badge ? <span className="absolute -right-1 -top-1">{badge}</span> : null}
    </span>
  );
}

export function AvatarStack({ users, size = 26 }: { users: Pick<UserCard, "id" | "name" | "username" | "avatar">[]; size?: number }) {
  const shown = users.slice(0, 3);
  return (
    <span className="flex -space-x-2">
      {shown.map((user) => (
        <span key={user.id} className="rounded-full border-2 border-[var(--card)]">
          <Avatar user={user} size={size} />
        </span>
      ))}
      {users.length > shown.length ? (
        <span
          className="inline-flex items-center justify-center rounded-full border-2 border-[var(--card)] bg-[color-mix(in_srgb,var(--ink)_8%,var(--card))] text-[10px] font-bold text-dim"
          style={{ width: size, height: size }}
        >
          +{users.length - shown.length}
        </span>
      ) : null}
    </span>
  );
}
