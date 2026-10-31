import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Camera,
  CameraOff,
  Crown,
  Gamepad2,
  Hand,
  Headphones,
  Mic,
  MicOff,
  PhoneOff,
  Radio,
  Send,
  Share2,
  Video,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { ConfirmDialog, Modal } from "@/components/Modal";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/States";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { count, relativeTime } from "@/lib/format";
import { useAuth } from "@/providers/AuthProvider";
import { useSocket, useSocketEvent } from "@/providers/SocketProvider";
import { useToast } from "@/providers/ToastProvider";
import type { SpacePerson, SpaceRoom, ThreadCard, UserCard } from "@/types/api";

interface RoomGame {
  kind: string;
  rule: string;
  name: string;
  state: "open" | "playing" | "won" | "drawn" | string;
  board: string;
  cols: number;
  rows: number;
  need?: number;
  misere?: boolean;
  drop?: boolean;
  turn: string;
  x?: { user?: string; name?: string; username?: string; avatar?: string | null };
  o?: { user?: string; name?: string; username?: string; avatar?: string | null } | null;
  winner?: { user?: string; name?: string } | null;
  line?: number[];
  moves?: number;
  legal?: number[][];
}

interface GameOffer {
  kind: string;
  name: string;
  blurb: string;
  cols: number;
  rows: number;
  bundled?: boolean;
}

interface ChatLine {
  id: string;
  user: string;
  name: string;
  text: string;
  at: string;
}

function personCard(person?: SpacePerson | null): UserCard | null {
  if (!person?.user) return null;
  return {
    id: person.user,
    username: person.username || "",
    name: person.name || person.username || "Someone",
    avatar: person.avatar ?? null,
    initials: "",
  };
}

function Board({
  game,
  mine,
  onPlay,
}: {
  game: RoomGame;
  mine: string;
  onPlay: (move: number) => void;
}) {
  const cells = game.board.split("");
  const canPlay = game.state === "playing" && game.turn === mine;
  const winning = new Set(game.line ?? []);
  const rows = Math.max(1, game.rows || 1);
  const cols = Math.max(1, game.cols || 1);

  if (game.rule !== "line") {
    return (
      <div className="rounded-[16px] border border-line bg-card p-4">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[12px] font-extrabold">{game.name}</p>
          <span className="text-[10px] text-dim">{game.moves ?? 0} moves</span>
        </div>
        <p className="break-all font-mono text-[11px] leading-5 text-dim">{game.board}</p>
        {game.legal?.length ? <p className="mt-2 text-[10px] text-dim">{game.legal.length} legal moves</p> : null}
      </div>
    );
  }

  return (
    <div className="rounded-[16px] border border-line bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-[12px] font-extrabold">{game.name}</p>
        <span className="text-[10px] text-dim">{game.state === "playing" ? `${game.turn === "x" ? game.x?.name || "X" : game.o?.name || "O"} to move` : game.state}</span>
      </div>
      <div
        className="mx-auto grid max-w-[340px] gap-1"
        style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
      >
        {Array.from({ length: rows * cols }).map((_, displayIndex) => {
          const displayRow = Math.floor(displayIndex / cols);
          const col = displayIndex % cols;
          const row = rows - 1 - displayRow;
          const index = row * cols + col;
          const cell = cells[index] || ".";
          const isWinning = winning.has(index);
          return (
            <button
              key={index}
              type="button"
              disabled={!canPlay}
              onClick={() => onPlay(index)}
              className={cn(
                "flex aspect-square items-center justify-center rounded-[7px] border border-line bg-[color-mix(in_srgb,var(--ink)_4%,var(--card))] text-[16px] font-black transition",
                canPlay && cell === "." && "hover:border-accent hover:bg-[var(--accent-soft)]",
                isWinning && "border-accent bg-[var(--accent-soft)] text-accent",
                !canPlay && "cursor-default",
              )}
              aria-label={`Row ${row + 1}, column ${col + 1}`}
            >
              {cell === "x" ? <span className="text-accent">×</span> : cell === "o" ? <span className="text-[var(--good)]">○</span> : cell !== "." ? <span className="text-[10px]">{cell}</span> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function RoomPage() {
  const { roomId = "" } = useParams();
  const { user } = useAuth();
  const { status, send } = useSocket();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [chat, setChat] = useState<ChatLine[]>([]);
  const [draft, setDraft] = useState("");
  const [throws, setThrows] = useState<{ id: string; name: string; emoji: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [gameOpen, setGameOpen] = useState(false);
  const [sharing, setSharing] = useState(false);
  const joined = useRef<string | null>(null);
  const chatEnd = useRef<HTMLDivElement>(null);

  const roomQuery = useQuery({
    queryKey: ["room", roomId],
    queryFn: () => api.get<{ room: SpaceRoom }>(`/spaces/${roomId}/`),
    enabled: Boolean(roomId),
    refetchInterval: 20_000,
  });
  const gamesQuery = useQuery({
    queryKey: ["spaces-games"],
    queryFn: () => api.get<{ games: GameOffer[] }>("/spaces/games/"),
    enabled: gameOpen,
  });
  const threads = useQuery({
    queryKey: ["threads-share"],
    queryFn: () => api.get<{ threads: ThreadCard[] }>("/chat/threads/"),
    enabled: shareOpen,
    staleTime: 20_000,
  });

  const room = roomQuery.data?.room;
  const game = room?.game as RoomGame | null | undefined;
  const mine = game ? (game.x?.user === user?.id ? "x" : game.o?.user === user?.id ? "o" : "") : "";
  const stage = room?.stage ?? [];
  const raised = room?.raised ?? [];

  function updateRoom(next: SpaceRoom) {
    queryClient.setQueryData(["room", roomId], { room: next });
  }

  async function act(path: string, body?: unknown) {
    if (busy) return;
    setBusy(true);
    try {
      const result = await api.post<{ room: SpaceRoom }>(`/spaces/${roomId}/${path}/`, body);
      updateRoom(result.room);
      await queryClient.invalidateQueries({ queryKey: ["rooms"] });
    } catch (error) {
      toast({
        title: "That did not work",
        description: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    if (status !== "live" || !roomId) return;
    send({ action: "room.watch", room: roomId });
    return () => {
      send({ action: "room.watch", room: null });
    };
  }, [status, roomId, send]);

  useEffect(() => {
    if (!room || room.state !== "live" || room.me?.in || joined.current === room.id) return;
    joined.current = room.id;
    void api.post<{ room: SpaceRoom }>(`/spaces/${room.id}/join/`).then((result) => updateRoom(result.room)).catch(() => {
      joined.current = null;
    });
    // The room is the only thing that decides whether this has happened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, room?.state, room?.me?.in]);

  useSocketEvent(["room.update", "room.gone"], () => {
    void roomQuery.refetch();
  });
  useSocketEvent(["room.say"], (frame) => {
    const data = frame.data as { user?: string; name?: string; text?: string; at?: string } | undefined;
    if (!data?.text) return;
    const text = data.text;
    setChat((current) => [...current.slice(-80), {
      id: `${data.user}-${data.at}-${Math.random()}`,
      user: data.user || "",
      name: data.name || "Someone",
      text,
      at: data.at || new Date().toISOString(),
    }]);
  });
  useSocketEvent(["room.react"], (frame) => {
    const data = frame.data as { name?: string; emoji?: string } | undefined;
    if (!data?.emoji) return;
    const emoji = data.emoji;
    const id = `${Date.now()}-${Math.random()}`;
    setThrows((current) => [...current.slice(-20), { id, name: data.name || "Someone", emoji }]);
    window.setTimeout(() => setThrows((current) => current.filter((item) => item.id !== id)), 3200);
  });
  useSocketEvent(["room.game"], () => {
    void roomQuery.refetch();
  });

  useEffect(() => {
    chatEnd.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [chat.length]);

  function say() {
    const text = draft.trim();
    if (!text || !room) return;
    if (!send({ action: "room.say", room: room.id, text })) {
      toast({ title: "You are not connected to the room yet", tone: "error" });
      return;
    }
    setDraft("");
  }

  function react(emoji: string) {
    if (!room) return;
    if (!send({ action: "room.react", room: room.id, emoji })) {
      toast({ title: "You are not connected to the room yet", tone: "error" });
    }
  }

  async function share(thread: ThreadCard) {
    if (!room || sharing) return;
    setSharing(true);
    try {
      await api.post(`/spaces/${room.id}/share/`, { thread: thread.id });
      setShareOpen(false);
      toast({ title: "Sent to the convo", tone: "success" });
    } catch (error) {
      toast({
        title: "Could not share the room",
        description: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    } finally {
      setSharing(false);
    }
  }

  const host = room?.me?.host || room?.mine;
  const onStage = Boolean(room?.me?.in && room.me.role !== "listener");
  const isLive = room?.state === "live";

  return (
    <div className="min-h-dvh pb-[calc(100px+env(safe-area-inset-bottom,0px))] md:pb-24">
      <header className="sticky top-0 z-30 border-b border-line bg-[color-mix(in_srgb,var(--page)_90%,transparent)] backdrop-blur-xl">
        <div className="mx-auto flex w-full max-w-[1100px] items-center gap-3 px-4 py-3">
          <button type="button" onClick={() => window.history.back()} className="icon-btn -ml-2" aria-label="Back">
            <ArrowLeft className="size-5" />
          </button>
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-[16px] font-extrabold tracking-tight">{room?.title || "Room"}</h1>
            <p className="flex items-center gap-1.5 text-[10px] text-dim">
              <span className={cn("size-1.5 rounded-full", isLive ? "bg-[#e02d5a]" : "bg-dim")} />
              {room?.state === "live" ? `${count(room.listeners)} listening` : room?.state || "room"}
              {room?.kind ? ` · ${room.kind}` : ""}
            </p>
          </div>
          <button type="button" onClick={() => setShareOpen(true)} className="icon-btn" aria-label="Share room">
            <Share2 className="size-4" />
          </button>
          {host && isLive ? (
            <Button size="sm" variant="danger" onClick={() => setEndOpen(true)} icon={<PhoneOff className="size-3.5" />}>
              <span className="hidden sm:inline">End</span>
            </Button>
          ) : null}
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1100px] px-4 py-4 md:px-6">
        {roomQuery.isLoading ? (
          <PageSkeleton rows={3} />
        ) : roomQuery.isError ? (
          <div className="card"><ErrorState error={roomQuery.error} onRetry={() => void roomQuery.refetch()} /></div>
        ) : !room ? (
          <div className="card"><EmptyState icon={<Radio className="size-6" />} title="This room is not here" body="It may have ended or the link may be wrong." action={<Link to="/app/live" className="btn btn-primary">Back to Live</Link>} /></div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
            <div className="space-y-4">
              <section className="relative overflow-hidden rounded-[22px] border border-line bg-[color-mix(in_srgb,var(--accent)_9%,var(--card))] p-4">
                <div className="flex items-start gap-3">
                  <Avatar user={room.host} size={44} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[12px] font-extrabold">{room.host?.name || room.host?.username || "The host"}</p>
                    <p className="text-[10px] text-dim">
                      {room.kind === "ama" ? "Taking questions" : room.kind === "stream" ? "Streaming" : "Holding the room"}
                      {room.started_at ? ` · started ${relativeTime(room.started_at)}` : ""}
                    </p>
                    {room.note ? <p className="mt-2 text-[12px] leading-5 text-dim">{room.note}</p> : null}
                  </div>
                  <span className="rounded-full bg-[var(--accent-soft)] px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider text-accent">{room.state}</span>
                </div>
                {room.starts_at && room.state === "scheduled" ? (
                  <div className="mt-3 rounded-[12px] border border-line bg-card px-3 py-2 text-[11px] text-dim">
                    Starts {relativeTime(room.starts_at)}. The room opens when the host starts it.
                  </div>
                ) : null}
              </section>

              {room.state === "live" && !room.me?.in ? (
                <Button full onClick={() => void act("join")} loading={busy} icon={<Headphones className="size-4" />}>Join the room</Button>
              ) : null}

              {room.state === "scheduled" && host ? (
                <Button full onClick={() => void act("start")} loading={busy} icon={<Radio className="size-4" />}>Start the room</Button>
              ) : null}

              {room.state === "ended" ? (
                <div className="rounded-[16px] border border-line bg-card px-4 py-3 text-center text-[12px] text-dim">This room is over.</div>
              ) : null}

              {stage.length ? (
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="text-[13px] font-extrabold">On stage</h2>
                    <span className="text-[10px] text-dim">{stage.length} seats</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {stage.map((person) => {
                      const card = personCard(person);
                      return (
                        <div key={person.user} className="relative overflow-hidden rounded-[16px] border border-line bg-card p-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar user={card} size={36} />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[11px] font-extrabold">{person.name || person.username}</p>
                              <p className="flex items-center gap-1 text-[9px] text-dim">
                                {person.role === "host" ? <Crown className="size-3 text-accent" /> : null}
                                {person.muted ? <MicOff className="size-3" /> : <Mic className="size-3" />}
                                {person.camera ? <Camera className="size-3" /> : null}
                                {person.role}
                              </p>
                            </div>
                          </div>
                          {host && person.role !== "host" ? (
                            <div className="mt-2 flex gap-1">
                              <button type="button" disabled={busy} onClick={() => void act("dismiss", { user: person.user })} className="rounded bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] px-1.5 py-1 text-[9px] font-bold text-dim hover:text-ink">Step down</button>
                              <button type="button" disabled={busy} onClick={() => void act("mute", { user: person.user, muted: !person.muted })} className="rounded bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] px-1.5 py-1 text-[9px] font-bold text-dim hover:text-ink">{person.muted ? "Unmute" : "Mute"}</button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {raised.length ? (
                <section>
                  <h2 className="mb-2 text-[13px] font-extrabold">Hands up</h2>
                  <div className="space-y-1.5">
                    {raised.map((person) => {
                      const card = personCard(person);
                      return (
                        <div key={person.user} className="flex items-center gap-3 rounded-[12px] border border-line bg-card px-3 py-2">
                          <Avatar user={card} size={30} />
                          <span className="min-w-0 flex-1 truncate text-[11px] font-bold">{person.name || person.username}</span>
                          {host ? (
                            <Button size="sm" variant="secondary" onClick={() => void act("stage", { user: person.user })} loading={busy}>Bring up</Button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {game ? (
                <section>
                  <div className="mb-2 flex items-center justify-between">
                    <h2 className="flex items-center gap-1.5 text-[13px] font-extrabold"><Gamepad2 className="size-4 text-accent" /> The board</h2>
                    {host ? <button type="button" onClick={() => setGameOpen(true)} className="text-[10px] font-bold text-accent hover:underline">Change game</button> : null}
                  </div>
                  <Board game={game} mine={mine} onPlay={(move) => void act("game/play", { move })} />
                  <div className="mt-2 flex flex-wrap gap-2">
                    {game.state === "open" && onStage ? <Button size="sm" onClick={() => void act("game/join")} loading={busy}>Sit down</Button> : null}
                    {host && (game.state === "won" || game.state === "drawn") ? <Button size="sm" onClick={() => void act("game/again")} loading={busy}>Play again</Button> : null}
                    {host ? <Button size="sm" variant="secondary" onClick={() => void act("game/close")} loading={busy}>Put the board away</Button> : null}
                  </div>
                </section>
              ) : host && isLive ? (
                <button type="button" onClick={() => setGameOpen(true)} className="flex w-full items-center gap-3 rounded-[16px] border border-dashed border-line bg-card p-4 text-left transition hover:border-accent/40">
                  <span className="flex size-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent"><Gamepad2 className="size-5" /></span>
                  <span>
                    <span className="block text-[12px] font-extrabold">Put a board in the room</span>
                    <span className="block text-[10px] text-dim">Noughts and crosses, chess, and more.</span>
                  </span>
                </button>
              ) : null}

              {room.state === "live" ? (
                <section className="rounded-[18px] border border-line bg-card p-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-[13px] font-extrabold">Room chat</h2>
                    <span className="text-[10px] text-dim">Anybody seated can talk</span>
                  </div>
                  <div className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
                    {!chat.length ? (
                      <p className="py-6 text-center text-[11px] text-dim">No lines yet. Say the first one.</p>
                    ) : chat.map((line) => (
                      <div key={line.id} className="text-[12px] leading-5">
                        <span className={cn("font-extrabold", line.user === user?.id ? "text-accent" : "text-ink")}>{line.name}</span>{" "}
                        <span className="text-dim">{line.text}</span>
                      </div>
                    ))}
                    <div ref={chatEnd} />
                  </div>
                  {room.me?.in ? (
                    <form
                      className="mt-3 flex items-end gap-2"
                      onSubmit={(event) => {
                        event.preventDefault();
                        say();
                      }}
                    >
                      <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={300} placeholder="Say something to the room" className="field h-10 min-w-0 flex-1" />
                      <Button type="submit" size="sm" disabled={!draft.trim()} icon={<Send className="size-3.5" />}>Send</Button>
                    </form>
                  ) : (
                    <p className="mt-3 text-[10px] text-dim">Join the room to take part in the chat.</p>
                  )}
                </section>
              ) : null}

              {room.state === "live" ? (
                <div className="flex flex-wrap items-center gap-2">
                  {room.me?.in ? (
                    <>
                      <Button
                        size="sm"
                        variant={room.me.hand ? "primary" : "secondary"}
                        onClick={() => void act("hand", { up: !room.me?.hand })}
                        loading={busy}
                        icon={<Hand className="size-3.5" />}
                      >
                        {room.me.hand ? "Hand down" : "Raise hand"}
                      </Button>
                      {onStage ? (
                        <Button size="sm" variant="secondary" onClick={() => void act("mute", { user: user?.id, muted: !room.me?.muted })} loading={busy} icon={room.me.muted ? <MicOff className="size-3.5" /> : <Mic className="size-3.5" />}>
                          {room.me.muted ? "Unmute" : "Mute"}
                        </Button>
                      ) : null}
                      {room.kind === "stream" && onStage ? (
                        <Button size="sm" variant="secondary" onClick={() => void act("camera", { on: !room.me?.camera })} loading={busy} icon={room.me.camera ? <Camera className="size-3.5" /> : <CameraOff className="size-3.5" />}>
                          {room.me.camera ? "Camera off" : "Camera on"}
                        </Button>
                      ) : null}
                      <Button size="sm" variant="ghost" onClick={() => void act("leave")} loading={busy}>Leave</Button>
                    </>
                  ) : null}
                  <div className="ml-auto flex items-center gap-1">
                    {["🔥", "👏", "😂", "❤️", "💯"].map((emoji) => (
                      <button key={emoji} type="button" onClick={() => react(emoji)} className="flex size-8 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] text-sm transition hover:scale-110 hover:bg-[var(--accent-soft)]" aria-label={`React ${emoji}`}>{emoji}</button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <aside className="space-y-3">
              <div className="rounded-[18px] border border-line bg-card p-4">
                <p className="text-[11px] font-extrabold">In the room</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-center">
                  <div className="rounded-[12px] bg-[var(--accent-soft)] px-2 py-3">
                    <p className="text-xl font-extrabold text-accent">{count(room.listeners)}</p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-dim">Listening</p>
                  </div>
                  <div className="rounded-[12px] bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] px-2 py-3">
                    <p className="text-xl font-extrabold">{stage.length}</p>
                    <p className="text-[9px] font-bold uppercase tracking-wider text-dim">On stage</p>
                  </div>
                </div>
                {room.tags?.length ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {room.tags.map((tag) => <span key={tag} className="rounded-full bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] px-2 py-0.5 text-[9px] font-semibold text-dim">#{tag}</span>)}
                  </div>
                ) : null}
                {room.me?.in ? <p className="mt-3 text-[10px] text-dim">You are in as {room.me.role}{room.me.hand ? " · hand up" : ""}.</p> : null}
              </div>

              <div className="rounded-[18px] border border-line bg-card p-4">
                <p className="flex items-center gap-1.5 text-[11px] font-extrabold"><Video className="size-3.5 text-accent" /> How a room works</p>
                <ul className="mt-2 space-y-1.5 text-[10px] leading-4 text-dim">
                  <li>Anyone can listen. Raise a hand to ask for the stage.</li>
                  <li>The host brings people up and can mute a speaker.</li>
                  <li>What is said in the room chat stays in the room.</li>
                </ul>
              </div>
            </aside>
          </div>
        )}
      </main>

      {throws.map((item) => (
        <span key={item.id} className="pointer-events-none fixed bottom-28 left-1/2 z-50 -translate-x-1/2 animate-float-up text-3xl" title={item.name}>{item.emoji}</span>
      ))}

      <Modal open={gameOpen} onClose={() => setGameOpen(false)} title="Put a board up" description="The host chooses; everybody in the room can watch." size="lg">
        <div className="px-5 py-4">
          {gamesQuery.isLoading ? <p className="py-6 text-center text-xs text-dim">Loading games...</p> : gamesQuery.isError ? <ErrorState compact error={gamesQuery.error} onRetry={() => void gamesQuery.refetch()} /> : (
            <div className="grid gap-2 sm:grid-cols-2">
              {gamesQuery.data?.games.map((offer) => (
                <button
                  key={offer.kind}
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    setGameOpen(false);
                    void act("game/open", { kind: offer.kind });
                  }}
                  className="rounded-[14px] border border-line p-3 text-left transition hover:border-accent/40 disabled:opacity-60"
                >
                  <p className="text-[12px] font-extrabold">{offer.name}</p>
                  <p className="mt-0.5 text-[10px] leading-4 text-dim">{offer.blurb}</p>
                  <p className="mt-1 text-[9px] font-bold text-accent">{offer.cols} × {offer.rows}{offer.bundled ? " · ready" : ""}</p>
                </button>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <Modal open={shareOpen} onClose={() => setShareOpen(false)} title="Share this room" description="Put the room in a convo.">
        <div className="px-5 py-4">
          {threads.isLoading ? <p className="py-5 text-xs text-dim">Loading convos...</p> : threads.isError ? <ErrorState compact error={threads.error} onRetry={() => void threads.refetch()} /> : !threads.data?.threads.length ? <p className="py-5 text-xs text-dim">No convos yet.</p> : (
            <div className="max-h-[50dvh] space-y-1 overflow-y-auto">
              {threads.data.threads.slice(0, 20).map((thread) => {
                const person = thread.member ?? thread.members?.[0]?.user ?? thread.other;
                const title = thread.title || person?.name || person?.username || "Convo";
                return (
                  <button key={thread.id} type="button" disabled={sharing} onClick={() => void share(thread)} className="flex w-full items-center gap-3 rounded-[12px] px-2 py-2 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] disabled:opacity-60">
                    <Avatar user={person} name={title} src={thread.avatar} size={34} />
                    <span className="min-w-0 flex-1 truncate text-[12px] font-bold">{title}</span>
                    <Send className="size-3.5 text-dim" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Modal>

      <ConfirmDialog
        open={endOpen}
        onClose={() => setEndOpen(false)}
        onConfirm={() => {
          setEndOpen(false);
          void act("end");
        }}
        title="End this room?"
        body="Everybody is taken out, the stage closes, and the room cannot be reopened."
        confirmLabel="End the room"
        destructive
        loading={busy}
      />
    </div>
  );
}
