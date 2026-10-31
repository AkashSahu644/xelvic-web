import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Check,
  ChevronRight,
  CircleHelp,
  Laptop,
  LockKeyhole,
  MoreVertical,
  RefreshCw,
  ScanLine,
  ShieldCheck,
  Smartphone,
  TriangleAlert,
  X,
} from "lucide-react";
import { BiSolidUserPlus } from "react-icons/bi";
import { Wordmark } from "@/components/Brand";
import { Button } from "@/components/Button";
import { useQrSignIn, type QrPhase } from "@/features/auth/useQrSignIn";
import { API_ORIGIN } from "@/lib/env";
import { cn } from "@/lib/cn";

function browserClaim() {
  const ua = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const browser = /Edg\//.test(ua)
    ? "Edge"
    : /Chrome\//.test(ua)
      ? "Chrome"
      : /Safari\//.test(ua)
        ? "Safari"
        : /Firefox\//.test(ua)
          ? "Firefox"
          : "this browser";
  const system = /Windows/.test(ua)
    ? "Windows"
    : /Mac OS X|Macintosh/.test(ua)
      ? "macOS"
      : /Android/.test(ua)
        ? "Android"
        : /iPhone|iPad/.test(ua)
          ? "iOS"
          : /Linux/.test(ua)
            ? "Linux"
            : "an unknown system";
  return `${browser} on ${system}`;
}

const phaseCopy: Partial<Record<QrPhase, { title: string; body: string }>> = {
  waiting: {
    title: "Scan with your phone",
    body: "Open the Xelvic app and scan this QR code.",
  },
  scanned: {
    title: "Phone detected",
    body: "Check your phone to confirm your account connection.",
  },
  approved: {
    title: "Approved",
    body: "Phone confirmed. Establishing session...",
  },
  collecting: {
    title: "Signing in",
    body: "Connecting browser session...",
  },
  collected: {
    title: "Success!",
    body: "You are signed in — redirecting...",
  },
  denied: {
    title: "Connection denied",
    body: "Sign-in was not approved on your phone.",
  },
  expired: {
    title: "QR code expired",
    body: "This QR code is no longer valid. Request a new code.",
  },
  error: {
    title: "Sign-in is temporarily unavailable",
    body: "Please wait a moment before trying again.",
  },
};

function QrPanel({
  phase,
  code,
  match,
  codeSeconds,
  sessionSeconds,
  error,
  retryable,
  restart,
}: {
  phase: QrPhase;
  code: string;
  match: string;
  codeSeconds: number;
  sessionSeconds: number;
  error: string | null;
  retryable: boolean;
  restart: () => void;
}) {
  const copy = phaseCopy[phase];
  const rotating = phase === "starting";
  const terminal = ["denied", "expired", "unavailable", "error"].includes(
    phase,
  );
  const sessionLife =
    sessionSeconds > 0 ? Math.min(1, sessionSeconds / 300) : 0;

  if (phase === "unavailable") {
    return (
      <div className="flex flex-col items-center rounded-[16px] border border-line bg-card p-6 text-center shadow-sm">
        <span className="flex size-14 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent">
          <Smartphone className="size-7" aria-hidden />
        </span>
        <h3 className="mt-4 text-[18px] font-extrabold tracking-tight">
          QR sign-in unavailable
        </h3>
        <p className="mt-2 max-w-[300px] text-[13px] leading-6 text-dim">
          Server route{" "}
          <span className="font-mono text-[11px] text-ink">
            {API_ORIGIN}/api/v1/auth/qr/start/
          </span>{" "}
          could not be reached.
        </p>
        <div className="mt-4 rounded-xl border border-dashed border-line bg-[color-mix(in_srgb,var(--page)_70%,var(--card))] px-3 py-2 text-[12px] text-dim">
          "Credential sign-in preview is available below. Mobile confirmation
          will be connected later."
        </div>
        <Button
          variant="secondary"
          size="sm"
          className="mt-4"
          icon={<RefreshCw className="size-3.5" />}
          onClick={restart}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (terminal) {
    return (
      <div className="flex flex-col items-center rounded-[16px] border border-line bg-card p-6 text-center">
        <span
          className={cn(
            "flex size-14 items-center justify-center rounded-full",
            phase === "error"
              ? "bg-[color-mix(in_srgb,var(--bad)_12%,var(--card))] text-[var(--bad)]"
              : "bg-[var(--accent-soft)] text-accent",
          )}
        >
          {phase === "denied" ? (
            <X className="size-6" />
          ) : phase === "expired" ? (
            <RefreshCw className="size-6" />
          ) : (
            <TriangleAlert className="size-6" />
          )}
        </span>
        <h3 className="mt-4 text-[18px] font-extrabold tracking-tight">
          {copy?.title ?? "Something went wrong"}
        </h3>
        <p className="mt-2 max-w-[300px] text-[13px] leading-6 text-dim">
          {error || copy?.body}
        </p>
        {retryable ? (
          <Button
            className="mt-5"
            size="sm"
            icon={<RefreshCw className="size-3.5" />}
            onClick={restart}
          >
            Request new QR code
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      {/* QR card */}
      <div className="relative rounded-[16px] border border-[color-mix(in_srgb,var(--line)_70%,transparent)] bg-white p-[12px] shadow-[0_4px_16px_rgba(0,0,0,0.08)]">
        {rotating ? (
          <div className="flex size-[240px] flex-col items-center justify-center gap-3 rounded-[12px] bg-surface-2 sm:size-[260px]">
            <span className="size-8 animate-spin rounded-full border-[3px] border-line border-t-[var(--accent)]" />
            <span className="text-[12px] font-bold tracking-wide text-dim">
              Generating code...
            </span>
          </div>
        ) : (
          <div className="rounded-[12px] bg-white p-1">
            <QRCodeSVG
              value={`xelvic://l/${code}`}
              size={240}
              level="M"
              marginSize={1}
              bgColor="#FFFFFF"
              fgColor="#111B21"
              title="Xelvic browser sign-in code"
              className="size-[230px] sm:size-[250px]"
            />
          </div>
        )}

        {/* Approved overlay */}
        {phase === "approved" || phase === "collecting" ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-[16px] bg-[color-mix(in_srgb,var(--card)_94%,transparent)] backdrop-blur-[6px]">
            <span className="flex size-16 items-center justify-center rounded-full bg-accent text-on-accent shadow-lg">
              <Check className="size-8" strokeWidth={3} />
            </span>
            <span className="text-[14px] font-extrabold text-ink">
              Approved on phone
            </span>
            <span className="text-[12px] text-dim">
              Connecting browser...
            </span>
          </div>
        ) : null}

        {/* Scanned pill */}
        {phase === "scanned" ? (
          <div className="absolute inset-x-3 bottom-3 flex items-center justify-center gap-2 rounded-full bg-solid/90 px-4 py-2 text-[12px] font-bold text-white shadow-md backdrop-blur">
            <Smartphone className="size-4" /> Phone scanned — check screen
          </div>
        ) : null}
      </div>

      {/* Countdown + status */}
      <div className="mt-4 flex w-full max-w-[280px] items-center gap-3">
        <div
          className="flex size-[44px] shrink-0 items-center justify-center rounded-full p-[3px]"
          style={{
            background: `conic-gradient(var(--accent) ${(codeSeconds / 45) * 360}deg, var(--line) 0deg)`,
          }}
          aria-label={`${codeSeconds} seconds until QR refreshes`}
        >
          <span className="flex size-full items-center justify-center rounded-full bg-card text-[13px] font-extrabold tabular-nums">
            {codeSeconds}
          </span>
        </div>
        <div className="min-w-0 flex-1 text-left">
          <p className="text-[13px] font-extrabold leading-tight tracking-tight">
            {copy?.title ?? "Waiting for phone"}
          </p>
          <p className="mt-0.5 text-[11.5px] leading-4 text-dim">
            {copy?.body}
          </p>
        </div>
        {match ? (
          <div className="shrink-0 rounded-[12px] border border-line bg-[var(--page)] px-2.5 py-1.5 text-center">
            <p className="text-[8px] font-bold uppercase tracking-[0.14em] text-dim">
              Match
            </p>
            <p className="font-mono text-[16px] font-bold leading-none tracking-[0.12em] text-ink">
              {match}
            </p>
          </div>
        ) : null}
      </div>

      {/* Thin session life bar */}
      <div
        className="mt-3.5 h-[3px] w-full max-w-[280px] overflow-hidden rounded-full bg-[var(--line)]"
        aria-hidden
      >
        <div
          className="h-full rounded-full bg-accent transition-[width] duration-1000"
          style={{ width: `${sessionLife * 100}%` }}
        />
      </div>

      <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-[11.5px] leading-4 text-dim">
        <LockKeyhole className="size-3.5 shrink-0" aria-hidden />
        <span>
          Personal messages are{" "}
          <span className="font-bold text-ink">end-to-end encrypted</span>
        </span>
      </p>
    </div>
  );
}

function makePreviewCode() {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from(
    { length: 6 },
    () => alphabet[Math.floor(Math.random() * alphabet.length)],
  ).join("");
}

function CredentialLogin({ onBack }: { onBack: () => void }) {
  const [target, setTarget] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    await new Promise((resolve) => window.setTimeout(resolve, 350));
    if (!target.trim() || !password) {
      setError("Enter your email/phone and password.");
      setBusy(false);
      return;
    }
    setChallenge(makePreviewCode());
    setBusy(false);
  }

  function reset() {
    setChallenge(null);
    setError(null);
  }

  const challengeParts = challenge?.match(/.{1,2}/g) ?? [];

  return (
    <div className="flex w-full flex-1 flex-col">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1 text-[11.5px] font-bold text-dim transition hover:text-ink"
      >
        <ChevronRight className="size-3.5 rotate-180" aria-hidden />
        Back to QR sign-in
      </button>
      <div className="flex flex-1 items-center justify-center py-4">
        <div className="w-full rounded-2xl border border-line bg-[color-mix(in_srgb,var(--page)_55%,var(--card))] p-5 sm:p-6">
          <div className="flex items-center gap-2 text-lg font-extrabold text-ink">
            Login with credentials
            <span className="ml-auto rounded-full bg-[var(--accent-soft)] px-2 py-0.5 text-[11px] font-extrabold uppercase tracking-widest text-accent">
              Preview
            </span>
          </div>
          {challenge ? (
            <div className="mt-3 space-y-3 text-center" aria-live="polite">
              <p className="text-[11.5px] leading-4 text-dim">
                Confirm this code in the Xelvic mobile app:
              </p>
              <div
                className="flex items-center justify-center gap-1.5 sm:gap-2"
                aria-label={`Verification code ${challenge}`}
              >
                {challengeParts.map((part, partIndex) => (
                  <div
                    key={`${part}-${partIndex}`}
                    className="flex items-center gap-1.5 sm:gap-2"
                  >
                    {part.split("").map((character, index) => (
                      <span
                        key={`${character}-${index}`}
                        className="flex size-9 items-center justify-center rounded-[9px] border border-line bg-card font-mono text-[20px] font-extrabold text-ink shadow-xs sm:size-11 sm:text-[23px]"
                      >
                        {character}
                      </span>
                    ))}
                    {partIndex < challengeParts.length - 1 ? (
                      <span
                        className="px-0.5 text-[18px] font-extrabold text-ink sm:px-1 sm:text-[20px]"
                        aria-hidden
                      >
                        -
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>
              <p className="text-[11.5px] leading-4 text-dim">
                Frontend preview only — the mobile approval endpoint is not
                connected yet.
              </p>
              <Button
                type="button"
                variant="secondary"
                full
                onClick={reset}
                className="py-1.5 text-lg font-semibold text-ink rounded-lg"
              >
                Use different credentials
              </Button>
            </div>
          ) : (
            <form onSubmit={submit} className="mt-3 space-y-3">
              <input
                className="field min-h-10 py-2 text-md rounded-lg"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
                placeholder="Email or phone number"
                autoComplete="username"
                required
              />
              <input
                className="field min-h-10 py-2 text-md rounded-lg"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                required
              />
              {error ? (
                <p className="text-[11.5px] leading-4 text-[var(--bad)]">
                  {error}
                </p>
              ) : null}
              <Button
                type="submit"
                full
                loading={busy}
                className="py-1.5 text-lg font-extrabold text-on-accent rounded-lg"
              >
                Verify
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function StepRow({
  n,
  title,
  body,
}: {
  n: number;
  title: string;
  body: ReactNode;
}) {
  return (
    <li className="flex gap-3.5">
      <span className="flex size-7 shrink-0 items-center justify-center rounded-full border border-line bg-card text-[12px] font-extrabold text-dim shadow-xs">
        {n}
      </span>
      <div className="min-w-0 pt-0.5">
        <p className="text-[14px] font-bold leading-5 tracking-tight text-ink">
          {title}
        </p>
        <p className="mt-0.5 text-[12.5px] leading-5 text-dim">{body}</p>
      </div>
    </li>
  );
}

export function SignInPage() {
  const qr = useQrSignIn();
  const claim = useMemo(browserClaim, []);
  const [authMode, setAuthMode] = useState<"qr" | "credentials">("qr");
  const busy =
    qr.phase === "starting" ||
    qr.phase === "collecting" ||
    qr.phase === "approved";

  return (
    <div className="relative flex min-h-dvh flex-col justify-between overflow-y-auto bg-page text-ink">
      {/* Subtle background grid pattern */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        aria-hidden
        style={{
          backgroundImage:
            "radial-gradient(circle at 1px 1px, var(--ink) 1px, transparent 0)",
          backgroundSize: "22px 22px",
        }}
      />

      {/* Top Bar — clean, no accent strip */}
      <header className="relative mx-4 flex h-[52px] shrink-0 items-center justify-between sm:mx-12">
        <div className="flex items-center gap-2.5">
          <Wordmark tone="ink" size={28} />
        </div>
        <a
          href="https://xelvic.com/help"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card/80 px-3 py-1.5 text-[11px] font-bold text-dim backdrop-blur transition hover:border-accent/40 hover:text-ink"
        >
          <CircleHelp className="size-3.5" /> Help
        </a>
      </header>

      {/* Main Container — auto-fitted on desktop viewports */}
      <main className="relative mx-auto flex min-h-0 flex-1 w-full max-w-[1020px] flex-col justify-start px-3 pb-3 pt-1 sm:px-6 sm:pb-4 sm:pt-1">
        <div className="overflow-hidden rounded-[16px] border border-line bg-card shadow-[0_6px_32px_rgba(0,0,0,0.10),0_1px_2px_rgba(0,0,0,0.06)]">
          {/* Card Header */}
          <div className="hidden h-[48px] items-center justify-between border-b border-line bg-[color-mix(in_srgb,var(--page)_65%,var(--card))] px-6 sm:flex">
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.14em] text-dim">
              <span
                className="size-2 rounded-full bg-accent shadow-[0_0_0_4px_var(--accent-soft)]"
                aria-hidden
              />
              Xelvic Web — linked with phone
            </p>
            <span className="flex items-center gap-1.5 text-[11px] text-dim">
              <ShieldCheck className="size-3.5 text-accent" />
              End-to-end encrypted
            </span>
          </div>

          <div className="grid lg:grid-cols-[1.08fr_0.92fr]">
            {/* LEFT — Instructions */}
            <div className="relative flex flex-col justify-between p-6 sm:p-7 lg:border-r lg:border-line lg:p-8">
              <div>
                <h1 className="text-balance text-[26px] font-extrabold leading-tight tracking-[-0.03em] text-ink sm:text-[28px]">
                  Use Xelvic on your computer
                </h1>
                <p className="mt-1.5 text-[13px] leading-6 text-dim">
                  Scan with your phone app to log in instantly. No password
                  required.
                </p>

                <ol className="mt-5 space-y-4">
                  <StepRow
                    n={1}
                    title="Open Xelvic on your phone"
                    body="Open the Xelvic app on your mobile device."
                  />
                  <StepRow
                    n={2}
                    title="Open Scanner"
                    body={
                      <>
                        Go to Convo Tab → Click on new convo{"("}
                        <BiSolidUserPlus
                          aria-hidden="true"
                          className="inline-block align-[-0.15em]"
                        />
                        {")"} → Click on <strong>Scan QR</strong> to open the
                        scanner.
                      </>
                    }
                  />
                  <StepRow
                    n={3}
                    title="Scan this QR code"
                    body="Point your phone camera at this screen and confirm connection."
                  />
                </ol>
              </div>

              {/* Linked device info badge */}
              <div className="mt-6 hidden items-center gap-3.5 rounded-[14px] border border-line bg-[color-mix(in_srgb,var(--page)_45%,var(--card))] p-3.5 sm:flex">
                <div className="relative flex h-[64px] w-[44px] shrink-0 items-center justify-center rounded-[10px] border-[2px] border-ink bg-card shadow-xs">
                  <ScanLine className="size-5 text-accent" />
                  <div className="absolute -right-2 top-1/2 flex size-6 -translate-y-1/2 items-center justify-center rounded-full bg-accent text-on-accent shadow">
                    <MoreVertical className="size-3" />
                  </div>
                </div>
                <div className="min-w-0">
                  <p className="text-[12px] font-extrabold tracking-tight">
                    Phone + Computer Linked
                  </p>
                  <p className="mt-0.5 text-[11px] leading-4 text-dim">
                    QR refreshes every 45s. Compare Match digits to verify
                    session security.
                  </p>
                </div>
              </div>

              {/* Help & Browser claim */}
              <div className="mt-5 border-t border-line pt-4 text-[11.5px] leading-5 text-dim">
                <p className="flex items-center gap-1.5">
                  <Laptop className="size-3.5 shrink-0" aria-hidden />
                  <span>
                    Browser: <strong className="text-ink">{claim}</strong>
                  </span>
                  <span className="mx-1">•</span>
                  <LockKeyhole className="size-3.5 shrink-0" aria-hidden />
                  <span>5m session timeout</span>
                </p>
              </div>
            </div>

            {/* RIGHT — QR Pane */}
            <div className="relative flex flex-col items-center justify-center bg-[color-mix(in_srgb,var(--page)_35%,var(--card))] p-4 sm:p-5">
              {authMode === "qr" ? (
                <>
                  <QrPanel
                    phase={qr.phase}
                    code={qr.code}
                    match={qr.match}
                    codeSeconds={qr.codeSeconds}
                    sessionSeconds={qr.sessionSeconds}
                    error={qr.error}
                    retryable={qr.retryable}
                    restart={qr.restart}
                  />

                  <div className="mt-4 flex w-full max-w-[280px] items-center gap-2.5">
                    <span className="h-px flex-1 bg-line" />
                    <span className="text-[10px] font-bold uppercase tracking-widest text-dim">
                      or
                    </span>
                    <span className="h-px flex-1 bg-line" />
                  </div>

                  <button
                    type="button"
                    onClick={qr.restart}
                    className="mt-3 inline-flex items-center gap-2 rounded-full border border-accent bg-accent px-5 py-2 text-[12.5px] font-extrabold text-on-accent shadow-xs transition hover:brightness-[1.06] active:scale-[0.98]"
                  >
                    <Smartphone className="size-3.5" />
                    Refresh QR Code
                  </button>

                  <button
                    type="button"
                    onClick={() => setAuthMode("credentials")}
                    className="mt-3 inline-flex items-center justify-center rounded-full border border-line bg-card px-5 py-2 text-[12.5px] font-extrabold text-ink shadow-xs transition hover:border-accent/50 hover:bg-[var(--accent-soft)] active:scale-[0.98]"
                  >
                    Login with credentials
                  </button>
                </>
              ) : (
                <CredentialLogin onBack={() => setAuthMode("qr")} />
              )}

              <p className="mt-3 text-center text-[11px] leading-4 text-dim">
                {"Don't have an account? Accounts are created in the "}
                <strong className="text-ink">Xelvic mobile app</strong>.
              </p>
              {busy ? (
                <span className="sr-only" aria-live="polite">
                  Signing in
                </span>
              ) : null}
            </div>
          </div>
        </div>

        {/* Get started */}
        <p className="mt-4 text-center text-[15px] text-dim">
          Don't have a Xelvic account?{" "}
          <a
            href="https://xelvic.com/download"
            target="_blank"
            rel="noopener noreferrer"
            className="font-extrabold text-accent hover:underline"
          >
            Get started
          </a>
        </p>

        {/* Footer note */}
        <p className="mt-1 text-center text-[11px] text-dim">
          Xelvic Web — Phone is primary key · Browser is a linked device
        </p>
      </main>
    </div>
  );
}
