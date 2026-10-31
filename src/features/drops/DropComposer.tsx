import { useEffect, useRef, useState, type FormEvent } from "react";
import { BarChart3, Clapperboard, ImagePlus, Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/errors";
import { uploadAsset } from "@/lib/upload";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import type { Drop } from "@/types/api";

const shapes = [
  { key: "4/5", label: "Portrait" },
  { key: "1/1", label: "Square" },
  { key: "16/9", label: "Wide" },
];

export type ComposerMode = "drop" | "vibe" | "poll";

export function DropComposer({
  open,
  mode = "drop",
  onClose,
  onCreated,
}: {
  open: boolean;
  mode?: ComposerMode;
  onClose: () => void;
  onCreated?: (drop: Drop) => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const vibe = mode === "vibe";
  const poll = mode === "poll";
  const [body, setBody] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [shape, setShape] = useState("4/5");
  const [place, setPlace] = useState("");
  const [tag, setTag] = useState("");
  const [music, setMusic] = useState("");
  const [pollOn, setPollOn] = useState(poll);
  const [options, setOptions] = useState(["", ""]);
  const [multiple, setMultiple] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  useEffect(() => {
    if (!open) {
      setBusy(false);
      setError(null);
      return;
    }
    setPollOn(poll);
  }, [open, poll]);

  function pick(next: File | null) {
    if (!next) {
      setFile(null);
      return;
    }
    if (vibe ? !next.type.startsWith("video/") : !next.type.startsWith("image/")) {
      setError(vibe ? "A Vibe is a short video. Choose a video file." : "A drop can carry a picture. Choose an image file.");
      return;
    }
    const limit = vibe ? 600 * 1024 * 1024 : 16 * 1024 * 1024;
    if (next.size > limit) {
      setError(vibe ? "That clip is larger than 600 MB." : "That picture is larger than 16 MB.");
      return;
    }
    setError(null);
    setFile(next);
  }

  function reset() {
    setBody("");
    setFile(null);
    setShape("4/5");
    setPlace("");
    setTag("");
    setMusic("");
    setPollOn(poll);
    setOptions(["", ""]);
    setMultiple(false);
    setError(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const text = body.trim();
    const cleanedOptions = options.map((option) => option.trim()).filter(Boolean);
    if (vibe) {
      if (!file) {
        setError("Choose a clip for your Vibe first.");
        return;
      }
    } else if (poll) {
      if (!text) {
        setError("Write the question first.");
        return;
      }
      if (cleanedOptions.length < 2) {
        setError("A poll needs at least two answers.");
        return;
      }
    } else if (!text && !file) {
      setError("Write something or add a picture first.");
      return;
    }
    if (!vibe && pollOn && cleanedOptions.length < 2) {
      setError("A poll needs at least two answers.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (vibe) {
        if (!file) return;
        const asset = await uploadAsset(file, { kind: "video" });
        const payload: Record<string, unknown> = { asset: asset.id, caption: text };
        if (music.trim()) payload.music = music.trim();
        const response = await api.post<{ vibe: Drop }>("/drops/vibes/", payload);
        toast({ title: "Vibe posted", tone: "success" });
        reset();
        onCreated?.(response.vibe);
        onClose();
        return;
      }

      let assetId: string | undefined;
      if (file) {
        const asset = await uploadAsset(file, { kind: "image" });
        assetId = asset.id;
      }
      const payload: Record<string, unknown> = { body: text };
      if (assetId) {
        payload.asset = assetId;
        payload.aspect = shape;
      }
      if (place.trim()) payload.place = place.trim();
      if (tag.trim()) payload.tag = tag.trim().toUpperCase();
      if (poll || pollOn) payload.poll = { options: cleanedOptions, multiple, hours: 24 };
      if (poll || pollOn) payload.poll = { options: cleanedOptions, multiple, hours: 24 };
      const response = await api.post<{ drop: Drop }>("/drops/", payload);
      toast({ title: poll ? "Poll posted" : "Drop posted", tone: "success" });
      reset();
      onCreated?.(response.drop);
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={vibe ? "New Vibe" : poll ? "New poll" : "New drop"}
      description={vibe ? "A short clip for the shelf." : poll ? "Ask the room." : "Say it, show it, or ask the room."}
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3 py-0.5">
          <p className="text-[10px] text-dim">{body.length}/2200</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="drop-composer"
              size="sm"
              loading={busy}
              disabled={vibe ? !file : !body.trim() && !file}
            >
              {vibe ? "Put it up" : poll ? "Post poll" : "Post drop"}
            </Button>
          </div>
        </div>
      }
    >
      <form id="drop-composer" onSubmit={submit} className="space-y-4 px-4 py-4 sm:px-5">
        <div className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-full bg-[var(--accent-soft)] text-[12px] font-extrabold text-accent">
            {user?.initials || user?.name?.slice(0, 1) || "?"}
          </span>
          <div>
            <p className="text-[12px] font-extrabold">{user?.name || user?.username}</p>
            <p className="text-[9.5px] text-dim">
              {vibe ? "Posting a Vibe" : poll ? "Posting a poll" : "Posting to your drops"}
            </p>
          </div>
        </div>

        <label className="block">
          <span className="sr-only">Drop text</span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={vibe ? "Say something about it" : poll || pollOn ? "Ask the question" : "What is on your mind?"}
            rows={poll || pollOn ? 2 : 4}
            maxLength={2200}
            className="field min-h-[104px] resize-y text-[14px] leading-6"
          />
        </label>

        {preview ? (
          <div className="relative overflow-hidden rounded-[14px] border border-line bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]">
            {vibe ? (
              <video
                src={preview}
                controls
                playsInline
                muted
                className="mx-auto max-h-[380px] w-full bg-black object-contain"
              />
            ) : (
              <img
                src={preview}
                alt="Selected picture"
                className="mx-auto w-full object-contain"
                style={{ aspectRatio: shape.replace("/", " / "), maxHeight: 380 }}
              />
            )}
            <button
              type="button"
              onClick={() => pick(null)}
              className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-[#13131A]/75 text-white backdrop-blur"
              aria-label={vibe ? "Remove clip" : "Remove picture"}
            >
              <X className="size-4" />
            </button>
            <div className="flex flex-wrap gap-1.5 border-t border-line bg-card p-2">
              {vibe ? null : shapes.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setShape(item.key)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] font-bold transition",
                    shape === item.key ? "border-accent bg-accent text-on-accent" : "border-line bg-card text-dim hover:text-ink",
                  )}
                >
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => inputRef.current?.click()}
                className="ml-auto rounded-full px-2 py-1 text-[10px] font-bold text-dim hover:text-ink"
              >
                Replace
              </button>
            </div>
          </div>
        ) : null}

        {poll || pollOn ? (
          <div className="rounded-[14px] border border-line bg-[color-mix(in_srgb,var(--accent)_5%,var(--card))] p-3">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[11px] font-extrabold"><BarChart3 className="size-3.5 text-accent" /> Poll answers</p>
              <span className="text-[9px] text-dim">Closes in 24 hours</span>
            </div>
            <div className="mt-2 space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    value={option}
                    onChange={(event) => {
                      const next = [...options];
                      next[index] = event.target.value;
                      setOptions(next);
                    }}
                    placeholder={`Answer ${index + 1}`}
                    maxLength={80}
                    className="field min-h-9 flex-1 py-1.5 text-[12px]"
                  />
                  {options.length > 2 ? (
                    <button
                      type="button"
                      className="icon-btn size-9"
                      onClick={() => setOptions(options.filter((_, position) => position !== index))}
                      aria-label={`Remove answer ${index + 1}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center gap-3">
              {options.length < 4 ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[10.5px] font-bold text-accent"
                  onClick={() => setOptions([...options, ""])}
                >
                  <Plus className="size-3" /> Add answer
                </button>
              ) : null}
              <label className="ml-auto flex items-center gap-1.5 text-[10.5px] font-semibold text-dim">
                <input type="checkbox" checked={multiple} onChange={(event) => setMultiple(event.target.checked)} className="accent-[var(--accent)]" />
                Allow more than one
              </label>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          <input
            ref={inputRef}
            type="file"
            accept={vibe ? "video/*" : "image/*"}
            className="hidden"
            onChange={(event) => pick(event.target.files?.[0] ?? null)}
          />
          <button type="button" className="chip" onClick={() => inputRef.current?.click()}>
            {vibe ? <Clapperboard className="size-3.5" /> : <ImagePlus className="size-3.5" />}
            {vibe ? "Clip" : "Photo"}
          </button>
          {vibe || poll ? null : (
            <button
              type="button"
              className="chip"
              data-active={pollOn}
              onClick={() => setPollOn((value) => !value)}
            >
              <BarChart3 className="size-3.5" /> Poll
            </button>
          )}
        </div>

        {vibe ? (
          <label>
            <span className="field-label">Sound <span className="font-normal opacity-60">optional</span></span>
            <input
              value={music}
              onChange={(event) => setMusic(event.target.value)}
              maxLength={80}
              placeholder="Track — artist"
              className="field min-h-10 py-2 text-[12px]"
            />
          </label>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <label>
              <span className="field-label">Place <span className="font-normal opacity-60">optional</span></span>
              <input value={place} onChange={(event) => setPlace(event.target.value)} maxLength={60} placeholder="Where was this?" className="field min-h-10 py-2 text-[12px]" />
            </label>
            <label>
              <span className="field-label">Tag <span className="font-normal opacity-60">optional</span></span>
              <input value={tag} onChange={(event) => setTag(event.target.value)} maxLength={20} placeholder="A word for it" className="field min-h-10 py-2 text-[12px] uppercase" />
            </label>
          </div>
        )}

        {error ? <p className="rounded-[10px] bg-[color-mix(in_srgb,var(--bad)_8%,transparent)] px-3 py-2 text-[11px] text-[var(--bad)]">{error}</p> : null}
      </form>
    </Modal>
  );
}
