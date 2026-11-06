import { useEffect, useMemo, type ReactNode } from "react";
import { CallContext } from "@/context/call";
import { CallEngine, type CallNotices } from "@/features/calls/engine";
import { CallOverlay } from "@/features/calls/CallOverlay";
import { hideCallNotice, onCallNoticeAction, showCallNotice } from "@/features/calls/notice";
import { Ringer } from "@/features/calls/ring";
import { useAuth } from "@/hooks/useAuth";
import { useSocket } from "@/hooks/useSocket";

/** The call screen's row on the browser's notification surface. */
const notices: CallNotices = {
  show: (input) => {
    void showCallNotice({ ...input, icon: "/favicon.png" });
  },
  hide: hideCallNotice,
};

/**
 * The tab's one call engine, and the screen it draws.
 *
 * It sits inside the socket provider because a call has no road of its own:
 * ringing, answering, leaving and every description and candidate travel on
 * the app's one authenticated connection, and the media is peer to peer and
 * never touches the server. It sits above the router for the same reason a
 * ring is not a page — the call is the thing somebody is doing, whichever
 * screen they were on when it arrived.
 */
export function CallProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, user } = useAuth();
  const { status, send, subscribe } = useSocket();

  // One engine for the life of the tab. It is built without an account and
  // told who is signed in a moment later — an engine that was rebuilt on every
  // account read would be a call dropped by a profile refresh. The ringer is
  // made here rather than inside the engine so that it can be warmed before a
  // call exists to ring.
  const { engine, ringer } = useMemo(() => {
    const tone = new Ringer();
    return {
      ringer: tone,
      engine: new CallEngine({ selfId: "", send, notices, ringer: tone }),
    };
  }, [send]);

  useEffect(() => {
    engine.setSelfId(user?.id ?? "");
  }, [engine, user?.id]);

  // Every frame goes to the engine, which knows which of them are about a call
  // and ignores the rest. Subscribing to every frame rather than to a list is
  // deliberate: the list would have to be kept in step with the server, and a
  // frame nobody listens for is a call that silently stops moving.
  useEffect(() => subscribe((frame) => engine.apply(frame)), [subscribe, engine]);

  // A socket that comes up may have missed the ring that was sent while it was
  // down, and may owe a "leave" that could not be said. Both are settled here.
  useEffect(() => {
    if (status !== "live") return;
    engine.onSocketLive();
    void engine.resync();
  }, [status, engine]);

  // The ringtone is fetched before it is wanted, once there is a socket a ring
  // could arrive on. A ring has no second to spare, and an asset that begins
  // downloading on the first ring arrives after the caller has already hung up
  // — see `features/calls/ring.ts`. It is the app's own recording, served from
  // this build, and the browser keeps it.
  useEffect(() => {
    if (status !== "live" || !user) return;
    ringer.warm();
  }, [status, user, ringer]);

  // A press on the call's notification row arrives here, not on the row: the
  // worker that draws the two buttons has no call to act on and hands the
  // press to the page. Accept really answers and decline really declines —
  // the row and the button on screen do the same thing, and the engine ignores
  // either when the call it was for is no longer ringing.
  useEffect(
    () =>
      onCallNoticeAction((action) => {
        if (action === "accept") void engine.pickUp().catch(() => undefined);
        if (action === "decline") void engine.turnDown();
      }),
    [engine],
  );

  // The phone asks again whenever it comes to the front, for the same reason:
  // a ring is the one frame that cannot wait to be collected.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      engine.askPending();
      void engine.resync();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [engine]);

  // Signing out is the end of any call this tab could still be holding.
  useEffect(() => {
    if (authStatus === "authenticated") return;
    engine.forget();
  }, [authStatus, engine]);

  useEffect(() => () => engine.forget(), [engine]);

  return (
    <CallContext.Provider value={engine}>
      {children}
      {user ? <CallOverlay /> : null}
    </CallContext.Provider>
  );
}

export default CallProvider;