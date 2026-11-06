import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BellRing,
  Camera,
  CheckCircle2,
  CircleHelp,
  Contact,
  Images,
  MapPin,
  Mic,
  MoreHorizontal,
  Bluetooth as BluetoothIcon,
  XCircle,
} from "lucide-react";
import { Modal } from "@/components/overlays/Modal";
import { useToast } from "@/hooks/useToast";
import { usePreferences } from "@/hooks/usePreferences";
import { SettingsRow, SettingsRows } from "./parts";
import {
  PERMISSION_LABEL,
  PERMISSION_PURPOSE,
  askPermission,
  permissionKinds,
  readPermission,
  type PermissionKind,
  type PermissionState,
} from "./permissions";

/**
 * The permissions page: every capability this site asks the browser for, and
 * where each of them stands.
 *
 * Ported from `app/lib/screens/permissions_screen.dart`. The app's page is a
 * reader and a list of rows and nothing else — no introduction, no summary, no
 * "check again" button, because the person has already done the work in the
 * browser's own settings and a second tap to tell the page about it is a tap for
 * the page's benefit rather than theirs. So there is no paragraph above the
 * rows here either: the app's own `SettingsPermissionsNote` is the line *under
 * the Permissions row on the controls page*, not a line on this page.
 *
 * Two porting notes, both of them the app's own rules applied to a browser:
 *
 *   - **A granted row is not a button.** `onTap: state == null || state.allowed
 *     ? null : ...` — a row that is already allowed has nothing to ask and
 *     nothing to send anybody to Settings for.
 *   - **The answer is read again when the tab comes back.** The app hangs this
 *     on `didChangeAppLifecycleState`'s resumed, which is the one moment an
 *     answer can change without this page doing anything: the person is over in
 *     the browser's settings, changing it.
 */

const ICONS: Record<PermissionKind, React.ReactNode> = {
  notifications: <BellRing className="size-5" />,
  camera: <Camera className="size-5" />,
  microphone: <Mic className="size-5" />,
  photos: <Images className="size-5" />,
  contacts: <Contact className="size-5" />,
  location: <MapPin className="size-5" />,
  bluetooth: <BluetoothIcon className="size-5" />,
};

/**
 * What each capability is set to, in the app's words.
 *
 * `null` is "still being read" and says so with the app's own `'...'` rather
 * than with a state it has not been given. `unknown` is the browser declining to
 * say, which is a different thing from not asked — the app draws those apart in
 * the same way for Bluetooth.
 */
function word(state: PermissionState | null, t: (key: string) => string): string {
  if (state === null) return "...";
  switch (state) {
    case "granted":
      return t("Allowed");
    case "limited":
      return t("Limited");
    case "denied":
      return t("Not allowed");
    case "blocked":
      return t("Blocked");
    case "notAsked":
      return t("Not asked");
    case "unknown":
      return t("Unknown");
  }
}

/** `_permissionMark`: a tick for yes, a warning for no, a question otherwise. */
function mark(state: PermissionState | null) {
  if (state === null) return <MoreHorizontal className="size-5 shrink-0 text-dim" aria-hidden />;
  if (state === "granted" || state === "limited") {
    return <CheckCircle2 className="size-5 shrink-0 text-[var(--good)]" aria-hidden />;
  }
  if (state === "denied" || state === "blocked") {
    return <XCircle className="size-5 shrink-0 text-[var(--bad)]" aria-hidden />;
  }
  return <CircleHelp className="size-5 shrink-0 text-dim" aria-hidden />;
}

export function PermissionsView() {
  const { t } = usePreferences();
  const { toast } = useToast();
  const kinds = useMemo(permissionKinds, []);
  const [states, setStates] = useState<Record<string, PermissionState | null>>(() =>
    Object.fromEntries(kinds.map((kind) => [kind, null])),
  );
  const [busy, setBusy] = useState<PermissionKind | null>(null);
  /** The capability whose switch the browser has closed, waiting on the explainer. */
  const [explaining, setExplaining] = useState<PermissionKind | null>(null);
  const alive = useRef(true);

  const refresh = useCallback(async () => {
    const answers = await Promise.all(kinds.map(async (kind) => [kind, await readPermission(kind)] as const));
    if (!alive.current) return;
    setStates(Object.fromEntries(answers));
  }, [kinds]);

  useEffect(() => {
    alive.current = true;
    void refresh();
    /**
     * Two events rather than one, because they answer different questions:
     * `visibilitychange` fires when the tab is hidden or shown (the browser's
     * settings page took the person away), and `focus` fires when the window
     * comes forward without the tab ever having been hidden — which is what a
     * browser's own site-settings bubble does.
     */
    const onShow = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("focus", onShow);
    return () => {
      alive.current = false;
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("focus", onShow);
    };
  }, [refresh]);

  /**
   * Ask, or explain why there is nothing left to ask.
   *
   * The app's `_tap`. A blocked capability does not get a second prompt — it
   * gets the explanation of where the switch actually lives — and a yes or a no
   * is said out loud in the app's own sentence, because the row behind the
   * dialog is not where somebody is looking.
   */
  const tap = async (kind: PermissionKind) => {
    if (busy) return;
    const label = t(PERMISSION_LABEL[kind]);
    if (states[kind] === "blocked") {
      setExplaining(kind);
      return;
    }
    setBusy(kind);
    try {
      const answer = await askPermission(kind);
      if ("error" in answer) {
        toast({ title: `${label} did not change`, description: answer.error, tone: "error" });
        return;
      }
      if (!alive.current) return;
      setStates((current) => ({ ...current, [kind]: answer.state }));
      if (answer.state === "granted") {
        toast({ title: `${label} is allowed.`, tone: "success" });
      } else if (answer.state === "blocked") {
        setExplaining(kind);
      } else if (answer.state === "denied") {
        toast({ title: `${label} is still not allowed.`, tone: "error" });
      }
    } finally {
      if (alive.current) setBusy(null);
    }
  };

  return (
    <div>
      <SettingsRows>
        {kinds.map((kind) => {
          const state = states[kind] ?? null;
          return (
            <SettingsRow
              key={kind}
              icon={ICONS[kind]}
              title={t(PERMISSION_LABEL[kind])}
              note={t(PERMISSION_PURPOSE[kind])}
              value={word(state, t)}
              trailing={mark(state)}
              // A row already allowed has nothing to ask. A row still being read
              // has no answer to act on, and one being asked right now has
              // already been tapped.
              onClick={
                state === null || state === "granted" || state === "limited" || busy === kind
                  ? undefined
                  : () => void tap(kind)
              }
            />
          );
        })}
      </SettingsRows>

      {/* The app's `_settings` dialog, for the one state that has no question
          left to ask. Its "Open settings" button is the one thing that could not
          come across: a phone app may open the phone's own Settings, and a page
          may not open the browser's — the site-settings bubble is behind a click
          the browser owns. So the dialog says where the switch is instead of
          offering a door onto nowhere. */}
      <Modal
        open={explaining !== null}
        onClose={() => setExplaining(null)}
        size="sm"
        hideClose
      >
        <div className="px-5 pb-2 pt-6">
          <div className="mx-auto flex size-[60px] items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--bad)_12%,transparent)]">
            <XCircle className="size-7 text-[var(--bad)]" aria-hidden />
          </div>
          <h2 className="mt-4 text-center text-[19px] font-extrabold tracking-[-0.3px]">
            {explaining ? `${t(PERMISSION_LABEL[explaining])} is turned off` : ""}
          </h2>
          <p className="mt-2 text-center text-[14px] leading-[1.45] text-dim">
            {explaining
              ? `This browser will not put its question up again for this site. Turn ${t(
                  PERMISSION_LABEL[explaining],
                ).toLowerCase()} on for Xelvic in the browser's settings for this page — the icon beside the address.`
              : null}
          </p>
        </div>
        <div className="px-5 pb-5 pt-2">
          <button
            type="button"
            className="btn btn-secondary w-full"
            onClick={() => setExplaining(null)}
          >
            {t("Got it")}
          </button>
        </div>
      </Modal>
    </div>
  );
}
