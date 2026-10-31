import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalendarClock,
  Headphones,
  Mic2,
  Plus,
  Radio,
  RadioTower,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import { Avatar, AvatarStack } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { PageHeader, Tabs } from "@/components/Page";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/States";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { count, relativeTime } from "@/lib/format";
import { useSocketEvent } from "@/providers/SocketProvider";
import { useToast } from "@/providers/ToastProvider";
import type { SpacePerson, SpaceRoom, UserCard } from "@/types/api";

type Shelf = "live" | "upcoming" | "ended" | "mine";
type RoomKind = "room" | "stream" | "ama";

const kinds: { key: RoomKind; label: string; body: string; icon: typeof Mic2 }[] = [
  { key: "room", label: "Audio room", body: "A stage, a host, and people listening.", icon: Mic2 },
  { key: "stream", label: "Video stream", body: "A camera on the stage and a room watching.", icon: Video },
  { key: "ama", label: "AMA", body: "Questions from the audience, answers from the host.", icon: Sparkles },
];

function roomPerson(person?: SpacePerson | null): UserCard | null {
  if (!person?.user) return null;
  return {
    id: person.user,
    username: person.username || "",
    name: person.name || person.username || "Someone",
    avatar: person.avatar ?? null,
    initials: "",
  };
}

function RoomCard({ room }: { room: SpaceRoom }) {
  const host = room.host ?? roomPerson(room.stage?.find((person) => person.role === "host"));
  const stage = (room.stage ?? []).map(roomPerson).filter((person): person is UserCard => Boolean(person));
  const hue = Number(room.seed ?? 0) % 360;
  const live = room.state === "live";
  const KindIcon = room.kind === "stream" ? Video : room.kind === "ama" ? Sparkles : Mic2;

  return (
    <Link
      to={`/app/live/${room.id}`}
      className="group overflow-hidden rounded-[20px] border border-line bg-card transition hover:-translate-y-0.5 hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--line))]"
    >
      <div
        className="relative flex h-28 items-end p-4"
        style={{ background: `linear-gradient(135deg, hsl(${hue} 55% 42%), hsl(${(hue + 48) % 360} 62% 24%))` }}
      >
        <span className={cn("absolute left-3 top-3 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-white", live ? "bg-[#e02d5a]" : "bg-black/35 backdrop-blur")}>
          <span className={cn("size-1.5 rounded-full bg-[var(--on-accent)]", live && "animate-pulse")} />
          {room.state || "live"}
        </span>
        <span className="absolute right-3 top-3 flex size-8 items-center justify-center rounded-full bg-black/25 text-white backdrop-blur">
          <KindIcon className="size-4" />
        </span>
        <div className="relative min-w-0">
          <p className="truncate text-[10px] font-bold text-white/75">{host ? `${host.name} · ${room.kind === "ama" ? "AMA" : room.kind === "stream" ? "Stream" : "Room"}` : room.kind}</p>
          <h3 className="truncate text-[18px] font-extrabold tracking-tight text-white">{room.title}</h3>
        </div>
      </div>
      <div className="p-3.5">
        {room.note ? <p className="line-clamp-2 text-[11px] leading-5 text-dim">{room.note}</p> : null}
        <div className="mt-3 flex items-center gap-3">
          {stage.length ? <AvatarStack users={stage} size={25} /> : <Avatar user={host} size={26} />}
          <span className="flex items-center gap-1 text-[10px] font-bold text-dim"><Headphones className="size-3" /> {count(room.listeners)}</span>
          {room.hands ? <span className="flex items-center gap-1 text-[10px] font-bold text-dim"><Users className="size-3" /> {room.hands} hands</span> : null}
          <span className="ml-auto text-[10px] font-bold text-accent">
            {live ? "Join" : room.starts_at ? relativeTime(room.starts_at) : room.state === "ended" ? "Ended" : "Open"}
          </span>
        </div>
        {room.tags?.length ? (
          <div className="mt-2 flex flex-wrap gap-1">
            {room.tags.slice(0, 3).map((tag) => <span key={tag} className="rounded-full bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] px-1.5 py-0.5 text-[9px] font-semibold text-dim">#{tag}</span>)}
          </div>
        ) : null}
      </div>
    </Link>
  );
}

export function LivePage() {
  const [shelf, setShelf] = useState<Shelf>("live");
  const [createOpen, setCreateOpen] = useState(false);
  const [kind, setKind] = useState<RoomKind>("room");
  const [title, setTitle] = useState("");
  const [note, setNote] = useState("");
  const [tags, setTags] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [saving, setSaving] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const rooms = useQuery({
    queryKey: ["rooms", shelf],
    queryFn: () => api.get<{ shelf: string; rooms: SpaceRoom[] }>("/spaces/", { query: { shelf } }),
    staleTime: 15_000,
  });

  useSocketEvent(["room.new", "room.update", "room.gone"], () => {
    void queryClient.invalidateQueries({ queryKey: ["rooms"] });
  });

  async function createRoom() {
    if (!title.trim()) {
      toast({ title: "Give the room a name", tone: "error" });
      return;
    }
    setSaving(true);
    try {
      const made = await api.post<{ room: SpaceRoom }>("/spaces/", {
        title: title.trim(),
        note: note.trim(),
        kind,
        tags: tags.split(",").map((tag) => tag.trim()).filter(Boolean).slice(0, 4),
        starts_at: startsAt ? new Date(startsAt).toISOString() : null,
      });
      setCreateOpen(false);
      setTitle("");
      setNote("");
      setTags("");
      setStartsAt("");
      await queryClient.invalidateQueries({ queryKey: ["rooms"] });
      toast({ title: startsAt ? "Room announced" : "Room is on", tone: "success" });
      if (made.room?.id) window.location.assign(`/app/live/${made.room.id}`);
    } catch (error) {
      toast({
        title: "Could not open that room",
        description: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    } finally {
      setSaving(false);
    }
  }

  const rows = rooms.data?.rooms ?? [];

  return (
    <div className="pb-[calc(100px+env(safe-area-inset-bottom,0px))] md:pb-28">
      <PageHeader
        title="Live"
        subtitle="Rooms, streams and questions happening now"
        actions={
          <Button size="sm" icon={<Plus className="size-4" />} onClick={() => setCreateOpen(true)}>
            <span className="hidden sm:inline">Go live</span>
          </Button>
        }
      >
        <div className="mx-auto flex w-full max-w-[1240px] items-center gap-2 px-4 pb-3 md:px-7">
          <Tabs
            value={shelf}
            onChange={(next) => setShelf(next as Shelf)}
            tabs={[
              { key: "live", label: "On now" },
              { key: "upcoming", label: "Upcoming" },
              { key: "ended", label: "Ended" },
              { key: "mine", label: "Mine" },
            ]}
          />
        </div>
      </PageHeader>

      <div className="mx-auto w-full max-w-[1240px] px-4 py-5 md:px-7">
        {shelf === "live" ? (
          <div className="mb-5 flex items-center gap-3 rounded-[16px] border border-line bg-[var(--accent-soft)] px-4 py-3">
            <span className="flex size-9 items-center justify-center rounded-full bg-accent text-on-accent"><RadioTower className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-extrabold">Anybody can hold a room</p>
              <p className="text-[10px] text-dim">Open a stage, raise a hand, or just listen.</p>
            </div>
            <button type="button" onClick={() => setCreateOpen(true)} className="text-[11px] font-bold text-accent hover:underline">Open one</button>
          </div>
        ) : null}

        {rooms.isLoading ? (
          <PageSkeleton rows={3} />
        ) : rooms.isError ? (
          <div className="card"><ErrorState error={rooms.error} onRetry={() => void rooms.refetch()} /></div>
        ) : !rows.length ? (
          <div className="card">
            <EmptyState
              icon={<Radio className="size-6" />}
              title={shelf === "live" ? "Nobody is on air" : shelf === "upcoming" ? "Nothing announced" : shelf === "mine" ? "You have not opened a room" : "No rooms have ended yet"}
              body={shelf === "live" ? "Open a room and the shelf has something on it." : "When there is something here, it will show up."}
              action={shelf === "live" || shelf === "mine" ? <Button size="sm" onClick={() => setCreateOpen(true)}>Open a room</Button> : undefined}
            />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((room) => <RoomCard key={room.id} room={room} />)}
          </div>
        )}
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Open a room"
        description="A name, what kind of room it is, and when it starts."
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={() => void createRoom()} loading={saving}>{startsAt ? "Announce it" : "Go live"}</Button>
          </div>
        }
      >
        <div className="space-y-4 px-5 py-4">
          <div>
            <span className="mb-1.5 block text-[11px] font-bold text-dim">Kind</span>
            <div className="grid gap-2 sm:grid-cols-3">
              {kinds.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setKind(item.key)}
                  className={cn(
                    "rounded-[14px] border p-3 text-left transition",
                    kind === item.key ? "border-accent bg-[var(--accent-soft)]" : "border-line hover:border-accent/30",
                  )}
                >
                  <item.icon className={cn("size-4", kind === item.key ? "text-accent" : "text-dim")} />
                  <span className="mt-1.5 block text-[12px] font-extrabold">{item.label}</span>
                  <span className="mt-0.5 block text-[10px] leading-4 text-dim">{item.body}</span>
                </button>
              ))}
            </div>
          </div>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold text-dim">Name</span>
            <input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={140} placeholder="Sunday listening" className="field w-full" />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-[11px] font-bold text-dim">Note</span>
            <textarea value={note} onChange={(event) => setNote(event.target.value)} maxLength={200} rows={2} placeholder="What is this room about?" className="field w-full resize-none" />
          </label>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block">
              <span className="mb-1.5 block text-[11px] font-bold text-dim">Tags</span>
              <input value={tags} onChange={(event) => setTags(event.target.value)} placeholder="music, late night" className="field w-full" />
            </label>
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1 text-[11px] font-bold text-dim"><CalendarClock className="size-3" /> Starts at</span>
              <input type="datetime-local" value={startsAt} onChange={(event) => setStartsAt(event.target.value)} className="field w-full" />
            </label>
          </div>
          <p className="text-[10px] leading-4 text-dim">Leave the start time empty to go on air immediately. A future time announces the room instead.</p>
        </div>
      </Modal>
    </div>
  );
}
