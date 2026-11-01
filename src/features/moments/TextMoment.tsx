import { useEffect, useRef, useState } from "react";
import { AtSign, LoaderCircle, X } from "lucide-react";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/errors";
import { uploadAsset } from "@/lib/upload";
import { useToast } from "@/providers/ToastProvider";
import type { UserCard } from "@/types/api";
import {
  audienceIds,
  audienceLabel,
  AudienceSheet,
  EVERYONE,
  MentionSheet,
  type Audience,
} from "./AudienceSheet";

/**
 * A moment that is nothing but words on a colour.
 *
 * Ported from `screens/text_moment.dart`. The note the composer used to write
 * went up as a `text` item — white words on a black page the viewer drew for
 * it. This is the same intent given a card of its own: a background somebody
 * chooses, an ink colour to go with it, and the words in the middle.
 *
 * What leaves here is not a `text` item at all but a picture. The card is
 * painted into a PNG and put up the same way a photograph is, so the colour a
 * person chose is a fact about the pixels rather than a pair of fields every
 * surface would have to learn to draw. The one thing kept from the old note is
 * the reach: a text card is for everyone unless its author says otherwise.
 */

/** The backgrounds a card may take — solid tones only, as the app has them. */
const BACKGROUNDS = [
  "#1E1E2E",
  "#6C5CE7",
  "#0984E3",
  "#00B894",
  "#E17055",
  "#D63031",
  "#E84393",
  "#FDCB6E",
  "#2D3436",
  "#F5F6FA",
];

/** The colours the words themselves may take. */
const INKS = ["#FFFFFF", "#000000", "#FDCB6E", "#2D3436"];

/** The card's own page, in the pixels it is painted at — `kTextCard*`. */
const CARD_WIDTH = 1080;
const CARD_HEIGHT = 1920;
const CARD_PAD = 96;

/** The size the words are set at, stepping down as they grow — `_cardFontSize`. */
function cardFontSize(text: string): number {
  return text.length > 180 ? 46 : text.length > 90 ? 58 : text.length > 30 ? 72 : 88;
}

function relativeLuminance(hex: string): number {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean, 16);
  if (!Number.isFinite(value)) return 0;
  const r = ((value >> 16) & 255) / 255;
  const g = ((value >> 8) & 255) / 255;
  const b = (value & 255) / 255;
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Paint the words on the colour and answer the file.
 *
 * A phone-shaped 1080×1920 page: the background fills it, the words are laid
 * out centred and wrapped, and the whole thing is centred vertically. The size
 * is fixed rather than the screen's own so the card is the same picture
 * whatever it was composed on. The font steps down as the words grow, the way
 * a status card does, so a sentence and a paragraph both fill the frame.
 *
 * The wrap is done by hand rather than by trusting the browser's own line
 * breaking, because the card is painted at one size and read at another: the
 * lines drawn here are the lines in the file.
 */
async function renderTextCard(text: string, background: string, ink: string): Promise<File> {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_WIDTH;
  canvas.height = CARD_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("The card would not paint.");

  context.fillStyle = background;
  context.fillRect(0, 0, CARD_WIDTH, CARD_HEIGHT);

  const size = cardFontSize(text);
  context.font = `600 ${size}px "Inter", system-ui, -apple-system, "Segoe UI", sans-serif`;
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillStyle = ink;

  const column = CARD_WIDTH - CARD_PAD * 2;
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (!words.length) {
      lines.push("");
      continue;
    }
    let line = "";
    for (const word of words) {
      const attempt = line ? `${line} ${word}` : word;
      if (line && context.measureText(attempt).width > column) {
        lines.push(line);
        line = word;
      } else {
        line = attempt;
      }
    }
    lines.push(line);
  }

  const lineHeight = size * 1.3;
  const height = lines.length * lineHeight;
  const top = Math.min(Math.max((CARD_HEIGHT - height) / 2, CARD_PAD), CARD_HEIGHT - CARD_PAD);
  lines.forEach((line, index) => {
    if (!line) return;
    context.fillText(line, CARD_WIDTH / 2, top + lineHeight / 2 + index * lineHeight);
  });

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (value) => (value ? resolve(value) : reject(new Error("The card would not encode."))),
      "image/png",
    );
  });
  return new File([blob], "text-moment.png", { type: "image/png" });
}

export function TextMoment({
  open,
  onClose,
  onPosted,
}: {
  open: boolean;
  onClose: () => void;
  onPosted: () => void;
}) {
  const [text, setText] = useState("");
  const [background, setBackground] = useState(BACKGROUNDS[0]);
  const [ink, setInk] = useState(INKS[0]);
  const [people, setPeople] = useState<UserCard[]>([]);
  const [audience, setAudience] = useState<Audience>(EVERYONE);
  const [audienceOpen, setAudienceOpen] = useState(false);
  const [mentionOpen, setMentionOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const field = useRef<HTMLTextAreaElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (!open) return;
    setText("");
    setBackground(BACKGROUNDS[0]);
    setInk(INKS[0]);
    setPeople([]);
    setAudience(EVERYONE);
    setBusy(false);
    const timer = window.setTimeout(() => field.current?.focus(), 80);
    return () => window.clearTimeout(timer);
  }, [open]);

  const onDark = relativeLuminance(background) < 0.55;
  const furniture = onDark ? "#FFFFFF" : "rgba(0,0,0,0.82)";

  async function post() {
    const words = text.trim();
    if (!words) {
      toast({ title: "Write something first", description: "A card with no words on it is a colour.", tone: "info" });
      field.current?.focus();
      return;
    }
    if (busy) return;
    setBusy(true);
    try {
      const file = await renderTextCard(words, background, ink);
      const asset = await uploadAsset(file);
      await api.post("/moments/", {
        items: [{ kind: "image", asset: asset.id, ...(people.length ? { mentions: people.map((person) => person.id) } : {}) }],
        audience: audience.mode,
        ...(audience.mode === "everyone" ? {} : { audience_users: audienceIds(audience) }),
      });
      toast({ title: "Your card is up", tone: "success" });
      onPosted();
      onClose();
    } catch (error) {
      toast({ title: "That card did not post", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Modal
        open={open}
        onClose={busy ? () => undefined : onClose}
        size="full"
        hideClose
        className="bg-[var(--card)]"
      >
        <div className="flex h-full min-h-[100dvh] flex-col" style={{ backgroundColor: background, color: furniture }}>
          <div className="flex items-center gap-2 px-2 pt-[max(0.5rem,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={onClose}
              disabled={busy}
              className="flex size-10 items-center justify-center rounded-full transition hover:bg-[color-mix(in_srgb,currentColor_12%,transparent)]"
              aria-label="Close"
              style={{ color: furniture }}
            >
              <X className="size-5" />
            </button>
            <span className="flex-1" />
            <button
              type="button"
              onClick={() => setAudienceOpen(true)}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full px-3 py-2 text-[12.5px] font-semibold transition hover:bg-[color-mix(in_srgb,currentColor_10%,transparent)]"
              style={{ color: furniture }}
            >
              {audience.mode === "only" ? <span aria-hidden>🔒</span> : audience.mode === "except" ? <span aria-hidden>🙈</span> : <span aria-hidden>🌐</span>}
              {audienceLabel(audience)}
            </button>
            <Button
              onClick={() => void post()}
              loading={busy}
              size="sm"
              className="me-2"
            >
              Put up
            </Button>
          </div>

          <div className="flex min-h-0 flex-1 items-center justify-center px-7">
            <textarea
              ref={field}
              value={text}
              onChange={(event) => setText(event.target.value)}
              maxLength={2200}
              rows={4}
              placeholder="Write it in the frame..."
              aria-label="The words on the card"
              className="max-h-full w-full resize-none bg-transparent text-center text-[28px] font-semibold leading-[1.3] outline-none placeholder:opacity-40"
              style={{ color: ink, caretColor: ink }}
            />
          </div>

          <button
            type="button"
            onClick={() => setMentionOpen(true)}
            disabled={busy}
            className="flex items-center gap-1.5 px-4 py-1.5 text-left text-[13px] font-semibold"
            style={{ color: people.length ? furniture : `${furniture}99` }}
          >
            <AtSign className="size-[15px] shrink-0" />
            <span className="truncate">
              {people.length ? people.map((person) => `@${person.username}`).join(", ") : "Put somebody in it"}
            </span>
          </button>

          <Palette
            label="Background"
            colours={BACKGROUNDS}
            selected={background}
            furniture={furniture}
            disabled={busy}
            onPick={setBackground}
          />
          <Palette
            label="Text"
            colours={INKS}
            selected={ink}
            furniture={furniture}
            disabled={busy}
            onPick={setInk}
          />
          <div className="h-2" />
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

function Palette({
  label,
  colours,
  selected,
  furniture,
  disabled,
  onPick,
}: {
  label: string;
  colours: string[];
  selected: string;
  furniture: string;
  disabled: boolean;
  onPick: (colour: string) => void;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-1">
      <span className="w-[78px] shrink-0 text-[12px] font-semibold" style={{ color: `${furniture}A6` }}>
        {label}
      </span>
      <div className="no-scrollbar flex flex-1 gap-2 overflow-x-auto py-1">
        {colours.map((colour) => {
          const chosen = colour.toLowerCase() === selected.toLowerCase();
          return (
            <button
              key={colour}
              type="button"
              onClick={() => onPick(colour)}
              disabled={disabled}
              aria-label={`${label} ${colour}`}
              aria-pressed={chosen}
              className={cn("size-[30px] shrink-0 rounded-full transition", chosen && "scale-105")}
              style={{
                backgroundColor: colour,
                border: chosen ? `3px solid ${furniture}` : `1px solid ${furniture}40`,
              }}
            />
          );
        })}
      </div>
      {disabled ? <LoaderCircle className="size-4 shrink-0 animate-spin opacity-60" aria-hidden /> : null}
    </div>
  );
}