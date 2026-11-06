import { useState, type ComponentType } from "react";
import { useParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Ban,
  Banknote,
  CalendarDays,
  Check,
  Film,
  Image as ImageIcon,
  Play,
  Upload,
  X,
} from "lucide-react";
import { AuthedImage, AuthedVideo } from "@/components/media/Media";
import { ConfirmDialog, Modal } from "@/components/overlays/Modal";
import { PageHeader } from "@/components/layout/Page";
import { Spinner } from "@/components/ui/Button";
import { useToast } from "@/hooks/useToast";
import { cn } from "@/utils/cn";
import { ApiError } from "@/utils/errors";
import type { Deal, DealAsset, DealEvent } from "@/types/api";
import {
  ago,
  canDo,
  clockMs,
  eventByName,
  eventIcon,
  eventTone,
  eventWord,
  fullDay,
  money,
} from "./model";
import { DealCard, DealRetry, DealSection, PartyRow, Prose, StatusChip } from "./parts";
import {
  acceptDeal,
  approveDeal,
  cancelDeal,
  declineDeal,
  deliverDeal,
  markDealPaid,
} from "@/store/deals";
import { useDeal } from "@/hooks/useDeals";

/**
 * One paid collaboration, opened in full.
 *
 * Ported from `app/lib/screens/deals/deal_detail.dart`. A company and a creator
 * read the same deal from opposite sides: the header names both of them, the
 * brief and the agreement lay out what was asked and on what terms, the
 * deliverable is shown once it is uploaded, and the timeline is the shared
 * record both sides watch.
 *
 * What each side may *do* about it is never worked out here — the server hands
 * down a `can` map on the deal, and the action bar draws a button for every
 * action that map allows. `canDo` treats anything but `true` as no.
 */

type Action = "accept" | "deliver" | "approve" | "paid" | "decline" | "cancel";

export function DealDetailView() {
  const { dealId } = useParams<{ dealId: string }>();
  const id = dealId ?? "";
  const client = useQueryClient();
  const { toast } = useToast();
  const query = useDeal(id);
  const deal = query.data ?? null;

  /**
   * The name of the action that is running, or null when the bar is idle. One
   * action runs at a time and the whole bar is disabled while it does, so the
   * person cannot fire two mutations at the same deal.
   */
  const [running, setRunning] = useState<Action | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [declining, setDeclining] = useState(false);
  const [reason, setReason] = useState("");
  const [askPaid, setAskPaid] = useState(false);
  const [askCancel, setAskCancel] = useState(false);
  const [preview, setPreview] = useState<DealAsset | null>(null);

  /**
   * Run one action and surface any error.
   *
   * Nothing is re-fetched afterwards: every action route answers the updated
   * deal — new status, new timeline, new `can` map — and `applyDeal` in
   * `queries.ts` drops that answer into the cache, so the page refreshes in
   * place. That is the app's `_run`, which does not call `_load()` either.
   */
  const run = async (action: Action, call: () => Promise<Deal>) => {
    if (running) return;
    setRunning(action);
    try {
      await call();
    } catch (error) {
      toast({
        title: error instanceof ApiError ? error.message : "Something went wrong. Try again.",
        tone: "error",
      });
    } finally {
      setRunning(null);
    }
  };

  /** Pick a file, upload it the ordinary asset way, and attach the id. */
  const onDeliver = () => {
    if (running) return;
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*,video/*";
    input.onchange = () => {
      const file = input.files?.[0];
      if (!file) return;
      setRunning("deliver");
      setProgress(0);
      void deliverDeal(client, id, file, setProgress)
        .catch((error) => {
          toast({
            title: error instanceof ApiError ? error.message : "That upload did not go through.",
            tone: "error",
          });
        })
        .finally(() => {
          setRunning(null);
          setProgress(null);
        });
    };
    input.click();
  };

  if (query.isLoading) {
    return (
      <>
        <PageHeader title="Deal" back />
        <div className="flex min-h-[40vh] items-center justify-center">
          <Spinner className="size-6 text-accent" />
        </div>
      </>
    );
  }

  if (query.isError || !deal) {
    return (
      <>
        <PageHeader title="Deal" back />
        <DealRetry
          title="This deal could not be opened."
          line={query.error instanceof ApiError ? query.error.message : undefined}
          onRetry={() => void query.refetch()}
        />
      </>
    );
  }

  const buttons: { action: Action; label: string; icon: ComponentType<{ className?: string }>; outlined?: boolean }[] = [];
  if (canDo(deal, "accept")) buttons.push({ action: "accept", label: "Accept", icon: Check });
  if (canDo(deal, "deliver")) buttons.push({ action: "deliver", label: "Upload deliverable", icon: Upload });
  if (canDo(deal, "approve")) buttons.push({ action: "approve", label: "Approve", icon: BadgeCheck });
  if (canDo(deal, "paid")) buttons.push({ action: "paid", label: "Mark paid", icon: Banknote });
  if (canDo(deal, "decline")) buttons.push({ action: "decline", label: "Decline", icon: Ban, outlined: true });
  if (canDo(deal, "cancel")) buttons.push({ action: "cancel", label: "Cancel deal", icon: X, outlined: true });

  return (
    <>
      <PageHeader title="Deal" back />

      <div className="mx-auto w-full max-w-[760px] space-y-3 px-4 pb-6 pt-2">
        <DealCard>
          <div className="flex items-start gap-2.5">
            <h1 className="flex-1 text-xl font-extrabold leading-[1.25]">
              {deal.title || "Untitled deal"}
            </h1>
            <StatusChip status={deal.status} hero />
          </div>

          <p className="mt-3 text-2xl font-extrabold text-accent">
            {money(deal.amount, deal.currency)}
          </p>

          {deal.deadline ? (
            <p className="mt-2 flex items-center gap-1.5 text-[13px] text-dim">
              <CalendarDays className="size-[15px]" aria-hidden />
              Due {fullDay(deal.deadline)}
            </p>
          ) : null}

          {deal.status === "declined" && deal.decline_reason?.trim() ? (
            <p
              className="mt-3 rounded-xl px-3 py-3 text-[13px] leading-[1.4] text-[var(--bad)]"
              style={{ backgroundColor: "color-mix(in srgb, var(--bad) 8%, transparent)" }}
            >
              Declined: {deal.decline_reason}
            </p>
          ) : null}

          <div className="my-4 h-px w-full bg-line" />

          <div className="space-y-3">
            <PartyRow role="Company" user={deal.company} />
            <PartyRow role="Creator" user={deal.creator} />
          </div>
        </DealCard>

        <DealSection title="Brief" line="What the deal is asking for.">
          <Prose text={deal.brief} />
        </DealSection>

        {deal.agreement?.trim() ? (
          <DealSection title="Agreement" line="The terms both sides are held to.">
            <Prose text={deal.agreement} />
            {deal.agreement_accepted_at ? (
              <p className="mt-3 flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--good)]">
                <BadgeCheck className="size-[15px]" aria-hidden />
                Agreement accepted on {fullDay(deal.agreement_accepted_at)}
              </p>
            ) : null}
          </DealSection>
        ) : null}

        <DealSection title="Deliverable" line="The content the creator sends over.">
          <DeliverablePanel asset={deal.deliverable ?? null} onOpen={setPreview} />
        </DealSection>

        <Timeline events={deal.events ?? []} />
      </div>

      {buttons.length > 0 ? (
        <div className="sticky bottom-0 z-20 border-t border-line bg-card px-4 py-3">
          <div className="mx-auto w-full max-w-[760px] space-y-2">
            {running === "deliver" && progress !== null ? (
              <div className="pb-2.5">
                <div className="h-1.5 w-full overflow-hidden rounded-md bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]">
                  <div
                    className="h-full rounded-md bg-accent transition-[width]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <p className="mt-1 text-[12px] text-dim">Uploading... {Math.round(progress)}%</p>
              </div>
            ) : null}

            {buttons.map((button) => {
              const busy = running === button.action;
              const Icon = button.icon;
              return (
                <button
                  key={button.action}
                  type="button"
                  disabled={running !== null}
                  onClick={() => {
                    if (button.action === "accept") void run("accept", () => acceptDeal(client, id));
                    else if (button.action === "deliver") onDeliver();
                    else if (button.action === "approve") void run("approve", () => approveDeal(client, id));
                    else if (button.action === "paid") setAskPaid(true);
                    else if (button.action === "decline") setDeclining(true);
                    else setAskCancel(true);
                  }}
                  className={cn(
                    "flex min-h-[50px] w-full items-center justify-center gap-2 rounded-[14px] text-[15px] font-bold transition disabled:opacity-60",
                    button.outlined
                      ? "border border-[color-mix(in_srgb,var(--bad)_50%,var(--line))] text-[var(--bad)] hover:bg-[color-mix(in_srgb,var(--bad)_8%,transparent)]"
                      : "bg-accent text-on-accent hover:brightness-[1.05]",
                  )}
                >
                  {busy ? (
                    <Spinner className={cn("size-5", button.outlined ? "text-[var(--bad)]" : "text-on-accent")} />
                  ) : (
                    <>
                      <Icon className="size-[18px]" />
                      {button.label}
                    </>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      {/* The optional-reason prompt for a decline. An empty reason and a backed
          out prompt are different things: one declines with nothing to add. */}
      <Modal
        open={declining}
        onClose={() => setDeclining(false)}
        title="Decline this deal?"
        description="You can add a reason for the other side. It is optional."
        size="sm"
      >
        <div className="px-5 py-4">
          <textarea
            className="field min-h-[76px] w-full resize-y"
            maxLength={240}
            rows={3}
            placeholder="Reason (optional)"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            autoFocus
          />
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5 pt-2">
          <button type="button" className="btn btn-ghost" onClick={() => setDeclining(false)}>
            Keep it
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={running !== null}
            onClick={() => {
              const text = reason.trim();
              setDeclining(false);
              setReason("");
              void run("decline", () => declineDeal(client, id, text));
            }}
          >
            Decline
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={askPaid}
        onClose={() => setAskPaid(false)}
        onConfirm={() => {
          setAskPaid(false);
          void run("paid", () => markDealPaid(client, id));
        }}
        title="Mark as paid?"
        body="Mark payment released? This is tracked only."
        confirmLabel="Mark paid"
        loading={running === "paid"}
      />

      <ConfirmDialog
        open={askCancel}
        onClose={() => setAskCancel(false)}
        onConfirm={() => {
          setAskCancel(false);
          void run("cancel", () => cancelDeal(client, id));
        }}
        title="Cancel this deal?"
        body="The other side will see it as cancelled. This cannot be undone."
        confirmLabel="Cancel deal"
        destructive
        loading={running === "cancel"}
      />

      <Modal
        open={preview !== null}
        onClose={() => setPreview(null)}
        title="Deliverable"
        size="xl"
      >
        {preview ? <DeliverableFull asset={preview} /> : null}
      </Modal>
    </>
  );
}

/**
 * The deliverable: a 16:10 plate. The thumbnail with a play disc over a clip
 * and the clip's length in the corner, or the app's "No deliverable uploaded
 * yet" panel — never an empty box that reads like a broken image.
 */
function DeliverablePanel({ asset, onOpen }: { asset: DealAsset | null; onOpen: (asset: DealAsset) => void }) {
  if (!asset) {
    return (
      <p className="w-full rounded-xl border border-line px-3.5 py-[18px] text-center text-[13.5px] text-dim" style={{ backgroundColor: "color-mix(in srgb, var(--ink) 3%, transparent)" }}>
        No deliverable uploaded yet
      </p>
    );
  }

  const isVideo = asset.kind === "video";
  const openable = !!asset.content_url;

  return (
    <button
      type="button"
      onClick={() => openable && onOpen(asset)}
      disabled={!openable}
      aria-label={openable ? "Open the deliverable" : "This deliverable has no file attached"}
      className="relative block w-full overflow-hidden rounded-xl bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] disabled:cursor-default"
      style={{ aspectRatio: "16 / 10" }}
    >
      {asset.thumb_url ? (
        <AuthedImage src={asset.thumb_url} alt="Deliverable" className="h-full w-full object-cover" />
      ) : (
        <span className="flex h-full w-full items-center justify-center text-dim">
          {isVideo ? <Film className="size-10" aria-hidden /> : <ImageIcon className="size-10" aria-hidden />}
        </span>
      )}

      {isVideo ? (
        <span className="absolute inset-0 flex items-center justify-center">
          <span className="flex size-[50px] items-center justify-center rounded-full bg-[rgb(19_19_26_/_0.5)]">
            <Play className="size-7 fill-white text-white" aria-hidden />
          </span>
        </span>
      ) : null}

      {isVideo && asset.duration_ms ? (
        <span className="absolute bottom-2 right-2 rounded-full bg-[rgb(19_19_26_/_0.7)] px-2 py-[3px] text-[11px] font-bold text-white">
          {clockMs(asset.duration_ms)}
        </span>
      ) : null}
    </button>
  );
}

/** The deliverable opened: the player for a clip, the picture in full for an image. */
function DeliverableFull({ asset }: { asset: DealAsset }) {
  if (!asset.content_url) {
    return <p className="px-5 py-10 text-center text-sm text-dim">This deliverable has no file attached.</p>;
  }
  if (asset.kind === "video") {
    return (
      <AuthedVideo
        src={asset.content_url}
        poster={asset.thumb_url ?? null}
        className="max-h-[70vh] w-full bg-black"
        controls
        autoPlay
      />
    );
  }
  return (
    <div className="flex items-center justify-center bg-black">
      <AuthedImage
        src={asset.content_url}
        alt="Deliverable"
        className="max-h-[70vh] w-full object-contain"
      />
    </div>
  );
}

/**
 * The shared record, oldest at the top so it reads as the story of the deal
 * from the invite down to now. A solid connector runs between the dots.
 */
function Timeline({ events }: { events: DealEvent[] }) {
  return (
    <DealSection title="Timeline" line="Everything that has happened, in order.">
      {events.length === 0 ? (
        <p className="text-[13.5px] text-dim">Nothing has happened yet.</p>
      ) : (
        <ol>
          {events.map((event, index) => (
            <TimelineRow key={`${event.kind}-${event.at ?? index}`} event={event} last={index === events.length - 1} />
          ))}
        </ol>
      )}
    </DealSection>
  );
}

function TimelineRow({ event, last }: { event: DealEvent; last: boolean }) {
  const tone = eventTone(event.kind);
  const Icon = eventIcon(event.kind);
  const by = eventByName(event);

  return (
    <li className="flex gap-3">
      <span className="flex flex-col items-center self-stretch">
        <span
          className="flex size-7 shrink-0 items-center justify-center rounded-full"
          style={{ backgroundColor: `color-mix(in srgb, ${tone} 14%, transparent)`, color: tone }}
        >
          <Icon className="size-[15px]" />
        </span>
        {last ? null : <span className="my-0.5 w-0.5 flex-1 bg-line" />}
      </span>

      <div className={cn("min-w-0 flex-1", last ? "pb-0" : "pb-4")}>
        <div className="flex items-baseline gap-2">
          <span className="flex-1 text-sm font-bold">{eventWord(event.kind)}</span>
          {event.at ? <span className="shrink-0 text-[11.5px] text-dim">{ago(event.at)}</span> : null}
        </div>
        {by ? <p className="pt-px text-[12.5px] text-dim">by {by}</p> : null}
        {event.note?.trim() ? (
          <p className="pt-1 text-[13px] leading-[1.4] text-[color-mix(in_srgb,var(--ink)_80%,transparent)]">
            {event.note.trim()}
          </p>
        ) : null}
      </div>
    </li>
  );
}
