import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { linkIcon, tradeIcon, tradeWord } from "./model";

/**
 * The two marks a professional profile is made of, drawn once.
 *
 * Ported from the `ProfessionalLead` and `ProfessionalPill` widgets at the foot
 * of `app/lib/professional.dart`. They live in the shared file for the reason
 * the app gives: the edit form's preview draws exactly these, from exactly these
 * values, "and a preview built out of different code from the thing it previews
 * is a picture of a promise". The profile page reads the same two components in
 * the next pass.
 */

/**
 * The trade, standing on its own line above the name: a mark and the word.
 *
 * It used to be a capsule under the numbers, which read as a notice about the
 * account rather than as part of who it is. The owner asked on 2026-10-24 for
 * the trade to come before the name — *"developer jo jis type ki profile hai
 * jise developer ya jo bhi profession ho naam se pahle likh kar aaye"* — and
 * then, reading it as `Developer · Aarav`, for it to move above the name
 * instead: *"profile me profession naam ke upar de do — naam ke left me acha
 * nahi lag raha"*. So the head is one stack — the trade, the name under it, then
 * the handle.
 *
 * Nothing is drawn for an empty trade — an account that has not said what it
 * does has not said it.
 */
export function ProfessionalLead({
  trade,
  t,
  className,
}: {
  trade: string | null | undefined;
  t: (key: string) => string;
  className?: string;
}) {
  const word = tradeWord(trade, t);
  if (!word) return null;
  const Icon = tradeIcon(trade);
  return (
    <span className={cn("flex min-w-0 items-center justify-center", className)}>
      <Icon className="size-[15px] shrink-0 text-accent" aria-hidden />
      <span className="ml-1.5 min-w-0 truncate text-[14.5px] font-bold text-accent">{word}</span>
    </span>
  );
}

/**
 * A pill for one link or the public email: a hairline capsule with a mark and a
 * word, the same quiet shape the rest of a profile wears.
 *
 * **A link on a profile is the mark alone** — `bare` — and that is a decision
 * rather than a width. The user asked for it on 2026-10-11: *"professional user
 * ka link ka jo option hai profile pe sirf icon dikhe na ki pura naam, jaise ki
 * instagram sirf icon dikhe"*. A row of typed labels is a row of the account's
 * own words in the middle of somebody else's page; a row of marks is a row of
 * places, which is what the row is for. The word is not thrown away — it is the
 * tooltip and the screen reader's name for the button, so it is still read
 * before the tap rather than written across it.
 *
 * The email and the place are the same marks as a link now. The owner asked on
 * 2026-10-24 for both to sit in the icon row rather than on lines of their own —
 * *"email or address neeche jo icons aate hai usme daal do"* — so the words that
 * used to be written are their tooltip and their accessible name, exactly as a
 * link's word already was.
 *
 * A missing `onClick` draws the pill dead rather than clickable: it is a picture
 * of the buttons, and a button that opens somebody's booking page from inside a
 * settings screen without having been saved yet is the one thing it must not be.
 */
export function ProfessionalPill({
  icon,
  label,
  onClick,
  bare,
}: {
  icon: ReactNode;
  /** The word the pill would draw, and the name it answers to either way. */
  label: string;
  onClick?: (() => void) | null;
  bare?: boolean;
}) {
  const body = bare ? (
    <span className="flex size-[18px] items-center justify-center p-[9px]">{icon}</span>
  ) : (
    <span className="flex min-w-0 items-center gap-1.5 px-3 py-[7px]">
      {icon}
      <span className="max-w-[180px] truncate text-[12.5px] font-semibold">{label}</span>
    </span>
  );

  const pill = (
    <span
      className={cn(
        "inline-flex shrink-0 items-center overflow-hidden rounded-full border border-line bg-card",
        onClick && "transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]",
      )}
    >
      {body}
    </span>
  );

  if (!bare) {
    if (!onClick) return pill;
    return (
      <button type="button" onClick={onClick} className="shrink-0">
        {pill}
      </button>
    );
  }

  // A mark with no word on it has to say what it is some other way: the title
  // carries it on a hover, the accessible name on a screen reader, and the press
  // itself opens the card that names the address before it goes.
  if (!onClick) {
    return (
      <span title={label} aria-label={label} className="shrink-0">
        {pill}
      </span>
    );
  }
  return (
    <button type="button" onClick={onClick} title={label} aria-label={label} className="shrink-0">
      {pill}
    </button>
  );
}

/** The mark a pill wears for a link, read off its label and its address. */
export function linkPillIcon(label: string | null | undefined, url: string | null | undefined) {
  const Icon = linkIcon({ label, url });
  return <Icon className="size-4 text-accent" aria-hidden />;
}
