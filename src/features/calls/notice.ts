/**
 * A call on the browser's own notification surface, with its two buttons.
 *
 * The phone has two ways of being rung and only one of them is on the phone's
 * glass: with the app shut, the operating system's own call screen rings and
 * *answers* — CallKit on iOS, a full-screen intent on Android. A browser has no
 * such thing, and this file is the closest an honest web client can get:
 *
 *   * **A row that stays up.** A message notification is news and goes away by
 *     itself; a ring is a question, so the row is posted with
 *     `requireInteraction`, which is the browser's word for "until somebody
 *     deals with it".
 *   * **Two buttons on it.** `Notification.actions` exist only on a row posted
 *     by a service worker, which is why `public/call-sw.js` exists. It has no
 *     fetch handler and caches nothing — it is there to draw two buttons and to
 *     tell this page which one was pressed, and a worker that intercepted
 *     requests would be a stale app waiting to happen.
 *   * **Answering from the row really answers.** The press travels back here as
 *     a message and the engine picks the call up or turns it down, exactly as if
 *     the button on screen had been pressed. Nothing is reported as answered
 *     that was not.
 *
 * What this cannot do is ring a browser that is not running. A ring arrives on
 * the app's one authenticated socket, so with the site closed there is no
 * socket, and a browser has no push without a server that speaks Web Push —
 * which this backend does not (its pushes are FCM, for the phones). That gap is
 * recorded rather than papered over.
 */

import type { CallKind, CallPhase } from "./model";
import { personName } from "./model";
import type { CallSeat } from "@/services/calls.service";

/** The one tag a call's row is kept under, so it can be taken back down. */
export const CALL_NOTICE_TAG = "xelvic-call";

/** Where the worker that draws the buttons lives. */
export const CALL_WORKER_URL = "/call-sw.js";

export function callNoticesSupported(): boolean {
  return typeof window !== "undefined" && typeof Notification !== "undefined";
}

/** Whether a row can be posted right now. Never asks; asking is a gesture. */
export function callNoticesAllowed(): boolean {
  return callNoticesSupported() && Notification.permission === "granted";
}

/**
 * When a call belongs on the notification surface.
 *
 * Only a ring: a call this tab placed is already on this tab's own screen, and
 * a call that is up is being talked on. A row for either would be a browser
 * shouting about something the person is doing.
 */
export function postsCallNotice(phase: CallPhase): boolean {
  return phase === "ringing";
}

/** What the row says. The caller's name, and the kind of call it is. */
export function callNoticeWords(input: {
  seat: CallSeat | null;
  kind: CallKind;
}): { title: string; body: string } {
  const what = input.kind === "video" ? "Video call" : "Call";
  return {
    title: input.seat ? personName(input.seat) : "Xelvic",
    body: `Incoming ${what.toLowerCase()}`,
  };
}

/** One press on the row, read off the worker's message. */
export type CallNoticeAction = "accept" | "decline" | "open";

/**
 * What a message from the worker means.
 *
 * Anything unrecognised — another feature's message, a hand-rolled one, a
 * browser's own — is null, so a stray message cannot answer a call.
 */
export function callActionFrom(data: unknown): CallNoticeAction | null {
  if (!data || typeof data !== "object") return null;
  const message = data as Record<string, unknown>;
  if (message.type !== "xelvic-call") return null;
  const action = message.action;
  if (action === "accept" || action === "decline" || action === "open") {
    return action;
  }
  return null;
}

type Registration = ServiceWorkerRegistration;

let registration: Registration | null = null;
let registering: Promise<Registration | null> | null = null;

/**
 * Register the worker that draws the buttons.
 *
 * Done at the first ring rather than at boot: a worker registered for a feature
 * nobody uses is a worker every visitor pays for. Registration is not a
 * promise that a row will have buttons — a browser may refuse the worker, and
 * [showCallNotice] then falls back to a plain row with no buttons.
 */
export function registerCallWorker(): Promise<Registration | null> {
  if (registration) return Promise.resolve(registration);
  if (registering) return registering;
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) {
    return Promise.resolve(null);
  }
  registering = navigator.serviceWorker
    .register(CALL_WORKER_URL, { scope: "/" })
    .then((answer) => {
      registration = answer;
      return answer;
    })
    .catch((error: unknown) => {
      console.debug(`call notice worker: ${String(error)}`);
      return null;
    })
    .finally(() => {
      registering = null;
    });
  return registering;
}

/** Take the row down. Safe when there is none, and safe twice. */
export function hideCallNotice(): void {
  if (!registration) return;
  void registration
    .getNotifications({ tag: CALL_NOTICE_TAG })
    .then((rows) => {
      for (const row of rows) {
        try {
          row.close();
        } catch {
          // Already gone.
        }
      }
    })
    .catch(() => undefined);
}

/**
 * Put the call on the notification surface.
 *
 * Silent on purpose: the ringtone is this app's own — see `ring.ts` — and a row
 * that also beeped would be two sounds for one call, which is what the phone
 * avoids by ringing one way at a time.
 */
export async function showCallNotice(input: {
  title: string;
  body: string;
  callId: string;
  kind: CallKind;
  icon?: string;
}): Promise<void> {
  if (!callNoticesAllowed()) return;
  const worker = await registerCallWorker();
  const data = { type: "xelvic-call", callId: input.callId, kind: input.kind };
  if (worker) {
    try {
      // `renotify` and `actions` are in the specification and in every browser
      // that draws buttons on a row, but not in this TypeScript's own DOM types
      // — hence the wider shape rather than missing options.
      const options: NotificationOptions & {
        renotify?: boolean;
        actions?: { action: string; title: string }[];
      } = {
        body: input.body,
        tag: CALL_NOTICE_TAG,
        // A ring is a question: this is the browser's "do not fade away".
        requireInteraction: true,
        renotify: true,
        silent: true,
        data,
        icon: input.icon,
        badge: input.icon,
        actions: [
          { action: "decline", title: "Decline" },
          { action: "accept", title: "Accept" },
        ],
      };
      await worker.showNotification(input.title, options);
      return;
    } catch (error) {
      console.debug(`call notice: ${String(error)}`);
    }
  }
  // No worker: a row with no buttons, and a click that brings the tab forward
  // so the call can be answered where it is drawn.
  try {
    const row = new Notification(input.title, {
      body: `${input.body} · open Xelvic to answer`,
      tag: CALL_NOTICE_TAG,
      data,
      icon: input.icon,
    });
    row.onclick = () => {
      window.focus();
      for (const listener of listeners) listener("open");
      row.close();
    };
  } catch (error) {
    console.debug(`call notice: ${String(error)}`);
  }
}

const listeners = new Set<(action: CallNoticeAction) => void>();
let hearing = false;

/**
 * Listen for a press on the row.
 *
 * One listener for the whole tab, attached the first time somebody asks: the
 * worker posts to the page it is running in, and the page hands the press to
 * whoever is holding the call.
 */
export function onCallNoticeAction(
  listener: (action: CallNoticeAction) => void,
): () => void {
  listeners.add(listener);
  if (!hearing && typeof navigator !== "undefined" && navigator.serviceWorker) {
    hearing = true;
    navigator.serviceWorker.addEventListener("message", (event) => {
      const action = callActionFrom(event.data);
      if (!action) return;
      for (const one of listeners) one(action);
    });
  }
  return () => {
    listeners.delete(listener);
  };
}

/**
 * Ask for permission to post rows, and say what the answer was.
 *
 * Called from a press and never on its own: a browser is entitled to refuse a
 * question nobody asked for, and a permission prompt over a ringing call screen
 * is the worst possible moment for one. `"blocked"` is the browser's word for
 * a site that has said no once — the prompt will not come back, so the caller
 * says where the switch lives instead of asking again.
 */
export async function askCallNotices(): Promise<
  "granted" | "blocked" | "notAsked" | "unsupported"
> {
  if (!callNoticesSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "blocked";
  try {
    const answer = await Notification.requestPermission();
    if (answer === "granted") return "granted";
    return answer === "denied" ? "blocked" : "notAsked";
  } catch {
    return "notAsked";
  }
}
