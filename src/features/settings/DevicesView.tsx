import { useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Clock,
  Eye,
  EyeOff,
  LockKeyhole,
  MapPin,
  MonitorSmartphone,
  MonitorX,
  Smartphone,
  Tag,
  type LucideIcon,
} from "lucide-react";
import { ConfirmDialog, Modal } from "@/components/overlays/Modal";
import { Spinner } from "@/components/ui/Button";
import { ApiError } from "@/utils/errors";
import { ago } from "@/utils/format";
import { cn } from "@/utils/cn";
import { usePreferences } from "@/hooks/usePreferences";
import { useToast } from "@/hooks/useToast";
import { authService } from "@/services/auth.service";
import type { Device } from "@/types/api";

/**
 * Where this account is signed in — every phone it is live on, and where each of
 * them is.
 *
 * Ported from `app/lib/screens/sessions.dart`. The screen exists for one moment:
 * somebody thinks "am I signed in somewhere I have forgotten about", and wants
 * either to be reassured or to end it. So every row answers four questions in
 * that order — *which* phone, *where* it is, *when* it was last used, and *which
 * of these is the one in my hand* — and the answer to the last one is a badge
 * rather than a guess, because a list of four identical rows that does not say
 * which is yours is a list somebody is afraid to touch.
 *
 * Removing a row is a real sign-out and not a tidying-up: the server deletes the
 * session the phone's token names, and that phone's very next request is a 401.
 * Nothing here needs to be believed about it — the row going *is* the phone
 * going, so the list is re-read from the server after every removal rather than
 * edited here. A screen that struck the row out itself would be a screen that
 * can be wrong about the one thing it was opened to find out.
 *
 * The password is the key, and it is only ever asked for by the server. The
 * first device the account ever signed in on cannot be removed from another
 * phone without the account's password, which is what stops a found phone from
 * taking an account over. The phone holding that session ends it by signing out
 * like any other, and somebody who has lost it and forgotten the password still
 * has the reset by code — so the lock has a key.
 */

/** Which glyph a row wears. */
const PLATFORM_ICON: Record<string, LucideIcon> = {
  ios: Smartphone,
  android: Smartphone,
};

/**
 * The glyph for a row's platform.
 *
 * The phone draws three different pictures here — `phone_iphone`,
 * `phone_android` and `devices_other` — and the web has two, because lucide
 * ships no iOS/Android pair: `Smartphone` is the only phone it has. So iOS and
 * Android look the same on this screen and the distinction is carried entirely
 * by the words beside the glyph, which name the platform outright ("iPhone",
 * "Android phone"). What survives is the split the app actually reasons about:
 * a phone, or *not a phone* — a session that never said what it is on, a script,
 * or a build from before the app sent this. That one keeps its own glyph rather
 * than being drawn as a phone, because guessing would be the list telling
 * somebody which device they are looking at when it does not know.
 */
function platformIcon(platform: string): LucideIcon {
  return PLATFORM_ICON[platform] ?? MonitorSmartphone;
}

/** Which phone it is, in the phone's own words when it gave any. `_title`. */
function titleOf(t: (key: string) => string, row: Device): string {
  const model = (row.model ?? "").trim();
  if (model) return model;
  if (row.platform === "ios") return t("iPhone");
  if (row.platform === "android") return t("Android phone");
  return t("A device");
}

/**
 * The system under it: the platform with its version, and this app's.
 *
 * The app version is the half that answers a question the rest cannot — an old
 * build that has not been updated is a phone that is still signed in and still
 * being pushed to, and it is worth being able to see that from here.
 */
function systemOf(t: (key: string) => string, row: Device): string {
  const os = (row.os_version ?? "").trim();
  const app = (row.app_version ?? "").trim();
  let system = os;
  if (os) {
    if (row.platform === "ios") system = `iOS ${os}`;
    else if (row.platform === "android") system = `Android ${os}`;
  }
  return [system, app ? t(`app ${app}`) : ""].filter(Boolean).join(" · ");
}

/**
 * Where the row is, in one of three answers rather than one.
 *
 * The third is the one that matters. A session on the same Wi-Fi as the machine
 * this server runs on has an address like `192.168.18.44`, and a bare number
 * under a heading that means "where" reads as a location to anybody who does not
 * know what it is — which is the opposite of what it is. So the row says what it
 * really is and lets the address below it be the detail.
 */
function whereOf(t: (key: string) => string, row: Device): string {
  const place = (row.place ?? "").trim();
  if (place) return place;
  if (row.private_address === true) return t("Your own network");
  if (!(row.ip ?? "").trim()) return t("Nowhere the server could name");
  return t("No place on record");
}

/** The address itself, which is the one precise thing held about a session. */
function addressOf(t: (key: string) => string, row: Device): string {
  const ip = (row.ip ?? "").trim();
  if (!ip) return t("No address was recorded");
  if (row.private_address === true) {
    return t(`${ip} · a private address, not a place on a map`);
  }
  return ip;
}

/*
 * Why the sentences below are assembled and *then* handed to `t()`.
 *
 * The app writes these as templates — `s.fill(Str.sessionsSignedOut, [name])` —
 * and every one of them is a single string in the language tables, because word
 * order belongs to the language and not to English. The web's `t()` has no
 * placeholders and falls back to the key, so what it is given has to be the
 * *whole* sentence: `t("Last active")` glued to a date would come back as a
 * half-Hindi line the moment somebody added that word to a table, where a whole
 * sentence that is not in a table yet simply stays English — which is the app's
 * own fallback too. See `Str.sessionsLastActive` and the strings beside it.
 */


export function DevicesView() {
  const { t } = usePreferences();
  const { toast } = useToast();
  const client = useQueryClient();

  const devices = useQuery({
    queryKey: ["devices"],
    queryFn: () => authService.devices(),
  });

  /** A removal is in the air. One at a time: two would race to describe the list. */
  const [busy, setBusy] = useState(false);
  /** The row waiting on the password, for the one row that needs it. */
  const [asking, setAsking] = useState<Device | null>(null);
  const [password, setPassword] = useState("");
  const [show, setShow] = useState(false);
  /** The row waiting on the ordinary yes/no. */
  const [confirming, setConfirming] = useState<Device | null>(null);

  const rows = devices.data ?? [];

  const reload = () => client.invalidateQueries({ queryKey: ["devices"] });

  /** End one session, and read the list again — the server's answer is the truth. */
  const remove = async (row: Device, secret: string) => {
    if (busy) return;
    const label = titleOf(t, row);
    setBusy(true);
    try {
      // A DELETE with a body, which is unusual enough to say out loud: the
      // body is the account password. The phone does exactly this
      // (`Session.it.api.delete(url, {'password': password})`) and the server
      // reads it the same way for both, out of `request.data` — see
      // `DeviceDetailView.delete`. `authService.removeDevice` is the one place
      // that shape lives now.
      await authService.removeDevice(row.id, secret || undefined);
      setAsking(null);
      setConfirming(null);
      setPassword("");
      await reload();
      toast({ title: t(`${label} was signed out`), tone: "success" });
    } catch (error) {
      // The password is the server's to judge and not this screen's, so a wrong
      // one arrives as the server's own sentence and is said as it was written.
      toast({
        title: error instanceof ApiError ? error.message : t("That did not work."),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  /** Sign out every session but this one. */
  const others = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const answer = await authService.removeOtherDevices();
      const ended = Number(answer?.ended ?? 0);
      const kept = Number(answer?.kept ?? 0);
      // A count is a word of its own in some languages, so the sentence is
      // chosen from the number and from whether the first device survived —
      // which is the half somebody would otherwise have to notice for
      // themselves in the list underneath.
      toast({
        title: t(
          ended === 0
            ? "Nothing else was signed in"
            : kept === 0
              ? `Signed out ${ended} ${ended === 1 ? "phone" : "phones"}`
              : `Signed out ${ended} — the first device stayed`,
        ),
        tone: ended === 0 ? "info" : "success",
      });
      await reload();
    } catch (error) {
      toast({
        title: error instanceof ApiError ? error.message : t("That did not work."),
        tone: "error",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="pb-10">
      <p className="px-[18px] pb-1.5 pt-4 text-[13.5px] leading-[1.45] text-dim">
        {t(
          "Every phone this account is signed in on. If one of them is not yours, sign it out — it stops working straight away.",
        )}
      </p>

      {devices.isLoading ? (
        <p className="px-[18px] py-[26px] text-[13.5px] text-dim">{t("Looking...")}</p>
      ) : devices.isError ? (
        // The app's `_Waiting` colours this sentence bad and says nothing else,
        // because the phone has pull-to-refresh to answer it with. There is no
        // such gesture on a page — a line telling somebody to pull down would be
        // advice they cannot take — so the sentence is the app's and the way out
        // is a real button underneath it.
        <div className="px-[18px] py-[26px]">
          <p className="text-[13.5px] text-[var(--bad)]">{t("Could not read your devices.")}</p>
          <button
            type="button"
            className="btn btn-secondary mt-3"
            onClick={() => void devices.refetch()}
          >
            {t("Try again")}
          </button>
        </div>
      ) : rows.length === 0 ? (
        <p className="px-[18px] py-[26px] text-[13.5px] text-dim">
          {t("Nothing is signed in anywhere.")}
        </p>
      ) : (
        <>
          {rows.map((row) => {
            const current = row.current === true;
            const primary = row.primary === true;
            const system = systemOf(t, row);
            return (
              <article
                key={String(row.id)}
                className={cn(
                  "mx-3.5 my-1.5 rounded-[16px] border bg-card px-3.5 pb-3.5 pt-[13px]",
                  current ? "border-accent" : "border-line",
                )}
              >
                <div className="flex items-start">
                  {(() => {
                    const Icon = platformIcon(row.platform);
                    return <Icon className="size-[21px] shrink-0 text-accent" aria-hidden />;
                  })()}
                  <div className="ml-3 min-w-0 flex-1">
                    <h2 className="text-[15px] font-bold leading-5">{titleOf(t, row)}</h2>
                    {system ? (
                      <p className="mt-0.5 text-[12.5px] leading-4 text-dim">{system}</p>
                    ) : null}
                  </div>
                  {/* The phone in your hand has no Remove button: ending it here
                      would be signing out, which is a row of its own on Controls
                      and which the app has a whole flow for. Two ways to do it,
                      one of them silent, is one too many. */}
                  {!current ? (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        setPassword("");
                        setShow(false);
                        if (primary) setAsking(row);
                        else setConfirming(row);
                      }}
                      className="ml-2 shrink-0 px-2 text-[13px] font-medium text-[var(--bad)] disabled:opacity-45"
                    >
                      {t("Remove")}
                    </button>
                  ) : null}
                </div>

                {current || primary ? (
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {current ? <Badge strong>{t("This device")}</Badge> : null}
                    {primary ? <Badge>{t("First device")}</Badge> : null}
                  </div>
                ) : null}

                <div className="mt-2.5">
                  <Fact icon={MapPin} text={whereOf(t, row)} />
                  <Fact
                    icon={Clock}
                    text={t(
                      `Last active ${ago(row.last_active)} · signed in ${ago(row.first_seen)}`,
                    )}
                  />
                  {/* Everything else the server holds about this session, said
                      rather than kept: the address is the only part of a place
                      that was ever precise, and a screen about you that you
                      cannot read in full is a screen you have to take on trust. */}
                  <Fact icon={Tag} text={addressOf(t, row)} quiet />
                </div>
              </article>
            );
          })}

          <div className="mx-3.5 mt-1.5">
            <button
              type="button"
              disabled={busy}
              onClick={() => void others()}
              className="flex w-full items-center rounded-[16px] bg-card px-3.5 py-3.5 text-left transition hover:bg-[color-mix(in_srgb,var(--ink)_3%,transparent)] disabled:opacity-60"
            >
              <MonitorX className="size-[21px] shrink-0 text-[var(--bad)]" aria-hidden />
              <span className="ml-3 min-w-0 flex-1">
                <span className="block text-[14.5px] font-semibold text-[var(--bad)]">
                  {t("Sign out everywhere else")}
                </span>
                <span className="mt-0.5 block text-[12px] leading-[1.35] text-dim">
                  {t("Every phone but this one, in one press.")}
                </span>
              </span>
              {busy ? <Spinner className="ml-2 size-[18px] text-[var(--bad)]" /> : null}
            </button>
          </div>
        </>
      )}

      <WhatIsKept />

      {/* The ordinary yes/no, for every row but the first device. */}
      <ConfirmDialog
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        onConfirm={() => {
          const row = confirming;
          if (row) void remove(row, "");
        }}
        title={t("Sign this phone out?")}
        body={
          confirming
            ? t(
                `${titleOf(t, confirming)} stops working straight away. It will ask for the account password the next time it is opened, and nothing will be pushed to it in the meantime.`,
              )
            : ""
        }
        note={t("Signing back in on it later is the ordinary password.")}
        confirmLabel={t("Sign it out")}
        destructive
        loading={busy}
        icon={<MonitorX className="size-5" />}
      />

      {/* The account password, for the one row that needs it. Asked for here
          rather than after a failed call, so that the sentence explaining *why*
          is the thing the dialog is made of. The server is the only thing that
          judges it; nothing is checked on this side. */}
      <Modal
        open={asking !== null}
        onClose={busy ? () => undefined : () => setAsking(null)}
        title={t("Your password")}
        size="sm"
        hideClose
      >
        <div className="px-5 py-4">
          <p className="text-[13.5px] leading-[1.4] text-dim">
            {asking
              ? t(
                  `${titleOf(t, asking)} is the first phone this account signed in on, so signing it out from here takes your password. That is what stops a phone somebody else is holding from ending it.`,
                )
              : ""}
          </p>
          <div className="relative mt-3.5">
            <LockKeyhole
              className="pointer-events-none absolute left-3 top-1/2 size-[18px] -translate-y-1/2 text-dim"
              aria-hidden
            />
            <input
              className="field w-full pl-10 pr-10"
              type={show ? "text" : "password"}
              autoFocus
              autoComplete="current-password"
              placeholder="••••••••"
              aria-label={t("Your password")}
              value={password}
              disabled={busy}
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && asking) void remove(asking, password);
              }}
            />
            <button
              type="button"
              onClick={() => setShow((value) => !value)}
              aria-label={show ? t("Hide password") : t("Show password")}
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-dim transition hover:text-ink"
            >
              {show ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
            </button>
          </div>
        </div>
        <div className="flex justify-end gap-2 px-5 pb-5 pt-2">
          <button
            type="button"
            className="btn btn-ghost"
            disabled={busy}
            onClick={() => {
              setAsking(null);
              setPassword("");
            }}
          >
            {t("Cancel")}
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={busy || !password}
            onClick={() => {
              if (asking) void remove(asking, password);
            }}
          >
            {busy ? "Working..." : t("Sign it out")}
          </button>
        </div>
      </Modal>
    </div>
  );
}

/** A small pill under the title: this is yours, or this is the first. */
function Badge({ children, strong }: { children: ReactNode; strong?: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-1 text-[11px] font-bold",
        strong ? "bg-accent text-on-accent" : "border border-line bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] text-dim",
      )}
    >
      {children}
    </span>
  );
}

/** One line of the record, with the mark that says what kind of fact it is. */
function Fact({ icon: Icon, text, quiet }: { icon: LucideIcon; text: string; quiet?: boolean }) {
  return (
    <div className="flex items-start pt-[5px]">
      <Icon
        className={cn(
          "mt-px size-3.5 shrink-0",
          quiet
            ? "text-[color-mix(in_srgb,var(--ink)_30%,transparent)]"
            : "text-[color-mix(in_srgb,var(--ink)_45%,transparent)]",
        )}
        aria-hidden
      />
      <p
        className={cn(
          "ml-2 min-w-0 flex-1 leading-[1.35]",
          quiet
            ? "text-[11.5px] text-[color-mix(in_srgb,var(--ink)_55%,transparent)]"
            : "text-[12.5px] text-dim",
        )}
      >
        {text}
      </p>
    </div>
  );
}

/**
 * What the server keeps about a session, said once rather than on every row.
 *
 * The devices screen is the one place a person can see what is held about where
 * they are, and the honest answer has two halves: where a place comes from, and
 * what is *not* kept. Saying both here means nobody has to work out from a row
 * with "Mumbai, IN" on it whether the app asked the phone for a location — it
 * did not, and this is where that is written down.
 */
function WhatIsKept() {
  const { t } = usePreferences();
  return (
    <div className="px-[18px] pt-[26px]">
      <h2 className="text-[11px] font-extrabold uppercase tracking-[0.08em] text-dim">
        {t("What is kept")}
      </h2>
      <p className="mt-2 text-[12.5px] leading-[1.5] text-dim">
        {t(
          "Where a device is comes from the address it signed in from, worked out as a city and a country — never a street, and nothing the app had to ask permission for. The app is never asked where it is and never sends a location of its own, so there is nothing here to switch off.",
        )}
      </p>
      <p className="mt-2.5 text-[12.5px] leading-[1.5] text-dim">
        {t(
          "The first device is the phone the account was created on. Another device needs your password to sign it out; the phone itself does not, and neither does the reset by code.",
        )}
      </p>
    </div>
  );
}
