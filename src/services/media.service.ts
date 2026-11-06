import axios from "axios";
import api from "@/config/axios";
import { mediaUrl } from "@/config/urls";

/**
 * The bytes behind a media address, through the account's own credentials.
 *
 * One road for every read of a private file: the token when there is one, the
 * cookie always, and a single renewal on a 401 — the same three steps the
 * pictures and clips in this app have always taken, now performed by the axios
 * client's interceptors rather than by hand.
 *
 * It returns a Blob rather than an element because a *download* needs the
 * bytes: handing the browser a bare address to save would ask for a private
 * file with no Authorization header at all, and would put the server's error
 * page on disk under the picture's own name. See `DropMenu`'s "Save to
 * gallery".
 */
export const mediaService = {
  /**
   * The bytes at an address.
   *
   * `authenticated: false` is for a picture the whole world may read — a theme
   * the shop is showing, for instance. Those go out through a bare client with
   * no cookie and no token, because a third-party address has no business
   * learning this account's bearer token, and no 401 renewal is wanted on a
   * file that was never private in the first place. Everything the app itself
   * serves keeps the default: token when there is one, cookie always.
   */
  blob: async (url: string, options: { authenticated?: boolean } = {}): Promise<Blob> => {
    const absolute = mediaUrl(url);
    if (!absolute) throw new Error("No media URL");
    if (/^data:/i.test(absolute)) return blobFromDataUri(absolute);
    if (/^blob:/i.test(absolute)) return blobFromObjectUrl(absolute);
    if (options.authenticated === false) {
      const publicResponse = await axios.get<Blob>(absolute, {
        responseType: "blob",
        withCredentials: false,
      });
      return publicResponse.data;
    }
    const response = await api.get<Blob>(absolute, { responseType: "blob" });
    return response.data;
  },
};

/**
 * A picture the app made itself (a cropped avatar, a recorded clip) arrives as
 * a `data:` address. Those bytes never leave the tab, so there is no request to
 * make — only the base64 to unwrap.
 */
function blobFromDataUri(uri: string): Blob {
  const comma = uri.indexOf(",");
  if (comma < 0) throw new Error("Malformed data URL");
  const header = uri.slice(0, comma);
  const payload = uri.slice(comma + 1);
  const type = /data:([^;,]+)/i.exec(header)?.[1] ?? "application/octet-stream";
  if (!/;base64/i.test(header)) return new Blob([decodeURIComponent(payload)], { type });
  const binary = atob(payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return new Blob([bytes], { type });
}

/**
 * An object URL the tab owns. `fetch` can read those back, but this keeps every
 * read of a blob address on one path — and XHR is the only other way the
 * platform gives us to ask for one.
 */
function blobFromObjectUrl(uri: string): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("GET", uri);
    xhr.responseType = "blob";
    xhr.onload = () => {
      if (xhr.status === 200 || xhr.status === 0) resolve(xhr.response as Blob);
      else reject(new Error(`Media request failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error("Media request failed"));
    xhr.send();
  });
}
export default mediaService;
