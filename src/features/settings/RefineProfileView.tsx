import { useEffect, useRef, useState, type ReactNode } from "react";
import { Camera, Hourglass, Image as ImageIcon, ImagePlus, Lock, Trash2 } from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { AuthedImage } from "@/components/Media";
import { Modal } from "@/components/Modal";
import { FieldLabel, SettingsShell } from "@/features/settings/parts";
import { api } from "@/lib/api";
import { errorMessage } from "@/lib/errors";
import { cn } from "@/lib/cn";
import { useAuth } from "@/providers/AuthProvider";
import { usePreferences } from "@/providers/PreferencesProvider";
import { useToast } from "@/providers/ToastProvider";
import type { Me } from "@/types/api";

/**
 * Refine profile — the one screen that writes to the account rather than to a
 * conversation.
 *
 * Ported from `app/lib/screens/refine_profile.dart`. The photo, the cover, the
 * name and the era can be changed. The handle can be changed too, and it is the
 * only one of these the server can refuse — somebody else may already be going
 * by it — so its error is what comes back and lands in a toast over the field it
 * belongs to.
 *
 * **The photo and the cover go up the moment they are picked; everything else
 * waits for Save.** That is not an accident of the app's build and it is why the
 * footer says so in as many words: a face is a single file with its own upload
 * call, while the three fields are one `PATCH` that the server can refuse as a
 * whole. Reading the two the other way round is what the footer is there to
 * prevent.
 *
 * The app's between-step for a picture is its framing screen, where the part of
 * the rectangle that fills the disc is chosen. A browser has no such step and
 * this page does not pretend to: a phone's library hands over a rectangle at
 * whatever size the camera kept, and the disc's `object-cover` crop is the same
 * choice made by the CSS. Everything else — the pick, the picture on screen
 * before the upload lands, the removal sheet — is the app's.
 */

/** The app's own cap on the era, and the one on the handle. */
const ERA_MAX = 200;

/**
 * When the @handle may next be changed, or null when it is free right now.
 *
 * Worked out on the server (`username_next_change_at`), because this page knows
 * the handle but not when it last moved. A date already in the past reads as
 * free, which is the rule the server holds.
 */
function handleFreeAt(me: Me | null): Date | null {
  const raw = me?.username_next_change_at;
  if (!raw) return null;
  const at = new Date(raw);
  if (Number.isNaN(at.getTime())) return null;
  return at.getTime() > Date.now() ? at : null;
}

/** Which picture a sheet is about. The two share every row but their words. */
type PictureKind = "avatar" | "cover";

/** One row of the pick sheet: an icon, a label, a line, and what tapping it does. */
function SheetRow({
  icon,
  label,
  line,
  bad,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  line?: string;
  bad?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
    >
      <span className={cn("flex size-6 shrink-0 items-center justify-center", bad ? "text-[var(--bad)]" : "text-dim")}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[15px] font-semibold", bad && "text-[var(--bad)]")}>{label}</span>
        {line ? <span className="mt-0.5 block text-[12px] leading-[1.35] text-dim">{line}</span> : null}
      </span>
    </button>
  );
}

export function RefineProfileView({ onBack }: { onBack: () => void }) {
  const { user, updateUser } = useAuth();
  const { t } = usePreferences();
  const { toast } = useToast();

  const [name, setName] = useState(user?.name ?? "");
  const [username, setUsername] = useState(user?.username ?? "");
  const [era, setEra] = useState(user?.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<PictureKind | null>(null);
  /** Which picture's sheet is open, and the answer to "remove or keep". */
  const [sheet, setSheet] = useState<PictureKind | null>(null);
  const [removeAsk, setRemoveAsk] = useState<PictureKind | null>(null);

  const libraryInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  /** Which picture the file dialog that is about to open is for. */
  const picking = useRef<PictureKind>("avatar");

  /** The picture on its way up, so the new one is on screen the moment it is picked. */
  const [preview, setPreview] = useState<{ kind: PictureKind; url: string } | null>(null);

  /** The web's own password form — see the note beside it in the body. */
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);

  async function changePassword() {
    if (newPassword !== confirmPassword) {
      toast({ title: t("The new passwords do not match"), tone: "error" });
      return;
    }
    setPasswordBusy(true);
    try {
      await api.post("/auth/password/change/", {
        current_password: currentPassword,
        password: newPassword,
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: t("Password changed"), tone: "success" });
    } catch (error) {
      toast({ title: errorMessage(error), tone: "error" });
    } finally {
      setPasswordBusy(false);
    }
  }

  // The fields start from whatever the account held when this screen opened, and
  // follow it if a save lands somewhere else — but a refetch of "me" while
  // somebody is typing must not overwrite what they are typing.
  useEffect(() => {
    setName((current) => current || user?.name || "");
    setUsername((current) => current || user?.username || "");
    setEra((current) => current || user?.bio || "");
  }, [user?.name, user?.username, user?.bio]);

  const locked = handleFreeAt(user);
  /**
   * The line under a locked handle field: how long is left before it opens.
   *
   * Whole days, counted the way the app counts them — the difference in days
   * plus one, so an hour short of a week reads as seven days rather than six.
   */
  const daysLeft = locked ? Math.floor((locked.getTime() - Date.now()) / 86_400_000) + 1 : 0;
  const lockedLine = locked
    ? daysLeft <= 1
      ? t("You can change your handle again tomorrow.")
      : t(`You can change your handle again in ${daysLeft} days.`)
    : null;

  /**
   * Open the file dialog for one picture.
   *
   * The sheet closes first and the answer to "which picture" is remembered
   * outside React state, because the dialog's change event lands after the sheet
   * is gone — and a handler that reads what is no longer on screen would send the
   * cover into the disc.
   */
  function pick(kind: PictureKind, fromCamera: boolean) {
    picking.current = kind;
    setSheet(null);
    if (fromCamera) cameraInput.current?.click();
    else libraryInput.current?.click();
  }

  /**
   * Send one picture up and keep whatever the server says the account now is.
   *
   * The local preview is shown first, then steps aside once the account carries
   * the uploaded copy: leaving it up would mean the page is drawing a blob URL
   * that is about to be revoked, which is how a photo that uploaded perfectly
   * well ends up looking like a blank disc.
   */
  async function sendPicture(kind: PictureKind, file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast({
        title: t(kind === "avatar" ? "A profile photo has to be a picture." : "A cover has to be a picture."),
        tone: "error",
      });
      return;
    }
    const url = URL.createObjectURL(file);
    setPreview({ kind, url });
    setUploading(kind);
    try {
      const form = new FormData();
      form.append(kind, file);
      const me = await api.form<Me>(`/auth/me/${kind}/`, form);
      updateUser(me);
      toast({
        title: t(kind === "avatar" ? "Photo changed." : "Cover changed."),
        tone: "success",
      });
    } catch (error) {
      toast({ title: errorMessage(error), tone: "error" });
    } finally {
      URL.revokeObjectURL(url);
      setPreview(null);
      setUploading(null);
    }
  }

  /** Take the picture off the account, after the sheet has been answered. */
  async function removePicture(kind: PictureKind) {
    setRemoveAsk(null);
    setUploading(kind);
    try {
      const me = await api.delete<Me>(`/auth/me/${kind}/`);
      updateUser(me);
      toast({
        title: t(kind === "avatar" ? "Photo removed." : "Cover removed."),
        tone: "success",
      });
    } catch (error) {
      toast({ title: errorMessage(error), tone: "error" });
    } finally {
      setUploading(null);
    }
  }

  /**
   * The three fields, as one write.
   *
   * The handle is sent lowercased, which is what the app sends — the server
   * would fold it anyway, but a save that does not name what it means is a save
   * whose result surprises whoever typed it.
   */
  async function save() {
    if (saving) return;
    if (!name.trim()) {
      toast({ title: t("A name is how people find you."), tone: "error" });
      return;
    }
    const handle = username.trim().toLowerCase();
    if (!handle) {
      toast({ title: t("A handle is how people reach you."), tone: "error" });
      return;
    }
    if (!/^[a-z0-9_]+$/.test(handle)) {
      toast({ title: t("Letters, numbers and underscores only."), tone: "error" });
      return;
    }
    setSaving(true);
    try {
      const me = await api.patch<Me>("/auth/me/", {
        name: name.trim(),
        username: handle,
        bio: era.trim(),
      });
      updateUser(me);
      toast({ title: t("Profile saved."), tone: "success" });
      onBack();
    } catch (error) {
      // The one refusal that reaches here is the server's — a handle somebody
      // else has taken, or the once-a-month cooldown when the field was not
      // greyed in time (a stale "me", a clock a little ahead). Both arrive as
      // the same envelope, so the server's own sentence is what is shown.
      toast({ title: errorMessage(error), tone: "error" });
    } finally {
      setSaving(false);
    }
  }

  const photo = preview?.kind === "avatar" ? preview.url : user?.avatar;
  const cover = preview?.kind === "cover" ? preview.url : user?.cover;

  return (
    <SettingsShell
      title={t("Refine profile")}
      onBack={onBack}
      action={
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="min-h-9 rounded-full px-3 text-[13px] font-extrabold text-accent disabled:opacity-40"
        >
          {saving ? (
            <span className="mx-auto block size-4 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          ) : (
            t("Save")
          )}
        </button>
      }
    >
      <div className="mx-auto w-full max-w-[560px] px-[18px] pb-10 pt-3">
        {/* The face, and the one tap that changes it. 104 is the largest place
            the app draws a photo, and the badge sits over its bottom edge the
            way the camera is pinned in the app. */}
        <div className="flex flex-col items-center">
          <button
            type="button"
            onClick={() => setSheet("avatar")}
            disabled={saving}
            className="relative"
            aria-label={t("Change photo")}
          >
            <Avatar name={name} src={photo} size={104} />
            <span className="absolute bottom-0 right-0 flex size-8 items-center justify-center rounded-full border-[3px] border-[var(--page)] bg-card text-accent">
              {uploading === "avatar" ? <Hourglass className="size-[15px]" /> : <Camera className="size-[15px]" />}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setSheet("avatar")}
            disabled={saving}
            className="mt-2.5 text-[14px] font-semibold text-accent disabled:opacity-45"
          >
            {t("Change photo")}
          </button>
        </div>

        <div className="mt-4">
          {/* The band, in the accent's own whisper when there is nothing there
              yet rather than a grey hole — the same tint `ProfileCover` gives
              the band on the profile. */}
          <button
            type="button"
            onClick={() => setSheet("cover")}
            disabled={saving}
            className="relative block h-24 w-full overflow-hidden rounded-[16px] bg-[color-mix(in_srgb,var(--accent)_12%,transparent)]"
            aria-label={t("Change cover")}
          >
            {cover ? (
              <AuthedImage src={cover} alt="" className="h-full w-full" />
            ) : (
              <span className="flex h-full w-full items-center justify-center">
                <ImageIcon className="size-[26px] text-dim" />
              </span>
            )}
            <span className="absolute bottom-2 right-2 flex size-[30px] items-center justify-center rounded-full border-[3px] border-[var(--page)] bg-card text-accent">
              {uploading === "cover" ? <Hourglass className="size-3.5" /> : <Camera className="size-3.5" />}
            </span>
          </button>
          <div className="mt-1 text-center">
            <button
              type="button"
              onClick={() => setSheet("cover")}
              disabled={saving}
              className="text-[14px] font-semibold text-accent disabled:opacity-45"
            >
              {t("Change cover")}
            </button>
          </div>
        </div>

        <label className="mt-2 block">
          <FieldLabel>{t("Name")}</FieldLabel>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            autoCapitalize="words"
            className="field"
          />
        </label>

        <label className="mt-3.5 block">
          <FieldLabel>{t("Handle")}</FieldLabel>
          <div
            className={cn(
              "flex items-center rounded-[14px] border border-line px-3",
              locked ? "bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]" : "bg-card",
            )}
          >
            <span className="text-[15px] font-semibold text-dim">@</span>
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              // Greyed while the once-a-month window is still open. Disabled
              // rather than merely warned, so the field cannot be edited into a
              // save the server would only refuse — and because it is disabled
              // it still holds the current handle, which the save sends
              // unchanged as the no-op the server always allows.
              disabled={Boolean(locked)}
              maxLength={30}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="min-w-0 flex-1 bg-transparent py-3 text-[15px] font-semibold outline-none disabled:text-dim"
            />
            {locked ? <Lock className="size-[18px] shrink-0 text-dim" /> : null}
          </div>
          <p className="mt-1.5 text-[11px] leading-[1.4] text-dim">
            {lockedLine ?? t("Letters, numbers and underscores. Lowercase.")}
          </p>
        </label>

        <label className="mt-3.5 block">
          <FieldLabel>{t("Era")}</FieldLabel>
          <textarea
            value={era}
            onChange={(event) => setEra(event.target.value)}
            rows={3}
            maxLength={ERA_MAX}
            className="field resize-none"
          />
          <span className="mt-1 block text-right text-[10px] text-dim">
            {era.length}/{ERA_MAX}
          </span>
        </label>

        {/* Said plainly, because the opposite is what people assume: nothing is
            written until Save, and the photo and the cover are the exceptions. */}
        <p className="mt-1.5 text-[12px] leading-[1.4] text-dim">
          {t("The photo and the cover go up as soon as you choose them. Everything else waits for Save.")}
        </p>

        {/* The one block the app does not have.
            The app changes a password only by resetting it from the sign-in
            flow, and the web has no such flow — so a section here is what keeps
            "change my password" possible at all rather than an addition for its
            own sake. It sits under the fields and behind a heading of its own,
            so the page above it is the app's page exactly. */}
        <section className="mt-7 rounded-[18px] border border-line bg-card p-4">
          <h2 className="text-[13px] font-extrabold">{t("Password")}</h2>
          <form
            className="mt-3 space-y-2.5"
            onSubmit={(event) => {
              event.preventDefault();
              void changePassword();
            }}
          >
            <input
              type="password"
              value={currentPassword}
              onChange={(event) => setCurrentPassword(event.target.value)}
              placeholder={t("Current password")}
              className="field"
              autoComplete="current-password"
            />
            <input
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder={t("New password (8+ characters)")}
              className="field"
              autoComplete="new-password"
              minLength={8}
            />
            <input
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder={t("Repeat the new password")}
              className="field"
              autoComplete="new-password"
              minLength={8}
            />
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={
                  passwordBusy ||
                  !currentPassword ||
                  newPassword.length < 8 ||
                  newPassword !== confirmPassword
                }
                className="btn btn-primary disabled:opacity-45"
              >
                {passwordBusy ? t("Working...") : t("Change password")}
              </button>
            </div>
          </form>
        </section>
      </div>

      <input
        ref={libraryInput}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          void sendPicture(picking.current, event.target.files?.[0]);
          event.target.value = "";
        }}
      />
      <input
        ref={cameraInput}
        type="file"
        accept="image/*"
        capture="user"
        className="hidden"
        onChange={(event) => {
          void sendPicture(picking.current, event.target.files?.[0]);
          event.target.value = "";
        }}
      />

      {/* The app's sheet: where the picture is coming from, and the one destructive
          row when there is something to take away. */}
      <Modal open={sheet !== null} onClose={() => setSheet(null)} size="sm" hideClose>
        <div className="pb-2 pt-2">
          <SheetRow
            icon={<ImagePlus className="size-[21px]" />}
            label={t(sheet === "cover" ? "Choose a cover" : "Choose a photo")}
            line={t("Out of your library.")}
            onClick={() => sheet && pick(sheet, false)}
          />
          <SheetRow
            icon={<Camera className="size-[21px]" />}
            label={t(sheet === "cover" ? "Take a cover" : "Take a photo")}
            line={t("Right now, with the camera.")}
            onClick={() => sheet && pick(sheet, true)}
          />
          {(sheet === "avatar" ? user?.avatar : user?.cover) ? (
            <SheetRow
              icon={<Trash2 className="size-[21px]" />}
              label={t(sheet === "cover" ? "Remove cover" : "Remove photo")}
              bad
              onClick={() => {
                const kind = sheet;
                setSheet(null);
                if (kind) setRemoveAsk(kind);
              }}
            />
          ) : null}
        </div>
      </Modal>

      <Modal
        open={removeAsk !== null}
        onClose={() => setRemoveAsk(null)}
        title={t(removeAsk === "cover" ? "Remove cover" : "Remove photo")}
        size="sm"
      >
        <p className="px-5 py-4 text-sm leading-6 text-dim">
          {t(removeAsk === "cover" ? "The band comes down and the tint shows through." : "The disc goes back to your letter.")}
        </p>
        <div className="flex justify-end gap-2 px-5 pb-5 pt-2">
          <button type="button" className="btn btn-secondary" onClick={() => setRemoveAsk(null)}>
            {t("Cancel")}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => removeAsk && void removePicture(removeAsk)}
          >
            {t(removeAsk === "cover" ? "Remove cover" : "Remove photo")}
          </button>
        </div>
      </Modal>
    </SettingsShell>
  );
}