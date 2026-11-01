import { useRef } from "react";
import { BadgeCheck, PlayCircle, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { AuthedImage } from "@/components/Media";
import { cn } from "@/lib/cn";
import { noticeGlyph, noticeRowLine, noticeWho, type Notice } from "./model";

/** How far sideways a pointer has to move before a hold becomes a swipe. */
const SWIPE = 40;

interface NoticeBannerProps {
  notice: Notice | null;
  onOpen: (notice: Notice) => void;
  onDismiss: () => void;
}

/**
 * Somebody said something, over whatever is on screen.
 *
 * Ported from `app/lib/screens/notice_banner.dart`, geometry and all: a strip
 * across the top with the face, the name, one line, and a tap to go there. It
 * is drawn once, above every page, and it is deliberately not a route — a
 * notice must not take the page somebody is on away from them.
 *
 * The whole of this file is a decision already made. What arrives here has
 * survived `NoticeProvider`: notifications are on, the tab is in front of
 * somebody, the conversation is not muted, and it is not the conversation they
 * are already reading. Nothing here decides anything except where the card sits
 * and what a tap does.
 */
export function NoticeBanner({ notice, onOpen, onDismiss }: NoticeBannerProps) {
  const start = useRef<{ x: number; y: number } | null>(null);
  const swiped = useRef(false);

  if (!notice) return null;

  const who = noticeWho(notice);
  const line = noticeRowLine(notice);
  const Glyph = noticeGlyph(notice.kind);

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[120] px-3"
      style={{ paddingTop: "max(8px, env(safe-area-inset-top))" }}
    >
      <div
        // Re-keyed per notice so the slide-in runs for each new line rather than
        // only for the first one in a queue.
        key={`${notice.thread}:${notice.ordinal}:${notice.at ?? ""}`}
        role="status"
        aria-live="polite"
        tabIndex={0}
        onPointerDown={(event) => {
          start.current = { x: event.clientX, y: event.clientY };
          swiped.current = false;
        }}
        onPointerMove={(event) => {
          const from = start.current;
          if (!from) return;
          const dx = event.clientX - from.x;
          const dy = event.clientY - from.y;
          // A horizontal drag is what puts the strip away, from anywhere along
          // it, either way — a strip that has been read is a strip somebody
          // wants gone, and the thumb that read it is already on the card.
          if (Math.abs(dx) > SWIPE && Math.abs(dx) > Math.abs(dy)) {
            start.current = null;
            swiped.current = true;
            onDismiss();
          }
        }}
        onPointerUp={() => {
          start.current = null;
        }}
        onPointerCancel={() => {
          start.current = null;
        }}
        onClick={() => {
          // A swipe that has been recognised has already beaten the click out,
          // so a swipe can never open what it is putting away.
          if (swiped.current) {
            swiped.current = false;
            return;
          }
          onOpen(notice);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onOpen(notice);
          }
          if (event.key === "Escape") onDismiss();
        }}
        className={cn(
          "xelvic-notice-in pointer-events-auto cursor-pointer select-none overflow-hidden",
          "rounded-[20px] border border-line bg-card",
          "shadow-[0_18px_50px_-20px_rgba(0,0,0,0.55)]",
        )}
      >
        <div className="flex items-center gap-[11px] py-3 pl-[14px] pr-1.5">
          <Avatar src={notice.from.avatar} name={who} size={42} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1">
              <span className="truncate text-[16px] font-bold tracking-[-0.2px] text-ink">
                {who}
              </span>
              {notice.from.verified ? (
                <BadgeCheck className="size-4 shrink-0 text-accent" aria-label="Verified" />
              ) : null}
            </div>
            {line ? (
              <div className="mt-0.5 flex items-center gap-[5px]">
                {Glyph ? <Glyph className="size-3.5 shrink-0 text-dim" aria-hidden /> : null}
                <span className="truncate text-[13.5px] text-dim">{line}</span>
              </div>
            ) : null}
          </div>
          <button
            type="button"
            onClick={(event) => {
              // The strip's own tap opens the conversation; the mark on the
              // right puts it away, and those are two different answers.
              event.stopPropagation();
              onDismiss();
            }}
            aria-label="Dismiss"
            className="icon-btn mt-0.5 size-9 shrink-0 text-dim"
          >
            <X className="size-[19px]" />
          </button>
        </div>

        {/* A shared or mentioned post is drawn as the post — the picture and
            the caption, the way it looks when it is opened — under the
            who-said-it line, so the notice looks like the thing it is about
            rather than a sentence describing it. */}
        {notice.card && !notice.media ? (
          <div className="pb-3 pl-[14px] pr-[14px]">
            <PostCard notice={notice} />
          </div>
        ) : notice.media?.thumb ? (
          <div className="pb-3 pl-[14px] pr-[14px]">
            <div className="relative h-[150px] w-full overflow-hidden rounded-[14px] bg-[color-mix(in_srgb,var(--accent)_9%,var(--card))]">
              <AuthedImage
                src={notice.media.thumb}
                alt={notice.media.name || "Attachment"}
                className="h-full w-full"
                loading="eager"
              />
              {notice.media.kind === "video" ? (
                <PlayCircle className="absolute left-1/2 top-1/2 size-10 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow" />
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/**
 * The post a shared or mentioned drop/vibe carries, small.
 *
 * Read off the snapshot the server sent with the notice rather than fetched: a
 * strip is up for four seconds, and one that had to fetch before it could draw
 * the post would spend most of that showing an empty box.
 */
function PostCard({ notice }: { notice: Notice }) {
  const card = notice.card;
  if (!card) return null;
  const username = card.author?.username ?? "";
  const caption = card.body.trim();
  return (
    <div className="flex overflow-hidden rounded-[14px] border border-line bg-[color-mix(in_srgb,var(--ink)_5%,var(--card))]">
      {card.still ? (
        <AuthedImage
          src={card.still}
          alt={username ? `Post by ${username}` : "Post"}
          className="w-[58px] shrink-0"
          loading="eager"
        />
      ) : null}
      <div className="min-w-0 flex-1 px-[11px] py-[9px]">
        {username ? (
          <div className="truncate text-[12.5px] font-bold text-ink">@{username}</div>
        ) : null}
        {caption ? (
          <div className="mt-[3px] line-clamp-2 text-[12.5px] leading-[1.35] text-dim">
            {caption}
          </div>
        ) : null}
        {notice.mention && notice.by ? (
          <div className="mt-1 truncate text-[11.5px] text-dim">
            {notice.by} mentioned you
          </div>
        ) : null}
      </div>
    </div>
  );
}