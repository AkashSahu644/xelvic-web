import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Check, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Modal } from "@/components/Modal";
import { useToast } from "@/providers/ToastProvider";
import { cn } from "@/lib/cn";
import { ApiError } from "@/lib/errors";
import { count } from "@/lib/format";
import type { DealUser } from "@/types/api";
import { DELIVERABLE_KINDS, agreementDefault, fullDay, kindWord } from "./model";
import { VerifiedTick } from "./parts";
import { sendInvite } from "./queries";

/**
 * Write and send a brief to one creator — the second half of "invite a
 * creator", reached from the directory once somebody has been chosen.
 *
 * Ported from `app/lib/screens/deals/invite_compose.dart`. The form is the
 * whole of what a company decides: what to make, what it pays, and by when, with
 * a standard clause prefilled so the terms are never an empty box. The app
 * pushes this as a page and pops it with the created deal; on the web it is the
 * one thing on this screen that is a modal, and `onSent` is the pop.
 */
export function InviteCompose({
  creator,
  onClose,
  onSent,
}: {
  creator: DealUser | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const client = useQueryClient();
  const { toast } = useToast();

  const [kind, setKind] = useState<string>("video");
  const [title, setTitle] = useState("");
  const [brief, setBrief] = useState("");
  const [amount, setAmount] = useState("");
  const [deadline, setDeadline] = useState("");
  const [agreement, setAgreement] = useState("");
  const [sending, setSending] = useState(false);

  /**
   * The clause is written once, when the form opens, and not rewritten when the
   * kind changes — the app fills it in `initState` and leaves it alone
   * afterwards, because the company may already have edited it. Rewriting a box
   * under somebody's cursor is the one thing a prefilled default must not do.
   */
  const seeded = useRef<string | null>(null);
  useEffect(() => {
    if (!creator) {
      seeded.current = null;
      return;
    }
    if (seeded.current === creator.id) return;
    seeded.current = creator.id;
    setKind("video");
    setTitle("");
    setBrief("");
    setAmount("");
    setDeadline("");
    setAgreement(agreementDefault("video"));
    setSending(false);
  }, [creator]);

  const today = new Date();
  const maxDay = new Date(today.getTime() + 365 * 24 * 60 * 60 * 1000);
  const iso = (date: Date) => date.toISOString().slice(0, 10);

  const send = async () => {
    if (!creator || sending) return;
    const cleanTitle = title.trim();
    const cleanBrief = brief.trim();
    const value = Number.parseInt(amount.trim(), 10);
    if (!cleanTitle) {
      toast({ title: "Give the brief a title.", tone: "error" });
      return;
    }
    if (!cleanBrief) {
      toast({ title: "Say what content to make.", tone: "error" });
      return;
    }
    if (!Number.isFinite(value) || value <= 0) {
      toast({ title: "Enter an amount greater than zero.", tone: "error" });
      return;
    }
    setSending(true);
    try {
      await sendInvite(client, {
        creator: creator.id,
        title: cleanTitle,
        brief: cleanBrief,
        deliverableKind: kind,
        amount: value,
        deadline: deadline || null,
        agreement: agreement.trim(),
      });
      onSent();
    } catch (error) {
      setSending(false);
      toast({
        title: error instanceof ApiError ? error.message : "Could not send that invite.",
        tone: "error",
      });
    }
  };

  return (
    <Modal
      open={creator !== null}
      onClose={sending ? () => undefined : onClose}
      title="Send a brief"
      size="md"
    >
      {creator ? (
        <div className="space-y-5 px-5 py-4">
          {/* Who this brief is going to, drawn the way their row in the
              directory was so the two obviously match. */}
          <div className="flex items-center gap-3.5 rounded-2xl border border-line bg-card p-3.5">
            <Avatar name={creator.name || creator.username} src={creator.avatar} size={52} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1">
                <span className="truncate text-base font-bold">
                  {creator.name || creator.username}
                </span>
                {creator.verified ? <VerifiedTick size={15} /> : null}
              </div>
              <p className="mt-0.5 truncate text-[13px] text-dim" dir="ltr">
                @{creator.username} · {count(creator.followers_count ?? 0)} followers
              </p>
            </div>
          </div>

          <Field label="Title">
            <input
              className="field w-full text-[15.5px]"
              placeholder="A short name for the collaboration"
              value={title}
              maxLength={140}
              disabled={sending}
              onChange={(event) => setTitle(event.target.value)}
            />
          </Field>

          <Field label="Brief">
            <textarea
              className="field min-h-[104px] w-full resize-y text-[15.5px] leading-[1.4]"
              placeholder="What content should the creator make?"
              rows={4}
              disabled={sending}
              value={brief}
              onChange={(event) => setBrief(event.target.value)}
            />
          </Field>

          <Field label="Deliverable">
            <div className="flex flex-wrap gap-2">
              {DELIVERABLE_KINDS.map((option) => {
                const on = kind === option;
                return (
                  <button
                    key={option}
                    type="button"
                    disabled={sending}
                    aria-pressed={on}
                    onClick={() => setKind(option)}
                    className={cn(
                      "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-[13.5px] font-semibold transition",
                      on
                        ? "border-accent bg-accent text-on-accent"
                        : "border-line bg-[var(--surface-3)] text-dim hover:text-ink",
                    )}
                  >
                    {on ? <Check className="size-3.5" aria-hidden /> : null}
                    {kindWord(option)}
                  </button>
                );
              })}
            </div>
          </Field>

          <Field label="Amount">
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[15.5px] font-bold">
                ₹
              </span>
              <input
                className="field w-full pl-8 text-[15.5px]"
                inputMode="numeric"
                placeholder="0"
                disabled={sending}
                value={amount}
                onChange={(event) => setAmount(event.target.value.replace(/[^0-9]/g, ""))}
              />
            </div>
            <p className="mt-1.5 text-[12px] text-dim">
              Tracked only — no money moves until you mark it paid.
            </p>
          </Field>

          <Field label="Deadline (optional)">
            <div className="flex items-center gap-3 rounded-[14px] border border-line bg-card px-4 py-3.5">
              <CalendarDays className="size-5 shrink-0 text-accent" aria-hidden />
              <div className="min-w-0 flex-1">
                {deadline ? (
                  <span className="text-[15px] font-semibold">{fullDay(deadline)}</span>
                ) : (
                  <span className="text-[15px] text-dim">Pick a date</span>
                )}
                <input
                  type="date"
                  className="mt-1 block w-full bg-transparent text-[13px] text-dim outline-none"
                  min={iso(today)}
                  max={iso(maxDay)}
                  disabled={sending}
                  value={deadline}
                  onChange={(event) => setDeadline(event.target.value)}
                  aria-label="Deadline"
                />
              </div>
              {deadline ? (
                <button
                  type="button"
                  className="rounded-full p-1 text-dim transition hover:text-ink"
                  disabled={sending}
                  onClick={() => setDeadline("")}
                  aria-label="Clear the deadline"
                >
                  <X className="size-[18px]" />
                </button>
              ) : null}
            </div>
          </Field>

          <Field label="Agreement">
            <textarea
              className="field min-h-[112px] w-full resize-y text-[14.5px] leading-[1.45]"
              placeholder="The terms both sides see and agree to."
              rows={4}
              disabled={sending}
              value={agreement}
              onChange={(event) => setAgreement(event.target.value)}
            />
          </Field>
        </div>
      ) : null}

      <div className="flex justify-end gap-2 px-5 pb-5 pt-1">
        <button type="button" className="btn btn-secondary" disabled={sending} onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="btn btn-primary" disabled={sending} onClick={() => void send()}>
          {sending ? "Sending..." : "Send invite"}
        </button>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-2 block text-[13px] font-bold tracking-[0.2px]">{label}</span>
      {children}
    </label>
  );
}
