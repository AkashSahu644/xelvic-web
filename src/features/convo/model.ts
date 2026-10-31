import type { ThreadCard, UserCard } from "@/types/api";

export function threadTitle(thread: ThreadCard) {
  if (thread.title) return thread.title;
  const person = thread.other ?? thread.member;
  return person?.name || person?.username || "Conversation";
}

export function threadFace(thread: ThreadCard): UserCard | undefined {
  return thread.other ?? thread.member ?? thread.members?.[0]?.user;
}

export function stamp(iso: string | null | undefined) {
  if (!iso) return "";
  const at = new Date(iso).getTime();
  if (Number.isNaN(at)) return "";
  const gap = Date.now() - at;
  const minutes = Math.floor(gap / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

const PREVIEW_LABELS: Record<string, string> = {
  image: "Photo",
  video: "Video",
  voice: "Voice note",
  audio: "Voice note",
  doc: "File",
  poll: "Poll",
  sticker: "Sticker",
  drop: "A drop",
  vibe: "A vibe",
};

export function threadLine(thread: ThreadCard, unread: number) {
  const preview = thread.preview;
  if (!preview || !Object.keys(preview).length) {
    return unread > 0 ? (unread === 1 ? "1 new message" : `${unread} new messages`) : "Say something";
  }
  if (preview.held) return "Waiting for them";
  if (thread.status === "Opened") return "Opened";
  if (thread.status && preview.mine) return thread.status;
  if (preview.text?.trim()) {
    return `${preview.mine ? "You: " : ""}${preview.text.trim()}`;
  }
  if (preview.kind && PREVIEW_LABELS[preview.kind]) {
    return `${preview.mine ? "You: " : ""}${PREVIEW_LABELS[preview.kind]}`;
  }
  if (thread.status) return thread.status;
  return unread > 0 ? (unread === 1 ? "1 new message" : `${unread} new messages`) : "Say something";
}
