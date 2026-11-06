import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, ChevronRight, Lock, Plus, LoaderCircle, UsersRound } from "lucide-react";
import { Modal } from "@/components/overlays/Modal";
import { useToast } from "@/hooks/useToast";
import { errorMessage } from "@/utils/errors";
import { cn } from "@/utils/cn";
import { count } from "@/utils/format";
import { DropComposer } from "@/features/drops/DropComposer";
import { circlesService } from "@/services/circles.service";
import type { CircleDay } from "@/types/api";
import {
  circleTitle,
  FieldTile,
  Flame,
  monthName,
  PostButton,
  RankRow,
  StatusLine,
  TaskLine,
} from "./parts";

/**
 * Circles — the section under the Moments rail.
 *
 * Ported from `CircleSection` in `app/lib/screens/circles.dart`. The phone's
 * Moments page swapped this section for `LiveNow` on 2026-10-31, and the circles
 * code is still shipped in the app and still served by four routes
 * (`apps/circles/urls.py`). The web keeps the section *below* the "Live now"
 * strip: the app has circles on a shelf of their own, so the strip alone would
 * leave a web reader with no way to reach them. That extra door is the one place
 * this page deliberately draws more than the phone does, and the parity notes
 * say so.
 *
 * Three states, and they are the app's three:
 *
 * - **Nothing picked yet** — which is every account on the first of the month,
 *   and every account that never opened this page. The section *is* the picker
 *   in that case, so it says what it is for instead of drawing an empty list.
 * - **One to three cards** — each a circle as it stands today: its task (or the
 *   hour it arrives), the window, whether this account already answered, and
 *   the top of the board. A card opens the circle's own page.
 * - **Room for another** — a line under the cards. Three interests a month, and
 *   the number is the server's (`max_picks`), not this file's.
 *
 * Every rule behind those states is the server's: `mine/` decides which
 * circles exist and what each is doing today, `fields/` decides what may be
 * chosen, and `pick/` answers with the circle the choice landed in rather than
 * with the choice, so the tap goes straight into the room it made.
 */
export function CirclesSection() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [posting, setPosting] = useState<CircleDay | null>(null);

  const mine = useQuery({
    queryKey: ["circles-mine"],
    queryFn: () => circlesService.mine(),
    retry: false,
    staleTime: 30_000,
  });

  // Read from the same cache the picker fills, and never fetched from here: the
  // phone asks for the interests only when somebody opens the picker, and the
  // section draws its month line from what that answer left behind. `enabled:
  // false` keeps this observer on the cache without asking on mount.
  const fields = useQuery({
    queryKey: ["circles-fields"],
    queryFn: () => circlesService.fields(),
    enabled: false,
    staleTime: 0,
  });

  const circles = mine.data?.circles ?? [];
  const maxPicks = fields.data?.max_picks ?? 3;

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["circles-mine"] });
    void queryClient.invalidateQueries({ queryKey: ["circles-fields"] });
  }

  function posted(day: CircleDay) {
    setPosting(null);
    refresh();
    void queryClient.invalidateQueries({ queryKey: ["circle", String(day.id)] });
  }

  return (
    <section className="mt-3">
      <div className="flex items-center gap-2.5 pb-3 pl-[18px] pr-3">
        <h2 className="text-[19px] font-extrabold">Circles</h2>
        {circles.length === 0 ? (
          // The month, not the run, while nothing is picked: "October" is what
          // the choosing is for, and a flame beside an empty section is a flame
          // for a run of nought.
          <span className="min-w-0 flex-1 truncate text-[12.5px] text-dim">
            {monthName(fields.data?.month)}
          </span>
        ) : (
          <>
            {circles[0]?.run ? <Flame run={circles[0].run} /> : null}
            <span className="flex-1" />
          </>
        )}
        {circles.length > 0 && circles.length < maxPicks ? (
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            title="Pick another interest"
            aria-label="Pick another interest"
            className="icon-btn"
          >
            <Plus className="size-[18px]" />
          </button>
        ) : null}
      </div>

      {mine.isLoading && circles.length === 0 ? (
        <div className="px-[18px]" aria-hidden>
          <div className="skeleton h-[168px] rounded-[20px]" />
        </div>
      ) : circles.length === 0 ? (
        <div className="px-[18px]">
          <div className="rounded-[20px] border border-line bg-card p-4 pt-[18px]">
            <p className="flex items-center gap-2.5 text-[16.5px] font-extrabold">
              <UsersRound className="size-[22px] text-accent" aria-hidden />
              Find your people
            </p>
            <p className="mt-2 text-[13.5px] leading-[1.35] text-dim">
              Pick what you are into. You land in a circle of fifty who chose the same thing, and
              every day it gets one small task to answer. Best take goes to the top.
            </p>
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="btn btn-primary mt-3.5 min-h-[46px] w-full rounded-[14px] text-[13px]"
            >
              Pick your interests
            </button>
            {mine.isError ? (
              <p className="mt-2.5 text-[12.5px] text-dim">{errorMessage(mine.error)}</p>
            ) : null}
          </div>
        </div>
      ) : (
        <>
          {circles.map((day) => (
            <div key={String(day.id)} className="px-[18px] pb-3">
              <CircleCard
                day={day}
                onOpen={() => navigate(`/app/circles/${encodeURIComponent(String(day.id))}`)}
                onPost={() => setPosting(day)}
              />
            </div>
          ))}
          {circles.length < maxPicks ? (
            <button
              type="button"
              onClick={() => setPickerOpen(true)}
              className="mx-auto flex w-full items-center justify-center gap-1.5 py-3 text-[13px] font-bold text-accent"
            >
              <Plus className="size-[17px]" aria-hidden />
              {maxPicks - circles.length === 1
                ? "One more interest this month"
                : `${maxPicks - circles.length} more interests this month`}
            </button>
          ) : null}
        </>
      )}

      {/* The one line about a read that failed, and only when there is nothing
          to draw: a section that already has circles does not need to say the
          last ask did not land — the stale card is better than a banner. */}
      {circles.length === 0 && mine.isError && !mine.isLoading ? (
        <p className="px-[18px] pt-2.5 text-center text-[12.5px] text-dim">{errorMessage(mine.error)}</p>
      ) : null}

      <InterestPicker
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPicked={(day) => {
          setPickerOpen(false);
          refresh();
          navigate(`/app/circles/${encodeURIComponent(String(day.id))}`);
        }}
      />

      <DropComposer
        open={Boolean(posting)}
        mode={posting?.task?.kind === "text" ? "note" : posting?.task?.kind === "sound" ? "sound" : "drop"}
        circle={posting?.id}
        answer={posting?.task?.kind}
        onClose={() => setPosting(null)}
        onCreated={() => {
          if (posting) posted(posting);
        }}
      />
    </section>
  );
}

/**
 * One circle, as the section draws it — `_CircleCard`.
 *
 * The whole card opens the circle. The post button inside it must not, which is
 * why the open target is one transparent button under the content rather than a
 * click handler on a container holding another button.
 */
function CircleCard({
  day,
  onOpen,
  onPost,
}: {
  day: CircleDay;
  onOpen: () => void;
  onPost: () => void;
}) {
  const peek = (day.board ?? []).slice(0, 3);
  return (
    <div className="relative overflow-hidden rounded-[20px] border border-line bg-card">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`Open ${circleTitle(day)}`}
        className="absolute inset-0 z-0"
        tabIndex={-1}
      />
      <div className="pointer-events-none relative z-10">
        <div className="flex items-center gap-2.5 px-4 pb-2.5 pt-3.5">
          <FieldTile fieldKey={day.field?.key ?? ""} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15.5px] font-extrabold">{circleTitle(day)}</p>
            <p className="text-[12px] text-dim">
              {day.seats < day.size
                ? `${count(day.seats)} of ${count(day.size)} seats`
                : `${count(day.seats)} in the circle`}
            </p>
          </div>
          {day.run > 0 ? <Flame run={day.run} /> : null}
          <ChevronRight className="size-5 text-dim" aria-hidden />
        </div>

        <div className="px-4">
          <TaskLine day={day} />
          <div className="mt-2.5">
            <StatusLine day={day} />
          </div>
          <div className="pointer-events-auto mt-3">
            <PostButton day={day} onPost={onPost} />
          </div>
        </div>

        {peek.length ? (
          <div className="mt-3.5 border-t border-line">
            {peek.map((drop, index) => (
              <RankRow key={String(drop.id)} rank={index + 1} drop={drop} />
            ))}
            {day.count > peek.length ? (
              <p className="px-4 pb-3 pt-0.5 text-[12.5px] font-bold text-accent">
                See all {count(day.count)} takes
              </p>
            ) : (
              <span className="block h-2.5" />
            )}
          </div>
        ) : (
          <p className="px-4 py-3.5 text-[13px] text-dim">
            {day.open
              ? "Nobody has answered yet. Be the first."
              : day.opens_in > 0
                ? // Not "nothing went up today", which is true and reads as *the
                  // day is over* — the misreading this section had every morning.
                  "The board opens when the day does."
                : "Nothing went up today."}
          </p>
        )}
      </div>
    </div>
  );
}

/**
 * The monthly choosing — `CirclePickerScreen`.
 *
 * Read every time it opens, and not once a session: the ticks are monthly and
 * the month turns over on a date this screen cannot see. A picker reopened on
 * the second of the month with yesterday's ticks on it would be a picker telling
 * somebody they had already chosen.
 */
function InterestPicker({
  open,
  onClose,
  onPicked,
}: {
  open: boolean;
  onClose: () => void;
  onPicked: (day: CircleDay) => void;
}) {
  const { toast } = useToast();
  const [busy, setBusy] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const fields = useQuery({
    queryKey: ["circles-fields"],
    queryFn: () => circlesService.fields(),
    enabled: open,
    staleTime: 0,
    refetchOnMount: "always",
  });

  const offers = fields.data?.fields ?? [];
  const maxPicks = fields.data?.max_picks ?? 3;
  const size = fields.data?.size ?? 50;
  const picked = offers.filter((row) => row.picked).length;

  async function choose(key: string) {
    if (busy) return;
    setBusy(key);
    try {
      const answer = await circlesService.pick(key);
      void queryClient.invalidateQueries({ queryKey: ["circles-mine"] });
      void queryClient.invalidateQueries({ queryKey: ["circles-fields"] });
      onPicked(answer.day);
    } catch (error) {
      toast({ title: errorMessage(error), tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Your interests" size="md">
      <div className="px-4 pb-4">
        <p className="text-[13.5px] leading-[1.35] text-dim">
          {picked >= maxPicks
            ? "That is all three for this month. They reopen on the first."
            : `Choose up to ${maxPicks}. You get a circle of ${size} who picked the same, and one small task a day.`}
        </p>

        <div className="mt-3.5 space-y-2.5">
          {fields.isLoading && offers.length === 0 ? (
            <p className="py-10 text-center">
              <LoaderCircle className="mx-auto size-5 animate-spin text-accent" aria-hidden />
            </p>
          ) : offers.length === 0 ? (
            <p className="py-10 text-center text-[13.5px] text-dim">
              {fields.isError ? errorMessage(fields.error) : "Nothing to choose from right now."}
            </p>
          ) : (
            offers.map((interest) => {
              const full = picked >= maxPicks && !interest.picked;
              return (
                <button
                  key={String(interest.id)}
                  type="button"
                  disabled={full || busy !== null}
                  onClick={() => void choose(interest.key)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[18px] border bg-card p-3.5 text-left transition",
                    interest.picked ? "border-accent" : "border-line",
                    full ? "opacity-70" : "hover:border-accent",
                  )}
                >
                  <FieldTile fieldKey={interest.key} picked={interest.picked} />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[15px] font-extrabold">{interest.name}</span>
                    {interest.blurb.trim() ? (
                      <span className="mt-0.5 block text-[12.5px] leading-[1.3] text-dim">
                        {interest.blurb}
                      </span>
                    ) : null}
                  </span>
                  {busy === interest.key ? (
                    <LoaderCircle className="size-5 shrink-0 animate-spin text-accent" aria-hidden />
                  ) : interest.picked ? (
                    <CheckCircle2 className="size-[22px] shrink-0 text-accent" aria-hidden />
                  ) : full ? (
                    <Lock className="size-[18px] shrink-0 text-dim" aria-hidden />
                  ) : (
                    <Plus className="size-[22px] shrink-0 text-dim" aria-hidden />
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>
    </Modal>
  );
}