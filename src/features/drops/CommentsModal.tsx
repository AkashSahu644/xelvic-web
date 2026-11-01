import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Delete,
  Flag,
  Heart,
  Image as ImageIcon,
  Lock,
  MessageCircle,
  Mic,
  Pencil,
  Send,
  Smile,
  Trash,
  UserRound,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { AuthedImage } from "@/components/Media";
import { ConfirmDialog, Modal } from "@/components/Modal";
import { EmptyState, ErrorState } from "@/components/States";
import { VerifiedTick } from "@/components/Tick";
import { SheetRow } from "@/features/profile/parts";
import { ReportSheet } from "@/features/report/ReportSheet";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/errors";
import { count, relativeTime } from "@/lib/format";
import { uploadAsset } from "@/lib/upload";
import { useAuth } from "@/providers/AuthProvider";
import { useToast } from "@/providers/ToastProvider";
import type { Asset, Comment, Drop, Note, Sticker, UserCard } from "@/types/api";
import { dropIsVibe } from "./model";
import { RespondBody, RespondMedia, RespondSticker } from "./RespondParts";
import { RespondVoice } from "./RespondVoice";

/** The app's own ceiling on names in one respond — `kMentionMax`. */
const MAX_MENTION = 5;

/** How long a press has to be held before it is a menu rather than a reply. */
const HOLD_MS = 480;
/** How long a tap waits to find out it was not the first of two. */
const DOUBLE_MS = 250;

/**
 * Where a respond lives, which is two tables and two sets of routes.
 *
 * A Vibe's responds are its own rows on its own table, and the server files
 * them under `/drops/vibes/{id}/comments/` and `/drops/vibe-comments/` — the
 * same mistake of reading `/drops/{id}/...` for a clip would 404 rather than
 * say anything wrong, which is why the split is worked out once here. `row` is
 * the address of one respond by its own id, which is what a reword and a
 * take-down act on.
 */
function commentRoutes(drop: Drop) {
  return dropIsVibe(drop)
    ? { list: `/drops/vibes/${drop.id}/comments/`, row: "/drops/vibe-comments" }
    : { list: `/drops/${drop.id}/comments/`, row: "/drops/comments" };
}

/**
 * Where a note thread lives. Notes hang off the same post as its responds and
 * are split the same way; only the words at the end of the address differ.
 */
function noteRoutes(drop: Drop) {
  return dropIsVibe(drop)
    ? { list: `/drops/vibes/${drop.id}/notes/`, row: "/drops/vibe-notes" }
    : { list: `/drops/${drop.id}/notes/`, row: "/drops/notes" };
}

/**
 * One respond: who, when, what they said, the upload and sticker it carries,
 * and the two things done to one.
 *
 * Ported from `_CommentRow` in `screens/drop_sheets.dart`. A tap answers the
 * line — it starts the composer with the writer's handle in it — a double tap
 * agrees with it, and a hold opens the menu that is *about* it. The web has no
 * touch, so the same three live on a pointer: `pointerup` within 480ms is a
 * tap, a second tap inside 250ms is a double tap, and holding is the menu.
 */
function CommentRow({
  comment,
  likeBase,
  isReply,
  onAgree,
  onReply,
  onMenu,
}: {
  comment: Comment;
  likeBase: string;
  isReply: boolean;
  onAgree: () => void;
  onReply: () => void;
  onMenu: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const press = useRef({ hold: 0, tap: 0, held: false, tapAt: 0 });

  useEffect(() => {
    const state = press.current;
    return () => {
      window.clearTimeout(state.hold);
      window.clearTimeout(state.tap);
    };
  }, []);

  async function agree() {
    if (busy) return;
    setBusy(true);
    try {
      // The count is the server's and the flag is the tap: a comment's likes are
      // not on the card, so the list is re-read from the answer rather than
      // moved by a guess.
      await api.post(`${likeBase}/${comment.id}/like/`, { on: !comment.liked });
      onAgree();
    } catch {
      // The like is the server's to give; a failed one leaves the row as it was.
    } finally {
      setBusy(false);
    }
  }

  function down() {
    const state = press.current;
    state.held = false;
    window.clearTimeout(state.hold);
    state.hold = window.setTimeout(() => {
      state.held = true;
      onMenu();
    }, HOLD_MS);
  }

  function up() {
    window.clearTimeout(press.current.hold);
  }

  function press2(event: React.MouseEvent) {
    // The heart and Reply are their own buttons; a press that started inside one
    // is that button's and not the line's.
    if ((event.target as HTMLElement).closest("button, a")) return;
    if (press.current.held) {
      press.current.held = false;
      return;
    }
    const state = press.current;
    window.clearTimeout(state.tap);
    if (Date.now() - state.tapAt < DOUBLE_MS) {
      state.tapAt = 0;
      void agree();
      return;
    }
    state.tapAt = Date.now();
    state.tap = window.setTimeout(() => {
      state.tapAt = 0;
      onReply();
    }, DOUBLE_MS);
  }

  const liked = Boolean(comment.liked);

  return (
    <div
      className="flex gap-2.5 py-[7px] pe-2"
      style={{ paddingInlineStart: isReply ? 56 : 14 }}
    >
      <Link to={`/app/u/${comment.author.username}`} className="shrink-0">
        <Avatar user={comment.author} size={isReply ? 26 : 36} />
      </Link>
      <div
        className="min-w-0 flex-1"
        onPointerDown={down}
        onPointerUp={up}
        onPointerLeave={up}
        onPointerCancel={up}
        onClick={press2}
      >
        <div className="flex items-baseline gap-1.5">
          <Link
            to={`/app/u/${comment.author.username}`}
            className={cn(
              "truncate font-bold hover:underline",
              isReply ? "text-[12.5px] text-accent" : "text-[13px]",
            )}
          >
            {comment.author.username}
          </Link>
          {comment.author.verified ? <VerifiedTick size={13} /> : null}
          <span className="shrink-0 text-[11px] text-dim">{relativeTime(comment.created_at)}</span>
        </div>
        <div className="mt-0.5">
          <RespondBody body={comment.body} mentions={comment.mentions} />
        </div>
        {comment.sticker ? (
          <div className="mt-1.5">
            <RespondSticker sticker={comment.sticker} />
          </div>
        ) : null}
        {comment.asset ? (
          <div className="mt-1.5">
            <RespondMedia asset={comment.asset} />
          </div>
        ) : null}
        <div className="mt-[3px] flex items-center gap-4">
          <button
            type="button"
            onClick={() => void agree()}
            disabled={busy}
            className={cn(
              "flex items-center gap-1 text-[11.5px] font-bold transition",
              liked ? "text-accent" : "text-dim hover:text-ink",
            )}
            aria-label={liked ? "Take the felt back" : "Feel this"}
            aria-pressed={liked}
          >
            <Heart className={cn("size-[15px]", liked && "fill-current")} />
            {comment.likes ? <span className="num">{count(comment.likes)}</span> : null}
          </button>
          <button
            type="button"
            onClick={onReply}
            className="text-[11.5px] font-bold text-dim transition hover:text-ink"
          >
            Reply
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * One private note. A reader's own thread is drawn as a plain run of these; the
 * owner's view nests them under a thread header, which is what `dense` tightens
 * the row for.
 *
 * A note that is mine carries the way to take it back. The app does that with a
 * long press, which is the only gesture a phone has left on a line that is not
 * a button; on a mouse the same press is invisible, so the row says it with a
 * mark as well — the same act, made findable.
 */
function NoteRow({
  note,
  dense,
  onTake,
}: {
  note: Note;
  dense?: boolean;
  onTake?: () => void;
}) {
  return (
    <div className="flex gap-2.5 py-[7px]" style={{ paddingInlineStart: dense ? 0 : 14, paddingInlineEnd: 8 }}>
      <Link to={`/app/u/${note.author.username}`} className="shrink-0">
        <Avatar user={note.author} size={dense ? 28 : 36} />
      </Link>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1.5">
          <Link
            to={`/app/u/${note.author.username}`}
            className="truncate text-[13px] font-bold hover:underline"
          >
            {note.author.username}
          </Link>
          {note.author.verified ? <VerifiedTick size={13} /> : null}
          <span className="shrink-0 text-[11px] text-dim">{relativeTime(note.created_at)}</span>
        </div>
        {note.body ? (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-[13.5px] leading-[1.4]">{note.body}</p>
        ) : null}
        {note.sticker ? (
          <div className="mt-1.5">
            <RespondSticker sticker={note.sticker} />
          </div>
        ) : null}
        {note.asset ? (
          <div className="mt-1.5">
            <RespondMedia asset={note.asset} />
          </div>
        ) : null}
      </div>
      {note.mine && onTake ? (
        <button
          type="button"
          onClick={onTake}
          title="Take this note back"
          aria-label="Take this note back"
          className="shrink-0 self-start rounded-full p-1.5 text-dim transition hover:text-ink"
        >
          <Trash className="size-3.5" />
        </button>
      ) : null}
    </div>
  );
}

/**
 * One reader's whole thread, as the owner sees it: a header naming who it is
 * with and a Reply that aims the composer at them, over the lines so far.
 */
function NoteThread({
  subject,
  notes,
  active,
  onReply,
  onTake,
}: {
  subject: UserCard;
  notes: Note[];
  active: boolean;
  onReply: () => void;
  onTake: (note: Note) => void;
}) {
  return (
    <div
      className={cn(
        "mx-2.5 my-1.5 rounded-[14px] border px-3 pb-1.5 pt-2.5",
        active ? "border-accent" : "border-line",
      )}
      style={{ backgroundColor: "var(--card)" }}
    >
      <div className="flex items-center gap-1.5">
        <Lock className="size-3.5 shrink-0 text-dim" aria-hidden />
        <p className="min-w-0 flex-1 truncate text-[12px] font-bold text-dim">With @{subject.username}</p>
        <button
          type="button"
          onClick={onReply}
          className="text-[12px] font-bold text-accent"
        >
          {active ? "Replying" : "Reply"}
        </button>
      </div>
      <div className="mt-1">
        {notes.map((note) => (
          <NoteRow
            key={note.id}
            note={note}
            dense
            onTake={note.mine ? () => onTake(note) : undefined}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * The responds under a post, and the private notes beside them.
 *
 * Ported from `showComments` / `_Comments` in `screens/drop_sheets.dart`. Two
 * tabs and one sheet because the box that writes to them is one box: the tab
 * only decides which door the same act goes through. A respond is public and is
 * what the count on the card counts; a note is private — the poster and its
 * writer, and nobody else — which is why it is a tab here rather than a second
 * sheet.
 *
 * When the author has turned comments off, the comments tab says so and the box
 * for a respond is not drawn at all. Notes are untouched by that switch, because
 * a private line to the poster was never the room's.
 */
export function CommentsModal({
  drop,
  open,
  onClose,
  onCommented,
  draft,
  notes: openOnNotes,
}: {
  drop: Drop;
  open: boolean;
  onClose: () => void;
  onCommented?: () => void;
  /**
   * A line to start the composer with — the Vibe player's suggested replies.
   *
   * It is a *draft* and not a comment: it lands in the box and nothing is sent
   * until the person sends it, which is the only arrangement in which a
   * suggestion reads as the reader's own sentence rather than as the app
   * speaking in their voice.
   */
  draft?: string | null;
  /** Whether the sheet opens on the notes, the way a note's own notice does. */
  notes?: boolean;
}) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const routes = commentRoutes(drop);
  const noteWays = noteRoutes(drop);

  const [tab, setTab] = useState<"comments" | "notes">(openOnNotes ? "notes" : "comments");
  const [body, setBody] = useState(draft ?? "");
  const [attach, setAttach] = useState<Asset | null>(null);
  const [sticker, setSticker] = useState<Sticker | null>(null);
  const [mentions, setMentions] = useState<UserCard[]>([]);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);

  // A respond's reply target: the id the send files the new line under, and the
  // handle the composer shows. Set and cleared together, always.
  const [replyId, setReplyId] = useState<string | null>(null);
  const [replyName, setReplyName] = useState("");
  // Whose thread the owner is answering. Null for a reader — a reader has only
  // their own thread and names no subject.
  const [replySubject, setReplySubject] = useState<UserCard | null>(null);

  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [menuFor, setMenuFor] = useState<Comment | null>(null);
  const [reportFor, setReportFor] = useState<Comment | null>(null);
  const [editing, setEditing] = useState<Comment | null>(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [removing, setRemoving] = useState<Comment | null>(null);
  const [removingBusy, setRemovingBusy] = useState(false);
  const [takingNote, setTakingNote] = useState<Note | null>(null);
  const [takingBusy, setTakingBusy] = useState(false);

  const fileRef = useRef<HTMLInputElement>(null);
  const fieldRef = useRef<HTMLInputElement>(null);

  const onNotes = tab === "notes";

  // Opening the sheet re-seeds it: the draft lands in the box (and the box is
  // focused, as the app's is, so the rest of the sentence can be typed straight
  // away), and the tab is the one the opener asked for.
  useEffect(() => {
    if (!open) return;
    setTab(openOnNotes ? "notes" : "comments");
    setBody(draft ?? "");
    if (draft) window.setTimeout(() => fieldRef.current?.focus(), 60);
  }, [open, draft, openOnNotes]);

  const commentsQuery = useQuery({
    queryKey: ["drop-comments", drop.id],
    enabled: open,
    queryFn: () => api.get<{ comments: Comment[] }>(routes.list),
  });

  const notesQuery = useQuery({
    queryKey: ["drop-notes", drop.id],
    enabled: open && onNotes,
    queryFn: () => api.get<{ notes: Note[] }>(noteWays.list),
  });

  const mentionsLookup = useQuery({
    queryKey: ["mentionable", mentionQuery ?? ""],
    enabled: open && !onNotes && mentionQuery !== null,
    queryFn: () =>
      api.get<UserCard[]>("/social/mentionable/", {
        query: { q: (mentionQuery ?? "").trim() },
      }),
    staleTime: 60_000,
  });

  const stickerShelf = useQuery({
    queryKey: ["stickers"],
    enabled: open && stickerOpen,
    queryFn: () => api.get<{ stickers: Sticker[] }>("/stickers/"),
    staleTime: 5 * 60_000,
  });

  const comments = useMemo(() => commentsQuery.data?.comments ?? [], [commentsQuery.data]);
  const noteRows = useMemo(() => notesQuery.data?.notes ?? [], [notesQuery.data]);

  /**
   * Whether this account reads the notes as the owner does — every thread — or
   * as a reader does, only their own. The post's author always does; a
   * collaborator is told apart by a thread whose subject is somebody else.
   */
  const ownerSide = Boolean(drop.mine) || noteRows.some((note) => note.subject?.id !== user?.id);

  const mentionHits = useMemo(() => (mentionsLookup.data ?? []).slice(0, 30), [mentionsLookup.data]);

  const authorName = drop.author?.name || drop.author?.username || "this";
  const authorFirst = authorName.split(" ")[0];
  const total = drop.comments ?? comments.length;

  // The app folds a flat list back into threads here rather than on the server:
  // every line of its own, in the order the server ranked it, each followed by
  // the replies it collected. A reply whose parent was lost to the cap is still
  // drawn — at the tail, as a line of its own — because losing a parent is a
  // reason to show a reply, never a reason to drop something somebody wrote.
  const threaded = useMemo(() => {
    const tops = comments.filter((row) => !row.parent);
    const known = new Set(tops.map((row) => String(row.id)));
    const byParent = new Map<string, Comment[]>();
    const orphans: Comment[] = [];
    for (const row of comments) {
      if (!row.parent) continue;
      const key = String(row.parent);
      if (known.has(key)) {
        const run = byParent.get(key) ?? [];
        run.push(row);
        byParent.set(key, run);
      } else {
        orphans.push(row);
      }
    }
    return [...tops.flatMap((top) => [top, ...(byParent.get(String(top.id)) ?? [])]), ...orphans];
  }, [comments]);

  // The owner's notes grouped into one run per reader, in the order the readers
  // first appear — the subject is constant down a thread, so its id is the key.
  const noteThreads = useMemo(() => {
    const order: string[] = [];
    const bySubject = new Map<string, { subject: UserCard; notes: Note[] }>();
    for (const note of noteRows) {
      const key = String(note.subject?.id ?? note.author.id);
      const existing = bySubject.get(key);
      if (existing) {
        existing.notes.push(note);
      } else {
        order.push(key);
        bySubject.set(key, { subject: note.subject, notes: [note] });
      }
    }
    return order.map((key) => bySubject.get(key)!);
  }, [noteRows]);

  /** Leaving a tab drops what belonged only to it — the app's `_tabbed`. */
  function switchTab(next: "comments" | "notes") {
    if (next === tab) return;
    setTab(next);
    setReplyId(null);
    setReplyName("");
    setReplySubject(null);
    setMentions([]);
    setMentionQuery(null);
    setAttach(null);
    setSticker(null);
    setBody("");
  }

  /** The `@handle` the caret is sitting in, if any — the app's `_activeMention`. */
  function activeMention(value: string, caret: number): { start: number; query: string } | null {
    if (caret < 0 || caret > value.length) return null;
    for (let index = caret - 1; index >= 0; index -= 1) {
      const char = value[index];
      if (char === "@") {
        if (index === 0 || /\s/.test(value[index - 1])) {
          return { start: index, query: value.slice(index + 1, caret) };
        }
        return null;
      }
      if (/\s/.test(char)) return null;
    }
    return null;
  }

  function onWrite(event: React.ChangeEvent<HTMLInputElement>) {
    const value = event.target.value;
    setBody(value);
    // Notes name nobody: a note is private and the server files no line about
    // it, so the list never opens there.
    if (onNotes) {
      if (mentionQuery !== null) setMentionQuery(null);
      return;
    }
    const caret = event.target.selectionStart ?? value.length;
    setMentionQuery(activeMention(value, caret)?.query ?? null);
  }

  /** Put the tapped name into the line in place of what was typed after the `@`. */
  function chooseMention(person: UserCard) {
    const caret = fieldRef.current?.selectionStart ?? body.length;
    const active = activeMention(body, caret);
    if (!active) return;
    if (!mentions.some((row) => row.id === person.id) && mentions.length >= MAX_MENTION) {
      toast({ title: `A respond can name ${MAX_MENTION} people.`, tone: "error" });
      return;
    }
    const insert = `@${person.username} `;
    const next = `${body.slice(0, active.start)}${insert}${body.slice(caret)}`;
    setBody(next);
    if (!mentions.some((row) => row.id === person.id)) setMentions([...mentions, person]);
    setMentionQuery(null);
    window.setTimeout(() => fieldRef.current?.focus(), 0);
  }

  /** Aim the composer at the comment being answered. */
  function startReply(comment: Comment) {
    // Answering a reply answers the *thread*, not that one line: the sheet draws
    // one step of nesting, so a reply to a reply attaches to the comment at the
    // top of the run. The name in the box is still the person being answered.
    setReplyId(String(comment.parent ?? comment.id));
    setReplyName(comment.author.username);
    setBody(`@${comment.author.username} `);
    window.setTimeout(() => fieldRef.current?.focus(), 0);
  }

  async function pickImage(file: File | undefined) {
    if (!file || uploading) return;
    setUploading(true);
    try {
      const asset = await uploadAsset(file, { kind: "image" });
      setAttach(asset);
    } catch (error) {
      toast({ title: "That picture did not go up", description: errorMessage(error), tone: "error" });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function pickVoice(file: File) {
    setVoiceOpen(false);
    setUploading(true);
    try {
      const asset = await uploadAsset(file, { voice: true });
      setAttach(asset);
    } catch (error) {
      toast({ title: "That voice note did not go up", description: errorMessage(error), tone: "error" });
    } finally {
      setUploading(false);
    }
  }

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = body.trim();
    const chosen = attach;
    const worn = sticker;
    if (sending || uploading) return;
    if (!text && !chosen && !worn) return;
    if (onNotes && ownerSide && !replySubject) {
      toast({ title: "Tap a note to reply to that reader.", tone: "error" });
      return;
    }

    setSending(true);
    try {
      if (onNotes) {
        const answer = await api.post<{ note: Note }>(noteWays.list, {
          body: text,
          ...(replySubject ? { subject: replySubject.id } : {}),
          ...(chosen ? { asset: chosen.id } : {}),
          ...(worn ? { sticker: worn.id } : {}),
        });
        // The owner stays in the thread they just answered; a reader has the one
        // thread and nothing to hold onto.
        queryClient.setQueryData<{ notes: Note[] }>(["drop-notes", drop.id], (current) => ({
          notes: [...(current?.notes ?? []), answer.note],
        }));
      } else {
        // Only name the people whose handle is still in the line — one picked
        // and then deleted should not get a ping for a name that is no longer
        // there.
        const lower = text.toLowerCase();
        const named = mentions
          .filter((person) => lower.includes(`@${person.username.toLowerCase()}`))
          .map((person) => person.id);
        const answer = await api.post<{ comment: Comment; count?: number }>(routes.list, {
          body: text,
          ...(chosen ? { asset: chosen.id } : {}),
          ...(worn ? { sticker: worn.id } : {}),
          ...(replyId ? { parent: replyId } : {}),
          ...(named.length ? { mentions: named } : {}),
        });
        queryClient.setQueryData<{ comments: Comment[] }>(["drop-comments", drop.id], (current) => ({
          comments: [answer.comment, ...(current?.comments ?? [])],
        }));
        setReplyId(null);
        setReplyName("");
        setMentions([]);
        void queryClient.invalidateQueries({ queryKey: ["drops"] });
        onCommented?.();
      }
      setBody("");
      setAttach(null);
      setSticker(null);
      setMentionQuery(null);
    } catch (error) {
      toast({
        title: onNotes ? "That note did not send" : "That respond did not send",
        description: errorMessage(error),
        tone: "error",
      });
    } finally {
      setSending(false);
    }
  }

  /** The comments as they are read: each line followed by the replies it took. */
  function commentRows() {
    return threaded.map((comment) => (
      <CommentRow
        key={String(comment.id)}
        comment={comment}
        likeBase={routes.row}
        isReply={Boolean(comment.parent)}
        onAgree={() => void commentsQuery.refetch()}
        onReply={() => startReply(comment)}
        onMenu={() => setMenuFor(comment)}
      />
    ));
  }

  async function saveEdit() {
    if (!editing || savingEdit) return;
    const text = editText.trim();
    if (!text || text === editing.body) {
      setEditing(null);
      return;
    }
    setSavingEdit(true);
    try {
      // The same filter the composer sends by on the way up — a handle taken out
      // of the words is a name taken back.
      const lower = text.toLowerCase();
      const named = (editing.mentions ?? [])
        .filter((person) => lower.includes(`@${person.username.toLowerCase()}`))
        .map((person) => person.id);
      const answer = await api.patch<{ comment: Comment }>(`${routes.row}/${editing.id}/`, {
        body: text,
        mentions: named,
      });
      queryClient.setQueryData<{ comments: Comment[] }>(["drop-comments", drop.id], (current) =>
        current
          ? {
              comments: current.comments.map((row) =>
                String(row.id) === String(answer.comment.id) ? answer.comment : row,
              ),
            }
          : current,
      );
      setEditing(null);
    } catch (error) {
      toast({ title: "That reword did not go through", description: errorMessage(error), tone: "error" });
    } finally {
      setSavingEdit(false);
    }
  }

  async function removeComment() {
    if (!removing || removingBusy) return;
    setRemovingBusy(true);
    try {
      await api.delete(`${routes.row}/${removing.id}/`);
      queryClient.setQueryData<{ comments: Comment[] }>(["drop-comments", drop.id], (current) =>
        current
          ? { comments: current.comments.filter((row) => String(row.id) !== String(removing.id)) }
          : current,
      );
      void queryClient.invalidateQueries({ queryKey: ["drops"] });
      setRemoving(null);
    } catch (error) {
      toast({ title: "That respond stayed", description: errorMessage(error), tone: "error" });
    } finally {
      setRemovingBusy(false);
    }
  }

  async function takeNote(note: Note) {
    if (takingBusy) return;
    setTakingBusy(true);
    try {
      await api.delete(`${noteWays.row}/${note.id}/`);
      queryClient.setQueryData<{ notes: Note[] }>(["drop-notes", drop.id], (current) =>
        current ? { notes: current.notes.filter((row) => String(row.id) !== String(note.id)) } : current,
      );
      setTakingNote(null);
    } catch (error) {
      toast({ title: "That note stayed", description: errorMessage(error), tone: "error" });
    } finally {
      setTakingBusy(false);
    }
  }

  const hint = onNotes
    ? !ownerSide
      ? "Write a private note"
      : replySubject
        ? `Replying to @${replySubject.username}`
        : "Tap a note to reply to that reader."
    : replyName
      ? `Replying to @${replyName}`
      : "Say something";

  // A respond cannot be written where the author has shut the door; a note can.
  const shut = Boolean(drop.comments_off) && !onNotes;

  const composer = (
    <div className="space-y-2 py-0.5">
      {attach || sticker ? (
        <div className="flex items-center gap-1.5">
          {attach ? (
            <span className="flex items-center gap-2 rounded-[12px] border border-line bg-card p-1.5 pe-2">
              {attach.kind === "image" ? (
                <AuthedImage
                  src={attach.thumbnail_url ?? attach.content_url}
                  alt=""
                  className="size-10 shrink-0 rounded-[8px]"
                />
              ) : (
                <Mic className="size-5 shrink-0 text-accent" aria-hidden />
              )}
              <span className="text-[13px]">
                {attach.kind === "image" ? "Picture ready" : "Voice note ready"}
              </span>
              <button
                type="button"
                onClick={() => setAttach(null)}
                aria-label="Take the upload off"
                className="text-dim hover:text-ink"
              >
                ×
              </button>
            </span>
          ) : null}
          {sticker ? (
            <span className="flex items-center gap-1.5 rounded-[12px] border border-line bg-card p-1.5">
              <RespondSticker sticker={sticker} />
              <button
                type="button"
                onClick={() => setSticker(null)}
                aria-label="Take the sticker off"
                className="text-dim hover:text-ink"
              >
                ×
              </button>
            </span>
          ) : null}
        </div>
      ) : null}

      {!onNotes && mentionQuery !== null ? (
        <div className="max-h-[200px] overflow-y-auto rounded-[12px] border border-line bg-card">
          {mentionHits.length ? (
            mentionHits.map((person) => (
              <button
                key={String(person.id)}
                type="button"
                onClick={() => chooseMention(person)}
                className="flex w-full items-center gap-2.5 px-3 py-2 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
              >
                <Avatar user={person} size={30} />
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1">
                    <span className="truncate text-[14px]">{person.name || person.username}</span>
                    {person.verified ? <VerifiedTick size={13} /> : null}
                  </span>
                  <span className="block truncate text-[12px] text-dim">@{person.username}</span>
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-2.5 text-[12px] text-dim">Nobody by that name.</p>
          )}
        </div>
      ) : null}

      <form onSubmit={send} className="flex items-end gap-1">
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(event) => void pickImage(event.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={Boolean(attach) || uploading}
          className="icon-btn size-9 shrink-0 disabled:opacity-40"
          title="Picture"
          aria-label="Attach a picture"
        >
          <ImageIcon className="size-[18px]" />
        </button>
        <button
          type="button"
          onClick={() => setStickerOpen(true)}
          disabled={Boolean(sticker)}
          className="icon-btn size-9 shrink-0 disabled:opacity-40"
          title="Sticker"
          aria-label="Attach a sticker"
        >
          <Smile className="size-[18px]" />
        </button>
        <button
          type="button"
          onClick={() => setVoiceOpen(true)}
          disabled={Boolean(attach) || uploading}
          className="icon-btn size-9 shrink-0 disabled:opacity-40"
          title="Voice note"
          aria-label="Record a voice note"
        >
          <Mic className="size-[18px]" />
        </button>
        <input
          ref={fieldRef}
          value={body}
          onChange={onWrite}
          placeholder={hint}
          maxLength={1000}
          className="field min-h-11 flex-1 rounded-[20px] py-2.5 text-[14px]"
          aria-label={onNotes ? "Your note" : "Your respond"}
        />
        <Button
          type="submit"
          size="sm"
          className="size-11 shrink-0 p-0"
          disabled={(!body.trim() && !attach && !sticker) || uploading}
          loading={sending}
          aria-label={onNotes ? "Send note" : "Send respond"}
        >
          {!sending ? <Send className="size-4" /> : null}
        </Button>
      </form>
    </div>
  );

  return (
    <>
      <Modal
        open={open}
        onClose={onClose}
        title="Respond"
        description={
          onNotes
            ? ownerSide
              ? "Private threads — you and each reader."
              : `Only you and ${authorFirst} see this.`
            : `${total} ${total === 1 ? "respond" : "responds"} on ${authorName}'s drop`
        }
        size="md"
        footer={
          shut ? (
            <p className="flex items-center justify-center gap-2 py-2 text-[13px] font-semibold text-dim">
              <MessageCircle className="size-4" aria-hidden />
              Comments are turned off
            </p>
          ) : (
            composer
          )
        }
      >
        <div className="flex gap-1 border-b border-line px-4">
          {(["comments", "notes"] as const).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => switchTab(key)}
              aria-pressed={tab === key}
              className={cn(
                "-mb-px border-b-2 px-2 pb-2.5 pt-2 text-[14px] font-bold transition",
                tab === key ? "border-accent text-ink" : "border-transparent text-dim hover:text-ink",
              )}
            >
              {key === "comments" ? "Comments" : "Notes"}
            </button>
          ))}
        </div>

        {!onNotes ? (
          commentsQuery.isLoading ? (
            <div className="space-y-1 p-4" aria-hidden>
              {[0, 1, 2].map((row) => (
                <div key={row} className="flex gap-3 py-3">
                  <div className="skeleton size-9 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-2.5 w-24 rounded-full" />
                    <div className="skeleton h-3 w-4/5 rounded-full" />
                  </div>
                </div>
              ))}
            </div>
          ) : commentsQuery.isError ? (
            <ErrorState error={commentsQuery.error} onRetry={() => void commentsQuery.refetch()} compact />
          ) : threaded.length === 0 ? (
            <EmptyState
              icon={<MessageCircle className="size-6" />}
              title="No comments yet"
              body="Be the first to say something."
              className="py-12"
            />
          ) : (
            <div className="pb-1">{commentRows()}</div>
          )
        ) : notesQuery.isLoading ? (
          <div className="flex justify-center py-10">
            <span className="size-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          </div>
        ) : notesQuery.isError ? (
          <ErrorState error={notesQuery.error} onRetry={() => void notesQuery.refetch()} compact />
        ) : noteRows.length === 0 ? (
          <EmptyState
            icon={<Lock className="size-6" />}
            title="No notes yet"
            body={
              ownerSide
                ? "A note here is private — only you and the reader who left it."
                : `A note is private — only you and ${authorFirst} see it.`
            }
            className="py-12"
          />
        ) : ownerSide ? (
          <div className="py-1.5">
            {noteThreads.map((thread) => (
              <NoteThread
                key={String(thread.subject?.id ?? thread.notes[0]?.id)}
                subject={thread.subject}
                notes={thread.notes}
                active={replySubject?.id === thread.subject?.id}
                onReply={() => {
                  setReplySubject(thread.subject);
                  window.setTimeout(() => fieldRef.current?.focus(), 0);
                }}
                onTake={(note) => setTakingNote(note)}
              />
            ))}
          </div>
        ) : (
          <div className="py-1.5">
            {noteRows.map((note) => (
              <NoteRow key={String(note.id)} note={note} onTake={note.mine ? () => setTakingNote(note) : undefined} />
            ))}
          </div>
        )}
      </Modal>

      {/* What a hold on a respond opens. Mine has nothing to report and no
          stranger to look up, so it offers the two things only I can do;
          anybody else's offers their page and a complaint. */}
      <Modal
        open={Boolean(menuFor)}
        onClose={() => setMenuFor(null)}
        title={menuFor?.author.name || menuFor?.author.username || "Respond"}
        description={menuFor ? `@${menuFor.author.username}` : undefined}
        size="sm"
      >
        <div className="pb-2">
          {menuFor?.mine ? (
            <>
              <SheetRow
                icon={<Pencil className="size-[18px]" />}
                label="Edit"
                onClick={() => {
                  setEditing(menuFor);
                  setEditText(menuFor.body ?? "");
                  setMenuFor(null);
                }}
              />
              <SheetRow
                icon={<Delete className="size-[18px]" />}
                label="Remove"
                onClick={() => {
                  setRemoving(menuFor);
                  setMenuFor(null);
                }}
              />
            </>
          ) : menuFor ? (
            <>
              <SheetRow
                icon={<UserRound className="size-[18px]" />}
                label="About this account"
                onClick={() => {
                  setMenuFor(null);
                  navigate(`/app/u/${menuFor.author.username}`);
                }}
              />
              <SheetRow
                icon={<Flag className="size-[18px]" />}
                label="Report this comment"
                line={`A moderator looks at it. ${menuFor.author.name?.split(" ")[0] || menuFor.author.username} is not told.`}
                onClick={() => {
                  setReportFor(menuFor);
                  setMenuFor(null);
                }}
              />
            </>
          ) : null}
        </div>
      </Modal>

      {reportFor ? (
        <ReportSheet
          open={Boolean(reportFor)}
          onClose={() => setReportFor(null)}
          kind={dropIsVibe(drop) ? "vibe_comment" : "drop_comment"}
          id={String(reportFor.id)}
          who={reportFor.author.name || reportFor.author.username}
          handle={reportFor.author.username}
          avatar={reportFor.author.avatar}
          preview={reportFor.body}
        />
      ) : null}

      <Modal
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        title="Edit"
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setEditing(null)}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => void saveEdit()}
              disabled={savingEdit || !editText.trim()}
            >
              {savingEdit ? "Working..." : "Save"}
            </button>
          </div>
        }
      >
        <div className="px-4 py-3">
          <textarea
            value={editText}
            onChange={(event) => setEditText(event.target.value)}
            maxLength={1000}
            rows={3}
            className="field min-h-[96px] resize-y text-[14px]"
            aria-label="Reword your respond"
            placeholder="Say something"
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={() => void removeComment()}
        title="Remove this comment?"
        body="It goes away for everybody."
        confirmLabel="Remove"
        destructive
        loading={removingBusy}
      />

      <ConfirmDialog
        open={Boolean(takingNote)}
        onClose={() => setTakingNote(null)}
        onConfirm={() => takingNote && void takeNote(takingNote)}
        title="Remove this note?"
        body="It goes away for both sides of the thread."
        confirmLabel="Remove"
        destructive
        loading={takingBusy}
      />

      {/* The shelf a respond's sticker comes off — the same catalogue a moment's
          picker reads, which is what makes a sticker picked here the same one
          everywhere it is worn. */}
      <Modal open={stickerOpen} onClose={() => setStickerOpen(false)} title="Stickers" size="md">
        {stickerShelf.isLoading ? (
          <div className="grid grid-cols-4 gap-2 p-3" aria-hidden>
            {Array.from({ length: 8 }, (_, index) => (
              <div key={index} className="skeleton aspect-square rounded-[12px]" />
            ))}
          </div>
        ) : stickerShelf.isError ? (
          <ErrorState error={stickerShelf.error} onRetry={() => void stickerShelf.refetch()} compact />
        ) : (stickerShelf.data?.stickers ?? []).filter((row) => row.url).length === 0 ? (
          <p className="px-4 py-10 text-center text-[13px] text-dim">No stickers on offer right now.</p>
        ) : (
          <div className="grid grid-cols-4 gap-2 p-3">
            {(stickerShelf.data?.stickers ?? [])
              .filter((row) => row.url)
              .map((row) => (
                <button
                  key={String(row.id)}
                  type="button"
                  onClick={() => {
                    setSticker(row);
                    setStickerOpen(false);
                  }}
                  className="aspect-square rounded-[12px] border border-line p-1 transition hover:border-accent/40"
                  aria-label={row.name || "Sticker"}
                >
                  <img
                    src={row.url ?? undefined}
                    alt=""
                    loading="lazy"
                    className="size-full object-contain"
                  />
                </button>
              ))}
          </div>
        )}
      </Modal>

      <RespondVoice
        open={voiceOpen}
        onClose={() => setVoiceOpen(false)}
        onRecorded={(file) => void pickVoice(file)}
      />
    </>
  );
}