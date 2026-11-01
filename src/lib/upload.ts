import { api, apiUrl, refreshAccessToken } from "@/lib/api";
import { ApiError, errorFromResponse } from "@/lib/errors";
import { session } from "@/lib/session";
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
  /** Called with 0–100 while the file body is moving to the server. */
  onProgress?: (percent: number) => void;
}

/**
 * `fetch` cannot report request-body progress, so a file upload that wants a
 * real bar has to go through XHR. Auth, error shape and the one-shot 401
 * refresh are the same as the rest of the API client.
 */
function uploadWithProgress<T>(
  form: FormData,
  onProgress: (percent: number) => void,
  signal?: AbortSignal,
  attempt = 0,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", apiUrl("/chat/assets/"));
    xhr.withCredentials = true;
    const token = session.access();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);
    xhr.upload.onprogress = (event) => {
      if (!event.lengthComputable || !event.total) return;
      onProgress(Math.min(99, Math.round((event.loaded / event.total) * 100)));
    };
    xhr.onerror = () =>
      reject(new ApiError("The upload could not reach the server.", {
        status: 0,
        code: "network",
      }));
    xhr.onabort = () => reject(new DOMException("Upload aborted", "AbortError"));
    xhr.onload = () => {
      let parsed: unknown;
      try {
        parsed = xhr.responseText ? JSON.parse(xhr.responseText) : undefined;
      } catch {
        parsed = xhr.responseText;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(100);
        resolve(parsed as T);
        return;
      }
      const error = errorFromResponse(
        xhr.status,
        parsed,
        xhr.getResponseHeader("Retry-After"),
      );
      if (xhr.status === 401 && attempt === 0) {
        void refreshAccessToken().then((ok) => {
          if (!ok) {
            reject(error);
            return;
          }
          uploadWithProgress<T>(form, onProgress, signal, 1).then(resolve, reject);
        });
        return;
      }
      reject(error);
    };
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(form);
  });
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

  const response = options.onProgress
    ? await uploadWithProgress<{ asset?: Asset } & Asset>(form, options.onProgress, options.signal)
    : await api.form<{ asset?: Asset } & Asset>("/chat/assets/", form, {
        signal: options.signal,
      });
  return (response as { asset?: Asset }).asset ?? (response as Asset);
}

export async function uploadFiles(files: File[], options: UploadOptions = {}): Promise<Asset[]> {
  const uploaded: Asset[] = [];
  for (const file of files) uploaded.push(await uploadAsset(file, options));
  return uploaded;
}
