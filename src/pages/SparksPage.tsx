import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowUpRight, Coins, Flame, Medal, Palette, Shield, Sparkles, Trophy, Wallet as WalletIcon } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/States";
import { ThemeShop } from "@/features/sparks/ThemeShop";
import type { WalletData } from "@/features/sparks/types";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { count, relativeTime } from "@/lib/format";
import { useTheme } from "@/providers/ThemeProvider";
import type { Medal as MedalRow, Spark, SparkTier, Wallet } from "@/types/api";

interface SparksCatalog {
  tiers: SparkTier[];
  shield_max: number;
  century: number;
  warn_seconds: number;
}

interface SparksData {
  sparks: Spark[];
  total: number;
  wallet: Wallet;
  catalog: SparksCatalog;
}

type Tab = "themes" | "wallet" | "streaks" | "ladder" | "medals";

const TONES: Record<string, string> = {
  amber: "#E5A11A",
  rose: "#E8558A",
  magenta: "#D02B9A",
  violet: "#8B5CF6",
  cyan: "#0891B2",
  mint: "#2FB47C",
  gold: "#C99312",
};

function tone(tier?: SparkTier | null) {
  return TONES[tier?.colour || ""] || "var(--accent)";
}

function SparkCard({ spark }: { spark: Spark }) {
  const person = spark.other;
  const pct = Math.max(0, Math.min(100, Math.round((spark.pct ?? 0) * 100)));
  const colour = tone(spark.stage);
  return (
    <div className="rounded-[18px] border border-line bg-card p-3.5">
      <div className="flex items-start gap-3">
        <Link to={person ? `/app/u/${person.username}` : "/app/convo"} className="shrink-0"><Avatar user={person} size={44} /></Link>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <Link to={person ? `/app/u/${person.username}` : "/app/convo"} className="block truncate text-[12px] font-extrabold hover:underline">{person?.name || person?.username || "A convo"}</Link>
              <p className="text-[10px] text-dim">
                {spark.count ? `${count(spark.count)} days` : "No live run"}
                {spark.best ? ` · best ${count(spark.best)}` : ""}
                {spark.note ? ` · ${spark.note}` : ""}
              </p>
            </div>
            {spark.stage ? (
              <span className="shrink-0 rounded-full px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider" style={{ color: colour, backgroundColor: `color-mix(in srgb, ${colour} 13%, transparent)` }}>
                {spark.stage.name}
              </span>
            ) : null}
          </div>

          <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--ink)_7%,transparent)]">
            <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: colour }} />
          </div>
          <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[9px] text-dim">
            {spark.next_stage ? <span>{spark.days_left === 1 ? "1 day" : `${spark.days_left ?? 0} days`} to {spark.next_stage.name}</span> : <span>Century kept</span>}
            {spark.shields ? <span className="flex items-center gap-0.5"><Shield className="size-2.5" />{spark.shields}/{spark.shield_cap ?? 5}</span> : null}
            {spark.closing ? <span className="font-bold text-[var(--bad)]">The day is nearly gone</span> : spark.at_risk ? <span className="font-bold text-[var(--bad)]">Say something today</span> : spark.done ? <span className="font-bold text-[var(--good)]">Today is counted</span> : null}
            {spark.laps ? <span className="flex items-center gap-0.5"><Trophy className="size-2.5" />{spark.laps} kept</span> : null}
          </div>
        </div>
      </div>
      <div className="mt-2.5 flex justify-end">
        <Link to={spark.thread_id ? `/app/convo/${spark.thread_id}` : "/app/convo"} className="flex items-center gap-1 text-[10px] font-bold text-accent hover:underline">Open the convo <ArrowUpRight className="size-3" /></Link>
      </div>
    </div>
  );
}

export function SparksPage() {
  const [tab, setTab] = useState<Tab>("themes");
  const { setDesign } = useTheme();

  const sparks = useQuery({
    queryKey: ["sparks"],
    queryFn: () => api.get<SparksData>("/sparks/"),
    refetchInterval: 60_000,
  });
  const wallet = useQuery({
    queryKey: ["sparks-wallet"],
    queryFn: () => api.get<WalletData>("/sparks/wallet/"),
    enabled: tab === "wallet" || tab === "themes",
  });
  const medals = useQuery({
    queryKey: ["sparks-medals"],
    queryFn: () => api.get<{ medals: MedalRow[] }>("/sparks/medals/"),
    enabled: tab === "medals",
  });

  const data = sparks.data;
  const catalog = data?.catalog;
  const current = data?.sparks.reduce<Spark | null>((best, spark) => {
    if (!spark.stage) return best;
    if (!best) return spark;
    return (spark.pos ?? 0) > (best.pos ?? 0) ? spark : best;
  }, null)?.stage?.key;
  const owned = data?.wallet.owned ?? [];

  return (
    <div className="mx-auto w-full max-w-[760px] pb-[calc(100px+env(safe-area-inset-bottom,0px))] md:pb-16">
      <header className="px-4 pt-4 md:pt-6">
        <h1 className="flex items-center gap-2 text-[20px] font-extrabold tracking-tight"><Sparkles className="size-5 text-accent" /> Sparks</h1>
        <p className="mt-0.5 text-[10px] text-dim">A day counted for every day you both speak.</p>

        <div className="relative mt-4 overflow-hidden rounded-[22px] border border-line bg-[color-mix(in_srgb,var(--accent)_10%,var(--card))] p-4">
          <div className="absolute -right-5 -top-7 size-28 rounded-full bg-[var(--accent-soft)] blur-2xl" />
          <div className="relative flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-dim">Live days</p>
              <p className="mt-0.5 text-[36px] font-extrabold leading-none tracking-tight">{data ? count(data.total) : "—"}</p>
              <p className="mt-1 text-[10px] text-dim">{data?.sparks.length ?? 0} {(data?.sparks.length ?? 0) === 1 ? "spark" : "sparks"} alive right now</p>
            </div>
            <div className="rounded-[14px] bg-card/70 px-3 py-2 text-right backdrop-blur">
              <p className="flex items-center justify-end gap-1 text-[9px] font-bold uppercase tracking-wider text-dim"><Coins className="size-3" /> Wallet</p>
              <p className="text-[20px] font-extrabold tabular-nums">{data ? count(data.wallet.balance) : "—"}</p>
            </div>
          </div>
          <div className="relative mt-3 flex gap-4 text-[9px] text-dim">
            <span>Earned {data ? count(data.wallet.earned) : "—"}</span>
            <span>Spent {data ? count(data.wallet.spent) : "—"}</span>
            <span>{owned.length} themes owned</span>
          </div>
        </div>

        <div className="mt-3 flex gap-1 overflow-x-auto pb-1">
          {([
            ["themes", "Themes", <Palette key="t" className="size-3.5" />],
            ["wallet", "Wallet", <WalletIcon key="w" className="size-3.5" />],
            ["streaks", "Streaks", <Flame key="s" className="size-3.5" />],
            ["ladder", "Ladder", <Trophy key="l" className="size-3.5" />],
            ["medals", "Medals", <Medal key="m" className="size-3.5" />],
          ] as const).map(([key, label, icon]) => (
            <button key={key} type="button" onClick={() => setTab(key)} className={cn("flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-bold transition", tab === key ? "bg-accent text-[var(--accent-ink)]" : "bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] text-dim hover:text-ink")}>
              {icon}{label}
            </button>
          ))}
        </div>
      </header>

      <main className="px-4 pt-3">
        {sparks.isLoading ? <PageSkeleton rows={3} /> : sparks.isError ? (
          <div className="card"><ErrorState error={sparks.error} onRetry={() => void sparks.refetch()} /></div>
        ) : tab === "streaks" ? (
          !data?.sparks.length ? (
            <EmptyState icon={<Flame className="size-6" />} title="No sparks yet" body="Speak on two days in a row with somebody and the first one lights." action={<Link to="/app/convo" className="btn btn-primary">Open a convo</Link>} />
          ) : (
            <div className="space-y-2.5">{data.sparks.map((spark, index) => <SparkCard key={spark.thread_id ?? spark.id ?? index} spark={spark} />)}</div>
          )
        ) : tab === "wallet" || tab === "themes" ? (
          wallet.isLoading ? <PageSkeleton rows={2} /> : wallet.isError ? (
            <div className="card"><ErrorState error={wallet.error} onRetry={() => void wallet.refetch()} /></div>
          ) : tab === "themes" ? (
            wallet.data ? <ThemeShop wallet={wallet.data} /> : <PageSkeleton rows={2} />
          ) : (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-2">
                {[
                  ["Balance", wallet.data?.balance ?? 0],
                  ["Earned", wallet.data?.earned ?? 0],
                  ["Spent", wallet.data?.spent ?? 0],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-[14px] border border-line bg-card px-3 py-3 text-center">
                    <p className="text-[18px] font-extrabold tabular-nums">{count(Number(value))}</p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-dim">{label}</p>
                  </div>
                ))}
              </div>

              {wallet.data?.people.length ? (
                <section>
                  <h2 className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-dim">Who put days in</h2>
                  <div className="mt-2 divide-y divide-line/70 rounded-[16px] border border-line bg-card">
                    {wallet.data.people.map((row) => (
                      <div key={row.thread_id} className="flex items-center gap-3 px-3 py-2.5">
                        <Avatar user={row.other} size={32} />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-bold">{row.other?.name || row.other?.username || "A convo"}</p>
                          <p className="text-[9px] text-dim">{row.first || ""}{row.last ? ` to ${row.last}` : ""}</p>
                        </div>
                        <span className="text-[11px] font-extrabold tabular-nums text-accent">{row.days}d</span>
                      </div>
                    ))}
                  </div>
                </section>
              ) : null}

              <section>
                <h2 className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-dim">Ledger</h2>
                {!wallet.data?.entries.length ? (
                  <p className="py-8 text-center text-[11px] text-dim">No wallet lines yet.</p>
                ) : (
                  <div className="mt-2 divide-y divide-line/70 rounded-[16px] border border-line bg-card">
                    {wallet.data.entries.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-3 px-3 py-2.5">
                        <span className={cn("flex size-7 items-center justify-center rounded-full text-[10px] font-extrabold", entry.amount >= 0 ? "bg-[color-mix(in_srgb,var(--good)_12%,transparent)] text-[var(--good)]" : "bg-[color-mix(in_srgb,var(--bad)_10%,transparent)] text-[var(--bad)]")}>{entry.amount >= 0 ? "+" : ""}{entry.amount}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[11px] font-bold">{entry.label || entry.kind}</p>
                          <p className="text-[9px] text-dim">{entry.day || relativeTime(entry.created_at)}{entry.other ? ` · ${entry.other.name}` : ""}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {owned.length ? (
                <section>
                  <h2 className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-dim">Owned themes</h2>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {owned.map((key) => (
                      <button key={key} type="button" onClick={() => void setDesign(key)} className="rounded-full border border-line bg-card px-3 py-1.5 text-[10px] font-bold text-dim hover:border-accent/40 hover:text-ink">{key}</button>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>
          )
        ) : tab === "ladder" ? (
          <div className="space-y-2">
            {(catalog?.tiers ?? []).map((tier, index) => {
              const active = current === tier.key;
              return (
                <div key={tier.key} className={cn("flex items-center gap-3 rounded-[16px] border bg-card px-3.5 py-3", active ? "border-accent/50" : "border-line")}>
                  <span className="flex size-9 items-center justify-center rounded-full text-[13px] font-extrabold" style={{ color: tone(tier), backgroundColor: `color-mix(in srgb, ${tone(tier)} 12%, transparent)` }}>{index + 1}</span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-extrabold">{tier.name}</p>
                    <p className="text-[10px] text-dim">{tier.days} · {tier.shields} {tier.shields === 1 ? "shield" : "shields"}</p>
                  </div>
                  {active ? <span className="rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[8px] font-extrabold uppercase tracking-wider text-accent">Now</span> : null}
                </div>
              );
            })}
            <p className="pt-2 text-center text-[10px] leading-4 text-dim">Century is kept for good. The count carries on after {catalog?.century ?? 100}.</p>
          </div>
        ) : medals.isLoading ? <PageSkeleton rows={2} /> : medals.isError ? (
          <div className="card"><ErrorState error={medals.error} onRetry={() => void medals.refetch()} /></div>
        ) : !medals.data?.medals.length ? (
          <EmptyState icon={<Medal className="size-6" />} title="No medals yet" body="A medal is kept when a spark reaches a new award." />
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            {medals.data.medals.map((medal) => (
              <div key={medal.id} className="flex items-center gap-3 rounded-[16px] border border-line bg-card px-3.5 py-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_10%,transparent)] text-accent"><Medal className="size-5" /></span>
                <div className="min-w-0 flex-1">
                  <p className="text-[12px] font-extrabold capitalize">{medal.kind || "Spark medal"}</p>
                  <p className="text-[10px] text-dim">{medal.reached} days{medal.created_at ? ` · ${relativeTime(medal.created_at)}` : ""}</p>
                </div>
                <Link to={medal.thread_id ? `/app/convo/${medal.thread_id}` : "/app/convo"} className="icon-btn" aria-label="Open convo"><ArrowUpRight className="size-4" /></Link>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
