import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, Users } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { AuthedImage } from "@/components/Media";
import { Modal } from "@/components/Modal";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { count } from "@/lib/format";
import { usePreferences } from "@/providers/PreferencesProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { toneNamed } from "@/theme/shelf";
import type { UserCard } from "@/types/api";

/**
 * The pieces both profiles are made of.
 *
 * `profile.dart` and `person.dart` draw one person twice — my own page and
 * somebody else's — and the two screens share a head, a row of numbers, a
 * floating disc and a column of sheet rows. The app keeps a private copy of each
 * of these in each file; the web keeps one of each here, because the two copies
 * in the app have already drifted once (the trade moved above the name on one
 * page and not the other) and the fix was to make the two pages say the same
 * thing in the same words for the same person.
 *
 * Nothing here asks the server a question of its own except the mutuals list,
 * which is a door rather than a drawing: a strip whose count comes off the
 * profile payload and whose faces come off `/mutuals/` only when it is opened.
 */

/** One of a profile's numbers, and — where there is something behind it — the way in. */
export function Stat({
  label,
  value,
  onTap,
  faded,
}: {
  label: string;
  value?: number | null;
  onTap?: () => void;
  /**
   * How a number the account has switched off is still shown to the account
   * itself: the same figure in the dim colour the labels wear. It is not a dash
   * — the number is real, I am the one who may always read it — and it is not
   * the bright text either, which would be this page quietly disagreeing with
   * the switch two taps away.
   */
  faded?: boolean;
}) {
  const body = (
    <span className="flex flex-col items-center px-1 py-1.5">
      <span
        className={cn(
          "text-[17px] font-extrabold tracking-[-0.3px] tabular-nums",
          faded && "text-dim",
        )}
      >
        {/* A count that is not mine to read is a dash rather than a nought: a
            nought would be claiming to have counted. */}
        {typeof value === "number" ? count(value) : "—"}
      </span>
      <span className="mt-0.5 text-[11.5px] font-semibold text-dim">{label}</span>
    </span>
  );
  if (!onTap) return body;
  return (
    <button type="button" onClick={onTap} className="rounded-[12px] transition active:scale-[.97]">
      {body}
    </button>
  );
}

/**
 * The three flat colours the ask travels between, and their readings.
 *
 * Pink first, because it is the app's own colour and the one this disc's
 * hairline already wore, then violet and teal — three of `XTones`' eight, named
 * rather than invented. They are chosen for the *path* between them: on the
 * wheel pink, violet and teal are neighbours, so the journey never crosses the
 * dead grey between two opposite hues, and because it returns the way it came
 * the disc only ever moves between colours that are next to each other.
 *
 * The reading is the same pair `XThemes.darkOf` swaps: `tone.on` on a light page
 * and `tone.pill` on a dark one, because a colour dark enough to read on white
 * is a smudge laid on a dark card.
 */
const ASK_TONES = ["Pink", "Violet", "Teal"];

function askStops(dark: boolean): [string, string, string] {
  const picked = ASK_TONES.map((name) => {
    const tone = toneNamed(name);
    if (!tone) return null;
    return dark ? tone.pill : tone.on;
  }).filter((hex): hex is string => Boolean(hex));
  // A build whose palette has lost one of the three still travels: the stops it
  // does have stand in for the missing one rather than the disc going blank.
  const first = picked[0] ?? "#E31B66";
  return [first, picked[1] ?? first, picked[2] ?? first];
}

/**
 * A button that floats on the page: a disc with a hairline, so it reads over
 * whatever is behind it.
 *
 * [pulse] is the owner's ask of 2026-10-28: on a page where nothing has been
 * added yet, the control that adds them should breathe so it is the thing the
 * eye lands on; once they are added, the way into the convo takes the breath
 * instead — a loop, not a single blink, corrected by the owner the next day, and
 * with the colour travelling alongside the size.
 *
 * Three things it must not do, and does not: **move the row** (the scale is a
 * paint-time transform, so the other discs keep their places), **draw a
 * gradient** (the disc is washed with one flat hue at a time), and **ignore the
 * phone's setting** (the global `prefers-reduced-motion` rule stops both
 * animations dead, and the disc then wears the first stop — a still frame rather
 * than a blank one).
 *
 * A dimmed control does not beat: [onTap] is null while a write is in the air,
 * and an action that breathes while it cannot be pressed is an action somebody
 * presses again.
 */
export function Floating({
  icon,
  label,
  onTap,
  pulse = false,
}: {
  icon: ReactNode;
  label: string;
  /** Null while a request from this page is in the air. Drawn dim, not removed. */
  onTap?: (() => void) | null;
  /** Whether this is the one control the page is asking somebody to press. */
  pulse?: boolean;
}) {
  const { palette } = useTheme();
  const live = Boolean(onTap);
  const asking = pulse && live;
  const [a, b, c] = askStops(palette.isDark);

  const style = asking
    ? ({
        animation: "xelvic-ask-breath 2s ease-in-out infinite, xelvic-ask-ring 6s ease-in-out infinite",
        "--ask-a": a,
        "--ask-b": b,
        "--ask-c": c,
      } as CSSProperties)
    : undefined;

  return (
    <button
      type="button"
      disabled={!live}
      onClick={onTap ?? undefined}
      title={label}
      aria-label={label}
      style={style}
      className={cn(
        "relative flex size-[38px] items-center justify-center rounded-full border backdrop-blur-sm transition active:scale-[.95]",
        asking
          ? "bg-card"
          : "border-[color-mix(in_srgb,var(--ink)_8%,transparent)] bg-[color-mix(in_srgb,var(--card)_92%,transparent)]",
        !live && "opacity-45",
      )}
    >
      {/* The wash, and the second half of the breath. Two animations on one
          element because they touch two different properties: the hue travels
          over six seconds while the wash deepens and lightens over two. */}
      {asking ? (
        <span
          aria-hidden
          className="absolute inset-0 rounded-full"
          style={{
            animation:
              "xelvic-ask-hue 6s ease-in-out infinite, xelvic-ask-wash 2s ease-in-out infinite",
          }}
        />
      ) : null}
      <span className="relative">{icon}</span>
    </button>
  );
}

/** One row of a profile's ⋮ sheet: a mark, a word and what it is for. */
export function SheetRow({
  icon,
  label,
  line,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  line?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
    >
      <span className="text-dim">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-semibold">{label}</span>
        {line ? <span className="mt-0.5 block text-[12px] text-dim">{line}</span> : null}
      </span>
    </button>
  );
}

/** How long a press has to be held before it counts as a hold rather than a tap. */
const HOLD_MS = 480;

/**
 * The face at the head of a profile — which is also its biggest button.
 *
 * The app draws this in two places with two behaviours: `profile.dart` shows my
 * own photo large when it is tapped, and `person.dart` gives somebody else's
 * face a *long press* for the same thing while a tap is spent on their day when
 * they have one live. The ring is the app's `Ring`: a flat 2.5px accent
 * hairline with the same gap again between it and the picture, and the quiet
 * version of it — the text colour at 16% — once their day has been watched, so
 * that a bright ring keeps meaning "something of theirs I have not seen".
 *
 * A hold is 480ms, a little under half a second, because the web's press is a
 * mouse click or a thumb and the app's own is Flutter's 500ms: anything longer
 * reads as a press that did not register, and anything shorter fires while a
 * thumb is still on its way to a scroll. The click that follows a hold is
 * swallowed, so holding never also opens the day behind the photo.
 *
 * [tone] is the ring: `accent` for a day I have not watched, `faded` for one I
 * have, and `page` for a face with nothing live behind it — the page-coloured
 * ring the profile already wore to stand off the cover.
 */
export function FaceButton({
  user,
  size,
  tone,
  label,
  title,
  onTap,
  onHold,
}: {
  user?: Pick<UserCard, "name" | "username" | "avatar"> | null;
  size: number;
  tone: "accent" | "faded" | "page";
  label: string;
  /** The line a mouse reads on hover — on the web it is the only way to learn
   *  that the face answers a hold. */
  title?: string;
  onTap: () => void;
  onHold?: () => void;
}) {
  const timer = useRef<number | null>(null);
  const held = useRef(false);

  const stop = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  useEffect(() => stop, []);

  return (
    <button
      type="button"
      aria-label={label}
      title={title}
      className={cn(
        "block shrink-0 touch-manipulation select-none rounded-full transition active:scale-[.98]",
        tone === "accent" && "border-[2.5px] border-accent p-[2.5px]",
        tone === "faded" &&
          "border-[2.5px] border-[color-mix(in_srgb,var(--ink)_16%,transparent)] p-[2.5px]",
        tone === "page" &&
          "border-4 border-[var(--page)] shadow-[0_8px_22px_color-mix(in_srgb,#13131A_18%,transparent)]",
      )}
      onContextMenu={onHold ? (event) => event.preventDefault() : undefined}
      onPointerDown={
        onHold
          ? () => {
              held.current = false;
              stop();
              timer.current = window.setTimeout(() => {
                held.current = true;
                onHold();
              }, HOLD_MS);
            }
          : undefined
      }
      onPointerUp={onHold ? stop : undefined}
      onPointerLeave={onHold ? stop : undefined}
      onPointerCancel={onHold ? stop : undefined}
      onClick={() => {
        // The press that became a hold has already done its work; this click is
        // the browser finishing the same gesture, not a second one.
        if (held.current) {
          held.current = false;
          return;
        }
        onTap();
      }}
    >
      <Avatar user={user} size={size} />
    </button>
  );
}

/**
 * The face as large as it goes, opened from a tap or a hold.
 *
 * Ported from `showFace` in `app/lib/screens/widgets.dart` and `_showPhoto` in
 * `profile.dart`, which are the same dialog twice: a 240 square with rounded
 * corners over a scrim, their name under it in white, and a tap anywhere taking
 * it away. The app lays the square out as a real photograph — cover-cropped —
 * and keeps the initials circle for an account with no picture, because a 240px
 * empty frame would be a bigger version of nothing.
 */
export function FaceDialog({
  open,
  onClose,
  user,
}: {
  open: boolean;
  onClose: () => void;
  user?: Pick<UserCard, "name" | "username" | "avatar"> | null;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  const name = user?.name || user?.username || "";
  return createPortal(
    <div
      className="fixed inset-0 z-[95] flex items-center justify-center bg-[#07070b]/70 px-5 py-6"
      role="dialog"
      aria-modal="true"
      aria-label={name}
      onClick={onClose}
    >
      <div className="flex max-h-full flex-col items-center">
        <div className="aspect-square w-[min(240px,70vw)] overflow-hidden rounded-[22px] bg-[color-mix(in_srgb,var(--accent)_12%,var(--card))]">
          <AuthedImage
            src={user?.avatar}
            alt={name}
            className="h-full w-full"
            imgClassName="h-full w-full"
            loading="eager"
            fallback={<Avatar name={name} size={240} />}
          />
        </div>
        <p className="mt-3 max-w-full truncate text-[16px] font-bold text-white">{name}</p>
      </div>
    </div>,
    document.body,
  );
}

/** The answer `/social/users/<id>/mutuals/` gives. */
interface MutualsAnswer {
  count?: number;
  people?: UserCard[];
}

/**
 * The friends two accounts share, as a strip under a profile's numbers.
 *
 * Ported from `MutualStrip` in `app/lib/screens/mutuals.dart`. A mutual is
 * common ground — only the accounts I already keep that this person also keeps
 * — so it runs into none of the crew rules: every face here is one I put on my
 * own following list.
 *
 * Draws nothing at all when there is nothing to share, so a stranger with none
 * in common costs the page no room rather than a line saying zero.
 */
export function MutualStrip({
  count: total,
  faces,
  onOpen,
}: {
  count?: number | null;
  faces?: UserCard[];
  onOpen: () => void;
}) {
  const { t } = usePreferences();
  const n = total ?? 0;
  if (n <= 0) return null;
  const shown = (faces ?? []).slice(0, 3);

  return (
    <button
      type="button"
      onClick={onOpen}
      className="mx-auto flex max-w-full items-center gap-2 rounded-[20px] px-2 py-1.5 transition active:scale-[.98]"
    >
      {shown.length > 0 ? (
        <span
          className="relative block h-[22px] shrink-0"
          // Each face is 22 wide and overlaps the one before by 8, so the stack
          // is 22 + 14·(n-1) across.
          style={{ width: 22 + 14 * (shown.length - 1) }}
        >
          {shown.map((person, index) => (
            // The stack overlaps towards the reading end, so on a right-to-left
            // page the first face is on the right. A ring the colour of the page
            // ground makes the faces read as a stack rather than a smear where
            // they meet — the app's `X.ink`, which is the page's own ground and
            // not the colour its words are written in.
            <span
              key={person.id ?? index}
              className="absolute top-0 rounded-full bg-[var(--page)] p-[1.5px]"
              style={{ insetInlineStart: index * 14 }}
            >
              <Avatar user={person} size={19} />
            </span>
          ))}
        </span>
      ) : null}
      <span className="min-w-0 truncate text-[12.5px] font-semibold text-dim">
        {t(
          n === 1
            ? `${count(n)} mutual friend`
            : `${count(n)} mutual friends`,
        )}
      </span>
      <ChevronRight className="size-[15px] shrink-0 text-dim" aria-hidden />
    </button>
  );
}

/**
 * The full list of shared friends, opened from the strip.
 *
 * One endpoint, one shape — the same `UserCard` rows a crew list draws, so a
 * mutual reads as the person a crew row reads as. The server holds the whole
 * answer; this asks and draws what comes back, including nothing.
 */
export function MutualsModal({
  open,
  onClose,
  personId,
  personName,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  personId: string;
  personName: string;
  onPick: (person: UserCard) => void;
}) {
  const { t } = usePreferences();
  const answer = useQuery({
    queryKey: ["mutuals", personId],
    queryFn: () => api.get<MutualsAnswer>(`/social/users/${personId}/mutuals/`),
    enabled: open && Boolean(personId),
  });
  const people = answer.data?.people ?? [];
  const total = answer.data?.count ?? people.length;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={total > 0 ? t(`Mutual · ${count(total)}`) : t("Mutual friends")}
    >
      <div className="px-4 py-3">
        {answer.isLoading ? (
          <div className="flex justify-center py-10">
            <span className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : people.length === 0 ? (
          <div className="py-10 text-center">
            <span className="mx-auto flex size-12 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] text-dim">
              <Users className="size-5" aria-hidden />
            </span>
            <p className="mt-3 text-[13px] font-extrabold">{t("No friends in common")}</p>
            <p className="mt-1 text-[11.5px] text-dim">
              {personName
                ? t(`Nobody you and ${personName} both keep yet.`)
                : t("Nobody you both keep yet.")}
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {people.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => onPick(person)}
                className="flex w-full items-center gap-3 rounded-[16px] border border-line bg-card px-3 py-2.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_3%,transparent)]"
              >
                <Avatar user={person} size={44} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold">
                    {person.name || person.username}
                  </span>
                  <span className="block truncate text-[12.5px] text-dim">@{person.username}</span>
                </span>
                <ChevronRight className="size-[18px] shrink-0 text-dim" aria-hidden />
              </button>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}
