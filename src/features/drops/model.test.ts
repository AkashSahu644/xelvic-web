// What a row *is*, where that question has two readers.
//
// `dropIsClip` is the app's own test — `(drop.kind == 'video' || drop.isVibe) &&
// asset.contentUrl.isNotEmpty` in `screens/drops.dart` — and it has two readers
// that must not disagree: the card plays the clip, and a press on that clip opens
// the walk. A card that played a clip nobody could open is half a feature, and a
// card that opened onto a picture with no clip in it is a press that goes
// nowhere. Both were reachable while the two halves were written out separately:
// the owner's report of 2026-11-06 is that the second half was missing —
// *"app me drops ke for you post me video post par click karne par ek dusare page
// me wo video open hota hai waise isme nahi ho raha hai"*.

import { describe, expect, it } from "vitest";
import { dropIsClip } from "./model";
import type { Asset, Drop } from "@/types/api";

/** One row as the server sends it, with only what a reader looks at. */
function row(kind: string, input: { url?: string | null; gallery?: number } = {}): Drop {
  const asset = {
    content_url: input.url === undefined ? "https://cdn/x.mp4" : input.url,
  } as Asset;
  const gallery =
    input.gallery && input.gallery > 1
      ? Array.from({ length: input.gallery }, () => asset)
      : [];
  return { id: `${kind}-1`, kind, asset, gallery } as unknown as Drop;
}

describe("the clip a card draws", () => {
  it("is a video, and a Vibe, and nothing that is not one", () => {
    expect(dropIsClip(row("video"))).toBe(true);
    expect(dropIsClip(row("vibe"))).toBe(true);
    // A picture with one upload has no clip in it, and the app does nothing on a
    // tap there — so a card that opened one would be a press into nowhere.
    expect(dropIsClip(row("image"))).toBe(false);
    expect(dropIsClip(row("text"))).toBe(false);
    expect(dropIsClip(row("poll"))).toBe(false);
  });

  it("is not a sound's own asset, which is the audio", () => {
    // An `audio` drop's `asset.content_url` is an mp3. Drawing it in the frame
    // and opening it in the walk is what "has a content_url" alone would say,
    // and it is why this reads `kind` rather than sniffing the shape.
    expect(dropIsClip(row("audio"))).toBe(false);
  });

  it("is the first upload only when the post is a single one", () => {
    // A post with several uploads pages through them, and the run is read before
    // any of them is played. A gallery that opened the walk on its first picture
    // would be a card with two answers to one press.
    expect(dropIsClip(row("video", { gallery: 3 }))).toBe(false);
    expect(dropIsClip(row("image", { gallery: 3 }))).toBe(false);
  });

  it("is nothing when the server sent no url", () => {
    // The bytes are a second answer from a second host, and a card that had not
    // been given the url yet has no clip to play and none to open.
    expect(dropIsClip(row("video", { url: null }))).toBe(false);
    expect(dropIsClip(row("video", { url: "" }))).toBe(false);
    expect(dropIsClip(row("vibe", { url: null }))).toBe(false);
    // No asset at all is the same absence, not a crash on the way to it.
    expect(dropIsClip({ id: "x", kind: "video", asset: null } as unknown as Drop)).toBe(false);
  });
});
