import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  Bookmark,
  EllipsisVertical,
  Heart,
  ImageOff,
  MapPin,
  MessageCircle,
  Pause,
  Play,
  Share2,
  Tag,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { AuthedImage, AuthedVideo } from "@/components/media/Media";
import { Modal } from "@/components/overlays/Modal";
import { VerifiedTick } from "@/components/icons/Tick";
import { cn } from "@/utils/cn";
import { count, duration, timeAgoShort } from "@/utils/format";
import { errorMessage } from "@/utils/errors";
import { usePlayer } from "@/hooks/usePlayer";
import { useToast } from "@/hooks/useToast";
import { useLiveRings } from "@/hooks/useLiveRings";
import { dropsService } from "@/services/drops.service";
import { CommentsModal } from "./CommentsModal";
import { DropMenu } from "./DropMenu";
import { frameBox } from "./frame";
import { KeepButton } from "./KeepButton";
import { PollBlock } from "./PollBlock";
import { SensitiveVeil } from "./SensitiveVeil";
import { ShareSheet } from "./ShareSheet";
import { StatsSheet } from "./StatsSheet";
import {
  dropBase,
  dropIsClip,
  dropIsGallery,
  dropIsPoll,
  dropIsSound,
  dropPictures,
  dropStill,
  reportDropLook,
} from "./model";
import { useSaved } from "@/hooks/useSaved";
import { savedKindOf } from "@/store/saved";
import { useClipSound } from "@/hooks/useClipSound";
import type { Asset, Drop, Poll, UserCard } from "@/types/api";

/**
 * One drop, drawn the way `DropCard` in `screens/drops.dart` draws it.
 *
 * The card's own order is the app's and is the whole of its argument: the
 * header, then the words, then *who the words name*, then the thing itself —
 * a poll's answers, a picture, a sound — then the sound's playlists, then the
 * row of acts, then the first respond, then the stamp. Nothing here was placed
 * by taste; see `build` in the app for the same list in the same order.
 *
 * Three of the app's behaviours are wired to be the same behaviour rather than
 * a look-alike:
 *
 * - **A look is counted from the card that filled the eye.** `Drop.seen` in the
 *   app, and the web had no equivalent at all — which is why every post's
 *   Views number was the count of people who had opened it in the phone app.
 *   The observer at the foot of this file reports a look once, when most of the
 *   card has been on screen, and `reportDropLook` keeps the once-a-day rule and
 *   the "never my own" rule that the app keeps.
 * - **A like is the same call from the button and from the double tap.** Two
 *   doors onto one `POST`, never two states to keep in step — and the heart that
 *   flies up is drawn from the same answer the button's count comes from.
 * - **A marked post is covered until it is opened**, from the server's own
 *   `sensitive`/`openable` pair rather than from a setting guessed here. See
 *   `SensitiveVeil`.
 */
export function DropCard({
  drop: incoming,
  onRemoved,
  onSavedChange,
  onChanged,
  detailed,
  asPost,
  read = true,
  onOpen,
}: {
  drop: Drop;
  /**
   * Where a press on this card's own picture goes, when it has somewhere to go.
   *
   * A card with a clip has: it is watched in the walk, so a clip in the feed —
   * a Vibe or a plain video — is a card a thumb opens *there* rather than one
   * that only plays where it sits. The owner's report of 2026-11-06: *"app me
   * drops ke for you post me video post par click karne par ek dusare page me wo
   * video open hota hai waise isme nahi ho raha hai"*. A picture with no clip in
   * it has nowhere to go and the app does nothing on a tap there either — a card
   * given no `onOpen` is a card with no such handler at all, so a still is
   * exactly as it was rather than newly tappable into nowhere.
   *
   * A press and not a double press: the double is the felt, which this card
   * already has, and the two are told apart by waiting out the second press
   * rather than by doing both.
   */
  onOpen?: () => void;
  /** It is gone from this reader's feed — hidden, or taken down by its author. */
  onRemoved?: (id: string) => void;
  onSavedChange?: (id: string, saved: boolean) => void;
  /** Something about this row changed and the list should ask again. */
  onChanged?: () => void;
  /** A drop's own page: every word of it, none of it folded. */
  detailed?: boolean;
  /**
   * Whether this card is being *read* rather than scrolled past.
   *
   * The app folds a long post where it is read and leaves it whole where it is
   * scrolled past — `ReadMoreText` and `asPost` — because a feed of folded posts
   * is a feed nobody has to open, and a post nobody can finish on its own page
   * is a post whose page has no reason to exist.
   */
  asPost?: boolean;
  /**
   * Whether this card is being read by somebody whom a look belongs to.
   *
   * The app's `DropCard.read`: a feed and a post's own page count a look, a
   * board that is built all at once and scrolled past does not. False means the
   * observer below is never started, so no `seen` is sent for a number the
   * reader did not earn by opening anything.
   */
  read?: boolean;
}) {
  const [drop, setDrop] = useState(incoming);
  const [liked, setLiked] = useState(Boolean(incoming.liked));
  const [likes, setLikes] = useState(incoming.likes ?? 0);
  const [comments, setComments] = useState(incoming.comments ?? 0);
  const [shares, setShares] = useState(incoming.shares ?? 0);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [statsOpen, setStatsOpen] = useState(false);
  const [whoOpen, setWhoOpen] = useState(false);
  const [boom, setBoom] = useState(false);
  const { toast } = useToast();
  const player = usePlayer();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { has, toggle: toggleSaved } = useSaved();
  const saved = has(savedKindOf(drop), drop.id);
  // The ring on the author's face — their day is still unwatched. `drops.dart`
  // rings it on the feed the same way the person page and the convo row do.
  const live = useLiveRings();

  // A card in a list is reused when the list changes under it, so everything
  // this card keeps of its own is re-seeded from the row it was handed — the
  // app does the same in `didUpdateWidget`.
  useEffect(() => {
    setDrop(incoming);
    setLiked(Boolean(incoming.liked));
    setLikes(incoming.likes ?? 0);
    setComments(incoming.comments ?? 0);
    setShares(incoming.shares ?? 0);
  }, [incoming]);

  const pictures = dropPictures(drop);
  const gallery = dropIsGallery(drop);
  const soundtrack = drop.soundtrack;

  /**
   * Report a look when this card is the one filling the eye.
   *
   * Once per card mount, from the observer below, and the rules that make it a
   * *look* rather than a page impression — never my own post, one a day — are
   * kept in `reportDropLook` beside the address they act on.
   */
  const seen = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    if (!read) return;
    const node = seen.current;
    if (!node) return;
    let done = false;
    const watcher = new IntersectionObserver(
      (entries) => {
        if (done) return;
        const entry = entries[0];
        if (!entry?.isIntersecting) return;
        if (entry.intersectionRatio < 0.6) return;
        done = true;
        void reportDropLook(drop);
        watcher.disconnect();
      },
      { threshold: [0.6] },
    );
    watcher.observe(node);
    return () => watcher.disconnect();
  }, [drop, read]);

  async function like(next?: boolean) {
    const want = next ?? !liked;
    if (want === liked) return;
    setLiked(want);
    setLikes((value) => Math.max(0, value + (want ? 1 : -1)));
    try {
      const answer = await dropsService.like(dropBase(drop), drop.id, want);
      setLiked(answer.liked);
      setLikes(answer.likes);
    } catch (error) {
      setLiked(!want);
      setLikes((value) => Math.max(0, value + (want ? -1 : 1)));
      toast({ title: "That like did not stick", description: errorMessage(error), tone: "error" });
    }
  }

  /** The double tap: the same call as the button, with a heart to say so. */
  function doubleTap() {
    setBoom(true);
    window.setTimeout(() => setBoom(false), 620);
    if (!liked) void like(true);
  }

  async function toggleSave() {
    const now = await toggleSaved(savedKindOf(drop), drop.id, !saved);
    onSavedChange?.(drop.id, now);
  }

  /**
   * The sound this card plays, in the app's own two shapes.
   *
   * A sound drop is its audio and nothing else, and the row the card draws for
   * it is the whole of the card. The music a *picture* drop carries is a
   * different thing: it is worn on the photograph, plays while the card is the
   * one on screen, and stops when the reader scrolls past. Both go through this
   * account's one player, so a sound started here is what the bar at the foot of
   * the page is holding.
   */
  function playSound() {
    const url = drop.asset?.content_url;
    if (!url) {
      toast({ title: "The audio is not here any more.", tone: "error" });
      return;
    }
    player.play({
      id: drop.id,
      title: drop.title?.trim() || "Audio",
      artist: drop.author.name || drop.author.username,
      stream_url: url,
      cover_url: drop.cover?.content_url || drop.author.avatar,
      seconds: drop.asset?.duration_ms ? Math.round(drop.asset.duration_ms / 1000) : undefined,
    });
  }

  function playSoundtrack() {
    if (!soundtrack?.content_url) return;
    player.play({
      id: `soundtrack:${drop.id}`,
      title: drop.author.name || drop.author.username,
      artist: "Original audio",
      stream_url: soundtrack.content_url,
      cover_url: drop.author.avatar,
      seconds: soundtrack.duration_ms ? Math.round(soundtrack.duration_ms / 1000) : undefined,
    });
  }

  const soundtrackPlaying = player.current?.id === `soundtrack:${drop.id}` && player.playing;
  const soundPlaying = player.current?.id === drop.id && player.playing;
  const name = drop.author.name || drop.author.username;
  const poll: Poll | null = drop.poll ?? null;
  const visual = Boolean((drop.asset && pictures.length && !dropIsSound(drop)) || dropIsSound(drop));

  const acts = (
    <div className="flex items-center px-2 pb-1 pt-1">
      <Act
        label="Felt"
        count={drop.likes_off ? null : likes}
        on={liked}
        onClick={() => void like()}
        glyph={<Heart className={cn("size-[19px]", liked && "fill-current")} />}
      />
      <Act
        label="Comments"
        count={comments}
        onClick={() => setCommentsOpen(true)}
        glyph={<MessageCircle className="size-[19px]" />}
      />
      <Act
        label="Share"
        count={shares}
        onClick={() => setShareOpen(true)}
        glyph={<Share2 className="size-[19px]" />}
      />
      <Act
        label={saved ? "Saved" : "Save"}
        on={saved}
        onClick={() => void toggleSave()}
        glyph={<Bookmark className={cn("size-[19px]", saved && "fill-current")} />}
        className="ml-auto"
      />
    </div>
  );

  return (
    <article
      ref={seen}
      className={cn(
        "card overflow-hidden transition duration-200",
        detailed ? "rounded-[20px]" : "rounded-[16px] hover:shadow-[0_12px_32px_rgb(19_19_26_/_0.06)]",
      )}
    >
      <header className="flex items-center gap-2.5 px-3.5 pb-2 pt-2.5">
        <Link to={`/app/u/${drop.author.username}`} className="shrink-0" aria-label={name}>
          <Avatar user={drop.author} size={36} ring={live.has(String(drop.author.id))} />
        </Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <Link
              to={`/app/u/${drop.author.username}`}
              className="truncate text-[13.5px] font-bold tracking-[-0.1px] hover:underline"
            >
              {name}
            </Link>
            {drop.author.verified ? <VerifiedTick size={13} /> : null}
          </div>
          {/* The second line is drawn only when there is something on it: a drop
              with no place has no second line rather than an empty one. */}
          {drop.place ? (
            <p className="mt-px flex items-center gap-1 truncate text-[11px] text-dim">
              <MapPin className="size-3 shrink-0" aria-hidden />
              {drop.place}
            </p>
          ) : null}
          {/* A line of its own, because "with Aarav and 2 others" is longer than
              the stamp it would sit beside and the one thing it may not do is
              push anything else off the card. */}
          {drop.collab?.people?.length ? (
            <p className="mt-0.5 truncate text-[11px] text-dim">
              with {drop.collab.people.map((person) => person.name || person.username).join(", ")}
            </p>
          ) : null}
        </div>
        {/* The invitation stands to the left of the �<r, and only where it is an
            invitation rather than a repeat. `author_kept` is `null` when the
            page did not say, which draws nothing. */}
        {!drop.mine && drop.author_kept === false ? <KeepButton author={drop.author} known /> : null}
        <button
          type="button"
          onClick={() => setMenuOpen(true)}
          className="icon-btn -mr-1.5 size-9"
          aria-label="Post options"
        >
          <EllipsisVertical className="size-4" />
        </button>
      </header>

      {drop.asset && pictures.length && !dropIsSound(drop) ? (
        <Media
          drop={drop}
          pictures={pictures}
          gallery={gallery}
          boom={boom}
          soundtrackPlaying={soundtrackPlaying}
          onDoubleTap={doubleTap}
          onOpen={onOpen}
          onSoundtrack={playSoundtrack}
          onWho={() => setWhoOpen(true)}
        />
      ) : null}

      {dropIsSound(drop) ? <SoundCard drop={drop} playing={soundPlaying} onPlay={playSound} /> : null}

      {visual ? acts : null}

      {drop.body?.trim() ? (
        <div className="px-3.5 pb-1.5 pt-1">
          <Words body={drop.body} asPost={Boolean(asPost)} poll={dropIsPoll(drop)} />
        </div>
      ) : null}

      {/* Who it names, under what it says and above what it shows: the line
          belongs to the words and reads as part of them. */}
      {drop.mentions?.length ? (
        <div className="flex flex-wrap gap-x-2.5 gap-y-0.5 px-3.5 pb-2">
          {drop.mentions.map((person) => (
            <Link
              key={person.id}
              to={`/app/u/${person.username}`}
              className="max-w-full truncate text-[13px] font-semibold text-accent hover:underline"
            >
              @{person.username}
            </Link>
          ))}
        </div>
      ) : null}

      {dropIsSound(drop) && drop.shelves?.length ? (
        <div className="flex flex-wrap gap-2 px-3.5 pb-2">
          {drop.shelves.map((shelf) => (
            <Link
              key={shelf.id}
              to={`/app/audio/${shelf.id}`}
              className="flex max-w-[190px] items-center gap-1.5 rounded-full bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-2.5 py-1.5 text-[12.5px] font-bold text-accent"
            >
              <Volume2 className="size-[15px] shrink-0" aria-hidden />
              <span className="truncate">{shelf.name}</span>
            </Link>
          ))}
        </div>
      ) : null}

      {poll ? (
        <PollBlock
          drop={drop}
          poll={poll}
          onPoll={(next) => {
            setDrop((current) => ({ ...current, poll: next }));
            onChanged?.();
          }}
        />
      ) : null}

      {!visual ? acts : null}

      {drop.peek ? (
        <button
          type="button"
          onClick={() => setCommentsOpen(true)}
          className="flex w-full items-center gap-2.5 px-3.5 pb-2 pt-1 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_3%,transparent)]"
        >
          <Avatar user={drop.peek.author} size={28} />
          <span className="min-w-0 flex-1 text-[12.5px] leading-[1.35] text-dim">
            <span className="font-bold text-ink">{nameOf(drop.peek.author)} </span>
            {drop.peek.author.verified ? <VerifiedTick size={12} /> : null}
            <span className="line-clamp-2">{drop.peek.body}</span>
          </span>
          <span className="num shrink-0 text-[11px] text-dim">{commentWord(comments)}</span>
        </button>
      ) : null}

      {/* The stamp is the last line of the card and the only thing on it: a
          footnote, and reading it is never the reason somebody is here. */}
      <p className="px-3.5 pb-2.5 pt-1 text-[10.5px] text-[color-mix(in_srgb,var(--ink)_38%,transparent)]">
        {timeAgoShort(drop.created_at)}
      </p>

      <DropMenu
        drop={drop}
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        onRemoved={() => onRemoved?.(drop.id)}
        onEdit={() => navigate(`/app/drops?edit=${drop.id}`)}
        onStats={() => setStatsOpen(true)}
        onChanged={() => {
          void queryClient.invalidateQueries({ queryKey: ["drops"] });
          onChanged?.();
        }}
      />

      <ShareSheet
        drop={drop}
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        onShared={(sent) => {
          setShares((value) => value + sent);
          onChanged?.();
        }}
      />

      <StatsSheet drop={drop} open={statsOpen} onClose={() => setStatsOpen(false)} />

      <WhoIsIn open={whoOpen} people={drop.mentions ?? []} onClose={() => setWhoOpen(false)} />

      <CommentsModal
        drop={drop}
        open={commentsOpen}
        onClose={() => setCommentsOpen(false)}
        onCommented={() => {
          setComments((value) => value + 1);
          onChanged?.();
        }}
      />
    </article>
  );
}

function nameOf(user: UserCard) {
  return user.name || user.username;
}

/** "1 comment" / "4 comments" — `dropsComments*` in the app's own words. */
function commentWord(value: number) {
  return value === 1 ? "1 comment" : `${count(value)} comments`;
}

/**
 * The words, with `#tags` and `@handles` as doors.
 *
 * A tag opens the tag's own feed and a handle opens that person — the two things
 * the app's `hashtagSpans` and its mention line do — and neither is invented
 * here: `#tag` is only a link when the server has a feed for it, which is the
 * same `/tags/{tag}/` route the app's `TagFeedScreen` reads. A `#` inside a word
 * is left alone, because a tag is a word that starts with one.
 */
function Words({ body, asPost, poll }: { body: string; asPost: boolean; poll: boolean }) {
  const nodes = useMemo(() => {
    const out: ReactNode[] = [];
    const pattern = /(^|\s)([#@][\p{L}\p{N}_.]{1,60})/gu;
    let at = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(body))) {
      const start = match.index + match[1].length;
      if (start > at) out.push(body.slice(at, start));
      const word = match[2];
      const handle = word.slice(1);
      out.push(
        <Link
          key={`${start}:${word}`}
          to={word.startsWith("#") ? `/app/tags/${encodeURIComponent(handle)}` : `/app/u/${handle}`}
          className="font-bold text-accent hover:underline"
        >
          {word}
        </Link>,
      );
      at = start + word.length;
    }
    if (at < body.length) out.push(body.slice(at));
    return out;
  }, [body]);

  return (
    <p
      className={cn(
        "whitespace-pre-wrap break-words",
        poll ? "text-[15.5px] font-bold" : "text-[14px]",
        "leading-[1.5]",
        !asPost && "line-clamp-[8]",
      )}
    >
      {nodes}
    </p>
  );
}

/** One button in the row under a post: a mark, a count, and a word when it is on. */
function Act({
  label,
  count: value,
  on,
  onClick,
  glyph,
  className,
}: {
  label: string;
  count?: number | null;
  on?: boolean;
  onClick: () => void;
  glyph: ReactNode;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={value === null || value === undefined ? label : `${label}, ${value}`}
      className={cn(
        "inline-flex min-h-9 items-center gap-1.5 rounded-[20px] px-2.5 py-1.5 text-[12.5px] font-bold transition",
        on ? "text-accent" : "text-dim hover:text-ink",
        className,
      )}
    >
      {glyph}
      {value === null || value === undefined ? (
        on ? <span className="text-accent">{label}</span> : null
      ) : (
        <span className="num">{count(value)}</span>
      )}
    </button>
  );
}

/**
 * The picture, the clip, or the run of pictures — with the marks that belong on
 * the picture itself.
 *
 * The app's *tag* pill is drawn on the photograph rather than beside it, because
 * the tag is about the picture and not about the post; so is the music a picture
 * drop carries, which is played from the picture's own lower edge rather than
 * from a second player card under it. A marked post puts all of this behind the
 * veil: nothing inside is built until the cover is lifted, which is why a
 * covered card never fetches the full upload.
 *
 * The shape is reserved from the first frame from the server's own `ratio`, so a
 * feed whose pictures are still arriving does not jump under somebody's finger.
 */
function Media({
  drop,
  pictures,
  gallery,
  boom,
  soundtrackPlaying,
  onDoubleTap,
  onOpen,
  onSoundtrack,
  onWho,
}: {
  drop: Drop;
  pictures: Asset[];
  gallery: boolean;
  boom: boolean;
  soundtrackPlaying: boolean;
  onDoubleTap: () => void;
  onOpen?: () => void;
  onSoundtrack: () => void;
  onWho: () => void;
}) {
  const [page, setPage] = useState(0);
  const strip = useRef<HTMLDivElement | null>(null);
  const frame = useRef<HTMLDivElement | null>(null);
  const player = useRef<HTMLVideoElement | null>(null);
  /**
   * The press that is waiting to find out whether a second one is coming.
   *
   * A single press opens and a double press feels, and the two share one
   * surface: an open that acted at once would be an open that has already
   * decided there was no second press, so the open waits out the double —
   * which is the same 220ms the walk uses for the same reason.
   */
  const press = useRef<number | null>(null);
  useEffect(() => () => {
    if (press.current) window.clearTimeout(press.current);
  }, []);
  function singlePress() {
    if (!onOpen) return;
    if (press.current) window.clearTimeout(press.current);
    press.current = window.setTimeout(() => {
      press.current = null;
      onOpen();
    }, 220);
  }
  function doublePress() {
    if (press.current) {
      window.clearTimeout(press.current);
      press.current = null;
    }
    onDoubleTap();
  }
  // The app's clip rule, in the feed's own words: silent unless the phone was
  // told otherwise, and playing only while it is the card in front of the
  // reader. Two answers, both held by `sound.ts` and by the observer below.
  const { muted, toggle: toggleMute } = useClipSound();
  const [near, setNear] = useState(false);
  const [inView, setInView] = useState(false);

  const taps = drop.mentions?.length ? drop.mentions.length : 0;
  // The same test the page asks before it hands this card somewhere to open:
  // see `dropIsClip`.
  const clip = dropIsClip(drop);

  /**
   * The clip is fetched when the card comes near the screen and played only
   * while most of it is on it — the app's `_inFront` and `_appAwake`.
   *
   * This is the difference between a feed and a download queue. Every video
   * card used to mount its own player and start it, so opening Drops fetched
   * every clip in the page at once and played all of them at once. Nothing a
   * reader cannot see is asked for, and nothing they have left behind keeps
   * talking.
   */
  useEffect(() => {
    if (!clip) return;
    const node = frame.current;
    if (!node || typeof IntersectionObserver === "undefined") {
      setNear(true);
      setInView(true);
      return;
    }
    const watcher = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry) return;
        if (entry.isIntersecting) setNear(true);
        setInView(entry.intersectionRatio >= 0.6);
      },
      { threshold: [0, 0.6, 1] },
    );
    watcher.observe(node);
    return () => watcher.disconnect();
  }, [clip]);

  useEffect(() => {
    const element = player.current;
    if (!element) return;
    if (!inView) {
      element.pause();
      return;
    }
    // `play()` is only ever a request: a browser that refuses an unmuted
    // autoplay leaves the clip on its still, which is what it looks like.
    void element.play().catch(() => undefined);
  }, [inView, near]);

  function go(next: number) {
    const node = strip.current;
    if (!node) return;
    node.scrollTo({ left: node.clientWidth * next, behavior: "smooth" });
  }

  const veilNote = drop.mine ? "Yours. Everybody else sees it covered." : null;

  return (
    <SensitiveVeil
      sensitive={drop.sensitive}
      openable={drop.openable}
      cover={dropStill(drop)}
      note={veilNote}
      hideable
      aspect={drop.ratio ?? undefined}
      // The cover has to be the box the picture is drawn in, or the card
      // changes height the moment somebody lifts it — so it is the same box,
      // worked out by the same function: see `frameBox`.
      frame={frameBox(drop.ratio)}
    >
      <div className="relative">
        <div
          ref={frame}
          className="relative overflow-hidden bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]"
          style={frameBox(drop.ratio)}
          onClick={onOpen ? singlePress : undefined}
          onDoubleClick={(event) => {
            event.preventDefault();
            doublePress();
          }}
        >
          {clip ? (
            // A clip the poster dropped as a single upload plays where the card
            // would otherwise freeze on its poster frame — but only while it is
            // the card in front of the reader, and silent unless the speaker
            // was turned on. The still underneath is what the card shows before
            // the bytes arrive, which is the app's `dropPictureTile` order.
            <div className="relative size-full">
              {drop.asset?.thumbnail_url ? (
                <AuthedImage
                  src={drop.asset.thumbnail_url}
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                  quiet
                />
              ) : null}
              {near ? (
                <AuthedVideo
                  src={drop.asset?.content_url ?? null}
                  className="relative size-full object-cover"
                  controls={false}
                  autoPlay={inView}
                  loop
                  muted={muted}
                  quiet
                  videoRef={player}
                />
              ) : null}
              <button
                type="button"
                // The press is about the speaker and not about the card: a
                // mute that opened the walk instead is a button that did the
                // one thing it was not for.
                onClick={(event) => {
                  event.stopPropagation();
                  toggleMute();
                }}
                aria-label={muted ? "Unmute" : "Mute"}
                aria-pressed={!muted}
                className="absolute end-2.5 top-2.5 flex size-9 items-center justify-center rounded-full bg-[rgb(8_8_12_/_0.52)] text-white backdrop-blur-sm transition hover:bg-[rgb(8_8_12_/_0.68)]"
              >
                {muted ? <VolumeX className="size-4" aria-hidden /> : <Volume2 className="size-4" aria-hidden />}
              </button>
            </div>
          ) : gallery ? (
            <>
              <div
                ref={strip}
                onScroll={(event) => {
                  const node = event.currentTarget;
                  if (!node.clientWidth) return;
                  setPage(Math.round(node.scrollLeft / node.clientWidth));
                }}
                className="no-scrollbar flex size-full snap-x snap-mandatory overflow-x-auto"
              >
                {pictures.map((picture, index) => (
                  <div key={`${picture.content_url}:${index}`} className="size-full shrink-0 snap-center">
                    <div className="relative size-full">
                      {/* The small copy first and the full one over it, which is
                          the app's `dropPictureTile`: a picture on the screen
                          before a large one has crossed the network. The full
                          copy is only asked for on the page being looked at. */}
                      <AuthedImage
                        src={picture.thumbnail_url || picture.content_url}
                        alt={drop.body ? `Photo from ${nameOf(drop.author)}` : "Photo"}
                        className="size-full object-cover"
                      />
                      {index === page && picture.thumbnail_url && picture.content_url ? (
                        <AuthedImage
                          src={picture.content_url}
                          alt=""
                          className="absolute inset-0 size-full object-cover"
                          quiet
                        />
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
              {pictures.length > 1 ? (
                <div className="pointer-events-none absolute inset-x-0 bottom-2.5 flex justify-center">
                  <div className="flex items-center gap-1.5 rounded-full bg-[rgb(8_8_12_/_0.38)] px-2 py-1.5 backdrop-blur-sm">
                    {pictures.map((_, index) => (
                      <span
                        key={`dot:${index}`}
                        className={cn(
                          "size-1.5 rounded-full bg-white transition",
                          page === index ? "opacity-100" : "opacity-45",
                        )}
                      />
                    ))}
                  </div>
                </div>
              ) : null}
              {pictures.length > 1 ? (
                <span className="pointer-events-none absolute end-2.5 top-2.5 rounded-full bg-[rgb(8_8_12_/_0.55)] px-2 py-0.5 text-[10.5px] font-bold text-white backdrop-blur-sm">
                  {page + 1}/{pictures.length}
                </span>
              ) : null}
              {page > 0 ? (
                <button
                  type="button"
                  onClick={() => go(page - 1)}
                  aria-label="Previous picture"
                  className="absolute inset-y-0 left-0 w-10"
                />
              ) : null}
              {page < pictures.length - 1 ? (
                <button
                  type="button"
                  onClick={() => go(page + 1)}
                  aria-label="Next picture"
                  className="absolute inset-y-0 right-0 w-10"
                />
              ) : null}
            </>
          ) : drop.asset?.content_url ? (
            <div className="relative size-full">
              <AuthedImage
                src={drop.asset.thumbnail_url || drop.asset.content_url}
                alt={drop.body ? `Photo from ${nameOf(drop.author)}` : "Photo"}
                className="size-full object-cover"
              />
              {drop.asset.thumbnail_url ? (
                <AuthedImage
                  src={drop.asset.content_url}
                  alt=""
                  className="absolute inset-0 size-full object-cover"
                  quiet
                />
              ) : null}
            </div>
          ) : (
            <div className="flex size-full items-center justify-center text-dim">
              <ImageOff className="size-7" aria-hidden />
            </div>
          )}

          {/* A single tap on a picture that names somebody asks who is in it.
              Only where the mention line is not already on the card — see the
              app's `dropTagsOn`: two doors onto the same list is one too many. */}
          {taps > 1 ? (
            <button
              type="button"
              onClick={onWho}
              aria-label="Who is in it"
              className="absolute inset-0"
            />
          ) : null}

          {drop.tag ? (
            <span className="absolute left-2.5 top-2.5 flex items-center gap-1 rounded-full bg-[rgb(8_8_12_/_0.62)] px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
              <Tag className="size-3" aria-hidden />
              {drop.tag}
            </span>
          ) : null}

          {/* The music a picture drop carries, worn on the photograph: a
              play/pause button and a very small name, with no plate behind them
              beyond the single-tone scrim the house uses over any picture. */}
          {drop.soundtrack?.content_url ? (
            <button
              type="button"
              onClick={onSoundtrack}
              className="absolute inset-x-0 bottom-0 flex items-center gap-2 bg-[rgb(8_8_12_/_0.42)] px-3 py-2 text-left text-white backdrop-blur-sm"
            >
              {soundtrackPlaying ? <Pause className="size-3.5 shrink-0" /> : <Play className="size-3.5 shrink-0" />}
              <span className="min-w-0 flex-1 truncate text-[11.5px] font-semibold">
                {nameOf(drop.author)} · Original audio
              </span>
              {drop.soundtrack.duration_ms ? (
                <span className="num shrink-0 text-[10.5px] text-white/75">
                  {duration(drop.soundtrack.duration_ms / 1000)}
                </span>
              ) : null}
            </button>
          ) : null}

          {boom ? (
            <span className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
              <Heart className="size-[118px] fill-white text-white drop-shadow-[0_6px_20px_rgb(0_0_0_/_0.45)] animate-fade-up" />
            </span>
          ) : null}
        </div>
      </div>
    </SensitiveVeil>
  );
}

/**
 * A drop that is nothing but sound.
 *
 * The cover across the top where there is one, then the name, the kind, and a
 * full-width player — one card stretched to whatever it is given, which is what
 * the app draws. No cover means the card opens on the name itself, because the
 * player below already carries the big disc.
 */
function SoundCard({ drop, playing, onPlay }: { drop: Drop; playing: boolean; onPlay: () => void }) {
  const still = dropStill(drop);
  const seconds = drop.asset?.duration_ms ? drop.asset.duration_ms / 1000 : null;

  return (
    <div className="mt-1 px-2.5 pb-1.5">
      <div className="overflow-hidden rounded-[22px] border border-line bg-card">
        {still ? (
          <div className="relative aspect-video">
            <AuthedImage src={still.content_url} alt="" className="size-full object-cover" />
            {drop.sound_kind ? (
              <span className="absolute left-3 top-3 rounded-full bg-[rgb(8_8_12_/_0.62)] px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
                {soundKind(drop.sound_kind)}
              </span>
            ) : null}
          </div>
        ) : null}
        <div className="px-4 py-3.5">
          <p className="line-clamp-2 text-[19px] font-extrabold leading-[1.2] tracking-[-0.2px]">
            {drop.title?.trim() || "Audio"}
          </p>
          {!still && drop.sound_kind ? (
            <p className="mt-1 text-[13px] font-semibold text-dim">{soundKind(drop.sound_kind)}</p>
          ) : null}
          <button
            type="button"
            onClick={onPlay}
            className="mt-3 flex w-full items-center gap-3 rounded-[14px] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] px-3 py-2.5 text-left"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-on-accent">
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-bold">
                {playing ? "Playing" : "Play"}
              </span>
              <span className="block text-[11px] text-dim">
                {seconds ? duration(seconds) : "In the audio bar"}
              </span>
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}

/** The app's `soundKindLabel`: the server's own word for the kind of sound. */
function soundKind(kind: string) {
  const words: Record<string, string> = {
    song: "Music",
    voice: "Voice",
    podcast: "Podcast",
    audiobook: "Audiobook",
    live: "Live",
  };
  return words[kind] ?? "Audio";
}

/** The sheet a tap on a picture opens: who the post names. `openDropTags`. */
function WhoIsIn({
  open,
  people,
  onClose,
}: {
  open: boolean;
  people: UserCard[];
  onClose: () => void;
}) {
  const navigate = useNavigate();
  return (
    <Modal open={open} onClose={onClose} title="Who is in it" size="sm">
      <div className="pb-2">
        {people.map((person) => (
          <button
            key={person.id}
            type="button"
            onClick={() => {
              onClose();
              navigate(`/app/u/${person.username}`);
            }}
            className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
          >
            <Avatar user={person} size={36} />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-semibold">{nameOf(person)}</span>
              <span className="block truncate text-[12px] text-dim">@{person.username}</span>
            </span>
          </button>
        ))}
      </div>
    </Modal>
  );
}
