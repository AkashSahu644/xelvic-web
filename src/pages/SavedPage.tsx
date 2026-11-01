import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark, CloudOff } from "lucide-react";
import { Blank } from "@/components/Blank";
import { PageHeader } from "@/components/Page";
import { api } from "@/lib/api";
import { ago, count } from "@/lib/format";
import { errorMessage } from "@/lib/errors";
import { trackLine, trackUnder } from "@/features/audio/parts";
import { SavedRowLeading } from "@/features/saved/Leading";
import { cardOf, kindOf, SHELF_KINDS } from "@/features/saved/model";
import { SAVED_SHELF_KEY, useSaved } from "@/features/saved/store";
import { usePlayer } from "@/providers/PlayerProvider";
import { usePreferences } from "@/providers/PreferencesProvider";
import type { SavedShelf, SavedThing } from "@/types/api";

/**
 * The shelf: everything this account put by, to look at again.
 *
 * Ported from `app/lib/screens/saved.dart`. One list rather than three tabs,
 * because that is what a shelf is: somebody saves a clip on the bus, a song in
 * the middle of a set, and a post they meant to answer, and a screen that made
 * them remember which one they were thinking of would have forgotten why they
 * pressed the bookmark in the first place. The three kinds are drawn as rows of
 * one shape and the only thing that differs is what the tap does.
 *
 * **The rows are the server's, not this screen's.** Every row has already been
 * through the gate the thing itself lives behind — see `apps/saved/services.py`
 * — so nothing here decides who may see what. That matters more than it sounds:
 * a shelf outlives the moment it was made, and a month later the account that
 * posted something may have gone private. A row kept here on the strength of
 * having once been openable would be a row that 404s when tapped.
 *
 * **The filter is the one thing this page decides for itself, and it decides
 * nothing about the shelf.** `GET /saved/` answers the whole shelf in one go,
 * so the chips narrow a list already in hand rather than asking a narrower
 * question, and tapping All puts it back exactly as the server ordered it. The
 * list stays one list; the chips are a lens over it and never a partition.
 */

/** What to open, and what to name it by — the id the store keys on. */
function idOf(thing: SavedThing) {
  return thing.drop?.id ?? thing.vibe?.id ?? thing.track?.id ?? "";
}

/** The name a row carries. `drop.author.shown` — the name, else the handle. */
function authorOf(thing: SavedThing) {
  const card = cardOf(thing);
  if (!card) return "";
  return card.mine ? "" : card.author.name || card.author.username || "";
}

function Row({ thing, onPrune }: { thing: SavedThing; onPrune: () => void }) {
  const navigate = useNavigate();
  const player = usePlayer();
  const { t } = usePreferences();

  const card = cardOf(thing);
  const track = thing.track;

  /**
   * Whose it is leads, the way it does everywhere else a thing of somebody
   * else's is listed — and "You" rather than their own name on their own, which
   * is the rule the whole app keeps.
   */
  const title = track
    ? trackLine(track)
    : card?.mine
      ? t("You")
      : authorOf(thing);

  /**
   * The second line, which both kinds of card take from the same place: a Vibe
   * caption arrives in `body` too. It is left off rather than filled with a
   * word for what the thing is, because the line under it already says what it
   * is — "A picture" twice on one row is the row repeating itself.
   */
  const line = track ? trackUnder(track) : (card?.body ?? "").trim();

  /**
   * What a tap does, which is the only thing the three kinds disagree about.
   *
   * A drop and a vibe are one table and still two readings: a saved clip opens
   * in the Vibes walk, which plays it, rather than on a drop's page, which
   * draws a still of it and no player — the same door every other list of
   * things takes. A track is the player.
   */
  function open() {
    if (card) {
      // The shelf's own kind, not the card's: everything on the Vibes rail is
      // filed as a vibe and everything else as a drop, which is the split the
      // two tables make.
      if (thing.kind === "vibe") navigate(`/app/drops?vibe=${encodeURIComponent(card.id)}`);
      else navigate(`/app/drops/${card.id}`);
      return;
    }
    if (track) player.play(track, [track]);
  }

  return (
    <div className="flex items-start py-[9px] pl-3.5 pr-1.5 transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]">
      <button
        type="button"
        onClick={open}
        className="flex min-w-0 flex-1 items-start gap-[13px] text-left"
      >
        <SavedRowLeading thing={thing} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-bold leading-[1.15]">{title}</span>
          {line ? (
            <span className="mt-[3px] line-clamp-2 block text-[13px] leading-[1.3] text-[color-mix(in_srgb,var(--ink)_72%,transparent)]">
              {line}
            </span>
          ) : null}
          {/* What it is, and how long it has been waiting. The second is not
              when it was posted: on a shelf the question the row answers is
              "how long has this been here". */}
          <span className="mt-[5px] block text-[11.5px] font-semibold text-dim">
            {t(kindOf(thing))} · {ago(thing.at)}
          </span>
        </span>
      </button>
      {/* Aligned to the top of the row rather than centred in it, so the
          bookmarks of a shelf of uneven rows still line up with each other
          down the right edge. Filled, because that is what the thing *is* —
          it is on the shelf — and pressing it is the one way off. */}
      <button
        type="button"
        onClick={onPrune}
        title={t("Take it off your shelf")}
        aria-label={t("Take it off your shelf")}
        className="mt-1 shrink-0 rounded-lg p-1.5 text-accent transition hover:bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
      >
        <Bookmark className="size-5 fill-current" />
      </button>
    </div>
  );
}

/**
 * The square at the head of a row lives in `features/saved/Leading` because the
 * activity list draws the same one — the app draws it twice for the same reason
 * and the two copies have already drifted once.
 */

/**
 * The lens: every kind that is on the shelf, and the whole shelf, as chips.
 *
 * Counts rather than bare words, because the question a chip answers before it
 * is tapped is "is it worth tapping" — and a shelf of thirty with two songs on
 * it is a different shelf from one with twenty.
 */
function Filters({
  shelf,
  active,
  onPick,
}: {
  shelf: SavedThing[];
  active: string;
  onPick: (kind: string) => void;
}) {
  const { t } = usePreferences();
  const counts = new Map<string, number>();
  for (const thing of shelf) counts.set(thing.kind, (counts.get(thing.kind) ?? 0) + 1);

  return (
    <div className="no-scrollbar flex h-[46px] shrink-0 items-start gap-2 overflow-x-auto px-3.5 pb-2 pt-1.5">
      <Chip label={t("All")} total={shelf.length} on={active === "all"} onTap={() => onPick("all")} />
      {SHELF_KINDS.map(({ kind, word }) =>
        (counts.get(kind) ?? 0) > 0 ? (
          <Chip
            key={kind}
            label={t(word)}
            total={counts.get(kind) ?? 0}
            on={active === kind}
            onTap={() => onPick(kind)}
          />
        ) : null,
      )}
    </div>
  );
}

/** One chip. Filled in the accent while it is the lens, a quiet wash of the ink while it is not. */
function Chip({
  label,
  total,
  on,
  onTap,
}: {
  label: string;
  total: number;
  on: boolean;
  onTap: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onTap}
      aria-pressed={on}
      className={`flex shrink-0 items-center rounded-[20px] px-[13px] py-[7px] transition ${
        on
          ? "bg-[color-mix(in_srgb,var(--accent)_16%,transparent)] text-accent"
          : "bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] text-dim"
      }`}
    >
      <span className={`text-[13px] ${on ? "font-extrabold" : "font-semibold"}`}>{label}</span>
      <span
        className={`ml-1.5 text-[12.5px] font-bold ${
          on ? "text-accent" : "text-[color-mix(in_srgb,var(--ink)_38%,transparent)]"
        }`}
      >
        {count(total)}
      </span>
    </button>
  );
}

export function SavedPage() {
  const queryClient = useQueryClient();
  const { t } = usePreferences();
  const { toggle } = useSaved();
  const [filter, setFilter] = useState("all");

  const shelf = useQuery({
    queryKey: SAVED_SHELF_KEY,
    // Asked on every visit rather than only when the list is empty: this is the
    // one place the whole shelf is on screen, and a stale row here is a row
    // about a thing that may no longer be openable.
    queryFn: () => api.get<SavedShelf>("/saved/"),
  });

  const rows = useMemo(() => shelf.data?.items ?? [], [shelf.data]);

  /**
   * Which kinds are actually on the shelf. A kind nobody has put by gets no
   * chip: a row of five where three are empty is a row that lies about the
   * shelf behind it.
   */
  const kinds = useMemo(() => new Set(rows.map((thing) => thing.kind)), [rows]);

  /**
   * A lens that names a kind which has just been pruned off the shelf falls
   * back to the whole shelf rather than to nothing. This is reachable in one
   * gesture — filter to Music, take the last song off — and the screen must not
   * be left showing an empty list over a shelf that still has things on it.
   */
  const lens = kinds.has(filter) ? filter : "all";
  const shown = lens === "all" ? rows : rows.filter((thing) => thing.kind === lens);

  /**
   * Take one row off, and say why when the server refuses.
   *
   * The row goes at once and the ask follows, which is the app's order — but
   * the whole list is put back if the ask fails, not the single row where this
   * screen thought it belonged, because the order is the server's and this
   * screen only ever read it. The store's [toggle] is the write; this only
   * restores what the read had.
   */
  async function prune(thing: SavedThing) {
    const previous = queryClient.getQueryData<SavedShelf>(SAVED_SHELF_KEY);
    const id = idOf(thing);
    if (!id) return;

    queryClient.setQueryData<SavedShelf>(SAVED_SHELF_KEY, (current) =>
      current
        ? {
            ...current,
            items: current.items.filter(
              (row) => !(row.kind === thing.kind && idOf(row) === id),
            ),
          }
        : current,
    );

    const now = await toggle(thing.kind, id, false);
    // `false` is the answer both to a removal that worked and to one that did
    // not, so the store's own set is the honest question: a take-off that
    // failed has already put `kind:id` back there.
    if (now !== false) {
      queryClient.setQueryData<SavedShelf>(SAVED_SHELF_KEY, previous);
      return;
    }
    // A removal that worked still gets a read, because the shelf the server
    // sends back is shorter by one and this list is now a guess about which
    // one. Cheap, and it is the same read the page already makes on arrival.
    void queryClient.invalidateQueries({ queryKey: SAVED_SHELF_KEY });
  }

  return (
    <div className="flex min-h-dvh flex-col pb-[calc(92px+env(safe-area-inset-bottom,0px))] md:pb-16">
      <PageHeader title={t("Saved")} back />

      {shelf.isLoading ? (
        <div className="flex flex-1 items-center justify-center py-20">
          <span className="size-[22px] animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : shelf.isError ? (
        // The three ways an empty page is not the same page: still being read,
        // refused, and genuinely nothing. Only the last one is somebody's shelf.
        <div className="flex flex-1 items-center justify-center">
          <Blank
            top=""
            icon={<CloudOff className="size-[46px]" />}
            title={t("The shelf could not be read")}
            line={errorMessage(shelf.error)}
            action={
              <button type="button" className="btn btn-secondary mt-4" onClick={() => void shelf.refetch()}>
                {t("Try again")}
              </button>
            }
          />
        </div>
      ) : !rows.length ? (
        <div className="flex flex-1 items-center justify-center">
          <Blank
            top=""
            icon={<Bookmark className="size-[46px]" />}
            title={t("Nothing put by yet")}
            // The app's sentence, with one word moved: it says "on this phone",
            // which is true on a phone and false in a browser. The promise it
            // is making — the shelf is the account's and not the device's — is
            // the part worth keeping, so the device word is the only change.
            line={t("Save a drop, a Vibe or a song and it waits here — on this device and on every other one you sign in on.")}
          />
        </div>
      ) : (
        <>
          {kinds.size > 1 ? <Filters shelf={rows} active={lens} onPick={setFilter} /> : null}
          <ul className="pb-8 pt-0.5">
            {shown.map((thing, index) => (
              <li key={`${thing.kind}-${idOf(thing)}`}>
                <Row thing={thing} onPrune={() => void prune(thing)} />
                {/* A hairline under every row but the last, indented past the
                    picture so it reads as one list rather than as a stack of
                    unrelated blocks. Drawn inside the row rather than as a
                    border between list items so that a row taken off the middle
                    of the shelf does not leave its rule behind. */}
                {index < shown.length - 1 ? (
                  <div className="ms-[93px] h-px bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]" />
                ) : null}
              </li>
            ))}
            {shelf.data?.more ? (
              // Said at the foot rather than pretended away: the shelf was read
              // in one go and there is more behind it.
              <li className="px-5 pb-1 pt-[18px] text-center text-[12.5px] leading-[1.4] text-dim">
                {t("That is as far back as the shelf is read in one go. Take something off and the rest of it moves up.")}
              </li>
            ) : null}
          </ul>
        </>
      )}
    </div>
  );
}
