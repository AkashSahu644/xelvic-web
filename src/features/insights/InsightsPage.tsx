import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { keepPreviousData } from "@tanstack/react-query";
import { LineChart as InsightsMark, WifiOff } from "lucide-react";
import { Blank } from "@/components/Blank";
import { PageHeader } from "@/components/Page";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { clock, count, fullDay, monthName, shortDay } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useAuth } from "@/providers/AuthProvider";
import { usePreferences } from "@/providers/PreferencesProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { BarRow, Chip, DeltaChip, MetricCard, Panel, Sparkline, TrendChart } from "./Charts";
import {
  BUCKETS,
  RANGES,
  breakdownEmpty,
  bucket,
  cardsOf,
  fits,
  inGroup,
  readsFrom,
  repeats,
  type Buckets,
  type InsightContent,
  type InsightMetric,
  type Reads,
} from "./model";

/**
 * Insights: what a page has been doing, for the person whose page it is.
 *
 * Ported from `app/lib/screens/insights.dart`. This is the one screen in the app
 * that is about the account rather than about anybody's conversation, and it is
 * reachable only from your own profile — the server refuses it to everybody else
 * with a named code, and this screen has no entry point anywhere but there.
 *
 * **Read downward, and in the order the questions come in.** How the whole thing
 * has moved; how many people came; who stayed; what they did; what I put up; and
 * what it was that worked. The page is numbers all the way down — the list of
 * *who* looked was taken out by the owner's own ask on 2026-10-18: a page's
 * analytics should say how it is growing, not hand somebody a roster of who was
 * looking. So the request asks the server not to work it out (`?visitors=0`).
 *
 * **Growth comes first, and it is the only chart on the screen.** Everything
 * below it is a number with a shape beside it; this is the one drawing that is
 * the whole account at once, and it is the reason to open the screen. Day, week
 * and month are its granularity, and the bucketing is done here — see `bucket`
 * in the model for why a sum of days is the only honest way to do it.
 *
 * **A page with nothing on it says so rather than drawing zeroes at length.**
 * Four cards reading `0` over four flat lines is a screen that looks broken, and
 * it is the state every account starts in. The window is still drawn — the dates
 * and the range chips are true — but the numbers give way to one line saying
 * what fills them in.
 *
 * **It says nothing in sentences.** Every panel is a title and numbers, and the
 * titles come from the server. Nothing here counts anything: every figure comes
 * from `apps/social/insights.py`, including the engagement rate and the two
 * numbers behind it, so the screen never divides on its own.
 */
export function InsightsPage() {
  const { user } = useAuth();
  const { t } = usePreferences();
  const { accentAt } = useTheme();

  const [days, setDays] = useState<number>(RANGES[1].days);
  const [by, setBy] = useState<Buckets>("day");
  /** Which metric the growth chart is drawing. Null means the first card. */
  const [pick, setPick] = useState<string | null>(null);

  const owner = String(user?.id ?? "");

  const answer = useQuery({
    queryKey: ["insights", owner, days],
    queryFn: () =>
      api.get(
        `/social/users/${owner}/insights/?days=${days}&visitors=0`,
      ),
    enabled: Boolean(owner),
    // The chips re-ask, and a screen that blanked on every tap would redraw a
    // moment later. Keeping the last reading while the next one is in flight is
    // what makes the range chips feel like a filter rather than a page load.
    placeholderData: keepPreviousData,
  });

  const reads = useMemo<Reads | null>(
    () => (answer.data ? readsFrom(answer.data) : null),
    [answer.data],
  );

  /** The metric the growth chart is on, or null when there is nothing to draw. */
  const charting = useMemo<InsightMetric | null>(() => {
    if (!reads) return null;
    const cards = cardsOf(reads);
    if (cards.length === 0) return null;
    // A stored pick the server has stopped sending falls back to the first card
    // rather than leaving the chart blank.
    return cards.find((one) => one.key === pick) ?? cards[0];
  }, [reads, pick]);

  /**
   * Whether there is anything at all to say about this window.
   *
   * The test is on the *facts* and not on the numbers: a page with no views and
   * no breakdown has nothing behind it, and drawing four zeroes over four flat
   * lines would be a screen that looks broken rather than a page nobody has
   * found yet. One metric with something in it is enough to draw the whole board.
   */
  const blank = useMemo(() => {
    if (!reads) return false;
    if (!breakdownEmpty(reads.breakdown)) return false;
    return !reads.metrics.some((one) => one.total > 0);
  }, [reads]);

  /** What a point is called under the plot. */
  const axisAs = (day: string, cut: Buckets) => (cut === "month" ? monthName(day) : shortDay(day));

  /** What the readout above the plot says about the point under the pointer. */
  const readAs = (day: string, cut: Buckets) => {
    if (cut === "day") return fullDay(day);
    if (cut === "week") return t(`Week of ${shortDay(day)}`);
    return `${monthName(day)} ${day.slice(0, 4)}`;
  };

  /** One group's numbers, less the ones already drawn as a card above. */
  const rest = (group: string) =>
    inGroup(reads as Reads, group).filter((one) => !(reads as Reads).headline.includes(one.key));

  const rangeChips = (
    <div className="no-scrollbar flex gap-2 overflow-x-auto px-3.5 pb-1.5 pt-2.5">
      {RANGES.map((range) => (
        <Chip
          key={range.days}
          label={t(range.label)}
          on={days === range.days}
          onTap={days === range.days ? null : () => setDays(range.days)}
        />
      ))}
    </div>
  );

  return (
    <div className="mx-auto w-full max-w-[760px] pb-[calc(96px+env(safe-area-inset-bottom,0px))] md:pb-14">
      <PageHeader title={t("Insights")} back />

      {/* The chips stay outside the scrolling area because they are the screen's
          only control: a filter you have to scroll back up to find is a filter
          people stop using, and every number below them is a different number
          the moment one is tapped. */}
      <div className="sticky top-0 z-10 bg-page">{rangeChips}</div>

      {answer.isError && !reads ? (
        <Blank
          top="pt-20"
          icon={<WifiOff className="size-[46px]" />}
          title={t("No answer from the server")}
          line={errorMessage(answer.error)}
          action={
            <button type="button" className="btn btn-secondary mt-4" onClick={() => void answer.refetch()}>
              {t("Try again")}
            </button>
          }
        />
      ) : !reads ? (
        <div className="flex justify-center py-16">
          <span className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : (
        <div className="px-3.5 pb-9 pt-1.5">
          {/* The two dates the board covers, and what it is being compared
              against. Said plainly and near the top, because every number under
              it is a number *for that window*. */}
          <div className="flex items-center px-0.5 pb-3 pt-0.5">
            <p className="min-w-0 flex-1 truncate text-[13.5px] font-bold">
              {`${shortDay(reads.from)} – ${shortDay(reads.to)}`}
            </p>
            <p className="ml-2 shrink-0 text-[11.5px] text-dim">
              {t(`vs the ${reads.days} days before`)}
            </p>
          </div>

          {blank ? (
            <div className="pt-10">
              <Blank
                icon={<InsightsMark className="size-[46px]" />}
                title={t("Nothing yet in these days")}
                line={t(
                  "Insights fill in as people find your page and do something with what you put up.\n\nTry a longer window, or share a moment.",
                )}
              />
            </div>
          ) : (
            <>
              {/* ------------------------------------------------ growth -- */}
              {charting ? (
                <Panel title={t("Growth")} className="mb-2.5">
                  <div className="no-scrollbar flex gap-2 overflow-x-auto">
                    {cardsOf(reads).map((one) => (
                      <Chip
                        key={one.key}
                        label={one.title}
                        on={one.key === charting.key}
                        onTap={one.key === charting.key ? null : () => setPick(one.key)}
                      />
                    ))}
                  </div>
                  <div className="mt-3">
                    <TrendChart
                      points={bucket(charting.points, fits(charting, by) ? by : "day")}
                      color="var(--accent)"
                      height={160}
                      hint={t("Drag along the chart")}
                      axisLabel={(day) => axisAs(day, fits(charting, by) ? by : "day")}
                      readoutLabel={(day) => readAs(day, fits(charting, by) ? by : "day")}
                    />
                  </div>
                  <div className="mt-3 flex items-end">
                    {/* The window's own total, the same number the card below
                        says and in the same rule as every other count here. */}
                    <span className="text-[26px] font-extrabold leading-none tracking-[-0.6px] tabular-nums">
                      {count(charting.total)}
                    </span>
                    <span className="ml-2 min-w-0 flex-1 pb-[3px] text-[12px] text-dim">
                      {t(`in the last ${reads.days} days`)}
                    </span>
                    <span className="shrink-0 pb-[3px]">
                      <DeltaChip change={charting.change} />
                    </span>
                  </div>
                  <div className="no-scrollbar mt-3 flex gap-2 overflow-x-auto">
                    {BUCKETS.map((cut) => {
                      const cutBy = fits(charting, by) ? by : "day";
                      return (
                        <Chip
                          key={cut.key}
                          label={t(cut.label)}
                          on={cut.key === cutBy}
                          enabled={fits(charting, cut.key)}
                          onTap={cut.key === cutBy ? null : () => setBy(cut.key)}
                        />
                      );
                    })}
                  </div>
                </Panel>
              ) : null}

              {/* ---------------------------------------------- headline -- */}
              <div className="mb-2.5 grid grid-cols-2 gap-2.5">
                {cardsOf(reads).map((one, index) => (
                  <MetricCard key={one.key} metric={one} color={accentAt(index)} />
                ))}
              </div>

              {/* -------------------------------------------- engagement -- */}
              <Panel title={t("Interactions")} className="mb-2.5">
                <div className="flex items-end">
                  <span className="text-[30px] font-extrabold leading-none tracking-[-0.8px] tabular-nums">
                    {reads.engagement.rate === null
                      ? "—"
                      : `${Math.round(reads.engagement.rate * 100)}%`}
                  </span>
                  <div className="ml-2.5 min-w-0 flex-1 pb-[3px]">
                    <p className="text-[12px] leading-[1.3] text-dim">
                      {didSomething(reads, t)}
                    </p>
                    {/* The action count is a different fact and is said as one.
                        Two lines rather than one because they answer two
                        different questions, and a single sentence carrying both
                        reads as a single number with a contradiction in it. */}
                    {repeats(reads.engagement) ? (
                      <p className="pt-px text-[11px] leading-[1.3] text-dim">
                        {t(`${count(reads.engagement.interactions)} actions in all, repeats counted`)}
                      </p>
                    ) : null}
                  </div>
                </div>
              </Panel>

              {/* What is left of each group once the cards have taken their
                  share: the carded numbers are the head of these groups, and a
                  board that drew the same number twice would be spending a third
                  of the screen repeating itself. */}
              {reads.groups.map((group) => {
                const rows = rest(group.key);
                if (rows.length === 0) return null;
                return (
                  <Panel key={group.key} title={group.title} className="mb-2.5">
                    {rows.map((one, index) => (
                      <div
                        key={one.key}
                        className={cn(index > 0 && "border-t border-[color-mix(in_srgb,var(--line)_70%,transparent)]")}
                      >
                        <Tally metric={one} color={accentAt(index)} t={t} />
                      </div>
                    ))}
                  </Panel>
                );
              })}

              {/* -------------------------------------------- breakdowns -- */}
              <Ranked
                title={t("Your moments")}
                rows={reads.breakdown.moments}
                label={(one) => one.body || t("A moment")}
                note={(one) =>
                  [
                    t(`${count(one.watchers ?? 0)} watched`),
                    t(`${count(one.faces ?? 0)} faces`),
                    t(`${count(one.items ?? 0)} items`),
                  ].join(" · ")
                }
              />
              <Ranked
                title={t("Your drops and vibes")}
                rows={reads.breakdown.content}
                label={(one) =>
                  one.body || (one.kind === "vibe" ? t("A vibe") : t("A drop"))
                }
                note={(one) =>
                  [
                    t(`${count(one.likes)} felt`),
                    t(`${count(one.comments)} replies`),
                    t(`${count(one.shares)} passed on`),
                  ].join(" · ")
                }
              />
              {reads.breakdown.reactions.length > 0 ? (
                <Panel title={t("How they answered")} className="mb-2.5">
                  {reads.breakdown.reactions.map((one) => (
                    <BarRow
                      key={one.label}
                      label={one.label}
                      value={one.count}
                      top={reads.breakdown.reactions.reduce(
                        (best, row) => Math.max(best, row.count),
                        0,
                      )}
                    />
                  ))}
                </Panel>
              ) : null}

              {/* The one number on this screen that is not a window. A Vibe's
                  views are a bare counter with no date against them, so there is
                  no series to draw — it is drawn apart from everything else, with
                  the window it is *not* about named in the line under it. */}
              {reads.vibeViews > 0 ? (
                <Panel title={t("Vibes, all time")} className="mb-2.5">
                  <div className="flex items-end">
                    <span className="text-[30px] font-extrabold leading-none tracking-[-0.8px] tabular-nums">
                      {count(reads.vibeViews)}
                    </span>
                    <span className="ml-2 pb-[3px] text-[12px] text-dim">
                      {t(reads.vibeViews === 1 ? "look, ever" : "looks, ever")}
                    </span>
                  </div>
                </Panel>
              ) : null}
            </>
          )}

          {/* When this was counted. The last line on the page, and the only place
              the word *now* appears: a board that says nothing about its own age
              invites the reader to assume it is live. */}
          <p className="pb-1 pt-2 text-center text-[11px] text-dim">
            {reads.generatedAt
              ? t(`Counted ${shortDay(reads.generatedAt)} at ${clock(reads.generatedAt)}.`)
              : t("Counted in the last few minutes.")}
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * How much of the audience did anything, as the app's own sentence.
 *
 * The rate above it is a boast on its own: a dashboard that shows one without
 * saying what it is a fraction *of* makes a person feel good about a quiet
 * month. Every number here is people, which is why this is built from `engaged`
 * and `reached` and never from the action count.
 */
function didSomething(reads: Reads, t: (key: string) => string): string {
  const { engaged, reached } = reads.engagement;
  const who = reached === 1 ? "person" : "people";
  return t(`${count(engaged)} of ${count(reached)} ${who} did something`);
}

/** One day-counted number: what it is, how much, which way it went, and its shape. */
function Tally({
  metric,
  color,
  t,
}: {
  metric: InsightMetric;
  color: string;
  t: (key: string) => string;
}) {
  return (
    <div className="py-2.5">
      <div className="flex items-center">
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold">{metric.title}</span>
        <span className="ml-2 shrink-0 text-[15px] font-extrabold tabular-nums">
          {count(metric.total)}
        </span>
      </div>
      <div className="mt-[3px] flex items-center">
        {/* The period it is being compared with, always written out. A bare
            arrow asks the reader to remember what last month was, and nobody
            does. */}
        <span className="min-w-0 flex-1 text-[11px] text-dim">
          {t(
            metric.previous === 1
              ? `${count(metric.previous)} in the day before`
              : `${count(metric.previous)} in the ${count(metric.previous)} days before`,
          )}
        </span>
        <DeltaChip change={metric.change} bare />
      </div>
      <div className="mt-[7px]">
        <Sparkline points={metric.points} color={color} height={26} />
      </div>
    </div>
  );
}

/** One ranked list of things. */
function Ranked({
  title,
  rows,
  label,
  note,
}: {
  title: string;
  rows: InsightContent[];
  label: (one: InsightContent) => string;
  note: (one: InsightContent) => string;
}) {
  if (rows.length === 0) return null;
  const top = rows.reduce((best, one) => Math.max(best, one.score), 0);
  return (
    <Panel title={title} className="mb-2.5">
      {rows.map((one) => (
        <BarRow key={one.id} label={label(one)} value={one.score} top={top} note={note(one)} />
      ))}
    </Panel>
  );
}
