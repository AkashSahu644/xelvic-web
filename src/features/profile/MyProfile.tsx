import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Bookmark,
  ChevronRight,
  ChevronsUpDown,
  ExternalLink,
  Globe,
  LineChart,
  Lock,
  Mail,
  MapPin,
  MoreVertical,
  QrCode,
  Settings,
  UserRound,
} from "lucide-react";
import { Backdrop } from "@/components/layout/Backdrop";
import { AuthedImage } from "@/components/media/Media";
import { ConfirmDialog, Modal } from "@/components/overlays/Modal";
import { PrivacyConfirm } from "@/components/overlays/PrivacyConfirm";
import { VerifiedTick } from "@/components/icons/Tick";
import { BirthdayFall } from "@/features/profile/BirthdayFall";
import { isBirthdayTodayIn } from "@/features/profile/birthday";
import { MemoriesShelf } from "@/features/profile/MemoriesShelf";
import { PosedBio } from "@/features/profile/PosedBio";
import { ProfileShelf } from "@/features/profile/ProfileShelf";
import { Floating, FaceButton, FaceDialog, SheetRow, Stat } from "@/features/profile/parts";
import { ProfessionalLead, ProfessionalPill, linkPillIcon } from "@/features/professional/parts";
import { linkLabel } from "@/features/professional/model";
import { sparksService } from "@/services/sparks.service";
import { cn } from "@/utils/cn";
import { useAuth } from "@/hooks/useAuth";
import { usePreferences } from "@/hooks/usePreferences";
import { useTheme } from "@/hooks/useTheme";
import { useToast } from "@/hooks/useToast";
import { authService } from "@/services/auth.service";
import type { Me } from "@/types/api";

/**
 * My own profile — the page about me, drawn from my account rather than from
 * somebody else's copy of it.
 *
 * Ported from `app/lib/screens/profile.dart`, and it is deliberately a
 * different page from the one that reads somebody else's: this one carries the
 * privacy pill, the four counts with their taps, the way in to Insights, my
 * Memories with the card that makes one, and the three floating buttons. None
 * of that belongs on a stranger's page, and the app keeps the two screens apart
 * for exactly that reason.
 *
 * The numbers are read from `Me` and never from the profile endpoint. The app
 * makes the same choice — `_me` on this screen is the session's own account —
 * and for the same reason: my Crew and my Spark are mine to read whatever the
 * switches say, so a page that asked somebody else's endpoint would draw a
 * number that had been hidden from nobody.
 *
 * The head, the row of numbers, the floating discs and the sheet rows are
 * shared with the page about somebody else — see `profile/parts.tsx` — because
 * the two pages describe one person and the app's own copies of these have
 * already drifted apart once.
 */

/** The band's geometry, from `profile.dart`'s own constants. */
const COVER_HEIGHT = 210;
const COVER_RADIUS = 32;
const PHOTO_SIZE = 92;
/** Where the head starts: the band less the 74 points the face hangs over it. */
const BODY_TOP = COVER_HEIGHT - 74;

export function MyProfile() {
  const { user, updateUser } = useAuth();
  const { design, profileBackdrop } = useTheme();
  const { t } = usePreferences();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [menu, setMenu] = useState(false);
  const [photo, setPhoto] = useState(false);
  const [privacyGoing, setPrivacyGoing] = useState<boolean | null>(null);
  const [privacyBusy, setPrivacyBusy] = useState(false);
  /** The link a tap is asking about, before it is taken. See `openLink`. */
  const [going, setGoing] = useState<{ url: string; word: string } | null>(null);

  const me = user as Me | null;

  /**
   * The Spark, live.
   *
   * `Sparks.it.total` is the same reading the wallet and the Convo band take —
   * one request to `/sparks/`, whose `total` is the sum of every run alive
   * right now. Drawn as a dash until it has answered for the same reason a
   * hidden count is: a zero on a cold start would be a claim about how much a
   * person has been talking, made before anybody asked.
   */
  const sparks = useQuery({
    queryKey: ["sparks"],
    queryFn: () => sparksService.list(),
    enabled: Boolean(me?.id),
    retry: false,
  });

  const privateAccount = Boolean(me?.is_private);
  const handle = me?.username ?? "";
  const name = me?.name || handle;
  const birthdayToday = isBirthdayTodayIn(me);

  const trade = me?.is_company ? String(me?.category ?? "").trim() : "";
  const links = useMemo(() => me?.links ?? [], [me?.links]);
  const restFilled = Boolean(
    String(me?.address ?? "").trim() ||
      String(me?.contact_email ?? "").trim() ||
      links.some((row) => String(row.url ?? "").trim()),
  );

  /** The figure the bio is said by, and the art the band wears when I have no cover. */
  const build = useMemo(() => design, [design]);

  async function flipPrivacy(going: boolean) {
    setPrivacyGoing(null);
    if (privacyBusy) return;
    setPrivacyBusy(true);
    try {
      const answer = await authService.setPrivacy({ is_private: going });
      updateUser(answer);
      toast({
        title: going
          ? t("Private. Only people you accept can see your posts now.")
          : t("Public again. Anyone can see your posts."),
        tone: "success",
      });
      // Every shelf this moved is now describing a moment that has passed.
      await queryClient.invalidateQueries({ queryKey: ["profile-shelf"] });
    } catch (error) {
      toast({ title: error instanceof Error ? error.message : t("That did not work"), tone: "error" });
    } finally {
      setPrivacyBusy(false);
    }
  }

  if (!me) return null;

  return (
    <div className="relative isolate mx-auto w-full max-w-[760px] pb-[calc(100px+env(safe-area-inset-bottom,0px))] md:pb-16">
      {/* The page's own ground, and the lowest thing on it: a theme that drew a
          profile stands behind this whole page, the same way it stands behind
          the five the shell holds. Drawn first so the band and everything in the
          list sit on it rather than under it — and only on this page, which is
          the half of the pair the app gives one to. */}
      <Backdrop backdrop={profileBackdrop} position="absolute" />

      {/* The cover leads the page instead of standing behind it, so the whole
          page scrolls as one — the owner asked for that on 2026-09-28 ("upar
          scroll karne par cover image bhi upar jaye"). The face still hangs
          over the band's lower edge, and the head is pushed down onto it by the
          same arithmetic the fixed band used. */}
      <div
        className="absolute inset-x-0 top-0 overflow-hidden bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
        style={{ height: COVER_HEIGHT, borderBottomLeftRadius: COVER_RADIUS, borderBottomRightRadius: COVER_RADIUS }}
      >
        {me.cover ? (
          <>
            <AuthedImage src={me.cover} alt="" className="h-full w-full" imgClassName="h-full w-full" />
            {/* A single-tone scrim rather than a gradient: a busy photograph and
                the discs floating over it have to stay readable, and the photo
                is still the photo. */}
            <span className="absolute inset-0 bg-[color-mix(in_srgb,#13131A_18%,transparent)]" />
          </>
        ) : build.coverArt ? (
          <img src={build.coverArt} alt="" className="h-full w-full object-cover" />
        ) : null}
      </div>

      <div className="relative" style={{ paddingTop: BODY_TOP }}>
        <div className="flex flex-col items-center px-[18px]">
          {/* My face, and the same large photo behind it the app gives a tap
              here (`_showPhoto`). No ring: the app draws one on somebody else's
              page, where their day is news to me, and never on my own. */}
          <FaceButton
            user={me}
            size={PHOTO_SIZE}
            tone="page"
            label={t("Your photo")}
            onTap={() => setPhoto(true)}
          />
          <span className="h-3" />
          {/* The trade stands above the name: `Developer` on its own line,
              `Daudi` under it. It led the name on one line for part of
              2026-10-24, until the owner asked for it above instead. */}
          {trade ? (
            <>
              <ProfessionalLead trade={trade} t={t} />
              <span className="h-1" />
            </>
          ) : null}
          <span className="flex max-w-full items-center justify-center">
            <span className="truncate text-center text-[22px] font-extrabold tracking-[-0.5px]">{name}</span>
            {me.verified ? (
              <span className="ml-1.5 flex shrink-0">
                <VerifiedTick size={18} />
              </span>
            ) : null}
          </span>
          <p className="mt-[3px] text-center text-[12.5px] text-dim">{t(`@${handle} · you`)}</p>

          {/* What this page shows to somebody who is not me, said in one pill
              and changeable from here. A private account is the case the pill
              exists for — it is the only page that says so — but a public one
              wears it too, because the way to close the door should not be
              three taps away in Controls when the page about it is right here. */}
          <span className="h-[9px]" />
          <button
            type="button"
            disabled={privacyBusy}
            onClick={() => setPrivacyGoing(!privateAccount)}
            className={cn(
              "flex max-w-full items-center gap-[5px] rounded-full border py-[5px] pl-2.5 pr-[9px] transition",
              privateAccount
                ? "border-[color-mix(in_srgb,var(--accent)_45%,transparent)] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)] text-accent"
                : "border-line bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] text-dim",
            )}
          >
            <span
              className={cn("shrink-0", privateAccount ? "text-accent" : "text-dim")}
              aria-hidden
            >
              {privateAccount ? <Lock className="size-[13px]" /> : <Globe className="size-[13px]" />}
            </span>
            <span
              className={cn(
                "truncate text-[11.5px] font-semibold",
                privateAccount ? "text-accent" : "text-dim",
              )}
            >
              {privacyBusy
                ? t("Saving...")
                : privateAccount
                  ? t("Private · only people you accept")
                  : t("Public · anyone can see your posts")}
            </span>
            <ChevronsUpDown
              className={cn(
                "size-3 shrink-0 opacity-65",
                privateAccount ? "text-accent" : "text-dim",
              )}
              aria-hidden
            />
          </button>

          {birthdayToday ? (
            <>
              <span className="h-2.5" />
              <p className="text-center text-[12.5px] font-semibold text-accent">
                {t(`Happy birthday, ${name}!`)}
              </p>
            </>
          ) : null}
        </div>

        {/* Every place the account can be reached, directly under the handle
            rather than under the numbers and the era. The owner asked on
            2026-10-24 for the icons and links to sit under the username. The
            trade is not here — it leads the name above, so the page says it
            once. */}
        {me.is_company ? (
          <div className="px-[18px]">
            {restFilled ? (
              <div className="mt-3 flex flex-wrap justify-center gap-[7px]">
                {String(me.address ?? "").trim() ? (
                  <ProfessionalPill
                    bare
                    icon={<MapPin className="size-4 text-accent" aria-hidden />}
                    label={String(me.address).trim()}
                  />
                ) : null}
                {String(me.contact_email ?? "").trim() ? (
                  <ProfessionalPill
                    bare
                    icon={<Mail className="size-4 text-accent" aria-hidden />}
                    label={String(me.contact_email).trim()}
                    // The mail mark is a door: the address is already on the
                    // phone, so there is nothing to confirm before it opens.
                    onClick={() => {
                      window.location.href = `mailto:${String(me.contact_email).trim()}`;
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
                      // The mark is read off the label and the address together,
                      // so an Instagram link wears the camera even when it was
                      // labelled "My page".
                      icon={linkPillIcon(row.label, url)}
                      label={word}
                      onClick={() => setGoing({ url, word })}
                    />
                  );
                })}
              </div>
            ) : (
              <p className="mt-3 text-center text-[12.5px] text-dim">
                {t("Fill the rest in and it shows up right here.")}
              </p>
            )}
          </div>
        ) : null}

        {/* The four numbers, in one row under the head. */}
        <div className="flex items-center justify-around px-[18px] pt-4">
          <Stat label={t("Drops")} value={me.posts_count} />
          <Stat
            label={t("Crew")}
            value={me.followers_count}
            onTap={() => navigate(`/app/u/${handle}/crew/followers`)}
            faded={me.show_crew !== true}
          />
          <Stat
            label={t("Kept")}
            value={me.following_count}
            onTap={() => navigate(`/app/u/${handle}/crew/following`)}
          />
          <Stat
            label={t("Spark")}
            value={typeof sparks.data?.total === "number" ? sparks.data.total : null}
            onTap={() => navigate("/app/sparks")}
            // The Sparks row defaults on, so it is off only when the server has
            // said so outright.
            faded={me.show_sparks === false}
          />
        </div>

        {/* The era, on its own line under the numbers. The user asked for the
            numbers first and the sentence below them — *"bio(era) neeche rahe
            drops,crew,kept sparks iske neeche rahe"*. */}
        <PosedBio
          text={String(me.bio ?? "").trim() || t("No era yet.")}
          character={me.character ?? null}
          show={null}
        />

        {/* The way in to Insights: a row rather than a fifth number, because it
            opens a screen rather than answering a question the four already
            asked. Only ever here, on my own page. */}
        <div className="px-[18px] pt-4">
          <Link
            to="/app/insights"
            className="flex items-center rounded-[16px] border border-line bg-card px-3.5 py-3 transition hover:bg-[color-mix(in_srgb,var(--ink)_3%,transparent)]"
          >
            <LineChart className="size-5 shrink-0 text-accent" aria-hidden />
            <span className="ml-3 min-w-0 flex-1">
              <span className="block text-[14.5px] font-bold">{t("Insights")}</span>
              <span className="mt-0.5 block truncate text-[11.5px] text-dim">
                {t("Views, new crew, interactions and what worked")}
              </span>
            </span>
            <ChevronRight className="size-[18px] shrink-0 text-dim" aria-hidden />
          </Link>
        </div>

        {/* Memories, kept where they have always been: their own strip up the
            page, above the row of tabs, not folded into it. Drawn even with
            nothing on it, because this is my own and the card at the end of it
            is how one gets made. */}
        <div className="pt-4">
          <MemoriesShelf
            username={handle}
            mine
            author={user}
            onAdd={() => navigate("/app/moments?memories=1")}
          />
        </div>

        {/* What was dropped, under what was kept. */}
        <ProfileShelf username={handle} mine />
      </div>

      {/* The floating layer: the way out on the left, and on the right the way
          in to the account's own business — editing the page, the code somebody
          photographs, and the shelf I put things by on. */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between p-3">
        <span className="pointer-events-auto">
          <Floating
            icon={<ArrowLeft className="size-[19px]" />}
            label={t("Back")}
            onTap={() => (window.history.length > 1 ? navigate(-1) : navigate("/app/drops"))}
          />
        </span>
        <span className="pointer-events-auto flex flex-col items-end gap-2.5">
          <Floating icon={<MoreVertical className="size-[19px]" />} label={t("More")} onTap={() => setMenu(true)} />
          <Floating icon={<QrCode className="size-[19px]" />} label={t("My QR code")} onTap={() => navigate("/app/qr")} />
          <Floating icon={<Bookmark className="size-[19px]" />} label={t("Saved")} onTap={() => navigate("/app/saved")} />
        </span>
      </div>

      {/* And the day itself, falling down my own page — the same balloons that
          fall on everybody else's. Last in the stack so they draw over
          everything, and they take nothing back: the layer ignores the pointer,
          so the buttons under it are still buttons and the list under it still
          scrolls. */}
      {birthdayToday ? <BirthdayFall /> : null}

      <Modal open={menu} onClose={() => setMenu(false)} size="sm" hideClose>
        <div className="py-1.5">
          <SheetRow
            icon={<UserRound className="size-[21px]" />}
            label={t("Profile")}
            line={t("Your photo, your name and your era.")}
            onClick={() => {
              setMenu(false);
              navigate("/app/settings?section=profile");
            }}
          />
          <SheetRow
            icon={<Settings className="size-[21px]" />}
            label={t("Settings")}
            line={t("Privacy, notifications and the way out.")}
            onClick={() => {
              setMenu(false);
              navigate("/app/settings");
            }}
          />
        </div>
      </Modal>

      {/* The photo, as large as it goes — the one place it is shown at more than
          the size of a thumbnail, and the same dialog the app opens on a tap. */}
      <FaceDialog open={photo} onClose={() => setPhoto(false)} user={me} />

      <Modal open={privacyGoing !== null} onClose={() => setPrivacyGoing(null)} size="sm" hideClose>
        <PrivacyConfirm
          going={privacyGoing === true}
          onStay={() => setPrivacyGoing(null)}
          onGo={() => void flipPrivacy(privacyGoing === true)}
        />
      </Modal>

      {/* Where a tap goes is worth being told before it is taken, and a link on
          a profile is somebody else's address — the app's own reason for putting
          this card in front of it. The card leads with the word the bare mark
          does not draw, which is where "which of these is Instagram" gets its
          answer, and then the address itself, shortened only when it is long. */}
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
    </div>
  );
}
