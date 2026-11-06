import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "react-router-dom";
import { CloudOff, ChartColumn } from "lucide-react";
import { Blank } from "@/components/ui/Blank";
import { AuthedImage } from "@/components/media/Media";
import { PageHeader } from "@/components/layout/Page";
import { dropsService } from "@/services/drops.service";
import { ApiError, errorMessage } from "@/utils/errors";
import { count } from "@/utils/format";
import {
  VibeStudioAudienceChart,
  VibeStudioRead,
  vibeCountText,
  vibeLengthText,
  type VibeStudioItem,
  type VibeStudioNumbers,
} from "@/features/drops/VibeStudio";

/**
 * The Vibe studio: the numbers on my own clips, and the page for one of them.
 *
 * Ported from `screens/vibe_studio.dart`. The audio section's studio is the
 * shape this is cut from, and the ask was the same one for Vibes: every number
 * the players already reported about a clip of mine, split into the people who
 * keep me and the people who do not, with the skips and the average look among
 * them — and with nothing invented to fill a card.
 *
 * `/drops/vibes/studio/` is mine only and says so by answering only my rows; the
 * web is not told which clips to ask about, because the server already knows
 * whose they are. The window is the server's (`days`, `since` in the answer),
 * and the page says the one it actually read rather than the one it asked for.
 */
export function VibeStudioPage() {
  const { vibeId } = useParams();
  return vibeId ? <StudioItem id={vibeId} /> : <StudioList />;
}

function StudioFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-dvh pb-[calc(92px+env(safe-area-inset-bottom,0px))] md:pb-16">
      <PageHeader title={title} back />
      <div className="mx-auto w-full max-w-3xl px-4 pb-6 md:px-7">{children}</div>
    </div>
  );
}

function StudioList() {
  const studio = useQuery({
    queryKey: ["vibe-studio"],
    queryFn: () => dropsService.studio(),
  });

  if (studio.isLoading) {
    return (
      <StudioFrame title="Vibe studio">
        <div className="flex justify-center py-20">
          <span className="size-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </StudioFrame>
    );
  }

  if (studio.isError) {
    return (
      <StudioFrame title="Vibe studio">
        <Blank
          top=""
          icon={<CloudOff className="size-[46px]" />}
          title="No answer from the server"
          line={errorMessage(studio.error)}
          action={
            <button type="button" className="btn btn-secondary mt-4" onClick={() => void studio.refetch()}>
              Try again
            </button>
          }
        />
      </StudioFrame>
    );
  }

  const data = studio.data;
  if (!data || data.vibes.length === 0) {
    return (
      <StudioFrame title="Vibe studio">
        <Blank
          top=""
          icon={<ChartColumn className="size-[46px]" />}
          title="Nothing of yours yet"
          line="Put a Vibe up and its numbers are read here — who watched, who kept you, who skipped, and how long they stayed."
        />
      </StudioFrame>
    );
  }

  return (
    <StudioFrame title="Vibe studio">
      <p className="pt-3.5 text-[12.5px] leading-[1.35] text-dim">
        {`Everything the players reported about your clips, over the last ${data.days} days. Open one for the whole read.`}
      </p>
      <Totals totals={data.totals} days={data.days} />
      <h2 className="mb-2 mt-5 text-[15px] font-extrabold tracking-[-0.2px]">Your clips</h2>
      <div className="divide-y divide-line">
        {data.vibes.map((item) => (
          <ItemTile key={item.id} item={item} />
        ))}
      </div>
    </StudioFrame>
  );
}

/**
 * The window's totals, over every clip at once.
 *
 * The people-counts here are *distinct people*, so this is not the sum of the
 * rows around it and is not drawn as one: one person who watched four of my
 * clips is one watcher of me and four watchers of my clips. The server counts
 * them in a query of its own for exactly that reason.
 */
function Totals({ totals, days }: { totals: VibeStudioNumbers; days: number }) {
  const nothing = totals.looks === 0 && totals.impressions === 0 && totals.watchers === 0;
  return (
    <div>
      <h2 className="mb-2 mt-5 text-[15px] font-extrabold tracking-[-0.2px]">{`Last ${days} days`}</h2>
      {nothing ? (
        <p className="text-[12.5px] text-dim">Nothing has reached your clips in this window.</p>
      ) : (
        <>
          <div
            className="rounded-[18px] border border-line p-3.5"
            style={{ backgroundColor: "color-mix(in srgb, var(--ink) 5%, transparent)" }}
          >
            <p className="text-[10.5px] font-bold tracking-[0.3px] text-dim">Who watched</p>
            <div className="mt-2 flex items-start gap-3">
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-accent">With keeps</p>
                <p className="num text-[20px] font-extrabold leading-tight">{count(totals.kept)}</p>
                <p className="text-[11px] text-dim">people who follow you</p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[12px] font-bold text-dim">Without keeps</p>
                <p className="num text-[20px] font-extrabold leading-tight">{count(totals.unkept)}</p>
                <p className="text-[11px] text-dim">everybody else</p>
              </div>
            </div>
            <div className="mt-3 flex h-2 overflow-hidden rounded-full" aria-hidden>
              <span className="h-full bg-accent" style={{ flexGrow: Math.max(1, totals.kept), flexBasis: 0 }} />
              {totals.unkept > 0 ? (
                <span
                  className="h-full"
                  style={{
                    flexGrow: Math.max(1, totals.unkept),
                    flexBasis: 0,
                    backgroundColor: "color-mix(in srgb, var(--ink) 18%, transparent)",
                  }}
                />
              ) : null}
            </div>
            <p className="mt-2 text-[11.5px] text-dim">
              {vibeCountText(totals.watchers, "person watched", "people watched")}
            </p>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 md:grid-cols-4">
            {[
              { label: "Looks", value: count(totals.looks), note: "times watched" },
              { label: "Plays", value: count(totals.plays), note: "presses" },
              { label: "Skips", value: count(totals.skips), note: "swiped away" },
              {
                label: "Average look",
                value: vibeLengthText(totals.avg_ms),
                note: totals.avg_ms === null ? "nothing watched" : "per look",
              },
              { label: "Completed", value: count(totals.completes), note: "to the end" },
              { label: "Replays", value: count(totals.replays), note: "second runs" },
              { label: "Impressions", value: count(totals.impressions), note: "times drawn" },
              { label: "Reached", value: count(totals.reached), note: "people" },
            ].map((tile) => (
              <div
                key={tile.label}
                className="rounded-[12px] px-3 py-2.5"
                style={{ backgroundColor: "color-mix(in srgb, var(--ink) 5%, transparent)" }}
              >
                <p className="num text-[17px] font-extrabold leading-tight">{tile.value}</p>
                <p className="mt-px truncate text-[11.5px] font-semibold">{tile.label}</p>
                <p className="mt-px line-clamp-2 text-[10.5px] leading-[1.25] text-dim">{tile.note}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

/** One row of the list: the still, the caption, and the read at a glance. */
function ItemTile({ item }: { item: VibeStudioItem }) {
  const caption = item.caption.trim();
  return (
    <Link
      to={`/app/drops/vibes/studio/${item.id}`}
      className="flex items-center gap-3 rounded-[14px] px-2 py-2.5 transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
    >
      <AuthedImage
        src={item.thumbnail}
        alt={caption || "Clip"}
        className="h-[64px] w-12 shrink-0 rounded-[10px] bg-surface-2 object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-bold">{caption || "Untitled"}</p>
        {item.outcome === "measured" ? (
          <p className="mt-0.5 truncate text-[11.5px] text-dim">
            {`${vibeCountText(item.watchers, "watcher", "watchers")} · ${vibeCountText(
              item.kept,
              "kept",
              "kept",
            )} · avg ${vibeLengthText(item.avg_ms)}`}
          </p>
        ) : (
          <p className="mt-0.5 line-clamp-2 text-[11.5px] leading-[1.3] text-dim">
            {item.why || "No data yet"}
          </p>
        )}
      </div>
    </Link>
  );
}

/** The whole read, for one clip. */
function StudioItem({ id }: { id: string }) {
  const studio = useQuery({
    queryKey: ["vibe-studio-item", id],
    queryFn: () => dropsService.studioItem(id),
  });

  // The window is a second question, and a failure of it must not take the page
  // away: the numbers above stand on their own without it.
  const audience = useQuery({
    queryKey: ["vibe-studio-audience", id],
    queryFn: () => dropsService.studioAudience(id),
    retry: false,
  });

  const caption = studio.data?.item.caption.trim();
  const title = caption || "Clip";

  if (studio.isLoading) {
    return (
      <StudioFrame title={title}>
        <div className="flex justify-center py-20">
          <span className="size-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      </StudioFrame>
    );
  }

  if (studio.isError) {
    // A clip that is not mine answers 404 rather than 403 — the server's own
    // choice, so a stranger cannot learn that an id exists by being refused
    // differently — and the two readings of a 404 are "gone" and "not mine",
    // which are the same sentence to whoever is standing here.
    const gone = studio.error instanceof ApiError && studio.error.status === 404;
    return (
      <StudioFrame title={title}>
        <Blank
          top=""
          icon={<CloudOff className="size-[46px]" />}
          title={gone ? "That clip is gone" : "No answer from the server"}
          line={gone ? "It may have been taken down." : errorMessage(studio.error)}
          action={
            <button type="button" className="btn btn-secondary mt-4" onClick={() => void studio.refetch()}>
              Try again
            </button>
          }
        />
      </StudioFrame>
    );
  }

  if (!studio.data) return null;

  return (
    <StudioFrame title={title}>
      <div className="pt-2">
        <VibeStudioRead item={studio.data.item} days={studio.data.days} />
        {audience.data ? <VibeStudioAudienceChart audience={audience.data} /> : null}
      </div>
    </StudioFrame>
  );
}