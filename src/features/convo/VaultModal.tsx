import { useEffect, useState, type FormEvent } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ChevronLeft,
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  LogOut,
  MoreVertical,
  Settings2,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Spinner } from "@/components/Button";
import { ConfirmDialog, Modal } from "@/components/Modal";
import { EmptyState, ErrorState } from "@/components/States";
import { api, request } from "@/lib/api";
import { cn } from "@/lib/cn";
import { ApiError, errorMessage } from "@/lib/errors";
import { useToast } from "@/providers/ToastProvider";
import type { ThreadCard, VaultState } from "@/types/api";
import { ConvoSheet } from "./ConvoSheet";
import { stamp, threadTitle } from "./model";

function CodePad({
  title,
  line,
  length,
  busy,
  error,
  onSubmit,
}: {
  title: string;
  line: string;
  length: number;
  busy: boolean;
  error: string | null;
  onSubmit: (code: string) => void;
}) {
  const [code, setCode] = useState("");

  useEffect(() => {
    if (code.length !== length) return;
    onSubmit(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code, length]);

  useEffect(() => {
    if (error) setCode("");
  }, [error]);

  function press(digit: string) {
    if (busy) return;
    setCode((current) => (current.length >= length ? current : `${current}${digit}`));
  }

  return (
    <div className="px-6 pb-8 pt-7">
      <div className="text-center">
        <span className="mx-auto flex size-16 items-center justify-center rounded-[22px] bg-accent text-on-accent shadow-[0_10px_28px_color-mix(in_srgb,var(--accent)_28%,transparent)]">
          <Lock className="size-7" />
        </span>
        <h2 className="mt-4 text-[19px] font-extrabold tracking-[-0.25px]">{title}</h2>
        <p className="mx-auto mt-1.5 max-w-[270px] text-[11px] leading-5 text-dim">{line}</p>
      </div>

      <div className="mt-7 flex justify-center gap-3.5" aria-label={`${code.length} of ${length} digits`}>
        {Array.from({ length }).map((_, index) => (
          <span
            key={index}
            className={cn(
              "flex size-4 items-center justify-center rounded-full border transition",
              index < code.length
                ? "border-accent bg-accent shadow-[0_0_0_4px_color-mix(in_srgb,var(--accent)_10%,transparent)]"
                : "border-line bg-[color-mix(in_srgb,var(--ink)_3%,transparent)]",
            )}
          />
        ))}
      </div>

      {error ? (
        <p className="mx-auto mt-4 max-w-[280px] rounded-full bg-[color-mix(in_srgb,var(--bad)_8%,transparent)] px-3 py-1.5 text-center text-[10.5px] font-semibold text-[var(--bad)]">
          {error}
        </p>
      ) : null}

      <div className="mx-auto mt-7 grid max-w-[248px] grid-cols-3 gap-3">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((digit) => (
          <button
            key={digit}
            type="button"
            disabled={busy}
            onClick={() => press(digit)}
            className="flex h-14 items-center justify-center rounded-[18px] border border-line bg-card text-[19px] font-bold shadow-[0_2px_6px_rgba(17,17,26,0.05)] transition hover:border-accent/45 hover:bg-[var(--accent-soft)] active:scale-95 disabled:opacity-50"
          >
            {digit}
          </button>
        ))}
        <span />
        <button
          type="button"
          disabled={busy}
          onClick={() => press("0")}
          className="flex h-14 items-center justify-center rounded-[18px] border border-line bg-card text-[19px] font-bold shadow-[0_2px_6px_rgba(17,17,26,0.05)] transition hover:border-accent/45 hover:bg-[var(--accent-soft)] active:scale-95 disabled:opacity-50"
        >
          0
        </button>
        <button
          type="button"
          disabled={busy || !code.length}
          onClick={() => setCode((current) => current.slice(0, -1))}
          className="flex h-14 items-center justify-center rounded-[18px] text-dim transition hover:bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] hover:text-ink disabled:opacity-30"
          aria-label="Delete digit"
        >
          <X className="size-5" />
        </button>
      </div>
      {busy ? <div className="mt-4 flex justify-center"><Spinner className="size-5" /></div> : null}
    </div>
  );
}

function CodeForm({
  title,
  line,
  fields,
  busy,
  error,
  submitLabel,
  onSubmit,
  onBack,
}: {
  title: string;
  line: string;
  fields: { key: string; label: string; note?: string }[];
  busy: boolean;
  error: string | null;
  submitLabel: string;
  onSubmit: (values: Record<string, string>) => void;
  onBack: () => void;
}) {
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(fields.map((field) => [field.key, ""])),
  );

  function submit(event: FormEvent) {
    event.preventDefault();
    onSubmit(values);
  }

  return (
    <form onSubmit={submit} className="p-5">
      <button type="button" onClick={onBack} className="mb-3 inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] px-2.5 py-1 text-[10.5px] font-bold text-dim transition hover:text-ink">
        <ChevronLeft className="size-3.5" /> Back
      </button>
      <h2 className="text-[18px] font-extrabold tracking-[-0.2px]">{title}</h2>
      <p className="mt-1.5 text-[11px] leading-5 text-dim">{line}</p>
      <div className="mt-4 space-y-3">
        {fields.map((field) => (
          <label key={field.key} className="block">
            <span className="mb-1 block text-[9px] font-bold uppercase tracking-[0.12em] text-dim">{field.label}</span>
            <input
              value={values[field.key] ?? ""}
              onChange={(event) =>
                setValues((current) => ({
                  ...current,
                  [field.key]: event.target.value.replace(/\D/g, "").slice(0, 12),
                }))
              }
              inputMode="numeric"
              autoComplete="off"
              autoFocus={field.key === fields[0].key}
              placeholder="••••"
              className="min-h-12 w-full rounded-[15px] border border-line bg-paper px-4 text-center text-[20px] font-bold tracking-[0.4em] outline-none transition focus:border-accent focus:bg-card focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_10%,transparent)]"
            />
            {field.note ? <span className="mt-1 block text-[10px] text-dim">{field.note}</span> : null}
          </label>
        ))}
      </div>
      {error ? <p className="mt-3 text-[11px] font-semibold text-[var(--bad)]">{error}</p> : null}
      <button type="submit" disabled={busy} className="btn btn-primary mt-5 w-full">
        {busy ? "Working..." : submitLabel}
      </button>
    </form>
  );
}

export function VaultModal({
  open,
  onClose,
  onChanged,
  onOpenThread,
}: {
  open: boolean;
  onClose: () => void;
  onChanged?: () => void;
  onOpenThread: (thread: ThreadCard) => void;
}) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [unlocked, setUnlocked] = useState(false);
  const [view, setView] = useState<"main" | "settings" | "code">("main");
  const [prompt, setPrompt] = useState<"set" | "change" | "remove" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const [sheetThread, setSheetThread] = useState<ThreadCard | null>(null);

  const stateQuery = useQuery({
    queryKey: ["vault"],
    queryFn: () => api.get<VaultState>("/chat/vault/"),
    enabled: open,
    staleTime: 0,
  });

  useEffect(() => {
    if (!open) {
      setUnlocked(false);
      setView("main");
      setPrompt(null);
      setBusy(null);
      setError(null);
      setConfirmRemove(false);
      setSheetThread(null);
    }
  }, [open]);

  const state = stateQuery.data;
  const isOpen = Boolean(state && (state.open || unlocked));

  const rowsQuery = useQuery({
    queryKey: ["vault-rows"],
    queryFn: () => api.get<{ threads: ThreadCard[] }>("/chat/threads/", { query: { vault: "1" } }),
    enabled: open && isOpen,
    staleTime: 0,
  });

  useEffect(() => {
    if (!rowsQuery.error) return;
    if (rowsQuery.error instanceof ApiError && rowsQuery.error.code === "vault_locked") {
      setUnlocked(false);
      void stateQuery.refetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rowsQuery.error]);

  function invalidate() {
    void queryClient.invalidateQueries({ queryKey: ["vault"] });
    void queryClient.invalidateQueries({ queryKey: ["vault-rows"] });
    void queryClient.invalidateQueries({ queryKey: ["threads"] });
    onChanged?.();
  }

  async function unlock(code: string) {
    if (busy) return;
    setBusy("unlock");
    setError(null);
    try {
      await api.post("/chat/vault/unlock/", { code });
      setUnlocked(true);
      invalidate();
      toast({ title: "Vault open.", tone: "success" });
    } catch (caught) {
      if (caught instanceof ApiError && caught.status === 429) {
        setError("Too many tries. Wait a few minutes.");
      } else {
        setError(errorMessage(caught));
      }
    } finally {
      setBusy(null);
    }
  }

  async function lockNow() {
    setBusy("lock");
    try {
      await api.delete("/chat/vault/unlock/");
      setUnlocked(false);
      setView("main");
      invalidate();
      toast({ title: "Vault locked.", tone: "success" });
    } catch {
      toast({ title: "Could not lock the vault", tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function saveCode(values: Record<string, string>) {
    const next = values.code ?? "";
    const current = values.current ?? "";
    if (state?.code_set && current.length !== (state.length || 4)) {
      setError("Enter the code you use now.");
      return;
    }
    if (next.length !== (state?.length || 4)) {
      setError(`Choose exactly ${state?.length || 4} digits.`);
      return;
    }
    if (values.confirm !== undefined && values.confirm !== next) {
      setError("The two entries do not match.");
      return;
    }
    setBusy("code");
    setError(null);
    try {
      await api.put("/chat/vault/", {
        code: next,
        ...(state?.code_set ? { current } : {}),
      });
      setUnlocked(true);
      setPrompt(null);
      setView("main");
      invalidate();
      toast({ title: state?.code_set ? "Code changed." : "The vault is locked now.", tone: "success" });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  async function removeCode(values: Record<string, string>) {
    const code = values.code ?? "";
    setBusy("remove");
    setError(null);
    try {
      await request("/chat/vault/", { method: "DELETE", body: { code } });
      setUnlocked(true);
      setConfirmRemove(false);
      setPrompt(null);
      setView("main");
      invalidate();
      toast({ title: "The code is gone.", tone: "success" });
    } catch (caught) {
      setError(errorMessage(caught));
    } finally {
      setBusy(null);
    }
  }

  async function flipDoor() {
    if (!state) return;
    const hide = !state.hidden;
    if (hide && !state.code_set) {
      toast({ title: "Choose a code first.", tone: "info" });
      return;
    }
    setBusy("hide");
    try {
      const response = await api.patch<VaultState>("/chat/vault/", { hide });
      queryClient.setQueryData(["vault"], { ...state, ...response });
      invalidate();
      toast({
        title: hide ? "Hidden. Type your code where you would type a name." : "Back in the convo menu.",
        tone: "success",
      });
    } catch (caught) {
      toast({ title: "That did not change", description: errorMessage(caught), tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  async function takeOut(thread: ThreadCard) {
    if (busy) return;
    setBusy(thread.id);
    try {
      await api.patch(`/chat/threads/${thread.id}/flags/`, { vaulted: false });
      invalidate();
      toast({ title: `${threadTitle(thread)} is back in the convo list.`, tone: "success" });
    } catch (caught) {
      toast({ title: "Could not move it out", description: errorMessage(caught), tone: "error" });
    } finally {
      setBusy(null);
    }
  }

  const rows = rowsQuery.data?.threads ?? [];
  const length = state?.length || 4;
  const openMinutes = state?.open_minutes || 5;

  return (
    <>
      <Modal open={open} onClose={onClose} size="md">
        <header
          className="relative flex items-center gap-2.5 overflow-hidden border-b border-line px-4 py-3.5"
          style={{ background: "linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, var(--card)), var(--card) 68%)" }}
        >
          <span
            className="pointer-events-none absolute -right-6 -top-8 size-24 rounded-full opacity-30 blur-2xl"
            style={{ backgroundColor: "color-mix(in srgb, var(--accent) 30%, transparent)" }}
            aria-hidden
          />
          <span className="relative flex size-10 items-center justify-center rounded-[14px] bg-accent text-on-accent shadow-[0_5px_14px_color-mix(in_srgb,var(--accent)_24%,transparent)]">
            <Lock className="size-4" />
          </span>
          <div className="relative min-w-0 flex-1">
            <h2 className="text-[16.5px] font-extrabold tracking-[-0.2px]">Vault</h2>
            <p className="text-[10px] text-dim">
              {stateQuery.isLoading
                ? "Reading the shelf…"
                : !state
                  ? "The shelf and its code"
                  : state.code_set && !isOpen
                    ? "Locked"
                    : state.code_set
                      ? `${rows.length} ${rows.length === 1 ? "convo" : "convos"} behind your code`
                      : `${rows.length} ${rows.length === 1 ? "convo" : "convos"} · no code yet`}
            </p>
          </div>
          {state?.code_set && isOpen ? (
            <button
              type="button"
              onClick={() => void lockNow()}
              className="icon-btn"
              title="Lock it now"
              aria-label="Lock the vault now"
              disabled={busy !== null}
            >
              <LockOpen className="size-[18px]" />
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => {
              setView(view === "settings" ? "main" : "settings");
              setPrompt(null);
              setError(null);
            }}
            className={cn("icon-btn", view === "settings" && "text-accent")}
            title="Vault settings"
            aria-label="Vault settings"
          >
            <Settings2 className="size-[18px]" />
          </button>
          <button type="button" onClick={onClose} className="icon-btn -mr-1" aria-label="Close">
            <X className="size-[18px]" />
          </button>
        </header>

        {view === "settings" ? (
          <div className="space-y-0.5 p-2 pb-4">
            <div className="flex items-center gap-2 px-1 py-2">
              <button
                type="button"
                onClick={() => {
                  setView("main");
                  setPrompt(null);
                  setError(null);
                }}
                className="inline-flex items-center gap-1 rounded-full bg-[color-mix(in_srgb,var(--ink)_5%,transparent)] px-2.5 py-1 text-[10.5px] font-bold text-dim transition hover:text-ink"
              >
                <ChevronLeft className="size-3.5" /> Back to the vault
              </button>
            </div>
            <VaultSetting
              icon={<ShieldCheck className="size-4" />}
              title={state?.code_set ? "Change the code" : "Choose a code"}
              line={
                state?.code_set
                  ? `${length} new digits. The old one is asked for first.`
                  : "Until you do, the vault opens without one."
              }
              onClick={() => {
                setPrompt(state?.code_set ? "change" : "set");
                setView("code");
                setError(null);
              }}
            />
            {state?.code_set ? (
              <>
                <VaultSetting
                  icon={state.hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
                  title={state.hidden ? "Show it in the convo menu" : "Hide it from the convo menu"}
                  line={
                    state.hidden
                      ? "It is not in the menu — your code opens it."
                      : "The only way in becomes typing your code."
                  }
                  right={state.hidden ? "Hidden" : "Shown"}
                  onClick={() => void flipDoor()}
                  disabled={busy !== null}
                />
                <VaultSetting
                  icon={<LockOpen className="size-4" />}
                  title="Lock it now"
                  line={`It closes on its own after ${openMinutes} minutes.`}
                  onClick={() => void lockNow()}
                  disabled={busy !== null}
                />
                <div className="mx-4 my-1 h-px bg-line" />
                <VaultSetting
                  icon={<Trash2 className="size-4" />}
                  title="Remove the code"
                  line="The vault opens without one. Its convos stay in here."
                  danger
                  onClick={() => setConfirmRemove(true)}
                />
              </>
            ) : null}
            <p className="px-5 pt-4 text-[10px] leading-4 text-dim">
              The code hides vaulted convos from whoever picks up your phone. It does not encrypt them, and nobody can recover it for you.
            </p>
          </div>
        ) : view === "code" && prompt ? (
          <CodeForm
            title={
              prompt === "remove"
                ? "Remove the code"
                : prompt === "change"
                  ? "Change the code"
                  : "Choose a code"
            }
            line={
              prompt === "remove"
                ? "Enter the code you use now. The chats stay in the vault."
                : prompt === "change"
                  ? "Enter the old code, then choose the new one."
                  : `Choose ${length} digits. There is no way to recover it.`
            }
            fields={
              prompt === "remove"
                ? [{ key: "code", label: "Your code" }]
                : prompt === "change"
                  ? [
                      { key: "current", label: "Your code now" },
                      { key: "code", label: "New code" },
                      { key: "confirm", label: "Repeat the new code" },
                    ]
                  : [
                      { key: "code", label: "Choose a code" },
                      { key: "confirm", label: "Repeat it" },
                    ]
            }
            busy={busy !== null}
            error={error}
            submitLabel={prompt === "remove" ? "Remove the code" : prompt === "change" ? "Change it" : "Set the code"}
            onSubmit={(values) => void (prompt === "remove" ? removeCode(values) : saveCode(values))}
            onBack={() => {
              setView("settings");
              setPrompt(null);
              setError(null);
            }}
          />
        ) : stateQuery.isLoading ? (
          <div className="flex justify-center py-16"><Spinner className="size-6" /></div>
        ) : stateQuery.isError ? (
          <ErrorState error={stateQuery.error} onRetry={() => void stateQuery.refetch()} />
        ) : state?.code_set && !isOpen ? (
          <CodePad
            title="Enter your vault code"
            line={`The vault closes again on its own after ${openMinutes} minutes.`}
            length={length}
            busy={busy === "unlock"}
            error={error}
            onSubmit={(code) => void unlock(code)}
          />
        ) : rowsQuery.isLoading ? (
          <div className="flex justify-center py-16"><Spinner className="size-6" /></div>
        ) : rowsQuery.isError ? (
          <ErrorState error={rowsQuery.error} onRetry={() => void rowsQuery.refetch()} />
        ) : !rows.length ? (
          <EmptyState
            icon={<Lock className="size-6" />}
            title="Nothing in the vault"
            body='Hold any convo in the list and pick "Move to the vault". It leaves the list and turns up here.'
          />
        ) : (
          <div className="space-y-1.5 p-2 pb-5">
            <p className="px-2 pb-1 pt-1 text-[9px] font-extrabold uppercase tracking-[0.14em] text-dim">Kept out of the list</p>
            {rows.map((thread) => (
              <div
                key={thread.id}
                className="group flex items-center gap-2 rounded-[16px] border border-line bg-card px-2.5 py-2.5 shadow-[0_1px_2px_rgba(17,17,26,0.04)] transition hover:border-accent/25 hover:shadow-[0_5px_16px_rgba(17,17,26,0.06)]"
              >
                <button
                  type="button"
                  onClick={() => {
                    onOpenThread(thread);
                    onClose();
                  }}
                  className="flex min-w-0 flex-1 items-center gap-3 text-left"
                >
                  <Avatar user={thread.other} name={threadTitle(thread)} src={thread.avatar} size={44} online={thread.other?.online} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-bold">{threadTitle(thread)}</span>
                    <span className="block truncate text-[10.5px] text-dim">
                      {thread.kind === "group" ? "Group" : stamp(thread.last_message_at)}
                    </span>
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void takeOut(thread)}
                  disabled={busy !== null}
                  className="icon-btn text-dim"
                  title="Back to the convo list"
                  aria-label={`Take ${threadTitle(thread)} out of the vault`}
                >
                  {busy === thread.id ? <Spinner className="size-4" /> : <LogOut className="size-[18px]" />}
                </button>
                <button
                  type="button"
                  onClick={() => setSheetThread(thread)}
                  className="icon-btn text-dim"
                  title="Convo options"
                  aria-label={`Options for ${threadTitle(thread)}`}
                >
                  <MoreVertical className="size-[18px]" />
                </button>
              </div>
            ))}
            <div className="flex items-start gap-2 px-5 pt-5">
              <Lock className="mt-0.5 size-3.5 shrink-0 text-dim" />
              <p className="text-[10px] leading-4 text-dim">
                Vaulted convos stay out of the list, the unread count and search. The code hides them from whoever picks up your phone — it does not encrypt them.
              </p>
            </div>
          </div>
        )}
      </Modal>

      <ConvoSheet
        open={Boolean(sheetThread)}
        onClose={() => setSheetThread(null)}
        thread={sheetThread}
        kind="list"
        onChanged={invalidate}
        onGone={invalidate}
      />

      <ConfirmDialog
        open={confirmRemove}
        onClose={() => setConfirmRemove(false)}
        onConfirm={() => {
          setConfirmRemove(false);
          setPrompt("remove");
          setView("code");
          setError(null);
        }}
        title="Remove the code?"
        body="The vault opens without one, and it goes back into the convo menu. Its convos stay in here."
        confirmLabel="Remove"
        destructive
      />
    </>
  );
}

function VaultSetting({
  icon,
  title,
  line,
  right,
  danger,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  line: string;
  right?: string;
  danger?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex w-full items-center gap-3 rounded-[14px] px-3 py-2.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_4%,transparent)] disabled:opacity-50",
        danger && "text-[var(--bad)]",
      )}
    >
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-[13px]",
          danger
            ? "bg-[color-mix(in_srgb,var(--bad)_10%,transparent)]"
            : "bg-[var(--accent-soft)] text-accent",
        )}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[12.5px] font-extrabold">{title}</span>
        <span className="mt-0.5 block text-[10.5px] leading-4 text-dim">{line}</span>
      </span>
      {right ? (
        <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] px-2 py-0.5 text-[10px] font-bold text-dim">
          {right}
        </span>
      ) : null}
    </button>
  );
}
