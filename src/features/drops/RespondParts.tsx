import { Link } from "react-router-dom";
import { ImageOff } from "lucide-react";
import { AuthedImage, AuthedVideo } from "@/components/media/Media";
import { useMediaUrl } from "@/hooks/useMediaUrl";
import type { Asset, Sticker, UserCard } from "@/types/api";

/**
 * A respond's words with the people it names made into doors.
 *
 * Ported from `_RespondBody` in `screens/drop_sheets.dart`. The named people
 * come back *with* the respond, so a handle is highlighted by matching one of
 * those cards and never by guessing at what looks like one: an `@word` nobody
 * was mentioned by stays plain text, which is the same rule the composer uses
 * on the way out. A real handle goes wherever the face beside the line goes.
 */
export function RespondBody({ body, mentions }: { body: string; mentions?: UserCard[] }) {
  const named = new Map((mentions ?? []).map((person) => [person.username.toLowerCase(), person]));
  if (!body) return null;
  if (!named.size || !body.includes("@")) {
    return <p className="whitespace-pre-wrap break-words text-[13.5px] leading-[1.4] text-ink">{body}</p>;
  }

  // `@[A-Za-z0-9_.]+` is the app's own handle pattern — l10n-free, a handle and
  // not a sentence. Everything between the matches is drawn untouched, so the
  // line reads exactly as it was written.
  const parts: Array<{ text: string; person?: UserCard }> = [];
  const handle = /@[A-Za-z0-9_.]+/g;
  let at = 0;
  for (const match of body.matchAll(handle)) {
    const start = match.index ?? 0;
    if (start > at) parts.push({ text: body.slice(at, start) });
    const token = match[0];
    const person = named.get(token.slice(1).toLowerCase());
    parts.push(person ? { text: token, person } : { text: token });
    at = start + token.length;
  }
  if (at < body.length) parts.push({ text: body.slice(at) });

  return (
    <p className="whitespace-pre-wrap break-words text-[13.5px] leading-[1.4] text-ink">
      {parts.map((part, index) =>
        part.person ? (
          <Link
            key={`${index}-${part.text}`}
            to={`/app/u/${part.person.username}`}
            className="font-bold text-accent hover:underline"
          >
            {part.text}
          </Link>
        ) : (
          <span key={`${index}-${part.text}`}>{part.text}</span>
        ),
      )}
    </p>
  );
}

/**
 * The sticker a respond or a note wears.
 *
 * A sticker is a picture with no frame, no bubble and no caption, drawn at 88
 * points rather than the width of a photograph — see `_RespondSticker`, which
 * takes the size from `ChatStickerCard`: a run of stickers should read as a
 * conversation rather than as a page of art. The address is the catalogue's and
 * is already public, so this asks for it directly instead of through a token.
 */
export function RespondSticker({ sticker }: { sticker: Sticker }) {
  if (!sticker.url) return null;
  return (
    <img
      src={sticker.url}
      alt={sticker.name || "Sticker"}
      width={88}
      height={88}
      loading="lazy"
      decoding="async"
      className="size-[88px] object-contain"
    />
  );
}

/**
 * The one upload a respond carries: a picture, or a voice note.
 *
 * Ported from `RespondMedia`. A picture is bounded in height the way a convo's
 * is — a respond sits in a sheet, not on a page — and a voice note is the
 * browser's own player, because this app already plays sound notes that way and
 * a second hand-built player would be a second set of controls to keep right.
 */
export function RespondMedia({ asset }: { asset: Asset }) {
  if (asset.kind === "image") {
    return (
      <AuthedImage
        src={asset.content_url}
        alt={asset.original_name || "Picture"}
        className="max-h-[220px] max-w-full rounded-[12px]"
      />
    );
  }
  if (asset.kind === "video") {
    return (
      <AuthedVideo
        src={asset.content_url}
        controls
        className="max-h-[220px] w-full max-w-[260px] rounded-[12px] bg-[rgb(0_0_0_/_0.08)]"
      />
    );
  }
  if (asset.kind === "voice" || asset.kind === "audio") {
    return <RespondAudio src={asset.content_url} />;
  }
  return (
    <div className="flex items-center gap-2 text-[12px] text-dim">
      <ImageOff className="size-4" aria-hidden />
      {asset.original_name || "An upload"}
    </div>
  );
}

function RespondAudio({ src }: { src: string | null }) {
  const media = useMediaUrl(src);
  if (!src) return null;
  if (media.loading) return <div className="skeleton h-10 w-[240px] max-w-full rounded-full" />;
  if (media.failed || !media.src) return <p className="text-[12px] text-dim">This sound could not be loaded.</p>;
  return <audio controls src={media.src} className="h-10 w-full max-w-[260px]" />;
}