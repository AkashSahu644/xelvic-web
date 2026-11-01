/**
 * What this browser says about each capability, and how to ask again.
 *
 * Ported from `app/lib/permissions.dart`. The app keeps one reader — the
 * `Permissions` singleton — so the Contacts card and the Permissions page cannot
 * disagree about the same switch, and so an answer is read once per visit rather
 * than once per row. This is the same thing in the web's shape: plain functions
 * over the browser's own APIs, plus `usePermissionStates` for the page that
 * draws all of them.
 *
 * The two facts that make this file worth having:
 *
 *   1. **[PermissionState.blocked] is not [PermissionState.denied].** A denied
 *      permission still has a dialog behind it; a blocked one does not. They are
 *      the same word in a browser — once a site is denied, the prompt does not
 *      come back — which is why a web denial is read as `blocked` and the page
 *      explains where the switch actually lives instead of pretending it can
 *      still ask.
 *   2. **A kind the platform has no question for is not offered.** The app's
 *      `PermissionKind.onThisPhone` is what does this on a phone (`kIsWeb` is
 *      false for every kind, and Bluetooth is Android-12-and-up only). The same
 *      rule applies here: a browser is never asked to read a photo library, an
 *      address book, or a paired headset — `<input type=file>` and Web Bluetooth
 *      ask nobody anything — so those rows are not drawn rather than being drawn
 *      to say "Unknown" forever.
 */

export type PermissionState =
  | "granted"
  | "limited"
  | "denied"
  | "blocked"
  | "notAsked"
  | "unknown";

export type PermissionKind =
  | "notifications"
  | "camera"
  | "microphone"
  | "photos"
  | "contacts"
  | "location"
  | "bluetooth";

/** The app's fixed order, `PermissionKind.values` as written in `permissions.dart`. */
export const PERMISSION_ORDER: PermissionKind[] = [
  "notifications",
  "camera",
  "microphone",
  "photos",
  "contacts",
  "location",
  "bluetooth",
];

/**
 * The keys each row draws its words from.
 *
 * The app keeps these on the enum because `permissions.dart` was written before
 * the translation sweep reached it; the sweep reached this page, so the key is
 * chosen here and the word comes from the tables.
 */
export const PERMISSION_LABEL: Record<PermissionKind, string> = {
  notifications: "Notifications",
  camera: "Camera",
  microphone: "Microphone",
  photos: "Photos and media",
  contacts: "Contacts",
  location: "Location",
  bluetooth: "Bluetooth",
};

export const PERMISSION_PURPOSE: Record<PermissionKind, string> = {
  notifications: "Calls and messages, wherever you are in the app.",
  camera: "Photos, videos, and the picture on a video call.",
  microphone: "Voice notes and the audio on a call.",
  photos: "Choosing a photo or a video to share.",
  contacts: "Finding the people you already know who are here.",
  location:
    "Where a drop was taken, and — when you allow it — the place each post was made from, kept privately for safety checks.",
  bluetooth: "Offering a headset during a call.",
};

/** Whether this browser has the question at all — the app's `onThisPhone`. */
export function onThisBrowser(kind: PermissionKind): boolean {
  if (typeof navigator === "undefined") return false;
  switch (kind) {
    case "notifications":
      return typeof Notification !== "undefined";
    case "camera":
    case "microphone":
      return Boolean(navigator.mediaDevices?.getUserMedia);
    case "location":
      return typeof navigator.geolocation !== "undefined";
    // A file input asks nobody anything, a browser has no address book, and Web
    // Bluetooth's picker is a choice made per device rather than a stored
    // permission. Three rows that could only ever say nothing.
    case "photos":
    case "contacts":
    case "bluetooth":
      return false;
  }
}

/** The rows this browser offers, in the app's order. */
export function permissionKinds(): PermissionKind[] {
  return PERMISSION_ORDER.filter(onThisBrowser);
}

/**
 * One `navigator.permissions.query`, or null where the browser will not answer.
 *
 * Safari and older Firefox throw for names they do not know, and a browser with
 * no Permissions API at all returns null rather than an answer — which is a
 * different thing from "not asked", and is why the caller falls back rather than
 * reading a failure as a state.
 */
async function query(name: PermissionName): Promise<PermissionState | null> {
  try {
    const answer = await navigator.permissions.query({ name });
    if (answer.state === "granted") return "granted";
    if (answer.state === "denied") return "blocked";
    return "notAsked";
  } catch {
    return null;
  }
}

/** Read one capability. Never asks, and never throws. */
export async function readPermission(kind: PermissionKind): Promise<PermissionState> {
  if (!onThisBrowser(kind)) return "unknown";

  if (kind === "notifications") {
    const answer = Notification.permission;
    if (answer === "granted") return "granted";
    if (answer === "denied") return "blocked";
    return "notAsked";
  }

  const name: PermissionName | null =
    kind === "camera" ? "camera" : kind === "microphone" ? "microphone" : kind === "location" ? "geolocation" : null;
  if (!name) return "unknown";

  const answer = await query(name);
  // The query is what the browser will say without being asked. Where it will
  // not answer, "not asked" is the true state: nothing has been decided yet.
  return answer ?? "notAsked";
}

/** What an ask came back with, or why it could not ask. */
export type AskResult = { state: PermissionState } | { error: string };

/**
 * Ask, and keep whatever answer came back.
 *
 * A blocked permission is returned rather than asked again: the prompt that
 * answers it no longer exists, and putting one up would be this page pretending
 * it could. The screen turns that into the explanation.
 */
export async function askPermission(kind: PermissionKind): Promise<AskResult> {
  if (!onThisBrowser(kind)) return { state: "unknown" };

  if (kind === "notifications") {
    if (Notification.permission === "denied") return { state: "blocked" };
    if (Notification.permission === "granted") return { state: "granted" };
    try {
      const answer = await Notification.requestPermission();
      if (answer === "granted") return { state: "granted" };
      if (answer === "denied") return { state: "blocked" };
      return { state: "notAsked" };
    } catch {
      return { error: "This browser would not put its question up." };
    }
  }

  if (kind === "camera" || kind === "microphone") {
    const stream = await requestMedia(kind);
    return stream;
  }

  if (kind === "location") {
    return await requestLocation();
  }

  return { state: "unknown" };
}

/** Open the camera or the microphone and let go of it at once. */
async function requestMedia(kind: "camera" | "microphone"): Promise<AskResult> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ [kind]: true });
    stream.getTracks().forEach((track) => track.stop());
    return { state: "granted" };
  } catch (error) {
    const name = error instanceof Error ? error.name : "";
    if (name === "NotAllowedError" || name === "SecurityError") return { state: "blocked" };
    if (name === "NotFoundError" || name === "OverconstrainedError") {
      return { error: kind === "camera" ? "No camera was found on this device." : "No microphone was found on this device." };
    }
    return { error: error instanceof Error ? error.message : "That did not work." };
  }
}

/** Ask for one position and throw the reading away — only the answer matters. */
function requestLocation(): Promise<AskResult> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve({ state: "unknown" });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      () => resolve({ state: "granted" }),
      (error) => {
        // GeolocationPositionError.PERMISSION_DENIED is 1. Its two siblings —
        // POSITION_UNAVAILABLE and TIMEOUT — are a device that cannot answer,
        // which is not a refusal, so they are reported as themselves.
        if (error.code === 1) resolve({ state: "blocked" });
        else resolve({ error: error.message || "That location could not be read." });
      },
      { timeout: 12000 },
    );
  });
}
