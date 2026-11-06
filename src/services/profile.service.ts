import api from "@/config/axios";
import type { Profile } from "@/types/api";

/**
 * Somebody's page, by handle.
 *
 * The account's own half of a profile lives in `auth.service` (it is `/auth/me/`
 * that changes it); this is the read side for a handle, and the one write the
 * page needs that is not about the account itself.
 */
export const profileService = {
  /**
   * A person's page. A deleted account answers 410 with its own name for the
   * refusal, which is why the caller is told not to ask twice.
   */
  byUsername: async (username: string): Promise<Profile> => {
    const response = await api.get<Profile>(`/auth/users/${encodeURIComponent(username)}/`);
    return response.data;
  },
};
export default profileService;
