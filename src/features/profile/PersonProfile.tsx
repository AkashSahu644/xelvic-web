import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import {
  ArrowLeft,
  Clock,
  ExternalLink,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  MoreVertical,
  Plus,
  QrCode,
  UserMinus,
  UserPlus,
  Users,
  VolumeX,
  Flag,
  X,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { AuthedImage } from "@/components/Media";
import { Blank } from "@/components/Blank";
import { ConfirmDialog, Modal } from "@/components/Modal";
import { PageSkeleton } from "@/components/States";
import { VerifiedTick } from "@/components/Tick";
import { MomentViewer } from "@/features/moments/MomentViewer";
import { BirthdayFall } from "@/features/profile/BirthdayFall";
import { MemoriesShelf } from "@/features/profile/MemoriesShelf";
import {
  FaceButton,
  FaceDialog,
  Floating,
  MutualStrip,
  MutualsModal,
  SheetRow,
  Stat,
} from "@/features/profile/parts";
import { PosedBio } from "@/features/profile/PosedBio";
import { ProfileShelf } from "@/features/profile/ProfileShelf";
import { ProfessionalLead, ProfessionalPill, linkPillIcon } from "@/features/professional/parts";
import { linkLabel } from "@/features/professional/model";
import { api } from "@/lib/api";
import { useAuth } from "@/providers/AuthProvider";
import { usePreferences } from "@/providers/PreferencesProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { useToast } from "@/providers/ToastProvider";
import type { ChatGate, Moment, MomentTray, Profile, Relation, UserCard } from "@/types/api";

/**
 * Somebody else's profile.
 *
 * Ported from `app/lib/screens/person.dart`, and it is deliberately a different
 * page from the one that reads my own account: no privacy pill, no taps on the
 * numbers, no way in to Insights, no card that makes a Memory, and the controls
 * for what is between us float down the right-hand side instead. The app keeps
 * the two screens apart for exactly that reason, and the two do not describe one
 * person two ways — the trade over the name, the line under it, the numbers and
 * the era are drawn in the same order in the same words on both.
 *
 * **The gate speaks for this page.** What I may do with this person — keep them,
 * ask, withdraw, unblock, send one line or open a convo — is decided by the
 * server and arrives as a mode with its own words on it. Nothing here invents a
 * control the gate did not offer; the one synthesis is the app's own, spelled
 * out in `askControl` below, and it only ever fills a silence.
 *
 * **What is not mine to see is not drawn at all.** A private account that has
 * not let me in sends no Drops count, no Sparks count, no shelf and no
 * Memories, and `can_view` carries that one answer for all four — so the page
 * never flashes counters it then takes away. An absent number is not drawn as a
 * dash here; a dash was a column saying *there is a number and you may not read
 * it*, which is the thing the switches exist to prevent.
 */

/** The band's geometry, from `profile.dart`'s own constants. */
const COVER_HEIGHT = 210;
const COVER_RADIUS = 32;
const PHOTO_SIZE = 92;
/** Where the head starts: the band less the 74 points the face hangs over it. */
const BODY_TOP = COVER_HEIGHT - 74;

/** What a write to this person answers with. See `social.views.PeopleView.state`. */
interface PeopleState {
  user?: UserCard;
  relation: Relation;
  gate: ChatGate | null;
  cta: string | null;
}

/** The mark for a gate's action, from the server's own name for it. */
function gateIcon(hint: string | null | undefined, className = "size-[19px]") {
  const Mark =
    {
      plus: Plus,
      clock: Clock,
      lock: Lock,
      user: UserPlus,
    }[String(hint ?? "")] ?? MoreHorizontal;
  return <Mark className={className} aria-hidden />;
}

export function PersonProfile() {
  const { username = "" } = useParams();
  const { user } = useAuth();
  const { design } = useTheme();
  const { t } = usePreferences();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [state, setState] = useState<PeopleState | null>(null);
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] = useState("spam");
  const [muted, setMuted] = useState<boolean | null>(null);
  const [going, setGoing] = useState<{ url: string; word: string } | null>(null);
  const [qr, setQr] = useState(false);
  const [mutuals, setMutuals] = useState(false);

  const answer = useQuery({
    queryKey: ["profile", username],
    queryFn: () => api.get<Profile>(`/auth/users/${encodeURIComponent(username)}/`),
    enabled: Boolean(username),
    // A deleted account is answered with a 410 and its own name for the
    // refusal; asking twice would only get the same answer.
    retry: (count, error) =>
      (error as { status?: number }).status !== 410 && count < 2,
  });

  const profile = answer.data;
  const isMe = Boolean(profile?.relation?.self || (user && profile?.id === user.id));
  const relation = state?.relation ?? profile?.relation ?? null;
  const gate = state?.gate ?? profile?.gate ?? null;
  const personId = String(profile?.id ?? "");

  /**
   * Tell the server somebody opened this page.
   *
   * The app fires this on the way into a profile — see `Insights.visited` — and
   * it is the only thing on the web that feeds the *Page views* and *People
   * reached* numbers on the owner's Insights screen. It is a `POST` because it
   * writes, and it is deliberately fire-and-forget: a visit that fails to record
   * is a missing number on somebody's dashboard, which is not a reason for the
   * page behind it to fail to open. Opening my own page is not a visit, which
   * the server refuses on its own side too.
   */
  const visited = useRef<string | null>(null);
  useEffect(() => {
    if (!personId || isMe || visited.current === personId) return;
    visited.current = personId;
    void api.post(`/social/users/${personId}/view/`, {}).catch(() => {
      // Swallowed on purpose — see above.
    });
  }, [personId, isMe]);

  const deleted = (answer.error as { status?: number } | null)?.status === 410;

  /**
   * Whether their day is up right now, and whether I have watched it.
   *
   * The app asks its `Moments` store — the rail that is already in memory — and
   * the web has no such store, so this asks the same question of the same
   * endpoint the rail is built from. The key is the moments page's own, so a
   * reader who has just come from there pays nothing for it, and the row for
   * this person is found by id rather than fetched one profile at a time.
   *
   * It is asked only where a ring could be drawn: their page, not mine (the
   * app gives my own page no ring either), and not behind a wall I cannot see
   * over. A failed ask is a page without a ring, never a page without a face.
   */
  const tray = useQuery({
    queryKey: ["moments-tray"],
    queryFn: () => api.get<MomentTray>("/moments/tray/"),
    enabled: !isMe && Boolean(personId) && !deleted,
    staleTime: 30_000,
    retry: false,
  });
  const liveRow = useMemo(
    () =>
      [...(tray.data?.unseen ?? []), ...(tray.data?.seen ?? [])].find(
        (row) => row.author?.id === personId,
      ),
    [tray.data, personId],
  );

  /** Their day, once it has been fetched — the walk the viewer plays. */
  const [day, setDay] = useState<Moment[] | null>(null);
  const [dayBusy, setDayBusy] = useState(false);
  const [faceOpen, setFaceOpen] = useState(false);

  const links = useMemo(() => profile?.links ?? [], [profile?.links]);
  const open = profile?.is_private ? t("private") : t("public");
  const handle = profile?.username ?? username;
  const name = profile?.name || handle;
  const trading = profile?.is_company ? String(profile?.category ?? "").trim() : "";

  const birthdayToday = Boolean(profile?.birthday) && profile?.birthday === todayMonthDay();

  const following = relation?.following === true;
  const blocked = relation?.blocked_by_me === true || relation?.blocked_me === true;
  const isPublic = profile?.is_private !== true;
  const canKeep = isPublic && !blocked && !isMe;
  const canSend = gate?.can_send === true;
  const cta = gate?.cta ?? state?.cta ?? null;
  const action = gate?.action ?? null;

  /**
   * The ask the gate is not naming, read off the relation instead.
   *
   * A private account's follow lives on the gate — it draws the request, the
   * wait and the refusal, and this page draws whatever the gate offers. But the
   * gate only speaks while the chat mode follows it, and a real convo turns the
   * mode `OPEN` and pins it there, while an `OPEN` gate carries no cta at all.
   * Unfriending a private account I have talked to is exactly that state: the
   * relation goes back to `none`, the convo stays open, the gate goes silent —
   * and without this the page would offer no way to ask again, on the one
   * account where asking again is the only way back in.
   *
   * Null wherever the gate itself has something to say, so the two can never
   * draw two controls for one ask.
   */
  const ask = useMemo(() => {
    if (isPublic || blocked || isMe || following) return null;
    const followState = String(relation?.follow_state ?? "");
    if (followState === "requested") {
      return { label: t("Withdraw"), icon: gateIcon("clock"), action: "withdraw" };
    }
    if (followState === "none") {
      return { label: t("Send request"), icon: gateIcon("user"), action: "request" };
    }
    // `declined`, and anything the server adds later: a closed door, and one
    // this page should not be the one to lean on.
    return null;
  }, [isPublic, blocked, isMe, following, relation?.follow_state, t]);
  function apply(next: PeopleState) {
    setState(next);
    queryClient.setQueryData<Profile>(["profile", username], (current) =>
      current
        ? {
            ...current,
            relation: next.relation,
            gate: next.gate,
            cta: next.cta,
            ...(next.user ?? {}),
          }
        : current,
    );
  }

  /** The gate hands back an action name; each one is a single endpoint. */
  async function act(what: string) {
    if (!profile || busy) return;
    setBusy(true);
    try {
      const path = `/social/users/${profile.id}/`;
      const next =
        what === "unfollow"
          ? await api.delete<PeopleState>(`${path}follow/`)
          : what === "withdraw"
            ? await api.post<PeopleState>(`${path}withdraw/`)
            : what === "unblock"
              ? await api.delete<PeopleState>(`${path}block/`)
              : await api.post<PeopleState>(`${path}follow/`);
      apply(next);
      await queryClient.invalidateQueries({ queryKey: ["profile", username] });
      await queryClient.invalidateQueries({ queryKey: ["feed"] });
      await queryClient.invalidateQueries({ queryKey: ["profile-shelf"] });
    } catch (error) {
      toast({
        title: t("That did not work"),
        description: error instanceof Error ? error.message : t("Try again."),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  /** The convo, opened — or the gate's own sentence about why it cannot be. */
  async function message() {
    if (!profile || busy) return;
    setBusy(true);
    try {
      const result = await api.post<{ thread?: { id: string } | null; gate?: ChatGate }>(
        "/chat/threads/",
        { user: profile.id },
      );
      if (result.thread?.id) {
        navigate(`/app/convo/${result.thread.id}`);
      } else if (result.gate) {
        toast({
          title: result.gate.title || t("This convo is closed"),
          description: result.gate.text || t("You cannot message this account right now."),
          tone: "info",
        });
      }
    } catch (error) {
      toast({
        title: t("Could not open the convo"),
        description: error instanceof Error ? error.message : t("Try again."),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  /**
   * Open their day, over the page.
   *
   * The app hands the viewer a walk it already holds; the web holds only the
   * rail's covers, so the day itself is one read when it is wanted and not
   * before — the same `/moments/users/<handle>/` the moments page opens a rail
   * card with. The tray is asked again on the way out, because watching is what
   * turns the bright ring quiet, and a ring that stayed bright over a day I had
   * just watched would be the page telling me I had not.
   */
  async function openDay() {
    if (!handle || dayBusy) return;
    setDayBusy(true);
    try {
      const response = await api.get<{ moments?: Moment[] }>(
        `/moments/users/${encodeURIComponent(handle)}/`,
      );
      if (response.moments?.length) {
        setDay(response.moments);
      } else {
        // Answered rather than assumed: a rail row can be a minute older than
        // the moment it names, and "there is nothing there" is the server's
        // sentence, not this page's guess.
        toast({ title: t("Nothing is up right now"), tone: "info" });
        await tray.refetch();
      }
    } catch (error) {
      toast({
        title: t("Could not open those moments"),
        description: error instanceof Error ? error.message : t("Try again."),
        tone: "error",
      });
    } finally {
      setDayBusy(false);
    }
  }

  async function mutePosts() {
    if (!profile) return;
    const next = !(muted ?? false);
    try {
      await api.post(`/drops/mute/${profile.id}/`, { on: next });
      setMuted(next);
      setMenu(false);
      toast({ title: next ? t("Posts muted") : t("Posts unmuted"), tone: "success" });
    } catch (error) {
      toast({
        title: t("Could not change that"),
        description: error instanceof Error ? error.message : t("Try again."),
        tone: "error",
      });
    }
  }

  async function report() {
    if (!profile) return;
    try {
      await api.post("/social/report/", { target_user: profile.id, reason: reportReason });
      setReportOpen(false);
      setMenu(false);
      toast({ title: t("Report sent"), description: t("Thank you. We will look at it."), tone: "success" });
    } catch (error) {
      toast({
        title: t("Could not send the report"),
        description: error instanceof Error ? error.message : t("Try again."),
        tone: "error",
      });
    }
  }

  if (answer.isLoading) {
    return (
      <div className="mx-auto max-w-[760px] px-4 py-4">
        <PageSkeleton rows={4} />
      </div>
    );
  }

  /**
   * A deleted account shows nothing of itself — not a cached face, not a count,
   * not a shelf. The one line the backend hands back is drawn over the app's own
   * empty state, with the way out kept where it always is so the back gesture
   * and the disc agree.
   */
  if (deleted) {
    return (
      <div className="relative isolate mx-auto w-full max-w-[760px] pb-24">
        <Blank
          top="pt-[140px]"
          icon={<Users className="size-[46px]" />}
          title={t("This account is deleted.")}
          line={t("There is nothing here to see.")}
        />
        <div className="absolute inset-x-0 top-0 z-20 p-3">
          <Floating
            icon={<ArrowLeft className="size-[19px]" />}
            label={t("Back")}
            onTap={() => (window.history.length > 1 ? navigate(-1) : navigate("/app/drops"))}
          />
        </div>
      </div>
    );
  }

  if (answer.isError || !profile) {
    return (
      <div className="mx-auto max-w-[600px] px-4 py-10">
        <Blank
          top="pt-16"
          icon={<Users className="size-[46px]" />}
          title={t("No such account")}
          line={t("That username is not here.")}
          action={
            <button type="button" className="btn btn-secondary mt-4" onClick={() => navigate("/app/search")}>
              {t("Search people")}
            </button>
          }
        />
      </div>
    );
  }

  const canView = profile.can_view !== false;
  const restFilled = Boolean(
    String(profile.address ?? "").trim() ||
      String(profile.contact_email ?? "").trim() ||
      links.some((row) => String(row.url ?? "").trim()),
  );

  /**
   * Their numbers, and only the ones that are mine to read.
   *
   * Drops comes and goes with the gate: over a wall, the number of things behind
   * it is a description of what I may not see. Crew and Sparks each come and go
   * with the account's own switch, which the server honours by sending nothing
   * rather than a nought — a dash was still a column, still a stat saying *there
   * is a number here and you may not read it*, which is the thing the switch
   * exists to prevent. A locked private account that also hid both has no
   * numbers at all, and an empty row would still hold a line of blank page where
   * the counts were.
   */
  const counts: { label: string; value?: number | null }[] = [];
  if (canView) counts.push({ label: t("Drops"), value: profile.posts_count });
  if (profile.followers_count !== null && profile.followers_count !== undefined) {
    counts.push({ label: t("Crew"), value: profile.followers_count });
  }
  if (canView && profile.sparks_count !== null && profile.sparks_count !== undefined) {
    counts.push({ label: t("Sparks"), value: profile.sparks_count });
  }

  return (
    <div className="relative isolate mx-auto w-full max-w-[760px] pb-[calc(100px+env(safe-area-inset-bottom,0px))] md:pb-16">
      {/* The band leads the page rather than standing behind it, so the whole
          page scrolls as one. Their own cover leads, and where they never put
          one up the theme's art fills the band rather than a bare tint — the
          same ground my own page stands on. */}
      <div
        className="absolute inset-x-0 top-0 overflow-hidden bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
        style={{
          height: COVER_HEIGHT,
          borderBottomLeftRadius: COVER_RADIUS,
          borderBottomRightRadius: COVER_RADIUS,
        }}
      >
        {profile.cover ? (
          <>
            <AuthedImage
              src={profile.cover}
              alt=""
              className="h-full w-full"
              imgClassName="h-full w-full"
            />
            {/* A single-tone scrim rather than a gradient: a busy photograph and
                the discs floating over it have to stay readable. */}
            <span className="absolute inset-0 bg-[color-mix(in_srgb,#13131A_18%,transparent)]" />
          </>
        ) : design.coverArt ? (
          <img src={design.coverArt} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>

      <div className="relative" style={{ paddingTop: BODY_TOP }}>
        <div className="flex flex-col items-center px-[18px]">
          {/* Their face, and the ring that says there is something of theirs to
              watch. The tap is the app's: a ringed face opens their day, a plain
              one has no day to open — and the hold is the app's too, on both,
              because somebody with nothing live is exactly the case where the
              picture is the only thing on the page to look at. The press through
              a keyboard gets the photo, since a hold has no keyboard. */}
          <FaceButton
            user={profile}
            size={PHOTO_SIZE}
            tone={liveRow ? (liveRow.seen ? "faded" : "accent") : "page"}
            label={liveRow ? t("Open their day") : t("Their photo")}
            title={t("Hold to see their photo")}
            onTap={() => {
              if (liveRow) void openDay();
              else setFaceOpen(true);
            }}
            onHold={() => setFaceOpen(true)}
          />
          <span className="h-3" />
          {/* The trade, on the line above the name: one centred stack — what
              they do, what they are called, then the handle. */}
          {trading ? (
            <>
              <ProfessionalLead trade={trading} t={t} />
              <span className="h-1" />
            </>
          ) : null}
          <span className="flex max-w-full items-center justify-center">
            <span className="truncate text-center text-[22px] font-extrabold tracking-[-0.5px]">
              {name}
            </span>
            {profile.verified ? (
              <span className="ml-1.5 flex shrink-0">
                <VerifiedTick size={18} />
              </span>
            ) : null}
          </span>
          <p className="mt-[3px] text-center text-[12.5px] text-dim">
            {t(`@${handle} · ${open}`)}
          </p>
          {/* The day that belongs to them, said under the name it belongs to —
              only on the day, because a page that mentioned a birthday the rest
              of the year would not be about a birthday. */}
          {birthdayToday ? (
            <>
              <span className="h-2.5" />
              <span className="flex max-w-full items-center gap-[7px] rounded-full border border-[color-mix(in_srgb,var(--accent)_35%,transparent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] px-3 py-[7px]">
                <BirthdayCake />
                <span className="min-w-0 truncate text-[12.5px] font-bold text-accent">
                  {t(`${name}'s birthday is today`)}
                </span>
              </span>
            </>
          ) : null}
        </div>

        {/* Every place they can be reached, directly under the handle. Nothing
            is drawn for an account that has filled none of it in: the block is
            what a professional put up on purpose, and an empty one is not a
            section of the page. */}
        {profile.is_company && restFilled ? (
          <div className="px-[18px]">
            <div className="mt-2.5 flex flex-wrap justify-center gap-2">
              {String(profile.address ?? "").trim() ? (
                // The place is a mark with no door: there is nowhere to send
                // somebody that is the same on every phone.
                <ProfessionalPill
                  bare
                  icon={<MapPin className="size-4 text-accent" aria-hidden />}
                  label={String(profile.address).trim()}
                />
              ) : null}
              {String(profile.contact_email ?? "").trim() ? (
                <ProfessionalPill
                  bare
                  icon={<Mail className="size-4 text-accent" aria-hidden />}
                  label={String(profile.contact_email).trim()}
                  onClick={() => {
                    window.location.href = `mailto:${String(profile.contact_email).trim()}`;
                  }}
                />
              ) : null}
              {links.map((row, index) => {
                const url = String(row.url ?? "").trim();
                if (!url) return null;
                const word = linkLabel(row, t("Link"));
                return (
                  <ProfessionalPill
                    key={`${url}-${index}`}
                    bare
                    icon={linkPillIcon(row.label, url)}
                    label={word}
                    onClick={() => setGoing({ url, word })}
                  />
                );
              })}
            </div>
          </div>
        ) : null}

        {/* Their numbers, as bare columns rather than a card around them: these
            are facts about the person the page is about, sitting in the head of
            it the same as on my own page. And nothing here is a tap — their
            Crew is the one list of theirs this page may not open. */}
        {counts.length > 0 ? (
          <div className="flex items-center justify-around px-[18px] pt-4">
            {counts.map((one) => (
              <Stat key={one.label} label={one.label} value={one.value} />
            ))}
          </div>
        ) : null}

        {/* The friends we share, right under the numbers they belong beside — the
            whole line a tap onto the list. Draws nothing for a stranger with
            none in common: the count comes back null or zero there. */}
        {!isMe ? (
          <div className="pt-2">
            <MutualStrip
              count={typeof profile.mutuals_count === "number" ? profile.mutuals_count : 0}
              faces={profile.mutuals}
              onOpen={() => setMutuals(true)}
            />
          </div>
        ) : null}

        {/* Their era, said by *their* character, under the numbers it has always
            followed. Whether a figure introduces them is their setting and not
            mine, so it comes off their profile rather than off my own shelf. */}
        {String(profile.bio ?? "").trim() ? (
          <div className="pt-3">
            <PosedBio
              text={String(profile.bio)}
              character={profile.character ?? null}
              show={profile.show_character !== false}
            />
          </div>
        ) : null}

        {/* The gate's card: the sentence explaining the hold on this account, in
            the server's own words. **Not** the "One line only" card — that is the
            notice telling somebody what they were about to discover anyway, and
            the owner asked for it off on 2026-10-24. The hold itself is
            unchanged; what goes is the announcement. */}
        {gate?.title && gate.text_only !== true ? (
          <div className="px-[18px] pt-4">
            <div className="rounded-[16px] border border-[color-mix(in_srgb,var(--accent)_22%,transparent)] bg-[color-mix(in_srgb,var(--accent)_8%,transparent)] p-4">
              <p className="text-[15px] font-bold">{gate.title}</p>
              {gate.text ? (
                <p className="mt-1 text-[13px] leading-[1.4] text-dim">{gate.text}</p>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Their Memories, kept where they have always been: their own strip
            above the row of tabs, not folded into it. The shelf draws nothing at
            all when there are none to show, so it costs a quiet account no room.
            No card that makes one: a Memory is theirs to put up. */}
        <div className="pt-4">
          <MemoriesShelf username={handle} mine={false} />
        </div>

        {/* Their posts, under the business between us, and drawn only when the
            gate says their things are mine to read. The shelf walls itself for a
            private account I have not been let into, and the owner asked on
            2026-10-02 for that to be *gone* rather than walled — the gate card
            above already says why in the server's own sentence, and the tabs were
            only an invitation to a door that is not going to open. */}
        {canView ? (
          <div className="pt-2">
            <ProfileShelf username={handle} mine={false} />
          </div>
        ) : null}
      </div>

      {/* The bar that was, as discs floating over the page: the way out on the
          left, and on the right a column — the ⋮ that holds what this page can
          do, and under it the convo, the keep control and their code. The code is
          always on the stack whatever the gate says, because handing somebody's
          handle to a phone in the room is not an action taken against them; the
          other two come and go with what the gate allows. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3">
        <span className="pointer-events-auto">
          <Floating
            icon={<ArrowLeft className="size-[19px]" />}
            label={t("Back")}
            onTap={() => (window.history.length > 1 ? navigate(-1) : navigate("/app/drops"))}
          />
        </span>
        <span className="pointer-events-auto flex flex-col items-end gap-2.5">
          <Floating
            icon={<MoreVertical className="size-[19px]" />}
            label={t("More")}
            onTap={() => setMenu(true)}
          />
          {canSend ? (
            <Floating
              icon={<MessageCircle className="size-[19px]" />}
              // The gate's own sentence, kept whole: 'Start one convo' rather
              // than 'Send one message', because what this gate allows is one
              // line of text and nothing after it until they answer.
              label={gate?.text_only === true ? t("Start one convo") : t("Open convo")}
              onTap={busy ? null : () => void message()}
              // Once somebody is kept, the way into the convo is the control
              // worth pointing at; before that, the Keep below is, and only one
              // disc beats at a time so the page never asks two things at once.
              pulse={following}
            />
          ) : null}
          {following ? (
            <Floating
              icon={<UserMinus className="size-[19px]" />}
              label={t("Let go")}
              onTap={busy ? null : () => void act("unfollow")}
            />
          ) : canKeep ? (
            <Floating
              icon={<Plus className="size-[19px]" />}
              label={t("Keep")}
              onTap={busy ? null : () => void act("follow")}
              // Nothing has been added yet, so this is the one thing the page is
              // asking for.
              pulse
            />
          ) : cta && action ? (
            <Floating
              icon={gateIcon(gate?.icon)}
              label={t(cta)}
              onTap={busy ? null : () => void act(action)}
              // The gate's own follow and request are the same ask as the plus:
              // this account is not added yet.
              pulse={action === "follow" || action === "request"}
            />
          ) : ask ? (
            <Floating
              icon={ask.icon}
              label={ask.label}
              onTap={busy ? null : () => void act(ask.action)}
              // Asking again after a Let go is the add. A withdrawal is a wait,
              // not an ask, so the hand in the air does not beat.
              pulse={ask.action === "request"}
            />
          ) : null}
          <Floating
            icon={<QrCode className="size-[19px]" />}
            label={t("Their QR code")}
            onTap={busy ? null : () => setQr(true)}
          />
        </span>
      </div>

      {/* And the day itself, falling down the page — balloons let go over the
          profile on the one day they belong to. Drawn over everything, and it
          takes nothing back: the layer ignores the pointer, so the discs under
          it are still buttons and the list under it still scrolls.
          Deliberately *not* over the deleted-account placeholder, which returns
          long before this — there is nobody left to wish it to. */}
      {birthdayToday ? <BirthdayFall /> : null}

      {/* The ⋮ opposite the back arrow. The app's sheet leads with a private name
          for this person and then folds a convo's own settings in behind it; the
          web has neither, so what is left is what this page can actually do. */}
      <Modal open={menu} onClose={() => setMenu(false)} size="sm" hideClose>
        <div className="py-1.5">
          <SheetRow
            icon={<VolumeX className="size-[21px]" />}
            label={muted ? t("Unmute their posts") : t("Mute their posts")}
            onClick={() => void mutePosts()}
          />
          {!isMe ? (
            <SheetRow
              icon={<Flag className="size-[21px]" />}
              label={t("Report")}
              onClick={() => {
                setMenu(false);
                setReportOpen(true);
              }}
            />
          ) : null}
        </div>
      </Modal>

      <Modal
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title={t("Report this account")}
        description={t("Tell us what is wrong. They will not be told.")}
      >
        <div className="px-5 py-4">
          <label className="text-[12px] font-bold text-dim" htmlFor="report-reason">
            {t("Reason")}
          </label>
          <select
            id="report-reason"
            value={reportReason}
            onChange={(event) => setReportReason(event.target.value)}
            className="field mt-1.5"
          >
            <option value="spam">{t("Spam")}</option>
            <option value="abuse">{t("Abuse")}</option>
            <option value="fake">{t("Fake account")}</option>
            <option value="other">{t("Something else")}</option>
          </select>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" className="btn btn-secondary" onClick={() => setReportOpen(false)}>
              {t("Cancel")}
            </button>
            <button type="button" className="btn btn-primary" onClick={() => void report()}>
              {t("Send report")}
            </button>
          </div>
        </div>
      </Modal>

      {/* Where a tap goes is worth being told before it is taken, and a link on
          somebody's profile is somebody else's address. */}
      <ConfirmDialog
        open={Boolean(going)}
        onClose={() => setGoing(null)}
        onConfirm={() => {
          const url = going?.url ?? "";
          setGoing(null);
          if (url) window.open(url, "_blank", "noopener,noreferrer");
        }}
        title={going?.word ? t(`Open ${going.word}?`) : t("Open this link?")}
        body={going ? (going.url.length <= 60 ? going.url : `${going.url.slice(0, 60)}...`) : ""}
        note={t("It opens away from Xelvic.")}
        confirmLabel={t("Open now")}
        icon={<ExternalLink className="size-5" />}
      />

      <MutualsModal
        open={mutuals}
        onClose={() => setMutuals(false)}
        personId={personId}
        personName={name}
        onPick={(person) => {
          setMutuals(false);
          navigate(`/app/u/${person.username}`);
        }}
      />

      {/* Their code, on the screen of the person who just met them. Nothing is
          asked of the server that this page has not already asked: the profile
          was read to draw the page, and the code is a drawing of one field of
          it — the same `xelvic://u/@handle` string the app writes and its own
          scanner reads back. */}
      <Modal open={qr} onClose={() => setQr(false)} size="sm" hideClose>
        <div className="relative flex flex-col items-center px-5 pb-6 pt-6">
          <button
            type="button"
            onClick={() => setQr(false)}
            aria-label={t("Close")}
            className="icon-btn absolute right-3 top-3"
          >
            <X className="size-4" />
          </button>
          <span className="flex items-center gap-2.5">
            <Avatar user={profile} size={40} />
            <span className="min-w-0 text-left">
              <span className="block truncate text-[15px] font-bold">{name}</span>
              <span className="block truncate text-[12px] text-dim">@{handle}</span>
            </span>
          </span>
          <div className="mt-4 rounded-[20px] border border-[color-mix(in_srgb,var(--accent)_30%,transparent)] bg-card p-3.5">
            {/* Drawn in the theme's accent rather than the app's near-black: the
                accent is the one colour a theme guarantees reads as text on its
                own page, which is the contrast a scanner wants off the card. */}
            <QRCodeSVG
              value={`xelvic://u/@${handle}`}
              size={200}
              level="M"
              includeMargin={false}
              fgColor="currentColor"
              bgColor="transparent"
              className="text-accent"
            />
          </div>
          <p className="mt-3.5 text-center text-[12.5px] leading-[1.4] text-dim">
            {t("Point the Xelvic scanner at this to open their profile.")}
          </p>
          <button
            type="button"
            className="btn btn-secondary mt-4"
            onClick={() => {
              void navigator.clipboard
                .writeText(`@${handle}`)
                .then(() => toast({ title: t("Handle copied"), tone: "success" }))
                .catch(() => toast({ title: t("Copy it from the page"), tone: "info" }));
            }}
          >
            {t("Copy the handle")}
          </button>
        </div>
      </Modal>

      {/* Their day, walked over the page that named them — the app's
          `_openLive`, which puts the viewer on top of the profile rather than
          leaving it. The ring is asked again as this closes, because watching
          is what makes it quiet. */}
      {day ? (
        <MomentViewer
          moments={day}
          onClose={() => {
            setDay(null);
            void tray.refetch();
          }}
          onChanged={() => {
            void tray.refetch();
          }}
        />
      ) : null}

      {/* As large as their picture goes, on a hold or — for a face with nothing
          live behind it — a tap. */}
      <FaceDialog open={faceOpen} onClose={() => setFaceOpen(false)} user={profile} />
    </div>
  );
}

/** The cake on a birthday line, drawn rather than taken from a font. */
function BirthdayCake() {
  return (
    <svg width={14} height={14} viewBox="0 0 14 14" aria-hidden className="shrink-0 text-accent">
      <path
        d="M7 1.1c.7.9 1.1 1.5 1.1 2a1.1 1.1 0 1 1-2.2 0c0-.5.4-1.1 1.1-2Z"
        fill="currentColor"
      />
      <path
        d="M2.4 6.2h9.2v1.1c0 .6-.5 1.1-1.1 1.1-.6 0-1.1-.5-1.1-1.1 0 .6-.5 1.1-1.1 1.1-.6 0-1.1-.5-1.1-1.1 0 .6-.5 1.1-1.1 1.1-.6 0-1.1-.5-1.1-1.1 0 .6-.5 1.1-1.1 1.1-.6 0-1.1-.5-1.1-1.1V6.2Z"
        fill="currentColor"
        opacity="0.45"
      />
      <rect x="2.4" y="9.2" width="9.2" height="3.4" rx="1" fill="currentColor" />
    </svg>
  );
}

/** Today as `MM-DD`, which is the shape the server sends a birthday in. */
function todayMonthDay(): string {
  const now = new Date();
  return `${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}
