import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bookmark, ChevronRight, Lock, Search, SearchX, WifiOff, X } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Blank } from "@/components/Blank";
import { VerifiedTick } from "@/components/Tick";
import { api } from "@/lib/api";
import { usePreferences } from "@/providers/PreferencesProvider";
import type { UserCard } from "@/types/api";
import { Link } from "react-router-dom";

/**
 * Kept — the people I keep.
 *
 * Ported from `app/lib/screens/crew.dart` at `kind: 'following'`, which is the
 * list of people *I* keep. The app has one screen for four lists (my Crew, my
 * Kept, and either list on somebody else's profile) because they are one
 * endpoint and one shape; only the words change. The web reaches it from
 * Controls and it is always my own, so the port is the one combination — but the
 * rules that decide what a row says are the app's, unchanged.
 *
 * A private account shows the number and never the names, and the server
 * enforces it: this screen asks and draws whatever comes back, including
 * nothing. Nothing here filters or guesses on the account's behalf.
 *
 * The search is local, over the rows already in hand. The list arrives in one
 * answer, so a keystroke is never a request, and the list still narrows with no
 * signal. A person is found by the two things the row shows — their name and
 * their handle — because those are what somebody reads to tell one row from the
 * next.
 */

/** The name a row carries. `Aliases.it.card` — my own name for them, else theirs. */
function nameOf(person: UserCard): string {
  return (person.name || person.username || "").trim();
}

export function KeptView({ ownerId }: { ownerId: string }) {
  const { t } = usePreferences();
  const [typed, setTyped] = useState("");

  const people = useQuery({
    queryKey: ["settings-kept", ownerId],
    // A bare list, which the endpoint answers with directly — it has no page to
    // it. The app's comment on the same line is worth repeating: reading
    // `results` here matched nothing and left the list permanently empty, which
    // looks exactly like a person nobody keeps.
    queryFn: () => api.get<UserCard[]>(`/social/users/${ownerId}/crew/following/`),
    enabled: Boolean(ownerId),
  });

  const rows = useMemo(() => people.data ?? [], [people.data]);

  /** The query as it is matched: trimmed, lower-cased, with a leading `@` off. */
  const query = useMemo(() => {
    const value = typed.trim().toLowerCase();
    return value.startsWith("@") ? value.slice(1) : value;
  }, [typed]);

  const matching = useMemo(() => {
    if (!query) return rows;
    return rows.filter(
      (person) =>
        nameOf(person).toLowerCase().includes(query) ||
        (person.username ?? "").toLowerCase().includes(query),
    );
  }, [rows, query]);

  /**
   * Whether this list gets the search box at all.
   *
   * Any list with somebody on it does — the box is not furniture to somebody who
   * does not know how many rows they have, and a Kept of six and a Kept of sixty
   * are one product, so the same control is in the same place on both. An *empty*
   * list still has none: there is nothing to search, and its own blank state is
   * the whole of what it has to say.
   */
  const searchable = rows.length > 0;

  if (people.isLoading) {
    return (
      <div className="flex justify-center py-16">
        <span className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (people.isError) {
    // The app's `Blank` with the app's own title. Its line ends "Pull down to
    // try again", which is the one thing this page cannot offer: there is no
    // pull-to-refresh gesture in a browser, and a sentence telling somebody to
    // perform one would be furniture of the wrong kind. So the title and the
    // error are the app's and the way out is a real button.
    return (
      <Blank
        top="pt-20"
        icon={<WifiOff className="size-[46px]" />}
        title={t("No answer from the server")}
        line={people.error instanceof Error ? people.error.message : ""}
        action={
          <button
            type="button"
            className="btn btn-secondary mt-4"
            onClick={() => void people.refetch()}
          >
            {t("Try again")}
          </button>
        }
      />
    );
  }

  return (
    <div>
      {searchable ? (
        <div className="px-4 py-1">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-[19px] -translate-y-1/2 text-dim"
              aria-hidden
            />
            <input
              className="field w-full rounded-[14px] border-line py-[11px] pl-10 pr-10 text-[14.5px]"
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              placeholder={t("Name or @handle...")}
              aria-label={t("Name or @handle...")}
              type="search"
              enterKeyHint="search"
            />
            {typed ? (
              <button
                type="button"
                onClick={() => setTyped("")}
                aria-label={t("Clear")}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-dim transition hover:text-ink"
              >
                <X className="size-[18px]" />
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {rows.length === 0 ? (
        <Blank
          icon={<Bookmark className="size-[46px]" />}
          title={t("Nobody kept yet")}
          line={t("Keep someone and they turn up here.")}
        />
      ) : matching.length === 0 ? (
        <Blank
          icon={<SearchX className="size-[46px]" />}
          title={t(`Nobody matches "${typed.trim()}"`)}
        />
      ) : (
        <div className="space-y-2 px-4 pb-[30px] pt-2">
          {matching.map((person) => {
            const name = nameOf(person);
            return (
              <Link
                key={String(person.id)}
                to={`/app/u/${person.username}`}
                className="flex items-center rounded-[16px] border border-line bg-card px-3 py-2.5 transition hover:bg-[color-mix(in_srgb,var(--ink)_3%,transparent)]"
              >
                <Avatar name={name} src={person.avatar} size={44} />
                <span className="ml-3 min-w-0 flex-1">
                  <span className="flex items-center">
                    <span className="truncate text-[15px] font-bold">{name}</span>
                    {person.verified ? (
                      <span className="ml-1 flex shrink-0">
                        <VerifiedTick size={14} />
                      </span>
                    ) : null}
                  </span>
                  <span className="mt-0.5 flex items-center text-[12.5px] text-dim">
                    @{person.username ?? ""}
                    {person.is_private ? <Lock className="ml-1.5 size-3 shrink-0" aria-hidden /> : null}
                  </span>
                </span>
                {/* Kept is read-only. The one editable list of the four is my own
                    Crew — who keeps *me* — where this chevron is replaced by the
                    Remove button; taking somebody out of my Kept is "Let go" on
                    their own page, not a gesture made from a list of them. */}
                <ChevronRight className="ml-2 size-[18px] shrink-0 text-dim" aria-hidden />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

