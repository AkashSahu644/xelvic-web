import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link2, MessageCircle, Send, Share2 } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Modal } from "@/components/Modal";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { useToast } from "@/providers/ToastProvider";
import type { Drop, ThreadCard } from "@/types/api";
import { dropBase } from "./model";

/**
 * The share sheet, ported from `showShare` in `screens/drop_sheets.dart`.
 *
 * What a share *is* decides what is written down, and the backend is explicit
 * about it — `DropShare.Where` and `services.share`:
 *
 * - A convo is the only road that reaches somebody, and it is one request:
 *   `{thread}` sends the card *and* records the hand-off together, so a drop
 *   cannot be written down as shared and then fail to arrive for a reason this
 *   sheet invented in between.
 * - Handing it to another app is `where: "sheet"`, and it is only sent once the
 *   browser's own share sheet reports that the hand-off happened.
 * - Copying a link writes **nothing**. `where: "link"` is the legacy value and
 *   is deliberately not in `SENT`, because a copy is not a share: nobody was
 *   sent anything. So the copy row here posts the same quiet request the card
 *   used to and never moves the count.
 *
 * "Put it on your Moments" is on the app's list and is not drawn here: the web's
 * composer does not yet take a drop as what a moment is made from, and a row
 * that opened an empty composer would be a button that does nothing.
 */
export function ShareSheet({
  drop,
  open,
  onClose,
  onShared,
}: {
  drop: Drop;
  open: boolean;
  onClose: () => void;
  onShared?: () => void;
}) {
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();
  // A Vibe and a drop share through two routes — `/drops/{id}/share/` and
  // `/drops/vibes/{id}/share/` — and the request is otherwise identical.
  const base = dropBase(drop);

  const threads = useQuery({
    queryKey: ["threads-aside"],
    queryFn: () => api.get<{ threads: ThreadCard[] }>("/chat/threads/"),
    enabled: picking,
    staleTime: 20_000,
  });

  /**
   * The link, which every row here needs and none of them own.
   *
   * Asked for with no `where` at all so the server writes nothing: this is the
   * read that gets the address, and it is deliberately not a share. Which road
   * was taken is said afterwards, and only for the roads that reach somebody.
   */
  async function link(): Promise<string> {
    const answer = await api.post<{ link: string }>(`/${base}/${drop.id}/share/`, {});
    return answer.link;
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
      await api.post(`/${base}/${drop.id}/share/`, { where: "sheet" });
      onShared?.();
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

  async function sendTo(thread: ThreadCard) {
    if (busy) return;
    setBusy(thread.id);
    try {
      await api.post(`/${base}/${drop.id}/share/`, { thread: thread.id, where: "chat" });
      void queryClient.invalidateQueries({ queryKey: ["threads"] });
      onShared?.();
      toast({ title: "Sent.", description: "It is in that convo now.", tone: "success" });
      onClose();
    } catch (error) {
      toast({ title: "It did not go", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  const people = useMemo(() => threads.data?.threads ?? [], [threads.data]);

  return (
    <Modal
      open={open}
      onClose={() => {
        setPicking(false);
        onClose();
      }}
      title={picking ? "Send in convo" : "Share"}
      description={picking ? "Pick who it goes to." : "Where it goes decides whether anybody is told."}
      size="sm"
    >
      {picking ? (
        <div className="p-2">
          {threads.isLoading ? (
            <div className="space-y-2 p-2" aria-hidden>
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex items-center gap-3">
                  <div className="skeleton size-9 rounded-full" />
                  <div className="skeleton h-3 w-32 rounded-full" />
                </div>
              ))}
            </div>
          ) : people.length ? (
            people.map((thread) => {
              const person = thread.member ?? thread.members?.[0]?.user;
              const title = thread.title || person?.name || person?.username || "Convo";
              return (
                <button
                  key={thread.id}
                  type="button"
                  disabled={busy === thread.id}
                  onClick={() => void sendTo(thread)}
                  className="flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] disabled:opacity-50"
                >
                  <Avatar user={person} name={title} src={thread.avatar} size={36} />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold">{title}</span>
                  <Send className="size-4 text-dim" aria-hidden />
                </button>
              );
            })
          ) : (
            <p className="px-3 py-6 text-center text-[12.5px] text-dim">
              No conversations yet. Find somebody and this will have somewhere to go.
            </p>
          )}
        </div>
      ) : (
        <div className="p-2">
          <Row
            icon={<MessageCircle className="size-[18px]" />}
            label="Send in convo"
            line="Pick who it goes to"
            onClick={() => setPicking(true)}
          />
          {/* Only drawn where the browser has a sheet to open: a row that could
              not hand anything anywhere would be a row that does nothing. The
              test is on the member rather than on `navigator.share` being
              present, because the type says it always is — desktop browsers
              that have the member still refuse the call, and that refusal is
              handled below. */}
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
      )}
    </Modal>
  );
}

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
      className="flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] disabled:opacity-50"
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
