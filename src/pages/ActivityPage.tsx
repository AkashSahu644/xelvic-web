import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  FileText,
  Heart,
  HeartOff,
  Image as ImageIcon,
  MessageCircle,
  Music2,
  Play,
  Podcast,
  Video,
} from "lucide-react";
import { PageHeader, Tabs } from "@/components/Page";
import { AuthedImage } from "@/components/Media";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/States";
import { api } from "@/lib/api";
import { relativeTime } from "@/lib/format";
import type { ActivityData, ActivityThing, Drop, Track } from "@/types/api";

type Tab = "felt" | "responded";

function labelFor(thing: ActivityThing) {
  if (thing.drop) return thing.kind === "vibe" ? "Vibe" : "Drop";
  if (thing.track) return thing.track.kind === "podcast" ? "Podcast" : "Song";
  return "Thing";
}

function titleFor(thing: ActivityThing) {
  if (thing.drop) return thing.drop.mine ? "You" : thing.drop.author?.name || thing.drop.author?.username || "Somebody";
  if (thing.track) return thing.track.kind === "podcast" ? thing.track.series || thing.track.title : thing.track.title;
  return "";
}

function lineFor(thing: ActivityThing) {
  if (thing.drop) return thing.drop.body?.trim() ?? "";
  if (thing.track) {
    if (thing.track.kind === "podcast") {
      return [thing.track.series, thing.track.artist].filter(Boolean).join(" · ");
    }
    return thing.track.artist;
  }
  return "";
}

function Leading({ thing }: { thing: ActivityThing }) {
  const drop: Drop | undefined = thing.drop;
  const track: Track | undefined = thing.track;
  const image = track?.cover_url ?? track?.cover?.thumbnail_url ?? track?.cover?.content_url ?? drop?.asset?.thumbnail_url;

  if (image) {
    return (
      <AuthedImage
        src={image}
        alt=""
        className="size-[66px] shrink-0 rounded-[18px] object-cover"
      />
    );
  }

  const Icon = track
    ? track.kind === "podcast"
      ? Podcast
      : Music2
    : drop?.kind === "vibe"
      ? Play
      : drop?.kind === "video"
        ? Video
        : drop?.kind === "poll"
          ? FileText
          : drop?.kind === "note"
            ? FileText
            : ImageIcon;

  return (
    <span className="flex size-[66px] shrink-0 items-center justify-center rounded-[18px] bg-[color-mix(in_srgb,var(--ink)_6%,var(--card))] text-[color-mix(in_srgb,var(--ink)_34%,transparent)]">
      <Icon className="size-[26px]" aria-hidden />
    </span>
  );
}

export function ActivityPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<Tab>("felt");
  const activity = useQuery({
    queryKey: ["activity", "mine"],
    queryFn: () => api.get<ActivityData>("/drops/mine/activity/"),
  });
  const rows = (tab === "felt" ? activity.data?.liked : activity.data?.said) ?? [];

  function open(thing: ActivityThing) {
    if (thing.drop) {
      if (thing.drop.kind === "vibe" || thing.kind === "vibe") {
        navigate(`/app/drops?vibe=${encodeURIComponent(thing.drop.id)}`);
      } else {
        navigate(`/app/drops/${thing.drop.id}`);
      }
      return;
    }
    if (thing.track) navigate("/app/audio");
  }

  return (
    <div className="min-h-dvh pb-[calc(92px+env(safe-area-inset-bottom,0px))] md:pb-24">
      <PageHeader title="Felt & responded" back>
        <div className="mx-auto w-full max-w-[720px] px-3 pb-2 sm:px-4">
          <Tabs
            tabs={[
              { key: "felt", label: "Felt" },
              { key: "responded", label: "Responded" },
            ]}
            value={tab}
            onChange={(next) => setTab(next as Tab)}
          />
        </div>
      </PageHeader>

      <div className="mx-auto w-full max-w-[720px] px-3 pb-8 pt-3 sm:px-4">
        {activity.isLoading ? (
          <PageSkeleton />
        ) : activity.isError ? (
          <div className="card">
            <ErrorState error={activity.error} onRetry={() => void activity.refetch()} />
          </div>
        ) : !rows.length ? (
          tab === "felt" ? (
            <EmptyState
              icon={<HeartOff className="size-6" />}
              title="Nothing felt yet"
              body="Drops, Vibes and songs you heart show up here — so you can find your way back to them."
            />
          ) : (
            <EmptyState
              icon={<MessageCircle className="size-6" />}
              title="You have not responded anywhere"
              body="The Drops and Vibes you leave a line on gather here."
            />
          )
        ) : (
          <div className="overflow-hidden rounded-[18px] border border-line bg-card">
            {rows.map((thing, index) => (
              <button
                key={`${thing.kind}-${thing.drop?.id ?? thing.track?.id ?? index}`}
                type="button"
                onClick={() => open(thing)}
                className="flex w-full items-start gap-3 border-b border-line/60 px-3.5 py-2.5 text-left transition last:border-0 hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
              >
                <Leading thing={thing} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[15px] font-bold leading-[1.15]">{titleFor(thing)}</span>
                  {lineFor(thing) ? (
                    <span className="mt-1 line-clamp-2 block text-[13px] leading-[1.3] text-[color-mix(in_srgb,var(--ink)_72%,transparent)]">
                      {lineFor(thing)}
                    </span>
                  ) : null}
                  <span className="mt-1.5 block text-[11.5px] font-semibold text-dim">
                    {labelFor(thing)}
                    {thing.at ? ` · ${relativeTime(thing.at)}` : ""}
                  </span>
                </span>
                {thing.kind === "track" || thing.track ? (
                  <Play className="mt-5 size-4 shrink-0 text-dim" aria-hidden />
                ) : thing.kind === "vibe" || thing.drop?.kind === "vibe" ? (
                  <Play className="mt-5 size-4 shrink-0 text-dim" aria-hidden />
                ) : (
                  <Heart className="mt-5 size-4 shrink-0 text-dim" aria-hidden />
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
