import type { ComponentType } from "react";
import {
  Camera,
  Clapperboard,
  Dumbbell,
  Flame as FlameIcon,
  Gamepad2,
  Music2,
  Palette,
  PenLine,
  Smile,
  Sparkles,
  Utensils,
  Video,
  Volume2,
  CheckCircle2,
  Clock,
  Timer,
  Heart,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { AuthedImage } from "@/components/media/Media";
import { cn } from "@/utils/cn";
import { count } from "@/utils/format";
import { dropStill } from "@/features/drops/model";
import type { CircleDay, CircleTask, Drop } from "@/types/api";

/**
 * The vocabulary every Circles screen shares — a port of the last block of
 * `app/lib/screens/circles.dart` (`_ask`, `_kindGlyph`, `_dropGlyph`, `_thumb`,
 * `_gist`, `_left`, `_opensAt`, `_monthName`, `_fieldGlyph`) plus the three
 * pieces the section and the circle's own page both draw: the task line, the
 * status row and the post button.
 *
 * Kept in one file because the section and the opened circle are two weights of
 * one thing, and a second copy of "Closes in 2h 15m" would be a second chance
 * for the two screens to say it differently. Nothing here decides anything: the
 * window, the seal and the board's order are all the server's, and these are
 * only the words and glyphs it is drawn with.
 */

type Glyph = ComponentType<{ className?: string; "aria-hidden"?: boolean }>;

/**
 * The glyph for an interest, from its key.
 *
 * Six of the ten seeded interests have a glyph of their own and the rest share
 * the fallback — a key this build has not heard of is one the console added,
 * and a console that adds one should not find the app drawing nothing for it.
 */
export function fieldGlyph(key: string): Glyph {
  switch (key) {
    case "music":
      return Music2;
    case "art":
      return Palette;
    case "meme":
      return Smile;
    case "dance":
      return Video;
    case "food":
      return Utensils;
    case "writing":
      return PenLine;
    case "photography":
      return Camera;
    case "comedy":
      return Sparkles;
    case "gaming":
      return Gamepad2;
    case "fitness":
      return Dumbbell;
    default:
      return Sparkles;
  }
}

/** The glyph for an answer shape — `_kindGlyph`. */
export function kindGlyph(kind: string): Glyph {
  switch (kind) {
    case "text":
      return PenLine;
    case "sound":
      return Volume2;
    case "clip":
      return Clapperboard;
    default:
      return Camera;
  }
}

/** What each answer shape is called on the button that starts one — `_ask`. */
export function kindAsk(kind: string): string {
  switch (kind) {
    case "text":
      return "Write your take";
    case "sound":
      return "Record or choose a take";
    case "clip":
      return "Record or choose a clip";
    default:
      return "Take or choose a picture";
  }
}

/** The half of the header that names the room: *Music · IN*. */
export function circleTitle(day: Pick<CircleDay, "field" | "country">): string {
  return day.country ? `${day.field?.name ?? ""} · ${day.country.toUpperCase()}` : day.field?.name ?? "";
}

/** The hour a day opens, in this browser's own writing — `_opensTime`. */
export function opensTime(day: CircleDay): string | null {
  if (!day.opens_at) return null;
  const when = new Date(day.opens_at);
  if (Number.isNaN(when.getTime())) return null;
  return when.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

/** When a day opens, as the status row and the button both draw it — `_opensAt`. */
export function opensAt(day: CircleDay): string {
  const when = opensTime(day);
  return when ? `Opens ${when}` : "Opens later today";
}

/**
 * How long a day has left, in the coarsest unit that still says something.
 *
 * The server sends seconds and this only names them, so a browser with a wrong
 * clock cannot end the day early — the same rule the countdown keeps.
 */
export function leftText(seconds: number): string {
  if (seconds <= 0) return "Closing now";
  if (seconds < 60) return "Closes in under a minute";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Closes in ${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours < 24) return rest ? `Closes in ${hours}h ${rest}m` : `Closes in ${hours}h`;
  return `Closes in ${Math.floor(hours / 24)}d`;
}

/** The month a choice belongs to, spelled out — `_monthName`. */
export function monthName(month: string | null | undefined): string {
  if (!month) return "";
  const when = new Date(month);
  if (Number.isNaN(when.getTime())) return "";
  return when.toLocaleDateString([], { month: "long" });
}

/** The picture on a board row, or null when there is nothing to draw — `_thumb`. */
export function dropThumb(drop: Drop): string | null {
  const still = dropStill(drop);
  return still?.thumbnail_url || still?.content_url || null;
}

/** A post's words, or what the thing is when it has none — `_gist`. */
export function gist(drop: Drop): string {
  const body = (drop.body ?? "").trim();
  if (body) return body;
  switch (drop.kind) {
    case "audio":
      return "an audio";
    case "video":
      return "a clip";
    case "image":
      return "a picture";
    default:
      return "a take";
  }
}

/** The run, drawn the same wherever it appears — `_Flame`. */
export function Flame({ run }: { run: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-2.5 py-1 text-accent">
      <FlameIcon className="size-4" aria-hidden />
      <span className="text-[13px] font-extrabold">{count(run)}</span>
    </span>
  );
}

/**
 * The sentence a circle was asked — `_TaskLine`.
 *
 * Before the hour it opens on, the task is the server's and this draws the hour
 * instead. That is not a nicety: a circle is fifty people answering one thing
 * at one time, and a task visible at breakfast for a window that opens at
 * eleven is a task written in advance.
 */
export function TaskLine({ day }: { day: CircleDay }) {
  const task: CircleTask | null = day.task;
  const Glyph = task ? kindGlyph(task.kind) : Clock;
  return (
    <div>
      <span className="flex items-center gap-1.5 text-[10.5px] font-extrabold tracking-[0.8px] text-dim">
        <Glyph className="size-3.5" aria-hidden />
        TODAY
      </span>
      <p className={cn("mt-1 text-[17px] font-bold leading-[1.3]", task ? "text-ink" : "text-dim")}>
        {task ? task.text : `Your task arrives at ${opensTime(day) ?? "later today"}`}
      </p>
      {task && task.hint.trim() ? (
        <p className="mt-1 text-[13px] leading-[1.3] text-dim">{task.hint}</p>
      ) : null}
    </div>
  );
}

/** Whether the window is open, how long is left, and whether I answered — `_Status`. */
export function StatusLine({ day }: { day: CircleDay }) {
  if (day.posted) {
    return (
      <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-accent">
        <CheckCircle2 className="size-[15px]" aria-hidden />
        You are in today. Nice.
      </span>
    );
  }
  if (!day.open) {
    // Two closeds and two sentences: a day still to come names its hour, and a
    // day that has been and gone says so. "Closed for today" for both was the
    // bug that made every circle read closed at half past eight in the morning.
    return (
      <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-dim">
        <Clock className="size-[15px]" aria-hidden />
        {day.opens_in > 0 ? opensAt(day) : "Closed for today"}
      </span>
    );
  }
  return (
    <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-dim">
      <Timer className="size-[15px]" aria-hidden />
      {leftText(day.closes_in)}
    </span>
  );
}

/**
 * The one button that makes the section something to come back to — `_PostButton`.
 *
 * Posted already, or the window is shut: neither is a state with something to
 * press, so the button is drawn disabled and says which, rather than refusing a
 * tap. One post a day is the rule the run is built on.
 */
export function PostButton({ day, onPost }: { day: CircleDay; onPost: () => void }) {
  const task = day.task;
  const can = day.open && !day.posted && task != null;
  if (!can) {
    return (
      <button
        type="button"
        disabled
        className="min-h-11 w-full rounded-[14px] border border-line text-[13px] font-bold text-dim disabled:opacity-100"
      >
        {day.posted
          ? "Posted today"
          : day.opens_in > 0
            ? opensAt(day)
            : "Closed for today"}
      </button>
    );
  }
  const Glyph = kindGlyph(task.kind);
  return (
    <button type="button" onClick={onPost} className="btn btn-primary min-h-[46px] w-full rounded-[14px] text-[13px]">
      <Glyph className="size-[18px]" aria-hidden />
      {kindAsk(task.kind)}
    </button>
  );
}

/**
 * One row of the section's peek at a board: where it stands, who, what, hearts.
 *
 * Not tappable, and the heart is not a control here: the row is a peek and the
 * card it sits on opens the circle, where the full cards carry the real heart.
 */
export function RankRow({ rank, drop }: { rank: number; drop: Drop }) {
  const still = dropThumb(drop);
  return (
    <div className="flex items-center gap-2.5 px-4 py-[9px]">
      <span className={cn("w-[18px] text-[13px] font-extrabold", rank === 1 ? "text-accent" : "text-dim")}>
        {rank}
      </span>
      <Avatar user={drop.author} size={26} />
      <span
        className="flex size-[30px] shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]"
        aria-hidden
      >
        {still ? (
          <AuthedImage src={still} alt="" className="size-full" />
        ) : (
          <span className="text-[10px] font-bold text-dim">{drop.kind.slice(0, 1).toUpperCase()}</span>
        )}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13.5px]">{gist(drop)}</span>
      <Heart
        className={cn("size-[15px] shrink-0", drop.liked ? "fill-current text-accent" : "text-dim")}
        aria-hidden
      />
      <span className={cn("text-[12.5px] font-bold", drop.liked ? "text-accent" : "text-dim")}>
        {count(drop.likes)}
      </span>
    </div>
  );
}

/** The faces in a circle, and how full it is — `_Faces`. */
export function Faces({ day }: { day: CircleDay }) {
  const shown = (day.members ?? []).slice(0, 12);
  // The app's own three sentences (`circlesHereOne`, `circlesHereTwo`,
  // `circlesSeatsOpenOne`): a circle of one is not "1 people here".
  const here =
    day.seats > 12
      ? `${count(day.seats)} people, and ${count(day.size - day.seats)} seats open`
      : day.seats === 1
        ? "1 person here"
        : `${count(day.seats)} people here`;
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex">
        {shown.map((person, index) => (
          <span
            key={String(person.id)}
            className="rounded-full border-[1.5px] border-[var(--page)]"
            style={{ marginInlineStart: index === 0 ? 0 : -9 }}
          >
            <Avatar user={person} size={31} />
          </span>
        ))}
      </span>
      <span className="min-w-0 flex-1 text-[12.5px] text-dim">{here}</span>
    </div>
  );
}

/** The tile an interest's glyph sits in — the picker's own 40pt square. */
export function FieldTile({ fieldKey, picked }: { fieldKey: string; picked?: boolean }) {
  const Glyph = fieldGlyph(fieldKey);
  return (
    <span
      className={cn(
        "flex size-10 shrink-0 items-center justify-center rounded-[12px] text-accent",
        picked
          ? "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)]"
          : "bg-[color-mix(in_srgb,var(--accent)_8%,transparent)]",
      )}
    >
      <Glyph className="size-[21px]" aria-hidden />
    </span>
  );
}