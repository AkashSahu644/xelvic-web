import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  AtSign,
  BadgeCheck,
  Bell,
  Bookmark,
  Check,
  Circle,
  Film,
  Forward,
  Grid3X3,
  Heart,
  Megaphone,
  MessageCircle,
  MonitorSmartphone,
  PhoneMissed,
  PlayCircle,
  PlusCircle,
  Radio,
  Sparkles,
  StickyNote,
  Store,
  Trophy,
  UserPlus,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Spinner } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/Page";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { AuthedImage } from "@/components/media/Media";
import { CommentsModal } from "@/features/drops/CommentsModal";
import { inkOn } from "@/features/convo/skin";
import { stamp } from "@/features/convo/model";
import {
  alertMarkLabel,
  alertOpenLabel,
  alertPath,
  alertQuote,
  alertSelfSpoken,
  alertSubject,
  alertTail,
  alertTone,
  alertWho,
  dayMark,
} from "@/features/alerts/model";
import {
  ALERTS_KEY,
  alertKeptBack,
  answerAlertKeep,
  markAlertsRead,
} from "@/store/alerts";
import { useAlerts } from "@/hooks/useAlerts";
import { apiPathFrom } from "@/config/urls";
import { dropsService } from "@/services/drops.service";
import { errorMessage } from "@/utils/errors";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/hooks/useToast";
import { alertsService } from "@/services/alerts.service";
import { socialService } from "@/services/social.service";
import type { Alert, AlertsPageData, Drop } from "@/types/api";

function KindGlyph({ alert, className }: { alert: Alert; className?: string }) {
  const Icon =
    alert.kind === "like"
      ? Heart
      : alert.kind === "respond"
        ? MessageCircle
        : alert.kind === "note"
          ? StickyNote
          : alert.kind === "share"
            ? Forward
            : alert.kind === "face"
              ? Sparkles
              : alert.kind === "mention"
                ? AtSign
                : alert.kind === "keep"
                  ? alert.kept
                    ? Check
                    : UserPlus
                  : alert.kind === "keep_request"
                    ? UserPlus
                    : alert.kind === "call"
                      ? PhoneMissed
                      : alert.kind === "live"
                        ? Radio
                        : alert.kind === "post"
                          ? PlusCircle
                          : alert.kind === "verify"
                            ? BadgeCheck
                            : alert.kind === "login"
                              ? MonitorSmartphone
                              : alert.kind === "staff"
                                ? Megaphone
                                : alert.kind === "friend_moment"
                                  ? Circle
                                  : alert.kind === "studio"
                                    ? Store
                                    : alert.kind === "achievement"
                                      ? Trophy
                                      : Bell;
  return <Icon className={className} aria-hidden />;
}

function SubjectGlyph({ about }: { about: string }) {
  if (about === "moment") return <Sparkles className="size-[9px]" aria-hidden />;
  if (about === "vibe") return <Film className="size-[9px]" aria-hidden />;
  if (about === "memory") return <Bookmark className="size-[9px]" aria-hidden />;
  if (about === "drop") return <Grid3X3 className="size-[9px]" aria-hidden />;
  return null;
}

const TILE_W = 58;
const TILE_H = 76;

export function AlertsPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const alerts = useAlerts();
  const marked = useRef(false);
  const fresh = useRef<Set<string>>(new Set());
  const [opened, setOpened] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState<string | null>(null);
  const [commentsFor, setCommentsFor] = useState<Drop | null>(null);
  const [more, setMore] = useState(false);

  useEffect(() => {
    if (!alerts.data || marked.current) return;
    marked.current = true;
    for (const row of alerts.data.results) {
      if (!row.read) fresh.current.add(row.id);
    }
    void markAlertsRead(queryClient);
  }, [alerts.data, queryClient]);

  function say(title: string, tone: "success" | "error" | "info" = "success", description?: string) {
    toast({ title, description, tone });
  }

  /**
   * Go where a row points.
   *
   * The table itself lives in `alertPath`, beside the model, because the strip
   * over the page and a background tab's system row ask it the same question —
   * and a second copy here would be a second chance to send one row to two
   * places. A row with no answer there has nowhere to go, and a tap on it does
   * nothing rather than pretending.
   */
  async function openAlert(alert: Alert) {
    const href = alertPath(alert);
    if (href) navigate(href);
  }

  async function keepBack(alert: Alert) {
    const who = alert.actor;
    if (!who || busy) return;
    setBusy(alert.id);
    try {
      const answer = await socialService.follow<{ relation?: { following?: boolean } }>(who.id);
      if (answer.relation?.following === true) {
        alertKeptBack(queryClient, alert.id);
        say(`Keeping ${who.name || who.username}.`);
      } else {
        say(`Asked to keep ${who.name || who.username}.`, "info");
      }
      void queryClient.invalidateQueries({ queryKey: ["profile", who.username] });
    } catch (error) {
      say("Could not keep them", "error", errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function answerKeep(alert: Alert, keep: boolean) {
    if (busy) return;
    setBusy(alert.id);
    try {
      const said = await answerAlertKeep(queryClient, alert, keep);
      if (said) say(said.line);
      void queryClient.invalidateQueries({ queryKey: ["threads"] });
      void queryClient.invalidateQueries({ queryKey: ["requests-count"] });
    } catch (error) {
      say("That did not answer", "error", errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function markDoor(alert: Alert) {
    if (alert.kind === "keep") {
      await keepBack(alert);
      return;
    }
    if (alert.kind !== "respond" && alert.kind !== "note") return;
    const target = alert.target;
    if (!target || (target.kind !== "drop" && target.kind !== "vibe")) return;
    setBusy(alert.id);
    try {
      const answer = await dropsService.detail<{ drop: Drop }>("drops", target.id);
      setCommentsFor(answer.drop);
    } catch (error) {
      say("That is not there any more.", "error", errorMessage(error));
    } finally {
      setBusy(null);
    }
  }

  async function loadMore() {
    const next = apiPathFrom(alerts.data?.next);
    if (!next || more) return;
    setMore(true);
    try {
      const page = await alertsService.page(next);
      queryClient.setQueryData<AlertsPageData>(ALERTS_KEY, (current) =>
        current
          ? {
              ...current,
              next: page.next,
              unread: page.unread ?? current.unread,
              pinned: page.pinned ?? current.pinned,
              muted: page.muted ?? current.muted,
              results: [...current.results, ...page.results.filter((row) => !current.results.some((old) => old.id === row.id))],
            }
          : page,
      );
    } catch (error) {
      say("Could not load more", "error", errorMessage(error));
    } finally {
      setMore(false);
    }
  }

  // The app scrolls for more rather than offering a button — see `_maybeMore`
  // and its four-hundred-point threshold — so the foot of the list is watched
  // and the next page is asked for when it comes close to the eye. A ref to the
  // loader rather than the loader itself, because the observer is rebuilt when
  // the page's `next` changes and not on every render.
  const loadMoreRef = useRef(loadMore);
  loadMoreRef.current = loadMore;
  const sentinel = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const node = sentinel.current;
    if (!node || !alerts.data?.next) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) void loadMoreRef.current();
      },
      // A longer lead than the old 400px: the next page's first byte is the
      // slowest part, and a notifications list that stops at a spinner is a
      // list somebody stops reading.
      { rootMargin: "1400px 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [alerts.data?.next]);

  const rows = alerts.data?.results ?? [];
  let above: string | null | undefined;
  const items: (string | Alert)[] = [];
  for (const row of rows) {
    const day = dayMark(row.at, above);
    if (day) items.push(day);
    above = row.at;
    items.push(row);
  }

  return (
    <div className="min-h-dvh pb-[calc(92px+env(safe-area-inset-bottom,0px))] md:pb-24">
      <PageHeader title="Notifications" back />
      <div className="mx-auto w-full max-w-[720px] px-3 pb-8 pt-3 sm:px-4">
        {alerts.isLoading ? (
          <div className="space-y-2" aria-hidden>
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="card flex items-center gap-3 p-3">
                <div className="skeleton size-11 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3 w-3/5 rounded-full" />
                  <div className="skeleton h-2.5 w-4/5 rounded-full" />
                </div>
                <div className="skeleton h-[76px] w-[58px] rounded-[10px]" />
              </div>
            ))}
          </div>
        ) : alerts.isError ? (
          <div className="card">
            <ErrorState error={alerts.error} onRetry={() => void alerts.refetch()} />
          </div>
        ) : !rows.length ? (
          <EmptyState
            icon={<Bell className="size-6" />}
            title="Nothing yet"
            body="When somebody feels a drop, responds to one, names you or keeps you, it lands here."
          />
        ) : (
          <div>
            {items.map((item, index) =>
              typeof item === "string" ? (
                <h2
                  key={`day-${index}-${item}`}
                  className="pb-2 pl-0.5 pt-4 text-[16.5px] font-bold tracking-[-0.2px] first:pt-1"
                >
                  {item}
                </h2>
              ) : (
                <AlertBubble
                  key={item.id}
                  alert={item}
                  unseen={!item.read || fresh.current.has(item.id)}
                  covered={item.preview?.sensitive === true && !opened.has(item.id)}
                  busy={busy === item.id}
                  onOpen={() => void openAlert(item)}
                  onMark={() => void markDoor(item)}
                  onAnswer={(keep) => void answerKeep(item, keep)}
                  onOpenPerson={(username) => navigate(`/app/u/${encodeURIComponent(username)}`)}
                  onOpenCover={() => setOpened((current) => new Set(current).add(item.id))}
                />
              ),
            )}
            {alerts.data?.next ? (
              <div ref={sentinel} className="flex justify-center py-4">
                {more ? <Spinner className="size-5 text-accent" /> : null}
              </div>
            ) : null}
          </div>
        )}
      </div>
      {commentsFor ? (
        <CommentsModal
          drop={commentsFor}
          open
          onClose={() => setCommentsFor(null)}
          onCommented={() => void queryClient.invalidateQueries({ queryKey: ["drop", commentsFor.id] })}
        />
      ) : null}
    </div>
  );
}

function AlertBubble({
  alert,
  unseen,
  covered,
  busy,
  onOpen,
  onMark,
  onAnswer,
  onOpenPerson,
  onOpenCover,
}: {
  alert: Alert;
  unseen: boolean;
  covered: boolean;
  busy: boolean;
  onOpen: () => void;
  onMark: () => void;
  onAnswer: (keep: boolean) => void;
  onOpenPerson: (username: string) => void;
  onOpenCover: () => void;
}) {
  const { accentAt } = useTheme();
  const selfSpoken = alertSelfSpoken(alert);
  const quote = alertQuote(alert);
  const caption = covered ? "" : (alert.preview?.caption ?? "").trim();
  const subject = alertSubject(alert.about);
  const preview = alert.preview?.thumb ? alert.preview : null;
  const subjectIsPost = alert.target?.kind === "drop" || alert.target?.kind === "vibe";
  const hasMark =
    alert.kind === "keep" ? alert.kept !== true : (alert.kind === "respond" || alert.kind === "note") && subjectIsPost;

  // An unseen row has the accent laid over the card at the same whisper the
  // Convo list's own paper is mixed at, so the rows that were new read as the
  // deeper ones without a second shape. Ported from `XTheme.paper`.
  const ground = unseen
    ? "color-mix(in srgb, var(--accent) 10%, var(--card))"
    : "var(--card)";
  // The badge's colour, off the theme's ladder rather than the single accent:
  // this is a mark on a face saying *what* happened, and the phone's `Alert.tone`
  // is the same index. `inkOn` answers which ink is legible on it, the same
  // question `X.inkOn` answers on the phone.
  const tone = accentAt(alertTone(alert));
  const onTone = inkOn(tone);

  return (
    <article
      onClick={onOpen}
      className="mb-2 flex cursor-pointer items-center rounded-[16px] border border-line p-2.5 transition hover:border-[color-mix(in_srgb,var(--accent)_24%,var(--line))]"
      style={{ backgroundColor: ground }}
    >
      <div className="relative flex size-12 shrink-0 items-center justify-center">
        {selfSpoken ? (
          // The app talking about the reader's own account arrives with no actor
          // in front of it: its own glyph stands where a face would. See
          // `Alert.selfSpoken`.
          <span
            className="flex size-11 items-center justify-center rounded-full text-accent"
            style={{ backgroundColor: "color-mix(in srgb, var(--accent) 14%, transparent)" }}
          >
            <KindGlyph alert={alert} className="size-[22px]" />
          </span>
        ) : (
          <Avatar
            user={
              alert.actor
                ? { name: alert.actor.name, username: alert.actor.username, avatar: alert.actor.avatar ?? null }
                : null
            }
            name={alertWho(alert)}
            size={44}
          />
        )}
        {/* The person's own door, under everything drawn over it, so whatever is
            on top wins the tap. A row the app speaks about the reader's own
            account has nobody in front of it and no profile to open. */}
        {!selfSpoken && alert.actor ? (
          <button
            type="button"
            className="absolute inset-0 rounded-full"
            onClick={(event) => {
              event.stopPropagation();
              onOpenPerson(alert.actor!.username);
            }}
            aria-label={alertWho(alert)}
          />
        ) : null}
        {/* The badge is a mark, not a door: twenty points, in its own colour of
            the theme's ladder, ringed in the card's own ground so it reads as
            sitting on the face rather than as a second face beside it. The door
            that shares its corner is the twenty-eight point circle below, and
            the two are separate shapes — see `alertMarkTapSide`. */}
        {!selfSpoken ? (
          <span
            className="pointer-events-none absolute bottom-0 right-0 flex size-5 items-center justify-center rounded-full"
            style={{ backgroundColor: tone, color: onTone, border: `2px solid ${ground}` }}
            aria-hidden
          >
            <KindGlyph alert={alert} className="size-[11px]" />
          </span>
        ) : null}
        {!selfSpoken && hasMark ? (
          <button
            type="button"
            disabled={busy}
            onClick={(event) => {
              event.stopPropagation();
              onMark();
            }}
            className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full transition hover:bg-[color-mix(in_srgb,var(--ink)_8%,transparent)] disabled:opacity-60"
            aria-label={alertMarkLabel(alert)}
            title={alertMarkLabel(alert)}
          >
            {busy ? <Spinner className="size-3.5" /> : null}
          </button>
        ) : null}
      </div>

      <div className="ml-[11px] min-w-0 flex-1 px-[11px] py-2">
        <p className="text-[14px] leading-[1.35] text-ink">
          {selfSpoken ? (
            <span>{alertTail(alert)}</span>
          ) : (
            <>
              {alert.actor ? (
                <button
                  type="button"
                  className="font-bold hover:underline"
                  onClick={(event) => {
                    event.stopPropagation();
                    onOpenPerson(alert.actor!.username);
                  }}
                >
                  {alertWho(alert)}
                </button>
              ) : (
                <span className="font-bold">{alertWho(alert)}</span>
              )}
              {alert.actor?.verified ? (
                <BadgeCheck
                  className="mr-1 inline size-[13px] -translate-y-px text-accent"
                  aria-label="Verified"
                />
              ) : (
                " "
              )}
              <span className="text-dim">{alertTail(alert)}</span>
            </>
          )}
          <span className="text-[12.5px] text-dim">{"  "}{stamp(alert.at)}</span>
        </p>
        {quote ? (
          <p className="mt-[5px] line-clamp-3 text-[13.5px] leading-[1.35] text-ink">{quote}</p>
        ) : null}
        {caption ? <p className="mt-1 line-clamp-2 text-[12.5px] leading-[1.3] text-dim">{caption}</p> : null}
      </div>

      {/* The right edge: the thing the row is *about*. One fixed portrait frame
          cropped to it, because this is a column of thumbnails and a column
          whose members changed shape per row would not be a column. A marked
          still wears its cover here and is the one picture with no door of its
          own — the veil's button is the reader's step across. */}
      {preview ? (
        <div className="ml-2.5 flex w-[58px] shrink-0 flex-col items-center">
          {covered ? (
            <div
              className="relative overflow-hidden rounded-[10px] bg-[color-mix(in_srgb,var(--ink)_6%,var(--card))]"
              style={{ width: TILE_W, height: TILE_H }}
            >
              <AuthedImage src={preview.thumb} alt="" className="h-full w-full scale-105 object-cover blur-xl" />
              <span
                className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-black/25 text-[9px] font-bold text-white"
                role="button"
                tabIndex={0}
                onClick={(event) => {
                  event.stopPropagation();
                  onOpenCover();
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    event.stopPropagation();
                    onOpenCover();
                  }
                }}
              >
                <span>Sensitive</span>
                <span className="rounded-full bg-[color-mix(in_srgb,var(--card)_95%,transparent)] px-1.5 py-0.5 text-[8.5px] font-extrabold text-ink">
                  Open
                </span>
              </span>
            </div>
          ) : (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpen();
              }}
              className="relative overflow-hidden rounded-[10px] bg-[color-mix(in_srgb,var(--ink)_6%,var(--card))]"
              style={{ width: TILE_W, height: TILE_H }}
              aria-label={alertOpenLabel(alert)}
            >
              <AuthedImage src={preview.thumb} alt="" className="h-full w-full object-cover" />
              {preview.kind === "video" ? (
                <PlayCircle
                  className="absolute left-1/2 top-1/2 size-[26px] -translate-x-1/2 -translate-y-1/2 text-white drop-shadow"
                  aria-hidden
                />
              ) : null}
            </button>
          )}
          {/* The word goes *under* the picture rather than over it: a tag laid
              over the corner is capped by the tile's own width, and "Memory" in
              a fifty-eight point tile is a tag with its last letter cut off. */}
          {subject.label ? (
            <span className="mt-[3px] flex w-[58px] items-center justify-center gap-[3px]">
              <SubjectGlyph about={alert.about} />
              <span className="truncate text-[9.5px] font-semibold leading-[1.1] text-dim">{subject.label}</span>
            </span>
          ) : null}
        </div>
      ) : null}

      {/* A question is answered where it is read, at the row's far end and side by
          side rather than stacked: two answers read level with the face they are
          about, and a stacked pair would stand taller than the face and pull one
          row of the list out of the line the others are read down. */}
      {alert.kind === "keep_request" ? (
        <div className="ml-2 flex shrink-0 items-start gap-1.5" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            disabled={busy}
            onClick={() => onAnswer(true)}
            className="flex size-11 items-center justify-center rounded-full disabled:opacity-60"
            aria-label="Keep them back"
            title="Keep back"
          >
            <span
              className="flex size-[34px] items-center justify-center rounded-full"
              style={{
                backgroundColor: "color-mix(in srgb, var(--accent) 16%, transparent)",
                color: "var(--accent)",
              }}
            >
              {busy ? <Spinner className="size-4" /> : <Check className="size-[18px]" />}
            </span>
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onAnswer(false)}
            className="flex size-11 items-center justify-center rounded-full disabled:opacity-60"
            aria-label="Not now"
            title="Not now"
          >
            <span
              className="flex size-[34px] items-center justify-center rounded-full"
              style={{
                backgroundColor: "color-mix(in srgb, var(--bad) 14%, transparent)",
                color: "var(--bad)",
              }}
            >
              <X className="size-[18px]" />
            </span>
          </button>
        </div>
      ) : null}

      {/* Whether it was new when this screen was opened: a dot at the far end,
          level with the face, so a column of rows has its dots in a line. */}
      {unseen ? (
        <span className="ml-2 flex h-12 w-[9px] shrink-0 items-center justify-center">
          <span className="size-[9px] rounded-full bg-accent" aria-hidden />
          <span className="sr-only">New</span>
        </span>
      ) : null}
    </article>
  );
}
