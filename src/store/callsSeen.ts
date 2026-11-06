import { STORAGE_KEYS } from "@/constants/storage";

type SeenMap = Record<string, number>;

const KEY = STORAGE_KEYS.callsSeen;

function readMap(): SeenMap {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }
    const next: SeenMap = {};
    for (const [id, value] of Object.entries(parsed)) {
      if (typeof value === "number" && Number.isFinite(value)) next[id] = value;
    }
    return next;
  } catch {
    return {};
  }
}

export function readCallsSeen(userId?: string | null): number {
  if (!userId) return 0;
  return readMap()[userId] ?? 0;
}

export function writeCallsSeen(userId: string, seenAt: number): void {
  if (!userId || !Number.isFinite(seenAt)) return;
  try {
    const map = readMap();
    if ((map[userId] ?? 0) >= seenAt) return;
    map[userId] = seenAt;
    localStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    return;
  }
}
