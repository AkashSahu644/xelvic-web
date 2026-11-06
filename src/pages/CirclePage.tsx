import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/layout/Page";
import { EmptyState } from "@/components/ui/States";
import { errorMessage } from "@/utils/errors";
import { count } from "@/utils/format";
import { DropCard } from "@/features/drops/DropCard";
import { DropComposer } from "@/features/drops/DropComposer";
import { circlesService } from "@/services/circles.service";
import type { CircleDay } from "@/types/api";
import { circleTitle, Faces, Flame, PostButton, StatusLine, TaskLine } from "@/features/circles/parts";

/**
 * One circle, opened — `CircleScreen` in `app/lib/screens/circles.dart`.
 *
 * The members, the task, the window and the board in full. The board is drawn
 * with the feed's own `DropCard` because a circle's post *is* an ordinary drop
 * (`Drop.circle_day` is a column, not a second table), so there is no
 * circles-only card to keep in step with the real one.
 *
 * The board is a list and not a feed: every card of the day is built at once,
 * there is no eye among them and nothing is scrolled past. So none of them
 * counts a look — `read={false}` is the app's `DropCard(read: false)`, and a
 * number on the back of somebody's post that nobody earned is worse than no
 * number.
 *
 * Nothing is decided here. The task is sealed by the server until the hour it
 * opens on, `open` says whether the window is taking posts, and the board
 * arrives already ranked — best first, ties to whoever got there first.
 */
export function CirclePage() {
  const { circleId = "" } = useParams();
  const queryClient = useQueryClient();
  const [posting, setPosting] = useState<CircleDay | null>(null);

  const circle = useQuery({
    queryKey: ["circle", circleId],
    queryFn: () => circlesService.one(circleId),
    enabled: Boolean(circleId),
    staleTime: 15_000,
  });

  const day = circle.data?.day ?? null;

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["circle", circleId] });
    void queryClient.invalidateQueries({ queryKey: ["circles-mine"] });
  }

  if (circle.isLoading && !day) {
    return (
      <div className="flex justify-center py-24" aria-label="Loading">
        <LoaderCircle className="size-6 animate-spin text-accent" aria-hidden />
      </div>
    );
  }

  if (!day) {
    return (
      <div className="pb-[calc(92px+env(safe-area-inset-bottom,0px))] md:pb-24">
        <PageHeader title="Circle" back />
        <EmptyState
          icon={<RefreshCw className="size-6" />}
          title={circle.isError ? "That circle could not be reached" : "That circle is not here"}
          body={circle.isError ? errorMessage(circle.error) : "You may not have a seat in it any more."}
          action={
            <button type="button" className="btn btn-secondary" onClick={() => void circle.refetch()}>
              Try again
            </button>
          }
          className="py-14"
        />
      </div>
    );
  }

  return (
    <div className="pb-[calc(92px+env(safe-area-inset-bottom,0px))] md:pb-24">
      <PageHeader
        title={circleTitle(day)}
        back
        actions={
          <>
            {day.run > 0 ? <Flame run={day.run} /> : null}
            <button type="button" className="icon-btn" onClick={refresh} aria-label="Refresh">
              <RefreshCw className="size-[18px]" />
            </button>
          </>
        }
      />

      <div className="mx-auto w-full max-w-[760px] px-4 pt-1.5 md:px-7">
        <div className="py-3.5">
          <Faces day={day} />
        </div>

        <div className="rounded-[20px] border border-line bg-card p-4">
          <TaskLine day={day} />
          <div className="mt-2.5">
            <StatusLine day={day} />
          </div>
          <div className="mt-3">
            <PostButton day={day} onPost={() => setPosting(day)} />
          </div>
        </div>

        <div className="flex items-center gap-2 px-0.5 pb-2 pt-3.5">
          <h2 className="text-[15px] font-extrabold">Today’s board</h2>
          <span className="text-[13px] text-dim">{count(day.count)}</span>
        </div>

        {day.board.length === 0 ? (
          <p className="py-2 text-[13.5px] text-dim">
            {day.open
              ? "Nobody has answered yet."
              : day.opens_in > 0
                ? "The board opens when the day does."
                : "Nothing went up on this one."}
          </p>
        ) : (
          <div className="space-y-2.5">
            {day.board.map((drop, index) => (
              <div key={String(drop.id)} className="flex items-start gap-2">
                <span
                  className={`w-5 shrink-0 pt-3.5 text-[13px] font-extrabold ${
                    index === 0 ? "text-accent" : "text-dim"
                  }`}
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <DropCard drop={drop} read={false} onChanged={refresh} />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <DropComposer
        open={Boolean(posting)}
        mode={posting?.task?.kind === "text" ? "note" : posting?.task?.kind === "sound" ? "sound" : "drop"}
        circle={posting?.id}
        answer={posting?.task?.kind}
        onClose={() => setPosting(null)}
        onCreated={() => {
          setPosting(null);
          refresh();
        }}
      />
    </div>
  );
}