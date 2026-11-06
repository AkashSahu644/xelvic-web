import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Flag } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/overlays/Modal";
import { cn } from "@/utils/cn";
import { errorMessage } from "@/utils/errors";
import { useToast } from "@/hooks/useToast";
import { socialService } from "@/services/social.service";

/** The kinds of thing a complaint can be about — `social.models.Report.Target`. */
export type ReportKind =
  | "user"
  | "message"
  | "drop"
  | "vibe"
  | "drop_comment"
  | "vibe_comment"
  | "room";

interface Answers {
  targets: { value: string; label: string }[];
  reasons: Record<string, { value: string; label: string }[]>;
}

const TITLE: Record<ReportKind, string> = {
  user: "Report this account?",
  message: "Report this line?",
  drop: "Report this post?",
  vibe: "Report this video?",
  drop_comment: "Report this comment?",
  vibe_comment: "Report this comment?",
  room: "Report this room?",
};

/**
 * Filing a complaint, with the server's own words.
 *
 * **The list is read, not written here.** `GET /social/report/` answers the
 * reasons for each kind of thing, and the endpoint says why in as many words:
 * a list written into the client is a list that goes on offering "Spam" about a
 * value the server stopped accepting — and the list is not the same list for a
 * post, a comment and a profile. The web used to hardcode a single `spam`
 * default and never ask, which is the exact failure that note describes.
 *
 * The answer is `{ok, new}`. `new: false` means a complaint about this thing is
 * already open, and the app has a sentence of its own for that — *"You have
 * already reported this. It is in the queue."* — rather than presenting a
 * second filing as a fresh success.
 */
export function ReportSheet({
  open,
  onClose,
  kind,
  id,
  who,
  handle,
  avatar,
  preview,
}: {
  open: boolean;
  onClose: () => void;
  kind: ReportKind;
  id: string;
  /** The name shown at the head of the sheet, and the face beside it. */
  who?: string;
  handle?: string;
  avatar?: string | null;
  /** What the complaint is about, shown so nobody reports the wrong row. */
  preview?: string;
}) {
  const { toast } = useToast();
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [noted, setNoted] = useState(false);

  const answer = useQuery({
    queryKey: ["report-reasons"],
    queryFn: () => socialService.reportReasons<Answers>(),
    enabled: open,
    staleTime: 5 * 60_000,
  });

  // Wrapped so the effect below depends on the list itself rather than on a
  // fresh empty array every render.
  const reasons = useMemo(() => answer.data?.reasons?.[kind] ?? [], [answer.data, kind]);

  // The first reason is the sheet's answer until somebody picks another one, so
  // the question is never asked with nothing selected — and it is re-seeded
  // when the list arrives, because the list is the server's and may be empty
  // for a kind that has no reasons of its own.
  useEffect(() => {
    if (!reasons.length) return;
    setReason((current) => (reasons.some((row) => row.value === current) ? current : reasons[0].value));
  }, [reasons]);

  async function file() {
    if (busy || !reason) return;
    setBusy(true);
    try {
      const result = await socialService.report({
        target_kind: kind,
        target_id: id,
        reason,
        note: note.trim(),
      });
      onClose();
      toast({
        title: result.new ? "Reported. A moderator will look at it." : "You have already reported this. It is in the queue.",
        tone: result.new ? "success" : "info",
      });
    } catch (error) {
      toast({ title: "That could not be sent.", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title={TITLE[kind]} size="sm">
      <div className="px-4 pb-1 pt-3">
        {who ? (
          <div className="mb-3 flex items-center gap-3 rounded-[14px] bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] p-2.5">
            <Avatar name={who} src={avatar} size={36} />
            <span className="min-w-0">
              <span className="block truncate text-[13px] font-bold">{who}</span>
              {handle ? <span className="block truncate text-[11px] text-dim">@{handle}</span> : null}
            </span>
          </div>
        ) : null}
        {preview ? (
          <p className="mb-3 line-clamp-2 rounded-[12px] border border-line px-2.5 py-2 text-[12px] leading-[1.4] text-dim">
            {preview}
          </p>
        ) : null}

        {answer.isLoading ? (
          <div className="space-y-2" aria-hidden>
            {[0, 1, 2].map((row) => (
              <div key={row} className="skeleton h-10 w-full rounded-[12px]" />
            ))}
          </div>
        ) : reasons.length ? (
          <div role="radiogroup" aria-label="Reason" className="space-y-1.5">
            {reasons.map((row) => (
              <button
                key={row.value}
                type="button"
                role="radio"
                aria-checked={reason === row.value}
                onClick={() => setReason(row.value)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-[12px] border px-3 py-2.5 text-left text-[13px] font-semibold transition",
                  reason === row.value
                    ? "border-accent bg-[color-mix(in_srgb,var(--accent)_10%,transparent)]"
                    : "border-line hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--line))]",
                )}
              >
                <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border", reason === row.value ? "border-accent" : "border-line")}>
                  {reason === row.value ? <span className="size-2 rounded-full bg-accent" /> : null}
                </span>
                {row.label}
              </button>
            ))}
          </div>
        ) : (
          <p className="py-4 text-center text-[12.5px] text-dim">
            The server has no reasons to offer for this yet.
          </p>
        )}

        <button
          type="button"
          onClick={() => setNoted((value) => !value)}
          className="mt-3 text-[12px] font-bold text-accent hover:underline"
        >
          {noted ? "Remove the note" : "Add a note"}
        </button>
        {noted ? (
          <>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={1000}
              placeholder="What happened, if the reason does not cover it."
              className="mt-2 w-full resize-none rounded-[12px] border border-line bg-transparent px-3 py-2.5 text-[13px] outline-none focus:border-accent"
            />
            <p className="mt-1 text-[11px] text-dim">
              Optional. The reason is what the queue is sorted by.
            </p>
          </>
        ) : null}

        <p className="mt-3 flex items-start gap-2 text-[11.5px] leading-[1.45] text-dim">
          <Flag className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          A moderator will look at it. Nobody is told you reported this, and nothing
          happens to them on its own.
        </p>
      </div>
      <div className="flex justify-end gap-2 px-4 pb-4 pt-2">
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="btn btn-danger"
          onClick={() => void file()}
          disabled={busy || !reason}
        >
          {busy ? "Sending..." : "Report"}
        </button>
      </div>
    </Modal>
  );
}
