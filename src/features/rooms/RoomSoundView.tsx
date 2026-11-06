import { useCallback, useRef, useState } from "react";
import { FlipHorizontal2, Headphones, MicOff, Radio, SwitchCamera, Volume2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { AudioSurface, VideoSurface, playInside } from "@/features/media/surfaces";
import { cn } from "@/utils/cn";
import type { SpacePerson } from "@/types/api";
import type { RoomSound } from "./useRoomStage";

/**
 * The room, as it is heard.
 *
 * One tile per seat, drawn from what has actually arrived: a picture where
 * there is a picture, a voice where there is only a voice, and the person's
 * own face where there is nothing yet. Nothing here is a placeholder for media
 * that has not connected — a seat with no stream is a seat whose stream has not
 * arrived, and it says so rather than showing a name over a black rectangle as
 * though the picture were there.
 */

/** The number of listeners the relay actually carries — `MEDIA_LISTENERS`. */
export const MEDIA_LISTENERS = 8;

function Tile({
  person,
  sound,
  video,
  self,
  onBlocked,
}: {
  person: SpacePerson;
  sound: RoomSound;
  video: boolean;
  self: boolean;
  onBlocked: () => void;
}) {
  const id = String(person.user ?? "");
  const stream = self ? sound.selfStream() : sound.streamFor(id);
  const hasPicture = video && !!stream?.getVideoTracks().length;
  const card = person.user
    ? {
        id,
        username: person.username || "",
        name: person.name || person.username || "Someone",
        avatar: person.avatar ?? null,
        initials: "",
      }
    : null;

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-[16px] border border-line bg-card",
        hasPicture ? "aspect-video" : "p-3",
      )}
    >
      {hasPicture && stream ? (
        <>
          <VideoSurface
            stream={stream}
            muted={self}
            mirror={self ? sound.state.mirrored : sound.state.remoteMirrored}
            onBlocked={self ? undefined : onBlocked}
            className="size-full object-cover"
          />
          <span className="absolute inset-x-0 bottom-0 flex items-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent px-2 py-1.5 text-[10px] font-extrabold text-white">
            {person.muted ? <MicOff className="size-3" /> : null}
            {person.name || person.username}
            {self ? " (you)" : ""}
          </span>
        </>
      ) : (
        <div className="flex items-center gap-2.5">
          <Avatar user={card} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[11px] font-extrabold">
              {person.name || person.username}
              {self ? " (you)" : ""}
            </p>
            <p className="flex items-center gap-1 text-[9px] text-dim">
              {person.muted ? <MicOff className="size-3" /> : <Headphones className="size-3" />}
              {stream ? (person.muted ? "Muted" : "Speaking here") : "Connecting"}
            </p>
          </div>
          {/* A stream with no picture is still a voice, and a browser plays a
              voice through an element. A stage that has not turned a camera on
              yet is exactly that case, in a room that does carry pictures. */}
          {!self && stream ? (
            <AudioSurface stream={stream} onBlocked={onBlocked} />
          ) : null}
        </div>
      )}
    </div>
  );
}

export function RoomSoundView({
  stage,
  sound,
  selfId,
  kind,
  onFlip,
  onMirror,
}: {
  stage: SpacePerson[];
  sound: RoomSound;
  selfId: string;
  kind?: string;
  onFlip?: () => void;
  onMirror?: () => void;
}) {
  const video = kind === "stream";
  const { state } = sound;
  const mine = stage.find((person) => String(person.user ?? "") === selfId);
  const others = stage.filter((person) => String(person.user ?? "") !== selfId);
  const seated = [...(mine ? [mine] : []), ...others];
  const alone = seated.length === 0;

  // A browser will not start a sound no press asked for, and a room somebody
  // walked into by opening a page is exactly that shape. The refusal is the
  // browser's, so the answer has to be a press — and until there is one, the
  // page must not say "Hearing the room" over a silence.
  const tiles = useRef<HTMLDivElement>(null);
  const [blocked, setBlocked] = useState(false);
  const noteBlocked = useCallback(() => setBlocked(true), []);
  const listen = useCallback(() => {
    void playInside(tiles.current).then((all) => {
      if (all) setBlocked(false);
    });
  }, []);

  if (state.error) {
    return (
      <section className="rounded-[18px] border border-line bg-card p-4">
        <p className="flex items-center gap-1.5 text-[12px] font-extrabold">
          <Radio className="size-3.5 text-accent" /> The room&rsquo;s sound
        </p>
        <p className="mt-2 text-[11px] leading-5 text-dim">{state.error}</p>
      </section>
    );
  }

  if (!state.call) return null;

  return (
    <section>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[13px] font-extrabold">
          {state.hearOnly ? <Headphones className="size-4 text-accent" /> : <Radio className="size-4 text-accent" />}
          {state.hearOnly ? "Listening in" : "On stage"}
        </h2>
        <div className="flex items-center gap-2">
          {blocked ? (
            <button
              type="button"
              onClick={listen}
              className="flex items-center gap-1 rounded-full bg-[var(--accent-soft)] px-2.5 py-1 text-[10px] font-extrabold text-accent"
            >
              <Volume2 className="size-3" /> Tap to hear the room
            </button>
          ) : state.live || state.hearOnly ? (
            <span className="flex items-center gap-1 text-[10px] font-bold text-[var(--good)]">
              <span className="size-1.5 rounded-full bg-[var(--good)]" />
              {state.hearOnly ? "Hearing the room" : "Your microphone is open"}
            </span>
          ) : (
            <span className="text-[10px] text-dim">Waiting for the microphone</span>
          )}
          {/* Only a stream room on a phone has a second lens to turn to. */}
          {video && !state.hearOnly && onFlip ? (
            <button
              type="button"
              onClick={onFlip}
              className="flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] px-2 py-1 text-[10px] font-bold text-dim transition hover:text-ink"
            >
              <SwitchCamera className="size-3" /> Flip
            </button>
          ) : null}
          {/* The mirror, which is about the pictures arriving here and not
              about this tab's own. Like the call screen's pill, it waits until
              one has arrived: a seat whose camera is off has no picture to
              turn over, and offering to flip one would be offering something
              this screen cannot answer. */}
          {video &&
          !state.hearOnly &&
          others.some(
            (person) =>
              (sound.streamFor(String(person.user ?? ""))?.getVideoTracks()
                .length ?? 0) > 0,
          ) ? (
            <button
              type="button"
              onClick={onMirror}
              aria-pressed={state.remoteMirrored}
              className={cn(
                "flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold transition",
                state.remoteMirrored
                  ? "bg-[var(--accent-soft)] text-accent"
                  : "bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] text-dim hover:text-ink",
              )}
            >
              <FlipHorizontal2 className="size-3" /> Mirror
            </button>
          ) : null}
        </div>
      </div>
      {alone ? (
        <p className="rounded-[16px] border border-dashed border-line bg-card px-4 py-6 text-center text-[11px] text-dim">
          You are the only one on the stage.
        </p>
      ) : (
        <div
          ref={tiles}
          className={cn("grid gap-2", video ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2 sm:grid-cols-3")}
        >
          {seated.map((person) => (
            <Tile
              key={String(person.user ?? "")}
              person={person}
              sound={sound}
              video={video}
              self={String(person.user ?? "") === selfId}
              onBlocked={noteBlocked}
            />
          ))}
        </div>
      )}
    </section>
  );
}

export default RoomSoundView;
