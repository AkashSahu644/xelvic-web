import { ApiError } from "@/utils/errors";
import { uploadService } from "@/services/upload.service";
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

async function imageFacts(file: File, skipThumb = false): Promise<{
  width?: number;
  height?: number;
  thumb?: File;
}> {
  try {
    const bitmap = await createImageBitmap(file);
    if (skipThumb) {
      const facts = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return facts;
    }
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
  /** Camera captures already have a correctly sized preview; avoid a second JPEG encode. */
  skipThumb?: boolean;
  /** The camera already produced the final dimensions; skip client-side media decoding. */
  skipMetadata?: boolean;
  /**
   * A length the caller already knows, in milliseconds.
   *
   * Only a recording has one, and a recording's is the better number: it is the
   * clock the note was stopped on rather than a container's own idea of how long
   * it is. Asked of Chrome 156 with a two-second recording, an `<audio>` element
   * answers 2.56 s for the MP4/AAC this app records in, and `Infinity` for the
   * WebM/Opus a browser without MP4 falls back to — that container writes its
   * length at the end, where an element reading only the header never looks. A
   * note sent with no length is a note whose bubble cannot say how long it is,
   * which is what the WebM case used to produce.
   */
  durationMs?: number;
  /**
   * The loudness the recording measured while it ran: integers from 0 to 100,
   * oldest first — the same shape the phone's own recorder produces
   * (`recording_controller.dart`) and its own bubble draws.
   */
  waveform?: number[];
  /** Called with 0–100 while the file body is moving to the server. */
  onProgress?: (percent: number) => void;
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
    const facts = options.skipMetadata
      ? {}
      : await imageFacts(file, options.skipThumb);
    if (facts.width) form.append("width", String(facts.width));
    if (facts.height) form.append("height", String(facts.height));
    if (facts.thumb) form.append("thumb", facts.thumb);
  } else if (!options.skipMetadata && (kind === "video" || kind === "audio" || kind === "voice")) {
    // A voice note that arrived with its own readings needs nothing decoded: it
    // was measured as it was recorded, which is the only moment the length is
    // known at all.
    const known = kind === "voice" && options.durationMs !== undefined;
    if (!known) {
      const facts = await mediaFacts(file, kind === "video" ? "video" : "audio");
      if (facts.width) form.append("width", String(facts.width));
      if (facts.height) form.append("height", String(facts.height));
      if (facts.duration_ms) form.append("duration_ms", String(facts.duration_ms));
    } else {
      form.append("duration_ms", String(Math.round(options.durationMs as number)));
    }
    if (options.waveform?.length) form.append("waveform", JSON.stringify(options.waveform));
  }

  return uploadService.asset(form, {
    signal: options.signal,
    onProgress: options.onProgress,
  });
}

export async function uploadFiles(files: File[], options: UploadOptions = {}): Promise<Asset[]> {
  const uploaded: Asset[] = [];
  for (const file of files) uploaded.push(await uploadAsset(file, options));
  return uploaded;
}
