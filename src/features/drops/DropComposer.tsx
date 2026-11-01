import { useEffect, useMemo, useState, type FormEvent } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  Check,
  Clapperboard,
  Headphones,
  ImagePlus,
  Music2,
  Plus,
  ShieldAlert,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/errors";
import { uploadAsset } from "@/lib/upload";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import type { Asset, Drop, UserCard } from "@/types/api";
import { dropIsVibe } from "./model";

/**
 * The shapes a picture drop may reserve, as `kDropShapes` in the app has them.
 *
 * Empty is the picture's own shape and is where the chooser starts, so nothing
 * is cropped unless the poster asks for the crop. The key is what the wire
 * carries and the label is what the chip says.
 */
const shapes = [
  { key: "", label: "Original" },
  { key: "4/5", label: "Portrait" },
  { key: "1/1", label: "Square" },
  { key: "16/9", label: "Wide" },
  { key: "9/16", label: "Tall" },
];

/**
 * The lengths a poll may be left open for, as `kPollWindows` offers them.
 *
 * The server keeps a moment and takes a length, so a client may only ask for
 * one of these lengths rather than work out a date on its own clock. A week at
 * the outside: a question still collecting answers a month later is a question
 * nobody is thinking about.
 */
const windows = [
  { hours: null as number | null, label: "Never" },
  { hours: 1, label: "1 hour" },
  { hours: 24, label: "1 day" },
  { hours: 72, label: "3 days" },
  { hours: 168, label: "1 week" },
];

/** The shelves a sound names itself by — the app's `kSoundKinds`, in its order. */
const soundKinds = [
  { key: "general", label: "General" },
  { key: "music", label: "Music" },
  { key: "podcast", label: "Podcast" },
  { key: "news", label: "News" },
  { key: "story", label: "Story" },
  { key: "devotional", label: "Devotional" },
  { key: "sports", label: "Sports" },
  { key: "education", label: "Education" },
  { key: "tone", label: "Tone" },
  { key: "audiobook", label: "Audiobook" },
  { key: "interview", label: "Interview" },
  { key: "comedy", label: "Comedy" },
];

/** How many pictures and clips one drop may carry — `kDropGalleryLimit`. */
const GALLERY = 10;

export type ComposerMode = "drop" | "note" | "vibe" | "sound" | "poll";

/** One object URL for one chosen file, revoked when the choice changes. */
function useObjectUrl(file: File | null): string | null {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!file) {
      setUrl(null);
      return;
    }
    const made = URL.createObjectURL(file);
    setUrl(made);
    return () => URL.revokeObjectURL(made);
  }, [file]);
  return url;
}

/** The same, for a run of chosen files. */
function useObjectUrls(files: File[]): string[] {
  const [urls, setUrls] = useState<string[]>([]);
  useEffect(() => {
    const made = files.map((file) => URL.createObjectURL(file));
    setUrls(made);
    return () => made.forEach((url) => URL.revokeObjectURL(url));
  }, [files]);
  return urls;
}

/**
 * A person picker: a search box, the matches the server would accept, and the
 * people already chosen as chips above it.
 *
 * Nothing is added to what the search answers. A name that cannot be mentioned
 * — or cannot be asked onto a post — is a name that is not on the list rather
 * than one refused after it has been tapped.
 */
function PeoplePicker({
  label,
  line,
  hint,
  chosen,
  onAdd,
  onRemove,
  fetcher,
}: {
  label: string;
  line: string;
  hint: string;
  chosen: UserCard[];
  onAdd: (person: UserCard) => void;
  onRemove: (person: UserCard) => void;
  fetcher: (query: string) => Promise<UserCard[]>;
}) {
  const [query, setQuery] = useState("");
  const [settled, setSettled] = useState("");

  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(query.trim()), 320);
    return () => window.clearTimeout(timer);
  }, [query]);

  const search = useQuery({
    queryKey: ["people", label, settled],
    queryFn: () => fetcher(settled),
    enabled: settled.length >= 1,
    staleTime: 60_000,
  });

  const hits = useMemo(
    () =>
      (search.data ?? [])
        .filter((person) => !chosen.some((row) => String(row.id) === String(person.id)))
        .slice(0, 12),
    [search.data, chosen],
  );

  return (
    <div className="rounded-[14px] border border-line bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="flex items-center gap-1.5 text-[11px] font-extrabold">
          <Users className="size-3.5 text-accent" /> {label}
        </p>
        <span className="text-[9px] text-dim">{line}</span>
      </div>
      {chosen.length ? (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {chosen.map((person) => (
            <button
              key={String(person.id)}
              type="button"
              onClick={() => onRemove(person)}
              className="flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-2 py-1 text-[10.5px] font-bold"
              aria-label={`Remove ${person.name || person.username}`}
            >
              <Avatar user={person} size={18} />
              {person.name || person.username}
              <X className="size-3" />
            </button>
          ))}
        </div>
      ) : null}
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={hint}
        maxLength={40}
        className="field mt-2 min-h-9 py-1.5 text-[12px]"
      />
      {settled.length >= 1 ? (
        <div className="mt-2 max-h-[180px] overflow-y-auto rounded-[10px] border border-line">
          {search.isFetching && !hits.length ? (
            <p className="px-3 py-2 text-[10.5px] text-dim">Searching…</p>
          ) : hits.length ? (
            hits.map((person) => (
              <button
                key={String(person.id)}
                type="button"
                onClick={() => {
                  onAdd(person);
                  setQuery("");
                }}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
              >
                <Avatar user={person} size={28} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-semibold">{person.name || person.username}</span>
                  <span className="block truncate text-[10px] text-dim">@{person.username}</span>
                </span>
                <Plus className="size-3.5 text-dim" />
              </button>
            ))
          ) : (
            <p className="px-3 py-2 text-[10.5px] text-dim">{search.isError ? "That search did not come back." : "Nobody by that name."}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** One poll answer's picture, drawn at thumbnail size while it is chosen. */
function AnswerPicture({ file }: { file: File }) {
  const url = useObjectUrl(file);
  return url ? <img src={url} alt="" className="size-8 rounded-[6px] object-cover" /> : null;
}

type OptionDraft = { text: string; image: File | null };

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
  const sound = mode === "sound";
  const note = mode === "note";
  const [body, setBody] = useState("");
  // A drop's pictures, in the order they were chosen — the first is the card's
  // own face and the rest page behind it. A sound's cover and a picture's
  // soundtrack are separate files and separate questions.
  const [pictures, setPictures] = useState<File[]>([]);
  const [clip, setClip] = useState<File | null>(null);
  const [audio, setAudio] = useState<File | null>(null);
  const [cover, setCover] = useState<File | null>(null);
  const [track, setTrack] = useState<File | null>(null);
  const [trackTitle, setTrackTitle] = useState("");
  const [shape, setShape] = useState("");
  const [place, setPlace] = useState("");
  const [tag, setTag] = useState("");
  const [music, setMusic] = useState("");
  const [title, setTitle] = useState("");
  const [soundKind, setSoundKind] = useState("general");
  const [pollOn, setPollOn] = useState(poll);
  const [options, setOptions] = useState<OptionDraft[]>([
    { text: "", image: null },
    { text: "", image: null },
  ]);
  const [multiple, setMultiple] = useState(false);
  const [format, setFormat] = useState<"choice" | "arrange">("choice");
  const [hours, setHours] = useState<number | null>(24);
  const [tagged, setTagged] = useState<UserCard[]>([]);
  const [crew, setCrew] = useState<UserCard[]>([]);
  const [sensitive, setSensitive] = useState(false);
  const [busy, setBusy] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const pictureUrls = useObjectUrls(pictures);
  const clipUrl = useObjectUrl(clip);
  const coverUrl = useObjectUrl(cover);
  const trackUrl = useObjectUrl(track);
  const audioUrl = useObjectUrl(audio);

  useEffect(() => {
    if (!open) {
      setBusy(false);
      setStage(null);
      setError(null);
      return;
    }
    setPollOn(poll);
  }, [open, poll]);

  function reset() {
    setBody("");
    setPictures([]);
    setClip(null);
    setAudio(null);
    setCover(null);
    setTrack(null);
    setTrackTitle("");
    setShape("");
    setPlace("");
    setTag("");
    setMusic("");
    setTitle("");
    setSoundKind("general");
    setPollOn(poll);
    setOptions([
      { text: "", image: null },
      { text: "", image: null },
    ]);
    setMultiple(false);
    setFormat("choice");
    setHours(24);
    setTagged([]);
    setCrew([]);
    setSensitive(false);
    setStage(null);
    setError(null);
  }

  function addPictures(picked: FileList | null) {
    if (!picked?.length) return;
    const next: File[] = [];
    for (const file of Array.from(picked)) {
      if (!file.type.startsWith("image/")) {
        setError("A picture drop carries pictures. Choose image files.");
        continue;
      }
      if (file.size > 16 * 1024 * 1024) {
        setError("One of those pictures is larger than 16 MB.");
        continue;
      }
      next.push(file);
    }
    if (!next.length) return;
    setError(null);
    setPictures((current) => [...current, ...next].slice(0, GALLERY));
  }

  function pickClip(file: File | null) {
    if (!file) {
      setClip(null);
      return;
    }
    if (!file.type.startsWith("video/")) {
      setError("A Vibe is a short video. Choose a video file.");
      return;
    }
    if (file.size > 600 * 1024 * 1024) {
      setError("That clip is larger than 600 MB.");
      return;
    }
    setError(null);
    setClip(file);
  }

  function pickAudio(file: File | null) {
    if (!file) {
      setAudio(null);
      return;
    }
    if (!file.type.startsWith("audio/")) {
      setError("A sound is an audio file. Choose a recording.");
      return;
    }
    if (file.size > 200 * 1024 * 1024) {
      setError("That recording is larger than 200 MB.");
      return;
    }
    setError(null);
    setAudio(file);
  }

  /** Ask the chosen people onto the post that just went up. */
  async function invite(made: Drop) {
    if (!crew.length) return;
    try {
      await api.post("/collabs/", {
        // The route takes the post's kind as the key and its id as the value:
        // one post is named once, and a body naming both would be a body that
        // does not know what it is about.
        [dropIsVibe(made) ? "vibe" : "drop"]: made.id,
        users: crew.map((person) => person.id),
      });
    } catch (cause) {
      // The post is up and that half cannot be undone by this failing, so the
      // refusal is said out loud rather than thrown and the post is left as it
      // is. The app's own split, in `drop_post.dart`.
      toast({
        title: "The post is up, but the invitations did not go through",
        description: errorMessage(cause),
        tone: "error",
      });
    }
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy) return;
    const text = body.trim();
    const lines = options
      .map((option) => ({ text: option.text.trim(), image: option.image }))
      .filter((option) => option.text);

    if (vibe && !clip) {
      setError("Choose a clip for your Vibe first.");
      return;
    }
    if (sound && !audio) {
      setError("Choose an audio file first.");
      return;
    }
    if (sound && !title.trim()) {
      setError("A sound needs a name.");
      return;
    }
    if (poll) {
      if (!text) {
        setError("Write the question first.");
        return;
      }
      if (lines.length < 2) {
        setError("A poll needs at least two answers.");
        return;
      }
      if (format === "arrange" && lines.length < 2) {
        setError("An order needs at least two lines to put in order.");
        return;
      }
    } else if (note) {
      if (!text) {
        setError("Write something first.");
        return;
      }
    } else if (!vibe && !sound && !text && !pictures.length) {
      setError("Write something or add a picture first.");
      return;
    }
    if (!vibe && !sound && !poll && pollOn && lines.length < 2) {
      setError("A poll needs at least two answers.");
      return;
    }

    setBusy(true);
    setError(null);
    setStage("Getting ready…");
    try {
      if (vibe) {
        if (!clip) return;
        const asset = await uploadAsset(clip, { kind: "video" });
        const payload: Record<string, unknown> = { asset: asset.id, caption: text };
        if (music.trim()) payload.music = music.trim();
        if (tagged.length) payload.mentions = tagged.map((person) => person.id);
        if (sensitive) payload.sensitive = true;
        const response = await api.post<{ vibe: Drop }>("/drops/vibes/", payload);
        await invite(response.vibe);
        toast({ title: "Vibe posted", tone: "success" });
        reset();
        onCreated?.(response.vibe);
        onClose();
        return;
      }

      if (sound) {
        if (!audio) return;
        const asset = await uploadAsset(audio, { kind: "audio" });
        let coverId: string | undefined;
        if (cover) {
          setStage("Uploading the cover…");
          coverId = (await uploadAsset(cover, { kind: "image" })).id;
        }
        const payload: Record<string, unknown> = {
          body: text,
          title: title.trim(),
          asset: asset.id,
          sound_kind: soundKind,
        };
        if (coverId) payload.cover = coverId;
        if (tagged.length) payload.mentions = tagged.map((person) => person.id);
        if (sensitive) payload.sensitive = true;
        const response = await api.post<{ drop: Drop }>("/drops/", payload);
        await invite(response.drop);
        toast({ title: "Sound posted", tone: "success" });
        reset();
        onCreated?.(response.drop);
        onClose();
        return;
      }

      // A plain drop's pictures go up one at a time, in the order they were
      // chosen: the run's order is the card's order, so it is the poster's and
      // not the network's.
      const uploads: Asset[] = [];
      for (const [index, picture] of pictures.entries()) {
        setStage(pictures.length > 1 ? `Uploading picture ${index + 1} of ${pictures.length}…` : "Uploading the picture…");
        uploads.push(await uploadAsset(picture, { kind: "image" }));
      }

      let soundtrackId: string | undefined;
      if (!poll && track) {
        setStage("Uploading the sound…");
        soundtrackId = (await uploadAsset(track, { kind: "audio" })).id;
      }

      let pollBody: Record<string, unknown> | undefined;
      if (!vibe && !sound && (poll || pollOn)) {
        const answers: unknown[] = [];
        for (const [index, line] of lines.entries()) {
          if (!line.image) {
            answers.push(line.text);
            continue;
          }
          setStage(`Uploading answer ${index + 1}…`);
          const image = await uploadAsset(line.image, { kind: "image" });
          answers.push({ text: line.text, image: image.id });
        }
        pollBody = {
          options: answers,
          // Arrange has one right order, so it is single-answer by nature and
          // the any-number choice is not offered for it.
          multiple: format === "arrange" ? false : multiple,
          format,
          hours,
        };
      }

      const payload: Record<string, unknown> = { body: text };
      if (uploads.length === 1) {
        payload.asset = uploads[0].id;
        payload.aspect = shape;
      } else if (uploads.length > 1) {
        payload.assets = uploads.map((asset) => asset.id);
        payload.aspect = shape;
      }
      if (place.trim()) payload.place = place.trim();
      if (tag.trim()) payload.tag = tag.trim().toUpperCase();
      if (tagged.length) payload.mentions = tagged.map((person) => person.id);
      if (sensitive) payload.sensitive = true;
      if (soundtrackId) {
        payload.soundtrack = soundtrackId;
        if (trackTitle.trim()) payload.soundtrack_title = trackTitle.trim();
        payload.soundtrack_start_ms = 0;
        payload.soundtrack_end_ms = null;
      }
      if (pollBody) payload.poll = pollBody;

      setStage("Posting…");
      const response = await api.post<{ drop: Drop }>("/drops/", payload);
      await invite(response.drop);
      toast({ title: poll ? "Poll posted" : "Drop posted", tone: "success" });
      reset();
      onCreated?.(response.drop);
      onClose();
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
      setStage(null);
    }
  }

  const heading = vibe ? "New Vibe" : poll ? "New poll" : sound ? "New sound" : note ? "New note" : "New drop";
  const blurb = vibe
    ? "A short clip for the shelf."
    : poll
      ? "Ask the room."
      : sound
        ? "A recording, on its own shelf."
        : note
          ? "Words and nothing else."
          : "Say it, show it, or ask the room.";
  const posting = vibe ? "Posting a Vibe" : poll ? "Posting a poll" : sound ? "Posting a sound" : note ? "Posting a note" : "Posting to your drops";
  const ready = vibe ? Boolean(clip) : sound ? Boolean(audio) : poll || note ? body.trim().length > 0 : Boolean(body.trim() || pictures.length);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={heading}
      description={blurb}
      size="lg"
      footer={
        <div className="flex items-center justify-between gap-3 py-0.5">
          <p className="text-[10px] text-dim">{stage ?? `${body.length}/2200`}</p>
          <div className="flex gap-2">
            <Button variant="ghost" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              type="submit"
              form="drop-composer"
              size="sm"
              loading={busy}
              disabled={!ready}
            >
              {vibe || sound ? "Put it up" : poll ? "Post poll" : note ? "Post note" : "Post drop"}
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
            <p className="text-[9.5px] text-dim">{posting}</p>
          </div>
        </div>

        <label className="block">
          <span className="sr-only">{sound ? "About this sound" : poll ? "The question" : "Drop text"}</span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={
              vibe
                ? "Say something about it"
                : sound
                  ? "Say something about it"
                  : poll || pollOn
                    ? "Ask the question"
                    : "What is on your mind?"
            }
            rows={poll || pollOn ? 2 : 4}
            maxLength={2200}
            className="field min-h-[104px] resize-y text-[14px] leading-6"
          />
        </label>

        {vibe ? (
          clipUrl ? (
            <div className="relative overflow-hidden rounded-[14px] border border-line bg-black">
              <video src={clipUrl} controls playsInline muted className="mx-auto max-h-[380px] w-full object-contain" />
              <button
                type="button"
                onClick={() => pickClip(null)}
                className="absolute right-2 top-2 flex size-8 items-center justify-center rounded-full bg-[#13131A]/75 text-white backdrop-blur"
                aria-label="Remove clip"
              >
                <X className="size-4" />
              </button>
            </div>
          ) : null
        ) : null}

        {sound ? (
          <div className="space-y-2 rounded-[14px] border border-line bg-card p-3">
            {audioUrl ? (
              <div className="flex items-center gap-2">
                <Headphones className="size-4 text-accent" />
                <audio src={audioUrl} controls className="min-w-0 flex-1" />
                <button type="button" className="icon-btn size-8" onClick={() => pickAudio(null)} aria-label="Remove recording">
                  <X className="size-4" />
                </button>
              </div>
            ) : null}
            <label>
              <span className="field-label">Title</span>
              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                maxLength={140}
                placeholder="What is it called?"
                className="field min-h-10 py-2 text-[12px]"
              />
            </label>
            <div className="flex flex-wrap gap-1.5">
              {soundKinds.map((kind) => (
                <button
                  key={kind.key}
                  type="button"
                  onClick={() => setSoundKind(kind.key)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-[10px] font-bold transition",
                    soundKind === kind.key ? "border-accent bg-accent text-on-accent" : "border-line bg-card text-dim hover:text-ink",
                  )}
                >
                  {kind.label}
                </button>
              ))}
            </div>
          </div>
        ) : null}

        {!vibe && !sound && pictures.length ? (
          <div>
            <div className="grid grid-cols-3 gap-1.5">
              {pictures.map((picture, index) => (
                <div key={`${picture.name}-${index}`} className="relative overflow-hidden rounded-[10px] border border-line bg-black">
                  <img
                    src={pictureUrls[index]}
                    alt={`Picture ${index + 1}`}
                    className="h-[104px] w-full object-cover"
                  />
                  {index === 0 && pictures.length > 1 ? (
                    <span className="absolute start-1 top-1 rounded-full bg-black/70 px-1.5 py-0.5 text-[8.5px] font-bold text-white">
                      First
                    </span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => setPictures((current) => current.filter((_, position) => position !== index))}
                    className="absolute end-1 top-1 flex size-6 items-center justify-center rounded-full bg-black/70 text-white"
                    aria-label={`Remove picture ${index + 1}`}
                  >
                    <X className="size-3.5" />
                  </button>
                </div>
              ))}
              {pictures.length < GALLERY ? (
                <label className="flex h-[104px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px] border border-dashed border-line text-dim transition hover:text-ink">
                  <Plus className="size-4" />
                  <span className="text-[9px] font-bold">Add</span>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(event) => {
                      addPictures(event.target.files);
                      event.target.value = "";
                    }}
                  />
                </label>
              ) : null}
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {shapes.map((item) => (
                <button
                  key={item.key || "original"}
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
            </div>
            {pictures.length > 1 ? (
              <p className="mt-1.5 text-[9.5px] text-dim">
                {pictures.length} pictures page behind the first. {pictures.length === GALLERY ? "That is as many as one drop carries." : `${GALLERY - pictures.length} more would fit.`}
              </p>
            ) : null}
          </div>
        ) : null}

        {poll || pollOn ? (
          <div className="rounded-[14px] border border-line bg-[color-mix(in_srgb,var(--accent)_5%,var(--card))] p-3">
            <div className="flex items-center justify-between">
              <p className="flex items-center gap-1.5 text-[11px] font-extrabold"><BarChart3 className="size-3.5 text-accent" /> Poll answers</p>
              <span className="text-[9px] text-dim">
                {hours === null ? "Stays open" : windows.find((window) => window.hours === hours)?.label ?? "24 hours"}
              </span>
            </div>
            <div className="mt-2 space-y-2">
              {options.map((option, index) => (
                <div key={index} className="flex items-center gap-2">
                  <label className="flex size-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-[8px] border border-line bg-card text-dim">
                    {option.image ? (
                      <AnswerPicture file={option.image} />
                    ) : (
                      <ImagePlus className="size-3.5" />
                    )}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(event) => {
                        const image = event.target.files?.[0] ?? null;
                        setOptions((current) =>
                          current.map((row, position) => (position === index ? { ...row, image } : row)),
                        );
                        event.target.value = "";
                      }}
                    />
                  </label>
                  <input
                    value={option.text}
                    onChange={(event) => {
                      const text = event.target.value;
                      setOptions((current) =>
                        current.map((row, position) => (position === index ? { ...row, text } : row)),
                      );
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
            <div className="mt-2 flex flex-wrap items-center gap-2">
              {options.length < 4 ? (
                <button
                  type="button"
                  className="inline-flex items-center gap-1 text-[10.5px] font-bold text-accent"
                  onClick={() => setOptions([...options, { text: "", image: null }])}
                >
                  <Plus className="size-3" /> Add answer
                </button>
              ) : null}
              <div className="ml-auto flex items-center gap-1.5">
                {[
                  { key: "choice" as const, label: "Pick one" },
                  { key: "arrange" as const, label: "Put in order" },
                ].map((kind) => (
                  <button
                    key={kind.key}
                    type="button"
                    onClick={() => setFormat(kind.key)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[10px] font-bold transition",
                      format === kind.key ? "border-accent bg-accent text-on-accent" : "border-line bg-card text-dim hover:text-ink",
                    )}
                  >
                    {kind.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
              {format === "choice" ? (
                <label className="flex items-center gap-1.5 text-[10.5px] font-semibold text-dim">
                  <input type="checkbox" checked={multiple} onChange={(event) => setMultiple(event.target.checked)} className="accent-[var(--accent)]" />
                  Allow more than one
                </label>
              ) : (
                <span className="text-[10px] text-dim">Answers are put in order, so one answer is the rule.</span>
              )}
              <div className="ml-auto flex flex-wrap gap-1.5">
                {windows.map((window) => (
                  <button
                    key={String(window.hours)}
                    type="button"
                    onClick={() => setHours(window.hours)}
                    className={cn(
                      "rounded-full border px-2.5 py-1 text-[10px] font-bold transition",
                      hours === window.hours ? "border-accent bg-accent text-on-accent" : "border-line bg-card text-dim hover:text-ink",
                    )}
                  >
                    {window.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5">
          {vibe ? (
            <label className="chip cursor-pointer">
              <Clapperboard className="size-3.5" />
              {clip ? "Replace clip" : "Clip"}
              <input
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(event) => {
                  pickClip(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
            </label>
          ) : null}
          {!vibe && !sound && !note ? (
            <label className="chip cursor-pointer">
              <ImagePlus className="size-3.5" />
              Photo
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  addPictures(event.target.files);
                  event.target.value = "";
                }}
              />
            </label>
          ) : null}
          {sound ? (
            <label className="chip cursor-pointer">
              <Music2 className="size-3.5" />
              {audio ? "Replace recording" : "Recording"}
              <input
                type="file"
                accept="audio/*"
                className="hidden"
                onChange={(event) => {
                  pickAudio(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
            </label>
          ) : null}
          {!vibe && !sound && !poll && !note ? (
            <button
              type="button"
              className="chip"
              data-active={pollOn}
              onClick={() => setPollOn((value) => !value)}
            >
              <BarChart3 className="size-3.5" /> Poll
            </button>
          ) : null}
        </div>

        {sound ? (
          <label className="block">
            <span className="field-label">Cover <span className="font-normal opacity-60">optional</span></span>
            <div className="flex items-center gap-2">
              {coverUrl ? (
                <img src={coverUrl} alt="Chosen cover" className="size-10 rounded-[8px] object-cover" />
              ) : null}
              <label className="chip cursor-pointer">
                <ImagePlus className="size-3.5" />
                {cover ? "Replace cover" : "Add a cover"}
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(event) => {
                    setCover(event.target.files?.[0] ?? null);
                    event.target.value = "";
                  }}
                />
              </label>
              {cover ? (
                <button type="button" className="text-[10px] font-bold text-dim hover:text-ink" onClick={() => setCover(null)}>
                  Take it off
                </button>
              ) : null}
            </div>
          </label>
        ) : null}

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
        ) : null}

        {!vibe && !sound && !poll ? (
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
        ) : null}

        {!vibe && !sound && !poll && trackUrl ? (
          <div className="rounded-[12px] border border-line bg-card p-3">
            <div className="flex items-center gap-2">
              <Music2 className="size-4 text-accent" />
              <audio src={trackUrl} controls className="min-w-0 flex-1" />
              <button type="button" className="icon-btn size-8" onClick={() => setTrack(null)} aria-label="Remove the sound">
                <X className="size-4" />
              </button>
            </div>
            <input
              value={trackTitle}
              onChange={(event) => setTrackTitle(event.target.value)}
              maxLength={120}
              placeholder="What is it called?"
              className="field mt-2 min-h-9 py-1.5 text-[12px]"
            />
          </div>
        ) : null}

        {!vibe && !sound && !poll && pictures.length ? (
          <label className="chip cursor-pointer">
            <Music2 className="size-3.5" />
            {track ? "Replace the sound" : "Sound behind it"}
            <input
              type="file"
              accept="audio/*"
              className="hidden"
              onChange={(event) => {
                setTrack(event.target.files?.[0] ?? null);
                event.target.value = "";
              }}
            />
          </label>
        ) : null}

        <PeoplePicker
          label="Tag people"
          line="on the post"
          hint="Search a name or @handle"
          chosen={tagged}
          onAdd={(person) => setTagged((current) => [...current, person])}
          onRemove={(person) => setTagged((current) => current.filter((row) => String(row.id) !== String(person.id)))}
          fetcher={(query) => api.get<UserCard[]>("/social/mentionable/", { query: { q: query } })}
        />

        {!poll ? (
          <PeoplePicker
            label="Collaborate"
            line="asked onto it"
            hint="Search who to ask"
            chosen={crew}
            onAdd={(person) => setCrew((current) => [...current, person])}
            onRemove={(person) => setCrew((current) => current.filter((row) => String(row.id) !== String(person.id)))}
            fetcher={(query) =>
              api
                .get<{ people: UserCard[] }>("/collabs/people/", { query: { q: query } })
                .then((answer) => answer.people ?? [])
            }
          />
        ) : null}

        <button
          type="button"
          onClick={() => setSensitive((value) => !value)}
          aria-pressed={sensitive}
          className={cn(
            "flex w-full items-start gap-2.5 rounded-[12px] border p-3 text-left transition",
            sensitive ? "border-[var(--bad)] bg-[color-mix(in_srgb,var(--bad)_7%,transparent)]" : "border-line bg-card",
          )}
        >
          <span className={cn("mt-0.5 flex size-5 items-center justify-center rounded-[6px] border", sensitive ? "border-[var(--bad)] bg-[var(--bad)] text-white" : "border-line")}>
            {sensitive ? <Check className="size-3.5" /> : null}
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

        {error ? <p className="rounded-[10px] bg-[color-mix(in_srgb,var(--bad)_8%,transparent)] px-3 py-2 text-[11px] text-[var(--bad)]">{error}</p> : null}
      </form>
    </Modal>
  );
}