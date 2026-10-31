import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  BadgeCheck,
  Bell,
  Bluetooth,
  Bookmark,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Contact,
  FileUp,
  Heart,
  Image as ImageIcon,
  ImagePlus,
  KeyRound,
  Languages,
  Link2,
  Lock,
  LogOut,
  MapPin,
  Mic,
  Music2,
  Palette,
  Phone,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Trash2,
  UserRound,
  Users,
  Volume2,
  Wallet,
  X,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Button, Spinner } from "@/components/Button";
import { AuthedImage } from "@/components/Media";
import { ConfirmDialog, Modal } from "@/components/Modal";
import { ErrorState } from "@/components/States";
import { ThemeShop } from "@/features/sparks/ThemeShop";
import type { WalletData } from "@/features/sparks/types";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { relativeTime } from "@/lib/format";
import { useAuth } from "@/providers/AuthProvider";
import {
  usePreferences,
  type AppLanguage,
  type MessageSound,
  type Ringtone,
} from "@/providers/PreferencesProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { useToast } from "@/providers/ToastProvider";
import type { Device, Me, UserCard } from "@/types/api";

type SettingsView =
  | "root"
  | "profile"
  | "language"
  | "notifications"
  | "permissions"
  | "lock"
  | "professional"
  | "marketplace"
  | "logos"
  | "verify"
  | "kept"
  | "devices";

type PermissionStatus = "granted" | "denied" | "prompt" | "unsupported" | "unknown";

const VIEWS: SettingsView[] = [
  "root",
  "profile",
  "language",
  "notifications",
  "permissions",
  "lock",
  "professional",
  "marketplace",
  "logos",
  "verify",
  "kept",
  "devices",
];

const LOGOS = [
  { key: "pink", name: "Pink", price: 0 },
  { key: "rose", name: "Rose", price: 60 },
  { key: "peach", name: "Peach", price: 60 },
  { key: "gold", name: "Gold", price: 60 },
  { key: "lime", name: "Lime", price: 60 },
  { key: "mint", name: "Mint", price: 60 },
  { key: "teal", name: "Teal", price: 60 },
  { key: "sky", name: "Sky", price: 60 },
  { key: "azure", name: "Azure", price: 60 },
  { key: "violet", name: "Violet", price: 60 },
  { key: "fuchsia", name: "Fuchsia", price: 60 },
  { key: "midnight", name: "Midnight", price: 60 },
];

const MESSAGE_SOUNDS: { key: MessageSound; name: string }[] = [
  { key: "silent", name: "Silent" },
  { key: "note", name: "Note" },
  { key: "ping", name: "Ping" },
  { key: "pop", name: "Pop" },
  { key: "soft", name: "Soft" },
];

const RINGTONES: { key: Ringtone; name: string }[] = [
  { key: "phone", name: "Phone ringtone" },
  { key: "classic", name: "Classic" },
  { key: "pulse", name: "Pulse" },
  { key: "marimba", name: "Marimba" },
];

const ACCOUNT_KINDS = ["creator", "business", "public figure", "something else"];

function viewFromParam(value: string | null): SettingsView {
  if (value === "appearance") return "marketplace";
  return VIEWS.includes(value as SettingsView) ? (value as SettingsView) : "root";
}

function FieldLabel({ children }: { children: ReactNode }) {
  return (
    <span className="mb-1.5 block text-[11px] font-semibold text-dim">
      {children}
    </span>
  );
}

function SettingsSwitch({
  on,
  onChange,
  disabled,
  label,
}: {
  on: boolean;
  onChange: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onChange();
      }}
      className={cn(
        "relative h-[30px] w-[51px] shrink-0 rounded-full transition disabled:opacity-45",
        on ? "bg-accent" : "bg-[color-mix(in_srgb,var(--ink)_14%,transparent)]",
      )}
    >
      <span
        className={cn(
          "absolute top-[3px] size-6 rounded-full shadow-sm transition",
          on ? "left-[21px] bg-white" : "left-[3px] bg-[var(--dim)]",
        )}
      />
    </button>
  );
}

function SettingsRow({
  icon,
  title,
  note,
  value,
  trailing,
  onClick,
  danger,
}: {
  icon: ReactNode;
  title: string;
  note?: string;
  value?: string;
  trailing?: ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  const body = (
    <>
      <span className={cn("mt-0.5 shrink-0", danger ? "text-[var(--bad)]" : "text-accent")}>
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className={cn("block text-[14.5px] font-semibold leading-5", danger && "text-[var(--bad)]")}>
          {title}
        </span>
        {note ? (
          <span className="mt-0.5 block max-w-[620px] text-[12px] leading-[1.35] text-dim">
            {note}
          </span>
        ) : null}
      </span>
      {value ? (
        <span className="max-w-[46%] shrink-0 truncate text-[13px] font-semibold text-dim">
          {value}
        </span>
      ) : null}
      {trailing}
      {onClick && !trailing ? (
        <ChevronRight className="size-[19px] shrink-0 text-dim" aria-hidden />
      ) : null}
    </>
  );

  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex w-full items-start gap-3.5 px-4 py-3.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_3%,transparent)]"
      >
        {body}
      </button>
    );
  }

  return <div className="flex w-full items-start gap-3.5 px-4 py-3.5">{body}</div>;
}

function SettingsGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-4 first:mt-0">
      <h2 className="px-4 pb-2 pt-2 text-[11px] font-extrabold uppercase tracking-[0.08em] text-dim">
        {title}
      </h2>
      <div className="divide-y divide-line border-y border-line bg-card">{children}</div>
    </section>
  );
}

function SettingsShell({
  title,
  onBack,
  action,
  children,
}: {
  title: string;
  onBack: () => void;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="min-h-dvh bg-page text-ink">
      <header className="sticky top-0 z-30 flex h-[64px] items-center gap-2 border-b border-line bg-[color-mix(in_srgb,var(--page)_92%,transparent)] px-2 backdrop-blur-xl">
        <button type="button" onClick={onBack} className="icon-btn" aria-label="Back">
          <ArrowLeft className="size-6" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-[17px] font-extrabold">{title}</h1>
        {action}
      </header>
      <main className="mx-auto w-full max-w-[760px] pb-[calc(100px+env(safe-area-inset-bottom,0px))] md:pb-16">
        {children}
      </main>
    </div>
  );
}

function ChoiceModal<T extends string>({
  open,
  title,
  note,
  options,
  value,
  onSelect,
  onClose,
}: {
  open: boolean;
  title: string;
  note?: string;
  options: { key: T; name: string }[];
  value: T;
  onSelect: (value: T) => void;
  onClose: () => void;
}) {
  return (
    <Modal open={open} onClose={onClose} size="sm" hideClose>
      <div className="px-5 pb-2 pt-5">
        <h2 className="text-[18px] font-extrabold">{title}</h2>
        {note ? <p className="mt-1 text-[11px] leading-4 text-dim">{note}</p> : null}
      </div>
      <div className="pb-3">
        {options.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => {
              onSelect(option.key);
              onClose();
            }}
            className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]"
          >
            <span className="flex size-6 items-center justify-center text-ink">
              {option.key === "silent" ? <Volume2 className="size-4 text-dim" /> : option.key === "phone" ? <Phone className="size-4 text-dim" /> : <Music2 className="size-4 text-dim" />}
            </span>
            <span className="min-w-0 flex-1 text-[15px] font-semibold">{option.name}</span>
            {value === option.key ? <span className="text-[12px] font-semibold text-dim">On</span> : null}
          </button>
        ))}
      </div>
    </Modal>
  );
}

function statusLabel(status: PermissionStatus, t: (key: string) => string) {
  if (status === "granted") return t("Allowed");
  if (status === "denied") return t("Blocked");
  if (status === "unsupported") return t("Not available");
  if (status === "prompt") return t("Not asked");
  return "—";
}

function statusIcon(status: PermissionStatus) {
  if (status === "granted") return <CheckCircle2 className="size-5 shrink-0 text-[var(--good)]" />;
  if (status === "denied") return <X className="size-5 shrink-0 text-[var(--bad)]" />;
  if (status === "unsupported") return <CircleHelp className="size-5 shrink-0 text-dim" />;
  return <CircleHelp className="size-5 shrink-0 text-dim" />;
}

function emptyPermissionStatus(): Record<string, PermissionStatus> {
  return {
    notifications: "unknown",
    camera: "unknown",
    microphone: "unknown",
    location: "unknown",
    photos: "unsupported",
    contacts: "unsupported",
    bluetooth: "unsupported",
  };
}

export function SettingsPage() {
  const { user, updateUser, logout } = useAuth();
  const { design } = useTheme();
  const preferences = usePreferences();
  const { t } = preferences;
  const { toast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const view = viewFromParam(searchParams.get("section"));
  const [name, setName] = useState(user?.name || "");
  const [username, setUsername] = useState(user?.username || "");
  const [bio, setBio] = useState(user?.bio || "");
  const [savingProfile, setSavingProfile] = useState(false);
  const [uploading, setUploading] = useState<"avatar" | "cover" | null>(null);
  const [privacyBusy, setPrivacyBusy] = useState<string | null>(null);
  const [professionalBusy, setProfessionalBusy] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordBusy, setPasswordBusy] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [deactivationOpen, setDeactivationOpen] = useState(false);
  const [deactivationBusy, setDeactivationBusy] = useState(false);
  const [choice, setChoice] = useState<"sound" | "ringtone" | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [permissions, setPermissions] = useState<Record<string, PermissionStatus>>(emptyPermissionStatus);
  const [permissionBusy, setPermissionBusy] = useState<string | null>(null);
  const [verifyReason, setVerifyReason] = useState("");
  const [verifyKind, setVerifyKind] = useState("creator");
  const [verifyLinks, setVerifyLinks] = useState<string[]>([""]);
  const [verifyProof, setVerifyProof] = useState<File | null>(null);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [logoBusy, setLogoBusy] = useState<string | null>(null);
  const [marketTab, setMarketTab] = useState<"drip" | "themes" | "logos">("themes");
  const [proWork, setProWork] = useState("");
  const [proPlace, setProPlace] = useState("");
  const [proEmail, setProEmail] = useState("");
  const [proLinks, setProLinks] = useState("");
  const avatarInput = useRef<HTMLInputElement>(null);
  const coverInput = useRef<HTMLInputElement>(null);
  const proofInput = useRef<HTMLInputElement>(null);

  const contacts = useQuery({
    queryKey: ["contacts"],
    queryFn: () => api.get<{ allowed: boolean; asked: boolean }>("/auth/me/contacts/"),
    enabled: view === "permissions",
  });
  const devices = useQuery({
    queryKey: ["devices"],
    queryFn: () => api.get<Device[]>("/auth/devices/"),
    enabled: view === "devices",
  });
  const themeWallet = useQuery({
    queryKey: ["sparks-wallet"],
    queryFn: () => api.get<WalletData>("/sparks/wallet/"),
    enabled: view === "marketplace" || view === "logos",
  });
  const crew = useQuery({
    queryKey: ["settings-kept", user?.id],
    queryFn: async () => {
      const answer = await api.get<UserCard[] | { results?: UserCard[] }>(`/social/users/${user?.id}/crew/following/`);
      return Array.isArray(answer) ? answer : answer.results ?? [];
    },
    enabled: view === "kept" && Boolean(user?.id),
  });
  const verifyStatus = useQuery({
    queryKey: ["verify-status"],
    queryFn: () => api.get<Record<string, unknown>>("/verify/status/"),
    enabled: view === "verify",
  });

  useEffect(() => {
    setName(user?.name || "");
    setUsername(user?.username || "");
    setBio(user?.bio || "");
  }, [user?.id, user?.name, user?.username, user?.bio]);

  useEffect(() => {
    if (!user?.logo) return;
    if (user.logo !== preferences.logo) preferences.setLogo(user.logo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.logo]);

  useEffect(() => {
    const professional = user?.professional;
    if (!professional || typeof professional !== "object") return;
    setProWork(String(professional.work ?? professional.discipline ?? ""));
    setProPlace(String(professional.place ?? professional.location ?? ""));
    setProEmail(String(professional.email ?? ""));
    const links = professional.links;
    setProLinks(Array.isArray(links) ? links.join("\n") : String(links ?? ""));
  }, [user?.professional]);

  useEffect(() => {
    if (view !== "permissions") return;
    let cancelled = false;
    async function load() {
      const next = emptyPermissionStatus();
      next.notifications = typeof Notification === "undefined" ? "unsupported" : Notification.permission === "granted" ? "granted" : Notification.permission === "denied" ? "denied" : "prompt";
      next.location = typeof navigator.geolocation === "undefined" ? "unsupported" : "prompt";
      if (navigator.permissions?.query) {
        for (const key of ["camera", "microphone", "geolocation"] as const) {
          try {
            const answer = await navigator.permissions.query({ name: key as PermissionName });
            next[key === "geolocation" ? "location" : key] = answer.state === "granted" ? "granted" : answer.state === "denied" ? "denied" : "prompt";
          } catch {
            next[key === "geolocation" ? "location" : key] = "unknown";
          }
        }
      }
      if (!cancelled) setPermissions(next);
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [view]);

  useEffect(() => {
    if (view === "marketplace" && searchParams.get("tab") === "logos") setMarketTab("logos");
  }, [searchParams, view]);

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

  async function saveProfile() {
    if (savingProfile) return;
    setSavingProfile(true);
    try {
      const me = await api.patch<Me>("/auth/me/", {
        name: name.trim(),
        username: username.trim().toLowerCase(),
        bio: bio.trim(),
      });
      updateUser(me);
      toast({ title: t("Profile saved"), tone: "success" });
    } catch (error) {
      toast({
        title: "That did not save",
        description: error instanceof Error ? error.message : "Check the fields and try again.",
        tone: "error",
      });
    } finally {
      setSavingProfile(false);
    }
  }

  async function upload(kind: "avatar" | "cover", file?: File) {
    if (!file) return;
    setUploading(kind);
    try {
      const form = new FormData();
      form.append(kind, file);
      const me = await api.form<Me>(`/auth/me/${kind}/`, form);
      updateUser(me);
      toast({ title: kind === "avatar" ? "Avatar changed" : "Cover changed", tone: "success" });
    } catch (error) {
      toast({
        title: "That picture did not upload",
        description: error instanceof Error ? error.message : "Try a smaller image.",
        tone: "error",
      });
    } finally {
      setUploading(null);
    }
  }

  async function removePicture(kind: "avatar" | "cover") {
    setUploading(kind);
    try {
      const me = await api.delete<Me>(`/auth/me/${kind}/`);
      updateUser(me);
      toast({ title: kind === "avatar" ? "Avatar removed" : "Cover removed", tone: "success" });
    } catch (error) {
      toast({ title: "That did not work", description: error instanceof Error ? error.message : "Try again.", tone: "error" });
    } finally {
      setUploading(null);
    }
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

  async function toggleProfessional() {
    if (professionalBusy) return;
    setProfessionalBusy(true);
    const next = !professionalOn;
    try {
      let me: Me;
      try {
        me = await api.patch<Me>("/auth/me/professional/", { enabled: next });
      } catch {
        me = await api.patch<Me>("/auth/me/professional/", { professional: next });
      }
      updateUser(me);
      toast({ title: next ? "Professional profile is on" : "Professional profile is off", tone: "success" });
      if (next) goSubpage("professional");
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

  async function saveProfessional() {
    setProfessionalBusy(true);
    try {
      const links = proLinks.split(/\s+/).map((line) => line.trim()).filter(Boolean);
      let me: Me;
      try {
        me = await api.patch<Me>("/auth/me/professional/", {
          enabled: true,
          work: proWork.trim(),
          place: proPlace.trim(),
          email: proEmail.trim(),
          links,
        });
      } catch {
        me = await api.patch<Me>("/auth/me/professional/", {
          professional: {
            work: proWork.trim(),
            place: proPlace.trim(),
            email: proEmail.trim(),
            links,
          },
        });
      }
      updateUser(me);
      toast({ title: "Professional details saved.", tone: "success" });
    } catch (error) {
      toast({
        title: "Those details did not save",
        description: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    } finally {
      setProfessionalBusy(false);
    }
  }

  async function changePassword(event: FormEvent) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ title: "The new passwords do not match", tone: "error" });
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
      toast({ title: "Password changed", tone: "success" });
    } catch (error) {
      toast({
        title: "The password did not change",
        description: error instanceof Error ? error.message : "Check your current password.",
        tone: "error",
      });
    } finally {
      setPasswordBusy(false);
    }
  }

  async function removeDevice(device: Device) {
    try {
      await api.delete(`/auth/devices/${device.id}/`);
      await queryClient.invalidateQueries({ queryKey: ["devices"] });
      toast({ title: "Signed out on that device", tone: "success" });
    } catch (error) {
      toast({ title: "That device did not sign out", description: error instanceof Error ? error.message : "Try again.", tone: "error" });
    }
  }

  async function signOutEverywhere() {
    try {
      await api.delete("/auth/devices/others/");
      await queryClient.invalidateQueries({ queryKey: ["devices"] });
      toast({ title: "Every other phone is signed out", tone: "success" });
    } catch (error) {
      toast({ title: "That did not work", description: error instanceof Error ? error.message : "Try again.", tone: "error" });
    }
  }

  async function signOut() {
    await logout();
    navigate("/", { replace: true });
  }

  async function deactivateAccount() {
    setDeactivationBusy(true);
    try {
      await api.post("/auth/deactivate/", {});
      toast({ title: "Account deleted", tone: "success" });
      await logout();
      navigate("/", { replace: true });
    } catch (error) {
      toast({ title: "Could not delete account", description: error instanceof Error ? error.message : "Try again.", tone: "error" });
      setDeactivationBusy(false);
    }
  }

  async function toggleNotifications() {
    if (preferences.notifications) {
      preferences.setNotifications(false);
      toast({ title: "Notifications are off", tone: "success" });
      return;
    }
    if (typeof Notification === "undefined") {
      preferences.setNotifications(true);
      toast({ title: "Notifications are on", description: "This browser does not support system notifications.", tone: "info" });
      return;
    }
    const result = await Notification.requestPermission();
    if (result === "granted") {
      preferences.setNotifications(true);
      toast({ title: "Notifications are on", tone: "success" });
    } else {
      preferences.setNotifications(false);
      toast({ title: "Notifications stay off", description: "The browser did not give permission.", tone: "error" });
    }
  }

  async function requestPermission(kind: string) {
    setPermissionBusy(kind);
    try {
      if (kind === "notifications") {
        if (typeof Notification === "undefined") throw new Error("This browser does not support notifications.");
        const result = await Notification.requestPermission();
        if (result === "granted") preferences.setNotifications(true);
        setPermissions((current) => ({ ...current, notifications: result === "granted" ? "granted" : result === "denied" ? "denied" : "prompt" }));
      } else if (kind === "camera" || kind === "microphone") {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error("This browser cannot ask for that.");
        const stream = await navigator.mediaDevices.getUserMedia({ [kind]: true });
        stream.getTracks().forEach((track) => track.stop());
        setPermissions((current) => ({ ...current, [kind]: "granted" }));
      } else if (kind === "location") {
        if (!navigator.geolocation) throw new Error("This browser cannot ask for that.");
        await new Promise<void>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(() => resolve(), (error) => reject(new Error(error.message)));
        });
        setPermissions((current) => ({ ...current, location: "granted" }));
      } else {
        throw new Error("That permission is not available in a browser.");
      }
      toast({ title: "Permission updated", tone: "success" });
    } catch (error) {
      toast({
        title: "That permission did not change",
        description: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    } finally {
      setPermissionBusy(null);
    }
  }

  async function resetVault() {
    if (!resetPassword) return;
    setResetBusy(true);
    try {
      try {
        await api.post("/chat/vault/reset/", { password: resetPassword });
      } catch {
        await api.post("/chat/vault/reset/", { current_password: resetPassword });
      }
      setResetPassword("");
      setResetOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["vault"] });
      toast({ title: "Lock chat reset", description: "Every chat inside the vault was deleted.", tone: "success" });
    } catch (error) {
      toast({
        title: "That password did not work",
        description: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    } finally {
      setResetBusy(false);
    }
  }

  async function buyLogo(key: string) {
    setLogoBusy(key);
    try {
      let result: { charged?: boolean; balance?: number };
      try {
        result = await api.post<{ charged?: boolean; balance?: number }>("/sparks/wallet/buy-logo/", { key });
      } catch {
        result = await api.post<{ charged?: boolean; balance?: number }>("/sparks/wallet/buy-logo/", { logo: key });
      }
      await queryClient.invalidateQueries({ queryKey: ["sparks-wallet"] });
      toast({
        title: `${LOGO_NAME(key)} is open`,
        description: result.charged ? "You can wear it now." : "It was already open.",
        tone: "success",
      });
      await applyLogo(key);
    } catch (error) {
      toast({
        title: "Could not open that logo",
        description: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    } finally {
      setLogoBusy(null);
    }
  }

  async function applyLogo(key: string) {
    setLogoBusy(key);
    const previous = preferences.logo;
    preferences.setLogo(key);
    try {
      let answer: Me;
      try {
        answer = await api.patch<Me>("/auth/me/logo/", { logo: key });
      } catch {
        answer = await api.patch<Me>("/auth/me/logo/", { key });
      }
      updateUser({ ...answer, logo: key });
      toast({ title: `${LOGO_NAME(key)} is on`, tone: "success" });
    } catch (error) {
      preferences.setLogo(previous);
      toast({
        title: "That logo did not save",
        description: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    } finally {
      setLogoBusy(null);
    }
  }

  async function submitVerification(event: FormEvent) {
    event.preventDefault();
    if (!verifyReason.trim()) {
      toast({ title: "Tell them why this account is really you.", tone: "error" });
      return;
    }
    setVerifyBusy(true);
    try {
      const links = verifyLinks.map((link) => link.trim()).filter(Boolean);
      if (verifyProof) {
        const form = new FormData();
        form.append("reason", verifyReason.trim());
        form.append("kind", verifyKind);
        form.append("links", JSON.stringify(links));
        form.append("proof", verifyProof);
        await api.form("/verify/requests/", form);
      } else {
        await api.post("/verify/requests/", { reason: verifyReason.trim(), kind: verifyKind, links });
      }
      await queryClient.invalidateQueries({ queryKey: ["verify-status"] });
      setVerifyReason("");
      setVerifyLinks([""]);
      setVerifyProof(null);
      toast({ title: "Verification request sent", tone: "success" });
    } catch (error) {
      toast({
        title: "That request did not send",
        description: error instanceof Error ? error.message : "Try again.",
        tone: "error",
      });
    } finally {
      setVerifyBusy(false);
    }
  }

  async function withdrawVerification() {
    try {
      await api.post("/verify/requests/withdraw/", {});
      await queryClient.invalidateQueries({ queryKey: ["verify-status"] });
      toast({ title: "Verification request withdrawn", tone: "success" });
    } catch (error) {
      toast({ title: "Could not withdraw that request", description: error instanceof Error ? error.message : "Try again.", tone: "error" });
    }
  }

  if (!user) return null;

  const professionalOn =
    typeof user.professional === "boolean"
      ? user.professional
      : Boolean(user.professional);
  const wallet = themeWallet.data;
  const ownedLogos = new Set(wallet?.owned_logos ?? (wallet as (WalletData & { logos?: string[] }) | undefined)?.logos ?? []);
  const logoKey = preferences.logo || "pink";
  const languageLabel =
    preferences.language === "system"
      ? t("System default")
      : preferences.language === "hi"
        ? t("Hindi")
        : preferences.language === "ar"
          ? t("Arabic")
          : t("English");
  const soundLabel = MESSAGE_SOUNDS.find((item) => item.key === preferences.messageSound)?.name ?? "Note";
  const ringtoneLabel = RINGTONES.find((item) => item.key === preferences.ringtone)?.name ?? "Phone ringtone";
  const verify = verifyStatus.data ?? {};
  const verifyPending =
    verify.status === "pending" ||
    verify.state === "pending" ||
    (typeof verify.request === "object" && verify.request !== null && (verify.request as Record<string, unknown>).status === "pending");
  const verifyVerified =
    verify.status === "verified" ||
    verify.verified === true ||
    Boolean(user.verified_at);

  const profileHeaderAction = view === "profile" ? (
    <button
      type="button"
      onClick={() => void saveProfile()}
      disabled={savingProfile || !name.trim() || !username.trim()}
      className="min-h-9 rounded-full px-3 text-[13px] font-extrabold text-accent disabled:opacity-40"
    >
      {savingProfile ? "Saving…" : t("Save")}
    </button>
  ) : view === "professional" ? (
    <button
      type="button"
      onClick={() => void saveProfessional()}
      disabled={professionalBusy}
      className="min-h-9 rounded-full px-3 text-[13px] font-extrabold text-accent disabled:opacity-40"
    >
      {professionalBusy ? "Saving…" : t("Save")}
    </button>
  ) : null;

  const title =
    view === "root"
      ? t("Controls")
      : view === "profile"
        ? "Refine profile"
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
                    : view === "logos"
                      ? t("App logo")
                      : view === "verify"
                        ? t("Get verified")
                        : view === "kept"
                          ? t("Kept")
                          : view === "devices"
                            ? t("Where you are signed in")
                            : t("Controls");

  return (
    <SettingsShell title={title} onBack={goBack} action={profileHeaderAction}>
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
                  onChange={() => void privacy({ is_private: !user.is_private })}
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
                  onChange={() => void privacy({ allow_sensitive: !user.allow_sensitive })}
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
                  onChange={() => void toggleProfessional()}
                  disabled={professionalBusy}
                  label={t("Professional profile")}
                />
              }
            />
          </SettingsGroup>

          <SettingsGroup title={t("How you look")}>
            <SettingsRow
              icon={<Store className="size-5" />}
              title={t("Marketplace")}
              note="The character in your convos, and the colour of the app."
              value={design.name}
              onClick={() => goSubpage("marketplace")}
            />
            <SettingsRow
              icon={<Palette className="size-5" />}
              title={t("App logo")}
              note="The mark in the corner of every screen."
              value={LOGO_NAME(logoKey)}
              onClick={() => goSubpage("logos")}
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
              onClick={() => setLogoutOpen(true)}
            />
            <SettingsRow
              icon={<Trash2 className="size-5" />}
              title={t("Delete account")}
              note="Hidden right away, kept for 30 days, then gone for good."
              danger
              onClick={() => setDeactivationOpen(true)}
            />
          </SettingsGroup>

          {user.is_staff ? (
            <SettingsGroup title={t("Owner tools")}>
              <SettingsRow
                icon={<ShieldCheck className="size-5" />}
                title={t("Console")}
                note="Accounts, drops, moments, audio and rooms — and who did what about them."
                onClick={() => toast({ title: "The console is available in the Android app.", tone: "info" })}
              />
            </SettingsGroup>
          ) : null}
        </>
      ) : null}

      {view === "profile" ? (
        <div className="space-y-4 px-4 py-4">
          <section className="rounded-[18px] border border-line bg-card">
            <div className="relative h-32 bg-[color-mix(in_srgb,var(--accent)_8%,var(--card))]">
              <AuthedImage
                src={user.cover}
                alt="Cover"
                className="h-full w-full"
                fallback={<div className="h-full w-full bg-[radial-gradient(circle_at_20%_20%,var(--accent-soft),transparent_60%)]" />}
              />
              <div className="absolute bottom-2 right-2">
                <button
                  type="button"
                  onClick={() => coverInput.current?.click()}
                  disabled={uploading === "cover"}
                  className="flex size-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur"
                  aria-label={t("Change cover")}
                >
                  <ImagePlus className="size-4" />
                </button>
                <input ref={coverInput} type="file" accept="image/*" className="hidden" onChange={(event) => void upload("cover", event.target.files?.[0])} />
              </div>
            </div>
            <div className="relative px-4 pb-4">
              <div className="-mt-10 flex items-end gap-3">
                <div className="relative">
                  <Avatar user={user} size={80} className="border-4 border-[var(--card)]" />
                  <button
                    type="button"
                    onClick={() => avatarInput.current?.click()}
                    disabled={uploading === "avatar"}
                    className="absolute -bottom-1 -right-1 flex size-7 items-center justify-center rounded-full border-2 border-[var(--card)] bg-card text-accent shadow"
                    aria-label={t("Change photo")}
                  >
                    <Camera className="size-3.5" />
                  </button>
                  <input ref={avatarInput} type="file" accept="image/*" className="hidden" onChange={(event) => void upload("avatar", event.target.files?.[0])} />
                </div>
                <div className="pb-1">
                  <p className="text-[14px] font-extrabold">{user.name}</p>
                  <p className="text-[11px] text-dim">@{user.username}</p>
                </div>
              </div>
              <p className="mt-3 text-center text-[12px] font-bold text-accent">
                {t("Change photo")}
              </p>
              {user.avatar ? (
                <button type="button" onClick={() => void removePicture("avatar")} className="mt-1 text-[10px] font-bold text-dim hover:text-[var(--bad)]">
                  Remove avatar
                </button>
              ) : null}
            </div>
          </section>

          <form
            className="space-y-4 rounded-[18px] border border-line bg-card p-4"
            onSubmit={(event) => {
              event.preventDefault();
              void saveProfile();
            }}
          >
            <label className="block">
              <FieldLabel>{t("Name")}</FieldLabel>
              <input value={name} onChange={(event) => setName(event.target.value)} maxLength={80} className="field" />
            </label>
            <label className="block">
              <FieldLabel>{t("Handle")}</FieldLabel>
              <div className="flex items-center rounded-[14px] border border-line bg-card px-3">
                <span className="text-[15px] font-semibold text-dim">@</span>
                <input value={username} onChange={(event) => setUsername(event.target.value)} maxLength={30} className="min-w-0 flex-1 bg-transparent py-3 text-[15px] font-semibold outline-none" autoCapitalize="none" spellCheck={false} />
              </div>
              <p className="mt-1.5 text-[11px] text-dim">Letters, numbers and underscores. Lowercase.</p>
            </label>
            <label className="block">
              <FieldLabel>{t("Era")}</FieldLabel>
              <textarea value={bio} onChange={(event) => setBio(event.target.value)} rows={5} maxLength={160} className="field resize-none" placeholder="A line about you" />
              <span className="mt-1 block text-right text-[10px] text-dim">{bio.length}/160</span>
            </label>
            <p className="text-[11px] leading-4 text-dim">The photo and the cover go up as soon as you choose them. Everything else waits for Save.</p>
          </form>

          <section className="rounded-[18px] border border-line bg-card p-4">
            <h2 className="text-[13px] font-extrabold">Password</h2>
            <form className="mt-3 space-y-2.5" onSubmit={(event) => void changePassword(event)}>
              <input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} placeholder="Current password" className="field" autoComplete="current-password" />
              <input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="New password (8+ characters)" className="field" autoComplete="new-password" minLength={8} />
              <input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Repeat the new password" className="field" autoComplete="new-password" minLength={8} />
              <div className="flex justify-end">
                <Button type="submit" size="sm" loading={passwordBusy} disabled={!currentPassword || newPassword.length < 8 || newPassword !== confirmPassword}>
                  Change password
                </Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}

      {view === "language" ? (
        <div>
          <p className="px-4 py-3 text-[12px] leading-5 text-dim">
            Changes the words in the app. Your messages, names and posts stay exactly as they are.
          </p>
          <div className="divide-y divide-line border-y border-line bg-card">
            {([
              ["system", t("System default"), t("Follow the phone")],
              ["en", t("English"), ""],
              ["hi", t("Hindi"), ""],
              ["ar", t("Arabic"), ""],
            ] as const).map(([key, label, note]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  preferences.setLanguage(key as AppLanguage);
                  toast({ title: `${label} selected`, tone: "success" });
                }}
                className="flex w-full items-center gap-3 px-4 py-4 text-left"
              >
                <span className="flex size-8 items-center justify-center text-accent">
                  {key === "system" ? <Smartphone className="size-5" /> : <Languages className="size-5" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[15px] font-semibold">{label}</span>
                  {note ? <span className="mt-0.5 block text-[12px] text-dim">{note}</span> : null}
                </span>
                {preferences.language === key ? <Check className="size-5 text-accent" /> : <ChevronRight className="size-5 text-dim" />}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {view === "notifications" ? (
        <div>
          <div className="divide-y divide-line border-y border-line bg-card">
            <SettingsRow
              icon={<Bell className="size-5" />}
              title={t("Notifications")}
              note="Calls and convos, wherever you are in the app."
              trailing={<SettingsSwitch on={preferences.notifications} onChange={() => void toggleNotifications()} label={t("Notifications")} />}
            />
            <SettingsRow
              icon={<Smartphone className="size-5" />}
              title={t("Calls over the lock screen")}
              note="A call takes the screen, even while the phone is locked."
              value={typeof Notification !== "undefined" && Notification.permission === "granted" ? t("Allowed") : t("Not available")}
              trailing={<CheckCircle2 className={cn("size-5 shrink-0", typeof Notification !== "undefined" && Notification.permission === "granted" ? "text-[var(--good)]" : "text-dim")} />}
            />
            <SettingsRow
              icon={<Music2 className="size-5" />}
              title={t("Message sound")}
              note="The note a line makes while you are in the app."
              value={soundLabel}
              onClick={() => setChoice("sound")}
            />
            <SettingsRow
              icon={<Phone className="size-5" />}
              title={t("Ringtone")}
              note="Plays while you are in the app. In your pocket the call is rung by the phone."
              value={ringtoneLabel}
              onClick={() => setChoice("ringtone")}
            />
          </div>
          <p className="px-4 py-3 text-[11px] leading-5 text-dim">
            Browser notifications are only shown when this tab is in the background. The lock-screen call view is part of the Android app.
          </p>
        </div>
      ) : null}

      {view === "permissions" ? (
        <div>
          <p className="px-4 py-3 text-[12px] leading-5 text-dim">
            These are the permissions this browser has been given. Tap a row to ask again where the browser allows it.
          </p>
          <div className="divide-y divide-line border-y border-line bg-card">
            {([
              ["notifications", t("Notifications"), "Calls and messages, wherever you are in the app.", <Bell className="size-5" />],
              ["camera", t("Camera"), "Photos, videos, and the picture on a video call.", <Camera className="size-5" />],
              ["microphone", t("Microphone"), "Voice notes and the audio on a call.", <Mic className="size-5" />],
              ["photos", t("Photos and media"), "Choosing a photo or a video to share.", <ImageIcon className="size-5" />],
              ["contacts", t("Contacts"), "Finding the people you already know who are here.", <Contact className="size-5" />],
              ["location", t("Location"), "Where a drop was taken, and — when you allow it — the place each post was made from.", <MapPin className="size-5" />],
              ["bluetooth", t("Bluetooth"), "Offering a headset during a call.", <Bluetooth className="size-5" />],
            ] as const).map(([key, title, note, icon]) => {
              const status = permissions[key] ?? "unknown";
              return (
                <SettingsRow
                  key={key}
                  icon={icon}
                  title={title}
                  note={note}
                  value={statusLabel(status, t)}
                  trailing={statusIcon(status)}
                  onClick={permissionBusy === key || status === "unsupported" ? undefined : () => void requestPermission(key)}
                />
              );
            })}
          </div>
          {contacts.data?.allowed ? (
            <p className="px-4 py-3 text-[11px] leading-5 text-dim">Contacts were allowed by the Android app. This browser cannot read your address book.</p>
          ) : null}
        </div>
      ) : null}

      {view === "lock" ? (
        <div>
          <div className="space-y-4 px-5 py-6 text-[14px] leading-6">
            <p className="flex gap-3"><span className="text-dim">•</span>If a lock is set, every chat inside the vault is deleted when you reset.</p>
            <p className="flex gap-3"><span className="text-dim">•</span>If no lock is set, resetting still clears the lock, and the chats inside are deleted too.</p>
            <p className="flex gap-3"><span className="text-dim">•</span>After a reset, everyone can reach you again — your contacts can start a convo.</p>
            <p className="flex gap-3"><span className="text-dim">•</span>You are asked for your account password first. The reset only happens if it is correct.</p>
          </div>
          <div className="border-y border-line bg-card">
            <button
              type="button"
              onClick={() => setResetOpen(true)}
              className="flex w-full items-center gap-3 px-4 py-5 text-left text-[15px] font-extrabold text-[var(--bad)]"
            >
              <KeyRound className="size-5" />
              {t("Reset password now")}
            </button>
          </div>
        </div>
      ) : null}

      {view === "professional" ? (
        <div className="space-y-4 px-4 py-4">
          <p className="text-[12px] leading-5 text-dim">
            What you do, where you are, a public email and your links.
          </p>
          <div className="space-y-4 rounded-[18px] border border-line bg-card p-4">
            <label className="block">
              <FieldLabel>What you do</FieldLabel>
              <input value={proWork} onChange={(event) => setProWork(event.target.value)} className="field" placeholder="Creator, studio, photographer…" />
            </label>
            <label className="block">
              <FieldLabel>Where you are</FieldLabel>
              <input value={proPlace} onChange={(event) => setProPlace(event.target.value)} className="field" placeholder="City or country" />
            </label>
            <label className="block">
              <FieldLabel>Public email</FieldLabel>
              <input value={proEmail} onChange={(event) => setProEmail(event.target.value)} type="email" className="field" placeholder="you@example.com" />
            </label>
            <label className="block">
              <FieldLabel>Links</FieldLabel>
              <textarea value={proLinks} onChange={(event) => setProLinks(event.target.value)} rows={3} className="field resize-none" placeholder={"https://…\nhttps://…"} />
              <p className="mt-1 text-[10px] text-dim">One link per line.</p>
            </label>
          </div>
          <p className="text-[11px] leading-4 text-dim">Paid collaborations you send or receive show up in the collabs shelf.</p>
        </div>
      ) : null}

      {view === "marketplace" ? (
        <div>
          <div className="border-b border-line bg-page px-4">
            <div className="flex justify-center gap-2">
              {(["drip", "themes", "logos"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setMarketTab(tab)}
                  className={cn(
                    "relative px-4 py-3 text-[13px] font-extrabold capitalize transition",
                    marketTab === tab ? "text-ink" : "text-dim hover:text-ink",
                  )}
                >
                  {tab === "drip" ? "Drip" : tab === "themes" ? "Themes" : "Logos"}
                  {marketTab === tab ? <span className="absolute inset-x-2 -bottom-px h-[3px] rounded-full bg-accent" /> : null}
                </button>
              ))}
            </div>
          </div>
          <div className="px-4 py-4">
            {marketTab === "drip" ? (
              <div className="rounded-[18px] border border-line bg-card p-4">
                <div className="flex items-center gap-3">
                  <span className="flex size-14 items-center justify-center rounded-full bg-[var(--accent-soft)] text-2xl font-extrabold text-accent">
                    {design.character.slice(0, 2)}
                  </span>
                  <div>
                    <p className="text-[15px] font-extrabold">{design.character}</p>
                    <p className="text-[11px] text-dim">The character that stands in your convos.</p>
                  </div>
                </div>
                <p className="mt-4 text-[11px] leading-5 text-dim">
                  A character travels with the theme you wear. Pick a theme to change who appears while you type.
                </p>
                <Button size="sm" className="mt-3" onClick={() => setMarketTab("themes")} icon={<Palette className="size-3.5" />}>
                  Browse themes
                </Button>
              </div>
            ) : themeWallet.isLoading ? (
              <div className="flex justify-center py-12"><Spinner className="size-6 text-accent" /></div>
            ) : themeWallet.isError || !wallet ? (
              <ErrorState error={themeWallet.error} onRetry={() => void themeWallet.refetch()} />
            ) : marketTab === "themes" ? (
              <ThemeShop wallet={wallet} />
            ) : (
              <LogoShop
                wallet={wallet}
                selected={logoKey}
                busy={logoBusy}
                onApply={(key) => void (ownedLogos.has(key) || key === "pink" ? applyLogo(key) : buyLogo(key))}
              />
            )}
          </div>
        </div>
      ) : null}

      {view === "logos" ? (
        themeWallet.isLoading ? (
          <div className="flex justify-center py-12"><Spinner className="size-6 text-accent" /></div>
        ) : themeWallet.isError || !wallet ? (
          <div className="p-4"><ErrorState error={themeWallet.error} onRetry={() => void themeWallet.refetch()} /></div>
        ) : (
          <div className="px-4 py-4">
            <LogoShop
              wallet={wallet}
              selected={logoKey}
              busy={logoBusy}
              onApply={(key) => void (ownedLogos.has(key) || key === "pink" ? applyLogo(key) : buyLogo(key))}
            />
          </div>
        )
      ) : null}

      {view === "verify" ? (
        <div className="space-y-4 px-4 py-4">
          <div className="rounded-[18px] border border-line bg-card p-5">
            <BadgeCheck className="size-9 text-[#1d9bf0]" />
            <h2 className="mt-3 text-[20px] font-extrabold">The blue mark</h2>
            <p className="mt-2 text-[12px] leading-5 text-dim">It tells everyone an account is who it says it is. Here is what it gives you, and what it asks of you.</p>
            <div className="mt-4 space-y-3 text-[12px] leading-5">
              <p><strong>What the mark gives you</strong></p>
              <p className="text-dim">A blue check on your profile and beside your name everywhere it shows — comments, moments, chat.</p>
              <p className="text-dim">It says the account is really you, so nobody else can pass themselves off as you.</p>
              <p className="text-dim">People who find you know at a glance they have found the real one.</p>
              <p><strong>What it asks of you</strong></p>
              <p className="text-dim">Real proof of who you are — a document or a page that backs it up.</p>
              <p className="text-dim">It lasts a set stretch of time, and has to be renewed when that runs out.</p>
              <p className="text-dim">A person reads every request, so an answer takes a little while.</p>
            </div>
          </div>

          {verifyVerified ? (
            <div className="flex items-center gap-3 rounded-[18px] border border-[var(--good)]/30 bg-[color-mix(in_srgb,var(--good)_6%,var(--card))] p-4 text-[13px] font-semibold">
              <BadgeCheck className="size-5 text-[#1d9bf0]" /> This account is verified.
            </div>
          ) : verifyPending ? (
            <div className="rounded-[18px] border border-line bg-card p-4">
              <p className="text-[13px] font-extrabold">Your request is with a person.</p>
              <p className="mt-1 text-[11px] leading-5 text-dim">You can withdraw it and send a new one later.</p>
              <Button size="sm" variant="secondary" className="mt-3" onClick={() => void withdrawVerification()}>
                Withdraw request
              </Button>
            </div>
          ) : (
            <form className="space-y-4 rounded-[18px] border border-line bg-card p-4" onSubmit={(event) => void submitVerification(event)}>
              <h2 className="text-[15px] font-extrabold">Your request</h2>
              <label className="block">
                <FieldLabel>Why should you be verified?</FieldLabel>
                <textarea value={verifyReason} onChange={(event) => setVerifyReason(event.target.value)} rows={4} maxLength={500} className="field resize-none" placeholder="Who you are, and why the mark belongs on your account." />
              </label>
              <div>
                <FieldLabel>What kind of account is this?</FieldLabel>
                <div className="flex flex-wrap gap-2">
                  {ACCOUNT_KINDS.map((kind) => (
                    <button
                      key={kind}
                      type="button"
                      onClick={() => setVerifyKind(kind)}
                      className={cn(
                        "rounded-full border px-3.5 py-2 text-[12px] font-bold capitalize transition",
                        verifyKind === kind ? "border-accent bg-accent text-on-accent" : "border-line text-dim",
                      )}
                    >
                      {kind === "business" ? "Business or brand" : kind}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <FieldLabel>Links</FieldLabel>
                <p className="mb-2 text-[10px] text-dim">A site, a profile, a page — anywhere that shows this is you.</p>
                <div className="space-y-2">
                  {verifyLinks.map((link, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <div className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-[12px] border border-line px-3">
                        <Link2 className="size-4 shrink-0 text-dim" />
                        <input
                          value={link}
                          onChange={(event) => setVerifyLinks((current) => current.map((row, rowIndex) => rowIndex === index ? event.target.value : row))}
                          placeholder="https://"
                          className="min-w-0 flex-1 bg-transparent py-2 text-[12px] outline-none"
                        />
                      </div>
                      {verifyLinks.length > 1 ? (
                        <button type="button" onClick={() => setVerifyLinks((current) => current.filter((_, rowIndex) => rowIndex !== index))} className="icon-btn" aria-label="Remove link">
                          <X className="size-4" />
                        </button>
                      ) : null}
                    </div>
                  ))}
                </div>
                <button type="button" onClick={() => setVerifyLinks((current) => [...current, ""])} className="mt-2 flex items-center gap-1.5 text-[12px] font-bold text-accent">
                  <span className="text-[18px] leading-none">+</span> Add another link
                </button>
              </div>
              <div>
                <FieldLabel>Proof</FieldLabel>
                <p className="text-[10px] leading-4 text-dim">A photo or a file that backs up who you are. Optional, but it helps.</p>
                <input ref={proofInput} type="file" accept="image/*,application/pdf" className="hidden" onChange={(event) => setVerifyProof(event.target.files?.[0] ?? null)} />
                <button type="button" onClick={() => proofInput.current?.click()} className="mt-2 flex items-center gap-2 text-[12px] font-bold text-accent">
                  <FileUp className="size-4" /> {verifyProof ? verifyProof.name : "Add a document"}
                </button>
              </div>
              <Button type="submit" loading={verifyBusy} disabled={!verifyReason.trim()} className="w-full">
                {t("Submit request")}
              </Button>
            </form>
          )}
        </div>
      ) : null}

      {view === "kept" ? (
        <div>
          {crew.isLoading ? (
            <div className="flex justify-center py-12"><Spinner className="size-6 text-accent" /></div>
          ) : crew.isError ? (
            <div className="p-4"><ErrorState error={crew.error} onRetry={() => void crew.refetch()} /></div>
          ) : !crew.data?.length ? (
            <div className="px-4 py-16 text-center">
              <Users className="mx-auto size-8 text-dim" />
              <p className="mt-3 text-[14px] font-extrabold">Nobody kept yet</p>
              <p className="mt-1 text-[11px] text-dim">Keep someone and they turn up here.</p>
            </div>
          ) : (
            <div className="divide-y divide-line border-y border-line bg-card">
              {crew.data.map((person) => (
                <Link key={person.id} to={`/app/u/${person.username}`} className="flex items-center gap-3 px-4 py-3 transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)]">
                  <Avatar user={person} size={44} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold">{person.name || person.username}</span>
                    <span className="block truncate text-[11px] text-dim">@{person.username}</span>
                  </span>
                  {person.is_private ? <Lock className="size-3.5 shrink-0 text-dim" /> : null}
                  <ChevronRight className="size-4 shrink-0 text-dim" />
                </Link>
              ))}
            </div>
          )}
        </div>
      ) : null}

      {view === "devices" ? (
        <div className="px-4 py-4">
          <p className="mb-4 text-[12px] leading-5 text-dim">
            Every phone this account is signed in on. If one of them is not yours, sign it out — it stops working straight away.
          </p>
          {devices.isLoading ? (
            <div className="flex justify-center py-12"><Spinner className="size-6 text-accent" /></div>
          ) : devices.isError ? (
            <ErrorState error={devices.error} onRetry={() => void devices.refetch()} />
          ) : !devices.data?.length ? (
            <p className="py-10 text-center text-[12px] text-dim">No sessions are registered.</p>
          ) : (
            <div className="space-y-3">
              {devices.data.map((device, index) => {
                const current = device.current === true;
                return (
                  <article key={device.id} className={cn("rounded-[18px] border bg-card p-4", current ? "border-accent" : "border-line")}>
                    <div className="flex items-start gap-3">
                      <span className="flex size-9 items-center justify-center rounded-[10px] border-2 border-accent text-accent">
                        <Smartphone className="size-5" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="text-[15px] font-extrabold">{device.name || device.platform || "A device"}</h2>
                          {device.first || index === 0 ? (
                            <span className="rounded-full bg-surface-2 px-2 py-1 text-[9px] font-extrabold text-dim">First device</span>
                          ) : null}
                          {current ? (
                            <span className="rounded-full bg-accent px-2 py-1 text-[9px] font-extrabold text-on-accent">This device</span>
                          ) : null}
                        </div>
                        <div className="mt-2 space-y-1 text-[11px] text-dim">
                          <p className="flex items-center gap-1.5"><MapPin className="size-3.5" />{device.location || "No place on record"}</p>
                          <p className="flex items-center gap-1.5"><Phone className="size-3.5" />Last active {device.last_active ? relativeTime(device.last_active) : "—"}{device.created_at || device.signed_in_at ? ` · signed in ${relativeTime(device.created_at ?? device.signed_in_at ?? "")}` : ""}</p>
                          {device.ip ? <p className="flex items-center gap-1.5"><span className="text-[13px] leading-none">#</span>{device.ip}</p> : null}
                        </div>
                      </div>
                      {!current ? (
                        <button type="button" onClick={() => void removeDevice(device)} className="shrink-0 text-[12px] font-extrabold text-[var(--bad)]">Remove</button>
                      ) : null}
                    </div>
                  </article>
                );
              })}
              <button type="button" onClick={() => void signOutEverywhere()} className="flex w-full items-center gap-3 rounded-[18px] border border-line bg-card p-4 text-left">
                <LogOut className="size-5 text-[var(--bad)]" />
                <span>
                  <span className="block text-[14px] font-extrabold text-[var(--bad)]">Sign out everywhere else</span>
                  <span className="mt-0.5 block text-[11px] text-dim">Every phone but this one, in one press.</span>
                </span>
              </button>
              <div className="px-1 py-3">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-dim">What is kept</p>
                <p className="mt-2 text-[11px] leading-5 text-dim">Where a device is comes from the address it signed in from, worked out as a city and a country — never a street, and nothing the app had to ask permission for.</p>
              </div>
            </div>
          )}
        </div>
      ) : null}

      <ChoiceModal
        open={choice === "sound"}
        title={t("Message sound")}
        options={MESSAGE_SOUNDS.map((item) => ({ key: item.key, name: t(item.name) }))}
        value={preferences.messageSound}
        onClose={() => setChoice(null)}
        onSelect={(value) => {
          preferences.setMessageSound(value);
          preferences.playMessageSound(value);
          toast({ title: `${t(MESSAGE_SOUNDS.find((item) => item.key === value)?.name ?? "Note")} selected`, tone: "success" });
        }}
      />
      <ChoiceModal
        open={choice === "ringtone"}
        title={t("Ringtone")}
        note="While you are in the app."
        options={RINGTONES.map((item) => ({ key: item.key, name: t(item.name) }))}
        value={preferences.ringtone}
        onClose={() => setChoice(null)}
        onSelect={(value) => {
          preferences.setRingtone(value);
          preferences.playRingtone(value);
          toast({ title: `${t(RINGTONES.find((item) => item.key === value)?.name ?? "Phone ringtone")} selected`, tone: "success" });
        }}
      />

      <Modal open={resetOpen} onClose={() => setResetOpen(false)} title={t("Lock chat")} description="Your account password resets the vault. Everything inside is deleted." size="sm">
        <div className="space-y-3 p-5">
          <label className="block">
            <FieldLabel>Account password</FieldLabel>
            <input type="password" value={resetPassword} onChange={(event) => setResetPassword(event.target.value)} className="field" autoComplete="current-password" />
          </label>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setResetOpen(false)}>{t("Cancel")}</Button>
            <Button variant="danger" loading={resetBusy} disabled={!resetPassword} onClick={() => void resetVault()}>
              {t("Reset password now")}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={logoutOpen}
        onClose={() => setLogoutOpen(false)}
        onConfirm={() => {
          setLogoutOpen(false);
          void signOut();
        }}
        title="Log out of Xelvic?"
        body="This browser will forget the session. Your account stays exactly as it is."
        confirmLabel="Log out"
        destructive
      />

      <ConfirmDialog
        open={deactivationOpen}
        onClose={() => setDeactivationOpen(false)}
        onConfirm={() => {
          setDeactivationOpen(false);
          void deactivateAccount();
        }}
        title="Delete your account?"
        body="Your profile is hidden right away and nobody can find you. For 30 days everything is kept — log in again in that time and the account comes back exactly as it was. After 30 days it is gone for good. The Android app also offers to delete it from this screen."
        confirmLabel="Delete account"
        destructive
        loading={deactivationBusy}
      />
    </SettingsShell>
  );
}

function LOGO_NAME(key: string) {
  return LOGOS.find((logo) => logo.key === key)?.name ?? "Pink";
}

function LogoShop({
  wallet,
  selected,
  busy,
  onApply,
}: {
  wallet: WalletData;
  selected: string;
  busy: string | null;
  onApply: (key: string) => void;
}) {
  const owned = new Set(wallet.owned_logos ?? (wallet as WalletData & { logos?: string[] }).logos ?? []);
  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-extrabold">The mark in the corner</h2>
          <p className="mt-0.5 text-[10px] text-dim">Logos are worn across every screen.</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-[12px] font-extrabold text-accent">
          <Sparkles className="size-3.5" /> {wallet.balance}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-x-2 gap-y-5">
        {LOGOS.map((logo) => {
          const open = logo.price === 0 || owned.has(logo.key);
          const wearing = selected === logo.key;
          return (
            <button key={logo.key} type="button" onClick={() => onApply(logo.key)} disabled={busy === logo.key} className="text-left disabled:opacity-60">
              <span className={cn("relative block aspect-square overflow-hidden rounded-[18px] border-2", wearing ? "border-accent" : "border-line")}>
                <img src={`/logos/${logo.key}.webp`} alt="" className="size-full object-cover" />
                {!open ? (
                  <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[9px] font-extrabold text-white backdrop-blur">
                    <Sparkles className="size-2.5" /> {logo.price}
                  </span>
                ) : null}
                {busy === logo.key ? (
                  <span className="absolute inset-0 flex items-center justify-center bg-black/35"><Spinner className="size-5 text-white" /></span>
                ) : null}
              </span>
              <span className={cn("mt-1.5 block text-[11px] font-bold", wearing ? "text-accent" : "text-ink")}>
                {logo.name}{wearing ? " · on" : ""}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
