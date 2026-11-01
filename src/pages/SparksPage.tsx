import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Bolt,
  ChevronRight,
  MinusCircle,
  TrendingUp,
  Trophy,
  UserPlus,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/Page";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { count, plural } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { API_ORIGIN } from "@/lib/env";import { marketKeys } from "@/features/marketplace/queries";
import { useAuth } from "@/providers/AuthProvider";
import { usePreferences } from "@/providers/PreferencesProvider";
import { useToast } from "@/providers/ToastProvider";
import type { WalletData, WalletEntry, WalletPerson } from "@/features/sparks/types";
import type { Spark } from "@/types/api";

/**
 * The wallet: every day ever earned, every spark ever spent, and who the days
 * came from.
 *
 * Ported from `app/lib/screens/wallet_view.dart` (the body) and
 * `app/lib/screens/reward.dart` (the page it stands in). It was a "Sparks"
 * dashboard here until now — four tabs of the web's own invention, drawing the
 * ladder, the medals and a streaks list that the app keeps on *other* screens.
 * None of that was wrong, but none of it was this page: the app's wallet is one
 * page about one number, and the app's catalogue, medals and streaks are
 * reached elsewhere. So this is that page.
 *
 * It is one wallet for everybody and not a jar per conversation — the owner's
 * words: *"sab ka sparks(streak) ka wallet alag alag nahi rahega sab mila kar
 * kar"*. Every conversation-day earned with anybody at all lands in the same
 * ledger, and this page adds them up and then opens them out again by person,
 * which is the whole reason the ledger keeps the conversation on every line.
 *
 * **Three numbers are shown and they are three different questions.** *Alive
 * now* is the runs going right now and it falls when one breaks. *Ever earned*
 * is every conversation-day ever credited and only ever goes up; it is what the
 * themes are unlocked by, because a purchase must not take back the rung it was
 * made on. *Balance* is what is left of it after the themes that were bought,
 * and it is the one a price is read against. All three are the same number
 * until the first run breaks or the first theme is bought — and then they are
 * not, and somebody is going to wonder which one is lying. None of them is.
 */

/**
 * The whole shelf's own reading of the purse, shared with the marketplace.
 *
 * The three figures at the top come off `/sparks/` and not off the wallet book,
 * which is the app's division: a purchase happens one screen away in the
 * Marketplace and what it changes is a line in the ledger, so the marketplace's
 * `refreshShelves` already invalidates this key after every buy — the balance
 * here moves without a request, exactly as the app's `_watchSparks` moves it.
 */
interface SparksData {
  sparks: Spark[];
  total: number;
  wallet: { balance: number; earned: number; spent: number; owned: string[]; owned_logos?: string[] };
  catalog?: unknown;
}

interface ReferralAnswer {
  code: string;
  reward: number;
  enabled: boolean;
  invited: number;
  earned: number;
}

/** One explanation row: the three numbers, said out loud so nobody has to guess. */
function Explain({ label, value, line }: { label: string; value: number; line: string }) {
  return (
    <div className="flex items-start">
      {/* The label column is a minimum, not a width: "Earned" fits 76, and the
          Arabic and Hindi words for it are longer. It wraps rather than being
          cut, and the figure and its line take what is left. */}
      <span className="min-w-[76px] max-w-[120px] shrink-0 text-[11.5px] font-semibold text-dim">
        {label}
      </span>
      <span className="w-[42px] shrink-0 text-[16px] font-extrabold tabular-nums">{count(value)}</span>
      <span className="min-w-0 flex-1 text-[11px] leading-[1.4] text-dim">{line}</span>
    </div>
  );
}

/** A head above a list: small, dim, spaced out. `_head` in the app. */
function Head({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-center">
      <span className="flex-1 text-[10.5px] font-bold tracking-[0.8px] text-dim">{children}</span>
      {right}
    </div>
  );
}

export function SparksPage() {
  const navigate = useNavigate();
  const { t } = usePreferences();
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<0 | 1>(0);
  const [sharing, setSharing] = useState(false);

  const sparks = useQuery({
    queryKey: ["sparks"],
    queryFn: () => api.get<SparksData>("/sparks/"),
    // The bolt beside a person on the People tab is a live run, and a run can
    // end while the page is open — the app redraws on every spark answer, and
    // its chat list already polls. Same cadence here.
    refetchInterval: 60_000,
  });

  const book = useQuery({
    queryKey: marketKeys.wallet,
    queryFn: () => api.get<WalletData>("/sparks/wallet/"),
  });

  /**
   * The share-to-win reward, read live so the invite card says the number
   * rather than a guess. Best-effort: the card is still there and shareable
   * without it, which is why a failure is left silent and the line says
   * "sparks" with no number rather than a stale default.
   */
  const referral = useQuery({
    queryKey: ["sparks-referral"],
    queryFn: () => api.get<ReferralAnswer>("/auth/me/referral/"),
    retry: false,
  });

  const balance = sparks.data?.wallet.balance ?? 0;
  const earned = sparks.data?.wallet.earned ?? 0;
  const spent = sparks.data?.wallet.spent ?? 0;
  const alive = sparks.data?.total ?? 0;
  const inviteReward = referral.data?.reward ?? 0;
  const inviteEarned = referral.data?.earned ?? 0;

  const people = book.data?.people ?? [];
  const lines = book.data?.entries ?? [];

  /** The live run with each thread, so a person's row can wear the same bolt the chat row does. */
  const live = new Map<string, Spark>();
  for (const spark of sparks.data?.sparks ?? []) {
    const id = String(spark.thread_id ?? spark.thread ?? "");
    if (id) live.set(id, spark);
  }

  /**
   * The balance card's three lines, in the app's order and with its wording.
   *
   * A count of one takes its own word — "1 of them were a day two people talked
   * on" is the kind of sentence a template produces and nobody writes — so each
   * figure picks its own form before the sentence is assembled. The web's `t()`
   * has no `{1}`, which is why the number goes in here.
   */
  const notes: string[] = [
    t(`${count(earned)} of them were a day two people talked on.`),
    ...(inviteEarned > 0 ? [t(`${count(inviteEarned)} more came from friends you invited.`)] : []),
    spent === 0
      ? t("None of them have been spent.")
      : t(`${count(spent)} of them are gone, into themes.`),
  ];

  /** Share the invite link — the handle is the code, and only the inviter is paid. */
  async function invite() {
    if (sharing) return;
    setSharing(true);
    const handle = user?.username ?? "";
    // The same link the phone mints: `Links.shareUrl(LinkKind.invite, handle)`
    // is `$kBase/i/<handle>`, the API origin's own invite page. Using the web
    // origin instead would mint a link the web app has no route for.
    const link = handle ? `${API_ORIGIN}/i/${encodeURIComponent(handle)}` : API_ORIGIN;
    const text = t(`Join me on Xelvic — I earn sparks when you do: ${link}`);
    try {
      // The web's nearest thing to the app's share sheet: the browser's own,
      // where there is one, and the clipboard where there is not — which is the
      // app's own fallback for a phone with nowhere to share into, so an invite
      // is never simply lost.
      if (typeof navigator.share === "function") {
        await navigator.share({ title: t("Join me on Xelvic"), text });
      } else {
        await navigator.clipboard.writeText(text);
        // The app's own words for this exact moment — `Str.contactsCopied`,
        // which is what `shareOutOfApp` says on a phone with no sheet to open.
        toast({ title: t("Copied to the clipboard instead."), tone: "success" });
      }
    } catch (error) {
      // A cancelled share sheet throws, and it is not a failure worth a line.
      if (error instanceof DOMException && error.name === "AbortError") return;
      // The one way this fails is a browser that will not let a page write to
      // the clipboard, and the answer to that is the same sentence the rest of
      // the web uses for it rather than a claim that the invite went out.
      toast({ title: t("Copy the link from the address bar"), tone: "info" });
      void error;
    } finally {
      setSharing(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-[760px] pb-[calc(100px+env(safe-area-inset-bottom,0px))] md:pb-16">
      <PageHeader title={t("Wallet")} back />

      <div className="px-4 pt-1">
        {/* ---- the balance, with what it is not said underneath ------------ */}
        <div className="rounded-[18px] border border-line bg-card px-[18px] pb-4 pt-[18px]">
          <div className="flex items-end">
            <span className="text-[40px] font-extrabold leading-[1.05] tracking-[-1.4px] tabular-nums">
              {count(balance)}
            </span>
            <span className="mb-[5px] ml-2 text-[12.5px] text-dim">
              {t(balance === 1 ? "spark" : "sparks")}
            </span>
            <span className="flex-1" />
            <Bolt className="size-[18px] text-accent" aria-hidden />
          </div>
          <div className="mt-2.5 flex items-start">
            <TrendingUp className="mt-0.5 size-4 shrink-0 text-[var(--good)]" aria-hidden />
            <p className="ml-[7px] min-w-0 flex-1 text-[11.5px] leading-[1.4] text-dim">
              {notes.join(" ")}
            </p>
          </div>
        </div>

        {/* ---- the door to the boards ------------------------------------- */}
        <button
          type="button"
          onClick={() => navigate("/app/sparks/leaderboard")}
          className="mt-3.5 flex w-full items-center rounded-[16px] border border-line bg-card py-[13px] pl-4 pr-3 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_3%,transparent)]"
        >
          <span className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-accent">
            <Trophy className="size-[18px]" aria-hidden />
          </span>
          <span className="ml-3 min-w-0 flex-1">
            <span className="block text-[13.5px] font-bold">{t("Sparks leaderboard")}</span>
            <span className="mt-0.5 block truncate text-[11.5px] text-dim">
              {t("Who earned the most this month, and this year")}
            </span>
          </span>
          <ChevronRight className="size-[17px] shrink-0 text-dim" aria-hidden />
        </button>

        {/* ---- the three numbers, together, because they are different ----- */}
        <div className="mt-3.5 rounded-[16px] border border-line bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] px-4 py-3.5">
          <p className="text-[13px] font-bold">{t("These are three different numbers")}</p>
          <div className="mt-2.5 space-y-2.5">
            <Explain
              label={t("Alive now")}
              value={alive}
              line={t("The runs going right now. This one falls — 48 hours of one person's silence breaks a run, and its days stop being counted here.")}
            />
            <Explain
              label={t("Ever earned")}
              value={earned}
              line={t("Every day that was ever counted. Days earned stay earned; an ended run leaves this alone, and it is what the themes are unlocked by.")}
            />
            <Explain
              label={t("Spent")}
              value={spent}
              line={t("What the themes have taken. It only ever goes up as well — a bought theme is not given back.")}
            />
          </div>
        </div>

        {/* ---- the share-to-win door -------------------------------------- */}
        <div className="mt-3.5 rounded-[18px] border border-line bg-card p-[18px]">
          <div className="flex">
            <span className="flex size-[38px] shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-accent">
              <UserPlus className="size-[19px]" aria-hidden />
            </span>
            <div className="ml-3 min-w-0 flex-1">
              <p className="text-[14px] font-extrabold">{t("Invite friends, win sparks")}</p>
              <p className="mt-[3px] text-[11.5px] leading-[1.35] text-dim">
                {inviteReward > 0
                  ? t(`A friend who joins pays you ${count(inviteReward)} sparks.`)
                  : t("A friend who joins pays you sparks.")}
              </p>
            </div>
          </div>
          <Button
            className="mt-3.5 w-full"
            loading={sharing}
            onClick={() => void invite()}
          >
            {t("Share your link")}
          </Button>
        </div>

        {/* ---- the two halves of the wallet -------------------------------- */}
        <div className="mt-5 flex gap-2">
          <TabChip
            on={tab === 0}
            label={t("People")}
            total={people.length}
            onTap={() => setTab(0)}
          />
          <TabChip
            on={tab === 1}
            label={t("History")}
            total={lines.length}
            onTap={() => setTab(1)}
          />
        </div>

        <div className="mt-3">
          {/* The three ways this body is not the body: refused, still being
              read, and genuinely nothing. On a refresh the last answer stays on
              the screen while the new one is asked for — a pull that blanked the
              page and filled it again a moment later would be a page that
              flickered every time somebody looked at it. */}
          {book.isError ? (
            <p className="whitespace-pre-line py-1.5 text-[12.5px] leading-[1.5] text-dim">
              {t(`The ledger could not be read just now.\n${errorMessage(book.error)}`)}
            </p>
          ) : book.isLoading ? (
            <div className="flex justify-center py-[26px]">
              <span className="size-[22px] animate-spin rounded-full border-2 border-accent border-t-transparent" />
            </div>
          ) : tab === 1 ? (
            <>
              <Head>{t("EVERY LINE")}</Head>
              <div className="mt-1">
                {lines.length === 0 ? (
                  <Empty line={t("Nothing here yet.")} />
                ) : (
                  lines.map((line) => <LedgerLine key={line.id} line={line} />)
                )}
              </div>
            </>
          ) : (
            <>
              <Head
                right={
                  people.length > 1 ? (
                    <span className="text-[10.5px] text-dim">
                      {t(`${count(people.length)} people`)}
                    </span>
                  ) : undefined
                }
              >
                {t("WHO THE DAYS CAME FROM")}
              </Head>
              <div className="mt-1.5">
                {people.length === 0 ? (
                  <Empty line={t("Nobody yet. A day two people talk on is one spark, and it does not matter who of you sent first.")} />
                ) : (
                  people.map((person) => (
                    <Person key={person.thread_id} person={person} spark={live.get(person.thread_id)} />
                  ))
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

/** One of the two halves, as a chip. The count is the rows behind it. */
function TabChip({
  on,
  label,
  total,
  onTap,
}: {
  on: boolean;
  label: string;
  total: number;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      aria-pressed={on}
      className={cn(
        "flex flex-1 items-center justify-center rounded-[12px] border py-[9px] transition",
        on
          ? "border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--accent)_14%,transparent)]"
          : "border-transparent bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]",
      )}
    >
      <span className={cn("text-[13px]", on ? "font-extrabold text-accent" : "font-semibold text-dim")}>
        {label}
      </span>
      <span
        className={cn(
          "ml-1.5 text-[12px] font-bold",
          on ? "text-[color-mix(in_srgb,var(--accent)_75%,transparent)]" : "text-[color-mix(in_srgb,var(--ink)_38%,transparent)]",
        )}
      >
        {count(total)}
      </span>
    </button>
  );
}

/**
 * One person's share of the wallet: their face, their name, their days, and the
 * spark the two of them have going as it stands.
 *
 * A tap opens the conversation, because the answer to "with whom" is a person
 * and the only thing anybody wants to do about one is talk to them. The row
 * carries the thread rather than the account, so it works for a group exactly
 * as it does for a person.
 */
function Person({ person, spark }: { person: WalletPerson; spark?: Spark }) {
  const { t } = usePreferences();
  const name = person.other?.name || person.other?.username || "";
  const isAlive = Boolean(spark?.alive);

  return (
    <Link
      to={person.thread_id ? `/app/convo/${person.thread_id}` : "/app/convo"}
      className="flex items-center py-[7px]"
    >
      <Avatar name={name} src={person.other?.avatar} size={34} />
      <span className="ml-[11px] min-w-0 flex-1">
        <span className="flex items-center">
          <span className="truncate text-[13.5px] font-semibold">{name || t("Somebody")}</span>
          {isAlive ? (
            <span className="ml-1.5 shrink-0 rounded-[5px] bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] px-[5px] py-[1.5px] text-[9.5px] font-extrabold text-accent">
              {t("live")}
            </span>
          ) : null}
        </span>
        <span className="mt-0.5 block truncate text-[11px] text-dim">
          {person.last
            ? t(`last counted ${person.last}`)
            : t(`first counted ${person.first ?? ""}`)}
        </span>
      </span>
      <span className="ml-2 flex shrink-0 items-center">
        {spark ? (
          <>
            <Bolt
              className={cn("size-[17px]", isAlive ? "text-accent" : "text-[color-mix(in_srgb,var(--ink)_30%,transparent)]")}
              aria-hidden
            />
            <span className={cn("ml-0.5 text-[13px] font-extrabold tabular-nums", isAlive && "text-accent")}>
              {count(spark.count)}
            </span>
          </>
        ) : (
          // No live run with this person, so the number that stands is the one
          // this page is certain of: every day ever counted between them.
          <span className="text-[13px] font-bold tabular-nums">{plural(person.days, "day")}</span>
        )}
      </span>
    </Link>
  );
}

/**
 * One line of the ledger, newest first, every line naming who it was with.
 *
 * A day earned is titled by the person and a purchase by what was bought —
 * which are the two ways a line here can be read, and neither of them is "a day
 * counted" forty times over. An earn with a label is a share-to-win invite and
 * not a conversation-day: it was not with anybody and has no day, so it reads
 * from its label rather than from a date.
 */
function LedgerLine({ line }: { line: WalletEntry }) {
  const { t } = usePreferences();
  const label = line.label ?? "";
  const isSpent = line.amount < 0;
  const isInvite = !isSpent && label !== "";

  const title = isSpent
    ? label || t("Spent")
    : isInvite
      ? label
      : line.other?.name || line.other?.username || t("A day counted");
  const sub = isSpent
    ? t(`${line.day ?? ""} · a theme you kept`)
    : isInvite
      ? t("a friend who joined")
      : t(`${line.day ?? ""} · a day you two talked`);

  return (
    <div className="flex items-center py-[7px]">
      {isSpent ? (
        <MinusCircle className="size-[18px] shrink-0 text-[var(--bad)]" aria-hidden />
      ) : isInvite ? (
        <UserPlus className="size-[18px] shrink-0 text-[var(--good)]" aria-hidden />
      ) : (
        <Avatar
          name={line.other?.name || line.other?.username || ""}
          src={line.other?.avatar}
          size={24}
        />
      )}
      <span className="ml-2.5 min-w-0 flex-1">
        <span className="block truncate text-[13px]">{title}</span>
        <span className="block truncate text-[11px] text-dim">{sub}</span>
      </span>
      <span
        className={cn(
          "ml-2 shrink-0 text-[13px] font-bold tabular-nums",
          isSpent && "text-[var(--bad)]",
        )}
      >
        {line.amount > 0 ? `+${line.amount}` : String(line.amount)}
      </span>
    </div>
  );
}

/** The one line a half of the wallet has to say when it has nothing behind it. */
function Empty({ line }: { line: string }) {
  return <p className="py-1 text-[12.5px] leading-[1.5] text-dim">{line}</p>;
}
