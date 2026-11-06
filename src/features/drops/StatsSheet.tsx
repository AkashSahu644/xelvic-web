import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Eye, Heart, MessageCircle, Share2, StickyNote } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Modal } from "@/components/overlays/Modal";
import { dropsService } from "@/services/drops.service";
import { count, relativeTime } from "@/utils/format";
import { errorMessage } from "@/utils/errors";
import type { Drop } from "@/types/api";
import { dropBase, dropIsVibe } from "./model";
import { VibeStudioRead } from "./VibeStudio";

interface Stats {
  views: number;
  likes: number;
  comments: number;
  notes: number;
  shares: number;
  share_targets: { where: string; target: string; count: number }[];
}

/**
 * What a post did, on its own author's phone — and now on their page.
 *
 * `GET /drops/{id}/stats/` is author-only and says so; it is refused for
 * anybody else with `not_yours`, which is why the ⋮ only offers this row on a
 * post that is mine. The numbers are counted live off the same tables the card
 * reads, so the sheet and the card can never disagree.
 *
 * `share_targets` is the same rows grouped by where they went, and it is drawn
 * as its own small list under the Shares number — a share into a convo says
 * "in chats" and never which convo, because that conversation is somebody
 * else's, and a sheet share names the app the *device* reported or says that it
 * did not say. Two rows that are one app to a reader are one row, which is why
 * the labels are counted together before they are sorted.
 *
 * Under the numbers, who felt it — one list and not three chips. The app had
 * felt / replies / watched and the owner asked for the last one gone on
 * 2026-10-23, because a list of people who merely looked is a list of nothing
 * they chose to do.
 */
export function StatsSheet({
  drop,
  open,
  onClose,
}: {
  drop: Drop;
  open: boolean;
  onClose: () => void;
}) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [trouble, setTrouble] = useState<string | null>(null);
  const base = dropBase(drop);
  const mine = Boolean(drop.mine) && dropIsVibe(drop);

  // A Vibe of mine draws the studio's own read — the same widget the studio's
  // page draws, and not a copy of it, because a second set of numbers written
  // for the sheet would be a second reading of the same fields and would drift
  // from the first the moment either changed. See `_VibeStats`.
  const studio = useQuery({
    queryKey: ["vibe-studio-item", drop.id],
    enabled: open && mine,
    queryFn: () => dropsService.studioItem(drop.id),
  });
  const studioTrouble = studio.isError ? errorMessage(studio.error) : null;

  useEffect(() => {
    if (!open) return;
    let live = true;
    setStats(null);
    setTrouble(null);
    void dropsService
      .stats<Stats>(base, drop.id)
      .then((answer) => {
        if (live) setStats(answer);
      })
      .catch((error) => {
        if (live) setTrouble(errorMessage(error));
      });
    return () => {
      live = false;
    };
  }, [open, base, drop.id]);

  const breakdown = shareBreakdown(stats?.share_targets ?? []);

  // The share breakdown is the same list on both readings; only what stands
  // over it differs.
  const shared = breakdown.length ? (
    <div className="px-4 pt-1">
      {breakdown.map((row) => (
        <div key={row.label} className="flex items-center py-1 ps-10">
          <span className="flex-1 text-[13px] text-dim">{row.label}</span>
          <span className="num text-[13px] font-semibold text-dim">{count(row.value)}</span>
        </div>
      ))}
    </div>
  ) : null;

  return (
    <Modal open={open} onClose={onClose} title="Statistics" size="sm">
      {mine ? (
        studioTrouble ? (
          <p className="px-4 py-6 text-[14px] text-dim">{studioTrouble}</p>
        ) : !studio.data ? (
          <div className="space-y-3 px-4 py-6" aria-hidden>
            {[0, 1, 2, 3, 4].map((row) => (
              <div key={row} className="skeleton h-6 w-full rounded-full" />
            ))}
          </div>
        ) : (
          <div className="pb-4">
            <div className="px-4">
              <VibeStudioRead item={studio.data.item} days={studio.data.days} />
            </div>
            {shared}
            <AudienceList drop={drop} open={open} />
          </div>
        )
      ) : trouble ? (
        <p className="px-4 py-6 text-[14px] text-dim">{trouble}</p>
      ) : !stats ? (
        <div className="space-y-3 px-4 py-6" aria-hidden>
          {[0, 1, 2, 3, 4].map((row) => (
            <div key={row} className="skeleton h-6 w-full rounded-full" />
          ))}
        </div>
      ) : (
        <div className="pb-4">
          <StatRow icon={<Eye className="size-[22px]" />} label="Views" value={stats.views} />
          <StatRow icon={<Heart className="size-[22px]" />} label="Felt" value={stats.likes} />
          <StatRow icon={<MessageCircle className="size-[22px]" />} label="Comments" value={stats.comments} />
          <StatRow icon={<StickyNote className="size-[22px]" />} label="Notes" value={stats.notes} />
          <StatRow icon={<Share2 className="size-[22px]" />} label="Shares" value={stats.shares} />

          {shared}

          <AudienceList drop={drop} open={open} />
        </div>
      )}
    </Modal>
  );
}

function StatRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="flex items-center gap-4 px-4 py-2.5">
      <span className="text-ink" aria-hidden>
        {icon}
      </span>
      <span className="flex-1 text-[15px] font-semibold">{label}</span>
      <span className="num text-[16px] font-bold">{count(value)}</span>
    </div>
  );
}

/**
 * The apps the device named — the phone's own identifiers, and the names this
 * app knows them by. A name that is not here is drawn as "Another app" rather
 * than as a line of dots: the package is a fact the server keeps, not a word a
 * person should have to read.
 *
 * This is a list of what has already been reported, never a guess at what a
 * browser could share to.
 */
const APP_NAMES: Record<string, string> = {
  "com.xelvic.app": "Xelvic",
  "com.whatsapp": "WhatsApp",
  "com.whatsapp.w4b": "WhatsApp Business",
  "com.instagram.android": "Instagram",
  "com.facebook.katana": "Facebook",
  "com.facebook.orca": "Messenger",
  "org.telegram.messenger": "Telegram",
  "com.google.android.gm": "Gmail",
  "com.google.android.apps.messaging": "Messages",
  "com.android.mms": "Messages",
  "com.snapchat.android": "Snapchat",
  "com.twitter.android": "X",
  "com.linkedin.android": "LinkedIn",
  "com.pinterest": "Pinterest",
  "com.microsoft.teams": "Teams",
  "com.discord": "Discord",
  "com.Slack": "Slack",
  "com.google.android.youtube": "YouTube",
  "com.google.android.apps.docs": "Drive",
  "com.reddit.frontpage": "Reddit",
  "com.apple.UIKit.activity.Message": "Messages",
  "com.apple.UIKit.activity.Mail": "Mail",
  "com.apple.UIKit.activity.AirDrop": "AirDrop",
  "com.apple.UIKit.activity.PostToFacebook": "Facebook",
};

/** Where the shares went, most used first and alphabetical where two are tied. */
function shareBreakdown(rows: { where: string; target: string; count: number }[]) {
  const titled = new Map<string, number>();
  for (const row of rows) {
    const label =
      row.where === "chat"
        ? "In chats"
        : row.where === "moment"
          ? "On moments"
          : APP_NAMES[row.target] ?? "Another app";
    titled.set(label, (titled.get(label) ?? 0) + row.count);
  }
  return [...titled.entries()]
    .map(([label, value]) => ({ label, value }))
    .sort((a, b) => (b.value - a.value !== 0 ? b.value - a.value : a.label.localeCompare(b.label)));
}

/**
 * Who felt it — one page at a time, and one list.
 *
 * The totals above the faces are the server's own, split into people I keep and
 * everybody else, which is the one split a creator can act on. The list is
 * `?of=likes` and nothing else: the app's three chips became one when the owner
 * asked for the "who watched" list gone, and a single tick that can never be
 * turned off is a control that does nothing — so there are no chips here either.
 */
function AudienceList({ drop, open }: { drop: Drop; open: boolean }) {
  const base = dropBase(drop);
  const query = useInfiniteQuery({
    queryKey: ["drop-audience", base, drop.id],
    enabled: open,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) =>
      dropsService.audience(base, drop.id, pageParam ?? null),
    getNextPageParam: (last) => last.next,
  });

  const pages = query.data?.pages ?? [];
  const first = pages[0];
  const people = pages.flatMap((page) => page.people);

  // One more page when the foot of the list comes into view, which is the same
  // rule the feed's own endless scroll keeps.
  const foot = useRef<HTMLDivElement | null>(null);
  const { hasNextPage, isFetchingNextPage, fetchNextPage } = query;
  useEffect(() => {
    const node = foot.current;
    if (!node || !hasNextPage || isFetchingNextPage) return;
    const watcher = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting) void fetchNextPage();
    });
    watcher.observe(node);
    return () => watcher.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, people.length]);

  return (
    <div className="px-4 pt-2.5">
      <p className="text-[15px] font-bold">Who felt it</p>
      <div className="mt-2.5">
        {query.isLoading ? (
          <div className="space-y-2 py-2" aria-hidden>
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex items-center gap-3">
                <div className="skeleton size-9 rounded-full" />
                <div className="skeleton h-3 w-32 rounded-full" />
              </div>
            ))}
          </div>
        ) : query.isError ? (
          <p className="py-2.5 text-[12.5px] text-dim">{errorMessage(query.error)}</p>
        ) : !first ? null : first.total === 0 ? (
          <p className="py-1 text-[12px] font-semibold text-dim">Nobody yet</p>
        ) : (
          <>
            <p className="text-[12px] font-semibold text-dim">
              {`${peopleWord(first.total)} · ${count(first.crew)} crew · ${count(first.others)} others`}
            </p>
            <div className="mt-2 space-y-0.5">
              {people.map((entry) => (
                <Link
                  key={entry.person.id}
                  to={`/app/u/${entry.person.username}`}
                  className="flex items-center gap-3 rounded-[10px] py-1.5 transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
                >
                  <Avatar user={entry.person} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-bold">
                      {entry.person.name || entry.person.username}
                    </span>
                    <span className="block truncate text-[11.5px] text-dim">
                      @{entry.person.username}
                    </span>
                  </span>
                  <span className="shrink-0 text-[11px] text-dim">{relativeTime(entry.last)}</span>
                </Link>
              ))}
            </div>
            {query.hasNextPage ? <div ref={foot} className="h-4" aria-hidden /> : null}
            {query.isFetchingNextPage ? (
              <div className="py-2 text-center text-[11.5px] text-dim">More…</div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function peopleWord(value: number) {
  return value === 1 ? "1 person" : `${count(value)} people`;
}