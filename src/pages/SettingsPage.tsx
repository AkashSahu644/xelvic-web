import { useEffect, useState, type ReactNode } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import {
  BadgeCheck,
  Bell,
  Bookmark,
  CircleHelp,
  Handshake,
  Heart,
  Languages,
  Lock,
  LogOut,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Trash2,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/Button";
import { ConfirmDialog, Modal } from "@/components/Modal";
import { PrivacyConfirm } from "@/components/PrivacyConfirm";
import { MarketPurse, MarketplaceView, type MarketTab } from "@/features/marketplace/MarketplaceView";
import { LanguageView } from "@/features/settings/LanguageView";
import { DevicesView } from "@/features/settings/DevicesView";
import { KeptView } from "@/features/settings/KeptView";
import { LockChatView } from "@/features/settings/LockChatView";
import { NotificationsView } from "@/features/settings/NotificationsView";
import { PermissionsView } from "@/features/settings/PermissionsView";
import { ProfessionalView } from "@/features/professional/ProfessionalView";
import { RefineProfileView } from "@/features/settings/RefineProfileView";
import { VerifyView } from "@/features/verify/VerifyView";
import {
  SettingsGroup,
  SettingsRow,
  SettingsShell,
  SettingsSwitch,
} from "@/features/settings/parts";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import { useAuth } from "@/providers/AuthProvider";
import { usePreferences } from "@/providers/PreferencesProvider";
import { useTheme, type ScreenBackdrop } from "@/providers/ThemeProvider";
import { useToast } from "@/providers/ToastProvider";
import type { Me } from "@/types/api";

type SettingsView =
  | "root"
  | "profile"
  | "language"
  | "notifications"
  | "permissions"
  | "lock"
  | "professional"
  | "marketplace"
  | "verify"
  | "kept"
  | "devices";

const VIEWS: SettingsView[] = [
  "root",
  "profile",
  "language",
  "notifications",
  "permissions",
  "lock",
  "professional",
  "marketplace",
  "verify",
  "kept",
  "devices",
];

const CREATOR_FLOOR = 2000;

/**
 * How old an account is, or null when nobody said.
 *
 * The server hands an account its own raw `dob` as `yyyy-mm-dd`, and this is the
 * only arithmetic done with it. A missing date, or one the parser will not take,
 * is the same answer as a birth date that makes somebody a minor: *"nobody said"
 * is not "18 years old"*, and a switch that turned itself on because a field was
 * absent would be the one thing this must not do. Whole years, the way a
 * birthday works rather than the way subtraction does.
 */
/**
 * Whether the server refused a password, rather than refusing the action.
 *
 * The app reads the same two things off its own client — the `bad_password`
 * code, or a 403 — because a mistyped password is the one refusal that should
 * leave somebody on the box they just typed into instead of dropping them back
 * on the settings list with a sentence they cannot act on.
 */
function isBadPassword(error: unknown): boolean {
  return error instanceof ApiError && (error.code === "bad_password" || error.status === 403);
}

function yearsOld(dob: string | null | undefined): number | null {
  if (!dob) return null;
  const born = new Date(dob);
  if (Number.isNaN(born.getTime())) return null;
  const now = new Date();
  let years = now.getFullYear() - born.getFullYear();
  if (now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate())) {
    years -= 1;
  }
  return years;
}

function viewFromParam(value: string | null): SettingsView {
  if (value === "appearance") return "marketplace";
  return VIEWS.includes(value as SettingsView) ? (value as SettingsView) : "root";
}

export function SettingsPage() {
  const { user, updateUser, logout } = useAuth();
  const { design, backdropFor } = useTheme();
  const preferences = usePreferences();
  const { t } = preferences;
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const view = viewFromParam(searchParams.get("section"));
  const [privacyBusy, setPrivacyBusy] = useState<string | null>(null);
  const [professionalBusy, setProfessionalBusy] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  /**
   * The private-profile switch, waiting on its dialog.
   *
   * The value is the direction being asked about — `true` for going private —
   * and `null` is nothing being asked. It is state rather than a promise because
   * the dialog has to outlive the tap that opened it, and because a person who
   * taps away from it should find the switch drawn where the account says it is
   * rather than flicked and abandoned.
   */
  const [privacyGoing, setPrivacyGoing] = useState<boolean | null>(null);
  const [deactivationOpen, setDeactivationOpen] = useState(false);
  /** The password box, once the warning has been answered yes. */
  const [deleteAskOpen, setDeleteAskOpen] = useState(false);
  const [deletePassword, setDeletePassword] = useState("");
  const [deleteBusy, setDeleteBusy] = useState(false);
  /** Set when the server refused the password, so the box can say so in place. */
  const [deleteWrong, setDeleteWrong] = useState(false);
  /** The under-18 answer, which is a sentence rather than a refusal from the server. */
  const [under18Open, setUnder18Open] = useState(false);

  useEffect(() => {
    if (!user?.logo) return;
    if (user.logo !== preferences.logo) preferences.setLogo(user.logo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.logo]);

  /**
   * A link that already names a shelf lands on it.
   *
   * `?tab=logos` and `?tab=themes` are the ones the app's own deep links use — a
   * studio link or a share card that is about the mark or the colour rather than
   * the shop — so a person who followed one is not asked to swipe to find the
   * thing the link was about. The shelf is read off the URL on the render that
   * mounts the aisle rather than in an effect, because an effect lands one paint
   * *after* the aisle has already opened on Drip.
   */
  const marketTab = searchParams.get("tab");
  const marketOpensOn: MarketTab =
    marketTab === "logos" || marketTab === "themes" ? marketTab : "drip";

  /**
   * The picture the shop stands on.
   *
   * The app's Marketplace is a pushed screen and wears a `ThemeBackdrop` with no
   * page named, which is the Convo page — *"defaulted to the Convo list because
   * that is the page the app opens on"* — washed with that page's veil and
   * framed with that page's frame. It is not a page the shop chose and it is not
   * an accident: a screen that has no page of its own gets the one the app opens
   * on, so a theme painted page by page still shows the part of itself somebody
   * sees first behind the shop that sells it. Every other settings view is a
   * list of rows read on the theme's own ink and stands on nothing.
   */
  const marketBackdrop: ScreenBackdrop | null =
    view === "marketplace" ? backdropFor("convo") : null;

  function setView(next: SettingsView) {
    if (next === "root") setSearchParams({}, { replace: true });
    else setSearchParams({ section: next }, { replace: true });
  }

  function goBack() {
    if (view === "root") {
      if (window.history.length > 1) navigate(-1);
      else navigate("/app");
      return;
    }
    setView("root");
  }

  function goSubpage(next: SettingsView) {
    setView(next);
  }


  /**
   * The private-profile switch is a question, not a flick.
   *
   * It is the one switch here that changes what other people can see of
   * everything already posted rather than of the next thing, so the direction
   * being asked about is put up as a dialog that names what leaves the shelves
   * — and a no, or a dialog tapped away, sends nothing at all and leaves the
   * switch drawn where the account says it is.
   */
  function askPrivate(going: boolean) {
    if (privacyBusy) return;
    setPrivacyGoing(going);
  }

  /**
   * The one privacy switch the server may refuse, answered here before anything
   * leaves the browser.
   *
   * Turning sensitive content on is an 18-and-over act and the whole point of
   * the feature is that a minor is not let through it. The server refuses the
   * same thing with `under_18`, but a switch dragged on, sent, and snapped back
   * by a refusal is a worse way to be told than a sentence before anything
   * leaves, so a minor is answered here and no request is made.
   */
  async function askSensitive(value: boolean) {
    if (value && !adult) {
      setUnder18Open(true);
      return;
    }
    await privacy({ allow_sensitive: value });
  }

  async function privacy(patch: Record<string, boolean>) {
    const key = Object.keys(patch)[0];
    setPrivacyBusy(key);
    try {
      const me = await api.patch<Me>("/auth/me/privacy/", patch);
      updateUser(me);
    } catch (error) {
      toast({
        title: "That setting did not change",
        description: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    } finally {
      setPrivacyBusy(null);
    }
  }

  /**
   * Flip the account in or out of company mode.
   *
   * The switch that turns the professional hat on is the deals mode route —
   * `POST /deals/mode/`, which is `Deals.setCompanyMode` in the app and
   * `apps/deals/urls.py` behind it — and *not* `/auth/me/professional/`, which
   * is the block the hat unlocks and is refused for an account that is not
   * wearing it yet. The account is then re-read, because the switch is drawn
   * from `is_company` on the held account and the server's own answer is what
   * the rest of the app reads.
   *
   * The app's switch does not open the details page behind it, and neither does
   * this one: the row directly below is called *Edit professional profile* and
   * is the door to that, and two rows that both opened it after one of them
   * only changed a switch would be a coin toss for whoever tapped.
   */
  async function toggleCompany() {
    if (professionalBusy) return;
    setProfessionalBusy(true);
    const next = !professionalOn;
    try {
      await api.post("/deals/mode/", { company: next });
      const me = await api.get<Me>("/auth/me/");
      updateUser(me);
    } catch (error) {
      toast({
        title: "That setting did not change",
        description: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    } finally {
      setProfessionalBusy(false);
    }
  }


  /**
   * Whether there is anything on this browser that signing out would throw away.
   *
   * The app asks its outbox the same question before it asks the person: the
   * warning about discarded lines and actions only appears when there are lines
   * or actions to discard, and somebody with nothing in flight is signed out on
   * the tap rather than made to answer a question about nothing. The web's
   * equivalent of an outbox is the optimistic rows the conversation screens are
   * holding — a send on its way out, or one that failed and is waiting for a
   * retry — so those, and only those, are what the dialog is about.
   */
  function hasPendingWork(): boolean {
    return queryClient
      .getQueriesData<{ messages?: { status?: string }[] }>({ queryKey: ["messages"] })
      .some(([, data]) =>
        (data?.messages ?? []).some((row) => row.status === "pending" || row.status === "failed"),
      );
  }

  function askSignOut() {
    if (hasPendingWork()) setLogoutOpen(true);
    else void signOut();
  }

  async function signOut() {
    await logout();
    navigate("/", { replace: true });
  }

  /**
   * Delete the account, behind a warning and the password.
   *
   * Deleting is not final on the spot: the server hides the account and starts a
   * thirty-day clock, and signing back in inside that window brings it back
   * untouched — so the warning says exactly that rather than promising a
   * vanishing that has not happened yet. The password is asked for because this
   * is the one action that empties an account, and a browser left open in
   * somebody else's hands must not be able to take it.
   *
   * A wrong password is drawn in the box and the box is offered again — the
   * server answers it with `bad_password`, and a typo is not a reason to start
   * the whole flow over. Any other refusal is the server's own sentence.
   */
  async function deactivateAccount() {
    if (!deletePassword) return;
    setDeleteBusy(true);
    setDeleteWrong(false);
    try {
      await api.post("/auth/deactivate/", { password: deletePassword });
      toast({ title: "Your account will be deleted in 30 days. Log in again to recover it.", tone: "success" });
      await logout();
      navigate("/", { replace: true });
    } catch (error) {
      // The one refusal worth staying on the flow for: the password was wrong,
      // so say so in the box and offer it again.
      if (isBadPassword(error)) setDeleteWrong(true);
      else {
        toast({
          title: "Cannot reach the server.",
          description: error instanceof Error ? error.message : undefined,
          tone: "error",
        });
      }
      setDeleteBusy(false);
    }
  }

  if (!user) return null;

  /** Whether the account is old enough for the sensitive switch to be its own. */
  const adult = (yearsOld(user.dob) ?? 0) >= 18;
  /**
   * Whether the account wears the Professional hat.
   *
   * Read off `is_company` and not off the `professional` block: the block is the
   * extra the hat unlocks and is empty for an account that has not put it on, so
   * a switch drawn from it would show off for somebody who had turned nothing on.
   */
  const professionalOn = user.is_company === true;
  /**
   * The follower floor the server itself keeps (`apps/deals/services.py`,
   * `MIN_FOLLOWERS = 2000`).
   *
   * Deals is drawn only for an account that is over it, because below the floor
   * the screen behind the row refuses everything it offers: a brand that cannot
   * invite and a creator nobody may invite would open onto an empty list, and a
   * door onto nothing is worse than no door.
   */
  const dealsVisible = (user.followers_count ?? 0) >= CREATOR_FLOOR;
  /**
   * What the language row reads.
   *
   * The system's own name is a word the app says, so it comes from the table; a
   * named language keeps the spelling its own script uses, which is how somebody
   * finds it in a list. The app draws this same distinction twice — once on the
   * controls row (`Languages.it.language.label`) and once on the language page
   * itself.
   */
  const languageLabel =
    preferences.language === "system"
      ? t("System default")
      : preferences.language === "hi"
        ? "हिन्दी"
        : preferences.language === "ar"
          ? "العربية"
          : "English";

  const profileHeaderAction: ReactNode = view === "marketplace" ? (
    // The purse, in the header, for the same reason the app's own marketplace
    // puts it there: all three aisles charge sparks, and one number above all
    // three is one answer to "what have I got" rather than three of them. It is
    // the same `/sparks/wallet/` reading the tiles use, so the two cannot
    // disagree.
    <MarketPurse />
  ) : null;

  const title =
    view === "root"
      ? t("Controls")
      : view === "language"
          ? t("App language")
          : view === "notifications"
            ? t("Notifications")
            : view === "permissions"
              ? t("Permissions")
              : view === "lock"
                ? t("Lock chat")
                : view === "professional"
                  ? t("Professional profile")
                  : view === "marketplace"
                    ? t("Marketplace")
                    : view === "verify"
                      ? t("Get verified")
                      : view === "kept"
                        ? t("Kept")
                        : view === "devices"
                          ? t("Where you are signed in")
                          : t("Controls");

  /*
   * Professional details is the one settings page that draws its own header.
   *
   * The app's Save is a button in the AppBar above the form — always reachable,
   * because the form below it is long — and the state it saves lives in that
   * screen. So the screen owns the whole page here too: a shell whose action is
   * its own Save, rather than a button handed up to a parent that would have to
   * hold the form's state to press it. Nothing else about the shell changes.
   */
  if (view === "professional") return <ProfessionalView onBack={goBack} />;

  /*
   * Refine profile draws its own header for the same reason: the app's Save is a
   * button in the AppBar above the form, and the state it saves — the three
   * fields and the two pictures on their way up — lives in that screen.
   */
  if (view === "profile") return <RefineProfileView onBack={goBack} />;

  return (
    <SettingsShell
      title={title}
      onBack={goBack}
      action={profileHeaderAction}
      backdrop={marketBackdrop}
    >
      {view === "root" ? (
        <>
          <SettingsGroup title={t("This phone")}>
            <SettingsRow
              icon={<Languages className="size-5" />}
              title={t("Language")}
              value={languageLabel}
              onClick={() => goSubpage("language")}
            />
            <SettingsRow
              icon={<Bell className="size-5" />}
              title={t("Notifications")}
              note="Message sound, ringtone, and whether the app interrupts you at all."
              onClick={() => goSubpage("notifications")}
            />
            <SettingsRow
              icon={<ShieldCheck className="size-5" />}
              title={t("Permissions")}
              note="Camera, microphone, photos and the rest — and where each one stands."
              onClick={() => goSubpage("permissions")}
            />
          </SettingsGroup>

          <SettingsGroup title={t("Privacy")}>
            <SettingsRow
              icon={<Lock className="size-5" />}
              title={t("Private profile")}
              note="Hides your drops, vibes and audio from everyone you have not accepted. New people send a request instead."
              trailing={
                <SettingsSwitch
                  on={Boolean(user.is_private)}
                  onChange={() => askPrivate(!user.is_private)}
                  disabled={privacyBusy === "is_private"}
                  label={t("Private profile")}
                />
              }
            />
            <SettingsRow
              icon={<Users className="size-5" />}
              title={t("Show my crew count")}
              note="The number only — never who they are."
              trailing={
                <SettingsSwitch
                  on={Boolean(user.show_crew)}
                  onChange={() => void privacy({ show_crew: !user.show_crew })}
                  disabled={privacyBusy === "show_crew"}
                  label={t("Show my crew count")}
                />
              }
            />
            <SettingsRow
              icon={<Sparkles className="size-5" />}
              title={t("Show my sparks")}
              note="The number over your profile, for anyone who opens it."
              trailing={
                <SettingsSwitch
                  on={Boolean(user.show_sparks)}
                  onChange={() => void privacy({ show_sparks: !user.show_sparks })}
                  disabled={privacyBusy === "show_sparks"}
                  label={t("Show my sparks")}
                />
              }
            />
            <SettingsRow
              icon={<UserRound className="size-5" />}
              title={t("Show my birthday")}
              note="Your crew sees it a week ahead."
              trailing={
                <SettingsSwitch
                  on={Boolean(user.show_dob)}
                  onChange={() => void privacy({ show_dob: !user.show_dob })}
                  disabled={privacyBusy === "show_dob"}
                  label={t("Show my birthday")}
                />
              }
            />
            <SettingsRow
              icon={<Lock className="size-5" />}
              title={t("Lock chat")}
              note="The vault, and a way to reset it if you lose the code."
              onClick={() => goSubpage("lock")}
            />
            <SettingsRow
              icon={<CircleHelp className="size-5" />}
              title={t("Allow sensitive content")}
              note="Open sensitive content. Only for 18 and over."
              trailing={
                <SettingsSwitch
                  on={Boolean(user.allow_sensitive)}
                  onChange={() => void askSensitive(!user.allow_sensitive)}
                  disabled={privacyBusy === "allow_sensitive"}
                  label={t("Allow sensitive content")}
                />
              }
            />
          </SettingsGroup>

          <SettingsGroup title={t("Professional")}>
            <SettingsRow
              icon={<Store className="size-5" />}
              title={t("Professional profile")}
              note="Invite creators to make content and track paid deals, agreement to payment, in the open."
              trailing={
                <SettingsSwitch
                  on={professionalOn}
                  onChange={() => void toggleCompany()}
                  disabled={professionalBusy}
                  label={t("Professional profile")}
                />
              }
            />
            {/* The extra the hat unlocks, and only while it is on — the server
                refuses to write these for an account that has not put it on, so
                a row drawn for one would be a door onto a refusal. "Edit" is in
                the label because the row directly above is already called
                Professional profile and is a switch: two rows with one name and
                two different verbs is a coin toss for whoever taps. */}
            {professionalOn ? (
              <SettingsRow
                icon={<BadgeCheck className="size-5" />}
                title={t("Edit professional profile")}
                note="What you do, where you are, a public email and your links."
                onClick={() => goSubpage("professional")}
              />
            ) : null}
            {/* Deals, and only for the accounts that can be in one. A deal needs
                a public creator with 2k followers on one side or a brand on the
                other, and below the floor the row is a door onto a screen that
                refuses everything it offers. The number is the server's own —
                `apps/deals/services.MIN_FOLLOWERS` — and this is a drawing rule:
                every invite route refuses an account under the floor whatever
                this page believes. */}
            {dealsVisible ? (
              <SettingsRow
                icon={<Handshake className="size-5" />}
                title={t("Deals")}
                note={
                  professionalOn
                    ? "The briefs you sent, and where each one stands."
                    : "Paid collaborations brands invited you to."
                }
                onClick={() => navigate("/app/deals")}
              />
            ) : null}
          </SettingsGroup>

          <SettingsGroup title={t("How you look")}>
            {/* One shop, one row. Drip and Themes were two rows, and the app's
                own mark had a third below this one — the owner took it out:
                the logo is a shelf of the same shop this row opens, and a
                second door onto it put the app's face under a row that already
                shows it. The aisle is still one tap away: the market opens on
                Drip and Logos is its third tab. */}
            <SettingsRow
              icon={<Store className="size-5" />}
              title={t("Marketplace")}
              note="The character in your convos, and the colour of the app."
              value={design.name}
              onClick={() => goSubpage("marketplace")}
            />
          </SettingsGroup>

          <SettingsGroup title={t("Account")}>
            <SettingsRow
              icon={<UserRound className="size-5" />}
              title={t("Profile")}
              note="Your photo, your name and your era."
              onClick={() => goSubpage("profile")}
            />
            <SettingsRow
              icon={<BadgeCheck className="size-5" />}
              title={t("Get verified")}
              note="Ask for the mark that says this account is really you."
              onClick={() => goSubpage("verify")}
            />
            <SettingsRow
              icon={<Users className="size-5" />}
              title={t("Kept")}
              note={undefined}
              value={String(user.following_count ?? 0)}
              onClick={() => goSubpage("kept")}
            />
            <SettingsRow
              icon={<Bookmark className="size-5" />}
              title={t("Saved")}
              note="Drops, Vibes and songs you put by to come back to."
              onClick={() => navigate("/app/saved")}
            />
            <SettingsRow
              icon={<Heart className="size-5" />}
              title={t("Felt & responded")}
              note="The Drops, Vibes and songs you hearted or left a line on."
              onClick={() => navigate("/app/activity")}
            />
            <SettingsRow
              icon={<Wallet className="size-5" />}
              title={t("Wallet")}
              note="What the days you talked earned, and what it bought."
              onClick={() => navigate("/app/sparks")}
            />
            <SettingsRow
              icon={<Smartphone className="size-5" />}
              title={t("Where you are signed in")}
              note="Every phone on this account, and a way to sign any of them out."
              onClick={() => goSubpage("devices")}
            />
            <SettingsRow
              icon={<LogOut className="size-5" />}
              title={t("Log out")}
              danger
              onClick={askSignOut}
            />
            <SettingsRow
              icon={<Trash2 className="size-5" />}
              title={t("Delete account")}
              note="Hidden right away, kept for 30 days, then gone for good."
              danger
              onClick={() => setDeactivationOpen(true)}
            />
          </SettingsGroup>

          {/* The owner tools used to be the last row on this page, and they are
              not there any more. The staff console is a web panel — the five
              team dashboards, the roster, the moderation queues — and a second,
              smaller console inside the app was a copy that answered a
              different question about who may open what. The app has taken the
              row out too (the owner's words, 2026-10-26: "app ke andar nahi
              chaiye owner tools wala"), so the web does not carry a row that
              can only say where the console really is. */}
        </>
      ) : null}

      {/* Each of these four is its own file now, ported from the app screen of
          the same name, so a view and its page in the app sit side by side
          rather than as four blocks in a five-thousand-line file. */}
      {view === "language" ? <LanguageView /> : null}

      {view === "notifications" ? <NotificationsView /> : null}

      {view === "permissions" ? <PermissionsView /> : null}

      {view === "lock" ? <LockChatView onDone={goBack} /> : null}

      {view === "marketplace" ? (
        // One page, three aisles, exactly as the app draws it: the strip, the
        // shelf under it, and nothing else. The title and the way out are the
        // header's above, and the purse is in it too — three shelves stacked
        // under one strip, which is what makes them one shop.
        <MarketplaceView initialTab={marketOpensOn} />
      ) : null}

      {view === "verify" ? <VerifyView /> : null}

      {view === "kept" ? <KeptView ownerId={user?.id ?? ""} /> : null}

      {view === "devices" ? <DevicesView /> : null}

      {/* Signing out is only a question when there is something to lose. The app
          asks its outbox first and shows this dialog only when lines or actions
          are still in flight; with nothing pending it signs out on the tap. */}
      <ConfirmDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={() => {
          setLogoutOpen(false);
          void signOut();
        }}
        title="Sign out anyway?"
        body="Unsent lines and actions on this device will be discarded."
        note="This cannot be undone."
        confirmLabel="Discard and sign out"
        destructive
      />

      <ConfirmDialog
        open={deactivationOpen}
        onClose={() => setDeactivationOpen(false)}
        onConfirm={() => {
          setDeactivationOpen(false);
          setDeletePassword("");
          setDeleteWrong(false);
          setDeleteAskOpen(true);
        }}
        title="Delete your account?"
        body="Your profile is hidden right away and nobody can find you. For 30 days everything is kept — log in again in that time and the account comes back exactly as it was."
        note="After 30 days it is gone for good and cannot be recovered."
        confirmLabel="Delete account"
        destructive
      />

      {/* The password is asked for because this is the one action that empties
          an account, and a browser left open in somebody else's hands must not
          be able to take it. A wrong one is drawn in the box rather than
          dropping the reader back on the settings list. */}
      <Modal
        open={deleteAskOpen}
        onClose={() => {
          if (deleteBusy) return;
          setDeleteAskOpen(false);
        }}
        title="Enter your password"
        description="This confirms it is you deleting the account."
        size="sm"
      >
        <div className="space-y-3 p-5">
          <input
            type="password"
            value={deletePassword}
            onChange={(event) => {
              setDeletePassword(event.target.value);
              setDeleteWrong(false);
            }}
            placeholder="Your password"
            className="field"
            autoComplete="current-password"
            autoFocus
          />
          {deleteWrong ? (
            <p className="text-[12px] font-semibold text-[var(--bad)]">
              That password is not right. Try again.
            </p>
          ) : null}
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setDeleteAskOpen(false)} disabled={deleteBusy}>
              {t("Cancel")}
            </Button>
            <Button variant="danger" loading={deleteBusy} disabled={!deletePassword} onClick={() => void deactivateAccount()}>
              {t("Delete")}
            </Button>
          </div>
        </div>
      </Modal>

      {/* The private switch, and what leaves the shelves in the direction being
          gone. The halves are the app's: going private names each shelf that
          drops out of sight and the note under them; coming back names what
          opens again. */}
      <Modal
        open={privacyGoing !== null}
        onClose={() => setPrivacyGoing(null)}
        size="sm"
        hideClose
      >
        <PrivacyConfirm
          going={privacyGoing === true}
          onStay={() => setPrivacyGoing(null)}
          onGo={() => {
            const going = privacyGoing === true;
            setPrivacyGoing(null);
            void privacy({ is_private: going });
          }}
        />
      </Modal>

      <Modal
        open={under18Open}
        onClose={() => setUnder18Open(false)}
        title="You are under 18"
        size="sm"
      >
        <div className="space-y-4 p-5">
          <p className="text-sm leading-6 text-dim">Sensitive content is only for people over 18.</p>
          <div className="flex justify-end">
            <Button onClick={() => setUnder18Open(false)}>{t("OK")}</Button>
          </div>
        </div>
      </Modal>
    </SettingsShell>
  );
}
