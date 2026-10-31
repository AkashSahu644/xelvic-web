import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { BellOff, BellRing, Pin, PinOff } from "lucide-react";
import { Modal } from "@/components/Modal";
import { Spinner } from "@/components/Button";
import { PIN_MAX } from "@/features/convo/skin";
import { errorMessage } from "@/lib/errors";
import { useToast } from "@/providers/ToastProvider";
import { setAlertFlags } from "./useAlerts";
import type { AlertsPageData } from "@/types/api";

export function AlertsManageModal({
  open,
  onClose,
  data,
  pins,
}: {
  open: boolean;
  onClose: () => void;
  data?: AlertsPageData;
  pins: number;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [busy, setBusy] = useState<"pin" | "mute" | null>(null);
  const pinned = data?.pinned === true;
  const muted = data?.muted === true;
  const spent = pins;

  async function toggle(which: "pin" | "mute") {
    if (busy) return;
    setBusy(which);
    try {
      if (which === "pin") {
        await setAlertFlags(queryClient, { pinned: !pinned });
        toast({ title: pinned ? "Unpinned." : "Pinned to the top.", tone: "success" });
      } else {
        await setAlertFlags(queryClient, { muted: !muted });
        toast({
          title: muted ? "Notifications are back on." : "Muted.",
          tone: "success",
        });
      }
    } catch (error) {
      toast({ title: "That did not change", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Notifications" size="sm">
      <div className="space-y-0.5 p-2 pb-3">
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void toggle("pin")}
          className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] disabled:opacity-55"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-[var(--accent-soft)] text-accent">
            {pinned ? <PinOff className="size-4" /> : <Pin className="size-4" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-extrabold">{pinned ? "Unpin" : "Pin to top"}</span>
            <span className="mt-0.5 block text-[10.5px] leading-4 text-dim">
              {pinned ? "It moves with the rest of the list." : "It stays above the rest of the list."}
            </span>
          </span>
          <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] px-2 py-0.5 text-[10px] font-bold text-dim">
            {busy === "pin" ? <Spinner className="size-4" /> : `${spent}/${PIN_MAX}`}
          </span>
        </button>
        <button
          type="button"
          disabled={busy !== null}
          onClick={() => void toggle("mute")}
          className="flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] disabled:opacity-55"
        >
          <span className="flex size-10 shrink-0 items-center justify-center rounded-[13px] bg-[var(--accent-soft)] text-accent">
            {muted ? <BellRing className="size-4" /> : <BellOff className="size-4" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12.5px] font-extrabold">{muted ? "Unmute" : "Mute"}</span>
            <span className="mt-0.5 block text-[10.5px] leading-4 text-dim">
              {muted ? "The badge comes back." : "No badge on the row. It still arrives."}
            </span>
          </span>
          {busy === "mute" ? <Spinner className="size-4" /> : null}
        </button>
      </div>
    </Modal>
  );
}
