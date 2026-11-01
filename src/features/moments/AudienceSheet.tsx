import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, Circle, CloudOff, Lock, Users, UsersRound, EyeOff } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import type { UserCard } from "@/types/api";

/**
 * Who one moment is for, on top of who the account already lets in.
 *
 * Ported from `audience_sheet.dart`. `mode` is the wire word — `everyone`,
 * `except` or `only` — and `people` is who the last two narrow to. The ids are
 * meaningless for `everyone`, so the server is never sent a stray list for it.
 *
 * The mode is a different question from "who is in it". A tag hands somebody a
 * right over the moment and is capped; an audience takes nobody's name and puts
 * nobody in the picture. It only narrows who sees it — and a person on an
 * `except` list is being kept out rather than let in, which is why the two
 * lists are never shared with the mention sheet.
 */
export type AudienceMode = "everyone" | "except" | "only";

export interface Audience {
  mode: AudienceMode;
  people: UserCard[];
}

export const EVERYONE: Audience = { mode: "everyone", people: [] };

export function audienceLabel(audience: Audience): string {
  if (audience.mode === "everyone") return "Everyone";
  const n = audience.people.length;
  if (audience.mode === "except") return n ? `Hidden from ${n}` : "Everyone";
  if (!n) return "Only you";
  return n === 1 ? "Only 1 person" : `Only ${n} people`;
}

export function audienceIcon(audience: Audience) {
  if (audience.mode === "except") return EyeOff;
  if (audience.mode === "only") return Lock;
  return Users;
}

/** The server's ids, or nothing at all for an EVERYONE moment — `AudienceChoice.ids`. */
export function audienceIds(audience: Audience): string[] {
  return audience.mode === "everyone" ? [] : audience.people.map((person) => String(person.id));
}

function useMentionable(query: string) {
  const [settled, setSettled] = useState("");
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(query.trim()), 250);
    return () => window.clearTimeout(timer);
  }, [query]);
  return useQuery({
    queryKey: ["moments-mentionable", settled],
    queryFn: () => api.get<UserCard[]>("/social/mentionable/", { query: { q: settled } }),
    staleTime: 60_000,
  });
}

/**
 * The sheet that answers "who is this for" — three reaches as pills, a search
 * box and a list once the reach is narrow, and a Done.
 *
 * The list is fetched only once a mode that needs it is chosen, so opening the
 * sheet on Everyone — the commonest case — costs no request at all. The search
 * narrows what has already arrived while the next request is in the air, so
 * typing never waits on the network.
 */
export function AudienceSheet({
  open,
  value,
  onClose,
  onPick,
}: {
  open: boolean;
  value: Audience;
  onClose: () => void;
  onPick: (next: Audience) => void;
}) {
  const [mode, setMode] = useState<AudienceMode>(value.mode);
  const [picked, setPicked] = useState<UserCard[]>(value.people);
  const [query, setQuery] = useState("");
  const choosing = mode !== "everyone";
  const people = useMentionable(choosing ? query : "");

  useEffect(() => {
    if (!open) return;
    setMode(value.mode);
    setPicked(value.people);
    setQuery("");
  }, [open, value]);

  const rows = useMemo(() => {
    const seen = new Set<string>();
    return (people.data ?? []).filter((person) => {
      const id = String(person.id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [people.data]);

  const on = (person: UserCard) => picked.some((row) => String(row.id) === String(person.id));
  function toggle(person: UserCard) {
    setPicked((current) =>
      on(person)
        ? current.filter((row) => String(row.id) !== String(person.id))
        : [...current, person],
    );
  }

  function done() {
    onPick({ mode, people: mode === "everyone" ? [] : picked });
    onClose();
  }

  const explainer =
    mode === "except"
      ? "Everyone who may already see your moments, except the people you pick."
      : mode === "only"
        ? "Only the people you pick, and nobody else."
        : "Every person your account already lets into your moments.";

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Who this is for"
      description="A reach for this one moment, on top of who your account lets in."
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-[11.5px] text-dim">
            {mode === "everyone" ? "Everyone" : `${picked.length} picked`}
          </span>
          <Button onClick={done} icon={mode === "everyone" ? <Users className="size-4" /> : <CheckCircle2 className="size-4" />}>
            {mode === "everyone" ? "Done" : `Done · ${picked.length}`}
          </Button>
        </div>
      }
    >
      <div className="space-y-3 p-5">
        <div className="grid grid-cols-3 gap-2">
          {([
            ["everyone", Users, "Everyone"],
            ["except", EyeOff, "Hide from"],
            ["only", Lock, "Only these"],
          ] as const).map(([next, Icon, label]) => (
            <button
              key={next}
              type="button"
              onClick={() => setMode(next)}
              aria-pressed={mode === next}
              className={cn(
                "flex flex-col items-center gap-1.5 rounded-[14px] border px-2 py-3 transition",
                mode === next
                  ? "border-accent bg-[var(--accent-soft)] text-accent"
                  : "border-line bg-paper text-ink hover:border-[color-mix(in_srgb,var(--accent)_35%,var(--line))]",
              )}
            >
              <Icon className="size-5" />
              <span className="text-[11.5px] font-bold">{label}</span>
            </button>
          ))}
        </div>

        <p className="flex items-start gap-2 text-[11.5px] leading-5 text-dim">
          {mode === "only" ? <Lock className="mt-0.5 size-3.5 shrink-0" /> : mode === "except" ? <EyeOff className="mt-0.5 size-3.5 shrink-0" /> : <Users className="mt-0.5 size-3.5 shrink-0" />}
          <span>{explainer}</span>
        </p>

        {choosing ? (
          <>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search a name or @handle"
              className="field h-10 w-full"
            />
            {people.isLoading ? (
              <div className="space-y-2 py-1" aria-hidden>
                {[0, 1, 2].map((row) => (
                  <div key={row} className="skeleton h-12 rounded-[12px]" />
                ))}
              </div>
            ) : people.isError ? (
              <div className="flex items-center gap-2.5 rounded-[12px] border border-line bg-paper px-3 py-3 text-[12px] text-dim">
                <CloudOff className="size-4 shrink-0" />
                The list of people could not be reached.
              </div>
            ) : rows.length === 0 ? (
              <div className="flex items-center gap-2.5 rounded-[12px] border border-line bg-paper px-3 py-3 text-[12px] text-dim">
                <UsersRound className="size-4 shrink-0" />
                {query.trim() ? "Nobody by that name." : "Nobody to name yet."}
              </div>
            ) : (
              <div className="max-h-64 overflow-y-auto rounded-[14px] border border-line">
                {rows.map((person) => {
                  const added = on(person);
                  return (
                    <button
                      key={String(person.id)}
                      type="button"
                      onClick={() => toggle(person)}
                      aria-pressed={added}
                      className="flex w-full items-center gap-3 border-b border-line px-3 py-2.5 text-left last:border-b-0 hover:bg-[color-mix(in_srgb,var(--ink)_3%,transparent)]"
                    >
                      <Avatar user={person} size={34} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold">{person.name || person.username}</span>
                        <span className="block truncate text-[11.5px] text-dim">@{person.username}</span>
                      </span>
                      {added ? (
                        <CheckCircle2 className="size-[18px] shrink-0 text-accent" />
                      ) : (
                        <Circle className="size-[18px] shrink-0 text-dim" />
                      )}
                    </button>
                  );
                })}
              </div>
            )}
            {picked.length ? (
              <div className="flex flex-wrap gap-1.5">
                {picked.map((person) => (
                  <button
                    key={String(person.id)}
                    type="button"
                    onClick={() => toggle(person)}
                    className="chip inline-flex items-center gap-1"
                    aria-label={`Remove ${person.name || person.username}`}
                  >
                    {person.name || person.username}
                    <span aria-hidden>×</span>
                  </button>
                ))}
              </div>
            ) : null}
          </>
        ) : null}
      </div>
    </Modal>
  );
}

/**
 * The people a moment names, chosen off the same list the composer's mention
 * sheet uses (`/social/mentionable/`).
 *
 * A tag gives somebody a right over the moment — it opens it whatever the
 * account's privacy says — so the list is the server's answer to "who may I
 * name" and never a local guess.
 */
export function MentionSheet({
  open,
  chosen,
  onClose,
  onPick,
}: {
  open: boolean;
  chosen: UserCard[];
  onClose: () => void;
  onPick: (next: UserCard[]) => void;
}) {
  const [picked, setPicked] = useState<UserCard[]>(chosen);
  const [query, setQuery] = useState("");
  const people = useMentionable(query);

  useEffect(() => {
    if (!open) return;
    setPicked(chosen);
    setQuery("");
  }, [open, chosen]);

  const on = (person: UserCard) => picked.some((row) => String(row.id) === String(person.id));
  function toggle(person: UserCard) {
    setPicked((current) =>
      on(person) ? current.filter((row) => String(row.id) !== String(person.id)) : [...current, person],
    );
  }

  const rows = people.data ?? [];

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Name people"
      description="They see this moment, and can put it on their own day."
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 flex-1 truncate text-[11.5px] text-dim">
            {picked.length ? picked.map((person) => `@${person.username}`).join(", ") : "Nobody named"}
          </span>
          <Button
            onClick={() => {
              onPick(picked);
              onClose();
            }}
          >
            Done
          </Button>
        </div>
      }
    >
      <div className="space-y-3 p-5">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search a name or @handle"
          className="field h-10 w-full"
        />
        {people.isLoading ? (
          <div className="space-y-2" aria-hidden>
            {[0, 1, 2].map((row) => (
              <div key={row} className="skeleton h-12 rounded-[12px]" />
            ))}
          </div>
        ) : people.isError ? (
          <div className="flex items-center gap-2.5 rounded-[12px] border border-line bg-paper px-3 py-3 text-[12px] text-dim">
            <CloudOff className="size-4 shrink-0" />
            The list of people could not be reached.
          </div>
        ) : rows.length === 0 ? (
          <div className="flex items-center gap-2.5 rounded-[12px] border border-line bg-paper px-3 py-3 text-[12px] text-dim">
            <UsersRound className="size-4 shrink-0" />
            {query.trim() ? "Nobody by that name." : "Nobody to name yet."}
          </div>
        ) : (
          <div className="max-h-64 overflow-y-auto rounded-[14px] border border-line">
            {rows.map((person) => {
              const added = on(person);
              return (
                <button
                  key={String(person.id)}
                  type="button"
                  onClick={() => toggle(person)}
                  aria-pressed={added}
                  className="flex w-full items-center gap-3 border-b border-line px-3 py-2.5 text-left last:border-b-0 hover:bg-[color-mix(in_srgb,var(--ink)_3%,transparent)]"
                >
                  <Avatar user={person} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-semibold">{person.name || person.username}</span>
                    <span className="block truncate text-[11.5px] text-dim">@{person.username}</span>
                  </span>
                  {added ? (
                    <CheckCircle2 className="size-[18px] shrink-0 text-accent" />
                  ) : (
                    <Circle className="size-[18px] shrink-0 text-dim" />
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}