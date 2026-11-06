import { useCallback, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/useToast";
import { savedService } from "@/services/saved.service";
import { SAVED_IDS_KEY, SAVED_SHELF_KEY, savedKey } from "@/store/saved";
import { errorMessage } from "@/utils/errors";

/**
 * The shelf, as a component reads it: whether a row is on it, and the one
 * write that moves it on or off.
 *
 * The store's keys and identity rules are in `store/saved.ts`; this hook owns
 * the query and the optimistic write. See that file's header for why the set
 * lives in a shared cache rather than in each card.
 */
export function useSaved() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const ids = useQuery({
    queryKey: SAVED_IDS_KEY,
    // A bare `{ids: [...]}` — not paginated and not wrapped in a page, because
    // this is not a page of the shelf but the set of things on it.
    queryFn: () => savedService.ids(),
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
        const answer = await savedService.set(kind, id, want);
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