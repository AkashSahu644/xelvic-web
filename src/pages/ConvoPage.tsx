import {
  Fragment,
  lazy,
  Suspense,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Camera,
  Check,
  CheckCheck,
  Lock,
  LogOut,
  MessageCircle,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  PhoneOutgoing,
  Search,
  Settings,
  Sparkles,
  UserPlus,
  Users,
  Video,
  X,
} from "lucide-react";
import { FaUserPlus } from "react-icons/fa6";
import { Avatar } from "@/components/Avatar";
import { Button, Spinner } from "@/components/Button";
import { ConfirmDialog, Modal } from "@/components/Modal";
import { EmptyState, ErrorState } from "@/components/States";
import { AlertsManageModal } from "@/features/alerts/AlertsManageModal";
import { AlertsRow } from "@/features/alerts/AlertsRow";
import { alertWhen } from "@/features/alerts/model";
import { useAlerts } from "@/features/alerts/useAlerts";
import { ConvoRow } from "@/features/convo/ConvoRow";
import { ConvoSheet } from "@/features/convo/ConvoSheet";
import { VaultModal } from "@/features/convo/VaultModal";
import { stamp } from "@/features/convo/model";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/errors";
import { useAuth } from "@/providers/AuthProvider";
import { useSocket, useSocketEvent } from "@/providers/SocketProvider";
import { useTheme } from "@/providers/ThemeProvider";
import { useToast } from "@/providers/ToastProvider";
import type {
  ChatRequest,
  MomentTray,
  Page,
  Relationship,
  RequestsBundle,
  Spark,
  ThreadCard,
  TrayMoment,
  UserCard,
  VaultState,
} from "@/types/api";

const CameraCapture = lazy(() =>
  import("@/features/camera/CameraCapture").then((module) => ({
    default: module.CameraCapture,
  })),
);

type Lane = "all" | "unread" | "groups" | "requested" | "calls";

function alertSeat(rows: ThreadCard[], pinned: boolean, at: string | null) {
  const mine = at ? Date.parse(at) : Number.NaN;
  let seat = 0;
  for (; seat < rows.length; seat++) {
    const row = rows[seat];
    const rowPinned = row.pinned === true;
    if (pinned !== rowPinned) {
      if (pinned) return seat;
      continue;
    }
    if (Number.isNaN(mine)) continue;
    const there = row.last_message_at
      ? Date.parse(row.last_message_at)
      : Number.NaN;
    if (Number.isNaN(there) || there < mine) return seat;
  }
  return seat;
}

interface CallPerson {
  user?: string;
  name?: string;
  username?: string;
  avatar?: string | null;
}

interface CallLog {
  id: string;
  kind?: string;
  at?: string | null;
  outgoing?: boolean;
  outcome?: string;
  seconds?: number;
  mine?: string;
  thread?: string | null;
  others?: CallPerson[];
}

function callLength(seconds: number) {
  const safe = Math.max(0, Math.min(86_399, Math.trunc(seconds)));
  const minutes = Math.floor(safe / 60);
  const tail = String(safe % 60).padStart(2, "0");
  if (minutes < 60) return `${String(minutes).padStart(2, "0")}:${tail}`;
  return `${Math.floor(minutes / 60)}:${String(minutes % 60).padStart(2, "0")}:${tail}`;
}

function callWho(log: CallLog) {
  const names = (log.others ?? [])
    .map((one) => one.name || one.username || "")
    .filter(Boolean);
  return names.length ? names.join(", ") : "Call";
}

function callLine(log: CallLog) {
  const outgoing = log.outgoing === true;
  if (log.mine === "declined") return "You declined";
  if (log.mine === "joined" || log.mine === "left") {
    const way = outgoing ? "Outgoing" : "Incoming";
    return log.seconds ? `${way} Â· ${callLength(log.seconds)}` : way;
  }
  if (log.outcome === "declined") return outgoing ? "Declined" : "Missed";
  return outgoing ? "No answer" : "Missed";
}

function callDay(at: string | null | undefined) {
  if (!at) return { key: "older", label: "Earlier" };
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return { key: "older", label: "Earlier" };
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  const same = (one: Date, two: Date) =>
    one.getFullYear() === two.getFullYear() &&
    one.getMonth() === two.getMonth() &&
    one.getDate() === two.getDate();
  if (same(date, today)) return { key: "today", label: "Today" };
  if (same(date, yesterday)) return { key: "yesterday", label: "Yesterday" };
  return {
    key: `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`,
    label: date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      ...(date.getFullYear() !== today.getFullYear()
        ? { year: "numeric" }
        : {}),
    }),
  };
}

function CallHistory() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const calls = useQuery({
    queryKey: ["call-history"],
    queryFn: () => api.get<{ results: CallLog[] }>("/calls/history/"),
    staleTime: 15_000,
  });

  if (calls.isLoading) {
    return (
      <div className="flex justify-center py-14">
        <Spinner />
      </div>
    );
  }
  if (calls.isError) {
    return (
      <ErrorState error={calls.error} onRetry={() => void calls.refetch()} />
    );
  }
  const rows = calls.data?.results ?? [];
  if (!rows.length) {
    return (
      <div className="px-2.5 pt-2">
        <div className="rounded-[22px] border border-line bg-card shadow-[0_1px_2px_rgba(17,17,26,0.04)]">
          <EmptyState
            icon={<Phone className="size-6" />}
            title="No calls yet"
            body="Calls you make and calls you miss are kept here."
            className="py-12"
          />
        </div>
      </div>
    );
  }

  const groups = new Map<string, { label: string; rows: CallLog[] }>();
  for (const log of rows) {
    const day = callDay(log.at);
    const bucket = groups.get(day.key);
    if (bucket) bucket.rows.push(log);
    else groups.set(day.key, { label: day.label, rows: [log] });
  }

  return (
    <div className="space-y-5 px-2.5 pb-5 pt-3">
      <div className="flex items-center justify-between px-1">
        <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-dim">
          Recent calls
        </p>
        <span className="rounded-full bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] px-2 py-0.5 text-[9.5px] font-bold text-dim">
          {rows.length}
        </span>
      </div>
      {Array.from(groups.entries()).map(([key, group]) => (
        <section key={key}>
          <h3 className="mb-2 px-1 text-[10px] font-extrabold uppercase tracking-[0.13em] text-dim">
            {group.label}
          </h3>
          <div className="space-y-2">
            {group.rows.map((log) => {
              const dead = log.mine !== "joined" && log.mine !== "left";
              const only = (log.others ?? []).length === 1;
              const Icon =
                log.kind === "video"
                  ? Video
                  : dead
                    ? PhoneMissed
                    : log.outgoing
                      ? PhoneOutgoing
                      : PhoneIncoming;
              const other = log.others?.[0];
              return (
                <div
                  key={log.id}
                  className="group flex min-h-[78px] items-center gap-1 rounded-[20px] border border-line bg-card px-2.5 py-2.5 shadow-[0_1px_2px_rgba(17,17,26,0.04)] transition hover:-translate-y-px hover:border-accent/25 hover:shadow-[0_6px_18px_rgba(17,17,26,0.07)]"
                >
                  <button
                    type="button"
                    disabled={!log.thread}
                    onClick={() =>
                      log.thread && navigate(`/app/convo/${log.thread}`)
                    }
                    className="flex min-w-0 flex-1 items-center gap-3 text-left disabled:cursor-default"
                  >
                    <Avatar src={other?.avatar} name={callWho(log)} size={46} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[14.5px] font-bold tracking-[-0.15px]">
                          {callWho(log)}
                        </span>
                        <span className="shrink-0 text-[10.5px] font-semibold text-dim">
                          {stamp(log.at)}
                        </span>
                      </span>
                      <span
                        className={cn(
                          "mt-1 flex items-center gap-1.5 text-[12px]",
                          dead ? "text-[var(--bad)]" : "text-dim",
                        )}
                      >
                        <span
                          className={cn(
                            "flex size-5 shrink-0 items-center justify-center rounded-full",
                            dead
                              ? "bg-[color-mix(in_srgb,var(--bad)_10%,transparent)]"
                              : "bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]",
                          )}
                        >
                          <Icon className="size-3" aria-hidden />
                        </span>
                        <span className="truncate">{callLine(log)}</span>
                        {log.kind === "video" ? (
                          <span className="shrink-0 rounded-full border border-line px-1.5 py-px text-[8px] font-extrabold uppercase tracking-wide text-dim">
                            Video
                          </span>
                        ) : null}
                      </span>
                    </span>
                  </button>
                  {only ? (
                    <button
                      type="button"
                      onClick={() =>
                        toast({
                          title: "Calls are not on the web yet",
                          description: "Open the convo to keep talking.",
                          tone: "info",
                        })
                      }
                      className="flex size-10 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent shadow-[0_3px_10px_color-mix(in_srgb,var(--accent)_12%,transparent)] transition hover:scale-105 hover:brightness-95"
                      aria-label={
                        log.kind === "video" ? "Video call back" : "Call back"
                      }
                    >
                      {log.kind === "video" ? (
                        <Video className="size-[17px]" />
                      ) : (
                        <Phone className="size-[17px]" />
                      )}
                    </button>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

function requestLine(request: Relationship | ChatRequest) {
  const raw = "message" in request ? request.message : null;
  if (!raw) return "";
  if (typeof raw === "string") return raw;
  if (typeof raw === "object" && "text" in raw) {
    const text = (raw as { text?: unknown }).text;
    return typeof text === "string" ? text : "";
  }
  return "";
}

function RequestsPanel() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const requests = useQuery({
    queryKey: ["social-requests"],
    queryFn: () => api.get<RequestsBundle>("/social/requests/"),
  });
  const [busy, setBusy] = useState<string | null>(null);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["social-requests"] });
    void queryClient.invalidateQueries({ queryKey: ["requests-count"] });
    void queryClient.invalidateQueries({ queryKey: ["threads"] });
  }

  async function answer(userId: string, yes: boolean) {
    setBusy(userId);
    try {
      await api.post(
        `/social/users/${userId}/${yes ? "accept" : "decline"}/`,
        {},
      );
      toast({
        title: yes ? "Accepted â€” the convo is open." : "Declined.",
        tone: "success",
      });
      refresh();
    } catch (error) {
      toast({
        title: "That request did not change",
        description: errorMessage(error),
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  if (requests.isLoading) {
    return (
      <div className="flex justify-center py-14">
        <Spinner />
      </div>
    );
  }
  if (requests.isError) {
    return (
      <ErrorState
        error={requests.error}
        onRetry={() => void requests.refetch()}
      />
    );
  }

  const chat = requests.data?.incoming_chat ?? [];
  const follow = requests.data?.incoming_follow ?? [];
  if (!chat.length && !follow.length) {
    return (
      <div className="px-2.5 pt-2">
        <div className="rounded-[22px] border border-line bg-card shadow-[0_1px_2px_rgba(17,17,26,0.04)]">
          <EmptyState
            icon={<UserPlus className="size-6" />}
            title="Nothing waiting"
            body="First lines and Keep requests land here."
            className="py-12"
          />
        </div>
      </div>
    );
  }

  function card(
    request: (typeof chat)[number] | (typeof follow)[number],
    withMessage: boolean,
  ) {
    const person = request.user;
    const name = person.name || person.username;
    const message = withMessage ? requestLine(request) : "";
    return (
      <div
        key={request.id}
        className="rounded-[20px] border border-line bg-card p-3.5 shadow-[0_1px_2px_rgba(17,17,26,0.04)]"
        style={{
          background:
            "linear-gradient(135deg, color-mix(in srgb, var(--accent) 5%, var(--card)), var(--card) 60%)",
        }}
      >
        <div className="flex items-center gap-3">
          <Avatar user={person} name={name} size={44} online={person.online} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14.5px] font-extrabold tracking-[-0.1px]">
              {name}
            </p>
            <p className="truncate text-[11px] text-dim">@{person.username}</p>
          </div>
          <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] px-2 py-0.5 text-[10px] font-semibold text-dim">
            {stamp(request.chat_at ?? request.follow_at ?? request.created_at)}
          </span>
        </div>
        {message ? (
          <div className="mt-3 rounded-[14px] border border-[color-mix(in_srgb,var(--accent)_10%,var(--line))] bg-[var(--accent-soft)] px-3.5 py-2.5 text-[13px] leading-[1.45]">
            {message}
          </div>
        ) : null}
        <div className="mt-3 flex gap-2.5">
          <button
            type="button"
            disabled={busy === person.id}
            onClick={() => void answer(person.id, false)}
            className="h-[42px] flex-1 rounded-[13px] border border-line bg-card text-[12.5px] font-bold text-dim transition hover:border-[color-mix(in_srgb,var(--ink)_18%,var(--line))] hover:text-ink disabled:opacity-55"
          >
            Decline
          </button>
          <button
            type="button"
            disabled={busy === person.id}
            onClick={() => void answer(person.id, true)}
            className="h-[42px] flex-1 rounded-[13px] bg-accent text-[12.5px] font-bold text-on-accent shadow-[0_4px_12px_color-mix(in_srgb,var(--accent)_22%,transparent)] transition hover:brightness-105 disabled:opacity-55"
          >
            {busy === person.id ? "Workingâ€¦" : "Accept"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 px-4 py-3">
      {chat.length ? (
        <>
          <h2 className="px-1 pt-2 text-[11px] font-extrabold uppercase tracking-[1.1px] text-dim">
            Waiting to talk
          </h2>
          {chat.map((request) => card(request, true))}
        </>
      ) : null}
      {follow.length ? (
        <>
          <h2 className="px-1 pt-2 text-[11px] font-extrabold uppercase tracking-[1.1px] text-dim">
            Keep requests
          </h2>
          {follow.map((request) => card(request, false))}
        </>
      ) : null}
    </div>
  );
}

export function NewConvoPanel({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [groupOpen, setGroupOpen] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const deferred = useDeferredValue(query.trim());
  const navigate = useNavigate();
  const { toast } = useToast();
  const tried = useRef("");
  const people = useQuery({
    queryKey: ["people-search", deferred],
    queryFn: () =>
      api.get<Page<UserCard>>("/auth/users/search/", {
        query: { q: deferred },
      }),
    staleTime: 10_000,
  });
  const vault = useQuery({
    queryKey: ["vault"],
    queryFn: () => api.get<VaultState>("/chat/vault/"),
    retry: false,
    staleTime: 20_000,
  });

  useEffect(() => {
    if (!vault.data?.hidden) {
      tried.current = "";
      return;
    }
    const code = query.trim();
    if (code.length !== (vault.data.length || 4)) {
      tried.current = "";
      return;
    }
    if (!/^\d+$/.test(code) || tried.current === code) return;
    tried.current = code;
    void api
      .post("/chat/vault/unlock/", { code })
      .then(() => {
        tried.current = "";
        setQuery("");
        setVaultOpen(true);
      })
      .catch(() => undefined);
  }, [query, vault.data]);

  async function start(person: UserCard) {
    setBusy(person.id);
    try {
      const response = await api.post<{
        thread: ThreadCard | null;
        gate?: { reason?: string };
      }>("/chat/threads/", {
        user: person.id,
      });
      if (!response.thread) {
        toast({
          title: "This convo is not open yet",
          description:
            response.gate?.reason ||
            "They have not accepted a conversation with you.",
          tone: "info",
        });
        navigate(`/app/u/${person.username}`);
        onClose();
        return;
      }
      onClose();
      navigate(`/app/convo/${response.thread.id}`);
    } catch (error) {
      toast({
        title: "Could not start that convo",
        description: errorMessage(error),
        tone: "error",
      });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col bg-transparent">
      <header className="flex shrink-0 items-center gap-3 border-b border-line px-3.5 py-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-[12px] bg-[var(--accent-soft)] text-accent">
          <UserPlus className="size-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="truncate text-[14px] font-extrabold tracking-[-0.02em]">
            New convo
          </h2>
          <p className="truncate text-[10.5px] text-dim">
            Find someone by name or @handle.
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-8 shrink-0 items-center justify-center rounded-full text-dim transition hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] hover:text-ink active:scale-95"
          aria-label="Close new convo"
        >
          <X className="size-4" />
        </button>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-2.5 p-3">
        <label className="flex min-h-11 items-center gap-2.5 rounded-[12px] border border-line bg-paper px-3 shadow-[inset_0_1px_2px_rgba(17,17,26,0.03)] transition focus-within:border-accent focus-within:bg-card focus-within:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_10%,transparent)]">
          <Search className="size-4 shrink-0 text-dim" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
            placeholder="Search people"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-dim"
          />
        </label>

        <button
          type="button"
          onClick={() => setGroupOpen(true)}
          className="flex w-full shrink-0 items-center gap-3 rounded-[14px] border px-3 py-2.5 text-left transition hover:-translate-y-px hover:brightness-[1.01]"
          style={{
            background:
              "linear-gradient(135deg, color-mix(in srgb, var(--accent) 10%, var(--card)), var(--card) 75%)",
            borderColor: "color-mix(in srgb, var(--accent) 18%, var(--line))",
          }}
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-[11px] bg-accent text-on-accent shadow-[0_5px_14px_color-mix(in_srgb,var(--accent)_26%,transparent)]">
            <Users className="size-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[12px] font-extrabold">
              Start a group
            </span>
            <span className="block truncate text-[10px] text-dim">
              Name it and bring people in.
            </span>
          </span>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-card text-accent shadow-sm">
            <ArrowRight className="size-3.5" />
          </span>
        </button>

        <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
          {people.isLoading ? (
            <div className="flex h-full min-h-40 items-center justify-center">
              <Spinner />
            </div>
          ) : people.isError ? (
            <ErrorState
              error={people.error}
              onRetry={() => void people.refetch()}
              compact
            />
          ) : !people.data?.results?.length ? (
            <div className="flex h-full min-h-40 flex-col items-center justify-center py-8 text-center">
              <span className="flex size-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent">
                <Search className="size-4" />
              </span>
              <p className="mt-3 text-[12px] font-bold">
                {deferred ? "Nobody matched" : "No accounts to show"}
              </p>
              <p className="mt-1 text-[10.5px] text-dim">
                {deferred
                  ? `Nothing found for \u201c${deferred}\u201d.`
                  : "Try a name or an @handle."}
              </p>
            </div>
          ) : (
            <>
              <p className="px-1 pb-1.5 pt-1 text-[9.5px] font-extrabold uppercase tracking-[0.13em] text-dim">
                {deferred ? "Results" : "People you may know"}
              </p>
              <div className="space-y-1">
                {people.data.results.map((person) => (
                  <button
                    key={person.id}
                    type="button"
                    onClick={() => void start(person)}
                    disabled={Boolean(busy)}
                    className="group flex w-full items-center gap-3 rounded-[14px] border border-transparent px-2.5 py-2.5 text-left transition hover:border-line hover:bg-[color-mix(in_srgb,var(--accent)_4%,var(--card))] disabled:opacity-55"
                  >
                    <Avatar user={person} size={40} online={person.online} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[12.5px] font-extrabold">
                        {person.name || person.username}
                      </span>
                      <span className="block truncate text-[10.5px] text-dim">
                        @{person.username}
                        {person.online ? " \u00b7 online" : ""}
                      </span>
                    </span>
                    {busy === person.id ? (
                      <Spinner className="size-4" />
                    ) : (
                      <span className="flex size-8 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent opacity-80 transition group-hover:opacity-100">
                        <MessageCircle className="size-4" />
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      <NewGroupModal
        open={groupOpen}
        onClose={() => setGroupOpen(false)}
        onCreated={onClose}
      />

      <VaultModal
        open={vaultOpen}
        onClose={() => {
          setVaultOpen(false);
          onClose();
        }}
        onOpenThread={(thread) => {
          setVaultOpen(false);
          onClose();
          navigate(`/app/convo/${thread.id}`);
        }}
      />
    </div>
  );
}

function NewGroupModal({
  open,
  onClose,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}) {
  const [title, setTitle] = useState("");
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<UserCard[]>([]);
  const [busy, setBusy] = useState(false);
  const deferred = useDeferredValue(query.trim());
  const navigate = useNavigate();
  const { toast } = useToast();
  const people = useQuery({
    queryKey: ["group-people", deferred],
    queryFn: () =>
      api.get<Page<UserCard>>("/auth/users/search/", {
        query: { q: deferred },
      }),
    enabled: open,
    staleTime: 10_000,
  });

  useEffect(() => {
    if (!open) {
      setTitle("");
      setQuery("");
      setMembers([]);
    }
  }, [open]);

  function toggle(person: UserCard) {
    setMembers((current) =>
      current.some((row) => row.id === person.id)
        ? current.filter((row) => row.id !== person.id)
        : [...current, person],
    );
  }

  async function create(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      toast({ title: "Give the group a name", tone: "info" });
      return;
    }
    if (!members.length) {
      toast({ title: "Bring at least one person in", tone: "info" });
      return;
    }
    setBusy(true);
    try {
      const response = await api.post<{ thread: ThreadCard }>("/chat/groups/", {
        title: title.trim(),
        members: members.map((person) => person.id),
      });
      toast({ title: "Group made", tone: "success" });
      onClose();
      onCreated?.();
      navigate(`/app/convo/${response.thread.id}`);
    } catch (error) {
      toast({
        title: "The group was not made",
        description: errorMessage(error),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New group"
      description="Every group starts with a name and the people in it."
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] text-dim">
            {members.length} {members.length === 1 ? "person" : "people"}
          </span>
          <Button
            type="submit"
            form="new-group"
            loading={busy}
            icon={<Users className="size-4" />}
          >
            Make group
          </Button>
        </div>
      }
    >
      <form
        id="new-group"
        onSubmit={(event) => void create(event)}
        className="space-y-3 p-4"
      >
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          maxLength={140}
          autoFocus
          placeholder="Group name"
          className="min-h-12 w-full rounded-[15px] border border-line bg-paper px-3.5 text-sm font-semibold outline-none transition focus:border-accent focus:bg-card focus:shadow-[0_0_0_3px_color-mix(in_srgb,var(--accent)_10%,transparent)]"
        />
        {members.length ? (
          <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
            {members.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => toggle(person)}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-[color-mix(in_srgb,var(--accent)_16%,var(--line))] bg-[var(--accent-soft)] py-1 pl-1 pr-2 text-[10.5px] font-bold text-accent transition hover:brightness-95"
              >
                <Avatar user={person} size={24} />
                {person.name || person.username}
                <X className="size-3" />
              </button>
            ))}
          </div>
        ) : null}
        <label className="flex min-h-12 items-center gap-2.5 rounded-[15px] border border-line bg-paper px-3.5 transition focus-within:border-accent focus-within:bg-card">
          <Search className="size-4 text-dim" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Find people to add"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-dim"
          />
        </label>
        <div className="flex items-center justify-between px-1 pt-1">
          <p className="text-[9.5px] font-extrabold uppercase tracking-[0.13em] text-dim">
            {members.length ? "In this group" : "Add people"}
          </p>
          {members.length ? (
            <span className="rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[9.5px] font-extrabold text-accent">
              {members.length} selected
            </span>
          ) : null}
        </div>
        {people.isLoading ? (
          <div className="flex justify-center py-6">
            <Spinner />
          </div>
        ) : !people.data?.results?.length ? (
          <div className="py-8 text-center">
            <span className="mx-auto flex size-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent">
              <UserPlus className="size-4" />
            </span>
            <p className="mt-3 text-[12px] font-bold">
              {deferred ? "Nobody matched" : "Search for the first person"}
            </p>
            <p className="mt-1 text-[10.5px] text-dim">
              {deferred
                ? `Nothing found for \u201c${deferred}\u201d.`
                : "They will be added when you make the group."}
            </p>
          </div>
        ) : (
          <div className="max-h-[34dvh] space-y-1 overflow-y-auto">
            {people.data.results.map((person) => {
              const selected = members.some((row) => row.id === person.id);
              return (
                <button
                  key={person.id}
                  type="button"
                  onClick={() => toggle(person)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[14px] border px-2.5 py-2.5 text-left transition",
                    selected
                      ? "border-[color-mix(in_srgb,var(--accent)_22%,var(--line))] bg-[var(--accent-soft)]"
                      : "border-transparent hover:border-line hover:bg-[color-mix(in_srgb,var(--accent)_4%,var(--card))]",
                  )}
                >
                  <Avatar user={person} size={38} online={person.online} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[12.5px] font-extrabold">
                      {person.name || person.username}
                    </span>
                    <span className="block truncate text-[10.5px] text-dim">
                      @{person.username}
                    </span>
                  </span>
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full border transition",
                      selected
                        ? "border-accent bg-accent text-on-accent"
                        : "border-line bg-card",
                    )}
                  >
                    {selected ? <Check className="size-3" /> : null}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </form>
    </Modal>
  );
}

function MenuRow({
  icon,
  title,
  body,
  right,
  danger,
  disabled,
  onClick,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
  right?: string;
  danger?: boolean;
  disabled?: boolean;
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
        <span className="block truncate text-[10.5px] leading-4 text-dim">
          {body}
        </span>
      </span>
      {right ? (
        <span className="shrink-0 rounded-full bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] px-2 py-0.5 text-[10px] font-bold text-dim">
          {right}
        </span>
      ) : null}
    </button>
  );
}

export function ConvoPage({
  embedded = false,
  activeThreadId,
  composeOpen = false,
  onToggleCompose,
}: {
  embedded?: boolean;
  activeThreadId?: string;
  composeOpen?: boolean;
  onToggleCompose?: () => void;
}) {
  const [params, setParams] = useSearchParams();
  const raw = params.get("lane") ?? params.get("tab");
  const lane: Lane =
    raw === "unread"
      ? "unread"
      : raw === "groups"
        ? "groups"
        : raw === "requested" || raw === "requests"
          ? "requested"
          : raw === "calls"
            ? "calls"
            : "all";
  const [newGroup, setNewGroup] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [vaultOpen, setVaultOpen] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [alertsOpen, setAlertsOpen] = useState(false);
  const [selected, setSelected] = useState<ThreadCard | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [listSearch, setListSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, logout } = useAuth();
  const { status: socketStatus } = useSocket();
  const { design } = useTheme();

  useEffect(() => {
    if (!searchOpen) return;
    const timer = window.setTimeout(() => searchInputRef.current?.focus(), 140);
    return () => window.clearTimeout(timer);
  }, [searchOpen]);

  const threads = useQuery({
    queryKey: ["threads"],
    queryFn: () =>
      api.get<{ threads: ThreadCard[]; unread: number }>("/chat/threads/"),
  });
  const vault = useQuery({
    queryKey: ["vault"],
    queryFn: () => api.get<VaultState>("/chat/vault/"),
    retry: false,
    staleTime: 20_000,
  });
  const alerts = useAlerts();
  const sparks = useQuery({
    queryKey: ["sparks"],
    queryFn: () => api.get<{ sparks: Spark[] }>("/sparks/"),
    staleTime: 60_000,
  });
  const moments = useQuery({
    queryKey: ["moments-tray"],
    queryFn: () => api.get<MomentTray>("/moments/tray/"),
    staleTime: 30_000,
  });
  const requests = useQuery({
    queryKey: ["social-requests"],
    queryFn: () => api.get<RequestsBundle>("/social/requests/"),
    staleTime: 15_000,
  });
  useSocketEvent(
    [
      "message.new",
      "thread.update",
      "request.count",
      "request.new",
      "call.ended",
      "call.update",
    ],
    () => {
      void queryClient.invalidateQueries({ queryKey: ["threads"] });
      void queryClient.invalidateQueries({ queryKey: ["requests-count"] });
      void queryClient.invalidateQueries({ queryKey: ["social-requests"] });
      void queryClient.invalidateQueries({ queryKey: ["call-history"] });
    },
  );

  const rows = useMemo(() => threads.data?.threads ?? [], [threads.data]);
  const unreadRows = useMemo(
    () =>
      rows.filter((thread) => (thread.unread_count ?? thread.unread ?? 0) > 0),
    [rows],
  );
  const pinnedCount = useMemo(
    () =>
      rows.filter((thread) => thread.pinned).length +
      (alerts.data?.pinned ? 1 : 0),
    [rows, alerts.data?.pinned],
  );
  const sparkByThread = useMemo(
    () =>
      new Map(
        (sparks.data?.sparks ?? []).map(
          (spark) =>
            [String(spark.thread_id ?? spark.thread ?? ""), spark] as const,
        ),
      ),
    [sparks.data],
  );
  const momentByAuthor = useMemo(() => {
    const found = new Map<string, TrayMoment>();
    for (const row of [
      ...(moments.data?.unseen ?? []),
      ...(moments.data?.seen ?? []),
    ]) {
      if (row.author?.id && !found.has(row.author.id))
        found.set(row.author.id, row);
    }
    return found;
  }, [moments.data]);
  const requestCount =
    (requests.data?.incoming_chat?.length ?? 0) +
    (requests.data?.incoming_follow?.length ?? 0);
  const filteredRows = useMemo(() => {
    const query = listSearch.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((thread) => {
      const person = thread.other ?? thread.member ?? thread.members?.[0]?.user;
      return [
        thread.title,
        person?.name,
        person?.username,
        thread.preview?.text,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [listSearch, rows]);

  function refresh() {
    void queryClient.invalidateQueries({ queryKey: ["threads"] });
    void queryClient.invalidateQueries({ queryKey: ["vault"] });
    void queryClient.invalidateQueries({ queryKey: ["vault-rows"] });
    void queryClient.invalidateQueries({ queryKey: ["sparks"] });
    void queryClient.invalidateQueries({ queryKey: ["moments-tray"] });
  }

  function setLane(next: Lane) {
    setParams(
      (current) => {
        const copy = new URLSearchParams(current);
        copy.delete("tab");
        if (next === "all") copy.delete("lane");
        else copy.set("lane", next);
        return copy;
      },
      { replace: true },
    );
  }

  function toggleSearch() {
    if (searchOpen) {
      setListSearch("");
      setSearchOpen(false);
      searchInputRef.current?.blur();
    } else {
      setSearchOpen(true);
    }
  }

  async function readAll() {
    if (!unreadRows.length) {
      toast({ title: "Nothing is waiting to be read.", tone: "info" });
      return;
    }
    setMenuOpen(false);
    try {
      await api.post("/chat/threads/read/", {});
      await queryClient.invalidateQueries({ queryKey: ["threads"] });
      await queryClient.invalidateQueries({ queryKey: ["requests-count"] });
      toast({ title: "All caught up.", tone: "success" });
    } catch (error) {
      toast({
        title: "Could not mark them read",
        description: errorMessage(error),
        tone: "error",
      });
    }
  }

  const lanes: { key: Lane; label: string; count?: number }[] = [
    { key: "all", label: "All", count: filteredRows.length },
    {
      key: "unread",
      label: "Unread",
      count: filteredRows.filter(
        (thread) => (thread.unread_count ?? thread.unread ?? 0) > 0,
      ).length,
    },
    {
      key: "groups",
      label: "Groups",
      count: filteredRows.filter((thread) => thread.kind === "group").length,
    },
    { key: "requested", label: "Requests", count: requestCount },
    { key: "calls", label: "Calls" },
  ];

  const displayRows =
    lane === "unread"
      ? filteredRows.filter(
          (thread) => (thread.unread_count ?? thread.unread ?? 0) > 0,
        )
      : lane === "groups"
        ? filteredRows.filter((thread) => thread.kind === "group")
        : filteredRows;
  const showAlerts = lane === "all";
  const newestAlert = alerts.data?.results?.[0];
  const alertAt = newestAlert ? alertWhen(newestAlert) : null;
  const alertRowSeat = showAlerts
    ? alertSeat(
        displayRows,
        alerts.data?.pinned === true,
        alertAt ? alertAt.toISOString() : null,
      )
    : -1;
  const alertRow = showAlerts ? (
    <AlertsRow
      data={alerts.data}
      onOpen={() => navigate("/app/alerts")}
      onManage={() => setAlertsOpen(true)}
    />
  ) : null;

  return (
    <div
      className={cn(
        "relative flex min-h-0 flex-col overflow-hidden bg-page",
        embedded
          ? "h-full"
          : "min-h-dvh pb-[calc(92px+env(safe-area-inset-bottom,0px))] md:pb-24",
      )}
    >
      <header
        className={cn("z-30 w-full shrink-0 bg-page", !embedded && "sticky top-0")}
      >
        <div className="relative mx-auto flex h-[58px] w-full max-w-[760px] items-center justify-between px-3">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="shrink-0 rounded-full transition hover:brightness-105"
              aria-label="Convo list menu"
              title="Convo list menu"
            >
              <Avatar user={user} name={user?.name} size={38} />
            </button>

            <button
              type="button"
              onClick={toggleSearch}
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full transition",
                searchOpen ? "text-accent" : "text-ink hover:text-accent",
              )}
              aria-label={
                searchOpen
                  ? "Hide conversation search"
                  : "Search conversations"
              }
              aria-expanded={searchOpen}
              title={searchOpen ? "Hide search" : "Search conversations"}
            >
              <Search className="size-[23px]" strokeWidth={2.1} />
            </button>
          </div>

          <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2">
            <h1 className="text-[22px] font-extrabold leading-none tracking-[-0.04em]">
              Convo
            </h1>
            <span
              className={cn(
                "size-[7px] shrink-0 rounded-full",
                socketStatus === "live" &&
                  "shadow-[0_0_0_3px_color-mix(in_srgb,var(--good)_10%,transparent)]",
              )}
              style={{
                backgroundColor:
                  socketStatus === "live"
                    ? "var(--good)"
                    : "color-mix(in srgb, var(--ink) 22%, transparent)",
              }}
              aria-label={socketStatus === "live" ? "Live" : "Offline"}
              title={socketStatus === "live" ? "Live" : "Offline"}
            />
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={onToggleCompose}
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full text-ink transition hover:text-accent",
                composeOpen && "text-accent",
              )}
              aria-label={composeOpen ? "Close new convo" : "New convo"}
              aria-pressed={composeOpen}
              title={composeOpen ? "Close new convo" : "New convo"}
            >
              <FaUserPlus className="ml-0.5 size-[23px]" />
            </button>

            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="flex size-10 shrink-0 items-center justify-center rounded-full text-ink transition hover:text-accent"
              aria-label="Camera"
              title="Camera"
            >
              <Camera className="size-[24px]" />
            </button>
          </div>
        </div>
      </header>

      <div className="relative mx-auto flex min-h-0 w-full max-w-[760px] flex-1 flex-col">
        <div
          className={cn(
            "grid transition-all duration-200 ease-out motion-reduce:transition-none",
            searchOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
          aria-hidden={!searchOpen}
        >
          <div className="min-h-0 overflow-hidden">
            <div className="px-2 py-1.5">
              <label className="flex min-h-10 items-center gap-2 rounded-[10px] border border-line/80 bg-[color-mix(in_srgb,var(--card)_76%,transparent)] px-3 shadow-[0_2px_10px_rgba(17,17,26,0.03)] backdrop-blur focus-within:border-accent">
                <Search className="size-4 shrink-0 text-dim" aria-hidden />
                <input
                  ref={searchInputRef}
                  value={listSearch}
                  onChange={(event) => setListSearch(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") toggleSearch();
                  }}
                  tabIndex={searchOpen ? 0 : -1}
                  placeholder="Search your conversations"
                  className="min-w-0 flex-1 bg-transparent text-[12px] font-semibold outline-none placeholder:text-dim"
                  aria-label="Search conversations"
                />
                {listSearch ? (
                  <button
                    type="button"
                    onClick={() => setListSearch("")}
                    className="text-dim transition hover:text-ink"
                    aria-label="Clear conversation search"
                  >
                    <X className="size-3.5" />
                  </button>
                ) : null}
              </label>
            </div>
          </div>
        </div>

        <div
          className="mx-auto flex w-full max-w-[760px] shrink-0 items-stretch"
          role="tablist"
          aria-label="Convo lanes"
        >
          {lanes
            .filter((item) => item.key !== "requested")
            .map((item) => {
              const on = lane === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  role="tab"
                  aria-selected={on}
                  onClick={() => setLane(item.key)}
                  className={cn(
                    "relative flex h-[46px] min-w-0 flex-1 items-center justify-center gap-1 text-[15.5px] transition-colors",
                    on
                      ? "font-extrabold text-accent"
                      : "font-semibold text-dim hover:text-ink",
                  )}
                >
                  <span className="truncate">{item.label}</span>
                  {item.key === "all" && item.count ? (
                    <span className="tabular-nums">{item.count}</span>
                  ) : null}
                  {on ? (
                    <span
                      className="absolute inset-x-0 bottom-0 h-[3px] bg-accent"
                      aria-hidden
                    />
                  ) : null}
                </button>
              );
            })}
        </div>

        <main
          className={cn(
            "min-h-0 flex-1 overflow-y-auto",
            embedded &&
              "pb-[calc(92px+env(safe-area-inset-bottom,0px))] md:pb-4",
          )}
        >
          {lane === "requested" ? (
            <RequestsPanel />
          ) : lane === "calls" ? (
            <CallHistory />
          ) : threads.isLoading ? (
            <div className="pb-4" aria-hidden>
              {[0, 1, 2, 3, 4].map((row) => (
                <div
                  key={row}
                  className="flex min-h-[64px] items-center gap-2 border-b border-line/70 py-2 pl-2 pr-2.5"
                >
                  <div className="skeleton size-[52px] shrink-0 rounded-full" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton h-3 w-36 rounded-full" />
                    <div className="skeleton h-2.5 w-52 max-w-full rounded-full" />
                  </div>
                  <div className="skeleton h-2.5 w-8 rounded-full" />
                </div>
              ))}
            </div>
          ) : threads.isError ? (
            <div className="px-2.5 pt-2">
              <div className="rounded-[22px] border border-line bg-card shadow-[0_1px_2px_rgba(17,17,26,0.04)]">
                <ErrorState
                  error={threads.error}
                  onRetry={() => void threads.refetch()}
                />
              </div>
            </div>
          ) : !displayRows.length && lane !== "all" ? (
            <div className="px-2.5 pt-2">
              <div className="rounded-[22px] border border-line bg-card shadow-[0_1px_2px_rgba(17,17,26,0.04)]">
                {lane === "unread" ? (
                  <EmptyState
                    icon={<CheckCheck className="size-6" />}
                    title="All caught up"
                    body="Nothing is waiting to be read."
                    className="py-12"
                  />
                ) : lane === "groups" ? (
                  <EmptyState
                    icon={<Users className="size-6" />}
                    title="No groups yet"
                    body="A group comes from a convo with more than two people."
                    action={
                      <Button onClick={() => setNewGroup(true)}>
                        Start a group
                      </Button>
                    }
                    className="py-12"
                  />
                ) : (
                  <EmptyState
                    icon={<MessageCircle className="size-6" />}
                    title="No convos yet"
                    body="Find someone, Keep them, and start the first convo."
                    action={
                      <Button onClick={() => navigate("/app/search")}>
                        Find people
                      </Button>
                    }
                    className="py-12"
                  />
                )}
              </div>
            </div>
          ) : (
            <div className="pb-3">
              {displayRows.map((thread, index) => {
                const face =
                  thread.other ?? thread.member ?? thread.members?.[0]?.user;
                const moment =
                  thread.kind === "group" || !face?.id
                    ? undefined
                    : momentByAuthor.get(face.id);
                return (
                  <Fragment key={thread.id}>
                    {alertRowSeat === index ? alertRow : null}
                    <ConvoRow
                      thread={thread}
                      active={activeThreadId === thread.id}
                      spark={sparkByThread.get(thread.id)}
                      moment={
                        moment
                          ? {
                              seen: moment.seen,
                              author: moment.author?.username,
                            }
                          : null
                      }
                      onOpen={() => navigate(`/app/convo/${thread.id}`)}
                      onActions={() => {
                        setSelected(thread);
                        setSheetOpen(true);
                      }}
                      onOpenMoment={(username) =>
                        navigate(
                          `/app/moments?user=${encodeURIComponent(username)}`,
                        )
                      }
                      onOpenSpark={() => navigate("/app/sparks")}
                    />
                  </Fragment>
                );
              })}
              {alertRowSeat === displayRows.length ? alertRow : null}
              {!displayRows.length ? (
                <div className="rounded-[22px] border border-line bg-card shadow-[0_1px_2px_rgba(17,17,26,0.04)]">
                  <EmptyState
                    icon={<MessageCircle className="size-6" />}
                    title="No convos yet"
                    body="Find people, and start the first convo."
                    action={
                      <Button onClick={() => navigate("/app/search")}>
                        Find people
                      </Button>
                    }
                    className="py-12"
                  />
                </div>
              ) : null}
            </div>
          )}
        </main>
      </div>

      <NewGroupModal open={newGroup} onClose={() => setNewGroup(false)} />

      <ConvoSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        thread={selected}
        kind="list"
        pinnedCount={pinnedCount}
        onChanged={refresh}
        onGone={() => {
          refresh();
          if (selected?.id && activeThreadId === selected.id)
            navigate("/app/convo");
        }}
        onGroupSettings={(thread) => navigate(`/app/convo/${thread.id}?info=1`)}
      />

      <AlertsManageModal
        open={alertsOpen}
        onClose={() => setAlertsOpen(false)}
        data={alerts.data}
        pins={pinnedCount}
      />

      <VaultModal
        open={vaultOpen}
        onClose={() => setVaultOpen(false)}
        onChanged={refresh}
        onOpenThread={(thread) => navigate(`/app/convo/${thread.id}`)}
      />

      {cameraOpen ? (
        <Suspense
          fallback={
            <div className="fixed inset-0 z-[90] grid place-items-center bg-black text-white">
              <Spinner className="size-7 text-white" />
            </div>
          }
        >
          <CameraCapture
            open={cameraOpen}
            onClose={() => setCameraOpen(false)}
            onPosted={() => {
              void queryClient.invalidateQueries({ queryKey: ["threads"] });
              void queryClient.invalidateQueries({
                queryKey: ["moments-tray"],
              });
              void queryClient.invalidateQueries({ queryKey: ["moments"] });
            }}
            fromChat={true}
          />
        </Suspense>
      ) : null}

      <Modal
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        title="Convos"
        description="The whole list"
        size="sm"
      >
        <div className="space-y-0.5 p-2 pb-3">
          <MenuRow
            icon={<CheckCheck className="size-4" />}
            title="Mark all read"
            body={
              unreadRows.length === 0
                ? "Nothing is waiting."
                : unreadRows.length === 1
                  ? "One convo is waiting."
                  : `${unreadRows.length} convos are waiting.`
            }
            disabled={!unreadRows.length}
            onClick={() => void readAll()}
          />
          <MenuRow
            icon={<Camera className="size-4" />}
            title="Camera"
            body="Right now, with the camera."
            onClick={() => {
              setMenuOpen(false);
              setCameraOpen(true);
            }}
          />
          <MenuRow
            icon={<MessageCircle className="size-4" />}
            title="Requests"
            body={
              requestCount
                ? `${requestCount} waiting for an answer.`
                : "Chat requests waiting for you."
            }
            right={requestCount ? String(requestCount) : undefined}
            onClick={() => {
              setMenuOpen(false);
              setLane("requested");
            }}
          />
          {vault.data && !vault.data.hidden ? (
            <MenuRow
              icon={<Lock className="size-4" />}
              title="Vault"
              body={
                vault.data.code_set
                  ? "Behind your code."
                  : "Convos kept out of this list."
              }
              right={
                vault.data.count == null ? undefined : String(vault.data.count)
              }
              onClick={() => {
                setMenuOpen(false);
                setVaultOpen(true);
              }}
            />
          ) : null}
          <MenuRow
            icon={<Sparkles className="size-4" />}
            title="Reward"
            body="Themes to wear, and the sparks they cost."
            right={design.name}
            onClick={() => {
              setMenuOpen(false);
              navigate("/app/sparks");
            }}
          />
          <MenuRow
            icon={<Settings className="size-4" />}
            title="Settings"
            body="Account, privacy, and appearance."
            onClick={() => {
              setMenuOpen(false);
              navigate("/app/settings");
            }}
          />
          <div className="mx-3 my-1.5 h-px bg-line" />
          <MenuRow
            icon={<LogOut className="size-4" />}
            title="Sign out"
            body="You will need your password again."
            danger
            onClick={() => {
              setMenuOpen(false);
              setSignOutOpen(true);
            }}
          />
        </div>
      </Modal>

      <ConfirmDialog
        open={signOutOpen}
        onClose={() => setSignOutOpen(false)}
        onConfirm={() => {
          setSignOutOpen(false);
          void logout();
        }}
        title="Sign out?"
        body="You will need your password or a QR from the Android app to come back."
        confirmLabel="Sign out"
        destructive
      />
    </div>
  );
}
