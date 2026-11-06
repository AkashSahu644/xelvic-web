/**
 * The recording, sitting where the text field sits.
 *
 * This is the web's `chat_audio.dart`'s recording bar: it takes the field's
 * place rather than the composer's, because the mic is a *hold* and the button
 * under the finger has to survive the whole gesture — anything that moved it
 * mid-press would take the gesture with it. Only what is to the left of the mic
 * changes when a recording starts.
 *
 * What it draws is what the recorder is actually reading: the seconds since it
 * started and the loudness samples it has taken, oldest first. Nothing here is
 * a decoration standing in for a number nobody measured.
 */
import { Send, Trash2, X } from "lucide-react";
import { cn } from "@/utils/cn";
import { duration } from "@/utils/format";
import type { HoldSlide } from "./voicehold";

/** How many of the readings the strip has room to draw. */
const DRAWN_BARS = 26;

export function VoiceStrip({
  slide,
  seconds,
  levels,
  locked,
  onDiscard,
  onSend,
}: {
  slide: HoldSlide;
  seconds: number;
  levels: readonly number[];
  /** Parked with nobody on the mic: the bin and the Send are what ends it. */
  locked: boolean;
  onDiscard: () => void;
  onSend: () => void;
}) {
  const throwing = slide === "cancel";
  const bars = levels.slice(-DRAWN_BARS);
  const hint = throwing
    ? "Let go to throw this away"
    : slide === "lock"
      ? "Let go to keep recording"
      : locked
        ? "Recording — send it or bin it"
        : "Slide up to lock · left to throw away";

  return (
    <div
      className={cn(
        "flex min-h-[44px] flex-1 items-center gap-2.5 rounded-[22px] border px-3 py-1.5 transition",
        throwing
          ? "border-[color-mix(in_srgb,var(--bad)_45%,var(--line))] bg-[color-mix(in_srgb,var(--bad)_10%,var(--card))]"
          : "border-line bg-card",
      )}
      role="status"
      aria-live="polite"
    >
      <span
        className={cn(
          "size-2 shrink-0 rounded-full",
          throwing ? "bg-[var(--bad)]" : "animate-pulse bg-[var(--bad)]",
        )}
      />
      <span className="num shrink-0 text-[13px] font-bold tabular-nums text-ink">
        {duration(Math.floor(seconds))}
      </span>

      <span className="flex h-6 min-w-0 flex-1 items-center gap-[2px] overflow-hidden">
        {bars.length ? (
          bars.map((level, index) => (
            <span
              key={index}
              className={cn(
                "w-[3px] shrink-0 rounded-full",
                throwing ? "bg-[color-mix(in_srgb,var(--bad)_60%,transparent)]" : "bg-accent",
              )}
              style={{ height: `${Math.max(8, Math.min(100, level))}%`, opacity: 0.35 + (index / bars.length) * 0.65 }}
            />
          ))
        ) : (
          <span className="text-[10.5px] font-semibold text-dim">Listening…</span>
        )}
      </span>

      {locked ? (
        <>
          <button
            type="button"
            onClick={onDiscard}
            className="flex size-8 shrink-0 items-center justify-center rounded-full text-[var(--bad)] transition hover:bg-[color-mix(in_srgb,var(--bad)_12%,transparent)]"
            aria-label="Throw this voice note away"
          >
            <Trash2 className="size-4" />
          </button>
          <button
            type="button"
            onClick={onSend}
            className="flex size-[34px] shrink-0 items-center justify-center rounded-full bg-accent text-on-accent transition hover:brightness-105 active:scale-95"
            aria-label="Send this voice note"
          >
            <Send className="size-4" />
          </button>
        </>
      ) : (
        <span className="flex shrink-0 items-center gap-1.5 text-[10px] font-semibold text-dim">
          {throwing ? <X className="size-3.5 text-[var(--bad)]" /> : null}
          <span className="hidden sm:inline">{hint}</span>
        </span>
      )}
    </div>
  );
}
