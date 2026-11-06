import { useState } from "react";
import { CheckCircle2, Square } from "lucide-react";
import { AuthedImage } from "@/components/media/Media";
import { cn } from "@/utils/cn";
import { errorMessage } from "@/utils/errors";
import { useToast } from "@/hooks/useToast";
import { momentsService } from "@/services/moments.service";
import type { MomentPoll, MomentPollOption } from "@/types/api";

/**
 * A poll on a moment: the question, the lines, the tally, and the taps.
 *
 * Ported from `MomentPollCard`. Before the reader has answered, the options are
 * plain bars to tap. Once answered — `poll.voted` — each option fills to its
 * share of `total_voters` and carries its count, and the reader's own choices
 * sit checked. A tap always sends the option's id; the server takes it from
 * there (a second tap on a held option is a toggle off) and answers with the
 * poll as it now stands, so the card keeps no count of its own.
 */
export function MomentPollCard({
  itemId,
  poll,
  onPoll,
  readOnly,
}: {
  itemId: string;
  poll: MomentPoll;
  /** The poll as the server answered it, so the card keeps the fresh copy. */
  onPoll?: (poll: MomentPoll) => void;
  readOnly?: boolean;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  async function vote(option: MomentPollOption) {
    if (busy || readOnly) return;
    setBusy(true);
    try {
      const answer = await momentsService.vote(itemId, option.id);
      if (answer.poll) onPoll?.(answer.poll);
    } catch (error) {
      toast({ title: "Your answer did not land", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full text-left">
      <p className="text-[17px] font-bold leading-[1.2] text-ink">{poll.question}</p>
      <div className="mt-3.5 space-y-2">
        {poll.options.map((option) => {
          const share = poll.voted && poll.total_voters > 0 ? option.count / poll.total_voters : 0;
          const picture = option.image_thumb_url || option.image_url;
          return (
            <button
              key={String(option.id)}
              type="button"
              onClick={() => void vote(option)}
              disabled={busy || readOnly}
              aria-pressed={option.mine}
              className={cn(
                "relative block w-full overflow-hidden rounded-[14px] border bg-card text-left transition",
                option.mine ? "border-accent" : "border-line",
                readOnly ? "cursor-default" : "hover:border-[color-mix(in_srgb,var(--accent)_40%,var(--line))]",
              )}
            >
              {poll.voted ? (
                <span
                  aria-hidden
                  className="absolute inset-y-0 left-0 transition-[width] duration-300"
                  style={{
                    width: `${Math.min(100, Math.max(0, share * 100))}%`,
                    backgroundColor: `color-mix(in srgb, var(--accent) ${option.mine ? 30 : 14}%, transparent)`,
                  }}
                />
              ) : null}
              <span className="relative flex min-h-[46px] items-center gap-2 px-3.5 py-2">
                {picture ? (
                  <span className="size-10 shrink-0 overflow-hidden rounded-[9px] bg-[color-mix(in_srgb,var(--accent)_12%,var(--card))]">
                    <AuthedImage src={picture} alt="" className="size-10" />
                  </span>
                ) : null}
                {option.mine ? (
                  <CheckCircle2 className="size-[18px] shrink-0 text-accent" aria-hidden />
                ) : poll.multi_select && !poll.voted ? (
                  <Square className="size-[18px] shrink-0 text-dim" aria-hidden />
                ) : null}
                <span className={cn("min-w-0 flex-1 text-[15px]", option.mine ? "font-bold" : "font-medium")}>
                  {option.text}
                </span>
                {poll.voted ? (
                  <span className="shrink-0 text-[13.5px] font-bold text-dim">{Math.round(share * 100)}%</span>
                ) : null}
              </span>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[12.5px] text-dim">{pollFoot(poll)}</p>
    </div>
  );
}

/** `MomentPollCard._footer`, in the app's words and its order. */
function pollFoot(poll: MomentPoll): string {
  const people = poll.total_voters === 1 ? "1 vote" : `${poll.total_voters} votes`;
  if (!poll.voted) {
    return poll.total_voters === 0
      ? poll.multi_select
        ? "Pick as many as you like"
        : "Pick one"
      : `${people} so far`;
  }
  return poll.multi_select ? `${people} · pick as many as you like` : people;
}