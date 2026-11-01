import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  BarChart3,
  ImagePlus,
  LoaderCircle,
  PenLine,
  Plus,
  Sparkles,
  UserRound,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Button } from "@/components/Button";
import { AuthedImage } from "@/components/Media";
import { PageHeader } from "@/components/Page";
import { EmptyState } from "@/components/States";
import { CameraCapture } from "@/features/camera/CameraCapture";
import { AddToMemories } from "@/features/moments/AddToMemories";
import { ComposeMoment } from "@/features/moments/ComposeMoment";
import { MomentViewer } from "@/features/moments/MomentViewer";
import { PollMoment } from "@/features/moments/PollMoment";
import { ShareMoment, type MomentPick } from "@/features/moments/ShareMoment";
import { TextMoment } from "@/features/moments/TextMoment";
import { momentRingFor, momentStill, railStill } from "@/features/moments/rail";
import { FaceDialog, SheetRow } from "@/features/profile/parts";
import { SensitiveVeil } from "@/features/drops/SensitiveVeil";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/errors";
import { useAuth } from "@/providers/AuthProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { useToast } from "@/providers/ToastProvider";
import { Modal } from "@/components/Modal";
import type { Asset, Moment, MomentTray, TrayMoment, UserCard } from "@/types/api";

/**
 * The Moments tab: the rail, and the three doors that put something on it.
 *
 * The rail is the page. Everything that used to sit under it — `Recent updates`,
 * `Watched`, `Your Memories` — went on 2026-09-15, because the rail already
 * carries every one of those people: the ones still to watch first, then the
 * ones watched, then the ones this reader has asked to be shown last. A list of
 * the same faces under it was the same page written twice.
 *
 * The three doors are the app's own and in the app's own order — Poll, Write,
 * Add — and each is a *door*, not a step on the way to one: a poll is not a file
 * off the roll and words are not a picture, so neither is reached by backing out
 * of the picker. Add is the only one that opens the camera, and what comes back
 * from its editor goes straight up through the one choice it cannot make for
 * itself, the reach. See `ShareMoment`, `TextMoment` and `PollMoment`.
 *
 * There is no composer on the way. The screen that used to stand here asked two
 * things that had both been answered already — which file, and whether the
 * editing was done — behind a panel of filters, crops and stickers whose
 * handlers were empty and whose Apply wrote an object URL and nothing else. It
 * is gone rather than hidden: a control that does nothing is worse than a
 * control that is not there. `?compose=1` still opens a moment put together out
 * of several pieces, for the one door in the app that leads there — the
 * "Moment" row on a drop. `?memories=1` opens Add to Memories, which is the
 * "New Memory" card at the end of my own profile's shelf: a Memory is made out
 * of moments, so the door onto making one belongs where the moments are.
 */

/** How long a press has to be held before it counts as a hold rather than a tap. */
const HOLD_MS = 480;

function MineRailCard({
  cover,
  count,
  sensitive,
  onOpen,
  onAdd,
}: {
  cover: Asset | null;
  count: number;
  sensitive: boolean;
  onOpen: () => void;
  onAdd: () => void;
}) {
  const still = cover?.thumbnail_url || cover?.content_url || null;
  return (
    <div className="w-[86px] shrink-0">
      <div className="relative">
        <button
          type="button"
          onClick={onOpen}
          className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={count ? `Your moments, ${count} up` : "Add to your moments"}
        >
          <span className="relative block h-[129px] w-full overflow-hidden rounded-[14px] bg-[color-mix(in_srgb,var(--accent)_10%,var(--card))]">
            {count ? (
              <SensitiveVeil
                sensitive={sensitive}
                cover={cover}
                note="Yours. Everybody else sees it covered."
                aspect={129 / 86}
              >
                {still ? <AuthedImage src={still} alt="Your moment" className="h-full w-full" /> : null}
              </SensitiveVeil>
            ) : null}
          </span>
          <span className="mt-1.5 block truncate text-[11.5px] text-ink">
            {count ? `${count} up` : "Your moments"}
          </span>
        </button>
        {/* The plus sits on the cover rather than beside it: the card *is* the
            way to add, and a card that only says "nothing here" is a dead end.
            Only over a cover — the empty tile is one big plus already, and a
            second, smaller one in its corner is the same button twice. */}
        {count ? (
          <button
            type="button"
            onClick={onAdd}
            className="absolute right-1 top-[105px] flex size-[22px] items-center justify-center rounded-full border-2 border-card bg-accent text-on-accent"
            aria-label="Add to your moments"
          >
            <Plus className="size-3" />
          </button>
        ) : null}
      </div>
    </div>
  );
}

function RailCard({
  row,
  ring,
  opening,
  onOpen,
  onHold,
}: {
  row: TrayMoment;
  ring: string | null;
  opening: boolean;
  onOpen: () => void;
  onHold: () => void;
}) {
  const name = row.author?.name || row.author?.username || "Moment";
  const first = name.split(" ")[0];
  const cover = railStill(row);
  const timer = useRef<number | null>(null);
  const held = useRef(false);

  const stop = () => {
    if (timer.current !== null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
  };
  useEffect(() => stop, []);

  return (
    <button
      type="button"
      onClick={() => {
        // The press that became a hold has already done its work; this click is
        // the browser finishing the same gesture, not a second one.
        if (held.current) {
          held.current = false;
          return;
        }
        onOpen();
      }}
      onContextMenu={(event) => event.preventDefault()}
      onPointerDown={() => {
        held.current = false;
        stop();
        timer.current = window.setTimeout(() => {
          held.current = true;
          onHold();
        }, HOLD_MS);
      }}
      onPointerUp={stop}
      onPointerLeave={stop}
      onPointerCancel={stop}
      disabled={opening}
      className={cn(
        "relative w-[86px] shrink-0 touch-manipulation select-none text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent",
        // Faint for the people this reader has asked to be shown last, and full
        // strength for everybody else — a watched face included, which is a
        // different statement. `silencedFade` on the phone is 0.55.
        row.silenced && "opacity-[0.55]",
      )}
      aria-label={`${first}, ${row.count ?? 1} moments${row.seen ? ", already watched" : ""}`}
    >
      <span className="relative block h-[129px] w-full overflow-hidden rounded-[14px] bg-[color-mix(in_srgb,var(--accent)_12%,var(--card))]">
        <SensitiveVeil sensitive={row.sensitive} cover={row.cover ?? null} aspect={129 / 86}>
          {cover ? <AuthedImage src={cover} alt={`${first}'s moment`} className="h-full w-full" /> : null}
        </SensitiveVeil>
        {/* The face, tucked into the corner of their day. Not drawn while the
            cover is on — the veil is over the whole tile and a face left on top
            of it would be half the picture still showing. */}
        {row.sensitive ? null : (
          <span className="absolute left-1.5 top-1.5 rounded-full bg-card p-[1.5px]">
            <Avatar user={row.author} name={name} size={26} />
          </span>
        )}
        {opening ? (
          <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-white">
            <LoaderCircle className="size-5 animate-spin" />
          </span>
        ) : null}
      </span>
      {/* A face still to watch wears the ring, in the colour they wear; a face
          that has nothing new wears nothing at all. Over the cover, so a marked
          day still says whether there is anything to open. */}
      {ring ? (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-[129px] rounded-[14px] border-[2.6px]"
          style={{ borderColor: ring }}
        />
      ) : null}
      <span className={cn("mt-1.5 block truncate text-[11.5px]", row.seen ? "text-dim" : "text-ink")}>{first}</span>
    </button>
  );
}

function MomentRail({
  mine,
  others,
  designs,
  dark,
  opening,
  onMine,
  onAdd,
  onOpen,
  onHold,
}: {
  mine: Moment[];
  others: TrayMoment[];
  designs: Parameters<typeof momentRingFor>[1];
  dark: boolean;
  opening: string | null;
  onMine: () => void;
  onAdd: () => void;
  onOpen: (row: TrayMoment) => void;
  onHold: (row: TrayMoment) => void;
}) {
  const first = mine[0];
  return (
    <div className="no-scrollbar flex gap-3 overflow-x-auto px-3.5 pb-2 pt-1 md:px-0">
      <MineRailCard
        cover={momentStill(first)}
        count={mine.length}
        sensitive={Boolean(first?.sensitive)}
        onOpen={onMine}
        onAdd={onAdd}
      />
      {others.map((row) => (
        <RailCard
          key={row.id || row.author?.username}
          row={row}
          ring={momentRingFor(row, designs, dark)}
          opening={opening === row.id}
          onOpen={() => onOpen(row)}
          onHold={() => onHold(row)}
        />
      ))}
    </div>
  );
}

export function MomentsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const { themes, shelf, resolvedDark } = useTheme();
  const [viewer, setViewer] = useState<{ moments: Moment[]; startId?: string } | null>(null);
  const [opening, setOpening] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [textOpen, setTextOpen] = useState(false);
  const [pollOpen, setPollOpen] = useState(false);
  const [picks, setPicks] = useState<MomentPick[] | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [sheetFor, setSheetFor] = useState<TrayMoment | null>(null);
  const [faceFor, setFaceFor] = useState<UserCard | null>(null);
  const [keepOpen, setKeepOpen] = useState(false);
  const [params, setParams] = useSearchParams();

  const designs = useMemo(() => [...themes, ...shelf], [themes, shelf]);

  useEffect(() => {
    if (params.get("compose") !== "1") return;
    setComposeOpen(true);
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("compose");
        return next;
      },
      { replace: true },
    );
  }, [params, setParams]);

  // "New Memory" on my own profile's shelf comes here, because a Memory is made
  // out of moments and this is where they are. The picking comes first — there
  // is no day named, so `AddToMemories` opens on what has run out its day.
  useEffect(() => {
    if (params.get("memories") !== "1") return;
    setKeepOpen(true);
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("memories");
        return next;
      },
      { replace: true },
    );
  }, [params, setParams]);

  const tray = useQuery({
    queryKey: ["moments-tray"],
    queryFn: () => api.get<MomentTray>("/moments/tray/"),
  });
  const mine = useQuery({
    queryKey: ["moments-mine"],
    queryFn: () => api.get<{ moments: Moment[]; total?: number; total_views?: number }>("/moments/mine/"),
    select: (data) => data.moments ?? [],
  });

  const mineMoments = useMemo(() => mine.data ?? [], [mine.data]);
  // `answered` leads, and on this server it is always empty — see `TrayView`,
  // which sends it empty and hands those people to the two lists behind. It is
  // drawn because the rail's own order is what it is: the ones still to watch
  // first, the watched ones after them, and the ones this reader asked to be
  // shown last at the very back.
  const others = useMemo(
    () => [
      ...(tray.data?.answered ?? []),
      ...(tray.data?.unseen ?? []),
      ...(tray.data?.seen ?? []),
      ...(tray.data?.silenced ?? []),
    ],
    [tray.data],
  );
  const hasMoments = mineMoments.length > 0 || others.length > 0;

  function refreshMoments() {
    void queryClient.invalidateQueries({ queryKey: ["moments-tray"] });
    void queryClient.invalidateQueries({ queryKey: ["moments-mine"] });
  }

  /** The "+" door: the camera, and then straight up through the reach sheet. */
  function openAdd() {
    setPicks(null);
    setCameraOpen(true);
  }

  function openMine() {
    if (mineMoments.length) {
      setViewer({ moments: mineMoments });
      return;
    }
    openAdd();
  }

  async function openTray(row: TrayMoment) {
    const username = row.author?.username || user?.username;
    if (!username) return;
    if (row.mine && mineMoments.length) {
      setViewer({ moments: mineMoments, startId: row.id });
      return;
    }
    setOpening(row.id);
    try {
      const response = await api.get<{ moments: Moment[] }>(`/moments/users/${encodeURIComponent(username)}/`);
      if (!response.moments?.length) {
        toast({ title: "That moment has already gone", tone: "info" });
        void tray.refetch();
        return;
      }
      setViewer({ moments: response.moments, startId: row.id });
    } catch (error) {
      toast({ title: "Could not open that moment", description: errorMessage(error), tone: "error" });
    } finally {
      setOpening(null);
    }
  }

  /** Show this person's day last, or put it back in the rail's own order. */
  async function toggleSilence(row: TrayMoment) {
    const author = row.author;
    if (!author) return;
    const silent = !row.silenced;
    try {
      await api.post("/moments/silence/", { user: author.id, silent });
      toast({ title: silent ? `Muted @${author.username}` : `Unmuted @${author.username}`, tone: "success" });
      refreshMoments();
    } catch (error) {
      toast({ title: "Could not reach that", description: errorMessage(error), tone: "error" });
    }
  }

  const momentOpened = useRef("");
  useEffect(() => {
    const id = params.get("moment");
    if (!id || momentOpened.current === id) return;
    momentOpened.current = id;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("moment");
        return next;
      },
      { replace: true },
    );
    setOpening(id);
    void api
      .get<{ moment: Moment }>(`/moments/${encodeURIComponent(id)}/`)
      .then(async (response) => {
        if (!response.moment) return;
        const author = response.moment.author?.username;
        if (author) {
          try {
            const day = await api.get<{ moments: Moment[] }>(`/moments/users/${encodeURIComponent(author)}/`);
            if (day.moments?.length) {
              setViewer({ moments: day.moments, startId: id });
              return;
            }
          } catch {
            // The one moment is still a real answer when the day is not.
          }
        }
        setViewer({ moments: [response.moment], startId: id });
      })
      .catch((error) => {
        toast({ title: "That moment is not there any more", description: errorMessage(error), tone: "error" });
      })
      .finally(() => setOpening(null));
  }, [params, setParams, toast]);

  const deepOpened = useRef("");
  useEffect(() => {
    const username = params.get("user");
    if (!username || deepOpened.current === username) return;
    deepOpened.current = username;
    setParams(
      (current) => {
        const next = new URLSearchParams(current);
        next.delete("user");
        return next;
      },
      { replace: true },
    );
    const row = others.find((item) => item.author?.username === username);
    if (row?.mine && mineMoments.length) {
      setViewer({ moments: mineMoments, startId: row.id });
      return;
    }
    setOpening(username);
    void api
      .get<{ moments: Moment[] }>(`/moments/users/${encodeURIComponent(username)}/`)
      .then((response) => {
        if (response.moments?.length) setViewer({ moments: response.moments, startId: row?.id });
        else toast({ title: "Nothing is up right now", tone: "info" });
      })
      .catch((error) => {
        toast({ title: "Could not open those moments", description: errorMessage(error), tone: "error" });
      })
      .finally(() => setOpening(null));
  }, [params, setParams, others, mineMoments, toast]);

  return (
    <div className="pb-[calc(92px+env(safe-area-inset-bottom,0px))] md:pb-24">
      <PageHeader
        title="Moments"
        actions={
          <>
            <button type="button" className="icon-btn" onClick={() => setPollOpen(true)} title="Ask a poll" aria-label="Ask a poll">
              <BarChart3 className="size-[18px]" />
            </button>
            <button type="button" className="icon-btn" onClick={() => setTextOpen(true)} title="Write a note" aria-label="Write a note">
              <PenLine className="size-[18px]" />
            </button>
            <button type="button" className="icon-btn" onClick={openAdd} title="Add to your moments" aria-label="Add to your moments">
              <ImagePlus className="size-[18px]" />
            </button>
          </>
        }
      />

      <div className="mx-auto w-full max-w-[760px] px-3 pt-1.5 sm:px-4 md:px-7">
        {tray.isLoading && !mineMoments.length && !others.length ? (
          <div className="no-scrollbar flex gap-3 overflow-hidden px-3.5 py-1 md:px-0" aria-hidden>
            {[0, 1, 2, 3].map((row) => (
              <div key={row} className="w-[86px] shrink-0">
                <div className="skeleton h-[129px] rounded-[14px]" />
                <div className="skeleton mt-1.5 h-2.5 w-12 rounded-full" />
              </div>
            ))}
          </div>
        ) : (
          <MomentRail
            mine={mineMoments}
            others={others}
            designs={designs}
            dark={resolvedDark}
            opening={opening}
            onMine={openMine}
            onAdd={openAdd}
            onOpen={(row) => void openTray(row)}
            onHold={(row) => setSheetFor(row)}
          />
        )}

        {!hasMoments && !tray.isLoading ? (
          <EmptyState
            icon={<Sparkles className="size-6" />}
            title={tray.isError ? "No answer from the server" : "Nothing up right now"}
            body={
              tray.isError
                ? "Your moments could not be reached. Try again in a moment."
                : "What your people put up today turns up here, and is gone tomorrow. Put something up with the card at the top."
            }
            action={
              tray.isError ? (
                <Button size="sm" variant="secondary" onClick={() => void tray.refetch()}>
                  Try again
                </Button>
              ) : undefined
            }
            className="py-12"
          />
        ) : null}
      </div>

      {/* A hold on a face in the rail: the picture, the way to their page, and
          the switch that shows their day last. One gesture on one card is how a
          reader reaches everything the card can do. */}
      <Modal open={Boolean(sheetFor)} onClose={() => setSheetFor(null)} size="sm" hideClose>
        <div className="pb-2">
          <div className="flex items-center gap-3 px-4 pb-3 pt-4">
            <Avatar user={sheetFor?.author} size={40} />
            <span className="min-w-0 flex-1 truncate text-[15.5px] font-bold">
              {sheetFor?.author?.name || sheetFor?.author?.username}
            </span>
          </div>
          <SheetRow
            icon={<UserRound className="size-5" />}
            label="View picture"
            onClick={() => {
              setFaceFor(sheetFor?.author ?? null);
              setSheetFor(null);
            }}
          />
          <SheetRow
            icon={<UserRound className="size-5" />}
            label="Visit profile"
            onClick={() => {
              const username = sheetFor?.author?.username;
              setSheetFor(null);
              if (username) navigate(`/app/u/${username}`);
            }}
          />
          <SheetRow
            icon={sheetFor?.silenced ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
            label={sheetFor?.silenced ? "Unmute" : "Mute"}
            line="Shown last on this rail."
            onClick={() => {
              const row = sheetFor;
              setSheetFor(null);
              if (row) void toggleSilence(row);
            }}
          />
        </div>
      </Modal>

      <FaceDialog open={Boolean(faceFor)} onClose={() => setFaceFor(null)} user={faceFor ?? undefined} />

      <ShareMoment
        open={Boolean(picks?.length)}
        picks={picks ?? []}
        onClose={() => setPicks(null)}
        onPosted={refreshMoments}
      />

      <TextMoment open={textOpen} onClose={() => setTextOpen(false)} onPosted={refreshMoments} />
      <PollMoment open={pollOpen} onClose={() => setPollOpen(false)} onPosted={refreshMoments} />
      <ComposeMoment open={composeOpen} onClose={() => setComposeOpen(false)} onPosted={refreshMoments} />

      {/* No `moment`, so the picking comes first: this is the "New Memory" card
          on my own profile, which is a door onto the shelf rather than onto one
          day of it. */}
      <AddToMemories
        open={keepOpen}
        onClose={() => setKeepOpen(false)}
        onDone={refreshMoments}
      />

      {viewer ? (
        <MomentViewer
          moments={viewer.moments}
          startId={viewer.startId}
          onClose={() => setViewer(null)}
          onChanged={refreshMoments}
        />
      ) : null}

      <CameraCapture
        open={cameraOpen}
        onClose={() => setCameraOpen(false)}
        onPosted={refreshMoments}
        onMediaReady={(file, kind) => {
          setCameraOpen(false);
          setPicks([{ file, kind }]);
        }}
      />
    </div>
  );
}
