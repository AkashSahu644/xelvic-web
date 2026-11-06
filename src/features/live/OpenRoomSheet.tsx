import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Gamepad2, HelpCircle, Mic, Video } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/overlays/Modal";
import { cn } from "@/utils/cn";
import { errorMessage } from "@/utils/errors";
import { spacesService } from "@/services/spaces.service";

/**
 * A room, described — the app's `OpenRoomSheet`.
 *
 * One sheet rather than two, because starting a room from the Live shelf and
 * starting one from the "Live now" strip are the same act with the same rules.
 * That is why this lives here and not inside either page: the two doors share
 * it, so a field added to one is a field on both.
 *
 * What is decided here is the app's four things and nothing else: what kind of
 * room it is, what it is called, its note and tags, and whether it opens now or
 * is announced for later. **A game is not a fourth kind on the wire** — it goes
 * up as a stream and the board is put on it a moment later by the host standing
 * in it (`sheets.dart` says the same). The chip is still drawn, because "open a
 * stream and then find the games list" is two steps for the one thing somebody
 * wants.
 *
 * Nothing here announces success. The server's answer to `POST /spaces/` is the
 * room, and the sheet closes onto that room; the shelf and the strip ask for
 * their shelves again. A failure is shown in the sheet, in the server's words.
 */

export type RoomKind = "room" | "stream" | "game" | "ama";

const KINDS: { key: RoomKind; label: string; body: string; icon: typeof Mic }[] = [
  {
    key: "room",
    label: "Room",
    body: "Voices only. Anybody on the stage can be heard, and the audience can talk in the room's chat and throw emoji.",
    icon: Mic,
  },
  {
    key: "stream",
    label: "Stream",
    body: "You and your stage get a camera. Everybody's picture is on the stage, and each of you turns their own on or off from the bottom of the room.",
    icon: Video,
  },
  {
    key: "game",
    label: "Game",
    body: "A video stream with a board on it. Pick the game once the room is open and the board becomes the stream, so everybody who walks in watches the same game rather than being told about it afterwards.",
    icon: Gamepad2,
  },
  {
    key: "ama",
    label: "AMA",
    body: "A room for questions. The stage answers and everybody else listens, exactly as in a Room — it is a name for what is happening, not a different set of buttons.",
    icon: HelpCircle,
  },
];

/** The app's three quick answers to "when", in hours from now. */
const WHEN: { hours: number; label: string }[] = [
  { hours: 1, label: "In an hour" },
  { hours: 2, label: "In two hours" },
  { hours: 24, label: "Tomorrow" },
];

export function OpenRoomSheet({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  /** Told after the room exists, so a strip can ask for its shelf again. */
  onCreated?: () => void;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [kind, setKind] = useState<RoomKind>("room");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [tags, setTags] = useState("");
  const [later, setLater] = useState(false);
  const [when, setWhen] = useState(() => Date.now() + 2 * 3_600_000);
  const [busy, setBusy] = useState(false);
  const [trouble, setTrouble] = useState("");

  function reset() {
    setKind("room");
    setTitle("");
    setNote("");
    setTags("");
    setLater(false);
    setWhen(Date.now() + 2 * 3_600_000);
    setTrouble("");
  }

  async function openRoom() {
    if (busy) return;
    const name = title.trim();
    if (!name) {
      setTrouble("Give the room a name.");
      return;
    }
    setBusy(true);
    setTrouble("");
    try {
      const made = await spacesService.create({
        title: name,
        note: note.trim(),
        // A game goes on the wire as a stream, and that is not a shorthand: the
        // room really is a video stream, and the board that makes it a game is
        // put on it a moment later by the host now standing in it.
        kind: kind === "game" ? "stream" : kind,
        tags: tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        starts_at: later ? new Date(when).toISOString() : null,
      });
      onClose();
      reset();
      await queryClient.invalidateQueries({ queryKey: ["rooms"] });
      onCreated?.();
      // Straight into the room, because a room nobody is in is a room that ends
      // the moment the person who opened it looks away.
      if (made.room?.id) navigate(`/app/live/${made.room.id}`);
    } catch (error) {
      setTrouble(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  const chosen = KINDS.find((item) => item.key === kind) ?? KINDS[0];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Open a room"
      description="Anybody can walk in. You hold the room, which means you hand out the microphones and you are the one who closes it."
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={() => void openRoom()} loading={busy}>
            {busy ? "Opening..." : later ? "Announce it" : "Open it"}
          </Button>
        </div>
      }
    >
      <div className="space-y-4 px-5 py-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold text-dim">What is it called?</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={140}
              placeholder="Late Night Talk"
              className="field w-full"
            />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold text-dim">A line under it (optional)</span>
            <input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={200}
              placeholder="Open mic. Anyone can speak."
              className="field w-full"
            />
          </label>
        </div>

        <div>
          <div className="flex flex-wrap gap-2">
            {KINDS.map((item) => {
              const on = kind === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setKind(item.key)}
                  disabled={busy}
                  className={cn(
                    "flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] transition disabled:opacity-60",
                    on ? "border-accent bg-accent font-bold text-on-accent" : "border-line bg-card font-semibold text-ink hover:border-accent/40",
                  )}
                >
                  <item.icon className={cn("size-[15px]", on ? "text-on-accent" : "text-dim")} />
                  {item.label}
                </button>
              );
            })}
          </div>
          {/* What the choice above actually gets you, said once and under it. */}
          <p className="mt-2 text-[12px] leading-[1.45] text-dim">{chosen.body}</p>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-[11px] font-bold text-dim">Tags, comma separated (optional)</span>
          <input
            value={tags}
            onChange={(event) => setTags(event.target.value)}
            maxLength={80}
            placeholder="Design, Startup"
            className="field w-full"
          />
        </label>

        <div>
          <button
            type="button"
            role="switch"
            aria-checked={later}
            disabled={busy}
            onClick={() => setLater((on) => !on)}
            className="flex w-full items-center gap-3 text-left disabled:opacity-60"
          >
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-semibold">Start it later</span>
              <span className="block text-[12px] text-dim">It is announced on the shelf with a time on it.</span>
            </span>
            <span
              className={cn(
                "relative h-6 w-10 shrink-0 rounded-full transition",
                later ? "bg-accent" : "bg-[color-mix(in_srgb,var(--ink)_18%,transparent)]",
              )}
            >
              <span
                className={cn(
                  "absolute top-0.5 size-5 rounded-full bg-white transition-all",
                  later ? "left-[18px]" : "left-0.5",
                )}
              />
            </span>
          </button>
          {later ? (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {WHEN.map((item) => {
                const at = Date.now() + item.hours * 3_600_000;
                const on = Math.abs(when - at) < 5 * 60_000;
                return (
                  <button
                    key={item.hours}
                    type="button"
                    onClick={() => setWhen(at)}
                    disabled={busy}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-[12.5px] transition disabled:opacity-60",
                      on ? "border-accent bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] font-bold text-accent" : "border-line font-semibold text-dim hover:border-accent/40",
                    )}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>

        {trouble ? <p className="text-[12.5px] text-[var(--bad)]">{trouble}</p> : null}
      </div>
    </Modal>
  );
}

export default OpenRoomSheet;