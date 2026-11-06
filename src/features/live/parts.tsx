import { HelpCircle, Mic, Video } from "lucide-react";
import { coverTone, seedOf } from "@/features/audio/parts";
import type { SpaceRoom } from "@/types/api";

/**
 * A room's face, and the words a shelf says under it.
 *
 * Lifted from `screens/room_bits.dart` because a second surface now draws a
 * room — the "Live now" strip under the Moments rail — and the same room drawn
 * two different ways on two pages would be two rooms. A room has no photograph:
 * it has a seed, and the seed draws a flat tone, the room's own wave, and the
 * glyph for its kind, so the picture is the same everywhere it appears.
 */

/** The bars of a room's wave: the app's own generator, same numbers. */
export function waveShape(seed: number, count: number) {
  if (count <= 0) return [] as number[];
  let state = (Math.abs(seed) + 7) * 2654435761 % 4294967296;
  return Array.from({ length: count }, (_, index) => {
    state = (state * 1103515245 + 12345) % 4294967296;
    const tall = 0.22 + ((state % 1000) / 1000) * 0.78;
    // Every fourth bar is pulled down a touch, so the run has a beat in it
    // rather than looking like noise.
    return index % 4 === 0 ? Math.min(1, Math.max(0.12, tall * 0.62)) : tall;
  });
}

function KindGlyph({ room, size }: { room: SpaceRoom; size: number }) {
  const Icon = room.kind === "stream" ? Video : room.kind === "ama" ? HelpCircle : Mic;
  return <Icon style={{ width: size * 0.36, height: size * 0.36 }} className="text-white" aria-hidden />;
}

/** The room's cover: tone, wave across the bottom third, and its kind's glyph. */
export function RoomCover({
  room,
  size = 58,
  radius,
}: {
  room: SpaceRoom;
  size?: number;
  radius?: number;
}) {
  const bars = waveShape(seedOf(room.seed), 9);
  return (
    <span
      className="relative flex shrink-0 items-center justify-center overflow-hidden"
      style={{
        width: size,
        height: size,
        borderRadius: radius ?? size * 0.28,
        backgroundColor: coverTone(seedOf(room.seed)),
      }}
      aria-hidden
    >
      <span
        className="absolute inset-x-[16%] bottom-[16%] flex items-end"
        style={{ height: size * 0.2 }}
      >
        {bars.map((bar, index) => (
          <span
            key={index}
            className="flex-1 rounded-[2px] bg-white/35"
            style={{ height: size * 0.05 + bar * size * 0.15, marginInline: size * 0.008 }}
          />
        ))}
      </span>
      <KindGlyph room={room} size={size} />
    </span>
  );
}

/** How many people are in the room — listeners plus the stage, as the app counts. */
export function crowdCount(room: SpaceRoom) {
  return (room.listeners ?? 0) + (room.stage?.length ?? 0);
}

/** `9:30 PM` for a moment, read the way a person reads a clock. */
function clockOf(at: Date) {
  const hour = at.getHours() === 0 ? 12 : at.getHours() > 12 ? at.getHours() - 12 : at.getHours();
  const minute = String(at.getMinutes()).padStart(2, "0");
  const half = at.getHours() >= 12 ? "PM" : "AM";
  return `${hour}:${minute} ${half}`;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/**
 * What a room's clock says on a shelf: `Tonight 9:30`, `Sat 6:00 PM`, `2h ago`.
 *
 * A shelf is read at a glance and a date is not a glance. The ladder is short
 * on purpose: within the hour, today, tomorrow, this week by name, and after
 * that a date — the app's `whenRoom`, in the same order.
 */
export function whenRoom(at?: string | null) {
  if (!at) return "Not scheduled";
  const when = new Date(at);
  if (Number.isNaN(when.getTime())) return "Not scheduled";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(when.getFullYear(), when.getMonth(), when.getDate());
  const days = Math.round((day.getTime() - today.getTime()) / 86_400_000);
  const clock = clockOf(when);
  if (days === 0) return `Today ${clock}`;
  if (days === 1) return `Tomorrow ${clock}`;
  if (days === -1) return `Yesterday ${clock}`;
  if (days < 0) return `${-days}d ago`;
  if (days < 7) return `${WEEKDAYS[(when.getDay() + 6) % 7]} ${clock}`;
  return `${when.getDate()}/${when.getMonth() + 1} ${clock}`;
}

/**
 * What the strip or a row says under a room's name.
 *
 * A room that is on says how many are in it; one that is not says when it
 * starts. A silent room says so rather than "0 people", which is a count of
 * nobody rather than a sentence about a room.
 */
export function crowdLine(room: SpaceRoom) {
  const state = room.state ?? "";
  if (state === "scheduled") return `Starts ${whenRoom(room.starts_at)}`;
  const here = crowdCount(room);
  if (here === 0) return state === "ended" ? "Over" : "Nobody in it yet";
  return `${here} ${here === 1 ? "person" : "people"}`;
}