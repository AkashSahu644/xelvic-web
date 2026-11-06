import { frameData, text } from "@/features/calls/model";
import { videoConstraints } from "@/features/calls/quality";
import type { SocketFrame } from "@/providers/SocketProvider";
import {
  needsRebuild,
  readSignal,
  receiveOnlyKinds,
  whoOffers,
} from "./mesh";

/**
 * The voices in a room.
 *
 * A room's media is a call on the server — the same `calls.Call` a phone call
 * is, with the people who may hear it as its seats — so there is no second
 * permission model here and no new endpoint: an offer, an answer and a handful
 * of candidates go over the same `call.signal` relay a phone call uses, and the
 * server checks every one of them against a seat. This file is only the client
 * half of that: who connects to whom, when a microphone opens, and when it is
 * let go. `app/lib/stage.dart` is the phone's half, and the rules below are its
 * rules.
 *
 * Four of them hold the whole thing up.
 *
 *   * **Arriving is hearing.** A room is a broadcast and there is no join step
 *     between walking into one and the host's voice arriving: the server puts a
 *     new listener into the relay on the way in, and this builds their side of
 *     it the moment the room says they are being heard. That is the whole of
 *     `me.hears` — a listener the relay has no room for is as much in the room
 *     as anybody and is simply not sent anything.
 *
 *   * **A listener is never a publisher.** The half that opens a microphone is
 *     only ever reached from the stage. A listener's browser opens no
 *     microphone, adds no track to any connection and never asks for a camera —
 *     it has connections and nothing to put in them. That is the one accident
 *     this file exists to make impossible: a room of eight hundred people is
 *     eight hundred browsers that must not be sending audio.
 *
 *   * **The lower id offers, and a listener always offers.** See [whoOffers].
 *
 *   * **The camera is decided once, at the door.** A video stream asks for one
 *     and an audio room never does, and the asking happens before the first
 *     connection is built rather than when the camera button is pressed. A
 *     track added to a connection that already exists is a renegotiation, and
 *     this mesh is built to do that exactly never — so turning a camera off and
 *     on again is a track switched off and on, which costs no round trip.
 *
 * Nothing here rings, accepts or leaves the call: a room's call belongs to the
 * room, and the only thing that ends it is the host closing the room.
 */

/** Everything a screen needs to draw the room's sound. */
export interface StageState {
  /** The call behind the room this tab is in, or null when it is in none. */
  call: string | null;
  /** True when this tab is only here to hear it. */
  hearOnly: boolean;
  /** Whether this room carries a picture as well as a voice. */
  video: boolean;
  /** The room's word on my microphone, applied to the track. */
  muted: boolean;
  /** My camera, which is always mine to turn on. */
  onCamera: boolean;
  /** Whether my own picture is drawn as a mirror — the lens's answer alone.
   * See `mirrored()`. */
  mirrored: boolean;
  /** Whether the pictures *arriving* here are drawn mirrored. See
   * `toggleRemoteMirror()`. */
  remoteMirrored: boolean;
  /** Whether a microphone is actually open. */
  live: boolean;
  /** Why the room's sound could not be opened, if it could not. */
  error: string | null;
  /** Bumped when a picture arrives or is let go. */
  version: number;
}

const IDLE: StageState = {
  call: null,
  hearOnly: false,
  video: false,
  muted: false,
  onCamera: false,
  mirrored: true,
  remoteMirrored: false,
  live: false,
  error: null,
  version: 0,
};

/** What the room page tells the mesh every time the room moves. */
export interface StageInput {
  call: string | null;
  selfId: string;
  /** The stage, by user id. The audience is a count and never a list. */
  people: string[];
  onStage: boolean;
  hears: boolean;
  muted: boolean;
  camera: boolean;
  video: boolean;
  /** A phone call has the microphone, so the room stands down until it ends. */
  busy: boolean;
}

export class RoomStage {
  private selfId = "";
  private call: string | null = null;
  private hearOnly = false;
  private video = false;
  private people: string[] = [];

  private mic: MediaStream | null = null;
  private opening: Promise<void> | null = null;
  /** Bumped whenever the room is let go of, so a late microphone is stopped. */
  private era = 0;
  private muted = false;
  private onCamera = false;
  private flipping = false;
  /** The lens the live camera is pointed at, as the browser reports it. */
  private facing: "user" | "environment" | null = null;
  /**
   * Whether the pictures arriving here are drawn mirrored — a choice this
   * person made, and false until they make it. This is a display, not a
   * transmission: nothing here reaches anybody else's screen.
   */
  private remoteMirror = false;

  private links = new Map<string, RTCPeerConnection>();
  private building = new Map<string, Promise<RTCPeerConnection | null>>();
  private described = new Set<string>();
  private queued = new Map<string, RTCIceCandidateInit[]>();
  /** People who offered who are not on the stage — that is, listeners. */
  private audience = new Set<string>();
  private asAudience = new Set<string>();
  private remotes = new Map<string, MediaStream>();

  private servers: RTCIceServer[] | null = null;
  private error: string | null = null;
  private version = 0;

  private listeners = new Set<() => void>();
  private snapshot: StageState = IDLE;

  constructor(
    private input: {
      send: (frame: Record<string, unknown>) => boolean;
      ice: () => Promise<RTCIceServer[]>;
      report?: (line: string) => void;
    },
  ) {}

  /** React's two halves of one store. */
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): StageState => this.snapshot;

  /** The socket, which is rebuilt on a reconnect. */
  setSend(send: (frame: Record<string, unknown>) => boolean) {
    this.input.send = send;
  }

  /** One person's picture or voice, or null before it arrives. */
  streamFor(userId: string): MediaStream | null {
    return this.remotes.get(userId) ?? null;
  }

  /** My own picture, drawn from the stream I am already sending. */
  selfStream(): MediaStream | null {
    return this.mic;
  }

  /**
   * Follow the room, as the room page sees it.
   *
   * Called on every room frame and every read, so it is written as a
   * reconcile: the same room twice changes nothing, and a different one tears
   * the first down before building the second. A phone brought onto the stage
   * is a phone whose connections are the wrong shape — one side of them carries
   * nothing — so it is a rebuild rather than a patch.
   */
  async open(next: StageInput): Promise<void> {
    const call = next.call ?? "";
    // Nothing to be in: no room, a room that has not started, a phone call
    // that has the microphone, or a listener the relay has no room for. The
    // last of those is not a refusal — a room is not something you are refused
    // — it is a listener who is simply not sent anything.
    if (!call || !next.hears || next.busy) {
      this.stand();
      return;
    }
    const hearOnly = !next.onStage;
    if (needsRebuild(this.call ? { call: this.call, hearOnly: this.hearOnly } : null, { call, hearOnly })) {
      this.stand();
    }
    const same = this.call === call;
    this.selfId = next.selfId;
    this.call = call;
    this.hearOnly = hearOnly;
    this.video = next.video;
    // The roster is what the room says about me, and this is where it lands on
    // the tracks: a muted speaker is a disabled track, not a missing one, and
    // the connection stays exactly as it was built.
    this.applyMute(next.muted || hearOnly);
    this.applyCamera(next.camera && next.video);
    this.publish();
    if (hearOnly) {
      this.sync(next.people);
      return;
    }
    if (same && this.mic) {
      this.sync(next.people);
      return;
    }
    const era = this.era;
    await this.openMicrophone();
    if (this.call !== call || this.era !== era) return;
    this.sync(next.people);
  }

  /** Leave the room's sound entirely, and let go of the microphone. */
  close(): void {
    this.stand();
  }

  /** Nobody is signed in any more. */
  forget(): void {
    this.stand();
    this.servers = null;
    this.selfId = "";
  }

  /**
   * One frame off the socket. Anything that is not media for this room is not
   * this store's — every call in the app relays over one event, so a frame
   * about a call this tab is not in is somebody else's.
   */
  apply(frame: SocketFrame) {
    if (frame.event !== "call.signal") return;
    const data = frameData(frame);
    if (!this.call || text(data.call) !== this.call) return;
    const from = text(data.from);
    if (!from || from === this.selfId) return;
    void this.onSignal(from, data.signal);
  }

  /** The room's own word on my microphone, already applied to the track. */
  setMuted(muted: boolean) {
    this.applyMute(muted);
  }

  /** The camera, which is always mine to turn on and the room's to see. */
  setCamera(on: boolean) {
    this.applyCamera(on);
  }

  get busy(): boolean {
    return this.flipping;
  }

  /**
   * Turn the phone round: the front camera for the back one, or back again.
   *
   * The *device* moves under the track that is already being sent, so the
   * sender keeps its track and every connection keeps its one offer — which is
   * the whole reason this can be a button at all. One switch at a time: a
   * second press while the lens is still travelling is the same press arriving
   * twice, and on a phone that is a camera that stops capturing.
   */
  async flipCamera(): Promise<void> {
    const mic = this.mic;
    const track = mic?.getVideoTracks()[0] ?? null;
    if (!mic || !track || this.flipping) return;
    this.flipping = true;
    this.publish();
    try {
      const now = track.getSettings().facingMode;
      const facing = now === "environment" ? "user" : "environment";
      const opened = await navigator.mediaDevices.getUserMedia({
        video: { ...videoConstraints(null), facingMode: facing },
        audio: false,
      });
      const fresh = opened.getVideoTracks()[0] ?? null;
      if (!fresh) return;
      if (this.mic !== mic) {
        fresh.stop();
        return;
      }
      for (const pc of this.links.values()) {
        const sender = pc.getSenders().find((one) => one.track === track);
        if (sender) await sender.replaceTrack(fresh).catch(() => undefined);
      }
      mic.removeTrack(track);
      track.stop();
      mic.addTrack(fresh);
      fresh.enabled = this.onCamera;
      this.readFacing(fresh);
      this.version += 1;
    } catch (error) {
      // The lens did not move, so nothing on screen moves either.
      this.report(`lens: ${String(error)}`);
    } finally {
      this.flipping = false;
      this.publish();
    }
  }

  // ---- the microphone ----------------------------------------------------

  /** One ask at a time: a second prompt open at once is a second device held. */
  private openMicrophone(): Promise<void> {
    if (this.mic) return Promise.resolve();
    if (this.opening) return this.opening;
    const started = this.ask();
    this.opening = started;
    void started.finally(() => {
      if (this.opening === started) this.opening = null;
    });
    return started;
  }

  private async ask(): Promise<void> {
    const era = this.era;
    const wantsVideo = this.video;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: wantsVideo ? videoConstraints(null) : false,
      });
      if (era !== this.era) {
        // The room was let go of while the prompt was open. Nobody will hold
        // this stream, and nobody will put it down either.
        for (const track of stream.getTracks()) track.stop();
        return;
      }
      this.mic = stream;
      for (const track of stream.getVideoTracks()) track.contentHint = "motion";
      this.readFacing(stream.getVideoTracks()[0] ?? null);
      this.applyMute(this.muted);
      this.applyCamera(this.onCamera);
      this.error = null;
    } catch (error) {
      this.error = refusal(error);
    }
    this.publish();
  }

  private applyMute(muted: boolean) {
    const was = this.muted;
    this.muted = muted;
    for (const track of this.mic?.getAudioTracks() ?? []) {
      track.enabled = !muted;
    }
    if (was !== muted) this.publish();
  }

  private applyCamera(on: boolean) {
    const was = this.onCamera;
    this.onCamera = on;
    for (const track of this.mic?.getVideoTracks() ?? []) {
      track.enabled = on;
    }
    if (was !== on) this.publish();
  }

  // ---- the connections ---------------------------------------------------

  /**
   * Make the connections say what the room says.
   *
   * A reconcile rather than paired add and remove calls: people arrive in a
   * room and leave it in six different ways, and six places that each have to
   * remember to undo themselves is six places to forget. The list is the stage
   * and only the stage, which is why `audience` exists — a listener is not on
   * it and is still somebody this tab holds a connection to, so a reconcile
   * that pruned everything it did not recognise would hang up on every listener
   * in the room the moment anything moved.
   */
  private sync(people: string[]) {
    if (!this.call) return;
    this.people = people;
    const here = new Set<string>();
    for (const id of people) {
      if (!id || id === this.selfId) continue;
      here.add(id);
      this.audience.delete(id);
      if (this.links.has(id)) {
        if (!this.asAudience.has(id)) continue;
        // A connection to somebody this tab met in the audience. Their end was
        // invited to send nothing in it, so it carries one voice at most; they
        // are on the stage now, which makes it the wrong connection.
        this.letGo(id);
      }
      if (
        whoOffers({
          mine: this.selfId,
          theirs: id,
          hearOnly: this.hearOnly,
        }) &&
        !this.building.has(id)
      ) {
        void this.offer(id);
      }
    }
    for (const id of [...this.links.keys()]) {
      if (!here.has(id) && !this.audience.has(id)) this.drop(id);
    }
    this.publish();
  }

  private async offer(userId: string): Promise<void> {
    const pc = await this.link(userId);
    if (!pc) return;
    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.signal(userId, { type: "offer", sdp: offer.sdp ?? "" });
    } catch (error) {
      this.report(`offer to ${userId}: ${String(error)}`);
    }
  }

  /**
   * The connection to somebody, built if it is not there already — and built
   * once, because a reconcile runs on every room frame and a second offer is a
   * connection the other end has to tear its own down for.
   */
  private link(
    userId: string,
    audience = false,
  ): Promise<RTCPeerConnection | null> {
    const ready = this.links.get(userId);
    if (ready) return Promise.resolve(ready);
    const already = this.building.get(userId);
    if (already) return already;

    const token: { made: Promise<RTCPeerConnection | null> | null } = {
      made: null,
    };
    const made = this.build(userId).then((pc) => {
      // Nobody is waiting for this one any more: the pair, or the whole room,
      // was let go of while it was being built.
      if (token.made !== made) {
        try {
          pc?.close();
        } catch {
          // Already closed.
        }
        return null;
      }
      this.building.delete(userId);
      if (!pc) return null;
      this.links.set(userId, pc);
      if (audience) this.asAudience.add(userId);
      this.publish();
      return pc;
    });
    token.made = made;
    this.building.set(userId, made);
    return made;
  }

  private async build(userId: string): Promise<RTCPeerConnection | null> {
    const call = this.call;
    if (!call) return null;
    if (typeof RTCPeerConnection === "undefined") {
      this.error = "This browser cannot carry a room's sound.";
      this.publish();
      return null;
    }
    try {
      // The microphone, if one is being asked for. A connection carries the
      // tracks it was built with and this mesh never renegotiates, so an offer
      // answered a breath before the microphone arrives is a connection that
      // carries nothing this tab says for as long as the room lasts.
      if (!this.hearOnly) await this.opening;
      const servers = this.servers ?? (this.servers = await this.input.ice());
      // The room may have ended while the connection was being built.
      if (this.call !== call) return null;
      const pc = new RTCPeerConnection({
        iceServers: servers,
        bundlePolicy: "max-bundle",
        rtcpMuxPolicy: "require",
      });
      if (this.call !== call) {
        pc.close();
        return null;
      }
      const mic = this.mic;
      if (mic) {
        for (const track of mic.getTracks()) pc.addTrack(track, mic);
      } else {
        // A listener names the lines it wants to receive on; see
        // [receiveOnlyKinds].
        for (const kind of receiveOnlyKinds(this.video)) {
          pc.addTransceiver(kind, { direction: "recvonly" });
        }
      }
      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        this.signal(userId, {
          type: "candidate",
          candidate: event.candidate.toJSON(),
        });
      };
      // Their voice, and their picture in a stream. The phone's engine plays a
      // room's audio by itself; a browser plays what an element is handed, so
      // the stream is kept here for the page to draw — an `<audio>` in an audio
      // room, a `<video>` in a stream. Without this a listener is online and
      // hears nothing.
      pc.ontrack = (event) => {
        const stream = event.streams[0];
        if (!stream) return;
        this.remotes.set(userId, stream);
        this.version += 1;
        this.publish();
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState !== "failed") return;
        // Only if this is still the connection for them: a rebuilt pair
        // replaces what is under the same id, and the old one's failure
        // arriving late must not take the new one down with it.
        if (this.links.get(userId) !== pc) return;
        this.drop(userId);
        this.audience.delete(userId);
        // The one who did not offer cannot notice on their own — a listener
        // whose link to the stage died has nobody coming to re-offer at them.
        this.sync(this.people);
      };
      return pc;
    } catch (error) {
      this.error = refusal(error);
      this.report(`link to ${userId}: ${String(error)}`);
      this.publish();
      return null;
    }
  }

  private signal(userId: string, data: Record<string, unknown>) {
    const call = this.call;
    if (!call) return;
    // Fire and forget: answering a signal would put a second frame behind the
    // one that matters on a socket the whole app shares.
    this.input.send({ action: "call.signal", call, to: userId, data });
  }

  private async onSignal(from: string, raw: unknown): Promise<void> {
    const signal = readSignal(raw);
    if (!signal) return;
    if (signal.kind === "offer") {
      try {
        // An offer is always a new session. Nothing here renegotiates, so a
        // second offer from the same phone can only mean they have built the
        // room again — they were brought onto the stage or taken off it, and
        // the connection they had cannot carry what they are now. Letting go
        // first is what makes their rebuild land. The queue is left alone: a
        // candidate that raced this offer belongs to the connection it makes.
        this.letGo(from);
        this.audience.add(from);
        const pc = await this.link(from, !this.people.includes(from));
        if (!pc) return;
        await pc.setRemoteDescription({ type: "offer", sdp: signal.sdp });
        this.described.add(from);
        await this.flush(from);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        this.signal(from, { type: "answer", sdp: answer.sdp ?? "" });
      } catch (error) {
        this.report(`answer to ${from}: ${String(error)}`);
      }
      return;
    }
    if (signal.kind === "answer") {
      const pc = this.links.get(from);
      if (!pc) return;
      try {
        await pc.setRemoteDescription({ type: "answer", sdp: signal.sdp });
        this.described.add(from);
        await this.flush(from);
      } catch (error) {
        this.report(`answer from ${from}: ${String(error)}`);
      }
      return;
    }
    if (!this.described.has(from)) {
      // Candidates race the description that needs them, always. Adding one
      // before the remote description is set throws, and an exception in an ICE
      // callback is a connection that quietly never completes.
      const waiting = this.queued.get(from) ?? [];
      waiting.push(signal.candidate);
      this.queued.set(from, waiting);
      return;
    }
    try {
      await this.links.get(from)?.addIceCandidate(signal.candidate);
    } catch (error) {
      this.report(`candidate from ${from}: ${String(error)}`);
    }
  }

  private async flush(userId: string): Promise<void> {
    const waiting = this.queued.get(userId);
    if (!waiting?.length) return;
    this.queued.delete(userId);
    for (const candidate of waiting) {
      try {
        await this.links.get(userId)?.addIceCandidate(candidate);
      } catch (error) {
        this.report(`queued candidate to ${userId}: ${String(error)}`);
      }
    }
  }

  private drop(userId: string) {
    // Anything still on its way to them goes with them: a candidate queued for
    // a connection nobody has is a candidate with nowhere to land.
    this.queued.delete(userId);
    this.letGo(userId);
  }

  /** Let go of somebody's connection, and keep whatever is still arriving. */
  private letGo(userId: string) {
    const pc = this.links.get(userId);
    this.links.delete(userId);
    this.building.delete(userId);
    this.described.delete(userId);
    this.asAudience.delete(userId);
    this.remotes.delete(userId);
    if (pc) {
      try {
        pc.close();
      } catch {
        // Already closed.
      }
    }
    this.version += 1;
    this.publish();
  }

  /** Leave the room's sound entirely. */
  private stand() {
    const had =
      this.call !== null || this.links.size > 0 || this.mic !== null || this.error !== null;
    this.era += 1;
    this.call = null;
    this.hearOnly = false;
    this.video = false;
    this.people = [];
    this.error = null;
    this.opening = null;
    for (const pc of this.links.values()) {
      try {
        pc.close();
      } catch {
        // Already closed.
      }
    }
    this.links.clear();
    this.building.clear();
    this.described.clear();
    this.queued.clear();
    this.audience.clear();
    this.asAudience.clear();
    this.remotes.clear();
    const stream = this.mic;
    this.mic = null;
    if (stream) {
      for (const track of stream.getTracks()) {
        try {
          track.stop();
        } catch {
          // Already ended.
        }
      }
    }
    this.muted = false;
    this.onCamera = false;
    this.flipping = false;
    this.facing = null;
    this.remoteMirror = false;
    if (had) {
      this.version += 1;
      this.publish();
    }
  }

  // ---- what React reads --------------------------------------------------

  private publish() {
    this.snapshot = {
      call: this.call,
      hearOnly: this.hearOnly,
      video: this.video,
      muted: this.muted,
      onCamera: this.onCamera,
      mirrored: this.mirrored(),
      remoteMirrored: this.remoteMirror,
      live: this.mic !== null,
      error: this.error,
      version: this.version,
    };
    for (const listener of this.listeners) listener();
  }

  /**
   * Whether this tab's own picture is drawn as a mirror.
   *
   * The lens decides, exactly as it does on a call and on the phone: a front
   * lens is a mirror and a back lens is not, because a person who has turned a
   * phone round to show the room something is not asking for it to be shown
   * backwards. A browser reports no facing at all for most webcams, which
   * leaves the default. Nothing overrules this by hand — the Mirror button is
   * about the other people's pictures, not this one.
   */
  private mirrored(): boolean {
    return this.facing !== "environment";
  }

  /**
   * Turn the pictures *arriving* here over, and keep them that way for the
   * room. The owner's report of 2026-11-06: *"mirror par click karne par jo
   * flip ho raha hai wo mere video card me raha hai jabki reciever user video
   * card me hona chahiye"*.
   *
   * This tab's own picture is left alone, exactly as the phone leaves it. This
   * is a display, not a transmission: the tracks going out are untouched, so
   * nobody else's screen changes when this is pressed. A remotely shared screen
   * is turned over too, because a call frame carries no word for whether what
   * is arriving is a camera or a screen.
   */
  toggleRemoteMirror() {
    this.remoteMirror = !this.remoteMirror;
    this.publish();
  }

  /** Read the lens off the track itself. See the same method on `CallEngine`. */
  private readFacing(track: MediaStreamTrack | null) {
    if (!track) return;
    const settings = track.getSettings?.() ?? {};
    const mode = settings.facingMode;
    // The lens moved, so the picture that follows the lens moved with it.
    // Nothing is done here: `mirrored()` reads `facing` on every publish, and
    // the pictures arriving from the room have no lens of their own.
    this.facing =
      mode === "environment" ? "environment" : mode === "user" ? "user" : null;
  }

  private report(line: string) {
    (this.input.report ?? ((one: string) => console.debug(`room: ${one}`)))(line);
  }
}

/** A refusal a person can do something about, from the browser's own names. */
function refusal(error: unknown): string {
  const name = (error as { name?: string } | null)?.name ?? "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Your browser blocked the microphone, so the room's sound is off.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "There is no microphone or camera to use.";
    case "NotReadableError":
      return "Something else is using the microphone or camera.";
    default:
      return "The room's sound could not be opened.";
  }
}