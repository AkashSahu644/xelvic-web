import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { momentsService } from "@/services/moments.service";

/**
 * Who has something live that I have not watched — the ring on a face.
 *
 * Ported from `Moments._rings` / `hasRing` in `app/lib/moments.dart`. The phone
 * reads the tray once at boot and keeps the ids of the people in its `unseen`
 * list, because a ring means exactly one thing: there is something of theirs
 * still to watch. It is not a fact about the person that a card can be asked
 * for — the tray is the only place the server says it — so the feed and the
 * search results ask the same tray the Moments tab draws, under the same query
 * key, and get the same answer without a second request.
 *
 * Only `unseen` is in the set, and that is the whole rule rather than an
 * oversight: a person already watched wears the quiet ring on their own face
 * and nothing on a card, and a person this reader silenced is still on the
 * rail — silencing sorts a rail, it does not empty one — but a card is not the
 * rail and a muted day is not announced on one.
 */
export function useLiveRings(): ReadonlySet<string> {
  const tray = useQuery({
    queryKey: ["moments-tray"],
    queryFn: () => momentsService.tray(),
    // The rail itself refreshes on its own page; a card is a second reader of
    // the same answer, and it does not need to be fresher than a minute.
    staleTime: 60_000,
    retry: false,
  });

  return useMemo(() => {
    const ids = new Set<string>();
    for (const row of tray.data?.unseen ?? []) {
      const id = row.author?.id ? String(row.author.id) : "";
      if (id) ids.add(id);
    }
    return ids;
  }, [tray.data]);
}