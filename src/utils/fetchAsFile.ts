import { mediaService } from "@/services/media.service";

/**
 * Fetch a picture the server sent as an absolute URL and hand it back as a file,
 * so it can be uploaded as this account's avatar or cover.
 *
 * The theme's face and scene are pictures the server already holds, and the app
 * makes them the account's own by uploading a copy rather than by pointing the
 * account at them — the two are separate files with separate lives, and the row
 * may be repainted under somebody who has already chosen it. A cross-origin
 * picture without CORS headers cannot be read this way, and that is reported as
 * a failure rather than papered over: the theme goes on and the photo does not,
 * which is a thing the person is told.
 */
export async function fetchAsFile(url: string, name: string): Promise<Blob> {
  const blob = await mediaService.blob(url, { authenticated: false });
  return new File([blob], name, { type: blob.type || "image/jpeg" });
}