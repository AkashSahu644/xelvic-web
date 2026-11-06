import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useInfiniteQuery, useQuery, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import {
  ArrowRight,
  BarChart3,
  Bell,
  Bookmark,
  Clapperboard,
  ImagePlus,
  MessageCircle,
  Music2,
  Play,
  Plus,
  Sparkles,
  StickyNote,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { AuthedImage } from "@/components/media/Media";
import { Modal } from "@/components/overlays/Modal";
import { PageHeader } from "@/components/layout/Page";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { VerifiedTick } from "@/components/icons/Tick";
import { DropCard } from "@/features/drops/DropCard";
import { DropComposer, type ComposerMode } from "@/features/drops/DropComposer";
import { EditDrop } from "@/features/drops/EditDrop";
import { SensitiveVeil } from "@/features/drops/SensitiveVeil";
import { VibeViewer } from "@/features/drops/VibeViewer";
import { dropsFeedQuery, dropsVibesQuery } from "@/features/drops/feedQueries";
import {
  FEED_VIBE_SHARE_FALLBACK,
  filledWithVibes,
  mixedFeed,
  railClips,
  shelfOrder,
  walkOf,
} from "@/features/drops/mix";
import { dropIsClip } from "@/features/drops/model";
import { chatService } from "@/services/chat.service";
import { socialService } from "@/services/social.service";
import { cn } from "@/utils/cn";
import { count, timeAgoShort } from "@/utils/format";
import { useTheme } from "@/hooks/useTheme";
import { useWideScreen } from "@/hooks/useWideScreen";
import type { Drop, Page } from "@/types/api";

function Aside() {
  const { design } = useTheme();
  const threads = useQuery({
    queryKey: ["threads-aside"],
    queryFn: () => chatService.threads(),
    staleTime: 20_000,
  });
  const requests = useQuery({
    queryKey: ["requests-count"],
    queryFn: () => socialService.requestCount(),
    retry: false,
  });
  const recent = threads.data?.threads?.slice(0, 4) ?? [];
  const pending = requests.data?.pending ?? 0;

  return (
    <aside className="hidden self-start xl:sticky xl:top-[122px] xl:block">
      {pending > 0 ? (
        <Link
          to="/app/alerts"
          className="mb-3 flex items-center gap-3 rounded-[16px] border border-[color-mix(in_srgb,var(--accent)_30%,var(--line))] bg-[var(--accent-soft)] px-3.5 py-3 transition hover:border-accent"
        >
          <span className="flex size-9 items-center justify-center rounded-full bg-accent text-on-accent">
            <Bell className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-extrabold">{pending} waiting</span>
            <span className="block text-[10px] text-dim">
              {pending === 1 ? "A request" : "Requests"} and conversations to answer
            </span>
          </span>
          <ArrowRight className="size-4 text-accent" />
        </Link>
      ) : null}

      <div className="card overflow-hidden">
        <div className="flex items-center justify-between px-4 pb-2 pt-3.5">
          <p className="text-[12px] font-extrabold tracking-tight">Recent convos</p>
          <Link to="/app/convo" className="text-[10px] font-bold text-accent hover:underline">Open</Link>
        </div>
        {threads.isLoading ? (
          <div className="space-y-3 px-4 pb-4" aria-hidden>
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center gap-2.5">
                <div className="skeleton size-9 rounded-full" />
                <div className="flex-1 space-y-1.5">
                  <div className="skeleton h-2.5 w-24 rounded-full" />
                  <div className="skeleton h-2 w-32 rounded-full" />
                </div>
              </div>
            ))}
          </div>
        ) : recent.length ? (
          <div className="pb-1">
            {recent.map((thread) => {
              const person = thread.member ?? thread.members?.[0]?.user;
              const title = thread.title || person?.name || person?.username || "Convo";
              return (
                <Link key={thread.id} to={`/app/convo/${thread.id}`} className="flex items-center gap-2.5 px-4 py-2.5 transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]">
                  <Avatar user={person} name={title} src={thread.avatar} size={32} online={person?.online} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-[11.5px] font-bold">{title}</span>
                      <span className="ml-auto shrink-0 text-[9px] text-dim">{timeAgoShort(thread.last_message?.created_at ?? thread.last_message_at)}</span>
                    </span>
                    <span className="mt-0.5 flex items-center gap-1.5">
                      <span className={cn("truncate text-[10px] text-dim", (thread.unread ?? 0) > 0 && "font-semibold text-ink")}>
                        {thread.last_message?.body || "No messages yet"}
                      </span>
                      {thread.unread ? (
                        <span className="flex min-w-4 shrink-0 items-center justify-center rounded-full bg-accent px-1 text-[8px] font-bold leading-4 text-on-accent">
                          {thread.unread > 9 ? "9+" : thread.unread}
                        </span>
                      ) : null}
                    </span>
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className="px-4 pb-5 pt-1">
            <p className="text-[11px] leading-5 text-dim">No conversations yet. Find someone and start one.</p>
            <Link to="/app/search" className="mt-2 inline-flex items-center gap-1 text-[10.5px] font-bold text-accent">
              <SearchIcon /> Find people
            </Link>
          </div>
        )}
        <Link to="/app/convo" className="flex items-center justify-center gap-1.5 border-t border-line py-2.5 text-[10.5px] font-bold text-dim transition hover:text-ink">
          <MessageCircle className="size-3.5" /> All conversations
        </Link>
      </div>

      <div className="mt-3 card p-3.5">
        <div className="flex items-center justify-between">
          <p className="text-[11px] font-extrabold">Your shelf</p>
          <Link to="/app/settings?section=appearance" className="text-[9.5px] font-bold text-dim hover:text-ink">Themes</Link>
        </div>
        <div className="mt-2.5 flex gap-2">
          <Link to="/app/saved" className="flex min-w-0 flex-1 items-center gap-2 rounded-[12px] bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] px-2.5 py-2 transition hover:bg-[var(--accent-soft)]">
            <Bookmark className="size-3.5 text-accent" />
            <span className="truncate text-[10.5px] font-bold">Saved</span>
          </Link>
          <Link to="/app/sparks" className="flex min-w-0 flex-1 items-center gap-2 rounded-[12px] bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] px-2.5 py-2 transition hover:bg-[var(--accent-soft)]">
            <Sparkles className="size-3.5 text-accent" />
            <span className="truncate text-[10.5px] font-bold">Sparks</span>
          </Link>
        </div>
        <Link to="/app/settings?section=appearance" className="mt-3 flex items-center gap-2.5 rounded-[12px] border border-line p-2 transition hover:border-accent/40">
          <img src={design.cover} alt="" className="size-10 rounded-[10px] object-cover" />
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[10.5px] font-extrabold">{design.name}</span>
            <span className="block truncate text-[9px] text-dim">Current theme · change</span>
          </span>
          <ArrowRight className="size-3.5 text-dim" />
        </Link>
      </div>

      <p className="mt-4 px-1 text-[9.5px] leading-4 text-dim">
        Xelvic shows what you asked for. Hide a drop from its menu and it stays gone.
      </p>
    </aside>
  );
}


function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="size-3" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" strokeLinecap="round" />
    </svg>
  );
}

function SectionHead({
  id,
  title,
  action,
  onAction,
}: {
  id?: string;
  title: string;
  action?: string;
  onAction?: () => void;
}) {
  // `_Head` in `screens/drops.dart`: 16 all round but 8 under, the word at 15
  // w800 with a hair of negative tracking, and the action at 13 w700 in the
  // accent — the same head the Moments rail wears, because it is the same kind
  // of section.
  return (
    <div className="flex items-center justify-between pb-2 pe-4 ps-4 pt-4">
      <h2 id={id} className="text-[15px] font-extrabold tracking-[-0.2px]">{title}</h2>
      {action ? (
        <button type="button" onClick={onAction} className="text-[13px] font-bold text-accent hover:underline">
          {action}
        </button>
      ) : null}
    </div>
  );
}

/**
 * A small filled capsule with an icon and a number on it — `_Pill` in
 * `screens/drops.dart`.
 *
 * 62% of the theme's solid ink, which is the same dark in every theme, because
 * the pill sits over a picture and a white-on-white pill would vanish on the
 * pale ones. `--solid` is that ink; `--ink` is the *text* colour and flips.
 */
function Pill({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <span className="inline-flex items-center gap-[4px] rounded-[20px] bg-[color-mix(in_srgb,var(--solid)_62%,transparent)] px-[7px] py-[3px] text-[11px] font-extrabold leading-[15px] text-white">
      {icon}
      {text}
    </span>
  );
}

/**
 * One clip on the shelf, drawn as a story card: the frame, whose it is in the
 * corner, how many have watched, and the name under it — `VibeCard` in
 * `screens/drops.dart`.
 *
 * The tile is 96×144, three points bigger than the Moments rail's own tile in
 * both directions and a touch taller again, so it holds its own beside a feed
 * column narrowed to a post's width. The face is in the top corner at 2 and the
 * watchers at the foot at 2, and the two are
 * the only things over the frame — a Vibe is watched, and how often is half of
 * what somebody scanning a rail is deciding between.
 *
 * A tile with no still is two answers, and they are not the same one. A clip
 * whose bytes are on the server but which the phone cut no poster for is a
 * blank to wait on — it plays when the tile is opened — while a clip whose
 * bytes have gone has neither a still nor a content URL, and only that one is
 * drawn as gone.
 */
function VibeCard({ vibe, onOpen }: { vibe: Drop; onOpen: () => void }) {
  const firstName = (vibe.author.name || vibe.author.username || "").split(" ")[0];
  const still = vibe.asset?.thumbnail_url ?? null;
  const others = Number(vibe.collab?.count ?? 0);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-[96px] shrink-0 snap-start text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      aria-label={`${vibe.author.name || vibe.author.username}'s Vibe, ${count(vibe.views ?? 0)} views`}
    >
      {/* The tile is the picture and nothing else, so the cover is the whole of
          it: the veil is handed the clip's own thumbnail to blur behind its
          panel rather than a frame of the clip, because a rail is scanned. */}
      <span className="relative block h-[144px] w-[96px] overflow-hidden rounded-[16px] bg-[color-mix(in_srgb,var(--accent)_10%,var(--card))] ring-1 ring-[color-mix(in_srgb,var(--ink)_8%,transparent)] transition duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_10px_24px_rgb(19_19_26_/_0.12)] group-focus-visible:ring-2 group-focus-visible:ring-accent">
        <SensitiveVeil
          sensitive={Boolean(vibe.sensitive)}
          openable={Boolean(vibe.openable)}
          cover={vibe.asset ?? null}
          note={vibe.mine ? "Yours. Everybody else sees it covered." : null}
        >
          {still ? (
            <AuthedImage
              src={still}
              alt={`${firstName}'s Vibe`}
              className="block size-full transition duration-200 group-hover:scale-[1.03]"
            />
          ) : vibe.asset?.content_url ? (
            // The clip is on the server and the phone cut no poster: a blank to
            // wait on, never the tombstone.
            <span className="block size-full" />
          ) : (
            <span className="flex size-full items-center justify-center p-2 text-center text-[10.5px] font-semibold text-dim">
              It is gone
            </span>
          )}
        </SensitiveVeil>

        <span className="absolute start-2 top-2 rounded-full bg-card p-[2px] shadow-[0_2px_8px_rgb(8_8_12_/_0.18)]">
          <Avatar user={vibe.author} size={28} />
        </span>
        <span className="absolute bottom-2 start-2">
          <Pill icon={<Play className="size-3 fill-current" aria-hidden />} text={count(vibe.views ?? 0)} />
        </span>
        {/* The other names, as a count and nothing more: the tile is 96 wide
            and a name on the same line would be an ellipsis. The word for it
            is on the card this opens. */}
        {others > 1 ? (
          <span className="absolute bottom-2 end-2">
            <Pill icon={<Users className="size-3" aria-hidden />} text={count(others)} />
          </span>
        ) : null}
      </span>
      <span className="mt-2 flex w-[96px] items-center gap-1">
        <span className="truncate text-[12px] font-semibold text-ink">{firstName}</span>
        {vibe.author.verified ? <VerifiedTick size={12} /> : null}
      </span>
    </button>
  );
}

function CreateRow({
  icon,
  label,
  line,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  line: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[13px] font-extrabold">{label}</span>
        <span className="block text-[10.5px] text-dim">{line}</span>
      </span>
    </button>
  );
}

export function DropsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const wide = useWideScreen();
  const [params, setParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [vibeIndex, setVibeIndex] = useState<number | null>(null);
  const composing = params.get("compose") === "1";
  const modeParam = params.get("mode");
  const composerMode: ComposerMode =
    modeParam === "vibe" || modeParam === "poll" || modeParam === "note" || modeParam === "sound"
      ? modeParam
      : "drop";

  // Both shelves' options live in `features/drops/feedQueries.ts` because this
  // page is not their only reader: the prefetcher warms them by the same
  // object. Stated here as well, they disagreed — see that file.
  const feed = useInfiniteQuery(dropsFeedQuery);

  const vibes = useInfiniteQuery(dropsVibesQuery);
  const vibeRows = useMemo(() => {
    // A hand dealt twice is one clip, not two tiles with the same key. The
    // server deals one shelf the first time and the walk asks for hands after
    // that, so a clip can arrive in two of them — the app's `_fillMore` drops
    // the second copy for the same reason.
    const seen = new Set<string>();
    return (vibes.data?.pages ?? [])
      .flatMap((page) => page.results)
      .filter((vibe) => {
        if (seen.has(vibe.id)) return false;
        seen.add(vibe.id);
        return true;
      });
  }, [vibes.data]);

  /**
   * The salt the rail's order and the weave are drawn from.
   *
   * Drawn once per opening of the page, which is the app's promise kept to the
   * letter it can keep here: the shelf is a *shuffled* order — see
   * `shelfOrder` — so that the strip above the feed is not a second telling of
   * the same order as the top of the page under it, and the order has to hold
   * still while the page is open, because a card that moves as it is tapped is
   * a card tapped wrongly. The app draws a fresh salt on every deal of the
   * shelf; a browser cannot tell "a fresh deal" from "the same page re-read
   * after a heart landed", and re-dealing on the second would be exactly the
   * card that moves under the thumb.
   */
  const [salt] = useState(() => Math.floor(Math.random() * 0x80000000));

  /** The shelf in its own order — the rail and the weave are both read from it. */
  const shelf = useMemo(() => shelfOrder(vibeRows, salt), [vibeRows, salt]);
  const vibeParam = params.get("vibe");
  /** Where a clip stands in the walk, which is the shelf's own order. */
  const vibeAt = (id: unknown) => shelf.findIndex((vibe) => String(vibe.id) === String(id));

  /**
   * A clip the walk was opened on that the shelf has never held.
   *
   * A plain video in the feed is not a Vibe, so it is not on the shelf — and the
   * app does not open it on a page of its own either (that was the report of
   * 2026-10-19: *"agar drop sirf single video hai to click karne pe single
   * screen pe ja raha, hata kar vibe pe play hona chahiye"*). It is handed to
   * the walk's own head instead: see [walk].
   */
  const [walkLead, setWalkLead] = useState<Drop | null>(null);

  /**
   * What the walk walks: the shelf, in its own order, with a lead in front of
   * it when the clip that was pressed is not one of the shelf's own.
   *
   * The app's `Drops.it.carry(one)`: *"a single video pressed in the feed is not
   * on the shelf — it is not a Vibe — and a walk handed `[it, ...shelf]` is one
   * this screen may not lengthen"*, so the phone gives it to the store's tail
   * and opens on it. Here the lead sits at the head of the list the walk is
   * handed, which is the same promise kept one simpler way: the clip under the
   * thumb is where the walk opens, the shelf is a swipe from it, and the hand
   * the walk asks for at the end is asked for by the page as it always was —
   * `onNeedMore` — so the walk still does not run out.
   */
  const walk = useMemo(() => walkOf(shelf, walkLead), [shelf, walkLead]);

  /**
   * Open the walk on a clip — a tile on the strip, a card in the feed, or a
   * plain video a card is playing.
   *
   * A clip the shelf no longer holds is not opened at nought: the walk would
   * then start on somebody else's clip, which is a different thing from the one
   * that was pressed. It is carried in front of the shelf instead. See [walk].
   */
  function openVibe(one: Drop) {
    const at = vibeAt(one.id);
    if (at >= 0) {
      setWalkLead(null);
      setVibeIndex(at);
      return;
    }
    setWalkLead(one);
    setVibeIndex(0);
  }
  // A card's ⋮ offers Update on its own author's post, and the app opens its
  // composer in edit mode with that post loaded. Here the post is already in
  // hand — it is the card that was tapped — so the modal takes it directly and
  // only a deep link has to read one.
  const editId = params.get("edit");

  useEffect(() => {
    if (!vibeParam || !shelf.length) return;
    const index = shelf.findIndex((vibe) => String(vibe.id) === vibeParam);
    if (index >= 0) setVibeIndex(index);
  }, [vibeParam, shelf]);

  function closeVibe() {
    setVibeIndex(null);
    // The lead goes with it. A clip carried in front of the shelf belongs to the
    // walk it was carried into, not to the page: opening the strip's own first
    // tile afterwards has to open on that tile rather than on the video somebody
    // pressed ten minutes ago. See [walk].
    setWalkLead(null);
    setParams((current) => {
      const copy = new URLSearchParams(current);
      copy.delete("vibe");
      return copy;
    }, { replace: true });
  }

  const drops = useMemo(() => {
    const seen = new Set<string>();
    return (feed.data?.pages ?? [])
      .flatMap((page) => page.results)
      .filter((drop) => {
        if (seen.has(drop.id)) return false;
        seen.add(drop.id);
        return true;
      });
  }, [feed.data]);

  // An empty first page is two answers and the server says which: a corpus
  // with nothing in it, or a corpus this reader has finished. The app draws
  // "Nothing here yet" for the first and "You've seen the whole feed" for the
  // second, and a page that said the first over the second is telling somebody
  // nobody posts rather than that they have read everything.
  const caughtUp = feed.data?.pages?.[0]?.caught_up === true;

  /**
   * How many of this page's cards the server says should be clips.
   *
   * Read off the page rather than asked for on its own: the number is a
   * property of this reader and changes with them, and a second request for a
   * float would be a request on the hot path for something the feed's own
   * answer can carry in four bytes. The fallback is the app's — the share a
   * reader with no history is shown — and it stands only until a page arrives
   * carrying one.
   */
  const share = feed.data?.pages?.[0]?.vibe_share ?? FEED_VIBE_SHARE_FALLBACK;

  // An exhausted feed is not a sentence about having read everything: it is
  // wherever the shelf is still holding past the rail. See `filledWithVibes`.
  const filling = caughtUp && !drops.length;
  const filled = useMemo(() => (filling ? filledWithVibes(shelf) : []), [filling, shelf]);

  /**
   * The feed as it is drawn: the drops the server dealt, with clips woven in.
   *
   * The app's `Drops.mixed`, and the same arithmetic — see `features/drops/
   * mix.ts`, which is that file carried over whole. It is a *view*: `drops`
   * stays the server's own page in the server's own order, because the next
   * page's cursor counts on it.
   */
  const woven = useMemo(
    () =>
      filled.length
        ? filled
        : mixedFeed({ drops, vibes: shelf, share, salt }),
    [filled, drops, shelf, share, salt],
  );

  /**
   * The rail: the shelf, less the clips the feed is drawing at its head.
   *
   * The rule and the one place it is read narrower than the app reads it are in
   * `railClips`, beside the owner's own report of what the app's reading did
   * here — *"for you ke upar jo vibes ka section tha wo bhi hat gya hai, please
   * use rakhiye"* (2026-11-06) — because it is arithmetic over two lists and it
   * is worth testing as such. See `mix.test.ts`.
   */
  const rail = useMemo(
    () => railClips({ shelf, woven, filling }),
    [filling, shelf, woven],
  );

  /**
   * The next page, asked for as the foot of the feed comes into view.
   *
   * The app's `Drops._more` fetches when the scroll is 400 points from the
   * bottom; a sentinel with the same job says the same thing in a browser, and
   * the wider margin is there because a feed is read by flicking — the page is
   * wanted before the thumb reaches the end of the one in hand, not after.
   *
   * This replaced a "Load more" button. The button was honest and it was not
   * the app: a feed does not stop to ask, and a reader who has to press for
   * every page is a reader who sees ten drops and leaves.
   */
  const foot = useRef<HTMLDivElement | null>(null);
  // Which shelf the foot is asking. A feed with nothing left in it is drawn
  // from the shelf's own tail — see `filledWithVibes` — and the thing the foot
  // wants then is the next hand of clips, not a page of drops that has already
  // been read to its end.
  const more = filling ? vibes : feed;
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = more;
  useEffect(() => {
    const node = foot.current;
    if (!node || !hasNextPage || isFetchingNextPage) return;
    const watcher = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        void fetchNextPage();
      },
      // Two thousand pixels is roughly three cards of lead. The first byte
      // from this server takes hundreds of milliseconds, so a margin measured
      // in one screen arrived with the reader already at the foot — and the
      // foot is where the spinner was. The fetch now starts while there is
      // still something left to read.
      { rootMargin: "2000px 0px" },
    );
    watcher.observe(node);
    return () => watcher.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, woven.length]);

  /**
   * A card is gone from this page — hidden, or taken down by its author.
   *
   * Taken out of the pages in hand rather than re-asked for. Invalidating
   * `["drops"]` re-fetched every page the reader had scrolled to — ten of them
   * after ten screens — to learn that one card is gone. The server has already
   * been told by the menu that hid it; the page just stops drawing it.
   *
   * *Both* shelves are swept, because one clip can be a card in the feed and a
   * tile on the strip above it: a sweep that reached only the feed would leave
   * the tile drawing a clip the reader has just taken down, and a sweep that
   * reached only the shelf would leave the card.
   */
  function forget(id: string) {
    const sweep = (
      old: InfiniteData<Page<Drop>, string | undefined> | undefined,
    ) =>
      old
        ? {
            ...old,
            pages: old.pages.map((page) => ({
              ...page,
              results: page.results.filter((row) => String(row.id) !== id),
            })),
          }
        : old;
    queryClient.setQueryData<InfiniteData<Page<Drop>, string | undefined>>(
      dropsFeedQuery.queryKey,
      sweep,
    );
    queryClient.setQueryData<InfiniteData<Page<Drop>, string | undefined>>(
      dropsVibesQuery.queryKey,
      sweep,
    );
  }

  function openComposer(mode: ComposerMode = "drop") {
    setParams((current) => {
      const copy = new URLSearchParams(current);
      copy.set("compose", "1");
      if (mode === "drop") copy.delete("mode");
      else copy.set("mode", mode);
      return copy;
    });
  }

  function closeComposer() {
    setParams((current) => {
      const copy = new URLSearchParams(current);
      copy.delete("compose");
      copy.delete("mode");
      return copy;
    });
  }

  return (
    <div className="pb-[calc(92px+env(safe-area-inset-bottom,0px))] md:pb-24">
      <PageHeader
        title="Drops"
        subtitle="The room you keep"
        actions={
          <>
            <Link to="/app/alerts" className="icon-btn" aria-label="Notices">
              <Bell className="size-[18px]" />
            </Link>
            <Button
              size="sm"
              icon={<Plus className="size-4" />}
              onClick={() => setCreateOpen(true)}
              className="min-h-9"
              aria-haspopup="dialog"
            >
              Create
            </Button>
          </>
        }
      />

      {/* A feed is a column, not a page. The grid below this breakpoint was one
          column the whole width of the window, so a card on a 1440-point screen
          was drawn the whole width of the window with a picture inside it that had narrowed
          itself to a third of that — the owner's report of 2026-11-06, *"width
          bahut jyada hai"*, beside a photograph of exactly that card. The feed
          is capped at a post's own width, so the same
          card is the same card at every size. A post is read at 390 points on
          the phone this is a port of, and 470 points is the closest thing to it
          on a desktop. */}
      <div className="mx-auto grid w-full max-w-[860px] gap-6 px-3 pt-1 sm:px-4 md:px-7 xl:grid-cols-[minmax(0,470px)_300px] xl:justify-center xl:gap-8">
        <div className="mx-auto w-full min-w-0 max-w-[470px] space-y-3">
          {rail.length ? (
            <section
              aria-labelledby="drops-vibe-heading"
              className="overflow-hidden rounded-[20px] border border-line bg-card shadow-[0_8px_24px_rgb(19_19_26_/_0.04)]"
            >
              <SectionHead
                id="drops-vibe-heading"
                title="Vibe"
                // Both or neither: a `SectionHead` draws the button when it is
                // given a word, and a word with no handler is a button that does
                // nothing.
                action={rail[0] ? "See all" : undefined}
                onAction={rail[0] ? () => openVibe(rail[0]) : undefined}
              />
              <div className="no-scrollbar flex snap-x snap-mandatory gap-3 overflow-x-auto scroll-px-4 px-4 pb-4">
                {/* A row and not the whole shelf: the walk is where clips are
                    watched, and the hands it asks for as the thumb reaches
                    them would otherwise grow this rail without end — a dozen
                    tiles whose pictures nobody has scrolled to yet. A tile
                    opens the walk at its place *in the shelf*, which is not its
                    place on the strip: the strip is the shelf less the clips
                    the feed below is already drawing. */}
                {rail.map((vibe) => (
                  <VibeCard key={vibe.id} vibe={vibe} onOpen={() => openVibe(vibe)} />
                ))}
              </div>
            </section>
          ) : null}

          <section aria-labelledby="drops-for-you-heading">
            <SectionHead id="drops-for-you-heading" title="For you" />
            {feed.isLoading ? (
              <div className="space-y-3" aria-hidden>
                {[0, 1, 2].map((row) => (
                  <div key={row} className="card p-4">
                    <div className="flex items-center gap-3">
                      <div className="skeleton size-10 rounded-full" />
                      <div className="flex-1 space-y-2">
                        <div className="skeleton h-3 w-32 rounded-full" />
                        <div className="skeleton h-2.5 w-24 rounded-full" />
                      </div>
                    </div>
                    <div className="mt-4 space-y-2">
                      <div className="skeleton h-3 w-full rounded-full" />
                      <div className="skeleton h-3 w-3/4 rounded-full" />
                    </div>
                    <div className="skeleton mt-3 h-48 w-full rounded-xl" />
                  </div>
                ))}
              </div>
            ) : feed.isError ? (
              <div className="card">
                <ErrorState error={feed.error} onRetry={() => void feed.refetch()} />
              </div>
            ) : woven.length === 0 ? (
              <div className="card">
                <EmptyState
                  icon={<Sparkles className="size-6" />}
                  title={caughtUp ? "You've seen the whole feed" : "Nothing here yet"}
                  body={
                    caughtUp
                      ? "New drops land here as people post them. Pull it up again later."
                      : "Drops from people you follow turn up here."
                  }
                  action={
                    <div className="flex gap-2">
                      <Link to="/app/search" className="btn btn-primary">Find people</Link>
                      <Button variant="secondary" icon={<Plus className="size-4" />} onClick={() => openComposer("drop")}>Post something</Button>
                    </div>
                  }
                />
              </div>
            ) : (
              <div className="space-y-3">
                {woven.map((row) => (
                  // Each card is its own box: a card below the fold is not laid
                  // out or painted until the scroll nears it, which is what
                  // keeps a fifty-drop feed's first paint as cheap as a five.
                  <div key={row.id} className="feed-item">
                  <DropCard
                    drop={row}
                    // A clip in the feed has somewhere to be opened, and it is
                    // the same place whether it is a Vibe the weave wove in or a
                    // plain video somebody posted: the walk. The app's own rule —
                    // `DropVideo.onOpen` is `isVibe ? openVibe : _openFrame`, and
                    // `_openFrame` is `openClip`, which is `openVibe`. The owner's
                    // report of 2026-11-06 is that this was missing here: *"app me
                    // drops ke for you post me video post par click karne par ek
                    // dusare page me wo video open hota hai waise isme nahi ho
                    // raha hai"*.
                    //
                    // A picture is still left alone, which is the app's answer
                    // too: nothing on the phone happens on a tap on a still.
                    onOpen={dropIsClip(row) ? () => openVibe(row) : undefined}
                    onRemoved={forget}
                  />
                  </div>
                ))}
                {filling ? (
                  vibes.hasNextPage ? (
                    <div ref={foot} className="flex justify-center py-4">
                      {vibes.isFetchingNextPage ? (
                        <span className="size-5 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-label="Loading more clips" />
                      ) : null}
                    </div>
                  ) : (
                    <p className="flex items-center justify-center gap-1.5 py-5 text-center text-[10.5px] font-semibold text-dim">
                      <Sparkles className="size-3.5 text-accent" /> That&apos;s everything for now
                    </p>
                  )
                ) : feed.hasNextPage ? (
                  <div ref={foot} className="flex justify-center py-4">
                    {feed.isFetchingNextPage ? (
                      <span className="size-5 animate-spin rounded-full border-2 border-accent border-t-transparent" aria-label="Loading more drops" />
                    ) : null}
                  </div>
                ) : (
                  <p className="flex items-center justify-center gap-1.5 py-5 text-center text-[10.5px] font-semibold text-dim">
                    <Sparkles className="size-3.5 text-accent" /> You&apos;ve seen the whole feed
                  </p>
                )}
              </div>
            )}
          </section>
        </div>
        {wide ? <Aside /> : null}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create"
        description="Put something up."
        size="sm"
      >
        <div className="space-y-1 p-2">
          <CreateRow
            icon={<ImagePlus className="size-4" />}
            label="Drop"
            line="Pictures, in a run"
            onClick={() => {
              setCreateOpen(false);
              openComposer("drop");
            }}
          />
          <CreateRow
            icon={<StickyNote className="size-4" />}
            label="Note"
            line="Words and nothing else"
            onClick={() => {
              setCreateOpen(false);
              openComposer("note");
            }}
          />
          <CreateRow
            icon={<Clapperboard className="size-4" />}
            label="Vibe"
            line="Short video"
            onClick={() => {
              setCreateOpen(false);
              openComposer("vibe");
            }}
          />
          <CreateRow
            icon={<Music2 className="size-4" />}
            label="Sound"
            line="A recording, on its own shelf"
            onClick={() => {
              setCreateOpen(false);
              openComposer("sound");
            }}
          />
          <CreateRow
            icon={<BarChart3 className="size-4" />}
            label="Poll"
            line="Ask a question"
            onClick={() => {
              setCreateOpen(false);
              openComposer("poll");
            }}
          />
          <CreateRow
            icon={<Sparkles className="size-4" />}
            label="Moment"
            line="For a day"
            onClick={() => {
              setCreateOpen(false);
              navigate("/app/moments?compose=1");
            }}
          />
        </div>
      </Modal>

      <EditDrop
        // Both shelves, because a post's Update row is reachable from a card of
        // either kind and a clip is not in the feed's own pages.
        drop={
          editId
            ? drops.find((row) => String(row.id) === editId) ??
              shelf.find((row) => String(row.id) === editId) ??
              null
            : null
        }
        dropId={editId ?? undefined}
        open={Boolean(editId)}
        onClose={() => {
          setParams(
            (current) => {
              const copy = new URLSearchParams(current);
              copy.delete("edit");
              return copy;
            },
            { replace: true },
          );
        }}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: ["drops"] });
          void queryClient.invalidateQueries({ queryKey: ["drop"] });
        }}
      />

      <DropComposer
        open={composing}
        mode={composerMode}
        onClose={closeComposer}
        onCreated={() => {
          void queryClient.invalidateQueries({ queryKey: ["drops"] });
        }}
      />

      {vibeIndex !== null && walk.length ? (
        <VibeViewer
          // `walk` and not `shelf`: a plain video pressed in the feed is not a
          // Vibe, so it is in front of the shelf rather than on it — and opening
          // it is what the owner reported missing on 2026-11-06. See [walk].
          vibes={walk}
          index={Math.min(vibeIndex, walk.length - 1)}
          onIndex={setVibeIndex}
          onClose={closeVibe}
          // A thumb nearing the end of the hand it was dealt asks for the next
          // one, which is `Drops.vibeBatch` in the app: the walk never runs out
          // while the shelf has more.
          onNeedMore={() => {
            if (vibes.hasNextPage && !vibes.isFetchingNextPage) void vibes.fetchNextPage();
          }}
          // The bar's camera: the reel is where a clip is watched, so it is
          // also one of the two ways another one is put up.
          onRecord={() => {
            closeVibe();
            openComposer("vibe");
          }}
        />
      ) : null}
    </div>
  );
}
