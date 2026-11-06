import { useEffect, useMemo, useRef, useState } from "react";
import { AtSign, Check, ImagePlus, LoaderCircle, ShieldAlert, Users, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/overlays/Modal";
import { cn } from "@/utils/cn";
import { errorMessage } from "@/utils/errors";
import { uploadAsset } from "@/utils/upload";
import { useToast } from "@/hooks/useToast";
import { momentsService } from "@/services/moments.service";
import type { UserCard } from "@/types/api";
import {
  audienceIds,
  audienceLabel,
  AudienceSheet,
  EVERYONE,
  MentionSheet,
  type Audience,
} from "./AudienceSheet";
import type { MomentPick } from "./ShareMoment";

/**
 * A moment put together out of several pieces, with words offered under them.
 *
 * The app's `MomentComposerBody` is the one composer the phone has, and this is
 * the web's answer to the same screen: pictures and clips chosen from the
 * roll, each of which has already been through the editor before it arrives
 * here, a caption that rides on the first piece, the people it names, the reach
 * for this one moment, and the mark that asks readers before a graphic thing is
 * drawn.
 *
 * What it deliberately does not draw is the old editor panel — filter radios,
 * crop sliders and sticker tiles whose handlers were empty and whose Apply
 * wrote nothing. Every control here is a request or an edit that lands: the
 * pixels are edited in the camera's own editor before the file reaches this
 * sheet, and the words, the names, the reach and the mark are fields the
 * server is sent.
 */
export function ComposeMoment({
  open,
  onClose,
  onPosted,
  seed = [],
}: {
  open: boolean;
  onClose: () => void;
  onPosted: () => void;
  seed?: File[];
}) {
  const [picks, setPicks] = useState<MomentPick[]>([]);
  const [caption, setCaption] = useState("");
  const [people, setPeople] = useState<UserCard[]>([]);
  const [audience, setAudience] = useState<Audience>(EVERYONE);
  const [sensitive, setSensitive] = useState(false);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const previews = useMemo(
    () =>
      picks.map((pick, index) => ({
        ...pick,
        key: `${index}-${pick.file.name}-${pick.file.size}`,
        url: URL.createObjectURL(pick.file),
      })),
    [picks],
  );
  useEffect(() => () => previews.forEach((row) => URL.revokeObjectURL(row.url)), [previews]);

  useEffect(() => {
    if (!open) return;
    setPicks(
      seed.map((file) => ({
        file,
        kind: file.type.startsWith("video/") ? ("video" as const) : ("image" as const),
      })),
    );
    setCaption("");
    setPeople([]);
    setAudience(EVERYONE);
    setSensitive(false);
    setBusy(false);
    setStage("");
  }, [open, seed]);

  function addFiles(files: File[]) {
    if (!files.length) return;
    setPicks((current) => [
      ...current,
      ...files.slice(0, 6 - current.length).map((file) => ({
        file,
        kind: file.type.startsWith("video/") ? ("video" as const) : ("image" as const),
      })),
    ]);
  }

  async function post() {
    if (busy) return;
    if (!picks.length && !caption.trim()) {
      toast({ title: "Put something in the frame", description: "Words, a picture, or a clip.", tone: "info" });
      return;
    }
    setBusy(true);
    try {
      const items: Record<string, unknown>[] = [];
      for (const [index, pick] of picks.entries()) {
        setStage(`Uploading ${index + 1} of ${picks.length}...`);
        const asset = await uploadAsset(pick.file);
        items.push({
          kind: pick.kind === "video" ? "video" : "image",
          asset: asset.id,
          ...(index === 0 && caption.trim() ? { body: caption.trim() } : {}),
          ...(people.length ? { mentions: people.map((person) => person.id) } : {}),
        });
      }
      if (!items.length) items.push({ kind: "text", body: caption.trim() });
      setStage("Putting it up...");
      await momentsService.post({
        items,
        audience: audience.mode,
        ...(audience.mode === "everyone" ? {} : { audience_users: audienceIds(audience) }),
        ...(sensitive ? { sensitive: true } : {}),
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

  return (
    <>
      <Modal
        open={open}
        onClose={busy ? () => undefined : onClose}
        title="New moment"
        description="Pictures and clips, with words under them. It stays for the day."
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="min-w-0 flex-1 truncate text-[11px] text-dim">
              {stage || (picks.length ? `${picks.length} of 6 pieces` : "Camera, library, or words")}
            </span>
            <Button onClick={() => void post()} loading={busy} icon={<ImagePlus className="size-4" />}>
              Put up
            </Button>
          </div>
        }
      >
        <div className="space-y-3 p-5">
          {previews.length ? (
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
              {previews.map((row, index) => (
                <span key={row.key} className="relative aspect-square overflow-hidden rounded-[10px] border border-line bg-paper">
                  {row.kind === "image" ? (
                    <img src={row.url} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <video src={row.url} className="h-full w-full object-cover" muted playsInline preload="metadata" />
                  )}
                  <button
                    type="button"
                    onClick={() => setPicks((current) => current.filter((_, at) => at !== index))}
                    disabled={busy}
                    className="absolute right-0.5 top-0.5 flex size-5 items-center justify-center rounded-full bg-black/65 text-white"
                    aria-label={`Remove piece ${index + 1}`}
                  >
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
          ) : null}

          <textarea
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            maxLength={2200}
            rows={3}
            placeholder={picks.length ? "Say something under it..." : "Write it in the frame..."}
            className="w-full resize-none rounded-[14px] border border-line bg-paper p-3.5 text-sm leading-6 outline-none transition placeholder:text-dim focus:border-accent"
          />

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => input.current?.click()}
              disabled={busy || picks.length >= 6}
              className="btn btn-secondary min-h-9"
            >
              <ImagePlus className="size-4" /> {picks.length ? "Add another" : "Choose from library"}
            </button>
            <button
              type="button"
              onClick={() => setMentionOpen(true)}
              disabled={busy}
              className={cn("btn min-h-9", people.length ? "btn-primary" : "btn-secondary")}
            >
              <AtSign className="size-4" />
              {people.length ? people.map((person) => `@${person.username}`).join(", ") : "Name people"}
            </button>
          </div>

          <input
            ref={input}
            type="file"
            accept="image/*,video/*"
            multiple
            className="sr-only"
            onChange={(event) => {
              addFiles(Array.from(event.target.files ?? []));
              event.target.value = "";
            }}
          />

          <button
            type="button"
            onClick={() => setAudienceOpen(true)}
            disabled={busy}
            className="flex w-full items-center gap-3 rounded-[14px] border border-line bg-paper px-3.5 py-3 text-left transition hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--line))]"
          >
            <Users className="size-5 shrink-0 text-accent" />
            <span className="min-w-0 flex-1">
              <span className="block text-[11.5px] text-dim">Who this is for</span>
              <span className="block text-[14.5px] font-semibold">{audienceLabel(audience)}</span>
            </span>
            <span className="text-[11.5px] font-bold text-dim">Change</span>
          </button>

          <button
            type="button"
            onClick={() => setSensitive((value) => !value)}
            aria-pressed={sensitive}
            disabled={busy}
            className={cn(
              "flex w-full items-start gap-2.5 rounded-[12px] border p-3 text-left transition",
              sensitive
                ? "border-[var(--bad)] bg-[color-mix(in_srgb,var(--bad)_7%,transparent)]"
                : "border-line bg-card",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex size-5 items-center justify-center rounded-[6px] border",
                sensitive ? "border-[var(--bad)] bg-[var(--bad)] text-white" : "border-line",
              )}
            >
              {sensitive ? <Check className="size-3.5" aria-hidden /> : null}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-[11.5px] font-extrabold">
                <ShieldAlert className="size-3.5" /> Mark as sensitive
              </span>
              <span className="mt-0.5 block text-[10px] text-dim">
                Adult, violent or graphic. Readers are asked before it is drawn.
              </span>
            </span>
          </button>

          <p className="text-[10px] leading-4 text-dim">
            Pictures and clips are checked before uploading. A moment is shown to the people your
            account already lets in, narrowed by the reach above when you pick one.
          </p>

          {busy ? (
            <p className="flex items-center gap-2 text-[12px] text-dim">
              <LoaderCircle className="size-4 animate-spin" /> {stage || "Putting it up..."}
            </p>
          ) : null}
        </div>
      </Modal>

      <AudienceSheet
        open={audienceOpen}
        value={audience}
        onClose={() => setAudienceOpen(false)}
        onPick={setAudience}
      />
      <MentionSheet
        open={mentionOpen}
        chosen={people}
        onClose={() => setMentionOpen(false)}
        onPick={setPeople}
      />
    </>
  );
}