import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The page's scroll lock, tested where it actually went wrong.
 *
 * The document scrolls in this app and `body { overflow: hidden }` is the whole
 * of "the page behind this overlay stays put", so a value written back in the
 * wrong order is a page that never moves again — the reported symptom, fixed
 * only by a refresh, which is the one thing that throws the document away. The
 * cases below are the two orders that stranded it: two overlays closing out of
 * order, and an effect that re-runs while another overlay is open.
 *
 * The lock's state is module scope, deliberately — one document, one page — so
 * each case loads its own copy of the module rather than inheriting the one
 * before it.
 */

type FakeDocument = { body: { style: { overflow: string } } };

function installDocument(overflow = ""): FakeDocument {
  const fake: FakeDocument = { body: { style: { overflow } } };
  (globalThis as { document?: unknown }).document = fake;
  return fake;
}

/** A fresh module, so `held` starts at zero for the case about to run. */
async function loadLock() {
  vi.resetModules();
  return await import("./scrollLock");
}

let page: FakeDocument;

beforeEach(() => {
  page = installDocument();
});

afterEach(() => {
  delete (globalThis as { document?: unknown }).document;
});

describe("lockScroll", () => {
  it("holds the page still, and hands it back on release", async () => {
    const { lockScroll } = await loadLock();
    const release = lockScroll();
    expect(page.body.style.overflow).toBe("hidden");
    release();
    expect(page.body.style.overflow).toBe("");
  });

  it("stays held until the last overlay lets go, not the first", async () => {
    const { lockScroll } = await loadLock();
    const modal = lockScroll();
    const viewer = lockScroll();

    // The modal closes over a viewer that is still up.
    modal();
    expect(page.body.style.overflow).toBe("hidden");

    viewer();
    expect(page.body.style.overflow).toBe("");
  });

  it("changes nothing when an effect re-runs over a second overlay", async () => {
    const { lockScroll } = await loadLock();
    // The Vibe walk: open, then a sheet opens over it, then the walk's own
    // effect re-runs because its dependencies moved (a swipe, a render).
    let releaseWalk = lockScroll();
    const releaseSheet = lockScroll();

    releaseWalk();
    releaseWalk = lockScroll();

    releaseSheet();
    expect(page.body.style.overflow).toBe("hidden");

    releaseWalk();
    expect(page.body.style.overflow).toBe("");
  });

  it("restores the value the page had, not an empty one", async () => {
    page = installDocument("clip");
    const { lockScroll } = await loadLock();
    const release = lockScroll();
    expect(page.body.style.overflow).toBe("hidden");
    release();
    expect(page.body.style.overflow).toBe("clip");
  });

  it("counts a release once, however many times it is called", async () => {
    const { lockScroll } = await loadLock();
    const first = lockScroll();
    const second = lockScroll();

    first();
    first();
    expect(page.body.style.overflow).toBe("hidden");

    second();
    expect(page.body.style.overflow).toBe("");
  });

  it("is a no-op with no document to lock", async () => {
    delete (globalThis as { document?: unknown }).document;
    const { lockScroll } = await loadLock();
    const release = lockScroll();
    expect(() => release()).not.toThrow();
  });
});
