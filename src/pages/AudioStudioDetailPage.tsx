import { useMemo, type ReactNode } from "react";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CloudOff, ChartLine } from "lucide-react";
import { Blank } from "@/components/ui/Blank";
import { PageHeader } from "@/components/layout/Page";
import { audioService } from "@/services/audio.service";
import { count, duration } from "@/utils/format";
import { errorMessage } from "@/utils/errors";
import { CoverArt, coverTone, seedOf } from "@/features/audio/parts";
import { SectionTitle, weekSpan } from "@/features/audio/rows";

/**
 * One thing in the studio, opened — `AudioStudioItemScreen`.
 *
 * The whole feature is the honest absence, so the page is built around what it
 * refuses to draw. A row the trend engine has not scored carries no score and
 * no band — not a zero, not a dash — and says in the server's own sentence why
 * there is no number. A rate whose denominator was zero says "Not measured",
 * because "nobody listened" and "everybody who listened skipped" are opposite
 * facts and a nought per cent would state the second. Who used an uploaded
 * sound cannot be known at all: `used_by.countries` is null there rather than
 * an empty list, and null is drawn as "Not recorded", never as "None yet".
 *
 * Two asks, and the second is not allowed to take the first away: the audience
 * is fetched after the studio read succeeds, and its failure leaves every
 * number above it standing. The whole page is one's own — somebody else's id
 * is a 404 from the service — and it says so instead of pretending.
 */

const SUMS: { key: string; label: string }[] = [
  { key: "impressions", label: "Impressions" },
  { key: "starts", label: "Starts" },
  { key: "qualified", label: "Qualified" },
  { key: "completes", label: "Completes" },
  { key: "skips", label: "Skips" },
  { key: "replays", label: "Replays" },
  { key: "saves", label: "Saves" },
  { key: "shares", label: "Shares" },
  { key: "uses", label: "Uses" },
];

const RATES: { key: string; label: string }[] = [
  { key: "completion", label: "Completion" },
  { key: "skip", label: "Skip" },
  { key: "replay", label: "Replay" },
];

const RIGHTS = ["playable", "promotable", "savable", "shareable"] as const;

const RIGHT_WORDS: Record<string, string> = {
  playable: "Not playable",
  promotable: "Not promotable",
  savable: "Not savable",
  shareable: "Not shareable",
};

/** A number read the way a person reads it: no trailing ".00" on a whole one. */
function scoreText(value: number) {
  return Number.isInteger(value) ? String(Math.round(value)) : value.toFixed(2);
}

/** The server's outcome, turned into a heading word. */
function outcomeWord(outcome: string | undefined) {
  const low = (outcome ?? "").trim().toLowerCase();
  if (low === "insufficient") return "Insufficient";
  if (low === "no_data" || low === "nodata") return "No data yet";
  if (low === "measured") return "Measured";
  return low || "Not measured";
}

/** The band itself, or the server's word where a number is not there. */
function bandWord(stage: string | undefined) {
  const low = (stage ?? "").trim().toLowerCase();
  if (low === "no_data" || low === "nodata") return "No data";
  if (low === "insufficient") return "Insufficient";
  if (!low) return "No data";
  return low[0].toUpperCase() + low.slice(1);
}

/** A component key, turned into a heading word. */
function keyWord(key: string) {
  const words = key.replaceAll("_", " ").trim();
  if (!words) return "Trend";
  return words[0].toUpperCase() + words.slice(1);
}

/** Whether a component's outcome is the server saying it could not be read. */
function noData(outcome: string | undefined) {
  const low = (outcome ?? "").trim().toLowerCase();
  return low.includes("insufficient") || low.includes("no_data") || low.includes("nodata");
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 px-4 py-1">
      <span className="min-w-0 flex-1 text-[13px] text-dim">{label}</span>
      <span className="text-right text-[13px] font-bold">{value}</span>
    </div>
  );
}

export function AudioStudioDetailPage() {
  const { itemId = "" } = useParams();

  const read = useQuery({
    queryKey: ["audio-studio", itemId],
    queryFn: () => audioService.studioDetail(itemId),
    enabled: Boolean(itemId),
    staleTime: 30_000,
  });

  // The second question, asked only once the first has answered — and its
  // failure is swallowed into `undefined` so the numbers above it stay.
  const audience = useQuery({
    queryKey: ["audio-studio-audience", itemId],
    queryFn: () => audioService.studioAudience(itemId),
    enabled: Boolean(itemId) && read.isSuccess,
    staleTime: 30_000,
    retry: false,
  });

  const item = read.data?.item;
  const totals = useMemo(() => read.data?.totals ?? {}, [read.data]);
  const rates = useMemo(() => read.data?.rates ?? {}, [read.data]);
  const components = useMemo(() => read.data?.components ?? [], [read.data]);
  const usedBy = read.data?.used_by;
  const standing = read.data?.standing;
  const rights = read.data?.rights ?? {};

  const measured = item?.score != null;
  const restricted = RIGHTS.filter((name) => rights[name] === false);

  const heard = audience.data;
  const days = heard?.days ?? [];
  const most = days.reduce((top, day) => Math.max(top, day.starts ?? 0), 0);

  return (
    <div className="min-h-dvh pb-[calc(100px+env(safe-area-inset-bottom,0px))] md:pb-28">
      <PageHeader title={item?.title || "Studio"} back />

      {read.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <span className="size-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : read.isError ? (
        <Blank
          icon={<CloudOff className="size-[46px]" />}
          title="No answer"
          line={errorMessage(read.error)}
          action={
            <button type="button" className="btn btn-secondary mt-4" onClick={() => void read.refetch()}>
              Try again
            </button>
          }
        />
      ) : !item ? (
        <Blank
          icon={<ChartLine className="size-[46px]" />}
          title="That audio is gone"
          line="It may have been taken down."
        />
      ) : (
        <>
          {/* The head: the sleeve, the name, and the facts that are always numbers. */}
          <div className="px-4 pt-2">
            <div
              className="flex items-start gap-3.5 rounded-3xl border p-3.5"
              style={{
                backgroundColor: `${coverTone(seedOf(item.seed))}1a`,
                borderColor: `${coverTone(seedOf(item.seed))}47`,
              }}
            >
              <CoverArt seed={seedOf(item.seed)} size={88} radius={18} />
              <div className="min-w-0 flex-1">
                <p className="text-[18px] font-extrabold tracking-[-0.2px]">{item.title}</p>
                <p className="mt-0.5 truncate text-[13.5px] text-dim">{item.artist}</p>
                <div className="mt-2.5 flex flex-wrap gap-1.5">
                  {item.duration ? <Chip>{duration(item.duration)}</Chip> : null}
                  <Chip>
                    {count(item.plays ?? 0)} {(item.plays ?? 0) === 1 ? "play" : "plays"}
                  </Chip>
                  <Chip>
                    {item.listeners == null
                      ? "Listeners not recorded"
                      : `${count(item.listeners)} ${item.listeners === 1 ? "listener" : "listeners"}`}
                  </Chip>
                  <Chip>{item.kind === "sound" ? "Sound" : "Track"}</Chip>
                </div>
              </div>
            </div>
          </div>

          {/* The ten lifetime sums, the same for every row. */}
          <SectionTitle>Lifetime</SectionTitle>
          <div className="grid grid-cols-3 gap-2 px-4">
            {SUMS.map((sum) => (
              <Stat key={sum.key} label={sum.label} value={count(totals[sum.key] ?? 0)} />
            ))}
            <Stat label="Listened" value={duration(Math.round((totals.listen_ms ?? 0) / 1000))} />
          </div>

          {/* The trend read: the headline, the rates, and what it is made of. */}
          <SectionTitle>The trend read</SectionTitle>
          <div className="flex items-center gap-2 px-4 pb-1">
            {measured ? (
              <>
                {item.stage ? (
                  <span className="rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-2 py-0.5 text-[11px] font-extrabold text-accent">
                    {bandWord(item.stage)}
                  </span>
                ) : null}
                <span className="text-[15px] font-extrabold tabular-nums">{scoreText(item.score!)}</span>
              </>
            ) : (
              <span className="text-[13px] font-bold text-dim">{outcomeWord(item.outcome)}</span>
            )}
          </div>
          {item.why ? (
            <p className="px-4 pb-2 text-[12.5px] leading-[1.4] text-dim">{item.why}</p>
          ) : null}

          {RATES.map((rate) => {
            const value = rates[rate.key];
            return (
              <div key={rate.key} className="flex items-center gap-3 px-4 py-1">
                <span className="min-w-0 flex-1 text-[13.5px] font-semibold">{rate.label}</span>
                <span
                  className={
                    value == null
                      ? "text-[13.5px] font-extrabold text-dim"
                      : "text-[13.5px] font-extrabold tabular-nums"
                  }
                >
                  {value == null ? "Not measured" : `${Math.round(value * 100)}%`}
                </span>
              </div>
            );
          })}

          {components.map((part) => {
            const short = noData(part.outcome);
            const weight = part.weight ?? 0;
            return (
              <div key={part.key} className="px-4 pt-1.5">
                <div className="rounded-[14px] bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] px-3 py-2.5">
                  <div className="flex items-center gap-2">
                    <span className="min-w-0 flex-1 text-[13.5px] font-bold">{keyWord(part.key)}</span>
                    <span
                      className={
                        short
                          ? "text-[13px] font-extrabold text-dim"
                          : "text-[13px] font-extrabold tabular-nums"
                      }
                    >
                      {short ? outcomeWord(part.outcome) : scoreText(part.value ?? 0)}
                    </span>
                    {!short && weight !== 0 ? (
                      <span className="text-[11.5px] text-dim tabular-nums">weight {scoreText(weight)}</span>
                    ) : null}
                  </div>
                  {part.why ? (
                    <p className="mt-1 text-[12px] leading-[1.35] text-dim">{part.why}</p>
                  ) : null}
                </div>
              </div>
            );
          })}

          {/* The audience, over the window the server chose — and honest place. */}
          {heard ? (
            <>
              <SectionTitle>Audience · last {heard.window?.days ?? 0} days</SectionTitle>
              {heard.outcome === "measured" && days.length ? (
                <div className="flex h-[72px] items-end px-4 pt-1">
                  {days.map((day) => (
                    <div key={day.day} className="flex-1 px-0.5" title={`${day.day}: ${count(day.starts ?? 0)}`}>
                      <div
                        className="rounded-[4px] bg-[color-mix(in_srgb,var(--accent)_55%,transparent)]"
                        style={{ height: most === 0 ? 2 : 2 + ((day.starts ?? 0) / most) * 58 }}
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="px-4 pb-2 text-[12.5px] text-dim">Nothing was heard in this window.</p>
              )}
              <p className="px-4 pb-1 pt-2.5 text-[10.5px] font-bold tracking-[0.3px] text-dim">
                Where they are
              </p>
              <p className="px-4 pb-1 text-[12px] leading-[1.35] text-dim">
                {heard.countries?.why ? `Not recorded. ${heard.countries.why}` : "Not recorded."}
              </p>
            </>
          ) : null}

          {/* Who used it, where the app records that at all. */}
          <SectionTitle>Used by</SectionTitle>
          {usedBy?.countries == null ? (
            <p className="px-4 pb-1 text-[12.5px] leading-[1.4] text-dim">
              {usedBy?.why ? `Not recorded. ${usedBy.why}` : "Not recorded."}
            </p>
          ) : (
            <>
              <Fact label="Creators" value={String(usedBy.creators ?? 0)} />
              <Fact label="Posts" value={String(usedBy.posts ?? 0)} />
              <Fact label="Countries" value={usedBy.countries.length ? usedBy.countries.join(", ") : "None yet"} />
            </>
          )}

          {/* This week's standing in the board's own points. */}
          {standing?.week ? (
            <>
              <SectionTitle>This week</SectionTitle>
              <Fact label="Points" value={String(standing.points ?? 0)} />
              {weekSpan(standing.week) ? <Fact label="Week of" value={weekSpan(standing.week)} /> : null}
            </>
          ) : null}

          {/* Only the rights that are false — silence means the account may do all four. */}
          {restricted.length ? (
            <>
              <SectionTitle>Not available</SectionTitle>
              {restricted.map((name) => (
                <p key={name} className="px-4 pb-1 text-[12.5px] text-dim">
                  {RIGHT_WORDS[name] ?? `Not ${name}`}
                </p>
              ))}
            </>
          ) : null}
        </>
      )}
    </div>
  );
}

function Chip({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full bg-[color-mix(in_srgb,var(--ink)_7%,transparent)] px-2 py-[3px] text-[11px] font-semibold text-dim">
      {children}
    </span>
  );
}

/** A small square of one lifetime sum: the number over its name. */
function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] px-3 py-2">
      <p className="text-[15px] font-extrabold tabular-nums">{value}</p>
      <p className="mt-px text-[10.5px] text-dim">{label}</p>
    </div>
  );
}