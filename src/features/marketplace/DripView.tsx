// Drip — the shelf where a person chooses the figure their convos see.
//
// Ported from `screens/drip.dart`. Two screens live here and they are the same
// decision at two sizes: the shelf, which is a wall of faces to walk along, and
// one figure's own page, which is where it is looked at properly and then kept
// or put on. Everything about what a figure *is* — its price, whether it has
// been kept, whether it is the one on — belongs to the server and is read
// through `/drip/`; this file decides only how it is drawn.
//
// **A figure is pictures and nothing else.** There is nothing to dress it in, no
// parts to choose and no layers to stack: the shop sells the whole thing, as the
// moments it is ever seen in — waiting, typing, and the `bio` pose a profile
// stands in. That is why the figure's page has one control on it and it is not a
// wardrobe: it is a switch between those pictures.
//
// Nothing here is priced by the browser and nothing here decides what may be
// worn. A tap sends a key, the server answers, and the shelf is redrawn from
// that answer — which is also why this file is so thin: nearly every rule in
// this feature is a rule about money, and money is the server's.

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowLeft, CheckCircle2, CloudOff } from "lucide-react";
import { cn } from "@/lib/cn";
import { Spinner } from "@/components/Button";
import { useToast } from "@/providers/ToastProvider";
import {
  BUNDLED_POSES,
  FIGURE_POSES,
  figureArt,
  type FigurePose,
} from "./model";
import { Pose } from "./marks";
import { PriceChip, SparkPurse } from "./parts";
import { useDripShelf, useMarket, useMarketWallet } from "./queries";
import type { DripCharacter } from "./types";

/** One form of a count, in the form the words ask for. See `drip.dart`'s `_count`. */
function countdown(one: string, many: string, n: number): string {
  return n === 1 ? one : many.replace("{n}", String(n));
}

/**
 * How long this figure is still here, said the way a person says it — "2 days
 * left", "1 hr left" — or null when it is not on a clock.
 *
 * The one place the web turns two dates into the sentence that goes on a tile,
 * and it is here because two readers want the same answer: the tile that draws
 * it, and the ticker that decides whether anything on the shelf still needs
 * redrawing. A second copy of these rules would be a second chance to disagree
 * about when a figure ends.
 *
 * Everything rounds **down**, and that is not tidiness: a countdown is read as a
 * promise about how long is left, and "2 days left" with two days and one second
 * on the clock is a promise the shop keeps while "1 day left" with one day and
 * twenty-three hours is not. Rounding up would make every label a small lie at
 * the top of its own range.
 *
 * Null is the answer in three cases, and all three are the tile saying nothing
 * rather than saying "over": a figure with no end, one whose window has not
 * opened yet, and one whose window has closed. A tile that read "ended" would be
 * the shop pointing at something it is no longer offering.
 */
export function timeLeft(row: DripCharacter, now: number): string | null {
  if (!row.ends_at) return null;
  const ends = Date.parse(row.ends_at);
  if (!Number.isFinite(ends)) return null;
  if (row.starts_at) {
    const starts = Date.parse(row.starts_at);
    if (Number.isFinite(starts) && now < starts) return null;
  }
  if (now >= ends) return null;
  const left = ends - now;
  const minute = 60_000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (left >= 2 * day) return countdown("1 day left", "{n} days left", Math.floor(left / day));
  if (left >= day) return "1 day left";
  if (left >= hour) return countdown("1 hr left", "{n} hr left", Math.floor(left / hour));
  if (left >= minute) return countdown("1 min left", "{n} min left", Math.floor(left / minute));
  return "ending";
}

/**
 * The clock the shelf reads, ticking only while something on it is on a clock.
 *
 * A page of figures that are here for good has no sentence on it that changes by
 * itself, and a timer left running for nobody is a wake-up every minute on a
 * machine that has better things to do. A minute is the shortest unit the labels
 * have, so a minute is what it ticks at: "1 hr left" becoming "59 min left" is
 * the whole of its job.
 */
function useShelfClock(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, [active]);
  return now;
}

/** How long is left, as a small pill over a figure's picture. See `_TimeChip`. */
function TimeChip({ label }: { label: string }) {
  return (
    <span className="rounded-[9px] bg-accent px-[7px] py-[3.5px] text-[10.5px] font-extrabold text-[var(--on-accent)]">
      {label}
    </span>
  );
}

/** A section's label and the one line that goes with it. See `_Head`. */
function Head({ title, line }: { title: string; line: string }) {
  return (
    <div>
      <h2 className="text-[15px] font-extrabold text-ink">{title}</h2>
      <p className="mt-0.5 text-[11.5px] leading-[1.4] text-dim">{line}</p>
    </div>
  );
}

/** What the server said, said plainly. See `sheetTroubleText` and `_trouble`. */
function Trouble({ children }: { children: string }) {
  return (
    <p className="flex items-start gap-[7px] text-[12.5px] leading-[1.4] text-ink">
      <AlertTriangle className="mt-px size-[15px] shrink-0 text-[var(--bad)]" aria-hidden />
      <span>{children}</span>
    </p>
  );
}

/** One error's own words — the server's when it gave any. */
function troubleText(error: unknown): string {
  return error instanceof Error ? error.message : "That did not go through. Try again.";
}

// ---------------------------------------------------------------------------
// The shelf
// ---------------------------------------------------------------------------

/**
 * The Drip aisle of the marketplace: every figure, what it costs, and which one
 * is on.
 *
 * A **body** and not a page: the marketplace owns the title, the way out and the
 * strip above it, and this is what is under them. That is the whole of the merge
 * the app made — two headers, two titles and two ways back is what made the two
 * aisles read as two apps instead of two shelves.
 */
export function DripView() {
  const shelf = useDripShelf();
  const [openFigure, setOpenFigure] = useState<string | null>(null);
  const rows = shelf.data?.characters ?? [];
  const now = useShelfClock(rows.some((row) => timeLeft(row, Date.now()) !== null));
  const row = openFigure ? (rows.find((figure) => figure.key === openFigure) ?? null) : null;

  if (row) {
    // The figure's own page, opened over the shelf and left by going back —
    // which is what the app's push does. It re-reads the row off the shelf every
    // render, because keeping and wearing both change it.
    return <FigurePage row={row} onClose={() => setOpenFigure(null)} />;
  }

  if (rows.length === 0 && shelf.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Spinner className="size-[22px] text-accent" />
      </div>
    );
  }

  if (rows.length === 0) {
    const loading = shelf.isLoading;
    return (
      <div className="mx-auto max-w-[320px] py-14 text-center">
        <CloudOff className="mx-auto size-[34px] text-[color-mix(in_srgb,var(--ink)_35%,transparent)]" aria-hidden />
        <p className="mt-3 text-[14.5px] font-bold text-ink">
          {loading ? "Loading the shelf..." : "The shelf did not load."}
        </p>
        <p className="mt-1.5 text-[12.5px] leading-[1.4] text-dim">
          {shelf.isError && !loading ? "Check your connection and try again." : "One moment."}
        </p>
        <button
          type="button"
          onClick={() => void shelf.refetch()}
          disabled={loading}
          className="mt-3.5 min-h-9 rounded-full px-3 text-[14px] font-bold text-accent disabled:opacity-40"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <OnNow row={rows.find((figure) => figure.worn) ?? null} chosen={(shelf.data?.worn ?? "") !== ""} onLook={setOpenFigure} />

      <Head title="The shelf" line="Every figure is two pictures — one waiting, one typing." />

      <div className="grid grid-cols-2 gap-3">
        {rows.map((figure) => (
          <FigureCard
            key={figure.key}
            row={figure}
            now={now}
            onTap={() => setOpenFigure(figure.key)}
          />
        ))}
      </div>

      <ProfileSwitch show={shelf.data?.show_character ?? true} />

      <p className="px-0.5 text-[11.5px] leading-[1.5] text-dim">
        This is the figure people see when they open your convo. It is yours, on this account —
        nobody else chooses it for you.
      </p>
    </div>
  );
}

/**
 * The figure on right now, at the size that makes it worth being a choice.
 *
 * It is drawn first and larger than anything on the shelf below, because the one
 * question this page answers before any other is "what am I wearing?" — and a
 * shop where that had to be worked out from a ring on a small tile would be a
 * shop that made its own answer the hard part.
 *
 * It has two states and says which one it is in, because an account that has
 * chosen nothing is not wearing the tile below it: it is wearing whatever it was
 * wearing before this shop existed, which for a person on a character theme is
 * that theme's figure. Claiming "on right now" there would be the page telling
 * somebody their convo looks like something it does not.
 */
function OnNow({
  row,
  chosen,
  onLook,
}: {
  row: DripCharacter | null;
  chosen: boolean;
  onLook: (key: string) => void;
}) {
  const name = row?.name ?? "Classic";
  const line = chosen
    ? row && row.tagline
      ? row.tagline
      : "The figure the app has always had."
    : "The figure the app has always had. Until you pick one here, your convo shows this one.";
  return (
    <div className="overflow-hidden rounded-[22px] border border-line bg-card">
      <div
        className="flex h-[176px] items-center justify-center"
        style={{ background: "rgb(var(--accent-rgb) / 0.07)" }}
      >
        <div className="h-[152px] w-[116px]">
          <Pose src={chosen && row ? figureArt(row, "wait") : BUNDLED_POSES.wait} fill />
        </div>
      </div>
      <div className="flex items-center gap-2.5 px-4 py-[13px]">
        <div className="min-w-0 flex-1">
          <p className="text-[10.5px] font-extrabold uppercase tracking-[0.7px] text-[color-mix(in_srgb,var(--ink)_45%,transparent)]">
            {chosen ? "ON RIGHT NOW" : "THE DEFAULT"}
          </p>
          <p className="mt-[3px] truncate text-[16px] font-extrabold text-ink">{name}</p>
          <p className="mt-0.5 line-clamp-3 text-[12px] leading-[1.35] text-dim">{line}</p>
        </div>
        {row ? (
          <button
            type="button"
            onClick={() => onLook(row.key)}
            className="min-h-9 shrink-0 rounded-full px-3 text-[14px] font-bold text-accent"
          >
            Look
          </button>
        ) : null}
      </div>
    </div>
  );
}

/**
 * One figure on the shelf: its picture, its name, and what stands between me and
 * wearing it.
 *
 * Two to a row rather than three, which is what the theme shelf uses, because
 * the thing being looked at here is a whole figure and a third of the width is
 * not enough of it to tell one from another.
 */
function FigureCard({ row, now, onTap }: { row: DripCharacter; now: number; onTap: () => void }) {
  const left = timeLeft(row, now);
  const wearing = row.worn;
  return (
    <button
      type="button"
      onClick={onTap}
      aria-label={wearing ? `${row.name}, wearing` : row.name}
      aria-pressed={wearing}
      className={cn(
        "overflow-hidden rounded-[18px] bg-card text-left transition",
        wearing ? "border-[2.5px] border-accent" : "border border-line",
      )}
    >
      <div className="relative aspect-square">
        <div className="absolute inset-0 p-3" style={{ background: "rgb(var(--accent-rgb) / 0.05)" }}>
          <Pose src={figureArt(row, "wait")} fill />
        </div>
        {left ? (
          <span className="absolute right-2 top-2">
            <TimeChip label={left} />
          </span>
        ) : null}
      </div>
      <div className="px-2.5 pb-2.5 pt-2">
        <p className="truncate text-[13px] font-extrabold text-ink">{row.name}</p>
        <span className="mt-1.5 inline-block">
          <PriceChip figure={row} />
        </span>
      </div>
    </button>
  );
}

/**
 * Whether a figure stands on my profile while my bio is said.
 *
 * The one control on this shelf that is not about *which* figure: a character on
 * a profile is a figure introducing somebody, and going without one is a real
 * choice. It is about the profile and not the convo — what stands in a chat
 * while I write is my face to another person.
 *
 * The server holds it, and not this browser, because the person the setting is
 * about is not the one holding the device: a figure switched off here has to be
 * off on everybody else's screen too, and only the server reaches those.
 */
function ProfileSwitch({ show }: { show: boolean }) {
  const market = useMarket();
  const [busy, setBusy] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);
  // The switch follows the server's answer and not the tap: a row that flipped
  // under a thumb and then flipped back would be a setting that lied for as long
  // as the request took.
  const on = show;

  async function flip(next: boolean) {
    if (busy) return;
    setBusy(true);
    setTrouble(null);
    try {
      await market.showFigure(next);
    } catch (error) {
      setTrouble(troubleText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-[18px] border border-line bg-card px-4 py-[13px]">
      <div className="flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[14px] font-extrabold text-ink">On your profile</p>
          <p className="mt-[3px] text-[12px] leading-[1.35] text-dim">
            {on ? "Your figure stands beside your bio while it is said." : "Your bio is said with no figure beside it."}
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label="A figure on your profile"
          disabled={busy}
          onClick={() => void flip(!on)}
          className={cn(
            "relative h-[26px] w-[46px] shrink-0 rounded-full border transition disabled:opacity-50",
            on ? "border-accent bg-accent" : "border-line bg-[rgb(var(--ink-rgb)/0.1)]",
          )}
        >
          <span
            className={cn(
              "absolute top-[3px] size-[18px] rounded-full bg-white transition-[left]",
              on ? "left-[24px]" : "left-[3px]",
            )}
          />
        </button>
      </div>
      {trouble ? (
        <div className="mt-2">
          <Trouble>{trouble}</Trouble>
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// One figure
// ---------------------------------------------------------------------------

/**
 * A figure's own page: what it looks like in each moment, and the one decision —
 * keep it, wear it, or take it off.
 *
 * Opened over the shelf rather than beside it, because it is about one figure
 * and it is left by going back.
 */
function FigurePage({ row, onClose }: { row: DripCharacter; onClose: () => void }) {
  // Waiting first, because that is the one somebody else sees most of the time
  // and so the one that has to be liked.
  const [moment, setMoment] = useState<FigurePose>("wait");
  const [busy, setBusy] = useState(false);
  const [trouble, setTrouble] = useState<string | null>(null);
  const market = useMarket();
  const wallet = useMarketWallet();
  const { toast } = useToast();

  const worn = row.worn;
  const kept = row.owned;
  // Only a figure that has a bio sheet draws three sides: a side that showed the
  // waiting picture under the name of a different pose would be the shop
  // describing art it does not have.
  const moments = FIGURE_POSES.filter((pose) => pose !== "bio" || figureArt(row, "bio") !== null);

  async function wear() {
    if (busy) return;
    setBusy(true);
    setTrouble(null);
    try {
      // Buy first when there is nothing kept, then wear — in that order, because
      // the purchase is what earns the wearing. Neither step is optimistic: the
      // shelf is redrawn from the server's own answer.
      if (!kept) await market.buyFigure(row.key);
      await market.wearFigure(row.key);
      toast({ title: `${row.name} is on.`, tone: "success" });
    } catch (error) {
      setTrouble(troubleText(error));
    } finally {
      setBusy(false);
    }
  }

  /**
   * Take the figure off and go back to what this account had before it opened
   * this shop.
   *
   * An empty key and not the classic one: "take it off" means *nothing chosen*,
   * which a convo draws as the theme's character — or as the app's own, for a
   * theme that carries none. Sending `classic` here would be putting the app's
   * figure on somebody who asked for their own back.
   */
  async function takeOff() {
    if (busy) return;
    setBusy(true);
    setTrouble(null);
    try {
      await market.wearFigure("");
      toast({ title: "Taken off.", tone: "success" });
    } catch (error) {
      setTrouble(troubleText(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-page text-ink">
      <header className="flex h-[56px] shrink-0 items-center gap-2 px-2">
        <button type="button" onClick={onClose} className="icon-btn" aria-label="Back">
          <ArrowLeft className="size-6" aria-hidden />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-[17px] font-extrabold">{row.name}</h2>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto pb-4">
        <div className="px-4 pt-3.5">
          <div
            className="flex h-[288px] items-center justify-center rounded-[22px] border border-line"
            style={{ background: "rgb(var(--accent-rgb) / 0.07)" }}
          >
            <div className="h-[260px] w-[200px]">
              <Pose src={figureArt(row, moment)} fill />
            </div>
          </div>
        </div>

        {moments.length > 1 ? (
          <div className="px-4 pt-3.5">
            <div className="flex gap-0 rounded-[13px] p-[3px]" style={{ background: "rgb(var(--ink-rgb) / 0.05)" }}>
              {moments.map((pose) => {
                const on = moment === pose;
                return (
                  <button
                    key={pose}
                    type="button"
                    onClick={() => setMoment(pose)}
                    aria-pressed={on}
                    className={cn(
                      "h-[38px] flex-1 rounded-[10px] text-[13px] transition",
                      on ? "bg-card font-bold text-ink shadow-sm" : "font-semibold text-dim",
                    )}
                  >
                    {pose === "wait" ? "Waiting" : pose === "typing" ? "Typing" : "Bio"}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        <div className="px-5 pt-4">
          <h3 className="text-[20px] font-extrabold tracking-[-0.3px]">{row.name}</h3>
          {row.tagline ? <p className="mt-1 text-[13px] leading-[1.4] text-dim">{row.tagline}</p> : null}
          <div className="mt-3.5 flex items-center justify-between gap-3">
            <PriceChip figure={row} />
            <SparkPurse balance={wallet.data?.balance ?? 0} loaded={Boolean(wallet.data)} />
          </div>
          <p className="mt-3.5 text-[12px] leading-[1.5] text-dim">
            This is what stands in your convos — waiting while somebody sits on one of your places,
            and typing while you write to them.
          </p>
        </div>
      </div>

      <div className="shrink-0 border-t border-line bg-page px-4 py-3">
        {trouble ? (
          <div className="mb-2.5">
            <Trouble>{trouble}</Trouble>
          </div>
        ) : null}
        {worn ? (
          <div className="flex items-center gap-2">
            <CheckCircle2 className="size-[18px] shrink-0 text-accent" aria-hidden />
            <p className="min-w-0 flex-1 text-[13.5px] font-semibold">This is the one you are wearing.</p>
            <button
              type="button"
              onClick={() => void takeOff()}
              disabled={busy}
              className="min-h-9 shrink-0 rounded-full px-3 text-[14px] font-bold text-dim disabled:opacity-40"
            >
              Take it off
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => void wear()}
            disabled={busy}
            className="min-h-[48px] w-full rounded-[13px] bg-accent text-[15px] font-bold text-[var(--on-accent)] transition disabled:opacity-60"
          >
            {/* What the button says is what the tap will do, in the order the
                tap does it: a figure that costs nothing is worn straight away,
                a paid one already kept is only worn, and a paid one not yet
                kept leads with the price because that tap spends. */}
            {busy
              ? "One moment..."
              : row.price === 0
                ? "Wear it — free"
                : kept
                  ? "Wear it"
                  : `Keep it · ${row.price} sparks`}
          </button>
        )}
      </div>
    </div>
  );
}
