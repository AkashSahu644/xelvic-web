import { callsService, type CallParty, type CallSeat } from "@/services/calls.service";
import type { SocketFrame } from "@/providers/SocketProvider";
import {
  ASK_TIMEOUT_MS,
  DEFAULT_RING_SECONDS,
  GOODBYE_MS,
  callKind,
  frameData,
  goodbyeLine,
  offersAfterCollision,
  partyOf,
  ringSeconds,
  text,
  type CallKind,
  type CallPhase,
} from "./model";
import {
  UNKNOWN_QUALITY,
  audioConstraints,
  deviceLabel,
  readQuality,
  videoConstraints,
  videoSenderParams,
  type CallQuality,
  type StatEntry,
} from "./quality";
import { Ringer } from "./ring";
import { postsCallNotice, callNoticeWords } from "./notice";

/** One camera, microphone or speaker this browser will admit to. */
export interface CallDevice {
  id: string;
  label: string;
}

/** Everything a screen could offer to switch between. */
export interface CallDevices {
  cameras: CallDevice[];
  mics: CallDevice[];
  speakers: CallDevice[];
}

const NO_DEVICES: CallDevices = { cameras: [], mics: [], speakers: [] };

/**
 * The browser's own notification surface, as this engine needs it.
 *
 * An interface rather than a direct import so a test can hold a call without a
 * notification API, and so the one thing the engine does with the surface —
 * post a row when a ring starts and take it down when it stops — is written
 * down in one place. `features/calls/notice.ts` is the real one.
 */
export interface CallNotices {
  show(input: { title: string; body: string; callId: string; kind: CallKind }): void;
  hide(): void;
}

/**
 * A call, as this tab sees it.
 *
 * One object per render, replaced whole whenever anything a screen draws has
 * changed. Streams are *not* in it — a `MediaStream` is a live thing, not a
 * value — so the snapshot carries a `version` that goes up when one arrives or
 * goes away, and the screen reads the stream itself through [streamsFor].
 */
export interface CallSnapshot {
  phase: CallPhase;
  callId: string | null;
  kind: CallKind;
  party: CallParty | null;
  selfId: string;
  muted: boolean;
  cameraOn: boolean;
  /** Why the call ended, for the moment the goodbye is on screen. */
  note: string;
  /** When this end first saw the call go live. */
  since: number | null;
  /** What the microphone or camera refused, if anything. */
  mediaError: string | null;
  /** Bumped when a remote stream arrives or is let go. */
  version: number;
  /** What the browser measures about the link, from its own stats. */
  quality: CallQuality;
  /** The cameras, microphones and speakers it will admit to. */
  devices: CallDevices;
  /** The devices chosen, as device ids. Null is "the browser's own default". */
  cameraId: string | null;
  micId: string | null;
  speakerId: string | null;
  /** Whether this tab is showing its screen rather than its camera. */
  sharing: boolean;
  /** A ring the browser refused to play, waiting for one tap. */
  ringBlocked: boolean;
  /**
   * Which way round this tab's own picture is drawn — the lens's answer alone.
   * See [mirrored].
   */
  mirrored: boolean;
  /**
   * Whether the pictures *arriving* here are drawn mirrored. See
   * [toggleRemoteMirror].
   */
  remoteMirrored: boolean;
  /** The lens the picture above is coming from, when the browser says. */
  facing: Facing;
}

/**
 * Which way a camera points.
 *
 * `null` is the honest answer for most laptops: a webcam reports no facing at
 * all, and a browser that will not say which way its camera looks has to be
 * treated as the one a person is sitting in front of.
 */
export type Facing = "user" | "environment" | null;

type Send = (action: Record<string, unknown>) => boolean;

/**
 * How many rooms' calls to remember to keep off the 1:1 screen.
 *
 * One id per room visit, so this only has to outlast the rooms a tab has open
 * — and the room page re-states its own on every room frame, so a forgotten
 * one comes back the moment the room moves.
 */
const MAX_IGNORED_CALLS = 32;

interface Waiting {
  resolve: () => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

/** Whether this browser can make a call at all. */
export function callsSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.RTCPeerConnection === "function" &&
    typeof navigator !== "undefined" &&
    !!navigator.mediaDevices?.getUserMedia
  );
}

/**
 * The whole of a call that needs a browser: the devices, the connections and
 * the frames, in one place.
 *
 * The server already owns who is on a call and relays every description and
 * candidate between the phones (`apps/calls`); the media itself never touches
 * it. This class is therefore the client half of a protocol rather than its
 * own idea of one: `ring`, `accept`, `signal` and the nine events are the same
 * ones `app/lib/calls.dart` speaks, and the rules that are not obvious — who
 * offers, what happens when two offers cross, where a candidate waits — are
 * the phone's rules, written down where they can be read.
 *
 * Nothing here decides what is true. A call is live when the server says so,
 * a ring it refused is an error and not a silent no-op, and a goodbye this
 * tab could not send is sent again rather than pretended.
 */
export class CallEngine {
  private selfId: string;
  private send: Send;
  private report: (line: string) => void;

  private phase: CallPhase = "idle";
  private callId: string | null = null;
  private kind: CallKind = "audio";
  private party: CallParty | null = null;
  private callerId: string | null = null;
  private answered = false;
  private note = "";
  /** The call the goodbye on screen is about, so it is not resurrected. */
  private overCallId: string | null = null;
  private muted = false;
  private cameraOn = false;
  private since: number | null = null;
  private mediaError: string | null = null;
  private version = 0;
  private ringLength = DEFAULT_RING_SECONDS;

  private local: MediaStream | null = null;
  private opening: Promise<MediaStream | null> | null = null;
  private mediaEra = 0;

  private peers = new Map<string, RTCPeerConnection>();
  private linking = new Map<string, Promise<RTCPeerConnection>>();
  private described = new Set<string>();
  private queued = new Map<string, RTCIceCandidateInit[]>();
  private unsent = new Set<string>();
  private remotes = new Map<string, MediaStream>();

  private waiting = new Map<string, Waiting>();
  /** Requests whose socket was not up when they were made, by ref. */
  private queuedSaid = new Map<string, Record<string, unknown>>();
  private unsaid: Record<string, unknown> | null = null;
  private ref = 0;

  private giveUp: ReturnType<typeof setTimeout> | null = null;
  private goodbye: ReturnType<typeof setTimeout> | null = null;

  private icePromise: Promise<RTCIceServer[]> | null = null;

  /** Calls this tab is not on and must never take: a room's stage is a call. */
  private ignored = new Set<string>();

  /** The ring, the row on the notification surface, and what they need. */
  private ringer: Ringer;
  private notices: CallNotices;
  /** The phase a sound was last started for, so one phase rings once. */
  private rangFor: CallPhase | null = null;
  /** The call a notification row was posted for, so it is posted once. */
  private noticedCall: string | null = null;

  private quality: CallQuality = UNKNOWN_QUALITY;
  private qualityTimer: ReturnType<typeof setInterval> | null = null;
  private devices: CallDevices = NO_DEVICES;
  private cameraId: string | null = null;
  private micId: string | null = null;
  private speakerId: string | null = null;
  private sharing = false;
  private display: MediaStreamTrack | null = null;
  /** The lens the live camera is pointed at, as the browser reports it. */
  private facing: Facing = null;
  /**
   * Whether the pictures arriving here are drawn mirrored — a choice this
   * person made, and false until they make it.
   *
   * There is nothing to follow here the way there is for a self-view: a
   * received picture is drawn as it was sent, which is what the phone does with
   * every picture that is not its own. See [toggleRemoteMirror] for why there
   * is a switch at all.
   */
  private remoteMirror = false;

  private listeners = new Set<() => void>();
  private snapshot: CallSnapshot;

  constructor(input: {
    selfId: string;
    send: Send;
    report?: (line: string) => void;
    ringer?: Ringer;
    notices?: CallNotices;
  }) {
    this.selfId = input.selfId;
    this.send = input.send;
    this.report = input.report ?? ((line) => console.debug(`calls: ${line}`));
    this.ringer = input.ringer ?? new Ringer();
    this.notices = input.notices ?? { show: () => undefined, hide: () => undefined };
    this.ringer.onBlocked = () => {
      this.ringBlocked = true;
      this.publish();
    };
    this.snapshot = this.buildSnapshot();
  }

  // ---- what React reads --------------------------------------------------

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  };

  getSnapshot = (): CallSnapshot => this.snapshot;

  /** The picture from one person on the call, or null before it arrives. */
  streamFor(userId: string): MediaStream | null {
    return this.remotes.get(userId) ?? null;
  }

  /** This tab's own microphone and camera, for the small self view. */
  selfStream(): MediaStream | null {
    return this.local;
  }

  setSelfId(selfId: string) {
    if (this.selfId === selfId) return;
    this.selfId = selfId;
    this.publish();
  }

  /**
   * Never treat this call as one of this tab's.
   *
   * This is what keeps a room's stage — which the server models as a call, and
   * whose frames therefore look exactly like a phone call's — off the 1:1
   * screen. It is a standing statement about an id rather than a mode, because
   * the frames that would take over the screen can arrive at any moment, and
   * because a room the tab walks back into has to still be ignored.
   */
  ignoreCall(callId: string | null | undefined) {
    if (!callId || this.ignored.has(callId)) return;
    this.ignored.add(callId);
    if (this.ignored.size > MAX_IGNORED_CALLS) {
      const oldest = this.ignored.values().next().value;
      if (oldest !== undefined) this.ignored.delete(oldest);
    }
  }

  /** Whether a call id is one this screen has been told to leave alone. */
  ignores(callId: string | null | undefined): boolean {
    return !!callId && this.ignored.has(callId);
  }

  // ---- the buttons -------------------------------------------------------

  /** Whether this tab is already doing something with a call. */
  get busy(): boolean {
    return this.phase !== "idle" && this.phase !== "over";
  }

  /**
   * Ring somebody.
   *
   * The devices are opened now, while the call is nothing but a ring: a
   * microphone and a camera opened only when somebody picks up are opened at
   * the worst possible moment — after the answer, in front of a person who is
   * already waiting. During the ring nothing is waiting on them.
   */
  async ring(userId: string, kind: CallKind) {
    if (this.busy || !userId) return;
    this.kind = kind;
    this.phase = "dialling";
    this.note = "";
    this.answered = false;
    this.party = null;
    this.mediaError = null;
    this.armGiveUp();
    void this.openMedia();
    this.publish();
    try {
      await this.ask("call.ring", { user: userId, kind });
    } catch (error) {
      this.reset();
      throw error;
    }
  }

  /**
   * Pick up.
   *
   * The devices and the answer go out together. Nothing about the answer needs
   * the stream — the server marks the seat and tells the caller, and the offer
   * comes when whoever offers is ready — so waiting for a camera before saying
   * "answered" would spend the caller's ring on it.
   *
   * This end does not offer: the people already in the call offer to the
   * newcomer, which is the half of the handshake that keeps two ends from
   * offering at once. The connection is still built here, so it is ready when
   * the offer lands.
   */
  async pickUp() {
    const id = this.callId;
    if (!id || this.phase !== "ringing") return;
    this.stopGiveUp();
    this.phase = "live";
    this.note = "";
    this.since = Date.now();
    this.answered = true;
    this.publish();
    void this.openMedia();
    if (this.callerId) void this.preLink(this.callerId);
    try {
      await this.ask("call.accept", { call: id });
    } catch (error) {
      this.reset();
      throw error;
    }
  }

  /** Turn down a ring. */
  async turnDown() {
    // A decline pressed on a row for a call that has already gone is not a
    // decline of anything, and telling the server about a call it has ended is
    // a refusal waiting to be logged.
    if (this.phase !== "ringing") return;
    const id = this.callId;
    this.stopGiveUp();
    this.reset();
    if (!id) return;
    try {
      await this.ask("call.decline", { call: id });
    } catch (error) {
      this.report(`decline: ${String(error)}`);
    }
  }

  /**
   * Hang up, or leave a call that carries on without this tab.
   *
   * Media goes first, so the camera light is off before the round trip: a
   * person who pressed the red button has stopped being on camera.
   */
  async hangUp(because?: string) {
    const id = this.callId;
    this.stopGiveUp();
    this.closeMedia();
    if (this.phase === "dialling" || this.phase === "live") {
      this.finish(because ?? "Call ended");
    } else {
      this.reset();
    }
    if (!id) return;
    this.leave(id);
  }

  toggleMute() {
    this.muted = !this.muted;
    const tracks = this.local?.getAudioTracks() ?? [];
    for (const track of tracks) track.enabled = !this.muted;
    this.publish();
  }

  /**
   * The camera button, on either kind of call.
   *
   * On a video call it is the switch it has always been. On an audio call
   * there is no camera to switch — yet — so it is the way into one: the call
   * becomes a video call for everybody and this tab turns a picture on. One
   * control either way, because from the outside it is one decision: *I would
   * like there to be video.*
   */
  toggleCamera() {
    const tracks = this.local?.getVideoTracks() ?? [];
    if (this.cameraOn && tracks.length) {
      this.cameraOn = false;
      for (const track of tracks) track.enabled = false;
      this.publish();
      return;
    }
    if (tracks.length) {
      // A camera this tab already opened and switched off. No negotiation:
      // the line is already there, and a muted track and a stopped one look
      // the same to the other end.
      this.cameraOn = true;
      for (const track of tracks) track.enabled = true;
      this.publish();
      return;
    }
    if (this.kind !== "video") {
      void this.wantVideo();
      return;
    }
    void this.turnCameraOn();
  }

  /**
   * Move an audio call to video, from this tab.
   *
   * The server is told first, because it is the server's frame that makes this
   * a video call for everybody — and a camera opened before it would be a
   * light on somebody's phone for a call that is still an audio call. The
   * frame that comes back names this tab as the one with something to send,
   * and that is where the camera opens.
   */
  private async wantVideo() {
    const id = this.callId;
    if (!id || this.phase !== "live" || this.kind === "video") return;
    try {
      await this.ask("call.video", { call: id });
    } catch (error) {
      this.report(`video: ${String(error)}`);
    }
  }

  // ---- frames ------------------------------------------------------------

  /**
   * One frame off the socket. Anything that is not about a call is not ours.
   *
   * This is the whole input of the state machine, so a test — or a person
   * reading it — can follow a call from ring to goodbye without a server on
   * the other end.
   */
  apply(frame: SocketFrame) {
    const data = frameData(frame);
    /*
     * A room's stage is a `calls.Call` like any other, so every frame about it
     * arrives on this one socket under these same event names — and the room's
     * own mesh is what speaks them. `adopt` below takes a party for any call
     * while this tab is idle, so a single `call.joined` out of a room would put
     * that room on the 1:1 screen and answer it: a microphone opened, media
     * negotiated and candidates relayed for a conversation this screen has no
     * business in. The room page names its call with [ignoreCall] so none of it
     * reaches here. It is a gate and not a filter on the room's side because
     * the two halves are told apart by the call id alone, and this is the only
     * place every id passes through.
     */
    if (frame.event !== "call.ok" && frame.event !== "error") {
      const about = text(data.call);
      if (about && this.ignored.has(about)) return;
    }
    switch (frame.event) {
      case "call.ok":
        this.settle(text(data.ref), null, data);
        return;
      case "error": {
        const ref = text(data.ref);
        if (ref && this.waiting.has(ref)) {
          const message = text(data.message) ?? "That did not go through.";
          this.settle(ref, new Error(message));
        }
        return;
      }
      case "call.ringing":
        this.adopt(data, "dialling");
        return;
      case "call.incoming":
        this.incoming(data);
        return;
      case "call.accepted":
        if (!this.adopt(data, "live")) return;
        void this.openMedia();
        return;
      case "call.joined":
        this.joined(data);
        return;
      case "call.video":
        this.video(data);
        return;
      /*
       * The three goodbyes ask the same question `call.signal` asks below, and
       * for the same reason: every call in the app relays over one event — a
       * room's stage is a call too — so a frame about a call this tab is not
       * on is not this tab's. A goodbye is the one that hurts, because it is
       * the only one that tears something down: an older call's `call.ended`
       * arriving after this tab has picked up the next one would close the
       * call it is actually on.
       */
      case "call.declined":
        if (text(data.call) !== this.callId) return;
        this.left(text(data.user));
        return;
      case "call.left":
        if (text(data.call) !== this.callId) return;
        this.left(text(data.user));
        return;
      case "call.ended":
        if (text(data.call) !== this.callId) return;
        this.ended(data);
        return;
      case "call.signal": {
        if (text(data.call) !== this.callId) return;
        const from = text(data.from);
        if (!from) return;
        void this.onSignal(from, data.signal);
        return;
      }
      default:
        return;
    }
  }

  /**
   * The socket has come up — say whatever could not be said without it.
   *
   * A request sent before there is a socket is a request nothing hears, and
   * the one request in this app that cannot afford that is a person's own
   * answer to a ringing phone. A goodbye that failed goes out here for the
   * same reason: leaving a call is the one frame that must not be dropped.
   */
  onSocketLive() {
    for (const [ref, frame] of this.queuedSaid) {
      if (this.waiting.has(ref) && this.send(frame)) this.queuedSaid.delete(ref);
    }
    if (this.unsaid && this.send(this.unsaid)) this.unsaid = null;
    // A phone asking whether anybody is still ringing it, which it does the
    // moment the socket comes up and again whenever the tab comes to the
    // front. A ring is the one frame that cannot wait to be collected.
    if (this.phase === "idle") this.send({ action: "call.pending" });
  }

  /**
   * Ask the server whether anybody is still ringing this tab.
   *
   * Safe at any time: a tab with nobody ringing it is told by the silence.
   */
  askPending() {
    if (this.phase !== "idle") return;
    this.send({ action: "call.pending" });
  }

  /**
   * Read one call back from the server, after a socket that missed its frames.
   *
   * The socket may have been down across the moment somebody joined or left;
   * the call's own state is the only honest source for who is here now, which
   * is why `GET /calls/<id>/` exists. A 404 means this tab is not on the call
   * any more, which is the same news as it ending.
   */
  async resync() {
    const id = this.callId;
    if (!id || this.phase === "idle" || this.phase === "over") return;
    try {
      const { call } = await callsService.detail(id);
      if (this.callId !== id) return;
      if (call.state === "ended") {
        this.ended({ call: id, by: null });
        return;
      }
      this.adopt(call as unknown as Record<string, unknown>, this.phase);
    } catch (error) {
      this.report(`resync: ${String(error)}`);
    }
  }

  private incoming(data: Record<string, unknown>) {
    const id = text(data.call);
    if (!id) return;
    // A call somebody else is placing while the last one is still saying
    // goodbye on this screen is not a second call: `over` is a call that has
    // already ended, and a tab that declined the next one because of it would
    // drop a real ring for a second and a half of wording.
    if (this.phase !== "idle" && this.phase !== "over" && id !== this.callId) {
      this.send({ action: "call.decline", call: id });
      return;
    }
    const fresh = id !== this.callId;
    // The other half of a repeat: a frame for a call this tab has already
    // picked up is the missing half of the news — who is calling, of what kind
    // — and never a reason to go back to ringing.
    const answeredHere = !fresh && this.phase === "live";
    if (fresh) {
      this.answered = false;
      this.note = "";
      this.since = null;
    }
    this.callId = id;
    const taken = this.adopt(data, answeredHere ? "live" : "ringing");
    const from = (data.from ?? {}) as Record<string, unknown>;
    const caller = text(from.user) ?? text(data.caller);
    if (caller) this.callerId = caller;
    let added = false;
    if (!this.party?.members?.some((seat) => seat.user === this.callerId)) {
      // The caller is always a member of their own call, so this should not
      // happen; drawing them from `from` is the honest fallback.
      const seat: CallSeat = {
        user: this.callerId ?? "",
        state: "joined",
        name: text(from.name) ?? text(from.username) ?? "",
        username: text(from.username) ?? "",
        avatar: text(from.avatar),
      };
      this.party = {
        ...(this.party ?? { call: id }),
        members: [...(this.party?.members ?? []), seat],
      };
      added = true;
    }
    this.armGiveUp();
    if (!taken || added) this.publish();
  }

  /**
   * Take a party frame: who is in this call, and what kind of call it is.
   *
   * Returns whether the frame was ours to take. There is one socket for the
   * whole app and every call frame arrives on it, so this is the one gate that
   * decides which of them this tab is allowed to act on — a frame about
   * somebody else's call would take over a conversation this tab cannot even
   * hear.
   */
  private adopt(data: Record<string, unknown>, phase: CallPhase): boolean {
    const party = partyOf(data);
    if (!party) return false;
    if (this.callId !== null && party.call !== this.callId) return false;
    this.callId = party.call;
    const host = text(data.caller);
    if (host) this.callerId = host;
    this.kind = callKind(data.kind ?? this.kind);
    if (Array.isArray(data.members)) this.party = party;
    this.ringLength = ringSeconds(party);
    if (phase === "live" && this.since === null) this.since = Date.now();
    // A call that is saying goodbye is not moved back onto the screen by a
    // frame about itself arriving late — the goodbye is the last word on it,
    // and the first reason for it wins. A frame about a *different* call is a
    // new ring, which is the one thing that must still be drawn.
    const held =
      this.phase === "over" && phase !== "over" && party.call === this.overCallId;
    if (phase !== this.phase && !held) this.phase = phase;
    this.publish();
    return true;
  }

  /**
   * Somebody arrived. For the people already here this is the moment the call
   * becomes a call: without it the caller's screen says "Ringing" for the
   * whole conversation, because the only frame that ever says "answered" is
   * the one sent to the person who answered.
   */
  private joined(data: Record<string, unknown>) {
    const arrived = text(data.joined);
    if (!this.adopt(data, arrived === null ? this.phase : "live")) return;
    if (arrived && arrived !== this.selfId) {
      void this.openMedia();
      void this.offerTo(arrived);
    }
  }

  /**
   * Somebody turned a camera on. The call is a video call now — and this tab
   * is the one that negotiated it, so this tab opens its camera and offers the
   * new line.
   */
  private video(data: Record<string, unknown>) {
    if (!this.adopt(data, this.phase)) return;
    const by = text(data.video);
    if (by !== this.selfId) return;
    void this.turnCameraOn();
  }

  private left(userId: string | null) {
    if (!userId) return;
    void this.drop(userId);
    if (this.party?.members) {
      this.party = {
        ...this.party,
        members: this.party.members.map((seat) =>
          seat.user === userId ? { ...seat, state: "left" } : seat,
        ),
      };
    }
    this.publish();
  }

  private ended(data: Record<string, unknown>) {
    const why = goodbyeLine({
      phase: this.phase,
      by: text(data.by),
      selfId: this.selfId,
      answered: this.answered,
      party: this.party,
    });
    this.closeMedia();
    this.finish(why);
  }

  // ---- peer connections --------------------------------------------------

  private async preLink(userId: string) {
    try {
      await this.link(userId);
    } catch (error) {
      this.report(`pre-link: ${String(error)}`);
    }
  }

  /**
   * The connection to one person, built once.
   *
   * Two things reach for it in the same breath: the pre-link that starts the
   * handshake early and the offer that goes out when the call is answered.
   * The map is only filled at the *end* of the build, so without the second
   * map the second caller would find nothing there, build a second connection
   * and overwrite the first — two half-calls whose candidates both go out
   * under one name.
   */
  private link(userId: string): Promise<RTCPeerConnection> {
    const existing = this.peers.get(userId);
    if (existing) return Promise.resolve(existing);
    const running = this.linking.get(userId);
    if (running) return running;
    const started = this.buildLink(userId);
    this.linking.set(userId, started);
    return started.finally(() => {
      if (this.linking.get(userId) === started) this.linking.delete(userId);
    });
  }

  private async buildLink(userId: string): Promise<RTCPeerConnection> {
    // A connection is built across several awaits — the microphone, the
    // relay's address, the platform's own object — and a call can end in the
    // middle of any of them. What comes back then is a connection nothing is
    // waiting for, and left in the map it would be a microphone still open
    // after the call it was opened for. The era is raised by [closeMedia] for
    // exactly this.
    const era = this.mediaEra;
    const ice = this.iceServers();
    const stream = this.local ?? (await this.openMedia());
    const pc = new RTCPeerConnection({ iceServers: await ice });
    if (era !== this.mediaEra) {
      pc.close();
      throw new Error("the call ended while its connection was being built");
    }
    this.peers.set(userId, pc);

    // No microphone and no camera still leaves a connection worth having — but
    // only once the offer says what this tab means to receive. A connection
    // with no tracks and no transceivers has no m-lines at all, so an offer
    // from a tab that was refused its devices would be an SDP with nothing in
    // it, and the other end would have no line to send on. The receiving
    // transceiver is told what the picture may cost, so a tab with no camera of
    // its own still asks for a good one.
    if (stream) {
      for (const track of stream.getTracks()) {
        const sender = pc.addTrack(track, stream);
        await this.tune(sender);
      }
    } else {
      const tuning = videoSenderParams();
      pc.addTransceiver("audio", { direction: "recvonly" });
      if (this.kind === "video") {
        pc.addTransceiver("video", {
          direction: "recvonly",
          sendEncodings: [{ maxBitrate: tuning.maxBitrate, maxFramerate: tuning.maxFramerate }],
        });
      }
    }

    pc.onicecandidate = (event) => {
      if (!event.candidate) return;
      this.signal(userId, {
        type: "candidate",
        candidate: event.candidate.toJSON(),
      });
    };

    pc.ontrack = (event) => {
      const remote = event.streams[0] ?? new MediaStream([event.track]);
      this.remotes.set(userId, remote);
      this.version += 1;
      this.publish();
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed") {
        void this.drop(userId);
      } else if (pc.connectionState === "connected") {
        this.publish();
      }
    };

    return pc;
  }

  private async drop(userId: string) {
    const pc = this.peers.get(userId);
    this.peers.delete(userId);
    this.described.delete(userId);
    this.queued.delete(userId);
    const had = this.remotes.delete(userId);
    if (had) this.version += 1;
    if (pc) {
      try {
        pc.close();
      } catch {
        // Already closed. Nothing to do.
      }
    }
    this.publish();
  }

  /**
   * Start the negotiation with one person.
   *
   * An offer is never made on a connection that already has one of ours in the
   * air: two offers from one tab to one tab is a negotiation racing itself,
   * and the second would be read by the other end against a description that
   * has already moved on. A call that has something new to send while an offer
   * is out says so in `unsent` instead, and the answer is what brings it back
   * here.
   */
  private async offerTo(userId: string) {
    try {
      const pc = await this.link(userId);
      if (pc.signalingState === "have-local-offer") return;
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      this.unsent.delete(userId);
      this.signal(userId, { type: "offer", sdp: offer.sdp });
    } catch (error) {
      this.report(`offer to ${userId}: ${String(error)}`);
    }
  }

  /** Pay what this tab owes a connection, if the moment has come. */
  private async catchUp(userId: string) {
    if (!this.unsent.has(userId)) return;
    await this.offerTo(userId);
  }

  private async onSignal(from: string, signal: unknown) {
    if (!from || !signal || typeof signal !== "object") return;
    const data = signal as Record<string, unknown>;
    try {
      switch (data.type) {
        case "offer": {
          const pc = await this.link(from);
          if (pc.signalingState === "have-local-offer") {
            // Two offers crossed on the wire. Neither can be applied — a
            // description cannot be read against a connection that is midway
            // through describing itself — so the connection is thrown away
            // and one of them starts again, on a rule both ends can work out
            // alone and reach opposite answers to: the higher id offers.
            await this.drop(from);
            if (offersAfterCollision(this.selfId, from)) {
              await this.offerTo(from);
            } else {
              this.unsent.add(from);
            }
            return;
          }
          await pc.setRemoteDescription({
            type: "offer",
            sdp: text(data.sdp) ?? "",
          });
          this.described.add(from);
          await this.flush(from);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          this.signal(from, { type: "answer", sdp: answer.sdp });
          return;
        }
        case "answer": {
          const pc = this.peers.get(from);
          if (!pc) return;
          await pc.setRemoteDescription({
            type: "answer",
            sdp: text(data.sdp) ?? "",
          });
          this.described.add(from);
          await this.flush(from);
          await this.catchUp(from);
          return;
        }
        case "candidate": {
          const raw = data.candidate;
          if (!raw || typeof raw !== "object") return;
          const candidate = raw as RTCIceCandidateInit;
          if (!this.described.has(from)) {
            // Candidates race the description that needs them. `addIceCandidate`
            // before `setRemoteDescription` rejects, and a rejection in an ICE
            // callback is a call that connects to nothing, so they wait here
            // and go in the moment there is something to add them to.
            const waiting = this.queued.get(from) ?? [];
            waiting.push(candidate);
            this.queued.set(from, waiting);
            return;
          }
          const pc = this.peers.get(from);
          if (!pc) return;
          await pc.addIceCandidate(candidate);
          return;
        }
        default:
          return;
      }
    } catch (error) {
      this.report(`signal from ${from}: ${String(error)}`);
    }
  }

  /**
   * Send what was queued while there was nowhere to put it. Called after both
   * descriptions are set: the queue is only safe to empty once the remote
   * description exists.
   */
  private async flush(userId: string) {
    const waiting = this.queued.get(userId);
    if (!waiting) return;
    this.queued.delete(userId);
    const pc = this.peers.get(userId);
    if (!pc) return;
    for (const candidate of waiting) {
      try {
        await pc.addIceCandidate(candidate);
      } catch (error) {
        this.report(`queued candidate to ${userId}: ${String(error)}`);
      }
    }
  }

  private signal(userId: string, data: Record<string, unknown>) {
    const id = this.callId;
    if (!id) return;
    // Fire and forget. The reply to a signal is silence by design: answering
    // the sender would put a second frame behind the one that matters on a
    // socket the whole app shares.
    this.send({ action: "call.signal", call: id, to: userId, data });
  }

  // ---- the devices -------------------------------------------------------

  /**
   * The microphone, and the camera when this is a video call.
   *
   * Echo cancellation and the other two are not decoration: a machine whose
   * speakers are open will otherwise hear itself, and the delay between the
   * two ends turns that into an echo that builds.
   *
   * Returns null when the devices are refused — a microphone somebody said no
   * to, a camera another app is holding — and says so in `mediaError` rather
   * than throwing into a caller that is not looking. The half of the call that
   * can still work does.
   *
   * The one ask is shared: two things reach for it at once on the caller's
   * side, and the stream is only set once the browser has answered.
   */
  private openMedia(): Promise<MediaStream | null> {
    if (this.local) return Promise.resolve(this.local);
    if (this.opening) return this.opening;
    const era = this.mediaEra;
    const video = this.kind === "video";
    const started = this.fetchMedia(era, video);
    this.opening = started;
    return started.finally(() => {
      if (this.opening === started) this.opening = null;
    });
  }

  private async fetchMedia(era: number, video: boolean): Promise<MediaStream | null> {
    if (!callsSupported()) {
      this.mediaError = "This browser cannot reach a microphone or a camera.";
      this.publish();
      return null;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: audioConstraints(this.micId),
        video: video ? videoConstraints(this.cameraId) : false,
      });
    } catch (error) {
      this.mediaError = mediaRefusal(error);
      this.publish();
      return null;
    }
    if (era !== this.mediaEra) {
      // The call this was for is over. Nobody will hold this stream and nobody
      // will put it down either, so it is stopped here — or the camera stays on
      // with nothing on screen to say so.
      for (const track of stream.getTracks()) track.stop();
      return null;
    }
    this.local = stream;
    this.muted = false;
    // Only a call that asked for a camera has one. An audio call that opened
    // one here would be a lit lens for the whole conversation.
    this.cameraOn = video;
    for (const track of stream.getVideoTracks()) track.contentHint = "motion";
    this.mediaError = null;
    this.version += 1;
    this.publish();
    // The labels a device menu draws are only handed over once permission has
    // been given, so the list is read again here rather than at boot.
    void this.listDevices();
    return stream;
  }

  /**
   * Open this tab's camera and offer it to everybody on the call.
   *
   * The offer half of the upgrade, and the only thing in the app that puts a
   * new line into a connection that already exists. A track can reach another
   * tab solely through an offer that names it — an answer cannot open a line
   * the offer never had — so the tab whose camera this is does the offering.
   */
  private async turnCameraOn() {
    if (!this.callId || this.phase !== "live") return;
    const track = await this.openCamera();
    if (!track) return;
    // The new line only reaches a connection it was added to. The offer that
    // follows names it; an offer that did not would be a picture nobody sees.
    const stream = this.local ?? new MediaStream([track]);
    for (const [userId, pc] of [...this.peers.entries()]) {
      let sender = pc.getSenders().find((one) => one.track === track);
      if (!sender) sender = pc.addTrack(track, stream);
      await this.tune(sender);
      await this.offerTo(userId);
    }
  }

  /**
   * Tell one sender what its picture should cost, and what matters more.
   *
   * Left alone, an encoder is free to keep the frame rate by throwing away
   * resolution the moment the link dips — a face that turns to mush is that
   * decision, and `degradationPreference: "maintain-resolution"` is the
   * opposite one. `maxBitrate` is what the picture is allowed to spend; see
   * `quality.ts` for where the number comes from. A browser that refuses any of
   * it is a browser that keeps its own defaults, which is not an error worth a
   * word to anybody.
   */
  private async tune(sender: RTCRtpSender | null | undefined): Promise<void> {
    if (!sender?.track) return;
    if (sender.track.kind === "video") {
      sender.track.contentHint = this.sharing ? "detail" : "motion";
    }
    try {
      const parameters = sender.getParameters();
      if (!parameters.encodings || parameters.encodings.length === 0) {
        parameters.encodings = [{}];
      }
      if (sender.track.kind === "video") {
        const tuning = videoSenderParams();
        parameters.degradationPreference = tuning.degradationPreference;
        parameters.encodings[0].maxBitrate = tuning.maxBitrate;
        parameters.encodings[0].maxFramerate = tuning.maxFramerate;
      }
      await sender.setParameters(parameters);
    } catch (error) {
      // Safari refuses `degradationPreference`, and a sender that was never
      // negotiated has nothing to set. Both are the browser's own defaults.
      this.report(`sender: ${String(error)}`);
    }
  }

  private async openCamera(): Promise<MediaStreamTrack | null> {
    const have = this.local?.getVideoTracks() ?? [];
    if (have.length) {
      for (const track of have) track.enabled = true;
      this.cameraOn = true;
      this.publish();
      return have[0];
    }
    if (!callsSupported()) {
      this.mediaError = "This browser cannot reach a camera.";
      this.publish();
      return null;
    }
    let camera: MediaStream;
    try {
      camera = await navigator.mediaDevices.getUserMedia({
        video: videoConstraints(this.cameraId),
      });
    } catch (error) {
      this.mediaError = mediaRefusal(error);
      this.publish();
      return null;
    }
    const track = camera.getVideoTracks()[0] ?? null;
    if (!track) return null;
    track.contentHint = "motion";
    this.readFacing(track);
    if (this.local) {
      this.local.addTrack(track);
    } else {
      // A call whose microphone was refused can still send a picture.
      this.local = new MediaStream([track]);
    }
    this.cameraOn = true;
    this.mediaError = null;
    this.version += 1;
    this.publish();
    void this.listDevices();
    return track;
  }

  private iceServers(): Promise<RTCIceServer[]> {
    if (!this.icePromise) {
      this.icePromise = callsService.ice().catch((error: unknown) => {
        // A tab with no relay address is a tab that connects only when the two
        // networks happen to meet; it is not a reason to refuse the call.
        this.report(`ice: ${String(error)}`);
        this.icePromise = null;
        return [];
      });
    }
    return this.icePromise;
  }

  // ---- the clock ---------------------------------------------------------

  /**
   * Arm the clock that ends a ring nobody answers.
   *
   * The server closes a stale ring only when the caller next rings, which may
   * be never, so both ends give up on their own: the callee stops ringing, and
   * the caller stops waiting on somebody who is not going to answer. The
   * window is the server's own `ring_seconds` as it arrives on the party
   * frame, so the two ends cannot disagree about how long a ring lasts.
   */
  private armGiveUp() {
    if (this.phase !== "ringing" && this.phase !== "dialling") return;
    this.stopGiveUp();
    this.giveUp = setTimeout(() => this.stopRinging(), this.ringLength * 1000);
  }

  private stopRinging() {
    if (this.phase === "ringing") {
      void this.turnDown();
    } else if (this.phase === "dialling") {
      void this.hangUp("No answer");
    }
  }

  private stopGiveUp() {
    if (this.giveUp) clearTimeout(this.giveUp);
    this.giveUp = null;
  }

  /**
   * Leave the screen, or show it saying why for a moment first.
   *
   * The first reason wins. This tab usually knows before the server says — it
   * knows a ring ran out, and it knows the call it just cancelled — and a later
   * frame must not talk it out of the better answer.
   */
  private finish(why: string) {
    if (this.phase === "idle" || this.phase === "over") return;
    this.stopGiveUp();
    if (!this.note) this.note = why;
    this.phase = "over";
    this.overCallId = this.callId;
    this.publish();
    if (this.goodbye) clearTimeout(this.goodbye);
    this.goodbye = setTimeout(() => {
      if (this.phase === "over") this.reset();
    }, GOODBYE_MS);
  }

  private reset() {
    this.stopGiveUp();
    if (this.goodbye) clearTimeout(this.goodbye);
    this.goodbye = null;
    this.closeMedia();
    for (const waiter of this.waiting.values()) {
      clearTimeout(waiter.timer);
      waiter.resolve();
    }
    this.waiting.clear();
    this.queuedSaid.clear();
    this.unsaid = null;
    this.phase = "idle";
    this.callId = null;
    this.overCallId = null;
    this.callerId = null;
    this.kind = "audio";
    this.party = null;
    this.answered = false;
    this.note = "";
    this.muted = false;
    this.cameraOn = false;
    this.since = null;
    this.mediaError = null;
    this.ringLength = DEFAULT_RING_SECONDS;
    this.version += 1;
    this.publish();
  }

  /**
   * Let the devices go, and every connection with them.
   *
   * Everything a call opened is closed here, and that includes the things that
   * are not tracks: a ring still playing after the call ended, a notification
   * row still asking somebody to answer a call nobody is on, and the timer that
   * reads stats from connections that have just been closed. Each of them
   * outlives its call if it is not stopped here, and each of them shows.
   */
  private closeMedia() {
    this.mediaEra += 1;
    this.rangFor = null;
    this.ringer.stop();
    if (this.noticedCall) {
      this.noticedCall = null;
      this.notices.hide();
    }
    if (this.qualityTimer) {
      clearInterval(this.qualityTimer);
      this.qualityTimer = null;
    }
    this.quality = UNKNOWN_QUALITY;
    this.display = null;
    this.sharing = false;
    // A lens and a mirror belong to the call they were chosen in. The next call
    // opens whichever camera the browser offers and decides again — and the
    // pictures arriving there are drawn as they are sent until somebody says
    // otherwise, which is a switch over somebody else's picture and not a
    // setting.
    this.facing = null;
    this.remoteMirror = false;
    for (const pc of this.peers.values()) {
      try {
        pc.close();
      } catch {
        // Already closed. Nothing to do.
      }
    }
    this.peers.clear();
    this.linking.clear();
    this.described.clear();
    this.queued.clear();
    this.unsent.clear();
    this.remotes.clear();
    const stream = this.local;
    this.local = null;
    this.opening = null;
    if (stream) {
      for (const track of stream.getTracks()) {
        try {
          track.stop();
        } catch {
          // A track that is already ended is not an error.
        }
      }
    }
    this.version += 1;
  }

  /** Signing out. There is no call any more, and nothing to say about one. */
  forget() {
    this.reset();
    this.icePromise = null;
  }

  // ---- the reply dance ---------------------------------------------------

  /**
   * Send one call action and wait for the server's word on it.
   *
   * Errors arrive on this socket as a frame of their own rather than as a
   * failed request, so the `ref` is what ties the two together — without it a
   * refusal would be indistinguishable from somebody else's.
   */
  private ask(action: string, body: Record<string, unknown>): Promise<void> {
    const ref = `call-web-${++this.ref}`;
    return new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiting.delete(ref);
        this.queuedSaid.delete(ref);
        reject(new Error("The server did not answer."));
      }, ASK_TIMEOUT_MS);
      this.waiting.set(ref, { resolve, reject, timer });
      const said = { action, ref, ...body };
      // A request sent before there is a socket is a request nothing hears.
      // It is said again the moment a socket comes up, once, and only if no
      // answer has arrived — the first send may have been heard after all.
      if (!this.send(said)) this.queuedSaid.set(ref, said);
    });
  }

  private settle(ref: string | null, error: Error | null, data?: Record<string, unknown>) {
    if (!ref) return;
    const waiter = this.waiting.get(ref);
    if (!waiter) return;
    this.waiting.delete(ref);
    this.queuedSaid.delete(ref);
    clearTimeout(waiter.timer);
    if (error) {
      waiter.reject(error);
      return;
    }
    // The answer to a ring names the call it placed. `call.ringing` says the
    // same thing a moment earlier or later, but a tab whose ring frame was
    // lost would otherwise be dialling a call it cannot name.
    const placed = text(data?.call);
    if (placed && this.callId === null && this.phase === "dialling") {
      this.callId = placed;
      this.publish();
    }
    waiter.resolve();
  }

  /**
   * Tell the server this tab is out — and remember it if there is nobody to
   * tell.
   *
   * The one frame in a call that must not be dropped: a tab whose socket is
   * down misses the people who were on the call saying goodbye, so a goodbye
   * that cannot be said now is held and said the moment there is a socket
   * again — see [onSocketLive].
   */
  private leave(callId: string) {
    // Nothing is waited on: the person who pressed the button has already
    // left, on their own screen as much as anybody else's. Failing here is not
    // a reason to put them back on the call — it is a reason to say it again
    // later, which is what [unsaid] is for.
    void this.ask("call.leave", { call: callId }).catch((error: unknown) => {
      this.report(`leave: ${String(error)}`);
      this.unsaid = { action: "call.leave", call: callId };
    });
  }

  // ---- the snapshot ------------------------------------------------------

  /**
   * A ring the browser would not play, waiting for a tap.
   *
   * Set by the ringer's own refusal and cleared by [allowRing]; it is a fact
   * about the browser rather than about the call, which is why it is not part
   * of the phase machine.
   */
  private ringBlocked = false;

  private buildSnapshot(): CallSnapshot {
    return {
      phase: this.phase,
      callId: this.callId,
      kind: this.kind,
      party: this.party,
      selfId: this.selfId,
      muted: this.muted,
      cameraOn: this.cameraOn,
      note: this.note,
      since: this.since,
      mediaError: this.mediaError,
      version: this.version,
      quality: this.quality,
      devices: this.devices,
      cameraId: this.cameraId,
      micId: this.micId,
      speakerId: this.speakerId,
      sharing: this.sharing,
      ringBlocked: this.ringBlocked,
      mirrored: this.mirrored(),
      remoteMirrored: this.remoteMirror,
      facing: this.facing,
    };
  }

  /**
   * Whether this tab's own picture is drawn as a mirror.
   *
   * A mirror is what makes a selfie feel like a mirror and what makes a
   * *document* unreadable, and the two cases are the same picture — so the
   * answer is the lens, not the app. A front lens is drawn mirrored, the way
   * every camera app draws it, and the back lens is drawn as it sees things,
   * because a person pointing a phone at a sign is not asking for the sign to
   * be reversed. The phone's own rule is this one:
   * `selfMirrored = front`, and it was learned the hard way — see
   * `app/lib/calls.dart`, where a shelf that turned over regardless is
   * recorded as "how the back camera came out mirrored once already".
   *
   * **The lens alone, since 2026-11-06.** This used to be overrulable by the
   * screen's own Mirror button, on the argument that a browser webcam reports
   * no facing at all and a person should not have to argue with a heuristic.
   * What the owner found instead is that the button was turning over the one
   * picture that was already right: *"mirror par click karne par jo flip ho
   * raha hai wo mere video card me raha hai jabki reciever user video card me
   * hona chahiye"*. The button is now about the pictures coming *in*
   * ([toggleRemoteMirror]) and this one follows the lens it is coming from, so
   * a webcam that reports nothing is drawn mirrored — which is the honest
   * reading of a camera a person is sitting in front of.
   */
  private mirrored(): boolean {
    return this.facing !== "environment";
  }

  /**
   * Turn the picture *arriving* here over, and keep it there for this call.
   *
   * The other person's tile and not this tab's own. What the owner asked for on
   * 2026-11-06: *"jo flip ho raha hai wo mere video card me raha hai jabki
   * reciever user video card me hona chahiye"* — my own picture is already
   * drawn the way the phone draws it, so a switch over it only breaks
   * something; the picture that can arrive the wrong way round is the one the
   * far end sends, which a browser cannot inspect and a person can see.
   *
   * **This is a display, not a transmission.** Nothing about what this tab
   * sends changes, so nobody else's screen is affected by it: it is the same
   * question the self-view asks, pointed the other way. A standing choice for
   * the call it was made in rather than a per-tile one — in a room of six it is
   * one answer about the pictures arriving here, which is the only thing one
   * button can honestly mean. A picture the far end is *sharing* rather than
   * filming is flipped by it too: a call frame carries no word for which of the
   * two a stream is, so there is nothing here to tell them apart.
   */
  toggleRemoteMirror() {
    this.remoteMirror = !this.remoteMirror;
    this.publish();
  }

  /**
   * Read which way the live lens points, off the track itself.
   *
   * The browser's own answer rather than a flag of this tab's, for the reason
   * the phone gives: after a front/back switch the track is the only half that
   * knows which lens it is really pointed at, and a switch the browser refused
   * — a camera another app is holding, a lens that is already live — must leave
   * the picture saying what is true.
   */
  private readFacing(track: MediaStreamTrack | null) {
    if (!track) return;
    const settings = track.getSettings?.() ?? {};
    const mode = settings.facingMode;
    const next: Facing =
      mode === "environment" ? "environment" : mode === "user" ? "user" : null;
    if (next === this.facing) return;
    this.facing = next;
    // The lens moved, so a picture that follows the lens has moved with it.
    // There is nothing to do here: [mirrored] reads `facing` on every publish,
    // and the pictures arriving from the far end have no lens of their own.
  }

  /**
   * Publish, and let the two sounds the state machine owns follow it.
   *
   * A ring is the one piece of a call that is not a screen, so it is driven
   * from the same place every screen is: whatever phase the engine just
   * settled on. Both are idempotent — a phase rings once, a row is posted
   * once — because `publish` is called for a stream arriving as much as for a
   * call answering.
   */
  private publish() {
    this.snapshot = this.buildSnapshot();
    this.syncSound();
    this.syncNotice();
    this.syncQuality();
    for (const listener of this.listeners) listener();
  }

  /**
   * Ring, ring back, or be quiet.
   *
   * A call coming in rings with the ringtone; a call going out plays the
   * ringback, which is a different sound on purpose — a caller who heard their
   * own ringtone would think somebody was calling *them* (`ring.ts`). Anything
   * else is silence, and silence is what stops a ring that ran out.
   */
  private syncSound() {
    const want: "in" | "out" | null =
      this.phase === "ringing" ? "in" : this.phase === "dialling" ? "out" : null;
    if (!want) {
      if (this.rangFor !== null) {
        this.ringer.stop();
        this.rangFor = null;
      }
      return;
    }
    if (this.rangFor === this.phase) return;
    this.rangFor = this.phase;
    this.ringBlocked = false;
    this.ringer.start(want);
  }

  /**
   * Put the ring on the browser's own notification surface, and take it down.
   *
   * Posted for a call coming in and for nothing else: a call this tab placed is
   * already on this tab's screen, and a call that is up is being talked on.
   */
  private syncNotice() {
    if (!postsCallNotice(this.phase) || !this.callId) {
      if (this.noticedCall) {
        this.notices.hide();
        this.noticedCall = null;
      }
      return;
    }
    if (this.noticedCall === this.callId) return;
    this.noticedCall = this.callId;
    const words = callNoticeWords({
      seat: this.party?.members?.find((seat) => seat.user === this.callerId) ?? null,
      kind: this.kind,
    });
    this.notices.show({ ...words, callId: this.callId, kind: this.kind });
  }

  /** Measure the link while there is one to measure, and stop when there is not. */
  private syncQuality() {
    const live = this.phase === "live" && this.peers.size > 0;
    if (live && !this.qualityTimer) {
      this.qualityTimer = setInterval(() => void this.measure(), 3000);
      void this.measure();
      return;
    }
    if (!live && this.qualityTimer) {
      clearInterval(this.qualityTimer);
      this.qualityTimer = null;
    }
  }

  /**
   * Read the browser's own numbers, once.
   *
   * The report is per connection, and a call can have several; the worst of
   * them is the one a person experiences, so the reading is the worst row of
   * the counts rather than an average nobody would feel.
   */
  private async measure() {
    const entries: StatEntry[] = [];
    for (const [userId, pc] of this.peers) {
      try {
        const report = await pc.getStats();
        report.forEach((row) => {
          const entry = row as unknown as StatEntry;
          entries.push({ ...entry, userId });
        });
      } catch (error) {
        this.report(`stats for ${userId}: ${String(error)}`);
      }
    }
    if (!entries.length) return;
    const next = readQuality(entries);
    const changed =
      next.level !== this.quality.level ||
      next.rttMs !== this.quality.rttMs ||
      next.lossPercent !== this.quality.lossPercent ||
      next.width !== this.quality.width ||
      next.fps !== this.quality.fps;
    if (!changed) return;
    this.quality = next;
    this.publish();
  }

  /** The cameras, microphones and speakers this browser has, by name. */
  async listDevices(): Promise<CallDevices> {
    try {
      const found = await navigator.mediaDevices.enumerateDevices();
      const pick = (kind: MediaDeviceKind) =>
        found
          .filter((device) => device.kind === kind)
          .map((device, index) => ({
            id: device.deviceId,
            label: deviceLabel({ label: device.label, kind: device.kind }, index),
          }));
      this.devices = {
        cameras: pick("videoinput"),
        mics: pick("audioinput"),
        speakers: pick("audiooutput"),
      };
      this.publish();
    } catch (error) {
      this.report(`devices: ${String(error)}`);
    }
    return this.devices;
  }

  /**
   * Switch the microphone or the camera under a live call.
   *
   * `replaceTrack` rather than a new offer: the line already exists and the
   * other end has already agreed to it, so swapping what travels on it needs no
   * negotiation at all — and a renegotiation mid-call is a picture that freezes
   * while two ends argue about a description. This is also what a phone's
   * front/back switch is.
   */
  async useMicrophone(deviceId: string): Promise<void> {
    const track = await this.openDevice("audio", deviceId);
    if (!track) return;
    this.micId = deviceId;
    const stream = this.local ?? new MediaStream();
    const old = stream.getAudioTracks()[0];
    if (old) stream.removeTrack(old);
    stream.addTrack(track);
    if (!this.local) this.local = stream;
    for (const pc of this.peers.values()) {
      const sender = pc.getSenders().find((one) => one.track?.kind === "audio");
      if (sender) await sender.replaceTrack(track).catch(() => undefined);
    }
    old?.stop();
    track.enabled = !this.muted;
    this.version += 1;
    this.publish();
  }

  async useCamera(deviceId: string): Promise<void> {
    const track = await this.openDevice("video", deviceId);
    if (!track) return;
    this.cameraId = deviceId;
    const stream = this.local ?? new MediaStream();
    const old = stream.getVideoTracks()[0];
    if (old) stream.removeTrack(old);
    stream.addTrack(track);
    if (!this.local) this.local = stream;
    track.enabled = this.cameraOn;
    for (const pc of this.peers.values()) {
      const sender = pc.getSenders().find((one) => one.track?.kind === "video");
      if (sender) {
        await sender.replaceTrack(track).catch(() => undefined);
        await this.tune(sender);
      }
    }
    old?.stop();
    this.version += 1;
    this.publish();
  }

  /** The next camera in the list — what a phone draws as "flip". */
  async switchCamera(): Promise<void> {
    const cameras = this.devices.cameras.length
      ? this.devices.cameras
      : (await this.listDevices()).cameras;
    if (cameras.length < 2) return;
    const at = cameras.findIndex((camera) => camera.id === this.cameraId);
    const next = cameras[(at + 1 + cameras.length) % cameras.length];
    await this.useCamera(next.id);
  }

  /** Which speaker the far end comes out of. Chrome only, and said so. */
  useSpeaker(deviceId: string): void {
    this.speakerId = deviceId;
    this.publish();
  }

  /** One device, opened on its own, for a switch that has no negotiation in it. */
  private async openDevice(
    kind: "audio" | "video",
    deviceId: string,
  ): Promise<MediaStreamTrack | null> {
    if (!callsSupported()) return null;
    try {
      const stream = await navigator.mediaDevices.getUserMedia(
        kind === "audio"
          ? { audio: audioConstraints(deviceId) }
          : { video: videoConstraints(deviceId) },
      );
      const track = kind === "audio" ? stream.getAudioTracks()[0] : stream.getVideoTracks()[0];
      if (!track) return null;
      if (kind === "video") {
        // A camera picture is moving content; an encoder told so stops
        // optimising it for a still frame.
        track.contentHint = this.sharing ? "detail" : "motion";
        // The lens the track is really pointed at, which is the only half that
        // knows after a front/back switch. See [readFacing].
        this.readFacing(track);
      }
      return track;
    } catch (error) {
      this.mediaError = mediaRefusal(error);
      this.publish();
      return null;
    }
  }

  /**
   * Show this tab's screen instead of its camera.
   *
   * The outgoing picture is *replaced* rather than added as a second line: a
   * two-person call has one video slot, and what somebody wants when they press
   * "share" is for the other end to be looking at their screen — not at their
   * screen *and* their face in a layout with nowhere to put either. The camera
   * track is kept, switched off, so stopping the share puts the face back
   * without asking for the camera again (which would prompt a second time).
   */
  async shareScreen(): Promise<void> {
    if (!this.callId || this.phase !== "live" || this.sharing) return;
    if (!navigator.mediaDevices?.getDisplayMedia) {
      this.mediaError = "This browser cannot share a screen.";
      this.publish();
      return;
    }
    let display: MediaStreamTrack | null;
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: { frameRate: { ideal: 15, max: 30 } },
        audio: false,
      });
      display = stream.getVideoTracks()[0] ?? null;
    } catch (error) {
      // "NotAllowedError" here is somebody pressing Cancel on the picker, which
      // is not a fault and not worth a sentence on screen.
      const name = (error as { name?: string } | null)?.name ?? "";
      if (name !== "NotAllowedError") {
        this.mediaError = "That screen could not be shared.";
        this.publish();
      }
      return;
    }
    if (!display) return;
    // Detail, not motion: a shared screen is text and windows, and an encoder
    // optimised for movement turns a page into porridge.
    display.contentHint = "detail";
    display.addEventListener("ended", () => this.stopSharing());
    this.display = display;
    this.sharing = true;

    let sent = false;
    for (const [userId, pc] of [...this.peers.entries()]) {
      const sender = pc.getSenders().find((one) => one.track?.kind === "video");
      if (sender) {
        await sender.replaceTrack(display).catch(() => undefined);
        sent = true;
      } else {
        // An audio call with no camera line: the screen needs one, which is the
        // same negotiation a camera turned on mid-call needs.
        pc.addTrack(display, new MediaStream([display]));
        await this.offerTo(userId);
        sent = true;
      }
    }
    if (!sent) {
      // Nobody to send it to yet. Kept on the local stream so the offer that
      // goes out to a later arrival carries it.
      const stream = this.local ?? new MediaStream();
      const have = stream.getVideoTracks()[0];
      if (have) stream.removeTrack(have);
      stream.addTrack(display);
      this.local = stream;
    }
    for (const track of this.local?.getVideoTracks() ?? []) {
      if (track !== display) track.enabled = false;
    }
    this.version += 1;
    this.publish();
  }

  /** Put the camera back, or stop sending a picture at all. */
  stopSharing(): void {
    const display = this.display;
    if (!display) return;
    this.display = null;
    this.sharing = false;
    const camera = this.local?.getVideoTracks().find((track) => track !== display) ?? null;
    for (const pc of this.peers.values()) {
      const sender = pc.getSenders().find((one) => one.track === display);
      if (sender) void sender.replaceTrack(camera).catch(() => undefined);
    }
    if (camera) camera.enabled = this.cameraOn;
    try {
      display.stop();
    } catch {
      // Already ended — the browser's own "Stop sharing" bar does this.
    }
    const stream = this.local;
    if (stream) stream.removeTrack(display);
    if (stream && !camera && stream.getVideoTracks().length === 0 && !this.cameraOn) {
      // Nothing left to send: the line stays, with nothing on it.
      this.cameraOn = false;
    }
    this.version += 1;
    this.publish();
  }

  /**
   * Let a ring the browser refused be started by a press.
   *
   * A page that has not been touched may not play anything at all, and a ring
   * nobody can hear is a call nobody knows about. The screen offers one tap,
   * and this is what that tap does — nothing is played until it has actually
   * played, so the offer is not decoration.
   */
  allowRing(): void {
    this.rangFor = null;
    this.ringBlocked = false;
    this.syncSound();
    if (!this.ringer.ringing) this.ringBlocked = true;
    this.publish();
  }

  /** Post the row again — after permission was granted while a call is ringing. */
  refreshNotice(): void {
    this.noticedCall = null;
    this.syncNotice();
  }
}

/** A refusal a person can do something about, from the browser's own names. */
function mediaRefusal(error: unknown): string {
  const name = (error as { name?: string } | null)?.name ?? "";
  switch (name) {
    case "NotAllowedError":
    case "SecurityError":
      return "Your browser blocked the microphone and camera.";
    case "NotFoundError":
    case "OverconstrainedError":
      return "There is no microphone or camera to use.";
    case "NotReadableError":
      return "Something else is using the microphone or camera.";
    default:
      return "The microphone and camera would not open.";
  }
}