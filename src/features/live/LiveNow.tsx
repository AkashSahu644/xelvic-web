import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { spacesService } from "@/services/spaces.service";
import { useSocketEvent } from "@/hooks/useSocket";
import { OpenRoomSheet } from "./OpenRoomSheet";
import { crowdLine, RoomCover } from "./parts";
import type { SpaceRoom } from "@/types/api";

/**
 * Who this account keeps is on right now — the strip under the Moments rail.
 *
 * Ported from `screens/live_now.dart`, where it took the place the circles used
 * to hold: both answer "what are my people doing", and both are read in the
 * second after the rail. This is the one thing on the page that is happening
 * *now* and goes away by itself.
 *
 * Three decisions are the app's and are kept here:
 *
 * **Only people this account keeps.** The server answers that question
 * (`?shelf=kept`), not this widget. The live shelf is the newest thirty rooms
 * in the world; filtering it here would answer "of thirty strangers I happen to
 * be shown, do I keep any", which is nobody every time.
 *
 * **It draws itself when it is empty, quietly.** The row is the way to start a
 * room, and a door that disappears when nobody has walked through it yet is a
 * door nobody finds. So the header and the button are always there, and the
 * space under them says the honest thing rather than holding a hole open.
 *
 * **A failure is silent.** The strip is a bonus under the rail, and a sentence
 * about a server that could not be reached belongs to the rail's own error,
 * which is already on the page above it.
 */

function Tile({ room }: { room: SpaceRoom }) {
  const name = room.host?.name || room.host?.username || room.title || "";
  return (
    <Link to={`/app/live/${room.id}`} className="w-[72px] shrink-0 text-center">
      <span className="relative inline-block">
        <span className="block rounded-[22px] bg-accent p-0.5">
          <RoomCover room={room} size={60} radius={20} />
        </span>
        <span className="absolute -bottom-0.5 -left-0.5 rounded-[5px] bg-accent px-[5px] py-0.5 text-[7.5px] font-black tracking-[0.6px] text-on-accent">
          LIVE
        </span>
      </span>
      <span className="mt-1.5 block truncate text-[11px] font-semibold">{name}</span>
      <span className="block truncate text-[10px] text-dim">{crowdLine(room)}</span>
    </Link>
  );
}

export function LiveNow() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);

  const kept = useQuery({
    queryKey: ["rooms", "kept"],
    queryFn: () => spacesService.shelf("kept"),
    staleTime: 15_000,
    retry: false,
  });

  // A room opening or closing is exactly what this strip has to hear. The
  // socket is on the page, so the strip is only asking while somebody is
  // looking at it.
  useSocketEvent(["room.new", "room.update", "room.gone"], () => {
    void queryClient.invalidateQueries({ queryKey: ["rooms", "kept"] });
  });

  const rooms = kept.data?.rooms ?? [];

  return (
    <div className="pb-3.5">
      <div className="mb-2 flex items-center gap-1.5 pr-2.5 pl-4">
        {/* The one place a colour means a state rather than a thing: a dot that
            is on is the whole of "this is happening now". */}
        <span className={rooms.length ? "size-[7px] rounded-full bg-accent" : "size-[7px] rounded-full bg-[color-mix(in_srgb,var(--ink)_25%,transparent)]"} />
        <span className="text-[13px] font-extrabold tracking-[0.2px]">Live now</span>
        <span className="flex-1" />
        <button
          type="button"
          onClick={() => setCreateOpen(true)}
          className="rounded-full px-2.5 py-1 text-[12px] font-bold text-accent transition hover:bg-[var(--accent-soft)]"
        >
          Start a room
        </button>
      </div>

      {!rooms.length ? (
        <p className="px-4 text-[12px] font-medium text-dim">Nobody you keep is on right now.</p>
      ) : (
        <div className="no-scrollbar flex gap-3 overflow-x-auto px-4 pb-1">
          {rooms.map((room) => (
            <Tile key={room.id} room={room} />
          ))}
        </div>
      )}

      <OpenRoomSheet
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => void queryClient.invalidateQueries({ queryKey: ["rooms", "kept"] })}
      />
    </div>
  );
}

export default LiveNow;