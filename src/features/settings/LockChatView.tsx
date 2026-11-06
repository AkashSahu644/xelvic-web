import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LockKeyhole, RotateCcwKey } from "lucide-react";
import { ConfirmDialog, Modal } from "@/components/overlays/Modal";
import { Spinner } from "@/components/ui/Button";
import { chatService } from "@/services/chat.service";
import { ApiError } from "@/utils/errors";
import { usePreferences } from "@/hooks/usePreferences";
import { useToast } from "@/hooks/useToast";
import { DotLine } from "./parts";

/**
 * Lock chat — the settings page for the vault, and the one way to reset it.
 *
 * Ported from `app/lib/screens/lock_chat.dart`. The vault itself is reached by
 * holding the 'Convo' title or, once hidden, by typing the code in search. This
 * page is the other half: what a reset does, and the button that does it. It
 * lives under Privacy because that is where a reader looks when the code is the
 * thing they have lost.
 *
 * The app's flow, all four steps of it, is what is here: the rules block, the
 * red row, a confirmation that names what is lost *and* what is not, then the
 * account password — never the vault code, which is the thing that was
 * forgotten. The password is spent on `POST /chat/vault/reset/` and the answer is
 * the vault's new state, so nothing is re-fetched to find out whether it worked.
 */

const RULES = [
  "If a lock is set, every chat inside the vault is deleted when you reset.",
  "If no lock is set, resetting still clears the lock, and the chats inside are deleted too.",
  "After a reset, everyone can reach you again — your contacts can start a convo.",
  "You are asked for your account password first. The reset only happens if it is correct.",
];

export function LockChatView({ onDone }: { onDone: () => void }) {
  const { t } = usePreferences();
  const { toast } = useToast();
  const client = useQueryClient();
  const [confirming, setConfirming] = useState(false);
  const [asking, setAsking] = useState(false);
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  /** The reset, once the warning has been answered and the password typed. */
  const run = async () => {
    if (!password || busy) return;
    setBusy(true);
    try {
      await chatService.vaultReset(password);
      setPassword("");
      setAsking(false);
      await client.invalidateQueries({ queryKey: ["vault"] });
      toast({ title: t("The lock was reset."), tone: "success" });
      // The app pops this page on success, because there is nothing left on it
      // to do — the lock it was about has just been taken away.
      onDone();
    } catch (error) {
      toast({
        title: error instanceof ApiError ? error.message : "That did not work.",
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <div className="bg-card px-[18px] py-[18px]">
        {RULES.map((rule) => (
          <DotLine key={rule}>{t(rule)}</DotLine>
        ))}
      </div>

      <div className="mt-[18px] bg-card">
        <button
          type="button"
          disabled={busy}
          onClick={() => setConfirming(true)}
          className="flex w-full items-center px-4 py-4 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_3%,transparent)] disabled:opacity-60"
        >
          <RotateCcwKey className="size-[21px] shrink-0 text-[var(--bad)]" aria-hidden />
          <span className="ml-3.5 min-w-0 flex-1 text-[14.5px] font-bold text-[var(--bad)]">
            {t("Reset password now")}
          </span>
          {busy ? <Spinner className="size-[18px] text-[var(--bad)]" /> : null}
        </button>
      </div>

      {/* The app's `confirm()`: what happens, then the sentence people skip.
          `_Line`-for-`_Line` this is the app's own copy — "Every chat inside the
          vault will be deleted. This cannot be undone." with "Your contacts can
          start a convo with you again." underneath, which is the half that says
          the loss is not total. */}
      <ConfirmDialog
        open={confirming}
        onClose={() => setConfirming(false)}
        onConfirm={() => {
          setConfirming(false);
          setAsking(true);
        }}
        title={t("Reset the lock?")}
        body={t("Every chat inside the vault will be deleted. This cannot be undone.")}
        note={t("Your contacts can start a convo with you again.")}
        confirmLabel={t("Reset")}
        destructive
        icon={<RotateCcwKey className="size-5" />}
      />

      {/* The account password, typed once and never shown. A reset is paid for
          with the login, not the code — the code is the thing that was
          forgotten. */}
      <Modal
        open={asking}
        onClose={busy ? () => undefined : () => setAsking(false)}
        title={t("Your password")}
        size="sm"
        hideClose
      >
        <div className="px-5 py-4">
          <div className="relative">
            <LockKeyhole
              className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-dim"
              aria-hidden
            />
            <input
              className="field w-full pl-10"
              type="password"
              autoFocus
              autoComplete="current-password"
              placeholder={t("Account password")}
              aria-label={t("Account password")}
              value={password}
              disabled={busy}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void run();
              }}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5 pt-2">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => {
              setAsking(false);
              setPassword("");
            }}
          >
            {t("Cancel")}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={busy || !password}
            onClick={() => void run()}
          >
            {busy ? "Working..." : t("Reset")}
          </button>
        </div>
      </Modal>
    </div>
  );
}
