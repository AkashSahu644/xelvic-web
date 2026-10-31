import { Link, useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, GalleryVerticalEnd, Home } from "lucide-react";
import { Button } from "@/components/Button";
import { PageHeader } from "@/components/Page";
import { EmptyState, ErrorState } from "@/components/States";
import { DropCard } from "@/features/drops/DropCard";
import { api } from "@/lib/api";
import type { Drop } from "@/types/api";

export function DropPage() {
  const { dropId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const drop = useQuery({
    queryKey: ["drop", dropId],
    queryFn: () => api.get<{ drop: Drop }>(`/drops/${dropId}/`),
    enabled: Boolean(dropId),
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
        ) : drop.isError ? (
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
