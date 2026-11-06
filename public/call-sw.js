/*
 * The worker that draws a ringing call's two buttons.
 *
 * It exists for exactly one reason: `Notification.actions` — the Accept and
 * Decline buttons on a call's notification — can only be set on a row posted by
 * a service worker. A plain `new Notification()` cannot have them.
 *
 * So this worker has **no `fetch` handler at all**, and that is the point. A
 * worker that answered requests would sit between this app and its own assets,
 * and a cached index.html is a stale app that nobody can fix by deploying. It
 * caches nothing, it serves nothing, it intercepts nothing: it draws a row and
 * tells a page which button was pressed.
 *
 * It is registered the first time a call rings (see `src/features/calls/notice.ts`),
 * not at boot.
 */

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("notificationclick", (event) => {
  const notification = event.notification;
  const data = notification.data || {};
  // An empty action is a press on the row itself rather than on a button.
  const action = event.action || "open";
  notification.close();

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      const client = windows[0];
      if (client) {
        try {
          await client.focus();
        } catch (error) {
          // A window the browser will not focus is still a window that can be
          // told; the press is what matters.
        }
        client.postMessage({ type: "xelvic-call", action: action, callId: data.callId });
        return;
      }
      // Nothing open: the call cannot be answered from here, so the press
      // becomes "show me Xelvic" and the app asks the server on the way up
      // whether anybody is still ringing it.
      if (self.clients.openWindow) {
        await self.clients.openWindow("/app");
      }
    })(),
  );
});
