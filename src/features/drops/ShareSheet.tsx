import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowUp, Check, Link2, Search, Share2, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button, Spinner } from "@/components/ui/Button";
import { Modal } from "@/components/overlays/Modal";
import { chatService } from "@/services/chat.service";
import { dropsService } from "@/services/drops.service";
import { errorMessage } from "@/utils/errors";
import { useToast } from "@/hooks/useToast";
import type { Drop, ThreadCard } from "@/types/api";
import { dropBase } from "./model";

/**
 * The share sheet, ported from `showShare` in `screens/drop_sheets.dart` and the
 * `ShareCard` it builds (`screens/sheets.dart`).
 *
 * The shape is the app's, card for card: a search box, a pinned send button that
 * only exists while somebody is ticked, a strip of faces that tick in and out,
 * and the ways out of the app under one head. It used to be a list of three rows
 * with one tap-and-go convo list underneath, which is a different sheet from the
 * one the phone draws — and a tap-and-go list cannot send a post to three people
 * at once, which is the thing the strip is for.
 *
 * What a share *is* decides what is written down, and the backend is explicit
 * about it — `DropShare.Where` and `services.share`:
 *
 * - A convo is the only road that reaches somebody, and it is one request per
 *   convo: `{thread}` sends the card *and* records the hand-off together, so a
 *   drop cannot be written down as shared and then fail to arrive for a reason
 *   this sheet invented in between. N convos is N sends — there is no call that
 *   carries one drop to many — so one refusal must not sink the rest: the tally
 *   counts what landed and the sheet is closed only when something did.
 * - Handing it to another app is `where: "sheet"`, and it is only sent once the
 *   browser's own share sheet reports that the hand-off happened.
 * - Copying a link writes **nothing**. `where: "link"` is the legacy value and
 *   is deliberately not in `SENT`, because a copy is not a share: nobody was
 *   sent anything.
 *
 * "Put it on your Moments" is on the app's list and is not drawn here. The phone
 * opens its moments editor on the drop's own file; the web's composer takes
 * files off the roll and has no road from a post that is already up, so the row
 * would open an empty composer. It is listed as missing in the README instead of
 * being drawn as a button that does nothing.
 *
 * "Copy a link" is here and is not on the app's sheet any more: the app removed
 * it on 2026-10-27 because the phone's own sheet has a copy action
 * (*"copy link hata do, uski jagah ... whatsapp insta ye sab dikhe"*). A browser
 * often has no sheet to open at all — desktop Chrome and Safari do not — and the
 * link is then the only way the post leaves the page, so the row stays.
 */
/** What a convo is called: its own title, or the person on the other side. */
function titleOf(thread: ThreadCard) {
  const person = thread.member ?? thread.members?.[0]?.user;
  return thread.title || person?.name || person?.username || "Convo";
}

/**
 * The name and the handle a search matches against — `_hay` in `ShareCard`.
 *
 * A group has a title and a direct convo also carries the other person's handle,
 * so both are folded in: typing a handle narrows to that convo and typing the
 * name a group was given narrows to the group.
 */
function hay(thread: ThreadCard) {
  const other = thread.other ?? thread.member ?? thread.members?.[0]?.user;
  return [titleOf(thread), other?.name, other?.username].filter(Boolean).join(" ").toLowerCase();
}

export function ShareSheet({
  drop,
  open,
  onClose,
  onShared,
}: {
  drop: Drop;
  open: boolean;
  onClose: () => void;
  /**
   * How many shares were actually written, so the caller's count moves by what
   * happened rather than by one. A share into three convos is three rows on the
   * server, and the card under the sheet counts the same thing the poster's
   * number does. Never called for a copy: nothing was written.
   */
  onShared?: (sent: number) => void;
}) {
  const [query, setQuery] = useState("");
  const [chosen, setChosen] = useState<Set<string>>(() => new Set());
  const [sending, setSending] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // A Vibe and a drop share through two routes — `/drops/{id}/share/` and
  // `/drops/vibes/{id}/share/` — and the request is otherwise identical.
  const base = dropBase(drop);

  // Asked for when the sheet opens and not when the page mounts: `_Share._load`
  // is the app's same decision. The ticks are cleared with it, so a share that
  // was sent once does not come back with the same people still ticked.
  const threads = useQuery({
    queryKey: ["threads-aside"],
    queryFn: () => chatService.threads(),
    enabled: open,
    staleTime: 20_000,
  });

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setChosen(new Set());
    setSending(false);
  }, [open]);

  const people = useMemo(() => threads.data?.threads ?? [], [threads.data]);

  // Everything the card knows, narrowed by the box, then capped at ten faces —
  // the app's `_shown`, cap and all. A person with a handful of convos sees just
  // those and the strip is never padded.
  const shown = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const all = needle ? people.filter((thread) => hay(thread).includes(needle)) : people;
    return all.slice(0, 10);
  }, [people, query]);

  const chosenThreads = useMemo(
    () => people.filter((thread) => chosen.has(thread.id)),
    [people, chosen],
  );

  function toggle(thread: ThreadCard) {
    if (sending) return;
    setChosen((current) => {
      const next = new Set(current);
      if (next.has(thread.id)) next.delete(thread.id);
      else next.add(thread.id);
      return next;
    });
  }

  /**
   * The link, which two of the rows here need and neither of them owns.
   *
   * Asked for with no `where` at all so the server writes nothing: this is the
   * read that gets the address, and it is deliberately not a share. Which road
   * was taken is said afterwards, and only for the roads that reach somebody.
   */
  async function link(): Promise<string> {
    const answer = await dropsService.share(base, drop.id);
    return answer.link ?? "";
  }

  async function copyLink() {
    if (busy) return;
    setBusy("link");
    try {
      const url = await link();
      try {
        await navigator.clipboard.writeText(url);
        toast({ title: "Link copied", description: "It opens where the drop lives.", tone: "success" });
      } catch {
        // A browser that refuses the clipboard is not a failure of the share:
        // the address is real and there is nowhere else to put it, so it is
        // shown rather than swallowed.
        toast({ title: "The link is ready", description: url, tone: "info" });
      }
      onClose();
    } catch (error) {
      toast({ title: "Could not share that", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  /**
   * Hand it to another app, and say so only once it has actually gone.
   *
   * `navigator.share` is the browser's own sheet and it resolves when the person
   * picked a destination — which is exactly the moment the phone app reports
   * `where: "sheet"`. It is never recorded before that, and a dismissed sheet
   * (which rejects) writes nothing, so a share count cannot be moved by somebody
   * opening a sheet and closing it again.
   */
  async function shareOut() {
    if (busy || !("share" in navigator)) return;
    setBusy("sheet");
    try {
      const url = await link();
      await navigator.share({ url, title: drop.author.name || drop.author.username });
      await dropsService.share(base, drop.id, { where: "sheet" });
      onShared?.(1);
      toast({ title: "Sent.", tone: "success" });
      onClose();
    } catch (error) {
      // A dismissed sheet is not an error to report: the person decided not to,
      // and nothing was written. Anything else is said.
      if ((error as DOMException)?.name === "AbortError") return;
      toast({ title: "Could not share that", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  /**
   * Send it to every ticked convo, one card per convo, then say how it went.
   *
   * The app's `sendToMany`, tally and all. One send that fails must not sink the
   * rest, so each is tried on its own and the count is what actually landed. A
   * run where nothing landed leaves the sheet open on the trouble rather than
   * closing on a success that did not happen — and it is the one case where
   * nothing is claimed about the drop.
   */
  async function send() {
    if (sending || !chosenThreads.length) return;
    setSending(true);
    let sent = 0;
    let trouble: string | null = null;
    for (const thread of chosenThreads) {
      try {
        await dropsService.share(base, drop.id, { thread: thread.id, where: "chat" });
        sent += 1;
      } catch (error) {
        trouble = errorMessage(error);
      }
    }
    setSending(false);
    if (!sent) {
      toast({ title: trouble ?? "Could not send that.", tone: "error" });
      return;
    }
    void queryClient.invalidateQueries({ queryKey: ["threads"] });
    onShared?.(sent);
    // `Str.sheetSentToOne` and its plurals: "Sent to 1 person." / "Sent to 3
    // people." — and the sentence itself says when some were refused, rather
    // than a clean run being claimed over a partial one.
    const people = sent === 1 ? "1 person" : `${sent} people`;
    toast({
      title: trouble
        ? `Sent to ${people}. Some could not be reached.`
        : `Sent to ${people}.`,
      tone: trouble ? "info" : "success",
    });
    onClose();
  }

  const sendLabel = chosen.size === 1 ? "Send to 1 person" : `Send to ${chosen.size} people`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share"
      description="Where it goes decides whether anybody is told."
      size="md"
    >
      <div className="pb-1">
        {/* The box narrows the convos already in hand. The app's card is handed
            no people search on this road — `_Share` passes only the threads
            page — so nothing is asked of a server here either. */}
        <div className="px-4 pb-2 pt-0.5">
          <div className="flex items-center gap-2 rounded-[12px] border border-line bg-card px-3">
            <Search className="size-[18px] shrink-0 text-dim" aria-hidden />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search people"
              aria-label="Search people"
              className="h-10 w-full bg-transparent text-[14px] text-ink outline-none placeholder:text-dim"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                aria-label="Clear the search"
                className="icon-btn size-7"
              >
                <X className="size-4" />
              </button>
            ) : null}
          </div>
        </div>

        {/* The send button is pinned under the box rather than sitting at the end
            of the strip, so it is in the same place whether one person is ticked
            or ten — and it is a button and not another row, because the one thing
            on the card that ends the job should not look like the things that do
            not. Drawn only while there is somebody to send to. */}
        {chosen.size > 0 ? (
          <div className="px-4 pb-1 pt-2.5">
            <Button variant="primary" className="w-full" onClick={() => void send()} disabled={sending}>
              {sending ? <Spinner className="size-4" /> : <ArrowUp className="size-5" strokeWidth={2.6} />}
              {sending ? "Sending..." : sendLabel}
            </Button>
          </div>
        ) : null}

        <div className="min-h-[104px]">
          {threads.isLoading ? (
            <div className="flex h-[104px] items-center justify-center" aria-hidden>
              <Spinner className="size-5 text-accent" />
            </div>
          ) : threads.isError ? (
            // A list that failed to load is not an empty list, and saying "no
            // conversations yet" to somebody who has plenty is the kind of wrong
            // answer that makes them believe the app lost them.
            <p className="flex h-[104px] items-center justify-center px-4 text-center text-[13px] text-dim">
              Could not load your convos.
            </p>
          ) : shown.length ? (
            <div className="scroll-area flex gap-3.5 overflow-x-auto px-3.5 pb-1 pt-1.5">
              {shown.map((thread) => {
                const title = titleOf(thread);
                const person = thread.member ?? thread.members?.[0]?.user;
                const ticked = chosen.has(thread.id);
                return (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => toggle(thread)}
                    aria-pressed={ticked}
                    aria-label={`Send to ${title}`}
                    className="flex w-[66px] shrink-0 flex-col items-center pt-1.5"
                  >
                    {/* A ring and a tick, not a colour laid over the picture:
                        somebody's face is not a swatch to tint. */}
                    <span
                      className={
                        ticked
                          ? "rounded-full border-2 border-accent p-[2px]"
                          : "rounded-full border-2 border-transparent p-[2px]"
                      }
                    >
                      <Avatar
                        user={person}
                        src={thread.avatar}
                        name={title}
                        size={52}
                        badge={
                          ticked ? (
                            <span className="flex size-4 items-center justify-center rounded-full border-2 border-[var(--card)] bg-accent text-[var(--ink)]">
                              <Check className="size-2.5" strokeWidth={3.5} />
                            </span>
                          ) : undefined
                        }
                      />
                    </span>
                    <span
                      className={
                        ticked
                          ? "mt-1 w-full truncate text-center text-[11px] font-bold text-ink"
                          : "mt-1 w-full truncate text-center text-[11px] text-dim"
                      }
                    >
                      {title}
                    </span>
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="flex h-[104px] items-center justify-center px-4 text-center text-[13px] text-dim">
              {query.trim() ? "No one by that name." : "No convos yet."}
            </p>
          )}
        </div>

        <p className="px-4 pb-0.5 pt-2.5 text-[12px] font-bold tracking-[0.4px] text-dim">
          Outside app
        </p>
        {/* Only drawn where the browser has a sheet to open: a row that could not
            hand anything anywhere would be a row that does nothing. The test is
            on the member rather than on `navigator.share` being present, because
            the type says it always is — desktop browsers that have the member
            still refuse the call, and that refusal is handled above. */}
        {typeof navigator !== "undefined" && "share" in navigator ? (
          <Row
            icon={<Share2 className="size-[18px]" />}
            label="Another app"
            line="Through this browser's own share sheet"
            onClick={() => void shareOut()}
            busy={busy === "sheet"}
          />
        ) : null}
        <Row
          icon={<Link2 className="size-[18px]" />}
          label="Copy a link"
          line="Nobody is told, and it is not counted"
          onClick={() => void copyLink()}
          busy={busy === "link"}
        />
      </div>
    </Modal>
  );
}

/** One way out of the app: a mark, a word, and a line saying what it costs. */
function Row({
  icon,
  label,
  line,
  onClick,
  busy,
}: {
  icon: React.ReactNode;
  label: string;
  line: string;
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy}
      className="flex w-full items-center gap-3 rounded-[12px] px-4 py-3 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] disabled:opacity-50"
    >
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-[13.5px] font-extrabold">{label}</span>
        <span className="block text-[11px] text-dim">{line}</span>
      </span>
    </button>
  );
}
