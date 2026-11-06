import { useEffect, useRef, useState } from "react";
import { ImagePlus, LoaderCircle, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/overlays/Modal";
import { cn } from "@/utils/cn";
import { errorMessage } from "@/utils/errors";
import { uploadAsset } from "@/utils/upload";
import { useToast } from "@/hooks/useToast";
import { momentsService } from "@/services/moments.service";
import type { Asset } from "@/types/api";
import {
  audienceIds,
  audienceLabel,
  AudienceSheet,
  EVERYONE,
  type Audience,
} from "./AudienceSheet";

/**
 * A moment that asks a question and counts the taps.
 *
 * Ported from `poll_moment.dart`. What leaves here is a single `poll` item put
 * up the way the composer puts one up — the question, the one-or-many choice,
 * and the options. There is no upload unless an option carries a picture, so
 * the send is one call and not a bar.
 *
 * Its own door beside Write, on the same rule: a poll is not a file off the
 * roll, so it is not reached by backing out of the picker.
 */

interface Option {
  key: number;
  text: string;
  image: File | null;
  preview: string | null;
}

const MIN_OPTIONS = 2;
const MAX_OPTIONS = 6;

function blankOption(key: number, text = ""): Option {
  return { key, text, image: null, preview: null };
}

let nextKey = 1;

export function PollMoment({
  open,
  onClose,
  onPosted,
}: {
  open: boolean;
  onClose: () => void;
  onPosted: () => void;
}) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<Option[]>([]);
  const [multi, setMulti] = useState(false);
  const [audience, setAudience] = useState<Audience>(EVERYONE);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const pickers = useRef(new Map<number, HTMLInputElement | null>());

  useEffect(() => {
    if (!open) return;
    setQuestion("");
    setOptions([blankOption(nextKey++), blankOption(nextKey++)]);
    setMulti(false);
    setAudience(EVERYONE);
    setBusy(false);
  }, [open]);

  // A preview is an object URL the browser will not free on its own.
  const previews = useRef(new Set<string>());
  useEffect(
    () => () => {
      previews.current.forEach((url) => URL.revokeObjectURL(url));
      previews.current.clear();
    },
    [],
  );

  const filled = options.filter((option) => option.text.trim());
  const ready = question.trim().length > 0 && filled.length >= MIN_OPTIONS;

  function setOption(key: number, change: Partial<Option>) {
    setOptions((current) => current.map((option) => (option.key === key ? { ...option, ...change } : option)));
  }

  function addOption() {
    if (options.length >= MAX_OPTIONS) return;
    setOptions((current) => [...current, blankOption(nextKey++)]);
  }

  function removeOption(key: number) {
    if (options.length <= MIN_OPTIONS) return;
    const gone = options.find((option) => option.key === key);
    if (gone?.preview) {
      URL.revokeObjectURL(gone.preview);
      previews.current.delete(gone.preview);
    }
    setOptions((current) => current.filter((option) => option.key !== key));
  }

  function givePicture(key: number, file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "An option picture has to be a photo.", tone: "error" });
      return;
    }
    const previous = options.find((option) => option.key === key)?.preview;
    if (previous) {
      URL.revokeObjectURL(previous);
      previews.current.delete(previous);
    }
    const preview = URL.createObjectURL(file);
    previews.current.add(preview);
    setOption(key, { image: file, preview });
  }

  async function post() {
    if (busy) return;
    if (!ready) {
      toast({ title: "Write a question and at least two options.", tone: "error" });
      return;
    }
    setBusy(true);
    try {
      const lines: { text: string; image?: string }[] = [];
      for (const option of filled) {
        let image: Asset | null = null;
        if (option.image) image = await uploadAsset(option.image);
        lines.push({ text: option.text.trim(), ...(image ? { image: image.id } : {}) });
      }
      await momentsService.post({
        items: [
          {
            kind: "poll",
            poll: { question: question.trim(), multi_select: multi, options: lines },
          },
        ],
        audience: audience.mode,
        ...(audience.mode === "everyone" ? {} : { audience_users: audienceIds(audience) }),
      });
      toast({ title: "Your poll is up", tone: "success" });
      onPosted();
      onClose();
    } catch (error) {
      toast({ title: "That poll did not post", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Modal open={open} onClose={busy ? () => undefined : onClose} size="full" hideClose>
        <div className="flex min-h-[100dvh] flex-col bg-paper">
          <header className="flex items-center gap-2 px-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="icon-btn"
              aria-label="Close"
            >
              <X className="size-5" />
            </button>
            <h1 className="min-w-0 flex-1 truncate text-[17px] font-extrabold">Ask a poll</h1>
            <button
              type="button"
              onClick={() => setAudienceOpen(true)}
              disabled={busy}
              className="rounded-full px-2.5 py-2 text-[12px] font-semibold text-ink transition hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]"
              aria-label={`Who this is for: ${audienceLabel(audience)}`}
            >
              {audienceLabel(audience)}
            </button>
            <Button onClick={() => void post()} loading={busy} disabled={!ready} size="sm" className="me-2">
              Put up
            </Button>
          </header>

          <div className="mx-auto w-full max-w-[640px] flex-1 space-y-3 px-4 py-4">
            <textarea
              value={question}
              onChange={(event) => setQuestion(event.target.value)}
              maxLength={200}
              rows={2}
              autoFocus
              placeholder="Ask something"
              aria-label="The question"
              className="field w-full resize-none text-[17px] font-bold leading-6"
            />

            {options.map((option, index) => (
              <div key={option.key} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => pickers.current.get(option.key)?.click()}
                  aria-label={option.preview ? "Change this option's picture" : "Put a picture on this option"}
                  className="relative flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-[12px] border border-line bg-card text-dim"
                >
                  {option.preview ? (
                    <img src={option.preview} alt="" className="size-12 object-cover" />
                  ) : (
                    <ImagePlus className="size-[18px]" />
                  )}
                </button>
                <input
                  ref={(node) => {
                    pickers.current.set(option.key, node);
                  }}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  tabIndex={-1}
                  aria-hidden
                  onChange={(event) => {
                    givePicture(option.key, event.target.files?.[0] ?? null);
                    event.target.value = "";
                  }}
                />
                <input
                  value={option.text}
                  onChange={(event) => setOption(option.key, { text: event.target.value })}
                  maxLength={80}
                  placeholder={`Option ${index + 1}`}
                  aria-label={`Option ${index + 1}`}
                  className="field h-11 min-w-0 flex-1"
                />
                {options.length > MIN_OPTIONS ? (
                  <button
                    type="button"
                    onClick={() => removeOption(option.key)}
                    className="icon-btn size-9 shrink-0"
                    aria-label={`Remove option ${index + 1}`}
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>
            ))}

            {options.length < MAX_OPTIONS ? (
              <button
                type="button"
                onClick={addOption}
                className="inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-[13px] font-bold text-accent transition hover:bg-[var(--accent-soft)]"
              >
                <Plus className="size-4" /> Add option
              </button>
            ) : null}

            <div className="flex items-center gap-2 pt-1">
              <ChoiceChip label="One choice" on={!multi} onClick={() => setMulti(false)} />
              <ChoiceChip label="Many choices" on={multi} onClick={() => setMulti(true)} />
            </div>
            <p className="text-[11.5px] leading-5 text-dim">
              {multi
                ? "People may pick more than one answer."
                : "People may pick one answer, and tapping it again takes the answer back."}
            </p>
            {busy ? (
              <p className="flex items-center gap-2 text-[12px] text-dim">
                <LoaderCircle className="size-4 animate-spin" /> Putting it up...
              </p>
            ) : null}
          </div>
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

function ChoiceChip({ label, on, onClick }: { label: string; on: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={on}
      className={cn(
        "rounded-full border px-3 py-1.5 text-[12px] font-bold transition",
        on ? "border-accent bg-[var(--accent-soft)] text-accent" : "border-line bg-card text-ink hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--line))]",
      )}
    >
      {label}
    </button>
  );
}