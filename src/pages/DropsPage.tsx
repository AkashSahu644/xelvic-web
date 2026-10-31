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
  Play,
  Plus,
  Sparkles,
  Users,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { AuthedImage } from "@/components/Media";
import { Modal } from "@/components/Modal";
import { PageHeader } from "@/components/Page";
import { EmptyState, ErrorState } from "@/components/States";
import { DropCard } from "@/features/drops/DropCard";
import { DropComposer, type ComposerMode } from "@/features/drops/DropComposer";
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
  return (
    <div className="flex items-center justify-between px-1 pb-2 pt-3">
      <h2 id={id} className="text-[15px] font-extrabold tracking-[-0.02em]">{title}</h2>
      {action ? (
        <button type="button" onClick={onAction} className="text-[12px] font-bold text-accent hover:underline">
          {action}
        </button>
      ) : null}
    </div>
  );
}

function VibeCard({ vibe, onOpen }: { vibe: Drop; onOpen: () => void }) {
  const firstName = (vibe.author.name || vibe.author.username || "").split(" ")[0];

  return (
    <button
      type="button"
      onClick={onOpen}
      className="group w-[86px] shrink-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      aria-label={`${vibe.author.name || vibe.author.username}'s Vibe, ${count(vibe.views ?? 0)} views`}
    >
      <span className="relative block h-[129px] w-full overflow-hidden rounded-[14px] bg-[color-mix(in_srgb,var(--accent)_10%,var(--card))]">
        <AuthedImage src={vibe.asset?.thumbnail_url ?? null} alt={`${firstName}'s Vibe`} className="h-full w-full transition duration-200 group-hover:scale-[1.03]" />
        <span className="absolute left-1.5 top-1.5 rounded-full bg-card p-[1.5px]">
          <Avatar user={vibe.author} size={26} />
        </span>
        <span className="absolute bottom-1.5 left-1.5 inline-flex items-center gap-1 rounded-full bg-black/55 px-1.5 py-0.5 text-[10px] font-extrabold text-white backdrop-blur">
          <Play className="size-3 fill-current" /> {count(vibe.views ?? 0)}
        </span>
      </span>
      <span className="mt-1.5 block truncate text-[11.5px] text-ink">{firstName}</span>
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
  const composerMode: ComposerMode = modeParam === "vibe" || modeParam === "poll" ? modeParam : "drop";

  const feed = useInfiniteQuery({
    queryKey: ["drops", "feed"],
    queryFn: ({ pageParam }) => api.get<Page<Drop>>(pageParam ?? "/drops/"),
    initialPageParam: "/drops/",
    getNextPageParam: (last) => apiPathFrom(last.next),
  });

  const vibes = useQuery({
    queryKey: ["drops", "vibes"],
    queryFn: () => api.get<Page<Drop>>("/drops/vibes/"),
    staleTime: 30_000,
  });
  const vibeRows = useMemo(() => vibes.data?.results ?? [], [vibes.data]);
  const vibeParam = params.get("vibe");

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
              <div className="no-scrollbar flex gap-3 overflow-x-auto px-1 pb-1">
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
            line="Photo, video, sound or text"
            onClick={() => {
              setCreateOpen(false);
              openComposer("drop");
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
        />
      ) : null}
    </div>
  );
}
