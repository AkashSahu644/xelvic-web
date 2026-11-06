import api from "@/config/axios";
import { UPLOAD_TIMEOUT_MS } from "@/config/env";
import type { Asset } from "@/types/api";

export interface UploadCallOptions {
  signal?: AbortSignal;
  /** Called with 0–100 while the file body is moving to the server. */
  onProgress?: (percent: number) => void;
}

/**
 * Files on their way to the server.
 *
 * This is the one road that needs a progress bar, and axios reports the body
 * going up — so the hand-rolled XHR this used to take is gone. The response is
 * either bare or wrapped in `{"asset": ...}` depending on the road, and both
 * shapes are handed back the same way they always were.
 */
export const uploadService = {
  asset: async (form: FormData, options: UploadCallOptions = {}): Promise<Asset> => {
    const response = await api.post<{ asset?: Asset } & Asset>("/chat/assets/", form, {
      signal: options.signal,
      // The default 120s is a conversation's patience; a 600 MB clip is not.
      timeout: UPLOAD_TIMEOUT_MS,
      onUploadProgress: options.onProgress
        ? (event) => {
            if (!event.total) return;
            options.onProgress?.(Math.min(99, Math.round((event.loaded / event.total) * 100)));
          }
        : undefined,
    });
    options.onProgress?.(100);
    const body = response.data;
    return body.asset ?? body;
  },
};
export default uploadService;
