import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Headphones,
  Mic2,
  Plus,
  Radio,
  RadioTower,
  Sparkles,
  Users,
  Video,
} from "lucide-react";
import { Avatar, AvatarStack } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { PageHeader, Tabs } from "@/components/layout/Page";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/ui/States";
import { cn } from "@/utils/cn";
import { relativeTime } from "@/utils/format";
import { spacesService } from "@/services/spaces.service";
import { OpenRoomSheet } from "@/features/live/OpenRoomSheet";
import { crowdLine } from "@/features/live/parts";
import { useSocketEvent } from "@/hooks/useSocket";
import type { SpacePerson, SpaceRoom, UserCard } from "@/types/api";

type Shelf = "live" | "upcoming" | "ended" | "mine";

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
          <span className="flex items-center gap-1 text-[10px] font-bold text-dim"><Headphones className="size-3" /> {crowdLine(room)}</span>
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
  const queryClient = useQueryClient();

  const rooms = useQuery({
    queryKey: ["rooms", shelf],
    queryFn: () => spacesService.shelf(shelf),
    staleTime: 15_000,
  });

  useSocketEvent(["room.new", "room.update", "room.gone"], () => {
    void queryClient.invalidateQueries({ queryKey: ["rooms"] });
  });

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

      <OpenRoomSheet open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  );
}
