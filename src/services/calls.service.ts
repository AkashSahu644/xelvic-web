import api from "@/config/axios";

/** One other person on a call row — `CallPerson` on the server. */
export interface CallPerson {
  user?: string;
  name?: string;
  username?: string;
  avatar?: string | null;
}

/** One row of the call history, as `apps/calls` serialises it. */
export interface CallLog {
  id: string;
  kind?: string;
  at?: string | null;
  outgoing?: boolean;
  outcome?: string;
  seconds?: number;
  mine?: string;
  thread?: string | null;
  others?: CallPerson[];
}

/** One seat on a call, as `services.party` builds it. */
export interface CallSeat {
  user: string;
  state?: string;
  /** The name to draw. Always sent: `seat.user.name or seat.user.username`. */
  name: string;
  username: string;
  avatar: string | null;
  online?: boolean;
  reachable?: boolean;
  character?: string;
  theme?: string;
  dp?: string;
}

/** The call, in the shape every call frame carries — `services.party`. */
export interface CallParty {
  call: string;
  kind?: string;
  state?: string;
  caller?: string;
  answered?: string | null;
  ring_seconds?: number;
  members?: CallSeat[];
  /** Present on `call.incoming`: who is ringing this phone. */
  from?: CallPerson & { character?: string; dp?: string; theme?: string };
  /** Present on `call.incoming`: whether this ring was a fresh call or an add. */
  added?: boolean;
}

/**
 * Call history.
 *
 * The one road the calls screen reads: every call this account was on, newest
 * first. It arrives already paged, so the `results` list is the server's own
 * and nothing is flattened here.
 */
export const callsService = {
  history: async (): Promise<{ results: CallLog[] }> => {
    const response = await api.get<{ results: CallLog[] }>("/calls/history/");
    return response.data;
  },

  /**
   * Where the phones look for each other.
   *
   * Asked before every call, and safe to repeat: it says where the relay is,
   * not who may use it. The answer is handed to `RTCPeerConnection` as it
   * arrives — the same `{ iceServers: [...] }` shape the browser wants.
   */
  ice: async (): Promise<RTCIceServer[]> => {
    const response = await api.get<{ iceServers?: RTCIceServer[] }>("/calls/ice/");
    const servers = response.data?.iceServers;
    return Array.isArray(servers) ? servers : [];
  },

  /**
   * One call, for the people in it.
   *
   * A page that reconnects mid-call has missed the frames that said who is
   * here; this is how it finds out rather than guessing. Anyone who is not a
   * seat gets the same 404 as somebody asking about a call that does not
   * exist.
   */
  detail: async (callId: string): Promise<{ call: CallParty; me: string }> => {
    const response = await api.get<{ call: CallParty; me: string }>(
      `/calls/${encodeURIComponent(callId)}/`,
    );
    return response.data;
  },
};

export default callsService;