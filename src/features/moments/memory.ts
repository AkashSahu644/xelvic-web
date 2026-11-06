import type { Memory, Moment, UserCard } from "@/types/api";

/**
 * A shelf told to the viewer as the walk it is.
 *
 * `MemoryShelf.open` builds exactly this on the phone — the id, the things it
 * kept, and the four answers a Memory has of its own: it is a Memory, it is the
 * poster's mark, it is the reader's permission to uncover it, and its answers
 * come with it. Dropping any of the four would make a Memory look like a day
 * that never expired, which is where this started.
 *
 * One function rather than one copy per screen, because two callers now open a
 * Memory in the same viewer — the profile's shelf and the row in Alerts — and
 * two copies of this would be two chances for one of them to forget the flag.
 *
 * `author` is the person whose shelf it is, where the page already knows them.
 * `handle` is only the fallback: somebody else's shelf can be asked for by name
 * before their card has arrived, and a walk with no face is better than a walk
 * pointed at `/app/u/`.
 */
export function memoryAsMoment(
  memory: Memory,
  author: UserCard | null,
  mine: boolean,
  handle: string,
): Moment {
  return {
    id: memory.id,
    author:
      author ?? {
        id: "",
        username: handle,
        name: handle,
        avatar: null,
        initials: "",
      },
    items: memory.items ?? [],
    mine,
    isMemory: true,
    sensitive: memory.sensitive,
    openable: memory.openable,
    reactions: memory.reactions,
  };
}