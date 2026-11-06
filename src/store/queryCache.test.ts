import { afterEach, describe, expect, it, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";

/**
 * The persisted copy, tested where it can actually be wrong.
 *
 * Everything here is about the *restore* road: a copy that is the wrong
 * account's, expired, malformed or for a key the module refuses to keep must
 * not reach the query client, and the copy the app itself writes must reach it
 * with its data and its timestamp intact. The write road is a `sessionStorage`
 * call with a debounce around it; the restore road is the one that decides what
 * a reload draws.
 */

class MemoryStorage {
  private map = new Map<string, string>();

  get length() {
    return this.map.size;
  }

  key(index: number) {
    return [...this.map.keys()][index] ?? null;
  }

  getItem(key: string) {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.map.set(key, String(value));
  }

  removeItem(key: string) {
    this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }
}

const ACCOUNT_ID = 7;
const CACHE_KEY = `xelvic.query-cache.${ACCOUNT_ID}`;

function install(signedIn = true) {
  const storage = new MemoryStorage();
  vi.stubGlobal("sessionStorage", storage);
  if (signedIn) {
    storage.setItem("xelvic.access", "token");
    storage.setItem("xelvic.me", JSON.stringify({ id: ACCOUNT_ID, username: "me", name: "Me" }));
  }
  return storage;
}

/** A fresh module graph, after the storage it reads at import time exists. */
async function load() {
  vi.resetModules();
  return import("@/store/queryCache");
}

function copy(queries: { key: unknown[]; data: unknown; updatedAt: number }[], savedAt = Date.now()) {
  return JSON.stringify({ version: 2, savedAt, queries });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("restoreQueryCache", () => {
  it("puts the saved answers back, with their original timestamp", async () => {
    const storage = install();
    const { restoreQueryCache } = await load();
    const client = new QueryClient();

    const data = { pages: [{ results: [{ id: "d1" }], next: null }], pageParams: [null] };
    const updatedAt = Date.now() - 4_000;
    storage.setItem(CACHE_KEY, copy([{ key: ["drops", "feed"], data, updatedAt }]));

    restoreQueryCache(client);

    expect(client.getQueryData(["drops", "feed"])).toEqual(data);
    expect(client.getQueryState(["drops", "feed"])?.dataUpdatedAt).toBe(updatedAt);
  });

  it("restores a per-entity page as well as a tab", async () => {
    const storage = install();
    const { restoreQueryCache } = await load();
    const client = new QueryClient();

    storage.setItem(
      CACHE_KEY,
      copy([{ key: ["profile", "someone"], data: { user: { username: "someone" } }, updatedAt: Date.now() }]),
    );

    restoreQueryCache(client);

    expect(client.getQueryData(["profile", "someone"])).toEqual({ user: { username: "someone" } });
  });

  it("drops a copy older than its lifetime", async () => {
    const storage = install();
    const { restoreQueryCache } = await load();
    const client = new QueryClient();

    storage.setItem(
      CACHE_KEY,
      copy([{ key: ["drops", "feed"], data: { pages: [] }, updatedAt: Date.now() }], Date.now() - 60 * 60_000),
    );

    restoreQueryCache(client);

    expect(client.getQueryData(["drops", "feed"])).toBeUndefined();
    expect(storage.getItem(CACHE_KEY)).toBeNull();
  });

  it("does not restore a search answer", async () => {
    const storage = install();
    const { restoreQueryCache } = await load();
    const client = new QueryClient();

    storage.setItem(
      CACHE_KEY,
      copy([{ key: ["search-people", "sun"], data: { results: [] }, updatedAt: Date.now() }]),
    );

    restoreQueryCache(client);

    expect(client.getQueryData(["search-people", "sun"])).toBeUndefined();
  });

  it("refuses a tab with no token, and forgets the copy", async () => {
    const signedOut = install(false);
    signedOut.setItem(CACHE_KEY, copy([{ key: ["drops", "feed"], data: { pages: [] }, updatedAt: Date.now() }]));
    const { restoreQueryCache } = await load();
    const client = new QueryClient();

    restoreQueryCache(client);

    expect(client.getQueryData(["drops", "feed"])).toBeUndefined();
    expect(signedOut.getItem(CACHE_KEY)).toBeNull();
  });

  it("survives a malformed copy instead of throwing", async () => {
    const storage = install();
    const { restoreQueryCache } = await load();
    const client = new QueryClient();

    storage.setItem(CACHE_KEY, "not json at all");

    expect(() => restoreQueryCache(client)).not.toThrow();
    expect(storage.getItem(CACHE_KEY)).toBeNull();
  });
});