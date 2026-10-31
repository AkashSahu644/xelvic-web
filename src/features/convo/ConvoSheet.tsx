import { useCallback, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Ban,
  Bell,
  BellOff,
  Check,
  ChevronLeft,
  Clock3,
  Eraser,
  Image,
  Lock,
  LockOpen,
  LogOut,
  Palette,
  Pin,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { ConfirmDialog, Modal } from "@/components/Modal";
import { Spinner } from "@/components/Button";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/errors";
import { useToast } from "@/providers/ToastProvider";
import type { ConvoCatalog, ThreadCard, ThreadDetail } from "@/types/api";
import {
  PIN_MAX,
  VANISH_DAYS,
  VANISH_DEFAULT_DAYS,
  catalogTints,
  catalogWalls,
  tintHex,
  vanishLabel,
  wallUrl,
  TINT_HEX,
} from "./skin";
import { threadFace, threadTitle } from "./model";

type View = "main" | "vanish" | "walls" | "tints";
type Confirming = "clear" | "trash" | "leave" | "block" | null;

function ActionRow({
  icon,
  label,
  line,
  right,
  danger,
  disabled,
  active,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  line?: string;
  right?: ReactNode;
  danger?: boolean;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] disabled:opacity-45",
        danger && "text-[var(--bad)]",
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-[13px] transition",
          danger
            ? "bg-[color-mix(in_srgb,var(--bad)_10%,transparent)]"
            : active
              ? "bg-accent text-on-accent shadow-[0_4px_12px_color-mix(in_srgb,var(--accent)_24%,transparent)]"
              : "bg-[var(--accent-soft)] text-accent",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-extrabold">{label}</span>
        {line ? <span className="mt-0.5 block truncate text-[10.5px] leading-4 text-dim">{line}</span> : null}
      </span>
      {right ? (
        <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] px-2 py-0.5 text-[10px] font-bold text-dim">
          {right}
        </span>
      ) : null}
    </button>
  );
}

function SheetHead({ thread, onClose }: { thread: ThreadCard; onClose: () => void }) {
  const title = threadTitle(thread);
  const face = threadFace(thread);
  const under =
    thread.kind === "group"
      ? thread.member_count === 1
        ? "1 member"
        : `${thread.member_count ?? 0} members`
      : face
        ? `@${face.username}`
        : "Direct convo";
  return (
    <div
      className="relative flex items-center gap-3 overflow-hidden border-b border-line px-4 py-4"
      style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 9%, var(--card)), var(--card) 68%)" }}
    >
      <span
        className="pointer-events-none absolute -right-8 -top-10 size-28 rounded-full opacity-30 blur-2xl"
        style={{ backgroundColor: "color-mix(in srgb, var(--accent) 32%, transparent)" }}
        aria-hidden
      />
      <Avatar user={face} name={title} src={thread.avatar} size={48} online={face?.online} />
      <div className="relative min-w-0 flex-1">
        <p className="truncate text-[15.5px] font-extrabold tracking-[-0.2px]">{title}</p>
        <p className="mt-0.5 truncate text-[10.5px] text-dim">{under}</p>
      </div>
      <button type="button" onClick={onClose} className="icon-btn relative -mr-1 shrink-0" aria-label="Close">
        <X className="size-[18px]" />
      </button>
    </div>
  );
}

export function ConvoSheet({
  open,
  onClose,
  thread,
  kind,
  pinnedCount,
  onChanged,
  onGone,
  onGroupSettings,
  onMedia,
}: {
  open: boolean;
  onClose: () => void;
  thread: ThreadCard | null;
  kind: "list" | "convo";
  pinnedCount?: number;
  onChanged?: () => void;
  onGone?: () => void;
  onGroupSettings?: (thread: ThreadDetail) => void;
  onMedia?: () => void;
}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [view, setView] = useState<View>("main");
  const [overrides, setOverrides] = useState<Partial<ThreadDetail>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<Confirming>(null);
  const [pins, setPins] = useState(pinnedCount ?? 0);
  const [customWallpaper, setCustomWallpaperState] = useState<File | null>(null);
  const [customWallpaperPreview, setCustomWallpaperPreview] = useState<string | null>(null);
  const [customWallpaperOpacity, setCustomWallpaperOpacityState] = useState(0.78);

  // Load custom wallpaper from localStorage on mount
  useEffect(() => {
    if (thread?.id) {
      const saved = localStorage.getItem(`convo_wallpaper_${thread.id}`);
      if (saved) {
        try {
          const { preview, opacity } = JSON.parse(saved);
          setCustomWallpaperPreview(preview);
          setCustomWallpaperOpacityState(opacity ?? 0.78);
        } catch {
          localStorage.removeItem(`convo_wallpaper_${thread.id}`);
        }
      }
    }
  }, [thread?.id]);

  // Save custom wallpaper to localStorage
  const saveCustomWallpaper = useCallback((preview: string | null, opacity: number) => {
    if (thread?.id) {
      if (preview) {
        localStorage.setItem(`convo_wallpaper_${thread.id}`, JSON.stringify({ preview, opacity }));
      } else {
        localStorage.removeItem(`convo_wallpaper_${thread.id}`);
      }
    }
  }, [thread?.id]);

  const detail = useQuery({
    queryKey: ["thread", thread?.id],
    queryFn: () => api.get<{ thread: ThreadDetail; catalog?: ConvoCatalog }>(`/chat/threads/${thread?.id}/`),
    enabled: open && kind === "convo" && Boolean(thread?.id),
    staleTime: 8_000,
  });

  const threadList = useQuery({
    queryKey: ["threads"],
    queryFn: () => api.get<{ threads: ThreadCard[]; unread: number }>("/chat/threads/"),
    enabled: open && pinnedCount == null,
    staleTime: 15_000,
  });

  const totalPins = pinnedCount ?? threadList.data?.threads.filter((row) => row.pinned).length ?? 0;

  const row: ThreadDetail | null = thread
    ? ({ ...thread, ...(detail.data?.thread ?? {}), ...overrides } as ThreadDetail)
    : null;
  const catalog = detail.data?.catalog;

  useEffect(() => {
    if (!open) {
      setView("main");
      setOverrides({});
      setBusy(null);
      setConfirming(null);
      setCustomWallpaperState(null);
      setCustomWallpaperPreview(null);
      setCustomWallpaperOpacityState(0.78);
    }
    setPins(totalPins);
  }, [open, thread?.id, totalPins]);

  if (!row) return null;

  const group = row.kind === "group";
  const first = threadTitle(row).split(/\s+/)[0] || "them";
  const blocked = String((row.gate as { mode?: string } | null)?.mode ?? "") === "blocked";
  const vanish = row.vanish_mode ?? "off";
  const days = row.vanish_days ?? VANISH_DEFAULT_DAYS;

  function changed() {
    onChanged?.();
  }

  async function flags(patch: Record<string, boolean>, key: string): Promise<boolean> {
    if (busy) return false;
    setBusy(key);
    try {
      const response = await api.patch<{ thread: ThreadDetail }>(`/chat/threads/${row?.id}/flags/`, patch);
      setOverrides((current) => ({ ...current, ...response.thread }));
      changed();
      return true;
    } catch (error) {
      toast({
        title: key === "pinned" ? "That pin did not take" : "That did not change",
        description: errorMessage(error),
        tone: "error",
      });
      return false;
    } finally {
      setBusy(null);
    }
  }

  async function togglePin() {
    const on = !row?.pinned;
    if (on && pins >= PIN_MAX) {
      toast({
        title: `You can pin only ${PIN_MAX} convos`,
        description: "Unpin one of the others first.",
        tone: "info",
      });
      return;
    }
    if (await flags({ pinned: Boolean(on) }, "pinned")) {
      setPins((current) => Math.max(0, current + (on ? 1 : -1)));
      toast({ title: on ? "Pinned to the top." : "Unpinned.", tone: "success" });
    }
  }

  async function toggleMute() {
    const on = !row?.muted;
    if (await flags({ muted: Boolean(on) }, "muted")) {
      toast({ title: on ? "Muted." : "Notifications are back on.", tone: "success" });
    }
  }

  async function toggleVault() {
    const on = !row?.vaulted;
    const wasPinned = Boolean(row?.pinned);
    if (await flags({ vaulted: Boolean(on) }, "vaulted")) {
      if (on && wasPinned) setPins((current) => Math.max(0, current - 1));
      toast({ title: on ? "Moved to the vault." : "Back in the convo list.", tone: "success" });
    }
  }

  async function setVanish(mode: string, length?: number) {
    if (busy) return;
    setBusy("vanish");
    try {
      const response = await api.patch<{ mode: string; days: number | null }>(
        `/chat/threads/${row?.id}/vanish/`,
        { mode, ...(length ? { days: length } : {}) },
      );
      setOverrides((current) => ({
        ...current,
        vanish_mode: response.mode,
        vanish_days: response.days ?? length ?? VANISH_DEFAULT_DAYS,
      }));
      setView("main");
      changed();
      toast({
        title:
          response.mode === "off"
            ? "This convo stays."
            : `Disappearing convo · ${vanishLabel(response.mode, response.days ?? length)}`,
        tone: "success",
      });
    } catch (error) {
      toast({ title: "Could not change that", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function setSkin(patch: { wallpaper?: string; tint?: string }, key: string) {
    if (busy) return;
    setBusy(key);
    try {
      const response = await api.patch<{ wallpaper: string; tint: string }>(
        `/chat/threads/${row?.id}/skin/`,
        patch,
      );
      setOverrides((current) => ({ ...current, ...response }));
      changed();
      toast({ title: key === "wallpaper" ? "Wallpaper changed." : "Convo theme changed.", tone: "success" });
    } catch (error) {
      toast({ title: "Could not change that", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function setCustomWallpaper(file: File) {
    if (busy) return;
    setBusy("wallpaper");
    try {
      const response = await api.patch<{ wallpaper: string; tint: string }>(
        `/chat/threads/${row?.id}/skin/`,
        { wallpaper: "default" },
      );
      setOverrides((current) => {
        const { wallpaper: _, ...rest } = current;
        return { ...rest, ...response };
      });
      changed();
      setCustomWallpaperState(file);
      const preview = URL.createObjectURL(file);
      setCustomWallpaperPreview(preview);
      setCustomWallpaperOpacityState(0.78);
      saveCustomWallpaper(preview, 0.78);
      setView("main");
      toast({ title: "Wallpaper set to your photo.", tone: "success" });
    } catch (error) {
      toast({ title: "Could not set photo", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function removeCustomWallpaper() {
    if (busy) return;
    setBusy("wallpaper");
    try {
      await api.patch(`/chat/threads/${row?.id}/skin/`, { wallpaper: "default" });
      setOverrides((current) => {
        const { wallpaper: _, ...rest } = current;
        return { ...rest, wallpaper: "default" };
      });
      changed();
      setCustomWallpaperState(null);
      if (customWallpaperPreview) {
        URL.revokeObjectURL(customWallpaperPreview);
      }
      setCustomWallpaperPreview(null);
      setCustomWallpaperOpacityState(0.78);
      saveCustomWallpaper(null, 0.78);
      setView("main");
      toast({ title: "Wallpaper: None", tone: "success" });
    } catch (error) {
      toast({ title: "Could not remove photo", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function setCustomWallpaperOpacity(opacity: number) {
    setCustomWallpaperOpacityState(opacity);
    if (customWallpaperPreview) {
      saveCustomWallpaper(customWallpaperPreview, opacity);
    }
  }

  async function toggleBlock() {
    const person = row?.other;
    if (!person) {
      toast({ title: "There is nobody here to block.", tone: "info" });
      return;
    }
    if (blocked) {
      setBusy("block");
      try {
        await api.delete(`/social/users/${person.id}/block/`);
        setOverrides((current) => ({ ...current, gate: { mode: "open" } }));
        changed();
        toast({ title: `${first} is unblocked.`, tone: "success" });
      } catch (error) {
        toast({ title: "Could not unblock", description: errorMessage(error), tone: "error" });
      } finally {
        setBusy(null);
      }
      return;
    }
    setConfirming("block");
  }

  async function confirmBlock() {
    const person = row?.other;
    if (!person) return;
    setBusy("block");
    try {
      await api.post(`/social/users/${person.id}/block/`, {});
      setOverrides((current) => ({ ...current, gate: { mode: "blocked" } }));
      setConfirming(null);
      changed();
      toast({ title: `${first} is blocked.`, tone: "success" });
    } catch (error) {
      toast({ title: "Could not block", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function confirmClear() {
    setBusy("clear");
    try {
      await api.post(`/chat/threads/${row?.id}/clear/`, {});
      queryClient.removeQueries({ queryKey: ["messages", row?.id] });
      setConfirming(null);
      changed();
      onClose();
      toast({ title: "Convo cleared.", tone: "success" });
    } catch (error) {
      toast({ title: "Could not clear this convo", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function confirmTrash() {
    setBusy("trash");
    try {
      await api.delete(`/chat/threads/${row?.id}/`);
      queryClient.removeQueries({ queryKey: ["messages", row?.id] });
      setConfirming(null);
      onGone?.();
      onClose();
      toast({ title: "Convo trashed.", tone: "success" });
    } catch (error) {
      toast({ title: "Could not trash this convo", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function confirmLeave() {
    setBusy("leave");
    try {
      await api.post(`/chat/threads/${row?.id}/leave/`, {});
      queryClient.removeQueries({ queryKey: ["messages", row?.id] });
      setConfirming(null);
      onGone?.();
      onClose();
      toast({ title: `You left ${row ? threadTitle(row) : "the group"}.`, tone: "success" });
    } catch (error) {
      toast({ title: "Could not leave the group", description: errorMessage(error), tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  function openGroup() {
    if (!row) return;
    onClose();
    onGroupSettings?.(detail.data?.thread ?? row);
  }

  const walls = catalogWalls(catalog);
  const tints = catalogTints(catalog);

  return (
    <>
      <Modal open={open} onClose={onClose} size="sm">
        {view === "main" ? (
          <>
            <SheetHead thread={row} onClose={onClose} />
            <div className="space-y-0.5 p-2 pb-3">
              <p className="px-3 pb-1 pt-1 text-[9px] font-extrabold uppercase tracking-[0.14em] text-dim">This convo</p>
              {group && onGroupSettings ? (
                <ActionRow
                  icon={<Users className="size-4" />}
                  label="Group settings"
                  line="Channels, admins, the lock, and the invite link."
                  right="Open"
                  onClick={openGroup}
                  disabled={busy !== null || detail.isLoading}
                />
              ) : null}
              <ActionRow
                icon={<Pin className="size-4" />}
                label={row.pinned ? "Unpin" : "Pin to top"}
                line={row.pinned ? undefined : "It stays above the rest of the list."}
                right={`${pins}/${PIN_MAX}`}
                active={Boolean(row.pinned)}
                disabled={busy !== null}
                onClick={() => void togglePin()}
              />
              <ActionRow
                icon={row.muted ? <Bell className="size-4" /> : <BellOff className="size-4" />}
                label={row.muted ? "Unmute" : "Mute"}
                line={row.muted ? undefined : "No sound, no badge. It still arrives."}
                active={Boolean(row.muted)}
                disabled={busy !== null}
                onClick={() => void toggleMute()}
              />
              <ActionRow
                icon={row.vaulted ? <LockOpen className="size-4" /> : <Lock className="size-4" />}
                label={row.vaulted ? "Take out of the vault" : "Move to the vault"}
                line={row.vaulted ? undefined : "Out of the convo list, behind your code."}
                active={Boolean(row.vaulted)}
                disabled={busy !== null}
                onClick={() => void toggleVault()}
              />
              {kind === "convo" && onMedia ? (
                <ActionRow
                  icon={<Image className="size-4" />}
                  label="Media and files"
                  line="Everything shared in this convo."
                  right="Open"
                  onClick={onMedia}
                />
              ) : null}

              {kind === "convo" ? (
                <>
                  <p className="px-3 pb-1 pt-3 text-[9px] font-extrabold uppercase tracking-[0.14em] text-dim">Look & feel</p>
                  <ActionRow
                    icon={<Image className="size-4" />}
                    label="Wallpaper"
                    line="Behind this convo, on your side only."
                    right={walls.find((wall) => wall.key === (row.wallpaper ?? "default"))?.name ?? "Default"}
                    disabled={busy !== null}
                    onClick={() => setView("walls")}
                  />
                  <ActionRow
                    icon={<Palette className="size-4" />}
                    label="Convo theme"
                    line="Its accent, on your side only."
                    right={tints.find((tint) => tint.key === (row.tint ?? "default"))?.name ?? "Default"}
                    disabled={busy !== null}
                    onClick={() => setView("tints")}
                  />
                  <ActionRow
                    icon={<Clock3 className="size-4" />}
                    label="Disappearing convo"
                    line="Agreed for the whole convo, not one side."
                    right={vanishLabel(vanish, days)}
                    disabled={busy !== null}
                    onClick={() => setView("vanish")}
                  />
                  {!group ? (
                    <ActionRow
                      icon={<Ban className="size-4" />}
                      label={blocked ? `Unblock ${first}` : `Block ${first}`}
                      line={blocked ? "They cannot reach you right now." : undefined}
                      danger={!blocked}
                      disabled={busy !== null || (detail.isLoading && !detail.data)}
                      onClick={() => void toggleBlock()}
                    />
                  ) : null}
                </>
              ) : null}

              <p className="px-3 pb-1 pt-3 text-[9px] font-extrabold uppercase tracking-[0.14em] text-dim">Careful</p>
              <ActionRow
                icon={<Eraser className="size-4" />}
                label="Clear convo"
                line="Empty it, keep it."
                danger
                disabled={busy !== null}
                onClick={() => setConfirming("clear")}
              />
              {group ? (
                <ActionRow
                  icon={<LogOut className="size-4" />}
                  label="Leave group"
                  line="Its convo stops reaching you."
                  danger
                  disabled={busy !== null}
                  onClick={() => setConfirming("leave")}
                />
              ) : (
                <ActionRow
                  icon={<Trash2 className="size-4" />}
                  label="Trash convo"
                  line="It leaves your list."
                  danger
                  disabled={busy !== null}
                  onClick={() => setConfirming("trash")}
                />
              )}
            </div>
          </>
        ) : view === "vanish" ? (
          <>
            <SubHead title="Disappearing convo" line="Agreed for the whole convo." onBack={() => setView("main")} />
            <div className="pb-3">
              <ActionRow
                icon={<Clock3 className="size-4" />}
                label="Off"
                line="Messages stay."
                active={vanish === "off"}
                right={vanish === "off" ? <Check className="size-4 text-accent" /> : undefined}
                disabled={busy !== null}
                onClick={() => void setVanish("off")}
              />
              <ActionRow
                icon={<Clock3 className="size-4" />}
                label="Instant"
                line="Gone as soon as it is read and closed."
                active={vanish === "instant"}
                right={vanish === "instant" ? <Check className="size-4 text-accent" /> : undefined}
                disabled={busy !== null}
                onClick={() => void setVanish("instant")}
              />
              <div className="mx-5 my-2 flex items-center gap-3">
                <div className="h-px flex-1 bg-line" />
                <span className="text-[9px] font-bold uppercase tracking-[0.12em] text-dim">After a while</span>
                <div className="h-px flex-1 bg-line" />
              </div>
              {VANISH_DAYS.map((length) => (
                <ActionRow
                  key={length}
                  icon={<Clock3 className="size-4" />}
                  label={`${length} ${length === 1 ? "day" : "days"}`}
                  active={vanish === "timed" && days === length}
                  right={
                    vanish === "timed" && days === length ? <Check className="size-4 text-accent" /> : undefined
                  }
                  disabled={busy !== null}
                  onClick={() => void setVanish("timed", length)}
                />
              ))}
            </div>
          </>
        ) : view === "walls" ? (
          <>
            <SubHead
              title="Wallpaper"
              line="Behind this convo only. The other side keeps theirs."
              onBack={() => setView("main")}
            />
            {customWallpaper && customWallpaperPreview ? (
              <div className="p-4">
                <div className="mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[12px] font-extrabold">Your photo</span>
                    <span className="text-[12px] text-accent font-bold">
                      {Math.round(customWallpaperOpacity * 100)}%
                    </span>
                  </div>
                  <div className="relative aspect-[0.72] overflow-hidden rounded-[13px] border border-accent ring-2 ring-accent/25">
                    <img src={customWallpaperPreview} alt="" className="h-full w-full object-cover" />
                    <div className="absolute inset-0 bg-black" style={{ opacity: 1 - customWallpaperOpacity }} />
                  </div>
                </div>
                <div className="space-y-3">
                  <div>
                    <label className="flex items-center gap-2 text-[10.5px] font-bold text-dim">
                      <span className="size-5 shrink-0">How much shows</span>
                      <input
                        type="range"
                        min="0"
                        max="100"
                        value={Math.round(customWallpaperOpacity * 100)}
                        onChange={(e) => setCustomWallpaperOpacity(Number(e.target.value) / 100)}
                        className="flex-1 h-1.5 appearance-none bg-[var(--line)] rounded-full accent-accent"
                      />
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={removeCustomWallpaper}
                    disabled={busy !== null}
                    className="flex w-full items-center justify-center gap-2 rounded-[13px] border border-[color-mix(in_srgb,var(--bad)_30%,var(--line))] bg-[color-mix(in_srgb,var(--bad)_8%,transparent)] px-3 py-2 text-[11px] font-bold text-[var(--bad)] transition hover:brightness-95 disabled:opacity-50"
                  >
                    <Eraser className="size-3.5" />
                    Remove
                  </button>
                </div>
              </div>
            ) : null}
            <div className="grid grid-cols-3 gap-2.5 p-4">
              <button
                type="button"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "file";
                  input.accept = "image/*";
                  input.onchange = async (e) => {
                    const file = (e.target as HTMLInputElement).files?.[0];
                    if (file) {
                      await setCustomWallpaper(file);
                    }
                  };
                  input.click();
                }}
                disabled={busy !== null}
                className={cn(
                  "relative aspect-[0.72] overflow-hidden rounded-[13px] border bg-card transition",
                  !customWallpaper ? "border-accent ring-2 ring-accent/25" : "border-line hover:border-accent/40",
                )}
              >
                <span className="flex h-full w-full items-center justify-center flex-col gap-2 bg-[color-mix(in_srgb,var(--page)_88%,var(--card))] text-[10px] font-bold text-dim">
                  <span className="flex size-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent">
                    <Image className="size-5" />
                  </span>
                  <span>Your photo</span>
                </span>
                {!customWallpaper ? (
                  <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-on-accent">
                    <Check className="size-3" />
                  </span>
                ) : null}
              </button>
              {walls.map((wall) => {
                const picked = (row.wallpaper ?? "default") === wall.key;
                const url = wallUrl(wall.key);
                return (
                  <button
                    key={wall.key}
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void setSkin({ wallpaper: wall.key }, "wallpaper")}
                    className={cn(
                      "relative aspect-[0.72] overflow-hidden rounded-[13px] border bg-card text-left transition",
                      picked ? "border-accent ring-2 ring-accent/25" : "border-line hover:border-accent/40",
                    )}
                  >
                    {url ? (
                      <img src={url} alt="" className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-[color-mix(in_srgb,var(--page)_88%,var(--card))] text-[10px] font-bold text-dim">
                        Default
                      </span>
                    )}
                    <span className="absolute inset-x-0 bottom-0 bg-[rgb(0_0_0_/_0.45)] px-1.5 py-1 text-[9px] font-bold text-white">
                      {wall.name}
                    </span>
                    {picked ? (
                      <span className="absolute right-1.5 top-1.5 flex size-5 items-center justify-center rounded-full bg-accent text-on-accent">
                        <Check className="size-3" />
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </>
        ) : (
          <>
            <SubHead
              title="Convo theme"
              line="The accent in this convo only. The other side keeps theirs."
              onBack={() => setView("main")}
            />
            <div className="grid grid-cols-3 gap-3 p-4">
              {tints.map((tint) => {
                const color = tintHex(tint.key) ?? tint.hex ?? TINT_HEX[tint.key] ?? "#7c5cff";
                const picked = (row.tint ?? "default") === tint.key;
                return (
                  <button
                    key={tint.key}
                    type="button"
                    disabled={busy !== null}
                    onClick={() => void setSkin({ tint: tint.key }, "tint")}
                    className={cn(
                      "rounded-[14px] border p-3 transition",
                      picked ? "border-accent bg-[var(--accent-soft)]" : "border-line hover:border-accent/40",
                    )}
                  >
                    <span
                      className="mx-auto flex size-10 items-center justify-center rounded-full"
                      style={{ backgroundColor: color }}
                    >
                      {picked ? <Check className="size-4 text-white" /> : null}
                    </span>
                    <span className="mt-2 block text-[10.5px] font-bold">{tint.name}</span>
                  </button>
                );
              })}
            </div>
          </>
        )}
        {busy && view === "main" ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 flex justify-center pb-2">
            <Spinner className="size-4" />
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={confirming === "block"}
        onClose={() => setConfirming(null)}
        onConfirm={() => void confirmBlock()}
        title={`Block ${first}?`}
        body="They cannot reach you, and neither of you sees the other online. The convo stays where it is."
        confirmLabel="Block"
        destructive
        loading={busy === "block"}
      />
      <ConfirmDialog
        open={confirming === "clear"}
        onClose={() => setConfirming(null)}
        onConfirm={() => void confirmClear()}
        title="Clear this convo?"
        body={`Your copy empties. ${group ? "Everybody else" : first} keeps their own copy.`}
        confirmLabel="Clear"
        destructive
        loading={busy === "clear"}
      />
      <ConfirmDialog
        open={confirming === "trash"}
        onClose={() => setConfirming(null)}
        onConfirm={() => void confirmTrash()}
        title="Trash this convo?"
        body={`It leaves your list with everything in it. Anything new from ${first} brings it back.`}
        confirmLabel="Trash"
        destructive
        loading={busy === "trash"}
      />
      <ConfirmDialog
        open={confirming === "leave"}
        onClose={() => setConfirming(null)}
        onConfirm={() => void confirmLeave()}
        title={`Leave ${threadTitle(row)}?`}
        body="Nothing sent in it reaches you any more, and the group is told you left."
        confirmLabel="Leave"
        destructive
        loading={busy === "leave"}
      />
    </>
  );
}

function SubHead({ title, line, onBack }: { title: string; line: string; onBack: () => void }) {
  return (
    <header className="flex items-start gap-2 border-b border-line px-3 py-3.5">
      <button type="button" onClick={onBack} className="icon-btn -ml-1 shrink-0" aria-label="Back">
        <ChevronLeft className="size-5" />
      </button>
      <div className="min-w-0 flex-1 pt-0.5">
        <h2 className="text-[16px] font-extrabold tracking-[-0.2px]">{title}</h2>
        <p className="mt-1 text-[10.5px] leading-4 text-dim">{line}</p>
      </div>
    </header>
  );
}
