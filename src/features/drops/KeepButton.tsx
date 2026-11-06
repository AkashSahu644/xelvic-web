import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/utils/cn";
import { errorMessage } from "@/utils/errors";
import { useToast } from "@/hooks/useToast";
import { socialService } from "@/services/social.service";
import type { UserCard } from "@/types/api";

/** What `/social/users/{id}/follow/` answers: the gate, and what it offers now. */
interface PeopleState {
  relation?: { following?: boolean; requested?: boolean; blocked?: boolean } | null;
  cta?: string | null;
  action?: string | null;
}

/**
 * The invitation beside the name on a card, ported from `KeepButton`.
 *
 * The button is an *invitation* and never a repeat: it is drawn on somebody
 * this reader does not keep yet, and the page says so with `author_kept`, which
 * is answered for the whole page at once — see `social.services.kept_ids`. That
 * is the whole reason the flag rides on the payload: a page of cards must not be
 * a page of profile requests, and `known` is what tells this button that the
 * answer is already in hand.
 *
 * The answer is *read* rather than assumed. A private account turns a keep into
 * a *request*, in which case nothing was kept, no number moves, and the person
 * is not told they are kept — so the request's own `relation.following` is what
 * decides whether the button has finished its work or still has it to do.
 */
export function KeepButton({
  author,
  known,
  className,
}: {
  author: UserCard;
  /** The page already said this person is not kept, so nothing needs asking. */
  known?: boolean;
  className?: string;
}) {
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [state, setState] = useState<PeopleState | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);

  // A page that knows the answer has nothing to ask: the app's own word for the
  // act is drawn straight away, and only a card that was handed nothing reads
  // the profile's gate — once, when it is first drawn.
  useEffect(() => {
    if (known) return;
    let live = true;
    void socialService
      .user<{ gate?: { cta?: string | null; action?: string | null } | null }>(
        author.username,
      )
      .then((profile) => {
        if (live) setState({ cta: profile.gate?.cta ?? null, action: profile.gate?.action ?? null });
      })
      // No button rather than a wrong one: a keep that cannot be asked about is
      // a keep this card has no business offering.
      .catch(() => {
        if (live) setState({ cta: null, action: null });
      });
    return () => {
      live = false;
    };
  }, [known, author.username]);

  const action = known ? "follow" : state?.action ?? null;
  const cta = known ? "Keep" : state?.cta ?? null;

  if (done || !cta || !action) return null;

  async function tap() {
    if (busy || !action) return;
    setBusy(true);
    try {
      const answer =
        action === "withdraw"
          ? await socialService.withdraw<PeopleState>(author.id)
          : action === "unblock"
            ? await socialService.unblock<PeopleState>(author.id)
            : await socialService.follow<PeopleState>(author.id);
      if (action === "follow" && answer.relation?.following === true) {
        // Every card by this person stops offering the same invitation: the
        // page said "not kept", and that answer is out of date everywhere this
        // browser is holding one of their posts.
        void queryClient.invalidateQueries({ queryKey: ["drops"] });
        void queryClient.invalidateQueries({ queryKey: ["feed"] });
        void queryClient.invalidateQueries({ queryKey: ["profile", author.username] });
      } else if (answer.relation?.requested) {
        toast({ title: "Asked.", description: "They will see it when they look.", tone: "success" });
      }
      setDone(true);
    } catch (error) {
      toast({ title: "That did not work", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void tap()}
      disabled={busy}
      onDoubleClick={(event) => {
        // A hold on the app's pill opens the profile instead of keeping them —
        // the app reads a long press here as "who is this". A double click is
        // the nearest thing a mouse has, and a keyboard reaches the same place
        // through the name beside it.
        event.stopPropagation();
        navigate(`/app/u/${author.username}`);
      }}
      className={cn(
        "flex min-h-8 shrink-0 items-center rounded-full bg-accent px-[13px] text-[12px] font-extrabold text-on-accent transition active:scale-[.97] disabled:opacity-60",
        className,
      )}
    >
      {busy ? "..." : cta}
    </button>
  );
}
