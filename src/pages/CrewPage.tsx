import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Search, SearchX, UserMinus, Users, Bookmark, WifiOff, X } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Blank } from "@/components/ui/Blank";
import { ConfirmDialog } from "@/components/overlays/Modal";
import { PageHeader } from "@/components/layout/Page";
import { VerifiedTick } from "@/components/icons/Tick";
import { errorMessage } from "@/utils/errors";
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/hooks/usePreferences";
import { useToast } from "@/hooks/useToast";
import { socialService } from "@/services/social.service";
import type { UserCard } from "@/types/api";

/**
 * The two lists behind the counts on a profile: who somebody keeps, and who
 * keeps them.
 *
 * Ported from `app/lib/screens/crew.dart`. One endpoint and one shape, so it is
 * also the same screen whether it was opened from my own profile or somebody
 * else's — and, like the app, the list is the same one the Controls → Kept row
 * opens.
 *
 * A private account shows the number and never the names, and the server
 * enforces it: this screen asks and draws whatever comes back, including
 * nothing. Nothing here filters or guesses on the account's behalf.
 *
 * One list of the four is editable: my own Crew, which is who keeps me. The
 * owner asked for it on 2026-10-08 — *"apni prfile me ja kar crew ya kept me se
 * kisi ko remove karo … to usi time update nahi hota hai counter"* — so the
 * removal goes through the server before the row leaves, and the count behind
 * this screen is asked again on the way out.
 */
type Kind = "followers" | "following";

/** The name a row carries. `Aliases.it.card` — my own name for them, else theirs. */
function nameOf(person: UserCard): string {
  return (person.name || person.username || "").trim();
}

export function CrewPage() {
  const { username = "", kind = "followers" } = useParams();
  const which: Kind = kind === "following" ? "following" : "followers";
  const { user, updateUser } = useAuth();
  const { t } = usePreferences();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [typed, setTyped] = useState("");
  const [removing, setRemoving] = useState<UserCard | null>(null);
  const [busy, setBusy] = useState(false);

  const mine = Boolean(user && user.username === username);
  const ownerName = mine ? t("You") : username;

  const people = useQuery({
    queryKey: ["crew", username, which],
    // A bare list, which the endpoint answers with directly — it has no page to
    // it. Reading `results` here matched nothing in the app and left the list
    // permanently empty, which looks exactly like a person nobody keeps.
    queryFn: () => socialService.crew(username, which),
    enabled: Boolean(username),
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

  /** The app's rule: any list with somebody on it gets the box, an empty one does not. */
  const searchable = rows.length > 0;

  /**
   * Whether this list is mine to edit — my own Crew, and only that.
   *
   * A Crew is who keeps *them*, and taking somebody out of it is a thing you can
   * do to your own followers and to nobody else's. The other three combinations
   * — my Kept, which is Let go on the person's own page, and either list on
   * somebody else's profile — are read-only.
   */
  const editable = which === "followers" && mine;

  async function remove() {
    if (!removing || busy) return;
    setBusy(true);
    try {
      await socialService.remove(removing.id);
      // The server has already done it and answered in the same breath, so what
      // follows is the cached copies keeping step rather than a guess — the same
      // `bumpCrewCount` the app makes, and the count on my own profile is asked
      // again so the number behind this list moves with it.
      updateUser({ followers_count: Math.max(0, (user?.followers_count ?? 1) - 1) });
      await queryClient.invalidateQueries({ queryKey: ["crew", username, which] });
      await queryClient.invalidateQueries({ queryKey: ["profile"] });
      setRemoving(null);
    } catch (error) {
      toast({ title: errorMessage(error), tone: "error" });
    } finally {
      setBusy(false);
    }
  }

  const title = which === "following" ? t("Kept") : t("Crew");

  return (
    <div className="mx-auto w-full max-w-[760px] pb-[calc(96px+env(safe-area-inset-bottom,0px))] md:pb-14">
      <PageHeader title={title} back />

      {people.isLoading ? (
        <div className="flex justify-center py-16">
          <span className="size-6 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      ) : people.isError ? (
        <Blank
          top="pt-20"
          icon={<WifiOff className="size-[46px]" />}
          title={t("No answer from the server")}
          line={errorMessage(people.error)}
          action={
            <button type="button" className="btn btn-secondary mt-4" onClick={() => void people.refetch()}>
              {t("Try again")}
            </button>
          }
        />
      ) : (
        <>
          {searchable ? (
            <div className="px-4 py-1">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-[19px] -translate-y-1/2 text-dim" aria-hidden />
                <input
                  className="field w-full rounded-[14px] border-line py-[11px] pl-10 pr-10 text-[14.5px]"
                  value={typed}
                  onChange={(event) => setTyped(event.target.value)}
                  placeholder={t("Name or @handle...")}
                  aria-label={t("Name or @handle...")}
                  type="search"
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
              icon={which === "following" ? <Bookmark className="size-[46px]" /> : <Users className="size-[46px]" />}
              title={which === "following" ? t("Nobody kept yet") : t("No crew yet")}
              line={
                which === "following"
                  ? t("Keep someone and they turn up here.")
                  : t(`Nobody has kept ${ownerName} yet.`)
              }
            />
          ) : matching.length === 0 ? (
            <Blank icon={<SearchX className="size-[46px]" />} title={t(`Nobody matches "${typed.trim()}"`)} />
          ) : (
            <div className="space-y-2 px-4 pb-[30px] pt-2">
              {matching.map((person) => {
                const name = nameOf(person);
                return (
                  <div
                    key={String(person.id)}
                    className="flex items-center rounded-[16px] border border-line bg-card px-3 py-2.5"
                  >
                    <Link to={`/app/u/${person.username}`} className="flex min-w-0 flex-1 items-center">
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
                        </span>
                      </span>
                    </Link>
                    {/* My own Crew carries the one control this screen has.
                        It sits where the chevron is everywhere else, because
                        the row already opens the person and this is the other
                        thing a row here can do. */}
                    {editable ? (
                      <button
                        type="button"
                        onClick={() => setRemoving(person)}
                        aria-label={t("Remove from your Crew")}
                        className="icon-btn text-[var(--bad)]"
                      >
                        <UserMinus className="size-[18px]" />
                      </button>
                    ) : (
                      <span className="size-[18px] text-dim" aria-hidden />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        open={Boolean(removing)}
        onClose={() => setRemoving(null)}
        onConfirm={() => void remove()}
        title={t(`Remove ${removing ? nameOf(removing) : ""} from your Crew?`)}
        body={t("They stop keeping you, and come off your Crew. They are not told.")}
        confirmLabel={t("Remove")}
        destructive
        loading={busy}
        icon={<UserMinus className="size-5" />}
      />
    </div>
  );
}