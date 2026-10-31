import { Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Bookmark } from "lucide-react";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/States";
import { DropCard } from "@/features/drops/DropCard";
import { api } from "@/lib/api";
import type { Drop } from "@/types/api";

interface SavedPageData {
  drops: Drop[];
  total: number;
  shown: number;
}

export function SavedPage() {
  const queryClient = useQueryClient();
  const saved = useQuery({
    queryKey: ["saved-drops"],
    queryFn: () => api.get<SavedPageData>("/drops/saved/"),
  });

  return (
    <div className="mx-auto w-full max-w-[620px] pb-[calc(100px+env(safe-area-inset-bottom,0px))] md:pb-16">
      <header className="px-4 pb-3 pt-4 md:pt-6">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-[20px] font-extrabold tracking-tight"><Bookmark className="size-5 text-accent" /> Saved</h1>
            <p className="mt-0.5 text-[10px] text-dim">Drops you kept, newest first.</p>
          </div>
          {saved.data ? <p className="text-[10px] font-semibold text-dim">{saved.data.shown} of {saved.data.total}</p> : null}
        </div>
      </header>

      <main className="space-y-3 px-4">
        {saved.isLoading ? <PageSkeleton rows={3} /> : saved.isError ? (
          <div className="card"><ErrorState error={saved.error} onRetry={() => void saved.refetch()} /></div>
        ) : !saved.data?.drops.length ? (
          <EmptyState
            icon={<Bookmark className="size-6" />}
            title="Nothing kept yet"
            body="Tap the bookmark on a drop and it waits here for you."
            action={<Link to="/app/drops" className="btn btn-primary">Go to Drops</Link>}
          />
        ) : (
          <>
            {saved.data.drops.map((drop) => (
              <DropCard
                key={drop.id}
                drop={drop}
                onRemoved={(id) => {
                  queryClient.setQueryData<SavedPageData>(["saved-drops"], (current) => current ? {
                    ...current,
                    drops: current.drops.filter((item) => item.id !== id),
                    shown: Math.max(0, current.shown - 1),
                    total: Math.max(0, current.total - 1),
                  } : current);
                }}
                onSavedChange={(id, isSaved) => {
                  if (isSaved) return;
                  queryClient.setQueryData<SavedPageData>(["saved-drops"], (current) => current ? {
                    ...current,
                    drops: current.drops.filter((item) => item.id !== id),
                    shown: Math.max(0, current.shown - 1),
                    total: Math.max(0, current.total - 1),
                  } : current);
                }}
              />
            ))}
            {saved.data.shown < saved.data.total ? (
              <p className="px-3 pb-4 text-center text-[10px] leading-4 text-dim">The shelf shows the most recent {saved.data.shown}. Older kept drops are still on the server.</p>
            ) : null}
          </>
        )}
      </main>
    </div>
  );
}
