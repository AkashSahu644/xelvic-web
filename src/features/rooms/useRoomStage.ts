import { useEffect, useMemo, useSyncExternalStore } from "react";
import { useCall } from "@/hooks/useCall";
import { useSocket } from "@/hooks/useSocket";
import { callsService } from "@/services/calls.service";
import type { SpaceRoom } from "@/types/api";
import { RoomStage, type StageState } from "./stage";
/** Whether this browser can carry a room's sound at all. */
export function roomSoundSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.RTCPeerConnection === "function" &&
    !!navigator?.mediaDevices
  );
}

export interface RoomSound {
  state: StageState;
  /** One person's voice, or their picture in a stream. */
  streamFor: (userId: string) => MediaStream | null;
  /** This tab's own camera, for the corner tile. */
  selfStream: () => MediaStream | null;
  /** Turn a phone's camera round. Does nothing on a laptop. */
  flipCamera: () => void;
  /** Turn the pictures arriving here over, and keep them that way. */
  toggleRemoteMirror: () => void;
  /** Whether a phone call currently has the microphone. */
  busy: boolean;
}

/**
 * A room's sound, wired to the room the page is looking at.
 *
 * The stage is a store rather than state because it is driven from two places
 * that do not know about each other: the room's own reads, which say who may
 * speak, and the relay's frames, which carry the descriptions and candidates
 * that actually connect them. Both land here, and the page only ever reads.
 *
 * Everything the mesh needs comes from the room row the page already has, so a
 * room is joined by reading it and there is no second request to keep in step
 * with the first.
 */
export function useRoomStage(input: {
  room: SpaceRoom | undefined;
  selfId: string;
}): RoomSound {
  const { send, subscribe } = useSocket();
  const call = useCall();
  const engine = call.engine;

  const stage = useMemo(
    () =>
      new RoomStage({
        send,
        ice: () => callsService.ice(),
      }),
    // The socket is replaced on a reconnect, and `setSend` below follows it;
    // one stage for the life of the page is what keeps a room's connections
    // through a render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  useEffect(() => {
    stage.setSend(send);
  }, [stage, send]);

  useEffect(() => subscribe((frame) => stage.apply(frame)), [subscribe, stage]);

  const room = input.room;
  // A call has the microphone, and there is one of them per device. A room
  // whose stage opened its own would be the same microphone asked for twice,
  // and on a phone it is the room winning and the call going silent — so the
  // room stands down for as long as the call lasts and comes back by itself
  // when it ends, which is exactly what the phone's own stage does.
  const busy = call.phase === "live" || call.phase === "dialling";

  const people = useMemo(
    () => (room?.stage ?? []).map((person) => String(person.user ?? "")).filter(Boolean),
    [room?.stage],
  );
  const roster = people.join(",");

  useEffect(() => () => stage.close(), [stage]);

  useEffect(() => {
    // A room's stage is a call on the server, so its frames look exactly like a
    // phone call's. This is what keeps them off the 1:1 screen.
    engine.ignoreCall(room?.call_id ?? null);
  }, [engine, room?.call_id]);

  useEffect(() => {
    void stage.open({
      call: room?.call_id ?? null,
      selfId: input.selfId,
      people: roster ? roster.split(",") : [],
      onStage: Boolean(room?.me?.in) && room?.me?.role !== "listener",
      // A room's own word on whether this tab is being heard. A listener the
      // relay has no room for is still in the room; they are simply sent
      // nothing, and this is the flag that says so.
      hears: room?.state === "live" && room?.me?.hears !== false && Boolean(room?.me?.in),
      muted: Boolean(room?.me?.muted),
      camera: Boolean(room?.me?.camera),
      video: room?.kind === "stream",
      busy,
    });
    // `roster` stands in for the stage array, which is a new array on every
    // read of the room.
  }, [
    stage,
    input.selfId,
    room?.call_id,
    room?.state,
    room?.kind,
    room?.me?.in,
    room?.me?.role,
    room?.me?.hears,
    room?.me?.muted,
    room?.me?.camera,
    roster,
    busy,
  ]);

  const state = useSyncExternalStore(stage.subscribe, stage.getSnapshot);

  return {
    state,
    streamFor: (userId: string) => stage.streamFor(userId),
    selfStream: () => stage.selfStream(),
    flipCamera: () => void stage.flipCamera(),
    toggleRemoteMirror: () => stage.toggleRemoteMirror(),
    busy,
  };
}