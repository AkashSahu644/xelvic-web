import { AuthedImage } from "@/components/Media";
import { cn } from "@/lib/cn";
import { count } from "@/lib/format";

/**
 * The numbers the players already reported about a clip of mine.
 *
 * Ported from `screens/vibe_studio.dart` and `apps/drops/vibe_studio.py`.
 * Nothing here is a new measurement: the Vibes player times every look and
 * sends it to `/reco/signals/`, and this file is a *reader* of what that kept.
 * That is the only honest way to say "no fake" — every number on the page was
 * being recorded before the page existed.
 *
 * Two rules ride with it, both the app's:
 *
 *   * A rate nobody could be divided by is drawn as *Not measured*, never as
 *     `0%`. "Everybody who watched skipped" and "nobody watched" are not the
 *     same sentence, and a nought says the first.
 *   * A clip with nothing behind it says so rather than drawing a card of
 *     noughts, which would read as a clip nobody wanted rather than as a clip
 *     nobody has seen yet.
 */
export interface VibeStudioRates {
  skip: number | null;
  completion: number | null;
  replay: number | null;
  keep: number | null;
  impression_keep: number | null;
}

export interface VibeStudioNumbers {
  watchers: number;
  kept: number;
  unkept: number;
  looks: number;
  plays: number;
  skips: number;
  completes: number;
  replays: number;
  rewinds: number;
  pauses: number;
  watched_ms: number;
  avg_ms: number | null;
  avg_stayed_ms: number | null;
  impressions: number;
  reached: number;
  kept_impressions: number;
  unkept_impressions: number;
  swipes: number;
  avg_swipe_ms: number | null;
  rates: VibeStudioRates;
}

export interface VibeStudioItem extends VibeStudioNumbers {
  id: string;
  caption: string;
  music: string;
  created_at: string;
  thumbnail: string | null;
  duration_ms: number | null;
  views: number;
  likes: number;
  comments: number;
  shares: number;
  outcome: "measured" | "no_data" | string;
  why: string;
}

export interface VibeStudioList {
  days: number;
  since: string;
  totals: VibeStudioNumbers;
  vibes: VibeStudioItem[];
}

export interface VibeStudioDetail {
  days: number;
  since: string;
  item: VibeStudioItem;
}

export interface VibeStudioDay {
  day: string;
  watchers: number;
  looks: number;
  completes: number;
  skips: number;
  watched_ms: number;
  avg_ms: number | null;
  impressions: number;
  reached: number;
  future: boolean;
}

export interface VibeStudioAudience {
  id: string;
  days: number;
  since: string;
  series: VibeStudioDay[];
}

/** A length of watching as a person reads it: `0:04`, `1:12`, `1:02:03`. */
export function vibeLengthText(ms: number | null | undefined, absent = "—"): string {
  if (ms === null || ms === undefined) return absent;
  const seconds = Math.max(0, Math.floor(ms / 1000));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const tail = String(seconds % 60).padStart(2, "0");
  return hours === 0 ? `${minutes}:${tail}` : `${hours}:${String(minutes).padStart(2, "0")}:${tail}`;
}

/** A share as a percentage, or the `absent` word when there is no denominator. */
export function vibeRateText(value: number | null | undefined, absent = "—"): string {
  return value === null || value === undefined ? absent : `${Math.round(value * 100)}%`;
}

/** A count as the app writes counts, with the word kept singular at one. */
export function vibeCountText(value: number, one: string, many: string): string {
  return value === 1 ? `1 ${one}` : `${count(value)} ${many}`;
}

/** When it went up, in the shortest words that are still true. */
export function sinceText(at: string): string {
  const when = new Date(at);
  if (Number.isNaN(when.getTime())) return "";
  const days = Math.floor((Date.now() - when.getTime()) / 86_400_000);
  if (days <= 0) return "Up today";
  if (days === 1) return "Up yesterday";
  if (days < 30) return `Up ${days} days ago`;
  return `Up on ${at.slice(0, 10)}`;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="mb-2 mt-5 text-[15px] font-extrabold tracking-[-0.2px]">{children}</h2>;
}

interface Tile {
  label: string;
  value: string;
  note: string;
}

/**
 * A run of tiles, laid out so they fill the width they are given.
 *
 * Two columns on a phone and four on anything wide enough to hold them — the
 * app's own `_Tiles`, which uses a `Wrap` over the same breakpoint. A grid and
 * not a wrap here because the web's tiles are all one width and the grid is the
 * same layout with less arithmetic.
 */
function Tiles({ tiles }: { tiles: Tile[] }) {
  if (!tiles.length) return null;
  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
      {tiles.map((tile) => (
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
  );
}

/**
 * The audience split in two: the watchers who keep me, and the rest.
 *
 * One bar and two numbers, because the two halves are the same fact read from
 * both ends and the one thing worth seeing at a glance is the proportion. The
 * bar is drawn only when somebody watched — a split of nobody is not a split.
 */
function Split({ watchers, kept, unkept }: { watchers: number; kept: number; unkept: number }) {
  if (watchers <= 0) {
    return <p className="mt-3 text-[12.5px] text-dim">Nobody has watched this in the window.</p>;
  }
  return (
    <div
      className="mt-3 rounded-[16px] p-3.5"
      style={{ backgroundColor: "color-mix(in srgb, var(--ink) 5%, transparent)" }}
    >
      <p className="text-[10.5px] font-bold tracking-[0.3px] text-dim">Who watched</p>
      <div className="mt-2 flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold text-accent">With keeps</p>
          <p className="num text-[20px] font-extrabold leading-tight">{count(kept)}</p>
          <p className="text-[11px] text-dim">people who follow you</p>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-bold text-dim">Without keeps</p>
          <p className="num text-[20px] font-extrabold leading-tight">{count(unkept)}</p>
          <p className="text-[11px] text-dim">everybody else</p>
        </div>
      </div>
      <div className="mt-3 flex h-2 overflow-hidden rounded-full" aria-hidden>
        <span
          className="h-full bg-accent"
          style={{ flexGrow: Math.max(1, kept), flexBasis: 0 }}
        />
        {unkept > 0 ? (
          <span
            className="h-full"
            style={{
              flexGrow: Math.max(1, unkept),
              flexBasis: 0,
              backgroundColor: "color-mix(in srgb, var(--ink) 18%, transparent)",
            }}
          />
        ) : null}
      </div>
      <p className="mt-2 text-[11.5px] text-dim">
        {vibeCountText(watchers, "person watched", "people watched")}
      </p>
    </div>
  );
}

/**
 * One rate: its name, its number, and what it is a share *of*.
 *
 * A rate with no denominator has no number and is drawn as the words rather
 * than as a nought per cent — see the note at the top of this file.
 */
function Rate({ label, value, of }: { label: string; value: number | null; of: string }) {
  const absent = value === null;
  return (
    <div className="flex items-center gap-3 py-[5px]">
      <div className="min-w-0 flex-1">
        <p className="text-[13.5px] font-semibold">{label}</p>
        <p className="text-[11px] text-dim">{of}</p>
      </div>
      <p
        className={cn(
          "num shrink-0 font-extrabold",
          absent ? "text-[12px] text-dim" : "text-[14px]",
        )}
      >
        {absent ? "Not measured" : vibeRateText(value)}
      </p>
    </div>
  );
}

/** The clip's still and its name. */
function Head({ item }: { item: VibeStudioItem }) {
  const caption = item.caption.trim();
  return (
    <div className="flex items-start gap-3.5">
      <AuthedImage
        src={item.thumbnail}
        alt={caption || "Clip"}
        loading="eager"
        className="h-[100px] w-[76px] shrink-0 rounded-[14px] bg-surface-2"
      />
      <div className="min-w-0 flex-1">
        <p className="text-[16px] font-extrabold leading-tight tracking-[-0.2px]">
          {caption || "Untitled"}
        </p>
        {item.music.trim() ? (
          <p className="mt-0.5 truncate text-[12.5px] text-dim">{item.music.trim()}</p>
        ) : null}
        <p className="mt-2 text-[11.5px] text-dim">{sinceText(item.created_at)}</p>
      </div>
    </div>
  );
}

/**
 * Everything the players reported about one clip, as a run of tiles.
 *
 * The clip's own statistics sheet draws this same component — a second copy
 * written for the sheet would be a second reading of the same fields, drifting
 * from this one the first time either changed. That is why it lives here rather
 * than inside the studio's page.
 */
export function VibeStudioRead({ item, days = 0 }: { item: VibeStudioItem; days?: number }) {
  const duration = item.duration_ms;
  const measured = item.outcome === "measured";
  return (
    <div>
      <Head item={item} />
      {!measured ? (
        <p className="mt-2.5 text-[12.5px] leading-[1.4] text-dim">
          {item.why || "Nothing has reached this clip yet."}
        </p>
      ) : null}

      <Split watchers={item.watchers} kept={item.kept} unkept={item.unkept} />

      <SectionTitle>Watching</SectionTitle>
      <Tiles
        tiles={[
          { label: "Watchers", value: count(item.watchers), note: "people" },
          { label: "Looks", value: count(item.looks), note: "times" },
          { label: "Plays", value: count(item.plays), note: "presses" },
          { label: "Replays", value: count(item.replays), note: "second runs" },
          { label: "Completed", value: count(item.completes), note: "to the end" },
          { label: "Skips", value: count(item.skips), note: "swiped away" },
          {
            label: "Average look",
            value: vibeLengthText(item.avg_ms),
            note: item.avg_ms === null ? "nothing watched" : "per look",
          },
          {
            label: "Average kept look",
            value: vibeLengthText(item.avg_stayed_ms),
            note: item.avg_stayed_ms === null ? "nothing stayed" : "past the swipe",
          },
          {
            label: "Watched for",
            value: vibeLengthText(item.watched_ms, "—"),
            note: "all looks added up",
          },
          { label: "Rewinds", value: count(item.rewinds), note: "went back" },
          { label: "Pauses", value: count(item.pauses), note: "stopped" },
          { label: "Swipes", value: count(item.swipes), note: "left early" },
          {
            label: "Average swipe",
            value: vibeLengthText(item.avg_swipe_ms),
            note: item.avg_swipe_ms === null ? "nobody swiped" : "before leaving",
          },
          ...(duration && duration > 0
            ? [{ label: "Clip length", value: vibeLengthText(duration), note: "as uploaded" }]
            : []),
        ]}
      />

      <SectionTitle>Shown</SectionTitle>
      <Tiles
        tiles={[
          { label: "Impressions", value: count(item.impressions), note: "times drawn" },
          { label: "Reached", value: count(item.reached), note: "people" },
          {
            label: "By keepers",
            value: count(item.kept_impressions),
            note: "drawn for people who keep you",
          },
          {
            label: "By others",
            value: count(item.unkept_impressions),
            note: "drawn for everybody else",
          },
        ]}
      />

      <SectionTitle>Rates</SectionTitle>
      <Rate label="Kept you" value={item.rates.keep} of="of the people who watched" />
      <Rate label="Skip" value={item.rates.skip} of="of the plays" />
      <Rate label="Completion" value={item.rates.completion} of="of the looks" />
      <Rate label="Replay" value={item.rates.replay} of="of the looks" />
      <Rate label="Kept per impression" value={item.rates.impression_keep} of="of the times it was drawn" />

      <SectionTitle>On the clip</SectionTitle>
      <Tiles
        tiles={[
          { label: "Views", value: count(item.views), note: "lifetime" },
          { label: "Felt", value: count(item.likes), note: "lifetime" },
          { label: "Comments", value: count(item.comments), note: "lifetime" },
          { label: "Shares", value: count(item.shares), note: "lifetime" },
        ]}
      />

      {days > 0 ? (
        <p className="mt-3.5 text-[11.5px] leading-[1.4] text-dim">
          {`Every number above except the four on the clip is the last ${days} days — as far back as the app keeps a look.`}
        </p>
      ) : null}
    </div>
  );
}

/**
 * The window, day by day, for one clip.
 *
 * The bars are only drawn when something actually happened inside the window: a
 * silent window is a window of real noughts, and a chart of flat noughts is a
 * chart of nothing. That is the one thing this section must never draw.
 */
export function VibeStudioAudienceChart({ audience }: { audience: VibeStudioAudience }) {
  const measured = audience.series.some((day) => day.looks > 0 || day.watchers > 0);
  const most = audience.series.reduce((top, day) => Math.max(top, day.looks), 0);
  return (
    <div>
      <SectionTitle>{`Watching · last ${audience.days} days`}</SectionTitle>
      {measured ? (
        <div className="flex h-[76px] items-end pb-1" role="img" aria-label="Looks on each day of the window">
          {audience.series.map((day) => (
            <div key={day.day} className="flex h-full flex-1 items-end px-[1.5px]">
              <div
                // A real nought keeps a two-point nub rather than vanishing, so
                // the days are still countable; a day that has not happened yet
                // is drawn at the same height in a fainter tone, because "nobody
                // watched" and "not yet" are two different facts.
                style={{
                  height: most === 0 || day.future ? 2 : 2 + (day.looks / most) * 62,
                  backgroundColor: `color-mix(in srgb, var(--accent) ${day.future ? 18 : 55}%, transparent)`,
                }}
                className="w-full rounded-[3px]"
                title={
                  day.future
                    ? `${day.day}: not yet`
                    : `${day.day}: ${vibeCountText(day.looks, "look", "looks")} · ${vibeCountText(
                        day.watchers,
                        "watcher",
                        "watchers",
                      )}`
                }
              />
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[12.5px] text-dim">Nothing was watched in this window.</p>
      )}
    </div>
  );
}