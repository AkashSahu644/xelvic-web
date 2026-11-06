import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useParams } from "react-router-dom";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { CloudOff, LibraryBig } from "lucide-react";
import { Blank } from "@/components/ui/Blank";
import { PageHeader } from "@/components/layout/Page";
import { audioService } from "@/services/audio.service";
import { cn } from "@/utils/cn";
import { errorMessage } from "@/utils/errors";
import { AudioRowTile, moodName } from "@/features/audio/rows";
import { useToast } from "@/hooks/useToast";
import type { AudioLanguage, AudioMood, AudioRow } from "@/types/api";

/**
 * One shelf of the reco engine, opened from a chip on the Audio tab.
 *
 * Ported from `screens/audio_category.dart`. Ten rows a page, the next page
 * appended as the foot is neared, a spinner while it is on its way, and a quiet
 * end when there is no more. A row the server has not measured draws no score —
 * not a zero — and a shelf the backend said was insufficient says why in one
 * quiet line rather than leaving an empty page unexplained.
 *
 * The Language and Mood shelves are different: their options are the section's
 * whole vocabulary, each with a count that may be zero. A zero-count option is
 * still a chip, and tapping it says there is no audio in it yet and leaves the
 * pick where it was — the app's own rule, so a tap never blanks the page for a
 * choice it made on the reader's behalf.
 */

interface ShelfState {
  title?: string;
  subtitle?: string;
  languages?: AudioLanguage[];
  moods?: AudioMood[];
  current?: string;
}

/** The distinct tags the shelf's own rows carry, in first-seen order. */
function tags(rows: AudioRow[], pick: (row: AudioRow) => string[] | undefined) {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const row of rows) {
    for (const tag of pick(row) ?? []) {
      if (tag && !seen.has(tag)) {
        seen.add(tag);
        out.push(tag);
      }
    }
  }
  return out;
}

function FilterRow({
  label,
  values,
  picked,
  nameOf,
  onPick,
}: {
  label: string;
  values: string[];
  picked?: string;
  nameOf?: (value: string) => string;
  onPick: (value: string) => void;
}) {
  return (
    <div className="pt-2">
      <p className="px-4 pb-1.5 text-[10.5px] font-bold tracking-[0.3px] text-dim">{label}</p>
      <div className="no-scrollbar flex h-10 items-center gap-2 overflow-x-auto px-4">
        {values.map((value) => (
          <button
            key={value}
            type="button"
            onClick={() => onPick(value)}
            aria-pressed={picked === value}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-[12.5px] font-bold transition",
              picked === value
                ? "border-accent bg-accent text-on-accent"
                : "border-line bg-card text-ink hover:border-accent/35",
            )}
          >
            {nameOf ? nameOf(value) : value}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AudioCategoryPage() {
  const { key = "" } = useParams();
  const location = useLocation();
  const state = (location.state ?? {}) as ShelfState;
  const { toast } = useToast();

  const [language, setLanguage] = useState<string | undefined>(
    key === "language" ? state.current || undefined : undefined,
  );
  const [mood, setMood] = useState<string | undefined>(undefined);
  const [genre, setGenre] = useState<string | undefined>(undefined);

  // A direct visit has no state to read the card from, so the catalogue is
  // asked once — the same ask the tab made, which is served from its cache when
  // the chip was pressed a moment ago.
  const catalogue = useQuery({
    queryKey: ["audio-categories"],
    queryFn: () => audioService.categories(),
    staleTime: 300_000,
    enabled: !state.title,
    retry: false,
  });
  const card = catalogue.data?.categories.find((one) => one.key === key);
  const title = state.title || card?.title || key;
  const subtitle = state.subtitle || card?.subtitle || undefined;
  const languages = state.languages ?? catalogue.data?.languages ?? [];
  const moods = state.moods ?? catalogue.data?.moods ?? [];

  const languageShelf = key === "language" && languages.length > 0;
  const moodShelf = key === "mood" && moods.length > 0;

  const shelf = useInfiniteQuery({
    queryKey: ["audio-shelf", key, language ?? "", mood ?? "", genre ?? ""],
    queryFn: ({ pageParam }) =>
      audioService.shelf(key, {
        page: Number(pageParam),
        language: language || undefined,
        mood: mood || undefined,
        genre: genre || undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.has_more ? (last.page ?? 1) + 1 : undefined),
    enabled: Boolean(key),
  });

  const rows = useMemo(
    () => (shelf.data?.pages ?? []).flatMap((page) => page.rows ?? []),
    [shelf.data],
  );
  const first = shelf.data?.pages?.[0];

  // Tags are read off the first unfiltered page and only for a plain shelf: a
  // shelf already scoped to a tag carries that tag on every row, so the other
  // tags would vanish from under the very filter that is filtering by them.
  const [moodTags, genreTags] = useMemo(() => {
    if (mood || genre) return [[], []] as [string[], string[]];
    return [tags(rows, (row) => row.moods), tags(rows, (row) => row.genres)] as [string[], string[]];
  }, [rows, mood, genre]);

  const hasFilters = languageShelf || moodShelf || moodTags.length > 0 || genreTags.length > 0;

  // The next page, asked for as the foot comes into view — the app listens to
  // its own scroll and asks 600 points before the bottom; a sentinel says the
  // same thing in a browser.
  const foot = useRef<HTMLDivElement>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = shelf;
  useEffect(() => {
    const node = foot.current;
    if (!node || !hasNextPage || isFetchingNextPage) return;
    const watcher = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void fetchNextPage();
      },
      // Further out than the phone's 600 points: per-request latency here is a
      // few hundred milliseconds before the server has done anything, and a
      // shelf should never stop for a spinner under a thumb that is reading.
      { rootMargin: "1800px 0px" },
    );
    watcher.observe(node);
    return () => watcher.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, rows.length]);

  function nothingBehind(name: string) {
    toast({ title: `No audio in ${name} yet.`, tone: "error" });
  }

  function pickLanguage(code: string) {
    if (code === language) return;
    const total = languages.find((one) => one.code === code)?.total ?? 0;
    if (total <= 0) {
      nothingBehind(languages.find((one) => one.code === code)?.name || code.toUpperCase());
      return;
    }
    setLanguage(code);
  }

  function pickMood(next: string) {
    if (moodShelf) {
      if (next === mood) return;
      const total = moods.find((one) => one.key === next)?.total ?? 0;
      if (total <= 0) {
        nothingBehind(moodName(next));
        return;
      }
      setMood(next);
      return;
    }
    setMood(mood === next ? undefined : next);
  }

  const outcome = (first?.outcome ?? "").toLowerCase();
  const insufficient =
    outcome.includes("insufficient") ||
    outcome.includes("no_data") ||
    outcome.includes("nodata") ||
    outcome.includes("browse");

  return (
    <div className="min-h-dvh pb-[calc(100px+env(safe-area-inset-bottom,0px))] md:pb-28">
      <PageHeader title={title} back />

      {subtitle ? <p className="px-4 pt-3.5 text-[12.5px] leading-[1.35] text-dim">{subtitle}</p> : null}

      {hasFilters ? (
        <div className="pb-1">
          {languageShelf ? (
            <FilterRow
              label="Language"
              values={languages.map((one) => one.code)}
              picked={language}
              nameOf={(code) =>
                languages.find((one) => one.code === code)?.name || code.toUpperCase()
              }
              onPick={pickLanguage}
            />
          ) : null}
          {moodShelf ? (
            <FilterRow
              label="Mood"
              values={moods.map((one) => one.key)}
              picked={mood}
              nameOf={moodName}
              onPick={pickMood}
            />
          ) : null}
          {genreTags.length ? (
            <FilterRow
              label="Genre"
              values={genreTags}
              picked={genre}
              onPick={(value) => setGenre(genre === value ? undefined : value)}
            />
          ) : null}
          {moodTags.length ? (
            <FilterRow
              label="Mood"
              values={moodTags}
              picked={mood}
              nameOf={moodName}
              onPick={pickMood}
            />
          ) : null}
        </div>
      ) : null}

      {shelf.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <span className="size-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : shelf.isError ? (
        <Blank
          icon={<CloudOff className="size-[46px]" />}
          title="No answer"
          line={errorMessage(shelf.error)}
          action={
            <button type="button" className="btn btn-secondary mt-4" onClick={() => void shelf.refetch()}>
              Try again
            </button>
          }
        />
      ) : !rows.length ? (
        insufficient ? (
          <p className="px-6 py-12 text-center text-[13.5px] leading-[1.45] text-dim">
            {first?.why || first?.outcome}
          </p>
        ) : (
          <Blank
            icon={<LibraryBig className="size-[46px]" />}
            title="Nothing here yet"
            line="No audio is on this shelf right now."
          />
        )
      ) : (
        <>
          {first?.outcome === "browse" && first?.why ? (
            <p className="px-4 pb-1 pt-3 text-[12.5px] leading-[1.35] text-dim">{first.why}</p>
          ) : null}
          <div className="pt-1">
            {rows.map((row) => (
              <AudioRowTile key={`${row.source ?? "row"}-${row.id}`} row={row} rows={rows} />
            ))}
          </div>
          <div ref={foot} />
          {isFetchingNextPage ? (
            <div className="flex justify-center py-5">
              <span className="size-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          ) : hasNextPage ? (
            <div className="h-7" />
          ) : (
            <div className="flex items-center justify-center gap-2 py-6 text-[12.5px] font-semibold text-dim">
              <span aria-hidden>✦</span>
              That is everything on this shelf.
            </div>
          )}
        </>
      )}
    </div>
  );
}