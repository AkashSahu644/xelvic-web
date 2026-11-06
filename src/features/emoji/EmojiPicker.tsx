/**
 * The composer's emoji picker: the whole of Unicode, drawn with Google's own
 * artwork, with the animated third of it moving.
 *
 * The panel that stood here drew twelve emoji in a 232px box. This one draws a
 * page per group (169–386 tiles), searches by name across all 1906, keeps the
 * last two dozen handed over at the top, and can put any of the five skin tones
 * on the emoji that take one. What a tile *is* — the character, the drawing,
 * whether it moves — is `EmojiArt`'s job; this file is the page around it.
 *
 * **What travels is plain text.** A pick lands on `onPick` as an ordinary
 * emoji character, which is what the composer puts in the message. The drawings
 * and the animations never leave this panel: they are how the tile looks, not
 * what is sent, so a message keeps its emoji on a device that has never heard
 * of Lottie and Google's CDN is never asked to serve anything to a reader.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { STORAGE_KEYS } from "@/constants/storage";
import { EmojiArt } from "./EmojiArt";
import {
  artOf,
  EMOJI_GROUPS,
  GROUP_MARKS,
  groupRows,
  RECENT_LIMIT,
  rememberRecent,
  rowOf,
  searchRows,
  shownChar,
  type EmojiRow,
} from "./model";

/** The shelf of recent emoji, as this device last left it. */
function readRecent(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEYS.recentEmoji);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((one): one is string => typeof one === "string").slice(0, RECENT_LIMIT);
  } catch {
    // A private window, a blocked store or a value somebody else wrote: none
    // of them is worth an empty picker.
    return [];
  }
}

function writeRecent(list: readonly string[]) {
  try {
    localStorage.setItem(STORAGE_KEYS.recentEmoji, JSON.stringify(list));
  } catch {
    /* the shelf simply does not survive this session */
  }
}

export function EmojiPicker({
  onPick,
  onClose,
  className,
}: {
  /** Handed one emoji character, ready to go straight into the message. */
  onPick: (char: string) => void;
  onClose: () => void;
  className?: string;
}) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState(0);
  /** Whether the page on screen is a group or the recent shelf. */
  const [shelf, setShelf] = useState<"group" | "recent">("group");
  const [tone, setTone] = useState(0);
  const [toneOpen, setToneOpen] = useState(false);
  const [recent, setRecent] = useState<string[]>(readRecent);
  const root = useRef<HTMLDivElement>(null);
  // One emoji to stand for the tone itself: the raised hand, which is the one
  // everybody recognises wearing a tone, drawn with Google's art like a tile.
  const toneSample = useMemo(() => rowOf("✋"), []);

  const rows = useMemo<EmojiRow[]>(() => {
    const search = query.trim();
    if (search) return searchRows(search);
    if (shelf === "recent") {
      return recent
        .map((char) => rowOf(char))
        .filter((row): row is EmojiRow => row !== null);
    }
    return groupRows(group);
  }, [query, group, shelf, recent]);

  const searching = Boolean(query.trim());
  // Only offered where there is something for it to change: no group outside
  // People & Body has a single emoji a tone can be put on.
  const toneReady =
    toneSample && rows.some((row) => row[3] === 1) ? toneSample : null;

  // A press anywhere else puts the panel away. Taken on `pointerdown` rather
  // than on a click, so the panel is gone before the thing that was pressed
  // reacts — and this listener is added after the press that opened the panel
  // has already been dispatched, so opening it cannot immediately close it.
  useEffect(() => {
    const away = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) onClose();
    };
    document.addEventListener("pointerdown", away);
    return () => document.removeEventListener("pointerdown", away);
  }, [onClose]);

  function pick(row: EmojiRow) {
    const char = shownChar(row, tone);
    setRecent((list) => {
      const next = rememberRecent(list, char);
      writeRecent(next);
      return next;
    });
    onPick(char);
  }

  const title = searching
    ? `${rows.length} emoji matching “${query.trim()}”`
    : shelf === "recent"
      ? "Recent"
      : EMOJI_GROUPS[group];

  return (
    <div
      ref={root}
      className={cn(
        "flex w-[336px] max-w-[calc(100vw-1.5rem)] flex-col overflow-hidden rounded-[16px] border border-line bg-card shadow-[0_12px_34px_rgba(17,17,26,0.16)]",
        className,
      )}
      role="dialog"
      aria-label="Emoji"
    >
      <div className="flex items-center gap-2 border-b border-line px-2.5 py-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-dim" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search emoji"
            aria-label="Search emoji"
            className="h-8 w-full rounded-full border border-line bg-card pl-8 pr-3 text-[12px] font-medium text-ink outline-none transition placeholder:text-dim focus:border-accent"
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-dim transition hover:bg-[var(--accent-soft)] hover:text-ink"
          aria-label="Close emoji"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex items-center justify-between gap-2 px-3 pb-1 pt-2">
        <p className="truncate text-[11px] font-bold text-dim">{title}</p>
        {toneReady && !searching ? (
          <button
            type="button"
            onClick={() => setToneOpen((open) => !open)}
            className={cn(
              "flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold transition",
              toneOpen || tone > 0
                ? "border-[color-mix(in_srgb,var(--accent)_30%,var(--line))] bg-[var(--accent-soft)] text-accent"
                : "border-line text-dim hover:text-ink",
            )}
            aria-expanded={toneOpen}
          >
            <span className="grid size-4 place-items-center text-[13px] leading-none">
              <EmojiArt
                char={shownChar(toneReady, tone)}
                motion={false}
                still={artOf(toneReady, tone).still}
              />
            </span>
            {tone === 0 ? "Tone" : `Tone ${tone}`}
          </button>
        ) : null}
      </div>

      {toneOpen && toneReady ? (
        <div className="flex items-center gap-1 px-3 pb-1.5">
          {[0, 1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setTone(value);
                setToneOpen(false);
              }}
              className={cn(
                "grid size-8 place-items-center rounded-[9px] text-[20px] transition",
                tone === value ? "bg-[var(--accent-soft)] ring-1 ring-accent" : "hover:bg-[var(--accent-soft)]",
              )}
              aria-label={value === 0 ? "No skin tone" : `Skin tone ${value}`}
              aria-pressed={tone === value}
            >
              <EmojiArt
                char={shownChar(toneReady, value)}
                motion={false}
                still={artOf(toneReady, value).still}
              />
            </button>
          ))}
        </div>
      ) : null}

      <div className="max-h-[min(258px,42vh)] overflow-y-auto overscroll-contain px-2.5 pb-1">
        {rows.length ? (
          <div className="grid grid-cols-8 gap-1">
            {rows.map((row) => {
              const char = shownChar(row, tone);
              const art = artOf(row, tone);
              return (
                <button
                  key={`${row[0]}-${char}`}
                  type="button"
                  onClick={() => pick(row)}
                  className="grid size-9 place-items-center rounded-[9px] text-[22px] transition hover:bg-[var(--accent-soft)] active:scale-95"
                  title={row[1]}
                  aria-label={row[1]}
                >
                  <EmojiArt char={char} motion={art.motion} still={art.still} />
                </button>
              );
            })}
          </div>
        ) : (
          <p className="px-2 py-6 text-center text-[11px] text-dim">
            {searching
              ? `Nothing called “${query.trim()}”.`
              : shelf === "recent"
                ? "The emoji you use most will gather here."
                : "Nothing in this group."}
          </p>
        )}
      </div>

      <div className="flex items-center gap-0.5 border-t border-line px-2 py-1.5">
        <button
          type="button"
          onClick={() => {
            setShelf("recent");
            setQuery("");
          }}
          className={cn(
            "grid size-7 shrink-0 place-items-center rounded-[8px] text-[15px] transition",
            !searching && shelf === "recent"
              ? "bg-[var(--accent-soft)] ring-1 ring-accent"
              : "hover:bg-[var(--accent-soft)]",
          )}
          title="Recent"
          aria-label="Recent emoji"
          aria-pressed={!searching && shelf === "recent"}
        >
          🕘
        </button>
        {EMOJI_GROUPS.map((name, index) => (
          <button
            key={name}
            type="button"
            onClick={() => {
              setGroup(index);
              setShelf("group");
              setQuery("");
            }}
            className={cn(
              "grid size-7 shrink-0 place-items-center rounded-[8px] text-[15px] transition",
              !searching && shelf === "group" && group === index
                ? "bg-[var(--accent-soft)] ring-1 ring-accent"
                : "hover:bg-[var(--accent-soft)]",
            )}
            title={name}
            aria-label={name}
            aria-pressed={!searching && shelf === "group" && group === index}
          >
            {GROUP_MARKS[index] ?? "•"}
          </button>
        ))}
      </div>
    </div>
  );
}
