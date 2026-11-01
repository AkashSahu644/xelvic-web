import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { useToast } from "@/providers/ToastProvider";

/**
 * The shelf, as every bookmark in the app reads it.
 *
 * Ported from `Saved` in `app/lib/saved.dart`, which is a singleton with a
 * `Set` of `kind:id` strings in it. This is the same thing in the web's idiom —
 * a react-query cache entry holding that set — because the reasons the app
 * keeps a store at all are exactly the reasons a bare `useState` per card is
 * wrong:
 *
 * **A bookmark is drawn in a dozen places and the payload never says whether it
 * is filled.** `DropSerializer` carries no `saved` field and no `saves` count —
 * grep the backend and neither word appears — so a card that seeded its glyph
 * from `drop.saved` was seeding it from `undefined`, which is `false`, which is
 * "not saved" on everything the account has ever saved. The truth lives on one
 * endpoint, `GET /saved/ids/`, asked once and shared, and the card asks the
 * store rather than the drop.
 *
 * **One write, one address.** `POST /saved/` with `{kind, id, on}` is the only
 * way anything gets onto the shelf — `apps/saved/views.py` is the whole of it.
 * The web used to post to `/drops/{id}/save/`, which is not a route in
 * `apps/drops/urls.py` or anywhere else, so pressing Keep answered 404 every
 * time and the success toast was a lie about a write that never happened.
 *
 * **The two kinds are the server's, not the card's.** A drop's own `kind` is
 * what it *is* — a picture, a poll, a sound — while the shelf files everything
 * posted as `drop` and everything on the Vibes rail as `vibe`. A vibe saved
 * under `drop` would be a row the shelf's own read never finds, because it
 * looks the vibe up in the drop table.
 */

/** The whole shelf as `kind:id` strings. See `SavedIdsView`. */
export const SAVED_IDS_KEY = ["saved-ids"] as const;

/** The shelf itself, as rows. See `SavedPage`. */
export const SAVED_SHELF_KEY = ["saved-shelf"] as const;

/** `kind:id`, the key both halves of the store agree on. `Saved.key`. */
export function savedKey(kind: string, id: string) {
  return `${kind}:${id}`;
}

/**
 * Which key a drop's bookmark writes under.
 *
 * The app's `drop.isVibe ? 'vibe' : 'drop'` — the one split the two tables
 * make. `isVibe` on the web is `kind === 'vibe'`, which is the value
 * `VibeSerializer.get_kind` answers about a clip and which the drop table
 * never holds.
 */
export function savedKindOf(drop: { kind: string }) {
  return drop.kind === "vibe" ? "vibe" : "drop";
}

export function useSaved() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const ids = useQuery({
    queryKey: SAVED_IDS_KEY,
    // A bare `{ids: [...]}` — not paginated and not wrapped in a page, because
    // this is not a page of the shelf but the set of things on it.
    queryFn: () => api.get<{ ids: string[] }>("/saved/ids/"),
    /**
     * Read once a session and kept.
     *
     * The app asks at boot and never again except when a whole shelf read comes
     * back, because the answer only changes when *this* account changes it —
     * and every change this account makes goes through [toggle] below, which
     * writes the cache itself. A refetch on every mount would be a request per
     * feed page for a set that has not moved.
     */
    staleTime: 30 * 60 * 1000,
    // A failure is silent on purpose. An empty set draws empty bookmarks, which
    // is wrong on the ones that are saved and invisible on the ones that are
    // not, and there is nothing worth saying to somebody about it: a banner
    // over the app because a glyph is unfilled would be worse than the glyph.
    // See `Saved.load`'s own catch, which swallows it the same way.
    retry: false,
  });

  const set = useMemo(() => new Set(ids.data?.ids ?? []), [ids.data]);

  const has = useCallback(
    (kind: string, id: string) => set.has(savedKey(kind, id)),
    [set],
  );

  /**
   * Put something by, or take it off. Answers which it is now.
   *
   * Written first and asked after, like the app's: the glyph fills under the
   * thumb and the server is told what happened rather than the other way round,
   * because a bookmark that waited for a round trip would look broken on a
   * train. If the ask fails the whole set is put back and the reason is said —
   * a glyph that moves back with no words is the save appearing to do nothing.
   */
  const toggle = useCallback(
    async (kind: string, id: string, on?: boolean): Promise<boolean> => {
      const key = savedKey(kind, id);
      const current = queryClient.getQueryData<{ ids: string[] }>(SAVED_IDS_KEY);
      const list = current?.ids ?? [];
      const was = list.includes(key);
      const want = on ?? !was;
      if (want === was) return was;

      // The boot read is usually still out at exactly this moment — somebody
      // saves something in the first seconds of a session — and its answer was
      // asked for before this write existed. Left to land it would say the
      // thing is not on the shelf, the bookmark would empty under the thumb
      // that just filled it, and the save would un-take itself for no reason
      // the person could see. This is the app's `_told` guard, kept by the
      // library's own means: an ask that is no longer in the air cannot
      // disagree with what the thumb just did.
      await queryClient.cancelQueries({ queryKey: SAVED_IDS_KEY });

      queryClient.setQueryData<{ ids: string[] }>(SAVED_IDS_KEY, {
        ids: want ? [...list, key] : list.filter((one) => one !== key),
      });

      try {
        const answer = await api.post<{ saved: boolean; kind: string; id: string }>(
          "/saved/",
          { kind, id, on: want },
        );
        /**
         * The server's answer is taken as the truth about what it did — it
         * echoes `saved` — but the set is not rebuilt from it, because the
         * answer carries one id and the set is every id. The read that
         * reconciles the two is the shelf's own, which is invalidated here so
         * that a screen drawing the list agrees with the thumbs.
         */
        if (answer.saved !== want) {
          queryClient.setQueryData<{ ids: string[] }>(SAVED_IDS_KEY, {
            ids: answer.saved ? [...list, key] : list.filter((one) => one !== key),
          });
        }
        void queryClient.invalidateQueries({ queryKey: SAVED_SHELF_KEY });
        return answer.saved;
      } catch (error) {
        // The write was never true, so it goes back to exactly what it was:
        // the list as it was read, not as this tap imagines it.
        queryClient.setQueryData<{ ids: string[] }>(SAVED_IDS_KEY, current);
        toast({ title: errorMessage(error), tone: "error" });
        return was;
      }
    },
    [queryClient, toast],
  );

  return { has, toggle, ready: ids.isSuccess };
}
