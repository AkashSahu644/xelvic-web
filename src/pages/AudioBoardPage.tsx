import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, CloudOff, Trophy } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Blank } from "@/components/ui/Blank";
import { PageHeader } from "@/components/layout/Page";
import { audioService } from "@/services/audio.service";
import { count } from "@/utils/format";
import { errorMessage } from "@/utils/errors";
import { AudioRowTile, BoardStripCard, PlaylistCard, SectionTitle, weekSpan } from "@/features/audio/rows";
import type { AudioRow } from "@/types/api";

/**
 * The weekly board, as a page of its own — `screens/audio_board.dart`.
 *
 * Two different questions answer "what is worth listening to", and this is one
 * of them. The **board** is a weekly standing in the app's own points (a view
 * is one, a play five, a heart twenty-five) and it forgets: each week's numbers
 * are their own. A **category shelf** is the other question — how fast
 * something is rising. They read alike only at a glance, which is why the tab
 * reaches this by "See all" on the strip and not through a chip.
 *
 * The server sends `boards` in the order it means them drawn, so this page
 * draws that order rather than deciding which shelves are worth reading. A
 * shelf standing on an older week says so under its own heading, because a
 * week-old number under this week's title is a chart nobody can check.
 *
 * The playlists board's rows are *shelves*, not tracks — `board.PLAYLISTS` is
 * the one board whose rows carry `name`/`count`/`seconds` and no `title` — so
 * it is drawn with the playlist card and every other board with the row.
 */

const SHELF_BOARD = "playlists";

function isShelfRow(row: AudioRow) {
  return Boolean(row.name);
}

export function AudioBoardPage() {
  const board = useQuery({
    queryKey: ["audio-trending"],
    queryFn: () => audioService.trending(),
    staleTime: 60_000,
  });

  const charts = board.data?.boards ?? [];
  const week = weekSpan(board.data?.week);
  const any = charts.some((chart) => chart.rows.length > 0) || (board.data?.creators ?? []).length > 0;

  return (
    <div className="min-h-dvh pb-[calc(100px+env(safe-area-inset-bottom,0px))] md:pb-28">
      <PageHeader title="Trending" back />

      {board.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <span className="size-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : board.isError ? (
        <Blank
          icon={<CloudOff className="size-[46px]" />}
          title="No answer"
          line={errorMessage(board.error)}
          action={
            <button type="button" className="btn btn-secondary mt-4" onClick={() => void board.refetch()}>
              Try again
            </button>
          }
        />
      ) : !any ? (
        <Blank
          icon={<Trophy className="size-[46px]" />}
          title="Nothing on the board yet"
          line="The board is what has been played this week. Play something and it will be here."
        />
      ) : (
        <>
          {week ? (
            <div className="flex items-center gap-1.5 px-4 pt-4 text-[12.5px] font-semibold text-dim">
              <CalendarDays className="size-[13px]" aria-hidden />
              Week of {week}
            </div>
          ) : null}

          {charts.map((chart) =>
            !chart.rows.length ? null : (
              <div key={chart.key}>
                <SectionTitle>
                  {chart.stale ? `${chart.label} · week of ${weekSpan(chart.week)}` : chart.label}
                </SectionTitle>
                {chart.key === SHELF_BOARD || chart.rows.every(isShelfRow) ? (
                  <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1">
                    {chart.rows.map((row) => (
                      <PlaylistCard
                        key={row.id}
                        playlist={{
                          id: row.id,
                          name: row.name ?? row.title ?? "",
                          seed: row.seed,
                          count: row.count,
                          seconds: row.seconds,
                          owner: row.owner,
                          owner_username: row.owner_username,
                          mine: row.mine,
                          shared: row.shared,
                          cover: row.cover ?? null,
                        }}
                      />
                    ))}
                  </div>
                ) : chart.key === "sounds" || chart.key === "podcasts" ? (
                  <div className="no-scrollbar flex h-[176px] gap-3 overflow-x-auto px-4">
                    {chart.rows.map((row) => (
                      <BoardStripCard key={row.id} row={row} rows={chart.rows} />
                    ))}
                  </div>
                ) : (
                  <div className="pt-1">
                    {chart.rows.map((row) => (
                      <AudioRowTile key={row.id} row={row} rows={chart.rows} />
                    ))}
                  </div>
                )}
              </div>
            ),
          )}

          {board.data?.creators?.length ? (
            <>
              <SectionTitle>Most played makers</SectionTitle>
              <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 pb-2">
                {board.data.creators.map((person) => (
                  <Link key={person.id} to={`/app/u/${person.username}`} className="w-[84px] shrink-0 text-center">
                    <Avatar name={person.name} src={person.avatar ?? undefined} size={64} className="mx-auto" />
                    <span className="mt-1.5 block truncate text-[12px] font-bold">{person.name}</span>
                    <span className="block truncate text-[10.5px] text-dim">
                      {count(person.plays)} {person.plays === 1 ? "play" : "plays"}
                    </span>
                  </Link>
                ))}
              </div>
            </>
          ) : null}
        </>
      )}
    </div>
  );
}