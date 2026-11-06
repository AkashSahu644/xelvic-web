import { useEffect, useMemo, useState } from "react";
import { LoaderCircle, Lock, Users, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/overlays/Modal";
import { errorMessage } from "@/utils/errors";
import { uploadAsset } from "@/utils/upload";
import { useToast } from "@/hooks/useToast";
import { momentsService } from "@/services/moments.service";
import {
  audienceIds,
  audienceLabel,
  AudienceSheet,
  EVERYONE,
  type Audience,
} from "./AudienceSheet";

/**
 * The small sheet between an edited file and somebody's day.
 *
 * Ported from `_confirmMomentShare` in `moment_composer.dart`. The "+" and the
 * camera skip the composer on purpose — a picture off the roll is a moment
 * already — so the one choice the composer carried that they cannot is offered
 * here on its own: what is about to go up, the reach with its current label,
 * and a Share button. Dismissing it is backing out, and posts nothing.
 */

export interface MomentPick {
  file: File;
  kind: "image" | "video";
}

export function ShareMoment({
  open,
  picks,
  onClose,
  onPosted,
}: {
  open: boolean;
  picks: MomentPick[];
  onClose: () => void;
  onPosted: () => void;
}) {
  const [audience, setAudience] = useState<Audience>(EVERYONE);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setAudience(EVERYONE);
    setBusy(false);
    setStage("");
  }, [open]);

  const previews = useMemo(
    () => picks.map((pick) => ({ ...pick, url: URL.createObjectURL(pick.file) })),
    [picks],
  );
  useEffect(() => () => previews.forEach((row) => URL.revokeObjectURL(row.url)), [previews]);

  const photos = picks.filter((pick) => pick.kind === "image").length;
  const clips = picks.length - photos;
  const what =
    photos && clips
      ? `${photos} photo${photos === 1 ? "" : "s"} and ${clips} clip${clips === 1 ? "" : "s"}`
      : clips
        ? `${clips} clip${clips === 1 ? "" : "s"}`
        : `${photos} photo${photos === 1 ? "" : "s"}`;

  async function share() {
    if (busy || !picks.length) return;
    setBusy(true);
    try {
      const items: Record<string, unknown>[] = [];
      for (const [index, pick] of picks.entries()) {
        setStage(`Uploading ${index + 1} of ${picks.length}...`);
        const asset = await uploadAsset(pick.file);
        items.push({
          kind: pick.kind === "video" ? "video" : "image",
          asset: asset.id,
        });
      }
      setStage("Putting it up...");
      await momentsService.post({
        items,
        audience: audience.mode,
        ...(audience.mode === "everyone" ? {} : { audience_users: audienceIds(audience) }),
      });
      toast({ title: "Your moment is up", tone: "success" });
      onPosted();
      onClose();
    } catch (error) {
      toast({ title: "That moment did not post", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
      setStage("");
    }
  }

  const ReachIcon = audience.mode === "only" ? Lock : audience.mode === "except" ? EyeOff : Users;

  return (
    <>
      <Modal
        open={open}
        onClose={busy ? () => undefined : onClose}
        title="Share moment"
        description={`${what} goes up for a day, then it goes.`}
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 flex-1 truncate text-[11.5px] text-dim">{stage || what}</span>
            <Button onClick={() => void share()} loading={busy} disabled={!picks.length}>
              Share
            </Button>
          </div>
        }
      >
        <div className="space-y-3 p-5">
          <div className="no-scrollbar flex gap-2 overflow-x-auto">
            {previews.map((row, index) => (
              <span
                key={`${row.file.name}-${index}`}
                className="relative h-28 w-[84px] shrink-0 overflow-hidden rounded-[12px] border border-line bg-paper"
              >
                {row.kind === "image" ? (
                  <img src={row.url} alt="" className="h-full w-full object-cover" />
                ) : (
                  <video src={row.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                )}
              </span>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setAudienceOpen(true)}
            disabled={busy}
            className="flex w-full items-center gap-3 rounded-[14px] border border-line bg-paper px-3.5 py-3 text-left transition hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--line))]"
          >
            <ReachIcon className="size-5 shrink-0 text-accent" />
            <span className="min-w-0 flex-1">
              <span className="block text-[11.5px] text-dim">Who this is for</span>
              <span className="block text-[14.5px] font-semibold">{audienceLabel(audience)}</span>
            </span>
            <span className="text-[11.5px] font-bold text-dim">Change</span>
          </button>

          {busy ? (
            <p className="flex items-center gap-2 text-[12px] text-dim">
              <LoaderCircle className="size-4 animate-spin" /> {stage || "Putting it up..."}
            </p>
          ) : (
            <p className="text-[10px] leading-4 text-dim">
              Pictures and clips are checked before uploading. A moment is shown to the people your
              account already lets in, narrowed by the reach above when you pick one.
            </p>
          )}
        </div>
      </Modal>

      <AudienceSheet
        open={audienceOpen}
        value={audience}
        onClose={() => setAudienceOpen(false)}
        onPick={setAudience}
      />
    </>
  );
}