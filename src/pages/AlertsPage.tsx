import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  AtSign,
  BadgeCheck,
  Bell,
  Bookmark,
  Check,
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
  Trophy,
  UserPlus,
  X,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Button, Spinner } from "@/components/Button";
import { PageHeader } from "@/components/Page";
import { EmptyState, ErrorState } from "@/components/States";
import { AuthedImage } from "@/components/Media";
import { CommentsModal } from "@/features/drops/CommentsModal";
import { stamp } from "@/features/convo/model";
import {
  alertQuote,
  alertSelfSpoken,
  alertSubject,
  alertTail,
  alertWho,
  dayMark,
} from "@/features/alerts/model";
import {
  ALERTS_KEY,
  alertKeptBack,
  answerAlertKeep,
  markAlertsRead,
  useAlerts,
} from "@/features/alerts/useAlerts";
import { api, apiPathFrom } from "@/lib/api";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/errors";
import { useToast } from "@/providers/ToastProvider";
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
                                : alert.kind === "achievement"
                                  ? Trophy
                                  : Bell;
  return <Icon className={className} aria-hidden />;
}

function SubjectGlyph({ about }: { about: string }) {
  if (about === "moment") return <Sparkles className="size-2.5" aria-hidden />;
  if (about === "vibe") return <Film className="size-2.5" aria-hidden />;
  if (about === "memory") return <Bookmark className="size-2.5" aria-hidden />;
  if (about === "drop") return <Grid3X3 className="size-2.5" aria-hidden />;
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

  async function openAlert(alert: Alert) {
    if (alert.kind === "keep_request") {
      if (alert.actor) navigate(`/app/u/${encodeURIComponent(alert.actor.username)}`);
      return;
    }
    const target = alert.target;
    if (!target) return;
    if (target.kind === "drop") {
      navigate(`/app/drops/${target.id}`);
      return;
    }
    if (target.kind === "vibe") {
      navigate(`/app/drops?vibe=${encodeURIComponent(target.id)}`);
      return;
    }
    if (target.kind === "moment") {
      navigate(`/app/moments?moment=${encodeURIComponent(target.id)}`);
      return;
    }
    if (target.kind === "thread") {
      navigate(`/app/convo/${target.id}`);
      return;
    }
    if (target.kind === "profile") {
      if (alert.actor) navigate(`/app/u/${encodeURIComponent(alert.actor.username)}`);
      return;
    }
    if (target.kind === "memory") {
      say("Memories are not on the web yet.", "info");
    }
  }

  async function keepBack(alert: Alert) {
    const who = alert.actor;
    if (!who || busy) return;
    setBusy(alert.id);
    try {
      const answer = await api.post<{ relation?: { following?: boolean } }>(
        `/social/users/${who.id}/follow/`,
        {},
      );
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
      const answer = await api.get<{ drop: Drop }>(`/drops/${target.id}/`);
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
      const page = await api.get<AlertsPageData>(next);
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
              <div className="flex justify-center py-4">
                {more ? (
                  <Spinner className="size-5 text-accent" />
                ) : (
                  <Button variant="ghost" onClick={() => void loadMore()}>
                    Load older
                  </Button>
                )}
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
  const selfSpoken = alertSelfSpoken(alert);
  const quote = alertQuote(alert);
  const caption = covered ? "" : (alert.preview?.caption ?? "").trim();
  const subject = alertSubject(alert.about);
  const preview = alert.preview?.thumb ? alert.preview : null;
  const subjectIsPost = alert.target?.kind === "drop" || alert.target?.kind === "vibe";
  const hasMark =
    alert.kind === "keep" ? alert.kept !== true : (alert.kind === "respond" || alert.kind === "note") && subjectIsPost;

  const ground = unseen
    ? "color-mix(in srgb, var(--accent) 10%, var(--card))"
    : "var(--card)";

  return (
    <article
      onClick={onOpen}
      className="mb-2 flex cursor-pointer items-center gap-2.5 rounded-2xl border border-line p-2.5 transition hover:border-[color-mix(in_srgb,var(--accent)_24%,var(--line))]"
      style={{ backgroundColor: ground }}
    >
      <div className="relative flex size-12 shrink-0 items-center justify-center">
        {selfSpoken ? (
          <span className="flex size-11 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent">
            <KindGlyph alert={alert} className="size-[22px]" />
          </span>
        ) : (
          <button
            type="button"
            className="rounded-full"
            onClick={(event) => {
              event.stopPropagation();
              if (alert.actor) onOpenPerson(alert.actor.username);
            }}
            aria-label={alertWho(alert)}
          >
            <Avatar
              user={
                alert.actor
                  ? { name: alert.actor.name, username: alert.actor.username, avatar: alert.actor.avatar ?? null }
                  : null
              }
              name={alertWho(alert)}
              size={44}
            />
          </button>
        )}
        {!selfSpoken ? (
          <button
            type="button"
            disabled={!hasMark || busy}
            onClick={(event) => {
              event.stopPropagation();
              if (hasMark) onMark();
            }}
            className={cn(
              "absolute bottom-0 right-0 flex size-5 items-center justify-center rounded-full border-2 text-white transition",
              hasMark ? "hover:brightness-110" : "cursor-default",
            )}
            style={{ backgroundColor: "var(--accent)", borderColor: ground }}
            aria-label={
              alert.kind === "note"
                ? "Open the note"
                : alert.kind === "keep"
                  ? "Keep back"
                  : "Open the comments"
            }
          >
            {busy ? <Spinner className="size-3" /> : <KindGlyph alert={alert} className="size-[11px]" />}
          </button>
        ) : null}
      </div>

      <div className="min-w-0 flex-1 py-0.5">
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
                <BadgeCheck className="mx-1 inline size-3.5 -translate-y-px text-accent" aria-label="Verified" />
              ) : (
                " "
              )}
              <span className="text-dim">{alertTail(alert)}</span>
            </>
          )}
          <span className="text-[12.5px] text-dim">{"  "}{stamp(alert.at)}</span>
        </p>
        {quote ? (
          <p className="mt-1 line-clamp-3 text-[13.5px] leading-[1.35] text-ink">{quote}</p>
        ) : null}
        {caption ? <p className="mt-1 line-clamp-2 text-[12.5px] leading-[1.3] text-dim">{caption}</p> : null}
      </div>

      {preview ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            if (!covered) onOpen();
          }}
          className="relative shrink-0 overflow-hidden rounded-[10px] bg-[color-mix(in_srgb,var(--ink)_6%,var(--card))]"
          style={{ width: TILE_W, height: TILE_H }}
          aria-label={subject.label ? `Open the ${subject.label.toLowerCase()}` : "Open it"}
        >
          <AuthedImage
            src={preview.thumb}
            alt=""
            className={cn("h-full w-full object-cover", covered && "scale-105 blur-xl")}
          />
          {preview.kind === "video" && !covered ? (
            <PlayCircle className="absolute left-1/2 top-1/2 size-6 -translate-x-1/2 -translate-y-1/2 text-white drop-shadow" aria-hidden />
          ) : null}
          {covered ? (
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
          ) : null}
          {subject.label ? (
            <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/55 py-0.5 text-[9px] font-semibold text-white">
              <SubjectGlyph about={alert.about} />
              <span className="truncate">{subject.label}</span>
            </span>
          ) : null}
        </button>
      ) : null}

      {alert.kind === "keep_request" ? (
        <div className="flex shrink-0 flex-col gap-1.5" onClick={(event) => event.stopPropagation()}>
          <button
            type="button"
            disabled={busy}
            onClick={() => onAnswer(true)}
            className="flex size-[34px] items-center justify-center rounded-full bg-accent text-on-accent transition hover:brightness-110 disabled:opacity-60"
            aria-label="Keep them back"
            title="Keep back"
          >
            {busy ? <Spinner className="size-4" /> : <Check className="size-4" />}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onAnswer(false)}
            className="flex size-[34px] items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--ink)_8%,var(--card))] text-dim transition hover:text-ink disabled:opacity-60"
            aria-label="Not now"
            title="Not now"
          >
            <X className="size-4" />
          </button>
        </div>
      ) : null}

      {unseen ? <span className="size-[9px] shrink-0 rounded-full bg-accent" aria-label="New" /> : null}
    </article>
  );
}
