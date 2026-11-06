import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Bolt, Flame, Share2, Trophy } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Blank } from "@/components/ui/Blank";
import { sparksService } from "@/services/sparks.service";
import { cn } from "@/utils/cn";
import { count } from "@/utils/format";
import { errorMessage } from "@/utils/errors";
import { usePreferences } from "@/hooks/usePreferences";
import { useToast } from "@/hooks/useToast";
import type { UserCard } from "@/types/api";

/**
 * The sparks leaderboard: whose spark is going the strongest among me and my
 * friends, and whose is strongest in the whole app this year.
 *
 * Ported from `app/lib/screens/sparks_leaderboard.dart`. A row names a person
 * and draws **their own alive number** — every live run they are keeping, added
 * up, which is the number their profile leads with and often not the run they
 * keep with whoever is reading the page — behind the same bolt the wallet puts
 * beside a spark. A row with no live run is not on either board at all.
 *
 * **The one rule that decides everything else here is that the answer is the
 * server's.** The ranks, the runs, the numbers and the winner all arrive
 * together from `/sparks/leaderboard/`; this page counts nothing, sorts nothing
 * and breaks no ties. A leaderboard ranked in the browser would agree with the
 * server only until two people were on the same number.
 *
 * The one thing the page works out for itself is whether the reader is already
 * in the twenty — the server says which row is theirs with `me` on both boards,
 * but not whether one of the rows it sent *is* them, and a board that drew the
 * reader twice would be saying there are two of them.
 */

/** A month's row. `day_row` — no rank, because the list order is the ranking. */
interface LeaderPerson {
  thread_id?: string | null;
  days?: number | null;
  award?: string | null;
  last?: string | null;
  me?: boolean;
  other?: UserCard | null;
}

/** A year's row, and either board's pinned self. */
/** The months, spelled out, for a heading and for one sentence about last month's winner. */
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/** `XAwards.gold` — the rung the winner's banner wears. */
const GOLD = "#A8870F";

/** One person as this page draws them, whichever board they came off. */
interface Entry {
  rank: number;
  name: string;
  avatar?: string | null;
  days: number | null;
  me: boolean;
  /** The profile this row opens, or null when it is not a door. */
  username?: string | null;
}

/** `name || username`, which is what a card is called everywhere in the app. */
function nameOf(card?: UserCard | null) {
  return (card?.name || card?.username || "").trim();
}

/** "2026-10" as "October", and the fallback for anything unreadable. */
function monthName(raw: string | undefined, fallback: string) {
  const parts = (raw ?? "").split("-");
  if (parts.length >= 2) {
    const number = Number.parseInt(parts[1], 10);
    if (Number.isFinite(number) && number >= 1 && number <= 12) return MONTHS[number - 1];
  }
  const trimmed = (raw ?? "").trim();
  return trimmed || fallback;
}

export function SparksLeaderboardPage() {
  const { t } = usePreferences();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [lane, setLane] = useState<"month" | "year">("month");
  const [sharing, setSharing] = useState(false);

  const board = useQuery({
    queryKey: ["sparks-leaderboard"],
    queryFn: () => sparksService.leaderboard(),
  });

  const monthly = board.data?.monthly;
  const yearly = board.data?.yearly;

  /**
   * The month's people as the one shape the page draws.
   *
   * A friend's tap opens the **profile**, not a chat: the runs the number was
   * read from are very often ones the reader is not part of — that is the whole
   * point of the number being theirs and not ours — so opening a conversation
   * would be opening somebody else's thread. The reader's own row is not a door
   * at all.
   */
  const monthPeople: Entry[] = (monthly?.people ?? []).map((person, index) => ({
    rank: index + 1,
    name: nameOf(person.other) || t("Somebody"),
    avatar: person.other?.avatar,
    days: person.days ?? null,
    me: Boolean(person.me),
    username: person.me ? null : person.other?.username,
  }));

  const yearPeople: Entry[] = (yearly?.people ?? []).map((person, index) => ({
    rank: person.rank ?? index + 1,
    name: nameOf(person.user) || t("Somebody"),
    avatar: person.user?.avatar,
    days: person.days ?? null,
    me: Boolean(person.me),
    username: person.me ? null : person.user?.username,
  }));

  const people = lane === "month" ? monthPeople : yearPeople;

  /** The reader's own place, drawn under the list only when it is not in it. */
  const mine = lane === "month" ? monthly?.me : yearly?.me;
  const pinned: Entry | null =
    mine && !people.some((entry) => entry.me)
      ? {
          rank: mine.rank ?? 0,
          name: nameOf(mine.user) || t("You"),
          avatar: mine.user?.avatar,
          days: mine.days ?? null,
          me: true,
          username: null,
        }
      : null;

  const top = people[0] ?? null;

  /** Share the top of whichever board is on screen, as one sentence. */
  async function share() {
    if (sharing) return;
    setSharing(true);
    const which = t(lane === "month" ? "this month" : "this year");
    const line = !top
      ? t(`The sparks leaderboard on Xelvic — ${which}.`)
      : top.days === null
        ? t(`${top.name} is top of the Xelvic sparks leaderboard ${which}.`)
        : t(`${top.name} is top of the Xelvic sparks leaderboard ${which} with ${count(top.days)} sparks.`);
    try {
      if (typeof navigator.share === "function") {
        await navigator.share({ title: t("Xelvic sparks leaderboard"), text: line });
      } else {
        await navigator.clipboard.writeText(line);
        toast({ title: t("Copied to the clipboard instead."), tone: "success" });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      toast({ title: t("Copy the link from the address bar"), tone: "info" });
      void error;
    } finally {
      setSharing(false);
    }
  }

  return (
    <div
      className="min-h-dvh pb-[calc(92px+env(safe-area-inset-bottom,0px))] md:pb-16"
      // The wash is the page's ground rather than a band inside it: the header
      // sits on its deepest end, the pill on its middle, and the list arrives
      // at the plain page by the time there is a run of names to read. One tone
      // of the accent over the page and nothing else — no second hue to
      // disagree with whichever theme is being worn.
      style={{
        backgroundImage:
          "linear-gradient(180deg, color-mix(in srgb, var(--accent) 26%, var(--page)), color-mix(in srgb, var(--accent) 12%, var(--page)) 32%, var(--page) 72%)",
      }}
    >
      {/* The way out, the title, and the way out to somebody else. The title is
          centred between two buttons of the same width, which is what keeps it
          centred whether or not the share button is drawn. Both buttons are the
          theme's own ink: the band under them is a wash of the accent, and the
          accent would be a smudge on itself. */}
      <div className="flex items-center px-1 pb-2.5 pt-0.5">
        <button
          type="button"
          onClick={() => (window.history.length > 1 ? navigate(-1) : navigate("/app/sparks"))}
          className="icon-btn"
          aria-label={t("Back")}
        >
          <ArrowLeft className="size-5" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center text-[17px] font-extrabold tracking-[-0.2px]">
          {t("Leaderboard")}
        </h1>
        <button
          type="button"
          onClick={() => void share()}
          disabled={sharing}
          className="icon-btn"
          aria-label={t("Share")}
        >
          <Share2 className="size-5" />
        </button>
      </div>

      {/* The two lanes, as one pill with a smaller pill inside it: the selected
          half is a raised card sitting inside a track of the ink at a whisper,
          so the control reads as a switch rather than as two underlined words. */}
      <div className="px-4">
        <div className="flex h-[46px] rounded-full border border-[color-mix(in_srgb,var(--ink)_8%,transparent)] bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] p-1">
          {(["month", "year"] as const).map((which) => {
            const on = lane === which;
            return (
              <button
                key={which}
                type="button"
                onClick={() => setLane(which)}
                aria-pressed={on}
                className={cn(
                  "flex flex-1 items-center justify-center rounded-full text-[13.5px] transition",
                  on
                    ? "bg-card font-extrabold text-ink shadow-sm"
                    : "font-semibold text-dim hover:text-ink",
                )}
              >
                {t(which === "month" ? "This month" : "This year")}
              </button>
            );
          })}
        </div>
      </div>

      {/* A breath between the pill and the board — the app's six pixels — then
          the list's own 16/8/16/26. */}
      <div className="mt-1.5 px-4 pb-[26px] pt-2">
        <Body
          loading={board.isLoading}
          error={board.isError ? board.error : null}
          onRetry={() => void board.refetch()}
          lane={lane}
          people={people}
          pinned={pinned}
          month={monthly?.month}
          year={yearly?.year}
          winner={monthly?.previous?.winner}
          winnerMonth={monthly?.previous?.month}
        />
      </div>
    </div>
  );
}

/** Whichever board is open, or the three ways there is no board to draw. */
function Body({
  loading,
  error,
  onRetry,
  lane,
  people,
  pinned,
  month,
  year,
  winner,
  winnerMonth,
}: {
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  lane: "month" | "year";
  people: Entry[];
  pinned: Entry | null;
  month?: string;
  year?: number | null;
  winner?: LeaderPerson | null;
  winnerMonth?: string;
}) {
  const { t } = usePreferences();

  if (error) {
    // The app says a failure as a sentence and the server's own words under it,
    // and the page stays a place somebody can stand on: the boards behind it
    // are simply not read.
    return (
      <div className="py-2">
        <p className="text-[14px] font-bold">{t("The leaderboard could not be read just now.")}</p>
        <p className="mt-1.5 text-[12.5px] leading-[1.5] text-dim">{errorMessage(error)}</p>
        <button type="button" onClick={onRetry} className="mt-2 text-[14px] font-semibold text-accent">
          {t("Try again")}
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center py-[26px]">
        <span className="size-[22px] animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="pt-2">
      <SectionHead
        title={lane === "month" ? monthName(month, t("This month")) : year ? String(year) : t("This year")}
        over={t(lane === "month" ? "This month" : "This year")}
      />

      {/* Last month's winner is quiet and above the list rather than in it: it
          is not a standing this month, it is the answer to "who won last time".
          The count is left out on purpose — that month is over and the run is
          very likely dead by now, while the board under this shows numbers that
          are alive today. */}
      {lane === "month" && winner ? (
        <div className="mt-2.5">
          <div className="flex items-center rounded-full border border-line bg-card px-[13px] py-2.5">
            <Trophy className="size-[17px] shrink-0" style={{ color: GOLD }} aria-hidden />
            <p className="ml-[9px] min-w-0 flex-1 truncate text-[12.5px] leading-[1.3] text-dim">
              {t(`${monthName(winnerMonth, t("Last month"))}'s winner · ${nameOf(winner.other) || t("somebody")}`)}
            </p>
          </div>
        </div>
      ) : null}

      <div className="mt-[18px]">
        {people.length === 0 ? (
          <Blank
            icon={<Flame className="size-[46px]" />}
            title={t(lane === "month" ? "Nobody's spark is going" : "No spark is going right now")}
            line={t(
              lane === "month"
                ? "The board shows friends whose spark is alive right now — both people talking within two days. It fills as they talk."
                : "This board shows the twenty longest sparks alive today. It fills as people talk.",
            )}
          />
        ) : (
          <>
            <Podium top={people.slice(0, 3)} />
            {people.length > 3 ? (
              <div className="mt-[22px]">
                {people.slice(3).map((entry) => (
                  <RankRow key={`${entry.rank}-${entry.name}`} entry={entry} />
                ))}
              </div>
            ) : null}
          </>
        )}

        {pinned ? (
          <div className="mt-3">
            <RankRow entry={pinned} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** The month or year name above a board, with its quiet label. */
function SectionHead({ title, over }: { title: string; over: string }) {
  return (
    <div className="text-center">
      <p className="truncate text-[21px] font-extrabold leading-[1.1] tracking-[-0.5px]">{title}</p>
      <p className="mt-0.5 text-[9.5px] font-bold tracking-[1.1px] text-dim">{over.toUpperCase()}</p>
    </div>
  );
}

/**
 * The first three as a podium.
 *
 * The leader is the tall one in the middle, second stands to the left and third
 * to the right, both of them dropped so that the winner's head — and everything
 * under it — is the highest thing on the page. A board with one or two people
 * still draws a podium; the empty columns are simply not there.
 */
function Podium({ top }: { top: Entry[] }) {
  const first = top[0];
  const second = top[1] ?? null;
  const third = top[2] ?? null;
  return (
    <div className="flex items-start">
      {/* Equal thirds keep the three names in a line whatever their lengths. */}
      <div className="min-w-0 flex-1">{second ? <Place entry={second} size={58} inset={30} /> : null}</div>
      <div className="min-w-0 flex-1">{first ? <Place entry={first} size={78} /> : null}</div>
      <div className="min-w-0 flex-1">{third ? <Place entry={third} size={58} inset={30} /> : null}</div>
    </div>
  );
}

/** One of the three: a ringed face, a rank badge over its bottom edge, a name, and the spark chip. */
function Place({ entry, size, inset = 0 }: { entry: Entry; size: number; inset?: number }) {
  return (
    <div className="flex flex-col items-center" style={{ paddingTop: inset }}>
      <div className="relative">
        <span
          className="block rounded-full border bg-card p-[3px]"
          style={{ borderColor: entry.me ? "var(--accent)" : "var(--line)", borderWidth: entry.me ? 2 : 1 }}
        >
          <Avatar name={entry.name} src={entry.avatar} size={size} />
        </span>
        {/* The badge hangs over the face's bottom edge the way a medal is
            pinned rather than printed. */}
        <span
          className="absolute -bottom-[11px] left-1/2 flex size-6 -translate-x-1/2 items-center justify-center rounded-full border text-[10px] font-extrabold"
          style={{
            backgroundColor: entry.rank <= 1 ? "var(--accent)" : "var(--card)",
            borderColor: entry.rank <= 1 ? "var(--accent)" : "var(--line)",
            color: entry.rank <= 1 ? "var(--on-accent)" : "var(--ink)",
          }}
        >
          {entry.rank}°
        </span>
      </div>
      <p
        className={cn("mt-4 max-w-full truncate text-[12.5px] font-bold", entry.me && "text-accent")}
      >
        {entry.name}
      </p>
      <div className="mt-1.5 flex items-center">
        <SparkChip days={entry.days} me={entry.me} />
        {entry.me ? (
          <span className="ml-[5px]">
            <YouTag />
          </span>
        ) : null}
      </div>
    </div>
  );
}

/** One person under the podium: the place in a circle, the face, the name, the bolt and the number. */
function RankRow({ entry }: { entry: Entry }) {
  const navigate = useNavigate();
  const open = entry.username ? () => navigate(`/app/u/${entry.username}`) : undefined;

  return (
    <button
      type="button"
      onClick={open}
      disabled={!open}
      className={cn(
        "mb-2 flex w-full items-center rounded-full border py-[7px] pl-2 pr-3.5 text-left transition",
        entry.me
          ? "border-[color-mix(in_srgb,var(--accent)_50%,transparent)]"
          : "border-line",
        open && "hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]",
      )}
      // The tint is a single alpha of the accent laid over the card rather than
      // a second colour, so the highlight follows the theme.
      style={{
        backgroundColor: entry.me
          ? "color-mix(in srgb, var(--accent) 16%, var(--card))"
          : "var(--card)",
      }}
    >
      {/* The place, in its own circle: the reference puts it inside a disc
          rather than in a column of loose numbers. */}
      <span
        className={cn(
          "flex size-[30px] shrink-0 items-center justify-center rounded-full text-[12.5px] font-extrabold",
          entry.me ? "text-accent" : "text-ink",
        )}
        style={{
          backgroundColor: entry.me
            ? "color-mix(in srgb, var(--accent) 18%, transparent)"
            : "color-mix(in srgb, var(--ink) 6%, transparent)",
        }}
      >
        {entry.rank > 0 ? count(entry.rank) : "—"}
      </span>
      <span className="ml-2.5 shrink-0">
        <Avatar name={entry.name} src={entry.avatar} size={34} />
      </span>
      <span
        className={cn(
          "ml-[11px] min-w-0 flex-1 truncate text-[13.5px]",
          entry.me ? "font-extrabold text-accent" : "font-semibold",
        )}
      >
        {entry.name}
      </span>
      {entry.me ? (
        <span className="ml-1.5 shrink-0">
          <YouTag />
        </span>
      ) : null}
      {/* The bolt the wallet draws beside a spark, then the person's own alive
          number. A number the server did not send is an em dash, never a
          nought: zero would be a claim that nothing counted, and a missing
          number is a claim that nobody said. */}
      <Bolt className="ml-2 size-[17px] shrink-0 text-accent" aria-hidden />
      <span
        className={cn(
          "ml-[3px] shrink-0 text-[13px] font-extrabold tabular-nums",
          entry.me && "text-accent",
        )}
      >
        {entry.days === null ? "—" : count(entry.days)}
      </span>
    </button>
  );
}

/** The bolt and a number in a pill, under a podium name. */
function SparkChip({ days, me }: { days: number | null; me: boolean }) {
  return (
    <span
      className="flex items-center rounded-full border bg-card py-[3px] pl-[7px] pr-[9px]"
      style={{ borderColor: me ? "color-mix(in srgb, var(--accent) 50%, transparent)" : "var(--line)" }}
    >
      <Bolt className="size-[13px] text-accent" aria-hidden />
      <span className="ml-0.5 text-[11.5px] font-extrabold tabular-nums">
        {days === null ? "—" : count(days)}
      </span>
    </span>
  );
}

/** The little "You" beside the reader's own name, wherever they are drawn. */
function YouTag() {
  const { t } = usePreferences();
  return (
    <span className="rounded-[6px] bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] px-1.5 py-0.5 text-[9.5px] font-extrabold text-accent">
      {t("You")}
    </span>
  );
}
