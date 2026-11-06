import { lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { Clock, Eye, EyeOff, Link2Off, Sparkles, X, Zap } from "lucide-react";
import { Modal } from "@/components/overlays/Modal";
import { SettingsSwitch } from "@/features/settings/parts";
import { Spinner } from "@/components/ui/Button";
import { sparksService } from "@/services/sparks.service";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/utils/cn";
import { count } from "@/utils/format";
import { ApiError, errorMessage } from "@/utils/errors";
import {
  AMBER,
  AWARDS,
  awardOf,
  awardDays,
  closingLine,
  figure,
  headAward,
  isCold,
  litKeys,
  nextWords,
  offerEndsWords,
  offerOf,
  sparkLeftWords,
  wornOf,
} from "@/features/sparks/model";
import type { Spark, UserCard } from "@/types/api";

/**
 * The card's own page, fetched when somebody asks for it.
 *
 * The painter is a canvas, a glyph table and a composer — sixteen kilobytes
 * that a chat list has no use for until the one tap that wants them, and the
 * chunk a convo lives in is the one that pays for everything imported here. It
 * arrives on the tap instead, which is the same shape the route table uses for
 * a page nobody has opened yet.
 */
const SparkMoment = lazy(() => import("@/features/sparks/SparkMoment"));

export function SparkSheet({
  open,
  threadId,
  title,
  spark,
  balance,
  face,
  onClose,
  onChanged,
  variant = "modal",
}: {
  open: boolean;
  threadId: string;
  /** Whoever's name is on the row this was opened from. */
  title: string;
  /** The row's own copy, drawn until the fresh read lands. */
  spark: Spark | null;
  /** What the wallet holds, for the price on a broken run. */
  balance?: number;
  /**
   * The person on the other side, as the row behind this sheet knows them.
   *
   * Only the card needs them: a moment about a run is a moment about two
   * people, and the picture draws both faces and can name the one on the other
   * side of it. Absent — a sheet opened with nothing but a title — leaves the
   * card drawing a name and initials instead of a face and no mention switch.
   */
  face?: UserCard | null;
  onClose: () => void;
  /** Asked for after a hide or a restore, so the row behind agrees at once. */
  onChanged?: () => void;
  variant?: "modal" | "panel";
}) {
  const [fresh, setFresh] = useState<Spark | null>(spark);
  const [wallet, setWallet] = useState<number | undefined>(balance);
  const [busy, setBusy] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);
  const [cardOpen, setCardOpen] = useState(false);
  const [, tick] = useState(0);
  const toast = useToast();
  const current = fresh ?? spark;

  useEffect(() => {
    setFresh(spark);
    setWallet(balance);
    setTrouble(null);
  }, [spark, balance]);

  // A closed sheet keeps its state — this component stays mounted and returns
  // nothing — so the card page is put away with it. Without this, reopening the
  // sheet on the same row would draw a composer over a conversation the person
  // had already left.
  useEffect(() => {
    if (!open) setCardOpen(false);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void sparksService
      .one(threadId)
      .then((answer) => {
        // Null is a real answer — a chat with no spark — but drawing it over a
        // run the row just showed would be the sheet emptying itself. It is
        // taken only when there is something to take.
        if (!cancelled && answer) setFresh(answer);
      })
      .catch(() => {
        // The read failed. The row's copy stays up rather than the sheet
        // apologising for a screen it can already draw.
      });
    return () => {
      cancelled = true;
    };
  }, [open, threadId]);

  // A clock that does not move is a clock nobody reads.
  useEffect(() => {
    if (!open) return;
    const timer = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, [open]);

  if (!open || !current) return null;

  const now = Date.now();
  const worn = wornOf(current);
  // The phone's own fallback: a run with nothing worn still shows the rung it
  // sits on, so the line is never an empty gap under the number.
  const awards = worn.length ? worn : [awardOf(current.stage) ?? AWARDS[0]];
  const cold = isCold(current);
  const offer = offerOf(current);

  /** Hide my side of the spark, or show it again. Never theirs. */
  async function hide(off: boolean) {
    const before = current;
    setBusy(true);
    setFresh((prev) => {
      const base = prev ?? spark;
      return base ? { ...base, off } : prev;
    });
    try {
      const answer = await sparksService.setOff(threadId, off);
      if (answer) setFresh(answer);
      onChanged?.();
    } catch {
      setFresh(before);
      toast.toast({ title: "Could not change that just now.", tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  /** Buy the run back, for the two days the offer is open. */
  async function restore() {
    if (busy) return;
    setBusy(true);
    setTrouble(null);
    try {
      const answer = await sparksService.restore(threadId);
      if (answer.spark) setFresh(answer.spark);
      if (answer.wallet) setWallet(answer.wallet.balance);
      if (!answer.spark) setTrouble("Could not restore this Spark just now.");
      else onChanged?.();
    } catch (error) {
      /*
       * The server's own sentence when it *refused* — the contract freezes a 400
       * carrying one for this route, and "Not enough in the wallet." is the whole
       * answer. Anything else is a failure rather than a refusal: the browser
       * lost the network, or the server fell over, and neither of those has a
       * sentence about why.
       */
      const refused =
        error instanceof ApiError && error.status >= 400 && error.status < 500;
      setTrouble(
        refused
          ? errorMessage(error)
          : "Could not restore this Spark just now.",
      );
    } finally {
      setBusy(false);
    }
  }

  const leaves = current.hold_until ? day(current.hold_until) : "";

  const content = (
    <div className="flex flex-col px-4 pb-4 pt-4">
      <div className="relative">
        <div className="flex justify-center">
          <SparkRing spark={current} />
        </div>

        <div className="relative mt-3 flex items-center justify-center gap-5">
          <div className="shrink-0 text-center">
            <Figure spark={current} showCount={Boolean(current.off && !current.broken)} />
          </div>

          <div className="min-w-0 text-center">
            {awards.length ? (
              <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                {awards.map((award) => (
                  <span key={award.key} className="flex items-center gap-1.5">
                    <award.Icon
                      className="size-[19px]"
                      strokeWidth={2.2}
                      style={{
                        color: cold ? fade(award.colour, 0.4) : award.colour,
                      }}
                      aria-hidden
                    />
                    <span
                      className="text-[15px] font-bold"
                      style={{
                        color: cold ? fade(award.colour, 0.4) : award.colour,
                      }}
                    >
                      {award.name}
                    </span>
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-1.5 flex justify-center">
              <StatusPill spark={current} />
            </div>
          </div>
        </div>

        <Clocks spark={current} now={now} />
      </div>
      {current.closing ? (
        <Banner
          icon={<Clock className="size-[17px]" />}
          colour={AMBER}
          text={closingLine(current, now)}
        />
      ) : null}

      {current.broken ? (
        <Banner
          icon={<Link2Off className="size-[17px]" />}
          colour="var(--bad)"
          text="This spark broke. The next day you both send something, it starts again at 1."
          note={leaves ? `It leaves your list on ${leaves}.` : undefined}
        />
      ) : null}

      {current.broken && offer ? (
        <Offer
          spark={current}
          offer={offer}
          balance={wallet}
          busy={busy}
          trouble={trouble}
          onRestore={() => void restore()}
        />
      ) : null}

      {/* What is coming, and the way to keep this run as a picture. One line
          and not two, because they are one thought: the days are going
          somewhere worth showing, and here is how to show them. The pill is
          drawn on every run, including the two the line beside it has nothing
          to say about — a broken spark is still a spark somebody may want a
          picture of, and a door that came and went with the countdown would be
          a door that is only sometimes there. */}
      <div className="mt-3 flex items-center gap-2">
        <p className="min-w-0 flex-1 text-center text-[12.5px] font-semibold leading-5 text-dim">
          {nextWords(current)}
        </p>
        <button
          type="button"
          onClick={() => setCardOpen(true)}
          disabled={busy}
          className="inline-flex min-w-0 shrink items-center gap-1.5 rounded-full px-3 py-1.5 text-[12.5px] font-bold text-accent transition hover:brightness-[1.5] active:scale-[0.98] disabled:opacity-45"
          style={{
            background: "color-mix(in srgb, var(--accent) 12%, transparent)",
          }}
        >
          <Sparkles className="size-[15px] shrink-0" aria-hidden />
          <span className="truncate">Add to Moments</span>
        </button>
      </div>

      <div className="mt-4 border-t border-line/70 pt-4">
        <p className="text-[10.5px] font-extrabold uppercase tracking-[0.08em] text-dim">
          The ladder
        </p>
        <div className="mt-3 flex items-start">
          {AWARDS.map((award) => {
            const lit = litKeys(current).includes(award.key);
            return (
              <div
                key={award.key}
                className="flex min-w-0 flex-1 flex-col items-center"
              >
                <award.Icon
                  className="size-5"
                  strokeWidth={2.2}
                  style={{
                    color: lit ? award.colour : fade("var(--dim)", 0.3),
                  }}
                  aria-hidden
                />
                <span
                  className="mt-1.5 w-full truncate text-center text-[9.5px] font-semibold"
                  style={{
                    color: lit ? "var(--ink)" : fade("var(--dim)", 0.7),
                  }}
                >
                  {award.name}
                </span>
                <span className="w-full truncate text-center text-[8.5px] text-dim">
                  {awardDays(award)}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-4 border-t border-line/70 pt-4">
        <div className="flex items-center gap-3">
          <span className="relative grid size-10 shrink-0 place-items-center rounded-lg bg-[var(--accent-soft)] text-accent">
            <Eye
              className={cn(
                "absolute size-[21px] transition-all duration-300 ease-out",
                current.off
                  ? "rotate-[18deg] scale-75 opacity-0"
                  : "rotate-0 scale-100 opacity-100",
              )}
              aria-hidden
            />
            <EyeOff
              className={cn(
                "absolute size-[21px] transition-all duration-300 ease-out",
                current.off
                  ? "rotate-0 scale-100 opacity-100"
                  : "-rotate-[18deg] scale-75 opacity-0",
              )}
              aria-hidden
            />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[13.5px] font-extrabold">Hide this Spark</p>
            <p className="mt-0.5 text-[11.5px] leading-[1.4] text-dim transition-colors duration-300">
              {current.off
                ? "Hidden for you alone — it keeps counting for both, and nothing breaks"
                : "Counting the days you two talk"}
            </p>
          </div>
          <SettingsSwitch
            on={Boolean(current.off)}
            disabled={busy}
            label="Hide this Spark"
            onChange={() => void hide(!current.off)}
          />
        </div>
      </div>

      <p className="mt-4 text-[11.5px] leading-[1.5] text-dim">
        A day counts when both of you send something — a line, a photo, a voice
        note, a share. Each clock runs from that person&rsquo;s own last
        message: past 24 hours their timer shows, and at 48 hours the run breaks
        to 0. A broken run is kept for two days, and the next day you both send
        something starts it again at 1. The days already earned stay in the
        wallet whatever happens to the run.
      </p>
    </div>
  );

  /*
   * The card, in whichever shape this sheet was drawn in.
   *
   * In the panel it is the next page of that same pillar rather than a modal
   * laid over the conversation; on a phone the sheet is a bottom sheet and the
   * card is still a full page. A share that went up closes this sheet behind
   * it — a person who has just put a moment on a run should not land back on
   * the page about that same run.
   */
  const card = cardOpen ? (
    <Suspense
      fallback={
        variant === "panel" ? (
          <div className="grid h-full place-items-center bg-card">
            <Spinner className="size-6 text-accent" />
          </div>
        ) : (
          <div className="fixed inset-0 z-[60] grid place-items-center bg-[var(--page)]">
            <Spinner className="size-6 text-accent" />
          </div>
        )
      }
    >
      <SparkMoment
        open
        variant={variant}
        spark={current}
        // The painter's second face, with the phone's own fallback for a row
        // that knows nobody better: the row's title. A card is about two people
        // and only one of them is ever missing, and a name is all the picture
        // reads — see `CardFace`.
        them={face ?? (title.trim() ? { name: title } : null)}
        onClose={() => setCardOpen(false)}
        // A card that went up has finished this sheet's business. Leaving it
        // underneath would put the person back on a page about the same run the
        // moment they closed the one they just made.
        onPosted={() => {
          onChanged?.();
          onClose();
        }}
      />
    </Suspense>
  ) : null;

  if (variant === "panel") {
    if (card) return <div className="h-full xelvic-panel-in">{card}</div>;

    return (
      <div className="flex h-full min-h-0 flex-col bg-card">
        <header className="flex shrink-0 items-center gap-3 border-b border-line px-3.5 py-2">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-[var(--accent-soft)] text-accent">
            <Zap className="size-5" />
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[14px] font-extrabold tracking-[-0.02em]">
              {title}
            </h2>
            <p className="truncate text-[10.5px] text-dim">
              {current.note || "Spark"}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-dim transition hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] hover:text-ink active:scale-95"
            aria-label="Close Spark"
          >
            <X className="size-5" />
          </button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto scroll-thin">
          {content}
        </div>
      </div>
    );
  }

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title={title}
        description={current.note || "Spark"}
        size="sm"
      >
        {content}
      </Modal>
      {card}
    </>
  );
}

/** The number, and only here. */
function Figure({ spark, showCount = false }: { spark: Spark; showCount?: boolean }) {
  const counted = showCount && Boolean(spark.count);
  const { big, small } = counted
    ? { big: count(spark.count), small: spark.count === 1 ? "day" : "days" }
    : figure(spark);
  const words = !counted && (!spark.count || spark.off || spark.broken);
  return (
    <>
      <p
        className={cn(
          "font-extrabold",
          words
            ? "text-[20px] leading-tight"
            : "text-[40px] leading-[1.05] tracking-[-1.4px]",
        )}
      >
        {big}
      </p>
      {small ? <p className="text-[12px] text-dim">{small}</p> : null}
    </>
  );
}

function StatusPill({ spark }: { spark: Spark }) {
  const state = spark.broken
    ? { label: "Broken", colour: "var(--bad)" }
    : spark.off
      ? { label: "Hidden", colour: "var(--dim)" }
      : spark.alive
        ? { label: "Alive", colour: "var(--accent)" }
        : { label: "Paused", colour: AMBER };
  return (
    <span
      role="status"
      aria-live="polite"
      className="inline-flex h-[26px] items-center gap-1.5 rounded-full px-2.5 text-[10px] font-extrabold uppercase tracking-[0.09em] transition-colors duration-300"
      style={{
        color: state.colour,
        background: `color-mix(in srgb, ${state.colour} 12%, transparent)`,
      }}
    >
      <span
        className="size-1.5 rounded-full"
        style={{ backgroundColor: state.colour }}
        aria-hidden
      />
      {state.label}
    </span>
  );
}

/**
 * The ring around the head glyph: how far through the current award's stretch
 * the run is.
 *
 * Drawn from the lap's own fraction and not from the whole count, so a 20-day
 * Nova is a nearly-empty ring, which is where it belongs. The fraction is nought
 * on a run that is not going — a broken run is not part-way through anything.
 */
function SparkRing({ spark }: { spark: Spark }) {
  const head = headAward(spark);
  const worn = wornOf(spark);
  const size = 132;
  const stroke = 2.4;
  const radius = size / 2 - stroke / 2 - 1;
  const around = 2 * Math.PI * radius;
  const fraction = spark.alive ? Math.min(1, Math.max(0, spark.pct ?? 0)) : 0;
  const colour = worn.length ? worn[worn.length - 1].colour : "var(--dim)";
  return (
    <div className="relative grid size-[128px] place-items-center">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="absolute inset-0 size-full"
        aria-hidden
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          stroke={fade("var(--dim)", 0.22)}
        />
        {fraction > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeLinecap="round"
            stroke={colour}
            strokeDasharray={around}
            strokeDashoffset={around * (1 - fraction)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
        ) : null}
      </svg>
      <head.Icon
        className="size-[52px]"
        strokeWidth={1.8}
        style={{ color: head.colour }}
      />
    </div>
  );
}

/**
 * Each side's clock, drawn only for a side that owes a message.
 *
 * Mine and theirs are read off their own deadlines and never off one shared
 * clock: each person's 48 hours starts again the moment they speak, so the two
 * run out at different moments and the sheet says each of them separately. A
 * side that has sent is below the 24-hour mark and has nothing to show.
 */
function Clocks({ spark, now }: { spark: Spark; now: number }) {
  const asked: { label: string; mine: boolean }[] = [];
  if (spark.timer_mine) asked.push({ label: "Your clock", mine: true });
  if (spark.timer_theirs) asked.push({ label: "Their clock", mine: false });
  const shown = asked
    .map((line) => ({ ...line, left: sparkLeftWords(spark, line.mine, now) }))
    .filter((line) => line.left);
  if (!shown.length) return null;
  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      {shown.map((line) => (
        <p
          key={line.label}
          className="text-[12px] font-semibold"
          style={{ color: AMBER }}
        >
          {`${line.label} — ${line.left}`}
        </p>
      ))}
    </div>
  );
}

/** The plate the three warnings share: the closing one, the broken one, hidden. */
function Banner({
  icon,
  colour,
  text,
  note,
}: {
  icon: ReactNode;
  colour: string;
  text: string;
  note?: string;
}) {
  return (
    <div
      className="mt-3 flex items-start gap-2.5 rounded-[12px] border p-3"
      style={{
        background: `color-mix(in srgb, ${colour} 14%, transparent)`,
        borderColor: `color-mix(in srgb, ${colour} 40%, transparent)`,
      }}
    >
      <span className="mt-px shrink-0" style={{ color: colour }} aria-hidden>
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] leading-[1.45]">{text}</p>
        {note ? (
          <p className="mt-1 text-[11.5px] leading-[1.4] text-dim">{note}</p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Buying the run back, out of the wallet, while the offer is open.
 *
 * The price is never `k`-formatted: this client writes it out in full wherever a
 * price is shown, and the day count coming back is a day count, so it goes
 * through the ordinary shortening like every other count.
 */
function Offer({
  spark,
  offer,
  balance,
  busy,
  trouble,
  onRestore,
}: {
  spark: Spark;
  offer: { price: number; count: number };
  balance?: number;
  busy: boolean;
  trouble: string | null;
  onRestore: () => void;
}) {
  const held = balance ?? 0;
  const short = offer.price - held;
  const ends = offerEndsWords(spark, Date.now());
  return (
    <div
      className="mt-2.5 flex flex-col rounded-[12px] border p-3"
      style={{
        background: "color-mix(in srgb, var(--accent) 12%, transparent)",
        borderColor: "color-mix(in srgb, var(--accent) 35%, transparent)",
      }}
    >
      <div className="flex items-center gap-2">
        <Zap className="size-[18px] shrink-0 text-accent" aria-hidden />
        <p className="text-[13.5px] font-bold">
          {`Get back ${count(offer.count)} ${offer.count === 1 ? "day" : "days"}`}
        </p>
      </div>
      <p className="mt-1 text-[12.5px] text-dim">
        {`${count(offer.price)} sparks · you have ${count(held)}`}
      </p>
      {ends ? <p className="mt-0.5 text-[11.5px] text-dim">{ends}</p> : null}
      {trouble ? (
        <p className="mt-2 text-[12px] text-[var(--bad)]">{trouble}</p>
      ) : null}
      <button
        type="button"
        onClick={onRestore}
        disabled={busy || short > 0}
        className="btn btn-primary mt-3 w-full"
      >
        {busy ? (
          <Spinner className="size-[18px]" />
        ) : short > 0 ? (
          `Need ${count(short)} more`
        ) : (
          `Restore for ${count(offer.price)}`
        )}
      </button>
    </div>
  );
}

/** A day, as the broken banner writes it out. */
function day(iso: string) {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "";
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${at.getFullYear()}-${pad(at.getMonth() + 1)}-${pad(at.getDate())}`;
}

/**
 * A colour at a fraction of its own strength — the phone's `X.fade`.
 *
 * The awards are all hex, so a mix with `transparent` is the same colour with
 * the alpha the phone set. Tokens come through it too, which is what the ladder's
 * unlit rungs and the ring's faint track are drawn in.
 */
function fade(colour: string, amount: number): string {
  return `color-mix(in srgb, ${colour} ${Math.round(amount * 100)}%, transparent)`;
}

export default SparkSheet;
