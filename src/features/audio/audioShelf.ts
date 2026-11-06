/**
 * The three shelves the editor's sound sheet draws, and the rules for reading
 * them.
 *
 * They live here rather than inside `PhotoEditor.tsx` because they are the
 * whole of what the sheet asked the server for, and getting one of them wrong
 * is not a layout bug — it is a sheet showing a different list than the phone's
 * does, which is exactly what it used to do:
 *
 * - **The catalogue is not one of them.** `TrackListView` answers the *shipped*
 *   catalogue — the handful of songs and episodes the app came with — unless it
 *   is asked for `source=drop`, which is the uploads. The phone's picker draws
 *   no catalogue row on any chip; this sheet drew nothing else, so it showed a
 *   short list of songs nobody could put on a clip and be heard while the phone
 *   showed everybody's uploads.
 * - **A search asks the uploads shelf whichever chip is lit**, so the box can
 *   never answer with something the sheet would not have drawn.
 * - **The week's chart drops the catalogue's half on the way through**, exactly
 *   as the phone's `_trending` does.
 *
 * See `app/lib/screens/audio_picker.dart`, which is the reference for all three.
 */

import { audioService } from "@/services/audio.service";
import type { AudioBoard, AudioRow, SavedThing, Track } from "@/types/api";

type AudioPageResponse = {
  tracks?: Track[];
  results?: Track[];
};

function audioRows(response: AudioPageResponse) {
  const rows = response.tracks ?? response.results ?? [];
  return Array.isArray(rows) ? rows : [];
}

/**
 * How many rows one ask from the uploads shelf draws.
 *
 * The phone's own `kPickerRows`, held at the same number so the two sheets hold
 * the same list. It is a ceiling on the request rather than a page anybody
 * walks: a sheet is scrolled by hand and a search narrows it, so this is a
 * screenful several times over. The sheet used to ask for everything anybody
 * had ever posted, which grew with the product and made every open pay for all
 * of it.
 */
export const PICKER_ROWS = 60;

/**
 * The sounds people uploaded — the one shelf this sheet's rows come off.
 *
 * `?source=drop` is `TrackListView`'s upload branch: the sounds somebody
 * actually posted, newest first, with the catalogue's own songs left out. It is
 * a different question from the tab's list rather than a filter over it, which
 * is why the phone asks for it by name on every chip.
 */
export async function fetchUploads(query?: string): Promise<Track[]> {
  const response = await audioService.tracks<AudioPageResponse>({
    source: "drop",
    limit: PICKER_ROWS,
    ...(query ? { q: query } : {}),
  });
  return audioRows(response);
}

/**
 * A board row as a list row.
 *
 * `AudioRow` is the broader shape — a board row can also be a *shelf*, and it
 * carries the scoring a chart is ranked by — so the fields a sound row is drawn
 * from are copied across rather than the whole thing being spread into a
 * different type.
 */
export function rowToTrack(row: AudioRow): Track {
  return {
    id: row.id,
    kind: row.kind,
    title: row.title ?? row.name ?? "",
    artist: row.artist ?? "",
    artist_slug: row.artist_slug,
    artist_id: row.artist_id,
    artist_avatar: row.artist_avatar ?? null,
    series: row.series ?? null,
    episode: typeof row.episode === "number" ? row.episode : null,
    seconds: row.seconds,
    plays: row.plays,
    seed: row.seed,
    liked: row.liked,
    cover: row.cover ?? null,
    stream: row.stream ?? null,
    item: row.item ?? undefined,
    source: row.source,
  };
}

/**
 * The weekly board's own sounds, with every other kind of row dropped.
 *
 * The board ranks the shipped catalogue beside everybody's uploads, and this
 * sheet is for sounds a person can put on a clip — so everything whose `source`
 * is not `drop` goes, exactly as the phone's `_trending` does. That also drops
 * the playlists chart, whose rows are shelves rather than sounds and carry
 * `source: "playlist"`.
 *
 * An older answer carries `sounds`/`podcasts` and no `boards` at all, which is
 * the same board read the other way round.
 */
export function boardUploads(board: AudioBoard | undefined): Track[] {
  if (!board) return [];
  const rows: AudioRow[] = board.boards?.length
    ? board.boards.flatMap((section) => section.rows ?? [])
    : [...(board.sounds ?? []), ...(board.podcasts ?? [])];
  return rows.filter((row) => row.source === "drop").map(rowToTrack);
}

/**
 * A kept thing as a sound, or null when it is not one.
 *
 * The phone's `SavedThing.audio`: a saved catalogue track arrives as its own
 * row and is already the shape a sound list draws, while a saved upload arrives
 * as the drop's card and has to be turned into one here. A saved picture, clip
 * or note has no sound in it and answers null rather than a row of blanks.
 */
export function keptToTrack(thing: SavedThing): Track | null {
  if (thing.track) return thing.track;
  // `vibe` as well as `drop`, because the two arrive on the same card under
  // whichever key it came off — the app's `SavedThing.fromJson` reads them into
  // one field. A clip is not a sound and falls out at the check below.
  const drop = thing.drop ?? thing.vibe;
  if (!drop || drop.kind !== "audio") return null;
  const asset = drop.asset;
  return {
    id: drop.id,
    // A sound and never a podcast: somebody's upload is not one of the
    // catalogue's kinds.
    kind: "sound",
    title: (drop.title ?? "").trim() || drop.body.trim() || "Audio",
    artist: drop.author?.name || drop.author?.username || "",
    artist_slug: drop.author?.username,
    artist_id: drop.author?.id,
    artist_avatar: drop.author?.avatar ?? null,
    // The card carries no seed, so the sleeve is drawn from the id — the same
    // number `trackSeed` makes of any row that has none.
    seconds: Math.floor((asset?.duration_ms ?? 0) / 1000),
    stream: asset?.content_url ?? null,
    cover: drop.cover
      ? {
          content_url: drop.cover.content_url ?? "",
          thumbnail_url: drop.cover.thumbnail_url ?? null,
        }
      : null,
    source: "drop",
  };
}
