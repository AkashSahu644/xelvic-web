import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useInfiniteQuery } from "@tanstack/react-query";
import { AudioLines, ListMusic, Play } from "lucide-react";
import { AuthedImage } from "@/components/Media";
import { api, apiPathFrom } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { cn } from "@/lib/cn";
import { usePreferences } from "@/providers/PreferencesProvider";
import type { Drop, Page } from "@/types/api";

/**
 * A profile's posts, under one row of three tabs.
 *
 * Ported from `ProfileShelf` in `app/lib/screens/drop_grid.dart`. A profile is
 * the one page where somebody is looking at *one person's* posts, so they are
 * laid side by side as tabs rather than stacked down the page.
 *
 * The Drops and the Audios come out of one answer — the drops shelf, split by
 * whether a drop is a sound — so a private account's wall is drawn once, over
 * all three tabs. The Vibes are their own table and their own ask, made in
 * parallel with the drops rather than on the first tap: the app asked
 * sequentially until 2026-10-23, which is the spinner the owner reported
 * (*"profile page me drops vibes audios sab bhot time leta hai load hone me"*).
 *
 * Memories are *not* one of these tabs. The owner asked on 2026-09-28 to keep
 * that shelf where it always was — its own strip up the page above this row.
 *
 * A tap on a tile goes to the drop's own page, which is what the web has where
 * the app pushes a feed of one person's posts opened at the one touched. The
 * grid is a way to find a thing rather than a way to read it, and the drop page
 * is where it is read.
 */

/** What a person's drops answer carries besides the page. See `drops.services.gate`. */
interface ShelfGate {
  view?: boolean;
  mode?: string;
  title?: string;
  text?: string;
}

interface ShelfPage extends Page<Drop> {
  gate?: ShelfGate;
  can_post?: boolean;
}

/**
 * The mark a sound's square wears, by the kind it was filed under.
 *
 * The app's `soundMark` in two answers: a set of tracks or a spoken form is a
 * queue, everything else is a level. A set of tracks is not the same thing as
 * one track, and the square is the only place that can be said before opening.
 */
function SoundMark({ kind, className }: { kind?: string | null; className?: string }) {
  const spoken = [
    "podcast",
    "audiobook",
    "interview",
    "comedy",
    "news",
    "story",
    "devotional",
    "sports",
    "education",
  ];
  const Icon = spoken.includes(String(kind ?? "")) ? ListMusic : AudioLines;
  return <Icon className={className} aria-hidden />;
}

/** A sound's name: its own title, else its words, else the app's word for one. */
function soundName(drop: Drop, audioWord: string): string {
  const named = String(drop.title ?? "").trim();
  if (named) return named;
  const caption = String(drop.body ?? "").trim();
  if (caption) return caption;
  return audioWord;
}

/** Whether a drop is a sound. `Drop.isSound` — the kind, and not the mime. */
function isSound(drop: Drop): boolean {
  return drop.kind === "audio";
}

/** What the square draws: a sound's cover, else the asset's own still. */
function stillOf(drop: Drop): string | null {
  if (isSound(drop)) {
    return drop.cover?.thumbnail_url || drop.cover?.content_url || null;
  }
  return drop.asset?.thumbnail_url || drop.asset?.content_url || null;
}

/**
 * One square in the grid.
 *
 * Ported from `DropSquare`. A tile is a third of the row less the 18-point
 * gutters and the 4-point gaps, drawn at a 10-point corner, with the media-kind
 * mark in its own top corner: a clip gets a play, a sound gets its own mark,
 * and a note is the words it holds rather than a picture it does not have.
 */
export function Square({ drop }: { drop: Drop }) {
  const { t } = usePreferences();
  const still = stillOf(drop);
  const clip = drop.kind === "video" || drop.kind === "vibe";
  const sound = isSound(drop);
  const words = String(drop.body ?? "").trim();

  // A Vibe is a row in its own table and has no drop page — `/drops/{id}/`
  // would 404 on it. It opens in the Vibes walk where it plays, which is the
  // same door every other list of clips uses; a drop opens on its own page.
  const to =
    drop.kind === "vibe" ? `/app/drops?vibe=${encodeURIComponent(drop.id)}` : `/app/drops/${drop.id}`;

  return (
    <Link
      to={to}
      className="relative aspect-square overflow-hidden rounded-[10px] bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
    >
      {still ? (
        <AuthedImage
          src={still}
          alt=""
          className="absolute inset-0 h-full w-full"
          imgClassName="h-full w-full"
        />
      ) : sound ? (
        // A sound's asset is its audio and an image handed an mp3 would draw a
        // red clock, so a sound with no artwork draws what a sound looks like:
        // its mark, over the name it was given.
        <span className="absolute inset-0 flex flex-col items-center justify-center gap-2 p-2">
          <SoundMark kind={drop.sound_kind} className="size-[26px] text-accent" />
          <span className="line-clamp-2 text-center text-[11.5px] font-semibold leading-[1.25]">
            {soundName(drop, t("Audio"))}
          </span>
        </span>
      ) : (
        <span className="absolute inset-0 flex items-center justify-center p-2">
          <span className="line-clamp-5 text-center text-[12px] leading-[1.3]">
            {words || t("A drop")}
          </span>
        </span>
      )}

      {clip ? (
        <span className="absolute right-1.5 top-1.5 flex size-[23px] items-center justify-center rounded-full bg-black/55 text-white">
          <Play className="size-[15px] fill-current" aria-hidden />
        </span>
      ) : null}
      {/* The same corner mark a clip wears, with a speaker in place of the
          arrow — and only over a cover, because a sound with no cover has its
          own mark in the middle of the tile already. */}
      {sound && still ? (
        <span className="absolute right-1.5 top-1.5 flex size-[23px] items-center justify-center rounded-full bg-black/55 text-white">
          <SoundMark kind={drop.sound_kind} className="size-[15px]" />
        </span>
      ) : null}
    </Link>
  );
}

type Shelf = "drops" | "vibes" | "audios";

export function ProfileShelf({ username, mine }: { username: string; mine: boolean }) {
  const { t } = usePreferences();
  const [tab, setTab] = useState<Shelf>("drops");

  const shelf = useInfiniteQuery<ShelfPage>({
    queryKey: ["profile-shelf", username],
    queryFn: ({ pageParam }) => api.get<ShelfPage>(String(pageParam)),
    initialPageParam: `/drops/users/${encodeURIComponent(username)}/`,
    getNextPageParam: (last) => apiPathFrom(last.next),
    enabled: Boolean(username),
  });

  const vibes = useInfiniteQuery<ShelfPage>({
    queryKey: ["profile-vibes", username],
    queryFn: ({ pageParam }) => api.get<ShelfPage>(String(pageParam)),
    initialPageParam: `/drops/users/${encodeURIComponent(username)}/vibes/`,
    getNextPageParam: (last) => apiPathFrom(last.next),
    enabled: Boolean(username),
  });

  const rows = useMemo(() => shelf.data?.pages.flatMap((page) => page.results) ?? [], [shelf.data]);
  const drops = useMemo(() => rows.filter((drop) => !isSound(drop)), [rows]);
  const sounds = useMemo(() => rows.filter(isSound), [rows]);
  const vibeRows = useMemo(() => vibes.data?.pages.flatMap((page) => page.results) ?? [], [vibes.data]);

  /**
   * The server's own sentence for a wall, and whether a wall is what this is.
   *
   * An empty gate is not a locked one: the drops arrived, so they were allowed
   * through, and a payload that forgot to say so must not turn into a wall over
   * a grid that is right there.
   */
  const gate = shelf.data?.pages?.[0]?.gate;
  const locked = gate ? gate.view === false && Boolean(gate.mode) : false;

  /**
   * The next page, asked for as the reader nears the foot.
   *
   * The app listens to the page's own scroll and fetches at 600 points from the
   * bottom; a sentinel with the same margin is the web's way of saying the same
   * thing, and it fires the same "before they reach the gap" way.
   */
  const foot = useRef<HTMLDivElement>(null);
  const active = tab === "vibes" ? vibes : shelf;
  useEffect(() => {
    const node = foot.current;
    if (!node || locked) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (!entries.some((entry) => entry.isIntersecting)) return;
        if (active.hasNextPage && !active.isFetchingNextPage) void active.fetchNextPage();
      },
      { rootMargin: "600px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [active, locked]);

  const pills: { key: Shelf; label: string }[] = [
    { key: "drops", label: t("Drops") },
    { key: "vibes", label: t("Vibes") },
    { key: "audios", label: t("Audios") },
  ];

  const spinner = (
    <div className="flex justify-center py-5">
      <span className="size-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
    </div>
  );

  /** The app's own one-line answer, drawn where a grid would be. */
  const line = (text: string) => (
    <p className="px-[18px] py-5 text-[13px] leading-5 text-dim">{text}</p>
  );

  function body() {
    if (shelf.isLoading) return spinner;
    if (shelf.isError) return line(errorMessage(shelf.error));
    if (locked) {
      return (
        <div className="px-[18px] py-12 text-center">
          <p className="text-[13.5px] font-extrabold">{gate?.title || t("This account is private")}</p>
          <p className="mx-auto mt-1 max-w-[320px] text-[12px] leading-5 text-dim">
            {gate?.text || t("Keep this account to see what they put up.")}
          </p>
        </div>
      );
    }

    const grid = (list: Drop[], busy: boolean) => (
      <div className="px-[18px]">
        <div className="grid grid-cols-3 gap-1">
          {list.map((drop) => (
            <Square key={String(drop.id)} drop={drop} />
          ))}
        </div>
        {busy ? spinner : null}
      </div>
    );

    if (tab === "vibes") {
      if (vibes.isLoading && !vibeRows.length) return spinner;
      if (vibes.isError) return line(errorMessage(vibes.error));
      if (!vibeRows.length) {
        return line(mine ? t("No vibes yet.") : t("Nothing here yet."));
      }
      return grid(vibeRows, vibes.isFetchingNextPage);
    }

    const list = tab === "audios" ? sounds : drops;
    if (list.length) return grid(list, shelf.isFetchingNextPage);
    // A private account does not drop — "private" and "posted where anybody can
    // read it" are two answers to one question — so the empty line says so
    // rather than offering a way in that is not there.
    if (mine && shelf.data?.pages?.[0]?.can_post === false) {
      return line(
        t(
          "A private profile does not drop. Make your profile public again and what you put up shows here.",
        ),
      );
    }
    return line(
      mine
        ? tab === "audios"
          ? t("No audios yet.")
          : t("Nothing dropped yet.")
        : t("Nothing here yet."),
    );
  }

  return (
    <div>
      <div className="no-scrollbar flex gap-2 overflow-x-auto px-[18px] pb-1.5 pt-[18px]">
        {pills.map((pill) => {
          const on = tab === pill.key;
          return (
            <button
              key={pill.key}
              type="button"
              onClick={() => setTab(pill.key)}
              className={cn(
                "shrink-0 rounded-full border px-3.5 py-[7px] text-[13px] tracking-[0.2px] transition",
                on
                  ? "border-[color-mix(in_srgb,var(--accent)_50%,transparent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] font-bold text-accent"
                  : "border-transparent bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] font-semibold text-dim",
              )}
              aria-pressed={on}
            >
              {pill.label}
            </button>
          );
        })}
      </div>
      <div className="mt-1">{body()}</div>
      <div ref={foot} className="h-px" />
    </div>
  );
}