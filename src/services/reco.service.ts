import api from "@/config/axios";

/**
 * Recommendation signals.
 *
 * One road: what a look at a clip measured, or what a shelf drew, posted as it
 * happened. The server answers the size of the batch and never what it kept, so
 * a caller may let the reply go.
 */
export const recoService = {
  /** One signal, in the shape the caller measured it. */
  signal: async (payload: Record<string, unknown>): Promise<void> => {
    await api.post("/reco/signals/", payload);
  },
};

export default recoService;