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
 *
 * The hook that reads and writes this store is `hooks/useSaved.ts`; the keys
 * and the two pure helpers live here so a caller that only wants to name a row
 * does not have to mount a component to do it.
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

/**
 * Which key a *sound*'s bookmark writes under.
 *
 * The app's `AudioTrack.savedKind`, which is `fromDrop ? 'drop' : 'track'` —
 * a sound row is one row shape over two tables, and the shelf files it by which
 * table it came off rather than by what it looks like. The cue is `source`,
 * which `TrackListView` and the weekly board both set on every row: an upload's
 * `id` is the drop's, and a catalogue track's is a row in `Track`.
 *
 * This is not `savedKindOf` above, which reads a *card's* own kind: a drop card
 * is a picture or a clip as often as a sound, and its `kind` says which, while
 * a sound row's `kind` is `music`/`podcast`/`sound` and says nothing about where
 * the id addresses.
 */
export function savedKindOfSound(track: { source?: string | null }) {
  return track.source === "drop" ? "drop" : "track";
}