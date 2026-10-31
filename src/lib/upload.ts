import { api } from "@/lib/api";
import { ApiError } from "@/lib/errors";
import type { Asset } from "@/types/api";

const LIMITS: Record<string, number> = {
  image: 16 * 1024 * 1024,
  voice: 25 * 1024 * 1024,
  audio: 200 * 1024 * 1024,
  video: 600 * 1024 * 1024,
  doc: 25 * 1024 * 1024,
};

export function kindOf(file: File): Asset["kind"] {
  if (file.type.startsWith("image/")) return "image";
  if (file.type.startsWith("video/")) return "video";
  if (file.type.startsWith("audio/")) return "audio";
  return "doc";
}

export function messageKindFor(file: File): string {
  const kind = kindOf(file);
  if (kind === "audio") return "audio";
  return kind;
}

async function imageFacts(file: File): Promise<{
  width?: number;
  height?: number;
  thumb?: File;
}> {
  try {
    const bitmap = await createImageBitmap(file);
    const max = 960;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const width = Math.round(bitmap.width * scale);
    const height = Math.round(bitmap.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return { width: bitmap.width, height: bitmap.height };
    }
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    const originalWidth = bitmap.width;
    const originalHeight = bitmap.height;
    bitmap.close();
    const thumb = blob
      ? new File([blob], file.name.replace(/\.[^.]+$/, "") + "-thumb.jpg", { type: "image/jpeg" })
      : undefined;
    return { width: originalWidth, height: originalHeight, thumb };
  } catch {
    return {};
  }
}

async function mediaFacts(file: File, type: "video" | "audio"): Promise<{ width?: number; height?: number; duration_ms?: number }> {
  return new Promise((resolve) => {
    const element = document.createElement(type);
    const url = URL.createObjectURL(file);
    const done = (facts: { width?: number; height?: number; duration_ms?: number }) => {
      URL.revokeObjectURL(url);
      resolve(facts);
    };
    const timer = window.setTimeout(() => done({}), 4000);
    element.preload = "metadata";
    element.onloadedmetadata = () => {
      window.clearTimeout(timer);
      const media = element as HTMLVideoElement;
      done({
        width: type === "video" ? media.videoWidth || undefined : undefined,
        height: type === "video" ? media.videoHeight || undefined : undefined,
        duration_ms: Number.isFinite(element.duration) ? Math.round(element.duration * 1000) : undefined,
      });
    };
    element.onerror = () => {
      window.clearTimeout(timer);
      done({});
    };
    element.src = url;
  });
}

export interface UploadOptions {
  kind?: Asset["kind"];
  voice?: boolean;
  signal?: AbortSignal;
}

export async function uploadAsset(file: File, options: UploadOptions = {}): Promise<Asset> {
  const kind = options.voice ? "voice" : (options.kind ?? kindOf(file));
  const limit = LIMITS[kind] ?? LIMITS.doc;
  if (file.size > limit) {
    throw new ApiError(`That file is larger than the ${Math.round(limit / 1024 / 1024)} MB limit for ${kind}.`, {
      code: "too_large",
    });
  }

  const form = new FormData();
  form.append("file", file);
  form.append("upload_id", crypto.randomUUID());
  form.append("kind", kind);

  if (kind === "image") {
    const facts = await imageFacts(file);
    if (facts.width) form.append("width", String(facts.width));
    if (facts.height) form.append("height", String(facts.height));
    if (facts.thumb) form.append("thumb", facts.thumb);
  } else if (kind === "video" || kind === "audio" || kind === "voice") {
    const facts = await mediaFacts(file, kind === "video" ? "video" : "audio");
    if (facts.width) form.append("width", String(facts.width));
    if (facts.height) form.append("height", String(facts.height));
    if (facts.duration_ms) form.append("duration_ms", String(facts.duration_ms));
  }

  const response = await api.form<{ asset?: Asset } & Asset>("/chat/assets/", form, {
    signal: options.signal,
  });
  return (response as { asset?: Asset }).asset ?? (response as Asset);
}

export async function uploadFiles(files: File[], options: UploadOptions = {}): Promise<Asset[]> {
  const uploaded: Asset[] = [];
  for (const file of files) uploaded.push(await uploadAsset(file, options));
  return uploaded;
}
