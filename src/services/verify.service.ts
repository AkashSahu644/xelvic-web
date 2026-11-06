import api from "@/config/axios";
import type { VerifyStatus } from "@/types/api";

/**
 * Verification.
 *
 * The account's standing, the case it sends, and the case it takes back. The
 * case is one `FormData` body — documents with the labels that go beside them —
 * and it is handed to axios as it was built, with no reshape on the way out.
 */
export const verifyService = {
  /** The badge, and the request the server already holds. */
  status: async (): Promise<VerifyStatus> => {
    const response = await api.get<VerifyStatus>("/verify/status/");
    return response.data;
  },

  /** Sends a case. The page only wants to know it landed. */
  submit: async (form: FormData): Promise<void> => {
    await api.post("/verify/requests/", form);
  },

  /** Takes back a request that has not been answered yet. */
  withdraw: async (): Promise<void> => {
    await api.post("/verify/requests/withdraw/");
  },
};

export default verifyService;