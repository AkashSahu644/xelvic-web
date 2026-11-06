import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { usePreferences } from "@/hooks/usePreferences";
import { useSocketEvent } from "@/hooks/useSocket";
import { normaliseAlert } from "@/store/alerts";
import { alertPath, alertSummary } from "@/features/alerts/model";
import {
  noticeFrom,
  noticeHref,
  noticeIsTyping,
  noticeRowLine,
  noticeWho,
  type Notice,
} from "./model";
import { NoticeBanner } from "./NoticeBanner";

/** How long one notice stays up before the next is allowed through. */
const HOLD_MS = 4000;

/**
 * How many are kept while somebody is being shown them one at a time.
 *
 * Past this the oldest are dropped: a queue of twenty is not a queue, it is a
 * browser that will still be buzzing in a minute about something read long
 * ago. `Notices.most` on the phone.
 */
const MOST = 5;

/**
 * The system rows this tab has put up, by tag.
 *
 * Kept so one can be taken back down — a message unsent, a conversation wiped,
 * a conversation opened while its row was still in the shade. A row the browser
 * has already dropped is not an error, and closing one twice is harmless.
 */
const rows = new Map<string, Notification>();

function systemReady() {
  return typeof Notification !== "undefined" && Notification.permission === "granted";
}

function closeRow(tag: string) {
  const row = rows.get(tag);
  if (!row) return;
  try {
    row.close();
  } catch {
    // Already gone. Nothing to do.
  }
  rows.delete(tag);
}

/**
 * Put one row on the browser's own notification surface.
 *
 * The web's half of the phone's lock screen, and it is only ever asked for when
 * the tab is not visible: a banner is for somebody looking at the page, and a
 * system row is for somebody who is not. Nothing here decides *whether* a
 * notice is worth announcing — that is `deliver`'s call, the same one the phone
 * makes in `Notices.deliver` — so the two surfaces cannot disagree.
 */
function postRow(tag: string, title: string, body: string, icon: string, go: () => void) {
  if (!systemReady()) return;
  closeRow(tag);
  try {
    const row = new Notification(title, { body, tag, icon });
    row.onclick = () => {
      window.focus();
      go();
      closeRow(tag);
    };
    rows.set(tag, row);
  } catch {
    // A browser that refuses to draw one is not a reason to lose the news.
  }
}

function frameData(frame: { data?: unknown }): Record<string, unknown> {
  return frame.data && typeof frame.data === "object"
    ? (frame.data as Record<string, unknown>)
    : {};
}

function asText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/**
 * Deciding what to do about a notice.
 *
 * Ported from `Notices` in `app/lib/notices.dart`, with the questions the
 * browser can actually answer:
 *
 * * **Is the tab in front of somebody?** If it is, the notice is drawn inside
 *   the page, over whatever is on screen. If it is not, it goes to the browser's
 *   own notification surface — the same split the phone makes between its
 *   banner and its lock screen.
 * * **Is this the conversation they are already reading?** If it is, nothing
 *   happens at all. Interrupting somebody about the thing they are looking at
 *   is the one notification that is always wrong — and because the question is
 *   asked as the notice arrives rather than answered once, closing the convo is
 *   all it takes to start hearing about it again.
 *
 * The server decides neither, and is not asked: it knows a socket is connected;
 * it does not know whether a person is looking.
 *
 * `alert.new` is deliberately *not* drawn as a banner. The phone does not draw
 * one either — an alert updates the list and the count, and the in-app strip is
 * for conversations — so on a hidden tab it becomes a system row and on a
 * visible one it is simply in the list, live. See `Notices.apply`, which has no
 * `alert` branch at all.
 */
export function NoticeProvider({ children }: { children: ReactNode }) {
  const preferences = usePreferences();
  const preferencesRef = useRef(preferences);
  preferencesRef.current = preferences;
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;
  const location = useLocation();

  const [current, setCurrent] = useState<Notice | null>(null);
  const currentRef = useRef<Notice | null>(null);
  const waiting = useRef<Notice[]>([]);
  const timer = useRef<number | null>(null);
  /** The newest ordinal seen in each conversation — the dedupe. */
  const newest = useRef(new Map<string, number>());
  /** The conversation somebody is actually looking at, if any. */
  const watching = useRef<string | null>(null);

  const stopTimer = useCallback(() => {
    if (timer.current != null) window.clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const dismiss = useCallback(() => {
    stopTimer();
    currentRef.current = null;
    setCurrent(null);
    const next = waiting.current.shift() ?? null;
    if (!next) return;
    currentRef.current = next;
    setCurrent(next);
    timer.current = window.setTimeout(() => dismissRef.current(), HOLD_MS);
  }, [stopTimer]);
  const dismissRef = useRef(dismiss);
  dismissRef.current = dismiss;

  const show = useCallback(
    (notice: Notice) => {
      if (currentRef.current == null) {
        currentRef.current = notice;
        setCurrent(notice);
        stopTimer();
        timer.current = window.setTimeout(() => dismissRef.current(), HOLD_MS);
        return;
      }
      // The same conversation twice in a row replaces the queued line rather
      // than queueing behind it: two strips about one conversation is a browser
      // being noisy about one thing.
      const same = waiting.current.reduce(
        (found: number, held, index) => (held.thread === notice.thread ? index : found),
        -1,
      );
      if (same >= 0) {
        waiting.current[same] = notice;
        return;
      }
      waiting.current.push(notice);
      if (waiting.current.length > MOST) waiting.current.shift();
    },
    [stopTimer],
  );

  const deliver = useCallback(
    (notice: Notice) => {
      const prefs = preferencesRef.current;
      if (!prefs.notifications) return;
      // A conversation they have muted. The switch promises "no sound, no
      // push", and the message itself is untouched — it reaches the list on the
      // same frame and sits there unread. What was switched off is being told.
      if (notice.muted) return;
      // Somebody has started typing. Never a strip and never a sound while the
      // page is in front: the conversation already says it over the composer,
      // in the place somebody is actually looking.
      if (noticeIsTyping(notice)) return;
      // The same news twice. Asked per conversation, because getting this wrong
      // is interrupting somebody about a line already in front of them.
      if (notice.ordinal > 0) {
        const seen = newest.current.get(notice.thread) ?? 0;
        if (notice.ordinal <= seen) return;
        newest.current.set(notice.thread, notice.ordinal);
      }
      // The conversation they are reading. Nothing at all — not a strip, not a
      // sound — which is the whole of "the one you are chatting with should not
      // announce itself".
      if (notice.thread === watching.current) return;

      const href = noticeHref(notice);
      const icon = `/logos/${prefs.logo || "pink"}.webp`;
      const go = () => {
        if (href) navigateRef.current(href);
      };
      if (document.visibilityState === "visible") {
        prefs.playMessageSound();
        show(notice);
      } else {
        postRow(`thread-${notice.thread}`, noticeWho(notice), noticeRowLine(notice), icon, go);
      }
    },
    [show],
  );

  /**
   * Everything already handed out about one conversation goes.
   *
   * Asked per conversation rather than per message because that is the key
   * everything here is kept under: a strip, a queued notice and a system row
   * are one per conversation, and each is replaced by the next line in it. So a
   * row standing for "the last thing said in this convo" cannot be trusted once
   * any of that conversation's lines has gone.
   */
  const withdraw = useCallback(
    (thread: string) => {
      if (!thread) return;
      closeRow(`thread-${thread}`);
      waiting.current = waiting.current.filter((held) => held.thread !== thread);
      if (currentRef.current?.thread !== thread) return;
      currentRef.current = null;
      setCurrent(null);
      stopTimer();
      const next = waiting.current.shift();
      if (next) show(next);
    },
    [show, stopTimer],
  );

  const open = useCallback((notice: Notice) => {
    dismissRef.current();
    const href = noticeHref(notice);
    if (href) navigateRef.current(href);
  }, []);

  // Opening a conversation is looking at it: whatever was queued about it is no
  // longer news, the strip about it is announcing something now on screen, and
  // the system row is the one place a notice outlives the reading of it. The
  // same three things `Notices.opened` does, asked of the address bar because
  // that is where the web's "what is on screen" lives.
  useEffect(() => {
    const match = /^\/app\/convo\/([^/]+)/.exec(location.pathname);
    const thread = match ? decodeURIComponent(match[1]) : null;
    watching.current = thread;
    if (!thread) return;
    waiting.current = waiting.current.filter((held) => held.thread !== thread);
    closeRow(`thread-${thread}`);
    if (currentRef.current?.thread === thread) dismissRef.current();
  }, [location.pathname]);

  // Going away hands the strip over. A strip drawn by a tab nobody is looking
  // at was never read, and the browser's own row is the same news in the place
  // it survives — see `Notices.awake`. Coming back drains what was queued
  // behind it: those were never drawn, so nobody was shown them.
  useEffect(() => {
    const onVisibility = () => {
      const prefs = preferencesRef.current;
      if (document.visibilityState === "hidden") {
        const shown = currentRef.current;
        if (!shown || !prefs.notifications) return;
        stopTimer();
        currentRef.current = null;
        setCurrent(null);
        const href = noticeHref(shown);
        postRow(
          `thread-${shown.thread}`,
          noticeWho(shown),
          noticeRowLine(shown),
          `/logos/${prefs.logo || "pink"}.webp`,
          () => {
            if (href) navigateRef.current(href);
          },
        );
        return;
      }
      if (!prefs.notifications) return;
      const next = waiting.current.shift();
      if (next && currentRef.current == null) show(next);
    };
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, [show, stopTimer]);

  useSocketEvent(
    ["thread.update", "message.gone", "thread.clear", "alert.new"],
    (frame) => {
      const data = frameData(frame);

      if (frame.event === "alert.new") {
        const prefs = preferencesRef.current;
        if (!prefs.notifications) return;
        const alert = normaliseAlert(data.alert);
        if (!alert) return;
        // The phone does not banner an alert, and neither does the page: the
        // list and the bell count update on the frame itself. Only a tab that
        // is not being looked at needs a row of its own.
        if (document.visibilityState === "visible") return;
        const href = alertPath(alert);
        postRow(`alert-${alert.id}`, "Xelvic", alertSummary(alert), `/logos/${prefs.logo || "pink"}.webp`, () => {
          if (href) navigateRef.current(href);
        });
        return;
      }

      if (frame.event === "message.gone" || frame.event === "thread.clear") {
        const message =
          data.message && typeof data.message === "object"
            ? (data.message as Record<string, unknown>)
            : {};
        withdraw(asText(data.thread_id) || asText(data.thread) || asText(message.thread));
        return;
      }

      const notice = noticeFrom(data.notice);
      if (notice) {
        deliver(notice);
        return;
      }
      // The same frame without a notice is a seat changing, and the one change
      // worth acting on is the unread count reaching nought: the conversation
      // was read, here or on another of the account's own sessions. A row on
      // the system surface for a conversation that has been read is not stale
      // tidying, it is false.
      if (data.unread === 0) withdraw(asText(data.thread_id));
    },
  );

  return (
    <>
      {children}
      <NoticeBanner notice={current} onOpen={open} onDismiss={dismiss} />
    </>
  );
}