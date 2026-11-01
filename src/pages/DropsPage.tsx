import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { AuthedImage } from "@/components/Media";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/Page";
import { EmptyState, ErrorState } from "@/components/States";
import { VerifiedTick } from "@/components/Tick";
import { DropCard } from "@/features/drops/DropCard";
import { DropComposer, type ComposerMode } from "@/features/drops/DropComposer";
import { EditDrop } from "@/features/drops/EditDrop";
import { SensitiveVeil } from "@/features/drops/SensitiveVeil";
import { VibeViewer } from "@/features/drops/VibeViewer";
import { api, apiPathFrom } from "@/lib/api";
import { cn } from "@/lib/cn";
import { count, timeAgoShort } from "@/lib/format";
import { useTheme } from "@/providers/ThemeProvider";
import type { Drop, Page, ThreadCard } from "@/types/api";

function Aside() {
  const { design } = useTheme();
  const threads = useQuery({
    queryKey: ["threads-aside"],
    queryFn: () => api.get<{ threads: ThreadCard[] }>("/chat/threads/"),
    staleTime: 20_000,
  });
  const requests = useQuery({
    queryKey: ["requests-count"],
    queryFn: () => api.get<{ pending: number }>("/social/requests/count/"),
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
 * The tile is 89×132, three points bigger than the Moments rail's own tile in
 * both directions: the same card in the same kind of row, given a touch more
 * presence because it sits inside a page that scrolls the other way. The face
 * is in the top corner at 3 and the watchers at the foot at 5, and the two are
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
      className="group w-[89px] shrink-0 text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      aria-label={`${vibe.author.name || vibe.author.username}'s Vibe, ${count(vibe.views ?? 0)} views`}
    >
      {/* The tile is the picture and nothing else, so the cover is the whole of
          it: the veil is handed the clip's own thumbnail to blur behind its
          panel rather than a frame of the clip, because a rail is scanned. */}
      <span className="relative block h-[132px] w-[89px] overflow-hidden rounded-[14px] bg-[color-mix(in_srgb,var(--accent)_10%,var(--card))]">
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

        <span className="absolute start-[3px] top-[3px] rounded-full bg-card p-[1.5px]">
          <Avatar user={vibe.author} size={26} />
        </span>
        <span className="absolute bottom-[5px] start-[5px]">
          <Pill icon={<Play className="size-3 fill-current" aria-hidden />} text={count(vibe.views ?? 0)} />
        </span>
        {/* The other names, as a count and nothing more: the tile is 89 wide
            and a name on the same line would be an ellipsis. The word for it
            is on the card this opens. */}
        {others > 1 ? (
          <span className="absolute bottom-[5px] end-[5px]">
            <Pill icon={<Users className="size-3" aria-hidden />} text={count(others)} />
          </span>
        ) : null}
      </span>
      <span className="mt-[6px] flex items-center gap-[2px]">
        <span className="truncate text-[11.5px] text-ink">{firstName}</span>
        {vibe.author.verified ? <VerifiedTick size={11} /> : null}
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
  const [params, setParams] = useSearchParams();
  const [createOpen, setCreateOpen] = useState(false);
  const [vibeIndex, setVibeIndex] = useState<number | null>(null);
  const composing = params.get("compose") === "1";
  const modeParam = params.get("mode");
  const composerMode: ComposerMode =
    modeParam === "vibe" || modeParam === "poll" || modeParam === "note" || modeParam === "sound"
      ? modeParam
      : "drop";

  const feed = useInfiniteQuery({
    queryKey: ["drops", "feed"],
    queryFn: ({ pageParam }) => api.get<Page<Drop>>(pageParam ?? "/drops/"),
    initialPageParam: "/drops/",
    getNextPageParam: (last) => apiPathFrom(last.next),
  });

  // The shelf is dealt a page at a time and the walk keeps asking while it is
  // being read — `Drops.vibeBatch` ahead, in the app. The first page is a
  // hand of thirty and the walk is not supposed to end there: a thumb with
  // nothing after it is the app's own complaint about a shelf that stopped.
  const vibes = useInfiniteQuery({
    queryKey: ["drops", "vibes"],
    queryFn: ({ pageParam }) => api.get<Page<Drop>>(pageParam),
    initialPageParam: "/drops/vibes/",
    getNextPageParam: (last) => apiPathFrom(last.next),
    staleTime: 30_000,
  });
  const vibeRows = useMemo(
    () => (vibes.data?.pages ?? []).flatMap((page) => page.results),
    [vibes.data],
  );
  const vibeParam = params.get("vibe");
  // A card's ⋮ offers Update on its own author's post, and the app opens its
  // composer in edit mode with that post loaded. Here the post is already in
  // hand — it is the card that was tapped — so the modal takes it directly and
  // only a deep link has to read one.
  const editId = params.get("edit");

  useEffect(() => {
    if (!vibeParam || !vibeRows.length) return;
    const index = vibeRows.findIndex((vibe) => String(vibe.id) === vibeParam);
    if (index >= 0) setVibeIndex(index);
  }, [vibeParam, vibeRows]);

  function closeVibe() {
    setVibeIndex(null);
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

      <div className="mx-auto grid w-full max-w-[1240px] gap-6 px-3 pt-1 sm:px-4 md:px-7 xl:grid-cols-[minmax(0,660px)_300px] xl:justify-center xl:gap-8">
        <div className="min-w-0 space-y-3">
          {vibeRows.length ? (
            <section aria-labelledby="drops-vibe-heading">
              <SectionHead id="drops-vibe-heading" title="Vibe" action="See all" onAction={() => setVibeIndex(0)} />
              <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1">
                {vibeRows.map((vibe, index) => (
                  <VibeCard key={vibe.id} vibe={vibe} onOpen={() => setVibeIndex(index)} />
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
            ) : drops.length === 0 ? (
              <div className="card">
                <EmptyState
                  icon={<Users className="size-6" />}
                  title="Nothing here yet"
                  body="Drops from people you follow turn up here."
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
                {drops.map((drop) => (
                  <DropCard
                    key={drop.id}
                    drop={drop}
                    onRemoved={() => void queryClient.invalidateQueries({ queryKey: ["drops"] })}
                  />
                ))}
                {feed.hasNextPage ? (
                  <div className="flex justify-center py-3">
                    <Button variant="secondary" size="sm" loading={feed.isFetchingNextPage} onClick={() => void feed.fetchNextPage()}>
                      Load more
                    </Button>
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
        <Aside />
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
        drop={editId ? drops.find((row) => String(row.id) === editId) ?? null : null}
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

      {vibeIndex !== null && vibeRows.length ? (
        <VibeViewer
          vibes={vibeRows}
          index={Math.min(vibeIndex, vibeRows.length - 1)}
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
