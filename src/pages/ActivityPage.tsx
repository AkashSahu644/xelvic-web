import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { CloudOff, Heart, MessageCircle } from "lucide-react";
import { Blank } from "@/components/ui/Blank";
import { PageHeader, Tabs } from "@/components/layout/Page";
import { dropsService } from "@/services/drops.service";
import { ago } from "@/utils/format";
import { errorMessage } from "@/utils/errors";
import { trackLine, trackUnder } from "@/features/audio/parts";
import { SavedRowLeading } from "@/features/saved/Leading";
import { cardOf, kindOf } from "@/features/saved/model";
import { usePlayer } from "@/hooks/usePlayer";
import { usePreferences } from "@/hooks/usePreferences";
import type { SavedThing } from "@/types/api";

/**
 * Liked and responded: everything this account has put a heart on or left a
 * line under, in one place.
 *
 * Ported from `app/lib/screens/activity.dart`. Two tabs rather than the shelf's
 * filter row, because a like and a respond are two different things somebody
 * did and not two kinds of one thing they kept — which is also why the two
 * lists arrive as two lists from the server rather than being split here.
 *
 * **The rows have each been through the gate the thing lives behind**, exactly
 * as the shelf's have: a like on a post whose author has since gone private is
 * left out rather than drawn as a card that will not open. See
 * `apps/drops/activity.py`.
 *
 * **Nothing is written here.** A like is taken back where it was given — on the
 * thing itself — and this page is a record, not a second set of controls, so a
 * tap opens the thing and there is no button to undo anything from the list.
 * That is also why the row has no trailing glyph: the web used to draw a Play
 * or a Heart at the end of each row, which is a control that does nothing on a
 * page that is a record. The whole row is the tap.
 */

/** The same tap the shelf makes, because these are the same three things. */
function useOpen() {
  const navigate = useNavigate();
  const player = usePlayer();

  return function open(thing: SavedThing) {
    const card = cardOf(thing);
    if (card) {
      // Through the one door: a clip opens in the Vibes walk, where it plays,
      // rather than on a drop's page, which draws a still of it.
      if (thing.kind === "vibe") navigate(`/app/drops?vibe=${encodeURIComponent(card.id)}`);
      else navigate(`/app/drops/${card.id}`);
      return;
    }
    const track = thing.track;
    if (track) player.play(track, [track]);
  };
}

/**
 * One liked or responded thing. The shelf's row without the bookmark — a
 * picture, a name, a line, and what it is — because there is nothing to take
 * off here.
 */
function Row({ thing, onOpen }: { thing: SavedThing; onOpen: () => void }) {
  const { t } = usePreferences();
  const card = cardOf(thing);
  const track = thing.track;

  const title = track
    ? trackLine(track)
    : card?.mine
      ? t("You")
      : card?.author.name || card?.author.username || "";
  const line = track ? trackUnder(track) : (card?.body ?? "").trim();

  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full items-start gap-[13px] px-3.5 py-[9px] text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
    >
      <SavedRowLeading thing={thing} emptyIcon={Heart} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-bold leading-[1.15]">{title}</span>
        {line ? (
          <span className="mt-[3px] line-clamp-2 block text-[13px] leading-[1.3] text-[color-mix(in_srgb,var(--ink)_72%,transparent)]">
            {line}
          </span>
        ) : null}
        <span className="mt-[5px] block text-[11.5px] font-semibold text-dim">
          {t(kindOf(thing))} · {ago(thing.at)}
        </span>
      </span>
    </button>
  );
}

function List({ rows, onOpen, empty }: { rows: SavedThing[]; onOpen: (thing: SavedThing) => void; empty: ReactNode }) {
  if (!rows.length) return <>{empty}</>;
  return (
    <ul className="pb-8 pt-0.5">
      {rows.map((thing, index) => (
        <li key={`${thing.kind}-${thing.drop?.id ?? thing.vibe?.id ?? thing.track?.id ?? index}`}>
          <Row thing={thing} onOpen={() => onOpen(thing)} />
          {/* A hairline under every row but the last, indented past the picture
              so it reads as one list rather than as a stack of unrelated
              blocks — the shelf's rule, drawn the same way. */}
          {index < rows.length - 1 ? (
            <div className="ms-[93px] h-px bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]" />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

export function ActivityPage() {
  const { t } = usePreferences();
  const open = useOpen();
  const [tab, setTab] = useState<"felt" | "responded">("felt");

  const activity = useQuery({
    queryKey: ["activity", "mine"],
    queryFn: () => dropsService.activity(),
  });

  const felt = activity.data?.liked ?? [];
  const said = activity.data?.said ?? [];
  const rows = tab === "felt" ? felt : said;

  return (
    <div className="min-h-dvh pb-[calc(92px+env(safe-area-inset-bottom,0px))] md:pb-16">
      {/* The app's AppBar: the settings row's own words as the title, with the
          two tabs as its bottom — so `Felt & responded` is the page and `Felt`
          and `Responded` are the two halves of it. */}
      <PageHeader title={t("Felt & responded")} back>
        <div className="mx-auto w-full max-w-[720px] px-3 pb-2 sm:px-4">
          <Tabs
            tabs={[
              // No counts on the tabs: the app's `TabBar` carries bare words,
              // and a number here would be this page answering a question the
              // server did not ask it.
              { key: "felt", label: t("Felt") },
              { key: "responded", label: t("Responded") },
            ]}
            value={tab}
            onChange={(next) => setTab(next as "felt" | "responded")}
          />
        </div>
      </PageHeader>

      {activity.isLoading ? (
        <div className="flex items-center justify-center py-20">
          <span className="size-[22px] animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : activity.isError ? (
        <Blank
          top="pt-20"
          icon={<CloudOff className="size-[46px]" />}
          title={t("That could not be read")}
          line={errorMessage(activity.error)}
          action={
            <button type="button" className="btn btn-secondary mt-4" onClick={() => void activity.refetch()}>
              {t("Try again")}
            </button>
          }
        />
      ) : (
        <List
          rows={rows}
          onOpen={open}
          empty={
            tab === "felt" ? (
              <Blank
                icon={<Heart className="size-[46px]" />}
                title={t("Nothing felt yet")}
                line={t("Drops, Vibes and songs you heart show up here — so you can find your way back to them.")}
              />
            ) : (
              <Blank
                icon={<MessageCircle className="size-[46px]" />}
                title={t("You have not responded anywhere")}
                line={t("The Drops and Vibes you leave a line on gather here.")}
              />
            )
          }
        />
      )}
    </div>
  );
}
