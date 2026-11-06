import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  Heart,
  LoaderCircle,
  Lock,
  MoreVertical,
  Pause,
  Play,
  Repeat,
  Send,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { ConfirmDialog, Modal } from "@/components/overlays/Modal";
import { VerifiedTick } from "@/components/icons/Tick";
import { PhotoEditor } from "@/features/camera/PhotoEditor";
import { composeImage } from "@/features/camera/editorCanvas";
import {
  aspectValue,
  defaultEditorDoc,
  frameForMode,
  type EditorDoc,
} from "@/features/camera/editorTypes";
import { SheetRow } from "@/features/profile/parts";
import { SensitiveVeil } from "@/features/drops/SensitiveVeil";
import { cn } from "@/utils/cn";
import { ApiError, errorMessage } from "@/utils/errors";
import { count, timeAgoShort } from "@/utils/format";
import { mediaBlob } from "@/utils/mediaCache";
import { uploadAsset } from "@/utils/upload";
import { lockScroll } from "@/utils/scrollLock";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/useToast";
import { chatService } from "@/services/chat.service";
import { momentsService } from "@/services/moments.service";
import { AddToMemories } from "./AddToMemories";
import { MomentStage, isVideoItem } from "./MomentStage";
import type {
  DropPreview,
  Moment,
  MomentItem,
  MomentPoll,
  MomentPollVoters,
  MomentReactor,
  MomentReactions,
  UserCard,
} from "@/types/api";

/**
 * One person's day, walked — the phone's `MomentViewScreen`.
 *
 * The rules this keeps are the app's, and these are the ones that are easy to
 * get wrong:
 *
 * - **A tap steps and nothing else does.** Where the thing a moment carries is
 *   opened from is a *hold*: hold stops the clock, and holding on past
 *   [HOLD_TO_LEAVE_MS] turns the same finger into "take me to it". That is why
 *   the line at the foot of the picture is drawn at all — a second meaning
 *   nobody is told about is a second meaning nobody has.
 * - **A picture is on screen for its own length, not the house five.** See
 *   [holdMs]: the clip's window, or the music's window up to a minute, or the
 *   life a picture carried in from a post wrote down, or five seconds.
 * - **A heart is not a line in a convo.** A like is kept beside the moment
 *   (`/react/`) and a reply is a message that goes where messages go
 *   (`/reply/`); they are two routes because they are two deeds.
 * - **The tally is the author's.** A reader is sent no number — see
 *   `services._reactions` — so the answers row is drawn on my own day only, and
 *   so is every sheet behind it.
 * - **Nothing is drawn that the server would refuse.** The react button is not
 *   drawn on my own moment at all (`_react` returns early on `moment.mine`), and
 *   the three dots only where there is something behind them.
 * - **My own day walks backwards through the days.** `_ownOrder` reverses the
 *   moments and not the pictures, so a moment of three still plays first to last
 *   while the newest day is the one it opens on.
 */

/** How long a still frame holds before the walk moves on by itself. */
const HOLD_FLOOR_MS = 5000;
/** The ceiling a moment puts on a sound — the app's `kSoundLongest`. */
const SOUND_LONGEST_MS = 60_000;
/** How often the bar is written — `kBarTick`. */
const TICK_MS = 60;
/** How long a press is held before it counts as a hold — `kHoldToPause`. */
const HOLD_TO_PAUSE_MS = 480;
/** …and how much longer before letting go means "open it" — `kHoldToLeave`. */
const HOLD_TO_LEAVE_MS = 750;
/** The one face a tap gives — `kStoryLike`. */
const STORY_LIKE = "❤️";
/** The faces behind a hold — `kStoryFaces`. */
const STORY_FACES = ["❤️", "😂", "🔥", "👏", "😮"];
/** What the controls sit on: the app's `_controlFill`. */
const CONTROL_FILL = "rgba(0,0,0,0.38)";
/** The shadow under every line of white type over a photograph — `_overMedia`. */
const OVER_MEDIA = { textShadow: "0 0 4px rgba(0,0,0,0.8)" } as const;

/** One piece of the walk, and the day it belongs to. */
interface Frame {
  moment: Moment;
  item: MomentItem;
}

/** What a long hold would lead to, and the app's own word for it. */
interface Carried {
  kind: "vibe" | "drop" | "sound" | "source";
  id: string;
  /** `Vibes`, `the drop`, `Audio`, `what it came from` — `_carriedTo`. */
  where: string;
}

function framesOf(moments: Moment[]): Frame[] {
  return moments.flatMap((moment) => (moment.items ?? []).map((item) => ({ moment, item })));
}

/**
 * How long this one is on screen. See `MomentItem.hold` in `moments.dart`.
 *
 * A clip is on for exactly the window that is played — a four-second clip cut
 * off at three is a worse answer than a long one. A sound holds a picture for as
 * long as the music, up to a minute, measured from where the sound *starts*
 * rather than from the top of the file, because that is how much of it there is
 * left to hear. A picture carried in from a post arrives with a life of its own,
 * and the longer of the two is which the person asked for.
 */
export function holdMs(item: MomentItem): number {
  const whole = item.asset?.duration_ms ?? 0;
  if (isVideoItem(item) && whole > 1000) {
    const start = item.clip_start_ms ?? 0;
    const end = (item.clip_end_ms ?? 0) > 0 ? (item.clip_end_ms as number) : whole;
    const window = end - start;
    return window > 0 ? window : whole;
  }
  const picture =
    !isVideoItem(item) && (item.clip_end_ms ?? 0) > 0 ? (item.clip_end_ms as number) : 0;
  const soundWhole = item.sound?.duration_ms ?? 0;
  const soundStart = item.sound_start_ms ?? 0;
  const soundEnd = item.sound_end_ms ?? 0;
  const stop =
    soundEnd > soundStart && (soundWhole <= 0 || soundEnd <= soundWhole) ? soundEnd : soundWhole;
  const music = stop - soundStart;
  if (music > HOLD_FLOOR_MS) {
    const wanted = Math.min(music, SOUND_LONGEST_MS);
    return Math.max(wanted, picture);
  }
  if (picture > 0) return picture;
  return HOLD_FLOOR_MS;
}

/** "3 moments" — the app's `momentCountLabel`. */
function momentCountLabel(value: number): string {
  return value === 1 ? "1 moment" : `${count(value)} moments`;
}

/**
 * "Memory", or "12 in this Memory" — `momentViewMemory` and
 * `momentViewInThisMemory`.
 *
 * A Memory is not counted in moments: it is a thing that has stopped being
 * counted in days at all, so the line under the name says what it is rather
 * than how much of it there is.
 */
function memoryCountLabel(value: number): string {
  return value === 1 ? "Memory" : `${count(value)} in this Memory`;
}

/** "12 watched" — `_watchedCount`. */
function watchedLabel(value: number): string {
  return value === 1 ? "1 watched" : `${count(value)} watched`;
}

/** "4 answered" — `_answeredCount`. */
function answeredLabel(value: number): string {
  return value === 1 ? "1 answered" : `${count(value)} answered`;
}

export function MomentViewer({
  moments,
  startId,
  onClose,
  onChanged,
}: {
  moments: Moment[];
  startId?: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  /**
   * Whether this is my own day, which is a question about the payload rather
   * than about the screen: the server marks every moment it hands back. An
   * all-mine list walks newest day first; anybody else's is read oldest first,
   * the way a story is meant to be read.
   */
  const own = moments.length > 0 && moments.every((moment) => moment.mine);
  const frames = useMemo(
    () => framesOf(own ? [...moments].reverse() : moments),
    [moments, own],
  );

  const [index, setIndex] = useState(() =>
    Math.max(
      0,
      frames.findIndex((frame) => frame.moment.id === startId || frame.item.id === startId),
    ),
  );
  const [held, setHeld] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [typing, setTyping] = useState(false);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [clipEl, setClipEl] = useState<HTMLVideoElement | null>(null);
  const [soundHeld, setSoundHeld] = useState(false);
  const [reactions, setReactions] = useState<Record<string, MomentReactions | undefined>>(() =>
    Object.fromEntries(moments.map((moment) => [String(moment.id), moment.reactions])),
  );
  const [polls, setPolls] = useState<Record<string, MomentPoll>>({});
  const [watchers, setWatchers] = useState<Record<string, UserCard[]>>({});
  const [watchedCount, setWatchedCount] = useState<Record<string, number>>({});
  const [answers, setAnswers] = useState<Record<string, MomentReactor[]>>({});
  const [votes, setVotes] = useState<Record<string, MomentPollVoters[]>>({});
  const [facesOpen, setFacesOpen] = useState(false);
  const [whoOpen, setWhoOpen] = useState(false);
  const [whoLoading, setWhoLoading] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [keepOpen, setKeepOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [chosen, setChosen] = useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [source, setSource] = useState<Moment | null>(null);
  /**
   * The carried picture, waiting to be drawn on before it is my day.
   *
   * `carryMoment` on the phone opens the same editor a fresh moment opens in
   * and only what comes back out of it goes up — a remoment is no longer a
   * silent server copy — so the URL here is an object URL of the bytes as they
   * arrived, and `postCarried` is what turns the document into the picture that
   * goes up.
   */
  const [seed, setSeed] = useState<{ url: string; aspect: string } | null>(null);
  const holdTimer = useRef<number | null>(null);
  const leaveTimer = useRef<number | null>(null);
  const elapsed = useRef(0);
  /**
   * Whether the press that just ended had already become something else.
   *
   * The browser fires `click` after every `pointerup`, hold or not, so without
   * this a long press would pause the picture and *then* step off it. Flutter's
   * gesture arena never gives a tap to a press that became a long press; this is
   * the same rule kept by hand.
   */
  const consumed = useRef(false);
  const facesPressed = useRef(false);

  const frame = frames[index] ?? null;
  const moment = frame?.moment ?? null;
  const item = frame?.item ?? null;
  const author = moment?.author ?? null;
  const mine = Boolean(moment && (moment.mine || (user && author?.id === user.id)));
  /**
   * Whether this walk is a Memory rather than somebody's day — the phone's
   * `_memory`. Everything that differs hangs off this one flag: a Memory has
   * nobody to count as a watcher, is never marked seen, cannot be kept in a
   * Memory, is never carried, and answers at routes of its own.
   */
  const memory = Boolean(moment?.isMemory);
  const strip = useMemo(
    () => (moment ? frames.filter((row) => row.moment.id === moment.id) : []),
    [frames, moment],
  );
  /** Where this day's first piece sits in the whole walk, for the bars. */
  const stripStart = useMemo(
    () => (moment ? frames.findIndex((row) => row.moment.id === moment.id) : 0),
    [frames, moment],
  );
  const reaction = (moment && reactions[String(moment.id)]) || null;
  const liked = reaction?.mine || null;
  const pollItem = strip.find((row) => row.item.poll)?.item ?? null;
  const watcherRows = moment ? watchers[String(moment.id)] ?? [] : [];
  const answerRows = moment ? answers[String(moment.id)] ?? [] : [];
  const voteGroups = (pollItem ? votes[String(pollItem.id)] ?? [] : []).filter(
    (group) => (group.voters ?? []).length > 0,
  );
  const watched =
    (moment && watchedCount[String(moment.id)]) ??
    (typeof moment?.viewers === "number" ? moment.viewers : watcherRows.length);

  const threads = useQuery({
    queryKey: ["threads-aside"],
    queryFn: () => chatService.threads(),
    enabled: shareOpen,
    staleTime: 20_000,
  });

  /** Whatever this moment is carrying, which is what a long hold would open. */
  const carried = useMemo<Carried | null>(() => {
    if (!item || !moment) return null;
    if (item.vibe) return { kind: "vibe", id: String(item.vibe.id), where: "Vibes" };
    if (item.made_from?.vibe)
      return { kind: "vibe", id: String(item.made_from.vibe), where: "Vibes" };
    if (item.made_from?.drop)
      return { kind: "drop", id: String(item.made_from.drop), where: "the drop" };
    if (item.sound) return { kind: "sound", id: "", where: "Audio" };
    if (moment.source_id)
      return { kind: "source", id: String(moment.source_id), where: "what it came from" };
    return null;
  }, [item, moment]);

  /** Whether this piece names me, which is the whole of what a carry needs. */
  const named = useMemo(() => {
    // A Memory is never carried. It is a shelf somebody keeps, not a day they
    // put up, and there is no such thing as putting it on mine.
    if (!item || !user || memory) return false;
    return (item.mentions ?? []).some((person) => String(person.id) === String(user.id));
  }, [item, user, memory]);

  const go = useCallback(
    (next: number) => {
      if (next < 0) return;
      if (next >= frames.length) {
        onClose();
        return;
      }
      setIndex(next);
      setReply("");
      setTyping(false);
    },
    [frames.length, onClose],
  );

  /**
   * Everything that holds the clock. One child at a time, and the moment
   * underneath must not finish and step on while somebody is reading a name in a
   * list or half-way through a line.
   */
  const paused =
    held ||
    typing ||
    facesOpen ||
    whoOpen ||
    optionsOpen ||
    keepOpen ||
    shareOpen ||
    confirmOpen ||
    soundHeld ||
    Boolean(seed) ||
    Boolean(source);

  useEffect(() => {
    setClipEl(null);
    setProgress(0);
    setLeaving(false);
    elapsed.current = 0;
  }, [index]);

  // What is watched, said as it is watched: the piece, and the day once its last
  // piece has been reached. The day's own answers ride along on the payload, so
  // nothing is asked for here that the reader did not already have.
  //
  // A Memory is never marked seen, either way round: it is a shelf on a profile
  // rather than a day that goes out, so there is nothing for a watch to mean and
  // `/seen/` would 404 on it besides.
  useEffect(() => {
    if (!frame || frame.moment.isMemory) return;
    void momentsService.itemSeen(frame.item.id).catch(() => undefined);
    const last = frames.filter((row) => row.moment.id === frame.moment.id).at(-1);
    if (last?.item.id === frame.item.id) {
      void momentsService.seen(frame.moment.id).catch(() => undefined);
    }
  }, [frame, frames]);

  // The bar, and the step when it fills. A clip is read off the element's own
  // clock — a clip dragged backwards reports where it actually is — and
  // everything else off the piece's own length.
  useEffect(() => {
    if (!frame || paused) return;
    const hold = holdMs(frame.item);
    const element = isVideoItem(frame.item) ? clipEl : null;
    const timer = window.setInterval(() => {
      if (element && element.duration > 0) {
        const start = frame.item.clip_start_ms ?? 0;
        const end =
          (frame.item.clip_end_ms ?? 0) > 0
            ? (frame.item.clip_end_ms as number)
            : element.duration * 1000;
        const span = end - start;
        const at = element.currentTime * 1000;
        setProgress(
          span > 0
            ? Math.min(1, Math.max(0, (at - start) / span))
            : element.currentTime / element.duration,
        );
        if (at >= end - 120) go(index + 1);
        return;
      }
      elapsed.current += TICK_MS;
      const ratio = elapsed.current / hold;
      if (ratio >= 1) {
        go(index + 1);
        return;
      }
      setProgress(ratio);
    }, TICK_MS);
    return () => window.clearInterval(timer);
  }, [index, paused, clipEl, frame, go]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        // One at a time, top down: whatever is raised over the walk closes
        // first, and the walk itself only when nothing is over it.
        if (facesOpen || whoOpen || optionsOpen || keepOpen || shareOpen || confirmOpen || source) {
          return;
        }
        onClose();
        return;
      }
      if (typing) return;
      if (event.key === "ArrowRight") go(index + 1);
      if (event.key === "ArrowLeft") go(index - 1);
      if (event.key === " ") {
        event.preventDefault();
        setHeld((value) => !value);
      }
    };
    document.addEventListener("keydown", onKey);
    // Counted: this effect's dependencies move as the walk steps and as each
    // sheet opens, so it re-runs on a screen that stays up — see
    // `utils/scrollLock.ts`.
    const releaseScroll = lockScroll();
    return () => {
      document.removeEventListener("keydown", onKey);
      releaseScroll();
    };
  }, [
    index,
    typing,
    go,
    facesOpen,
    whoOpen,
    optionsOpen,
    keepOpen,
    shareOpen,
    confirmOpen,
    source,
    onClose,
  ]);

  useEffect(
    () => () => {
      if (holdTimer.current) window.clearTimeout(holdTimer.current);
      if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    },
    [],
  );

  // The carried picture's bytes are an object URL this screen made, so the one
  // that made it gives it back — when the editor closes, and when the viewer
  // does.
  useEffect(() => {
    if (!seed) return;
    const url = seed.url;
    return () => URL.revokeObjectURL(url);
  }, [seed]);

  /** Say a face about the moment. A blank one is the same button taking it back. */
  async function react(face: string) {
    if (!moment || mine || busy) return;
    setBusy(true);
    try {
      // A Memory is answered at its own route — the moment one looks its subject
      // up among live moments only and would 404 on a shelf.
      const answer = memory
        ? await momentsService.memoryReact(moment.id, face)
        : await momentsService.react(moment.id, face);
      setReactions((current) => ({ ...current, [String(moment.id)]: answer.reactions }));
    } catch (error) {
      toast({ title: "That did not land", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  /** The line written back. It is a message, and it goes where messages go. */
  async function sendReply(event: FormEvent) {
    event.preventDefault();
    const body = reply.trim();
    if (!body || !moment || busy || mine) return;
    setBusy(true);
    try {
      await (memory
        ? momentsService.memoryReply(moment.id, body)
        : momentsService.reply(moment.id, body));
      setReply("");
      setTyping(false);
      setHeld(false);
      toast({ title: "Ping sent.", tone: "success" });
    } catch (error) {
      toast({ title: "Your reply did not send", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  /** Put somebody else's moment up as mine — the permission is the whole of it. */
  async function carry() {
    if (!moment || busy || memory) return;
    const asset = item?.asset ?? null;
    // Only a picture goes through the editor. A clip, a note, a Vibe, or a
    // piece with no picture at all has nothing to draw on, so those carry the
    // old way — a straight server copy — and the credit and the card the
    // author is sent are the same either way. See `carryMoment`.
    if (!item || !asset || isVideoItem(item) || isTextItem(item)) {
      await carryPlain();
      return;
    }
    setBusy(true);
    try {
      // The bytes rather than the address: the editor draws the picture in a
      // canvas, and a private file read through an element would arrive
      // without the account's own credentials.
      const blob = await mediaBlob(asset.content_url ?? "");
      const file = new File([blob], "carried.jpg", { type: blob.type || "image/jpeg" });
      const width = asset.width ?? 0;
      const height = asset.height ?? 0;
      setSeed({
        url: URL.createObjectURL(file),
        aspect: width > 0 && height > 0 ? `${width}/${height}` : "4/5",
      });
    } catch (error) {
      toast({ title: "That picture would not open", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  /** The straight server copy, for everything the editor has nothing to draw on. */
  async function carryPlain() {
    if (!moment || busy) return;
    setBusy(true);
    try {
      await momentsService.carry(moment.id);
      onChanged();
      toast({ title: "It is on your moment now.", tone: "success" });
    } catch (error) {
      toast({ title: "That did not go up", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  /**
   * What came back out of the editor, put up as my own moment.
   *
   * The body is the ordinary post with one extra id: `source` is what makes the
   * server credit the original, send them the Remention card, and refuse a
   * second carry of the same thing. The mentions are the editor's own list
   * minus me — the picture came to me *because* it named me, and the server
   * refuses a moment that puts you in it yourself (`cannot_mention_yourself`).
   */
  async function postCarried(doc: EditorDoc) {
    if (!moment || !seed || busy) return;
    setBusy(true);
    try {
      const blob = await composeImage({ url: seed.url, doc, aspect: aspectValue(seed.aspect) });
      if (!blob) {
        toast({ title: "That picture would not open", tone: "error" });
        return;
      }
      const asset = await uploadAsset(new File([blob], "moment.jpg", { type: "image/jpeg" }), {
        kind: "image",
      });
      const me = user?.id ? String(user.id) : "";
      await momentsService.post({
        items: [
          {
            kind: "image",
            asset: asset.id,
            body: "",
            mentions: doc.people.map((person) => String(person.id)).filter((id) => id !== me),
          },
        ],
        source: moment.id,
      });
      setSeed(null);
      onChanged();
      toast({ title: "It is on your moment now.", tone: "success" });
    } catch (error) {
      toast({ title: "That did not go up", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  /**
   * Take my own moment down — or, when it is a Memory, take the shelf off my
   * profile.
   *
   * The two are not the same deed and do not say the same thing. Taking a
   * moment down destroys it for everybody; removing a Memory only takes the
   * shelf away, and the moments it was made of stay exactly where they were.
   * The question says which of the two is about to happen.
   */
  async function takeDown() {
    if (!moment) return;
    setBusy(true);
    try {
      if (memory) {
        await momentsService.dropMemory(moment.id);
      } else {
        await momentsService.remove(moment.id);
      }
      onChanged();
      toast({ title: memory ? "Memory removed" : "Moment taken down", tone: "success" });
      onClose();
    } catch (error) {
      toast({
        title: memory ? "Could not remove that Memory" : "Could not take that down",
        description: errorMessage(error),
        tone: "error",
      });
    } finally {
      setBusy(false);
      setConfirmOpen(false);
    }
  }

  /**
   * Who watched, who answered, and — where the day holds a poll — who chose
   * what.
   *
   * All three are the author's own lists and the server refuses them to anybody
   * else with a named code, so none is asked for on somebody else's day. They
   * are read when the sheet is opened rather than when the moment came up: a
   * walk read through would otherwise be a request per day for a list nobody
   * looked at. An answer already in hand is not asked for twice.
   *
   * A Memory has no watchers to list — it is a shelf on a profile and not a day
   * that goes out — so nothing is asked for its viewers, and its answers come
   * from its own route.
   */
  async function openWho() {
    if (!moment || whoOpen) return;
    const id = String(moment.id);
    setWhoOpen(true);
    setWhoLoading(true);
    try {
      const [seen, faces, choices] = await Promise.all([
        memory || watchers[id]
          ? Promise.resolve({ viewers: watchers[id] ?? [], count: watchedCount[id] })
          : momentsService.viewers(id),
        answers[id]
          ? Promise.resolve({ reactors: answers[id], count: answers[id].length })
          : memory
            ? momentsService.memoryReactors(id)
            : momentsService.reactors(id),
        pollItem
          ? votes[String(pollItem.id)]
            ? Promise.resolve({ options: votes[String(pollItem.id)] })
            : momentsService.voters(pollItem.id)
          : Promise.resolve({ options: [] as MomentPollVoters[] }),
      ]);
      setWatchers((current) => ({ ...current, [id]: seen.viewers ?? [] }));
      setWatchedCount((current) => ({
        ...current,
        [id]: seen.count ?? (seen.viewers ?? []).length,
      }));
      setAnswers((current) => ({ ...current, [id]: faces.reactors ?? [] }));
      if (pollItem) {
        setVotes((current) => ({ ...current, [String(pollItem.id)]: choices.options ?? [] }));
      }
    } catch (error) {
      toast({ title: "That list did not come", description: errorMessage(error), tone: "error" });
      setWhoOpen(false);
    } finally {
      setWhoLoading(false);
    }
  }

  /**
   * Ask whether this moment may leave the app, and only then open the picker.
   *
   * The gate is not decoration: a private account's moment cannot be shared at
   * all, and the server answers with a refusal that says so rather than with a
   * sheet whose Send would fail. So the question is asked first and the answer
   * is what decides whether the sheet is drawn.
   */
  async function openShare() {
    if (!moment || busy) return;
    setBusy(true);
    try {
      const gate = memory
        ? await momentsService.memoryShareGate(moment.id)
        : await momentsService.shareGate(moment.id);
      if (gate.allowed === false) {
        toast({ title: "This moment stays in the app.", tone: "error" });
        return;
      }
      setChosen([]);
      setShareOpen(true);
    } catch (error) {
      toast({ title: "It cannot be shared", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  /** The deed, one convo at a time: a convo that refuses does not stop the rest. */
  async function sendInto() {
    if (!moment || !chosen.length || busy) return;
    setBusy(true);
    let sent = 0;
    for (const thread of chosen) {
      try {
        await (memory
          ? momentsService.memoryShare(moment.id, thread)
          : momentsService.share(moment.id, thread));
        sent += 1;
      } catch {
        // Counted out below rather than swallowed: the number said afterwards is
        // the number that actually arrived.
      }
    }
    setBusy(false);
    setShareOpen(false);
    toast({
      title: sent === chosen.length ? "Sent" : `Sent into ${sent} of ${chosen.length}`,
      description: sent
        ? "It is in that convo now, as a way in rather than a copy."
        : "None of them took it.",
      tone: sent ? "success" : "error",
    });
  }

  /** Open a Vibe where it plays, which is the Vibes walk and not a page. */
  function openVibe(id: string) {
    onClose();
    navigate(`/app/drops?vibe=${encodeURIComponent(id)}`);
  }

  /**
   * Take the finger to whatever the piece is carrying.
   *
   * Called only from a hold let go after [HOLD_TO_LEAVE_MS], which is the one
   * gesture on this screen that means "take me to it". A sound has no page of
   * its own — it is an upload rather than a track — so it leads to the section
   * the app keeps sound in, which is the honest answer rather than a player of
   * this screen's own.
   */
  async function openCarried() {
    if (!carried) return;
    if (carried.kind === "vibe") {
      openVibe(carried.id);
      return;
    }
    if (carried.kind === "drop") {
      onClose();
      navigate(`/app/drops/${carried.id}`);
      return;
    }
    if (carried.kind === "sound") {
      onClose();
      navigate("/app/audio");
      return;
    }
    setBusy(true);
    try {
      const answer = await momentsService.detail(carried.id);
      setSource(answer.moment);
    } catch (error) {
      toast({
        title: "That moment is no longer there.",
        description:
          error instanceof ApiError && error.status === 404 ? undefined : errorMessage(error),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  function armedHold() {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    holdTimer.current = window.setTimeout(() => {
      consumed.current = true;
      setHeld(true);
    }, HOLD_TO_PAUSE_MS);
    if (!carried) return;
    leaveTimer.current = window.setTimeout(
      () => setLeaving(true),
      HOLD_TO_PAUSE_MS + HOLD_TO_LEAVE_MS,
    );
  }

  function releaseHold() {
    if (holdTimer.current) window.clearTimeout(holdTimer.current);
    if (leaveTimer.current) window.clearTimeout(leaveTimer.current);
    holdTimer.current = null;
    leaveTimer.current = null;
    const went = leaving;
    setLeaving(false);
    setHeld(false);
    if (went && carried) void openCarried();
    // Whatever this press was, the click the browser is about to send is the
    // same gesture finishing rather than a second one — and one that never
    // becomes a click (the finger lifted off the window) must not swallow the
    // next real tap.
    window.setTimeout(() => {
      consumed.current = false;
    }, 400);
  }

  if (!frame || !moment || !item) return null;

  const when = timeAgoShort(moment.created_at);

  return createPortal(
    <div
      className="fixed inset-0 z-[90] bg-black text-white"
      role="dialog"
      aria-modal="true"
      aria-label="Moments"
    >
      {/* The story, under the cover when the day is marked. One veil for the
          whole strip rather than one per piece: a story is what was marked, so
          covering a single piece of several would leak the rest — and the bytes
          of a covered moment are not fetched until somebody opens it. */}
      <SensitiveVeil
        sensitive={moment.sensitive}
        openable={moment.openable}
        cover={item.asset ?? item.vibe?.asset ?? null}
        note={mine ? "Yours. Everybody else sees it covered." : null}
      >
        <MomentStage
          item={item}
          poll={polls[String(item.id)] ?? null}
          onPoll={(fresh) => setPolls((current) => ({ ...current, [String(item.id)]: fresh }))}
          playing={!paused}
          clipRef={setClipEl}
          onClipEnded={() => go(index + 1)}
          onOpenDrop={(drop: DropPreview) => {
            if (drop.kind === "vibe") openVibe(String(drop.id));
            else {
              onClose();
              navigate(`/app/drops/${drop.id}`);
            }
          }}
          onHoldSound={setSoundHeld}
        />
      </SensitiveVeil>

      {/* The tap that steps and the hold that stops it. A tap steps and never
          leaves, whatever the moment is carrying: the right-hand side goes
          forward, the left-hand third goes back. */}
      <div
        className="absolute inset-0 z-[5]"
        onClick={(event) => {
          if (consumed.current) {
            consumed.current = false;
            return;
          }
          if (leaving) return;
          go(event.clientX < window.innerWidth * 0.32 ? index - 1 : index + 1);
        }}
        onPointerDown={armedHold}
        onPointerUp={releaseHold}
        onPointerCancel={releaseHold}
        onContextMenu={(event) => event.preventDefault()}
        aria-hidden
      />

      {/* The bars: one per piece of this day, the one on screen filling at the
          clock's own rate, the ones behind it filled and the ones ahead empty. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex gap-1.5 px-2 pb-1 pt-[max(.5rem,env(safe-area-inset-top))]">
        {strip.map((row, at) => {
          const width =
            stripStart + at < index
              ? "100%"
              : stripStart + at === index
                ? `${Math.min(100, Math.max(0, progress * 100))}%`
                : "0%";
          return (
            <span
              key={String(row.item.id)}
              className="h-[3px] flex-1 overflow-hidden rounded-[2px] bg-white/25"
            >
              <span className="block h-full bg-white" style={{ width }} />
            </span>
          );
        })}
      </div>

      {/* Whose day it is, and the things done *to* the moment rather than with
          it: stop it, send it on, put it on mine, and whatever is behind the
          dots. The share lives here rather than along the foot because it reads
          with the other controls — the foot is left to the two things that are
          about the person who put it up. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 mx-auto flex max-w-[760px] items-start gap-0.5 px-3 pt-[max(2.1rem,env(safe-area-inset-top))]">
        {mine ? (
          <span className="flex min-w-0 flex-1 items-center gap-2.5">
            <Avatar user={author} size={36} />
            <span className="min-w-0">
              <span className="block truncate text-[15px] font-bold" style={OVER_MEDIA}>
                {memory ? "Your Memory" : "Your moments"}
              </span>
              {moment.credit ? <CreditLine credit={moment.credit} /> : null}
              <span className="block truncate text-[12px] text-white/70" style={OVER_MEDIA}>
                {[
                  memory ? memoryCountLabel(strip.length) : momentCountLabel(strip.length),
                  when,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          </span>
        ) : (
          <Link
            to={author ? `/app/u/${author.username}` : "/app/moments"}
            onClick={onClose}
            aria-label={`Open ${author?.name || author?.username || "profile"}`}
            className="pointer-events-auto flex min-w-0 flex-1 items-center gap-2.5"
          >
            <Avatar user={author} size={36} />
            <span className="min-w-0">
              <span className="flex items-center gap-1">
                <span className="truncate text-[15px] font-bold" style={OVER_MEDIA}>
                  {author?.name || author?.username}
                </span>
                {author?.verified ? <VerifiedTick size={14} /> : null}
              </span>
              {moment.credit ? <CreditLine credit={moment.credit} /> : null}
              <span className="block truncate text-[12px] text-white/70" style={OVER_MEDIA}>
                {[
                  memory ? memoryCountLabel(strip.length) : momentCountLabel(strip.length),
                  when,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </span>
          </Link>
        )}
        {!mine && author?.is_private ? (
          <span className="flex size-10 shrink-0 items-center justify-center text-white/70">
            <Lock className="size-4" aria-hidden />
          </span>
        ) : null}
        <HeaderButton label={held ? "Play" : "Pause"} onClick={() => setHeld((value) => !value)}>
          {held ? (
            <Play className="size-[22px]" aria-hidden />
          ) : (
            <Pause className="size-[22px]" aria-hidden />
          )}
        </HeaderButton>
        <HeaderButton label="Share" onClick={() => void openShare()}>
          <Share2 className="size-[22px]" aria-hidden />
        </HeaderButton>
        {named ? (
          <HeaderButton label="Put this on my moment" onClick={() => void carry()}>
            <Repeat className="size-[22px]" aria-hidden />
          </HeaderButton>
        ) : null}
        {/* Never offered over a Memory: the one row behind it is "Add to
            Memories", and it already is one. */}
        {mine && !memory && strip.length ? (
          <HeaderButton label="More" onClick={() => setOptionsOpen(true)}>
            <MoreVertical className="size-[22px]" aria-hidden />
          </HeaderButton>
        ) : null}
        <HeaderButton label="Close" onClick={onClose}>
          <X className="size-6" aria-hidden />
        </HeaderButton>
      </div>

      {/* The foot of the picture: whatever was written on this piece, where the
          hold would lead, and then the two things there are to say. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 mx-auto max-w-[640px] px-3.5 pb-[max(1rem,env(safe-area-inset-bottom))]">
        {item.body?.trim() && !isTextItem(item) && !isSongCoverItem(item) ? (
          <div className="pointer-events-auto mb-2 rounded-[14px] bg-black/55 px-5 py-3">
            <p className="whitespace-pre-wrap text-[13.5px] leading-[1.45]">{item.body}</p>
            {item.mentions?.length ? (
              <p dir="ltr" className="mt-1.5 text-[13px] font-semibold">
                {item.mentions.map((person) => `@${person.username}`).join("  ")}
              </p>
            ) : null}
          </div>
        ) : null}
        {carried ? (
          <p className="mb-1.5 px-1 text-[12.5px] font-semibold text-white/70" style={OVER_MEDIA}>
            {leaving ? `Let go to open ${carried.where}` : `Hold to open ${carried.where}`}
          </p>
        ) : null}

        {mine ? (
          <div className="pointer-events-auto flex flex-col items-stretch">
            {/* A Memory gets the shorter row, and it is shorter because the
                missing button has no meaning over one: there is nobody to count
                as a watcher, so the eye and its number are not drawn. What is
                left is the answers, read the same way, and the one deed that
                still means something — taking it off the shelf. */}
            {reaction && reaction.count > 0 ? (
              <button
                type="button"
                onClick={() => void openWho()}
                aria-label="Who answered"
                className="mb-2 flex flex-wrap items-center gap-2 self-start"
              >
                {Object.entries(reaction.counts ?? {}).map(([face, number]) => (
                  <span key={face} className="text-[13px] font-semibold" style={OVER_MEDIA}>
                    {number > 1 ? `${face} ${count(number)}` : face}
                  </span>
                ))}
              </button>
            ) : null}
            <div className="flex items-center gap-2">
              {memory ? (
                <span className="flex-1" />
              ) : (
                <button
                  type="button"
                  onClick={() => void openWho()}
                  className="flex min-h-[42px] flex-1 items-center gap-2 rounded-[22px] px-3 text-left text-[14px] font-semibold"
                  style={{ backgroundColor: CONTROL_FILL }}
                >
                  <Eye className="size-[18px]" aria-hidden />
                  {watchedLabel(watched)}
                </button>
              )}
              <RoundButton
                label={memory ? "Remove" : "Take down"}
                onClick={() => setConfirmOpen(true)}
              >
                <Trash2 className="size-5" aria-hidden />
              </RoundButton>
            </div>
          </div>
        ) : (
          <div className="pointer-events-auto">
            <div className="flex items-end">
              <span className="flex-1" />
              <div
                onPointerDown={() => {
                  if (holdTimer.current) window.clearTimeout(holdTimer.current);
                  holdTimer.current = window.setTimeout(() => {
                    facesPressed.current = true;
                    setFacesOpen(true);
                  }, HOLD_TO_PAUSE_MS);
                }}
                onPointerUp={() => {
                  if (holdTimer.current) window.clearTimeout(holdTimer.current);
                  holdTimer.current = null;
                }}
                onPointerLeave={() => {
                  if (holdTimer.current) window.clearTimeout(holdTimer.current);
                  holdTimer.current = null;
                  facesPressed.current = false;
                }}
              >
                <button
                  type="button"
                  onClick={() => {
                    // The hold has already opened the faces; this click is the
                    // same press finishing, not a heart as well.
                    if (facesPressed.current) {
                      facesPressed.current = false;
                      return;
                    }
                    if (busy) return;
                    void react(liked ? "" : STORY_LIKE);
                  }}
                  disabled={busy}
                  aria-label="React"
                  title={liked ? "Press again to take it back" : "Long press for other faces"}
                  className="flex size-[42px] items-center justify-center rounded-full text-[18px] leading-none"
                  style={{ backgroundColor: CONTROL_FILL }}
                >
                  <span aria-hidden>{liked ?? <Heart className="size-5" />}</span>
                </button>
              </div>
            </div>
            <form onSubmit={(event) => void sendReply(event)} className="mt-2 flex items-center gap-2">
              <input
                value={reply}
                onChange={(event) => {
                  setReply(event.target.value);
                  setTyping(event.target.value.trim().length > 0);
                }}
                onFocus={() => setHeld(true)}
                onBlur={() => {
                  setTyping(false);
                  setHeld(false);
                }}
                placeholder="Reply..."
                maxLength={2200}
                aria-label="Reply"
                className="min-h-[44px] min-w-0 flex-1 rounded-[22px] border-0 px-4 text-[15px] text-white outline-none placeholder:text-white/50"
                style={{ backgroundColor: CONTROL_FILL }}
              />
              <RoundButton
                label="Send"
                type="submit"
                busy={busy}
                onClick={() => undefined}
              >
                <Send className="size-5" aria-hidden />
              </RoundButton>
            </form>
          </div>
        )}
      </div>

      {/* The wide-screen furniture: a walk is a thumb's gesture, so these are
          the two the mouse gets. */}
      <button
        type="button"
        onClick={() => go(index - 1)}
        aria-label="Previous"
        className="absolute left-3 top-1/2 z-20 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full text-white/75 hover:bg-white/10 md:flex"
      >
        <ArrowLeft className="size-4" aria-hidden />
      </button>
      <button
        type="button"
        onClick={() => go(index + 1)}
        aria-label="Next"
        className="absolute right-3 top-1/2 z-20 hidden size-10 -translate-y-1/2 items-center justify-center rounded-full text-white/75 hover:bg-white/10 md:flex"
      >
        <ArrowRight className="size-4" aria-hidden />
      </button>

      <Modal open={facesOpen} onClose={() => setFacesOpen(false)} title="Answer with" size="sm">
        <div className="flex items-center justify-evenly px-2 pb-4 pt-1">
          {STORY_FACES.map((face) => (
            <button
              key={face}
              type="button"
              aria-label={face === liked ? `${face}, the one you gave` : face}
              onClick={() => {
                setFacesOpen(false);
                // Given rather than toggled: the button itself is what takes an
                // answer back, and it is drawn wearing whatever was given.
                if (face !== liked) void react(face);
              }}
              className={cn(
                "rounded-full px-2.5 py-1.5 text-[30px] leading-none transition",
                face === liked && "bg-[var(--accent-soft)]",
              )}
            >
              {face}
            </button>
          ))}
        </div>
      </Modal>

      <Modal
        open={whoOpen}
        onClose={() => setWhoOpen(false)}
        title={memory ? "Who answered" : "Who watched and answered"}
        size="md"
      >
        {whoLoading ? (
          <div className="space-y-3 p-4" aria-hidden>
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center gap-3">
                <div className="skeleton size-9 rounded-full" />
                <div className="skeleton h-3 w-32 rounded-full" />
              </div>
            ))}
          </div>
        ) : !answerRows.length && !watcherRows.length && !voteGroups.length ? (
          <div className="px-4 py-12 text-center">
            <p className="text-[13.5px] font-bold">Nobody yet</p>
            <p className="mt-1 text-[12.5px] text-dim">
              {memory || pollItem
                ? "Whoever answers turns up here."
                : "Whoever watches or answers turns up here."}
            </p>
          </div>
        ) : (
          <div className="pb-3">
            {answerRows.length ? (
              <p className="px-4 pb-1 pt-3 text-[11.5px] font-bold text-dim">
                {answeredLabel(answerRows.length)}
              </p>
            ) : null}
            {answerRows.map((row) => (
              <PersonRow key={String(row.id)} person={row} trailing={row.emoji} />
            ))}
            {watcherRows.length ? (
              <p className="px-4 pb-1 pt-3 text-[11.5px] font-bold text-dim">
                {watchedLabel(watched)}
              </p>
            ) : null}
            {watcherRows.map((person) => (
              <PersonRow key={String(person.id)} person={person} />
            ))}
            {voteGroups.length ? (
              <p className="px-4 pb-1 pt-3 text-[11.5px] font-bold text-dim">Who chose what</p>
            ) : null}
            {voteGroups.map((group) => (
              <div key={String(group.id)}>
                <p className="px-4 pt-2 text-[12.5px] font-bold">
                  {group.text} · {count(group.count)}
                </p>
                {(group.voters ?? []).map((person) => (
                  <PersonRow key={String(person.id)} person={person} />
                ))}
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal
        open={optionsOpen}
        onClose={() => setOptionsOpen(false)}
        title="This moment"
        description="What can be done with it."
        size="sm"
      >
        <div className="pb-2">
          <SheetRow
            icon={<Repeat className="size-[18px]" />}
            label="Add to Memories"
            line="Keep it on your profile, for good."
            onClick={() => {
              setOptionsOpen(false);
              setKeepOpen(true);
            }}
          />
        </div>
      </Modal>

      <AddToMemories
        open={keepOpen}
        moment={moment}
        onClose={() => setKeepOpen(false)}
        onDone={onChanged}
      />

      <Modal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        title="Share into"
        description="The moment goes as a way in, not as a copy."
        size="sm"
        footer={
          <div className="flex items-center justify-between gap-3">
            <span className="text-[11.5px] text-dim">
              {chosen.length ? `${chosen.length} picked` : "Nothing picked yet"}
            </span>
            <button
              type="button"
              className="btn btn-primary"
              disabled={!chosen.length || busy}
              onClick={() => void sendInto()}
            >
              {busy ? <LoaderCircle className="size-4 animate-spin" aria-hidden /> : null}
              Send
            </button>
          </div>
        }
      >
        <div className="p-2">
          {threads.isLoading ? (
            <div className="space-y-2 p-2" aria-hidden>
              {[0, 1, 2].map((row) => (
                <div key={row} className="skeleton h-11 rounded-[12px]" />
              ))}
            </div>
          ) : threads.isError ? (
            <p className="px-3 py-6 text-center text-[12.5px] text-dim">
              {errorMessage(threads.error)}
            </p>
          ) : (threads.data?.threads ?? []).length ? (
            (threads.data?.threads ?? []).map((thread) => {
              const person = thread.other ?? thread.member ?? thread.members?.[0]?.user ?? null;
              const title =
                thread.title ||
                person?.name ||
                person?.username ||
                (thread.kind === "group" ? "Group" : "Convo");
              const on = chosen.includes(String(thread.id));
              return (
                <button
                  key={String(thread.id)}
                  type="button"
                  aria-pressed={on}
                  onClick={() =>
                    setChosen((current) =>
                      current.includes(String(thread.id))
                        ? current.filter((row) => row !== String(thread.id))
                        : [...current, String(thread.id)],
                    )
                  }
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[12px] px-3 py-2.5 text-left transition",
                    on
                      ? "bg-[var(--accent-soft)]"
                      : "hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)]",
                  )}
                >
                  <Avatar user={person} name={title} src={thread.avatar} size={36} />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold">{title}</span>
                  {on ? <span className="text-[11px] font-bold text-accent">Picked</span> : null}
                </button>
              );
            })
          ) : (
            <p className="px-3 py-8 text-center text-[12.5px] text-dim">
              No convo to share it into.
            </p>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void takeDown()}
        title={memory ? "Remove this Memory?" : "Take this down?"}
        body={
          memory
            ? "It comes off your profile. The moments in it stay where they are."
            : "It goes for everybody, now, and there is no getting it back."
        }
        confirmLabel={memory ? "Remove" : "Take down"}
        destructive
        loading={busy}
        icon={<Trash2 className="size-4" aria-hidden />}
      />

      {/* The carried picture, opened in the editor a fresh moment opens in —
          seeded with the people it named, so the pills it arrived with are
          still on it when it goes up. */}
      {seed ? (
        <PhotoEditor
          shot={{ url: seed.url, kind: "image" }}
          mode="moment"
          shotAspect={seed.aspect}
          initialDoc={{
            ...defaultEditorDoc(frameForMode("moment", seed.aspect)),
            people: (item?.mentions ?? []).filter(
              (person) => !user?.id || String(person.id) !== String(user.id),
            ),
          }}
          posting={busy}
          onCancel={() => setSeed(null)}
          onDone={() => setSeed(null)}
          onPost={(doc) => void postCarried(doc)}
        />
      ) : null}

      {/* A moment made from another one opens as a walk of its own, the way the
          app pushes it: it was reached from a thing that names it, so what is
          asked for is that moment and not this author's newest. */}
      {source ? (
        <MomentViewer moments={[source]} onClose={() => setSource(null)} onChanged={onChanged} />
      ) : null}
    </div>,
    document.body,
  );
}

/** Whether the piece draws its own words, so the caption band stays out of it. */
function isTextItem(item: MomentItem): boolean {
  return item.kind === "text" || item.kind === "note";
}

/** Whether the piece draws its words under a square sleeve. */
function isSongCoverItem(item: MomentItem): boolean {
  const width = item.asset?.width ?? 0;
  return Boolean(item.sound) && !isVideoItem(item) && width > 0 && width === item.asset?.height;
}

/** "from Ayesha" — the credit line, under the name. */
function CreditLine({ credit }: { credit: UserCard }) {
  return (
    <span className="block truncate text-[12px] font-semibold text-white/85" style={OVER_MEDIA}>
      from {credit.name || `@${credit.username}`}
    </span>
  );
}

function HeaderButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="pointer-events-auto flex size-10 shrink-0 items-center justify-center rounded-full text-white transition hover:bg-white/10"
    >
      {children}
    </button>
  );
}

function RoundButton({
  label,
  onClick,
  type = "button",
  busy,
  children,
}: {
  label: string;
  onClick: () => void;
  type?: "button" | "submit";
  busy?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      aria-label={label}
      title={label}
      disabled={busy}
      className="flex size-[42px] shrink-0 items-center justify-center rounded-full text-white transition hover:bg-black/50 disabled:opacity-50"
      style={{ backgroundColor: CONTROL_FILL }}
    >
      {children}
    </button>
  );
}

function PersonRow({ person, trailing }: { person: UserCard; trailing?: string }) {
  return (
    <Link
      to={`/app/u/${person.username}`}
      className="flex items-center gap-3 px-4 py-2 transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
    >
      <Avatar user={person} size={38} />
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1">
          <span className="truncate text-[15px]">{person.name || person.username}</span>
          {person.verified ? <VerifiedTick size={14} /> : null}
        </span>
        <span dir="ltr" className="block truncate text-[12.5px] text-dim">
          @{person.username}
        </span>
      </span>
      {trailing ? <span className="text-[20px]">{trailing}</span> : null}
    </Link>
  );
}
