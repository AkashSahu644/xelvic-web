import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { QRCodeSVG } from "qrcode.react";
import { RefreshCw, Copy, Check, AlertCircle, Clock } from "lucide-react";
import { relativeTime } from "@/utils/format";
import { useToast } from "@/hooks/useToast";
import { authService } from "@/services/auth.service";
import { Button } from "@/components/ui/Button";

interface QRStart {
  session: string;
  secret: string;
  code: string;
  code_expires_in: number;
  match: string;
  expires_in: number;
  poll_after: number;
}

export function OwnQrPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  const { data: qr, isLoading, isError, error, refetch } = useQuery<QRStart>({
    queryKey: ["own-qr"],
    queryFn: () => authService.qrStart(),
    staleTime: 30000,
  });

  const regenerate = useMutation({
    mutationFn: () => authService.qrStart(),
    onSuccess: (data) => {
      queryClient.setQueryData(["own-qr"], data);
      toast({ title: "New QR code generated", tone: "success" });
    },
    onError: (error) => {
      toast({ title: "Could not regenerate", description: error instanceof Error ? error.message : "Try again.", tone: "error" });
    },
    onSettled: () => setRegenerating(false),
  });

  async function handleRegenerate() {
    setRegenerating(true);
    await regenerate.mutateAsync();
  }

  async function handleCopy() {
    if (!qr) return;
    await navigator.clipboard.writeText(qr.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Code copied", tone: "success" });
  }

  const timeLeft = qr ? qr.code_expires_in : 0;
  const matchTimeLeft = qr ? qr.expires_in : 0;

  return (
    <div className="mx-auto w-full max-w-[420px] pb-[calc(100px+env(safe-area-inset-bottom,0px))] md:pb-16">
      <header className="px-4 pb-2 pt-4 md:pt-6">
        <h1 className="text-[20px] font-extrabold tracking-tight">My QR code</h1>
        <p className="mt-0.5 text-[10px] text-dim">Let someone scan this to add you or sign in to Xelvic.</p>
      </header>

      <main className="px-4 pt-3 space-y-4">
        {isLoading ? (
          <div className="flex flex-col items-center gap-3 py-12">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="text-[11px] text-dim">Generating your QR code...</p>
          </div>
        ) : isError ? (
          <div className="rounded-[18px] border border-[var(--bad)]/30 bg-[color-mix(in_srgb,var(--bad)_6%,var(--card))] p-4 text-center">
            <AlertCircle className="mx-auto size-6 text-[var(--bad)]" />
            <p className="mt-2 text-[11px] font-bold text-[var(--bad)]">Could not load QR code</p>
            <p className="mt-1 text-[10px] text-dim">{error instanceof Error ? error.message : "Unknown error"}</p>
            <Button onClick={() => refetch()} className="mt-3" size="sm">
              <RefreshCw className="size-3.5 mr-1.5" /> Try again
            </Button>
          </div>
        ) : qr ? (
          <>
            <section className="rounded-[18px] border border-line bg-card p-4 text-center">
              <div className="flex flex-col items-center gap-3">
                <QRCodeSVG value={qr.match} size={200} level="M" includeMargin={true} />
                <p className="text-[10px] text-dim">Scan with the Xelvic app</p>
              </div>

              <div className="mt-4 rounded-[12px] bg-[color-mix(in_srgb,var(--ink)_4%,var(--card))] p-3">
                <p className="text-[9px] font-bold uppercase tracking-wider text-dim">Session code</p>
                <div className="mt-1.5 flex items-center gap-2">
                  <code className="flex-1 text-center text-[14px] font-mono font-bold tracking-wider select-all break-all">{qr.code}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCopy}
                    aria-label={copied ? "Copied" : "Copy code"}
                    icon={copied ? <Check className="size-3.5 text-[var(--good)]" /> : <Copy className="size-3.5" />}
                  />
                </div>
                <p className="mt-2 text-[9px] text-dim">Expires in {relativeTime(new Date(Date.now() + timeLeft * 1000).toISOString())}</p>
              </div>
            </section>

            <section className="rounded-[18px] border border-line bg-card p-4 space-y-3">
              <h2 className="text-[12px] font-extrabold">How it works</h2>
              <div className="space-y-2 text-[10px] leading-5 text-dim">
                <p>• Someone opens the Xelvic app and taps <strong>Scan QR</strong>.</p>
                <p>• They point their camera at the code above.</p>
                <p>• If they are signed in, they can send you a request or message.</p>
                <p>• If they are not signed in, they can sign in using this code.</p>
              </div>
              <div className="mt-2 flex items-center gap-2 text-[9px] text-dim">
                <Clock className="size-3 shrink-0" />
                <span>This session is valid for {relativeTime(new Date(Date.now() + matchTimeLeft * 1000).toISOString())}. After that, generate a new one.</span>
              </div>
            </section>

            <div className="flex gap-2">
              <Button onClick={handleRegenerate} loading={regenerating} disabled={regenerating} className="flex-1">
                <RefreshCw className="size-3.5 mr-1.5" /> New QR code
              </Button>
              <Button variant="ghost" size="sm" onClick={handleCopy} icon={<Copy className="size-3.5 mr-1.5" />}>
                Copy code
              </Button>
            </div>
          </>
        ) : null}
      </main>
    </div>
  );
}