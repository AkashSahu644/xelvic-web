import { useEffect, useState } from "react";
import { CheckCircle2, CircleX, Clock, GripVertical, Lock } from "lucide-react";
import { AuthedImage } from "@/components/media/Media";
import { cn } from "@/utils/cn";
import { errorMessage } from "@/utils/errors";
import { useToast } from "@/hooks/useToast";
import { dropsService } from "@/services/drops.service";
import type { Drop, Poll, PollOption } from "@/types/api";
import { dropBase, dropPollAnswers, dropPollFoot, dropPollShare } from "./model";

/**
 * A poll's answers, drawn the way `_poll` in `screens/drops.dart` draws them.
 *
 * **The results are the server's flag, not a guess.** `results` is false until
 * this reader has answered — true for the asker and for everybody once the poll
 * has closed — and until it is true the lines carry no bar and no percentage at
 * all. A bar drawn before anybody answered is a nudge towards whatever is
 * already winning, which is the reason `PollSerializer` keeps the flag separate
 * from `closed`, and this draws exactly what it is told.
 *
 * The bar is one flat tone at 20% of the accent and never a gradient — the
 * house draws depth from one ink at two alphas — and the percentage beside a
 * line is a share of *everybody who answered*, which is why it is worked out
 * across the whole set rather than per line.
 *
 * The two shapes are drawn differently because they are answered differently: a
 * `choice` poll ticks lines, and an `arrange` poll puts them in order and hands
 * the whole order in at once.
 */
export function PollBlock({
  drop,
  poll,
  onPoll,
}: {
  drop: Drop;
  poll: Poll;
  /** The poll as the server answered it, so the card can keep the new copy. */
  onPoll?: (poll: Poll) => void;
}) {
  if (poll.format === "arrange") return <ArrangePoll drop={drop} poll={poll} onPoll={onPoll} />;
  return <ChoicePoll drop={drop} poll={poll} onPoll={onPoll} />;
}

async function sendVote(drop: Drop, body: Record<string, unknown>): Promise<Poll> {
  const answer = await dropsService.pollVote(dropBase(drop), drop.id, body);
  return answer.poll;
}

function ChoicePoll({
  drop,
  poll,
  onPoll,
}: {
  drop: Drop;
  poll: Poll;
  onPoll?: (poll: Poll) => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);

  const answers = dropPollAnswers(poll);
  const shut = Boolean(poll.closed);

  /**
   * Answer it, or take the answer back.
   *
   * The whole set goes, never the one line that was touched: tapping a second
   * answer on a poll that takes one means "this one instead" rather than a
   * second vote, and tapping the answer already ticked means "none of them".
   * The server replaces rather than adds, so a double tap cannot leave this page
   * and the server believing different things.
   */
  async function answer(option: PollOption) {
    if (busy || shut) return;
    const picks = new Set(poll.options.filter((row) => row.mine).map((row) => row.id));
    if (picks.has(option.id)) picks.delete(option.id);
    else {
      if (!poll.multiple) picks.clear();
      picks.add(option.id);
    }
    setBusy(true);
    try {
      onPoll?.(await sendVote(drop, { options: Array.from(picks) }));
    } catch (error) {
      toast({ title: "Your answer did not go through", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="px-4 pb-1">
      {poll.options.map((option) => (
        <PollLine
          key={option.id}
          option={option}
          poll={poll}
          busy={busy}
          onPick={() => void answer(option)}
        />
      ))}
      <PollFoot poll={poll} answers={answers} />
    </div>
  );
}

/** One line of a choice poll: a thumb, the words, the share and the tick. */
function PollLine({
  option,
  poll,
  busy,
  onPick,
}: {
  option: PollOption;
  poll: Poll;
  busy: boolean;
  onPick: () => void;
}) {
  const share = dropPollShare(poll, option.votes ?? 0);
  const percent = Math.round(share * 100);
  const mine = Boolean(option.mine);

  return (
    <button
      type="button"
      onClick={onPick}
      disabled={busy || Boolean(poll.closed)}
      aria-pressed={mine}
      className={cn(
        "relative mb-2 block w-full overflow-hidden rounded-[12px] border text-left transition",
        mine ? "border-accent bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]" : "border-line bg-card",
        poll.closed ? "cursor-default" : "hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--line))]",
      )}
    >
      {share > 0 ? (
        <span
          aria-hidden
          className="absolute inset-y-0 left-0 bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] transition-[width] duration-300"
          style={{ width: `${share * 100}%` }}
        />
      ) : null}
      <span className="relative flex items-center px-[13px] py-3">
        {option.image_url ? (
          <PollThumb src={option.image_url} />
        ) : null}
        <span className="min-w-0 flex-1 break-words text-[14px] leading-[1.35]" style={{ fontWeight: mine ? 700 : 500 }}>
          {option.text}
        </span>
        {poll.results ? (
          <span className="num ml-2.5 shrink-0 text-[13px] font-bold text-dim">{percent}%</span>
        ) : null}
        {mine ? <CheckCircle2 className="ml-2 size-[17px] shrink-0 text-accent" aria-hidden /> : null}
      </span>
    </button>
  );
}

/**
 * The picture behind a poll line.
 *
 * Read through the same authenticated path every other upload in this app is
 * read through, because a poll's option picture is a private file on the same
 * server. A picture that will not load is a box of the theme's own ink and
 * never a broken mark — the owner asked on 2026-10-19 that no broken glyph ever
 * appear over a picture — so the box simply stays empty and the words beside it
 * carry the line on their own.
 */
function PollThumb({ src }: { src: string }) {
  return (
    <span className="me-2.5 size-10 shrink-0 overflow-hidden rounded-[8px]">
      <AuthedImage src={src} alt="" className="size-10" />
    </span>
  );
}

/**
 * Under the lines: how many answered, how long is left, and how many answers
 * this poll takes.
 *
 * The lock and the word `Closed` are the server's own verdict drawn as a mark,
 * and the countdown is counted against this machine's clock from a deadline the
 * *server* set — the only part of "is this still open" a browser is trusted
 * with. `Any number` is drawn only on a poll that takes more than one, because
 * on the others the shape of the answer is already the whole answer.
 */
export function PollFoot({ poll, answers }: { poll: Poll; answers: number }) {
  return (
    <div className="flex items-center gap-1.5 pb-0.5 pt-px">
      {poll.closed ? (
        <Lock className="size-[13px] shrink-0 text-dim" aria-hidden />
      ) : (
        <Clock className="size-[13px] shrink-0 text-dim" aria-hidden />
      )}
      <span className="min-w-0 flex-1 truncate text-[12px] text-dim">{dropPollFoot(poll, answers)}</span>
      {poll.multiple ? (
        <span className="shrink-0 text-[11.5px] font-semibold text-dim">Any number</span>
      ) : null}
    </div>
  );
}

/**
 * The order game, drawn.
 *
 * The asker typed the lines in the right order; this is where a reader puts
 * them back. Two faces and no third: while the poll is open and unanswered it
 * is the reorderable list and a Done, and once it has been answered — or once it
 * has closed — it is the lines in the order the server sent, which is the right
 * one, numbered, with the verdict under them. No share bars on either face,
 * because a share of an order is not a number that means anything.
 *
 * The working order is the reader's alone until they hand it in, and it lives
 * here rather than in the card: a half-dragged order is not an answer and must
 * never be mistaken for one. A drag is done with the grip on each row, so a tap
 * on a line feels like nothing rather than like the start of a drag — and the
 * keyboard gets the same grip, because a list that can only be reordered with a
 * mouse is a poll half the app cannot answer.
 */
function ArrangePoll({
  drop,
  poll,
  onPoll,
}: {
  drop: Drop;
  poll: Poll;
  onPoll?: (poll: Poll) => void;
}) {
  const { toast } = useToast();
  const [order, setOrder] = useState<PollOption[]>(poll.options);
  const [sending, setSending] = useState(false);

  // A fresh copy whenever the server's own list changes — an answer that landed
  // from another surface, a poll that closed while this card was on screen.
  useEffect(() => {
    setOrder(poll.options);
  }, [poll.options, poll.picked, poll.closed]);

  const done = Boolean(poll.picked || poll.closed);

  function move(from: number, to: number) {
    if (to < 0 || to >= order.length || from === to) return;
    setOrder((current) => {
      const next = [...current];
      next.splice(to, 0, ...next.splice(from, 1));
      return next;
    });
  }

  async function submit() {
    if (sending) return;
    setSending(true);
    try {
      onPoll?.(await sendVote(drop, { order: order.map((row) => row.id) }));
    } catch (error) {
      toast({ title: "That order did not go through", description: errorMessage(error), tone: "error" });
    } finally {
      setSending(false);
    }
  }

  if (!done) {
    return (
      <div className="px-4 pb-1">
        <p className="pb-2 ps-0.5 text-[12px] font-semibold text-dim">Drag into the right order</p>
        {order.map((option, index) => (
          <div
            key={option.id}
            className="mb-2 flex items-center rounded-[12px] border border-line bg-card px-[13px] py-2.5"
          >
            {option.image_url ? <PollThumb src={option.image_url} /> : null}
            <span className="min-w-0 flex-1 break-words text-[14px] leading-[1.35]">{option.text}</span>
            <button
              type="button"
              onClick={() => move(index, index - 1)}
              disabled={index === 0}
              aria-label={`Move ${option.text} up`}
              className="icon-btn ml-2 size-7 text-dim disabled:opacity-30"
            >
              <GripVertical className="size-4 rotate-90" aria-hidden />
            </button>
            <button
              type="button"
              onClick={() => move(index, index + 1)}
              disabled={index === order.length - 1}
              aria-label={`Move ${option.text} down`}
              className="icon-btn size-7 text-dim disabled:opacity-30"
            >
              <GripVertical className="size-4 -rotate-90" aria-hidden />
            </button>
          </div>
        ))}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => void submit()}
            disabled={sending}
            className="min-h-8 rounded-full px-3 text-[14px] font-bold text-accent transition hover:bg-[var(--accent-soft)] disabled:opacity-50"
          >
            {sending ? "Sending..." : "Done"}
          </button>
        </div>
        <PollFoot poll={poll} answers={dropPollAnswers(poll)} />
      </div>
    );
  }

  return (
    <div className="px-4 pb-1">
      {poll.options.map((option, index) => (
        <div
          key={option.id}
          className="mb-2 flex items-center rounded-[12px] border border-line bg-card px-[13px] py-3"
        >
          <span className="me-2.5 flex size-[22px] shrink-0 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_14%,transparent)] text-[12px] font-extrabold text-accent">
            {index + 1}
          </span>
          {option.image_url ? <PollThumb src={option.image_url} /> : null}
          <span className="min-w-0 flex-1 break-words text-[14px] leading-[1.35]">{option.text}</span>
        </div>
      ))}
      {/* Drawn only once it is known: a poll that closed under somebody who
          never answered has no right or wrong to tell them. */}
      {poll.correct === null || poll.correct === undefined ? null : (
        <div className="flex items-center gap-2 pb-1 pt-0.5">
          {poll.correct ? (
            <CheckCircle2 className="size-[18px] shrink-0 text-accent" aria-hidden />
          ) : (
            <CircleX className="size-[18px] shrink-0 text-[var(--bad)]" aria-hidden />
          )}
          <span
            className={cn("text-[13px] font-bold", poll.correct ? "text-accent" : "text-[var(--bad)]")}
          >
            {poll.correct ? "You got it right" : "Not quite"}
          </span>
        </div>
      )}
      <PollFoot poll={poll} answers={dropPollAnswers(poll)} />
    </div>
  );
}
