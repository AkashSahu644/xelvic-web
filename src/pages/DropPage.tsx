import { useMemo } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, GalleryVerticalEnd, Home } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/layout/Page";
import { EmptyState, ErrorState } from "@/components/ui/States";
import { DropCard } from "@/features/drops/DropCard";
import { dropsService } from "@/services/drops.service";
import { cachedDrop } from "@/store/seed";
import type { Drop } from "@/types/api";

export function DropPage() {
  const { dropId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  /**
   * The feed's own copy of this drop, drawn while the drop's page asks for it.
   *
   * A drop is opened by tapping the card in a feed that is still on the cache,
   * so the row is already in hand. It is handed over as `placeholderData` —
   * shown, not cached — and the request below replaces it the moment the server
   * answers. Nothing here decides whether the row is fresh.
   */
  const seeded = useMemo(() => cachedDrop(queryClient, dropId), [queryClient, dropId]);
  const drop = useQuery({
    queryKey: ["drop", dropId],
    queryFn: () => dropsService.detail<{ drop: Drop }>("drops", dropId),
    enabled: Boolean(dropId),
    placeholderData: seeded ? { drop: seeded } : undefined,
  });

  return (
    <div className="pb-[calc(92px+env(safe-area-inset-bottom,0px))] md:pb-24">
      <PageHeader
        title="Drop"
        back
        actions={
          <Link to="/app/drops" className="icon-btn" aria-label="Back to the feed">
            <Home className="size-4" />
          </Link>
        }
      />
      <div className="mx-auto w-full max-w-[680px] px-3 py-4 sm:px-4">
        {drop.isLoading ? (
          <div className="card p-4" aria-hidden>
            <div className="flex items-center gap-3">
              <div className="skeleton size-10 rounded-full" />
              <div className="flex-1 space-y-2">
                <div className="skeleton h-3 w-32 rounded-full" />
                <div className="skeleton h-2.5 w-24 rounded-full" />
              </div>
            </div>
            <div className="skeleton mt-4 h-3 w-full rounded-full" />
            <div className="skeleton mt-2 h-3 w-4/5 rounded-full" />
            <div className="skeleton mt-4 aspect-[4/3] w-full rounded-xl" />
          </div>
        ) : drop.isError && !drop.data ? (
          <div className="card">
            <ErrorState error={drop.error} onRetry={() => void drop.refetch()} />
          </div>
        ) : !drop.data ? (
          <div className="card">
            <EmptyState
              icon={<GalleryVerticalEnd className="size-6" />}
              title="This drop is not here"
              body="It may have been removed, hidden, or the link may be wrong."
              action={<Button onClick={() => navigate("/app/drops")} icon={<ArrowLeft className="size-4" />}>Back to Drops</Button>}
            />
          </div>
        ) : (
          <>
            <DropCard
              drop={drop.data.drop}
              detailed
              onRemoved={() => {
                void queryClient.invalidateQueries({ queryKey: ["drops"] });
                queryClient.removeQueries({ queryKey: ["drop", dropId] });
                navigate("/app/drops", { replace: true });
              }}
            />
            <p className="mt-4 text-center text-[10.5px] leading-5 text-dim">
              Reactions and responds stay with this drop. Hiding it only changes your own feed.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
