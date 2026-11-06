/**
 * Every road to the server, in one place.
 *
 * One service per domain, one method per road, and every method answers with
 * the server's own body — `response.data` and nothing reshaped. No component
 * calls `fetch` or `axios` directly; if the app talks to the server, it is
 * through one of these.
 *
 * The client they all share is `src/config/axios.ts`: it carries the bearer
 * token, renews it once on a 401, and turns every failure into the `ApiError`
 * the screens already know how to read.
 */

export { alertsService } from "./alerts.service";
export { audioService } from "./audio.service";
export { authService } from "./auth.service";
export { callsService } from "./calls.service";
export { chatService } from "./chat.service";
export { circlesService } from "./circles.service";
export { collabsService } from "./collabs.service";
export { dealsService } from "./deals.service";
export { dropsService } from "./drops.service";
export { marketplaceService } from "./marketplace.service";
export { mediaService } from "./media.service";
export { momentsService } from "./moments.service";
export { profileService } from "./profile.service";
export { recoService } from "./reco.service";
export { savedService } from "./saved.service";
export { socialService } from "./social.service";
export { spacesService } from "./spaces.service";
export { sparksService } from "./sparks.service";
export { stickersService } from "./stickers.service";
export { uploadService } from "./upload.service";
export { verifyService } from "./verify.service";
