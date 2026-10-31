import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Headphones, Lock, Search, UserRound, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { EmptyState, ErrorState } from "@/components/States";
import { TrackRow } from "@/features/audio/TrackRow";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { Page, Track, UserCard } from "@/types/api";

const RECENT_KEY = "xelvic.searches";

function readRecent(): string[] {
  try {
    const value = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]") as unknown;
    return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string").slice(0, 6) : [];
  } catch {
    return [];
  }
}

function PersonRow({ person, onPick }: { person: UserCard; onPick: () => void }) {
  return (
    <Link to={`/app/u/${person.username}`} onClick={onPick} className="flex items-center gap-3 rounded-[13px] px-2 py-2.5 transition hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]">
      <Avatar user={person} size={42} online={person.online} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-[12px] font-extrabold">{person.name || person.username}</span>
          {person.is_private ? <Lock className="size-3 shrink-0 text-dim" aria-label="Private" /> : null}
        </span>
        <span className="block truncate text-[10px] text-dim">@{person.username}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-dim" />
    </Link>
  );
}

export function SearchPage() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const [draft, setDraft] = useState(q);
  const [tab, setTab] = useState<"people" | "audio">("people");
  const [recent, setRecent] = useState(readRecent);

  useEffect(() => setDraft(q), [q]);

  const people = useQuery({
    queryKey: ["search-people", q],
    queryFn: () => api.get<Page<UserCard>>(`/auth/users/search/?q=${encodeURIComponent(q)}`),
    enabled: q.trim().length > 0,
    staleTime: 30_000,
  });
  const tracks = useQuery({
    queryKey: ["search-tracks", q],
    queryFn: () => api.get<{ tracks: Track[]; query: string }>(`/audio/tracks/?q=${encodeURIComponent(q)}`),
    enabled: tab === "audio" && q.trim().length > 0,
    staleTime: 30_000,
  });
  const suggestions = useQuery({
    queryKey: ["search-people", ""],
    queryFn: () => api.get<Page<UserCard>>("/auth/users/search/"),
    enabled: !q.trim(),
    staleTime: 60_000,
  });

  function remember(text: string) {
    const next = [text, ...recent.filter((item) => item.toLowerCase() !== text.toLowerCase())].slice(0, 6);
    setRecent(next);
    try {
      localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      // A private window may refuse storage; search still works.
    }
  }

  function submit(text = draft) {
    const clean = text.trim().replace(/^@/, "");
    if (!clean) return;
    setDraft(clean);
    setParams({ q: clean }, { replace: true });
    remember(clean);
  }

  function clear() {
    setDraft("");
    setParams({}, { replace: true });
  }

  const peopleRows = people.data?.results ?? suggestions.data?.results ?? [];

  return (
    <div className="mx-auto w-full max-w-[760px] pb-[calc(100px+env(safe-area-inset-bottom,0px))] md:pb-16">
      <header className="sticky top-0 z-20 bg-[color-mix(in_srgb,var(--page)_92%,transparent)] px-4 pb-2 pt-4 backdrop-blur-xl md:pt-6">
        <h1 className="text-[20px] font-extrabold tracking-tight">Search</h1>
        <form
          className="mt-3 flex items-center gap-2 rounded-[14px] border border-line bg-card px-3 focus-within:border-accent/50"
          onSubmit={(event) => {
            event.preventDefault();
            submit();
          }}
        >
          <Search className="size-4 shrink-0 text-dim" />
          <input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder="People, @handles, audio"
            className="h-11 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-dim"
            autoFocus
            autoComplete="off"
            spellCheck={false}
          />
          {draft ? <button type="button" onClick={clear} className="text-dim hover:text-ink" aria-label="Clear search"><X className="size-4" /></button> : null}
        </form>
        <div className="mt-3 flex gap-1">
          <button type="button" onClick={() => setTab("people")} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition", tab === "people" ? "bg-accent text-[var(--accent-ink)]" : "bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] text-dim hover:text-ink")}>
            <UserRound className="size-3.5" /> People
          </button>
          <button type="button" onClick={() => setTab("audio")} className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition", tab === "audio" ? "bg-accent text-[var(--accent-ink)]" : "bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] text-dim hover:text-ink")}>
            <Headphones className="size-3.5" /> Audio
          </button>
        </div>
      </header>

      <main className="px-4 pt-2">
        {!q.trim() ? (
          <>
            {recent.length ? (
              <section className="mt-3">
                <div className="flex items-center justify-between">
                  <h2 className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-dim">Recent</h2>
                  <button type="button" onClick={() => { setRecent([]); try { localStorage.removeItem(RECENT_KEY); } catch { /* noop */ } }} className="text-[10px] font-bold text-accent hover:underline">Clear</button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {recent.map((item) => (
                    <button key={item} type="button" onClick={() => submit(item)} className="rounded-full border border-line bg-card px-3 py-1.5 text-[11px] font-semibold text-dim hover:border-accent/40 hover:text-ink">{item}</button>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="mt-6">
              <h2 className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-dim">People on Xelvic</h2>
              {suggestions.isLoading ? (
                <div className="mt-3 space-y-2">{[0, 1, 2, 3].map((item) => <div key={item} className="skeleton h-14 rounded-[13px]" />)}</div>
              ) : suggestions.isError ? (
                <ErrorState compact error={suggestions.error} onRetry={() => void suggestions.refetch()} />
              ) : !peopleRows.length ? (
                <p className="py-10 text-center text-[11px] text-dim">Nobody to show yet.</p>
              ) : (
                <div className="mt-1.5 divide-y divide-line/70">
                  {peopleRows.map((person) => <PersonRow key={person.id} person={person} onPick={() => undefined} />)}
                </div>
              )}
            </section>
          </>
        ) : tab === "people" ? (
          <section>
            {people.isLoading ? (
              <div className="space-y-2">{[0, 1, 2, 3, 4].map((item) => <div key={item} className="skeleton h-14 rounded-[13px]" />)}</div>
            ) : people.isError ? (
              <ErrorState error={people.error} onRetry={() => void people.refetch()} />
            ) : !people.data?.results.length ? (
              <EmptyState icon={<UserRound className="size-6" />} title="No people found" body={`Nothing on Xelvic matches “${q}”. Try a name or a handle.`} />
            ) : (
              <div className="divide-y divide-line/70">
                {people.data.results.map((person) => <PersonRow key={person.id} person={person} onPick={() => remember(q)} />)}
              </div>
            )}
          </section>
        ) : (
          <section>
            {tracks.isLoading ? (
              <div className="space-y-2">{[0, 1, 2, 3].map((item) => <div key={item} className="skeleton h-16 rounded-[13px]" />)}</div>
            ) : tracks.isError ? (
              <ErrorState error={tracks.error} onRetry={() => void tracks.refetch()} />
            ) : !tracks.data?.tracks.length ? (
              <EmptyState icon={<Headphones className="size-6" />} title="No audio found" body={`The catalogue has nothing for “${q}”.`} />
            ) : (
              <div className="divide-y divide-line/70">
                {tracks.data.tracks.map((track) => (
                  <TrackRow key={track.id} track={track} queue={tracks.data.tracks} onPicked={() => remember(q)} />
                ))}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
