import {
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  ArrowLeft,
  ArrowUp,
  CameraOff,
  Clock3,
  Download,
  Image as ImageIcon,
  MapPin,
  Pencil,
  Search,
  Sparkles,
  SwitchCamera,
  Trash2,
  Type,
  Video,
  X,
  Zap,
  ZapOff,
} from "lucide-react";
import { FaCheck } from "react-icons/fa6";
import { Avatar } from "@/components/Avatar";
import { Spinner } from "@/components/Button";
import { Modal } from "@/components/Modal";
import { api } from "@/lib/api";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/errors";
import { kindOf, uploadAsset } from "@/lib/upload";
import { useToast } from "@/providers/ToastProvider";
import type { ThreadCard } from "@/types/api";
import {
  clamp,
  coverCrop,
  formatDuration,
  moveNormalizedPoint,
} from "./cameraMath";
import {
  applyLookPixels,
  DEFAULT_LOOK,
  LOOKS,
  lookByKey,
  type Look,
} from "./looks";
import { PhotoEditor, fetchAudioFile } from "./PhotoEditor";
import { drawScene, loadLayerImages } from "./editorCanvas";
import {
  aspectValue,
  defaultEditorDoc,
  frameAspect,
  frameForMode,
  type EditorDoc,
} from "./editorTypes";

const MAX_MS = 30_000;
const LOOK_ORDER = [
  "original",
  "clear",
  "soft",
  "blush",
  "glow",
  "vivid",
  "mono",
];

type FlashMode = "off" | "auto" | "on";
type TimerMode = 0 | 3 | 10;
type Facing = "environment" | "user";

const FLASH_STEPS: FlashMode[] = ["off", "auto", "on"];
const FLASH_LABELS: Record<FlashMode, string> = {
  off: "Off",
  auto: "Auto",
  on: "On",
};
const TEXT_FONTS = [
  {
    key: "classic",
    label: "Classic",
    css: "ui-sans-serif, system-ui, sans-serif",
  },
  { key: "poet", label: "Poet", css: "Georgia, serif" },
  { key: "bold", label: "BOLD", css: "ui-sans-serif, system-ui, sans-serif" },
  { key: "whisper", label: "whisper", css: "Georgia, serif" },
  { key: "neo", label: "Neo", css: "ui-monospace, monospace" },
] as const;

const TEXT_COLORS = [
  "#ffffff",
  "#ffec3d",
  "#ff5c8a",
  "#ec1670",
  "#8b5cf6",
  "#22c55e",
  "#111111",
];

const PROMPTS = [
  "Your feet, where they are",
  "What is in front of you?",
  "A tiny thing worth noticing",
  "The light right now",
  "Something only you can see",
  "Your current point of view",
];

const PROMPT_STYLES = [
  { font: "cursive", color: "#171316", accent: "#ec1670" },
  {
    font: "ui-sans-serif, system-ui, sans-serif",
    color: "#171316",
    accent: "#171316",
  },
  { font: "cursive", color: "#b36cff", accent: "#b36cff" },
  { font: "Georgia, serif", color: "#171316", accent: "#171316" },
  { font: "cursive", color: "#ed6cff", accent: "#ed6cff" },
] as const;

type OverlayKind = "time" | "place" | "text" | "prompt";
type ToolSheet = "place" | "text" | "prompt";
type OverlayPoint = { x: number; y: number };
type OverlayPositions = Record<OverlayKind, OverlayPoint>;

interface PlaceChoice {
  label: string;
  detail?: string;
  latitude?: number;
  longitude?: number;
}

const INITIAL_OVERLAY_POSITIONS: OverlayPositions = {
  time: { x: 0.5, y: 0.26 },
  place: { x: 0.5, y: 0.34 },
  text: { x: 0.5, y: 0.48 },
  prompt: { x: 0.5, y: 0.28 },
};

function compactPlace(
  address: Record<string, string> | undefined,
  fallback: string,
) {
  if (!address) return fallback;
  const first =
    address.amenity ||
    address.hotel ||
    address.road ||
    address.neighbourhood ||
    address.suburb ||
    address.city ||
    address.town ||
    address.village;
  const second =
    address.city ||
    address.town ||
    address.village ||
    address.state ||
    address.country;
  return (
    [first, second]
      .filter((part, index, all) => part && all.indexOf(part) === index)
      .join(", ") || fallback
  );
}

async function reversePlace(
  latitude: number,
  longitude: number,
  signal?: AbortSignal,
): Promise<PlaceChoice> {
  const query = new URLSearchParams({
    format: "jsonv2",
    lat: String(latitude),
    lon: String(longitude),
    zoom: "18",
    addressdetails: "1",
  });
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?${query}`,
      {
        headers: { Accept: "application/json" },
        signal,
      },
    );
    if (!response.ok) throw new Error("Location lookup failed.");
    const row = (await response.json()) as {
      display_name?: string;
      address?: Record<string, string>;
    };
    const fallback =
      row.display_name?.split(",").slice(0, 2).join(", ") ||
      `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    return {
      label: compactPlace(row.address, fallback),
      detail: row.display_name,
      latitude,
      longitude,
    };
  } catch (cause) {
    if ((cause as { name?: string } | null)?.name === "AbortError") throw cause;
    const fallbackQuery = new URLSearchParams({
      latitude: String(latitude),
      longitude: String(longitude),
      localityLanguage: "en",
    });
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?${fallbackQuery}`,
      {
        headers: { Accept: "application/json" },
        signal,
      },
    );
    if (!response.ok) throw new Error("Location lookup failed.", { cause });
    const row = (await response.json()) as {
      locality?: string;
      city?: string;
      principalSubdivision?: string;
      countryName?: string;
    };
    const label =
      [row.locality || row.city, row.principalSubdivision]
        .filter(Boolean)
        .join(", ") ||
      row.countryName ||
      `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
    return {
      label,
      detail: [
        row.locality,
        row.city,
        row.principalSubdivision,
        row.countryName,
      ]
        .filter((part, index, all) => part && all.indexOf(part) === index)
        .join(", "),
      latitude,
      longitude,
    };
  }
}

async function searchPlaces(
  query: string,
  signal: AbortSignal,
): Promise<PlaceChoice[]> {
  const params = new URLSearchParams({
    format: "jsonv2",
    q: query,
    limit: "6",
    addressdetails: "1",
  });
  const response = await fetch(
    `https://nominatim.openstreetmap.org/search?${params}`,
    {
      headers: { Accept: "application/json" },
      signal,
    },
  );
  if (!response.ok) throw new Error("Place search failed.");
  const rows = (await response.json()) as Array<{
    display_name: string;
    lat: string;
    lon: string;
    address?: Record<string, string>;
  }>;
  return rows.map((row) => ({
    label: compactPlace(
      row.address,
      row.display_name.split(",").slice(0, 2).join(", "),
    ),
    detail: row.display_name,
    latitude: Number(row.lat),
    longitude: Number(row.lon),
  }));
}

const SHAPES = [
  { key: "1/1", value: 1 },
  { key: "4/5", value: 4 / 5 },
  { key: "5/4", value: 5 / 4 },
  { key: "3/4", value: 3 / 4 },
  { key: "4/3", value: 4 / 3 },
  { key: "16/9", value: 16 / 9 },
  { key: "9/16", value: 9 / 16 },
];

function shapeFor(width: number, height: number) {
  if (!width || !height) return "4/5";
  const ratio = width / height;
  return SHAPES.reduce((best, item) =>
    Math.abs(Math.log(ratio / item.value)) <
    Math.abs(Math.log(ratio / best.value))
      ? item
      : best,
  ).key;
}

function cameraProblem(cause: unknown) {
  const name = (cause as { name?: string } | null)?.name;
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera permission denied.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "This phone has no camera to open.";
  }
  if (name === "NotReadableError" || name === "TrackStartError") {
    return "The camera was already in use, possibly by a higher-priority camera client.";
  }
  return "Could not open the camera.";
}

function pickMime() {
  if (typeof MediaRecorder === "undefined") return "";
  const options = [
    "video/webm;codecs=vp9,opus",
    "video/webm;codecs=vp8,opus",
    "video/webm",
    "video/mp4;codecs=avc1,mp4a.40.2",
    "video/mp4",
  ];
  return options.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => window.setTimeout(resolve, ms));
}

function isLowLight(video: HTMLVideoElement) {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 24;
    canvas.height = 24;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return false;
    context.drawImage(video, 0, 0, 24, 24);
    const { data } = context.getImageData(0, 0, 24, 24);
    let total = 0;
    for (let index = 0; index < data.length; index += 4) {
      total +=
        data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    }
    return total / (data.length / 4) < 58;
  } catch {
    return false;
  }
}

let canvasFilterSupport: boolean | null = null;

function canvasFilterSupported() {
  if (canvasFilterSupport !== null) return canvasFilterSupport;
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const context = canvas.getContext("2d");
    if (!context) {
      canvasFilterSupport = false;
      return false;
    }
    context.fillStyle = "#ff0000";
    context.fillRect(0, 0, 1, 1);
    context.filter = "grayscale(1)";
    context.fillStyle = "#ff0000";
    context.fillRect(0, 0, 1, 1);
    const { data } = context.getImageData(0, 0, 1, 1);
    canvasFilterSupport = data[0] === data[1] && data[1] === data[2];
  } catch {
    canvasFilterSupport = false;
  }
  return canvasFilterSupport;
}

async function mediaSize(
  file: File,
  kind: "image" | "video",
): Promise<{ width: number; height: number }> {
  if (kind === "image" && typeof createImageBitmap === "function") {
    try {
      const bitmap = await createImageBitmap(file);
      const size = { width: bitmap.width, height: bitmap.height };
      bitmap.close();
      return size;
    } catch {
      // Fall through to the image element path.
    }
  }
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    let settled = false;
    let timer = 0;
    const done = (width: number, height: number) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      URL.revokeObjectURL(url);
      resolve({ width, height });
    };
    timer = window.setTimeout(() => done(0, 0), 4000);
    if (kind === "image") {
      const image = new Image();
      image.onload = () => done(image.naturalWidth, image.naturalHeight);
      image.onerror = () => done(0, 0);
      image.src = url;
    } else {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => done(video.videoWidth, video.videoHeight);
      video.onerror = () => done(0, 0);
      video.src = url;
    }
  });
}

interface Shot {
  file: File;
  url: string;
  kind: "image" | "video";
  aspect: string;
  look: string;
  source: "camera" | "gallery";
}

export function CameraCapture({
  open,
  onClose,
  onPosted,
  fromChat = false,
  onMediaReady,
}: {
  open: boolean;
  onClose: () => void;
  onPosted?: () => void;
  fromChat?: boolean;
  onMediaReady?: (file: File, kind: "image" | "video", doc: EditorDoc | null) => void;
}) {
  const { toast } = useToast();
  const previewRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const recordCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recordStreamRef = useRef<MediaStream | null>(null);
  const recordAudioRef = useRef<MediaStreamTrack | null>(null);
  const frameLoopRef = useRef<number | null>(null);
  const timerRef = useRef<number | null>(null);
  const countdownRef = useRef<number | null>(null);
  const pendingActionRef = useRef<"photo" | "video" | null>(null);
  const startedAtRef = useRef(0);
  const abortRef = useRef<AbortController | null>(null);
  const aliveRef = useRef(true);
  const capturingRef = useRef(false);
  const uploadingRef = useRef(false);
  const lookRef = useRef<Look>(DEFAULT_LOOK);
  const zoomRef = useRef(1);
  const facingRef = useRef<Facing>("environment");
  const flashModeRef = useRef<FlashMode>("off");
  const torchOnRef = useRef(false);
  const pointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchRef = useRef<{ distance: number; zoom: number } | null>(null);
  const overlayDragRef = useRef<{
    kind: OverlayKind;
    pointerId: number;
    startX: number;
    startY: number;
    point: OverlayPoint;
    width: number;
    height: number;
  } | null>(null);

  const [facing, setFacing] = useState<Facing>("environment");
  const [restart, setRestart] = useState(0);
  const [ready, setReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [mode, setMode] = useState<"photo" | "video">("photo");
  const [lookKey, setLookKey] = useState(DEFAULT_LOOK.key);
  const [zoom, setZoom] = useState(1);
  const [flashMode, setFlashMode] = useState<FlashMode>("off");
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [timerMode, setTimerMode] = useState<TimerMode>(0);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [shot, setShot] = useState<Shot | null>(null);
  const [uploading, setUploading] = useState(false);
  const [rendering, setRendering] = useState(false);
  const [importing, setImporting] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [flashBurst, setFlashBurst] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);
  const [timeSticker, setTimeSticker] = useState<string | null>(null);
  const [place, setPlace] = useState("");
  const [placeDraft, setPlaceDraft] = useState("");
  const [findingPlace, setFindingPlace] = useState(false);
  const [currentPlace, setCurrentPlace] = useState<PlaceChoice | null>(null);
  const [placeResults, setPlaceResults] = useState<PlaceChoice[]>([]);
  const [placeSearching, setPlaceSearching] = useState(false);
  const [text, setText] = useState("");
  const [textDraft, setTextDraft] = useState("");
  const [textFont, setTextFont] =
    useState<(typeof TEXT_FONTS)[number]["key"]>("classic");
  const [textColor, setTextColor] = useState(TEXT_COLORS[0]);
  const [prompt, setPrompt] = useState("");
  const [promptDraft, setPromptDraft] = useState("");
  const [promptStyle, setPromptStyle] = useState(0);
  const [overlayPositions, setOverlayPositions] = useState<OverlayPositions>(
    INITIAL_OVERLAY_POSITIONS,
  );
  const [toolSheet, setToolSheet] = useState<ToolSheet | null>(null);
  const [editorMode, setEditorMode] = useState<"edit" | "moment" | null>(null);
  const [editorDoc, setEditorDoc] = useState<EditorDoc | null>(null);
  const [editedPreviewUrl, setEditedPreviewUrl] = useState<string | null>(null);
  const editedFileRef = useRef<File | null>(null);
  const editedDocRef = useRef<EditorDoc | null>(null);
  const autoEditorShotRef = useRef<string | null>(null);
  const [muted, setMuted] = useState(false);
  const [sendOpen, setSendOpen] = useState(false);
  const [threads, setThreads] = useState<ThreadCard[]>([]);
  const [threadsLoading, setThreadsLoading] = useState(false);
  const [threadSearch, setThreadSearch] = useState("");
  const [selectedThreads, setSelectedThreads] = useState<Set<string>>(
    new Set(),
  );
  const [postAction, setPostAction] = useState<"moment" | "send" | null>(null);

  const canRecord = typeof MediaRecorder !== "undefined";
  const look = lookByKey(lookKey);
  const activeFont =
    TEXT_FONTS.find((item) => item.key === textFont) ?? TEXT_FONTS[0];

  useEffect(() => {
    aliveRef.current = open;
    return () => {
      aliveRef.current = false;
    };
  }, [open]);

  useEffect(() => {
    flashModeRef.current = flashMode;
  }, [flashMode]);

  useEffect(() => {
    lookRef.current = look;
  }, [look]);

  useEffect(() => {
    zoomRef.current = zoom;
  }, [zoom]);

  useEffect(() => {
    facingRef.current = facing;
  }, [facing]);

  useEffect(() => {
    setShot(null);
    setEditorMode(null);
    setEditorDoc(null);
    editedFileRef.current = null;
    editedDocRef.current = null;
    setEditedPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    if (!open) return;
    setFailure(null);
    setUploading(false);
    setRendering(false);
    setImporting(false);
    setCapturing(false);
    setFlashBurst(false);
    setMode("photo");
    setElapsed(0);
    setZoom(1);
    setLookKey(DEFAULT_LOOK.key);
    setTimerMode(0);
    setFlashMode("off");
    setCountdown(null);
    setTimeSticker(null);
    setPlace("");
    setPlaceDraft("");
    setFindingPlace(false);
    setCurrentPlace(null);
    setPlaceResults([]);
    setPlaceSearching(false);
    setText("");
    setTextDraft("");
    setTextFont("classic");
    setTextColor(TEXT_COLORS[0]);
    setPrompt("");
    setPromptDraft("");
    setPromptStyle(0);
    setOverlayPositions(INITIAL_OVERLAY_POSITIONS);
    setToolSheet(null);
    setEditorMode(null);
    setEditorDoc(null);
    setEditedPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    autoEditorShotRef.current = null;
    setMuted(false);
    setSendOpen(false);
    setThreadsLoading(false);
    setThreadSearch("");
    setSelectedThreads(new Set());
    setPostAction(null);
    lookRef.current = DEFAULT_LOOK;
    zoomRef.current = 1;
    flashModeRef.current = "off";
    if (countdownRef.current) {
      window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    pendingActionRef.current = null;
  }, [open]);

  useEffect(() => {
    if (!shot) return;
    setEditorMode(null);
    setEditorDoc(null);
    editedFileRef.current = null;
    editedDocRef.current = null;
    setEditedPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    autoEditorShotRef.current = null;
    return () => URL.revokeObjectURL(shot.url);
  }, [shot]);

  // After capture from chat, open the editor automatically, once per shot.
  useEffect(() => {
    if (!fromChat || !shot || autoEditorShotRef.current === shot.url) return;
    autoEditorShotRef.current = shot.url;
    setEditorMode("edit");
  }, [fromChat, shot]);

  // For moments flow, auto-open in "moment" editor mode
  useEffect(() => {
    if (!onMediaReady || !shot || autoEditorShotRef.current === shot.url) return;
    autoEditorShotRef.current = shot.url;
    setEditorMode("moment");
  }, [onMediaReady, shot]);

  useEffect(() => {
    const query = placeDraft.trim();
    if (
      toolSheet !== "place" ||
      query.length < 2 ||
      query === currentPlace?.label
    ) {
      setPlaceResults([]);
      setPlaceSearching(false);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setPlaceSearching(true);
      void searchPlaces(query, controller.signal)
        .then((rows) => setPlaceResults(rows))
        .catch((cause: unknown) => {
          if ((cause as { name?: string } | null)?.name !== "AbortError") {
            setPlaceResults([]);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) setPlaceSearching(false);
        });
    }, 350);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [currentPlace?.label, placeDraft, toolSheet]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    let stream: MediaStream | null = null;
    const element = videoRef.current;
    setReady(false);
    setCameraError(null);
    torchOnRef.current = false;
    setTorchOn(false);
    setTorchAvailable(false);

    async function boot() {
      if (!navigator.mediaDevices?.getUserMedia) {
        if (!cancelled) {
          setCameraError("The camera is not available on this phone.");
        }
        return;
      }
      const video: MediaTrackConstraints = {
        facingMode: { ideal: facing },
        width: { ideal: 1280 },
        height: { ideal: 1280 },
      };
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video,
          audio: true,
        });
      } catch (cause) {
        if (cancelled) return;
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video,
            audio: false,
          });
        } catch (fallback) {
          if (!cancelled) setCameraError(cameraProblem(fallback ?? cause));
          return;
        }
      }
      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      streamRef.current = stream;
      if (element) {
        element.srcObject = stream;
        void element.play().catch(() => undefined);
      }
      const capabilities = stream
        .getVideoTracks()[0]
        ?.getCapabilities?.() as MediaTrackCapabilities & { torch?: boolean };
      setTorchAvailable(Boolean(capabilities?.torch));
      setReady(true);
    }

    void boot();

    return () => {
      cancelled = true;
      stream?.getTracks().forEach((track) => track.stop());
      if (streamRef.current === stream) streamRef.current = null;
      if (element) element.srcObject = null;
      if (timerRef.current) {
        window.clearInterval(timerRef.current);
        timerRef.current = null;
      }
      if (countdownRef.current) {
        window.clearInterval(countdownRef.current);
        countdownRef.current = null;
      }
      pendingActionRef.current = null;
      if (frameLoopRef.current !== null) {
        cancelAnimationFrame(frameLoopRef.current);
        frameLoopRef.current = null;
      }
      const recorder = recorderRef.current;
      if (recorder) {
        recorder.onstop = null;
        if (recorder.state !== "inactive") recorder.stop();
        recorderRef.current = null;
      }
      recordStreamRef.current?.getTracks().forEach((track) => track.stop());
      recordStreamRef.current = null;
      recordAudioRef.current?.stop();
      recordAudioRef.current = null;
      recordCanvasRef.current = null;
      setRecording(false);
    };
  }, [open, facing, restart]);

  useEffect(() => {
    if (!ready || !torchAvailable) return;
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    const want = flashMode === "on";
    void track
      .applyConstraints({
        advanced: [{ torch: want }],
      } as unknown as MediaTrackConstraints)
      .then(() => {
        torchOnRef.current = want;
        setTorchOn(want);
      })
      .catch(() => setTorchAvailable(false));
  }, [flashMode, ready, torchAvailable]);

  function close() {
    aliveRef.current = false;
    cancelCountdown();
    abortRef.current?.abort();
    onClose();
  }

  function retry() {
    cancelCountdown();
    setCameraError(null);
    setRestart((value) => value + 1);
  }

  function flip() {
    if (!ready || recording || capturing || uploading || importing) return;
    cancelCountdown();
    const next: Facing = facing === "user" ? "environment" : "user";
    facingRef.current = next;
    setFacing(next);
    setZoomClamped(1);
  }

  function cancelCountdown() {
    if (countdownRef.current) {
      window.clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
    pendingActionRef.current = null;
    setCountdown(null);
  }

  function cycleFlash() {
    if (!ready || cameraError) return;
    setFlashMode((current) => {
      const next =
        FLASH_STEPS[(FLASH_STEPS.indexOf(current) + 1) % FLASH_STEPS.length];
      flashModeRef.current = next;
      return next;
    });
  }

  function setZoomClamped(value: number) {
    const next = clamp(value, 1, 3);
    zoomRef.current = next;
    setZoom(next);
  }

  function toggleZoom() {
    if (!ready || cameraError || shot) return;
    setZoomClamped(zoomRef.current > 1.05 ? 1 : 2);
  }

  function chooseLook(key: string) {
    const next = lookByKey(key);
    lookRef.current = next;
    setLookKey(next.key);
  }

  async function applyTorch(on: boolean) {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return false;
    try {
      await track.applyConstraints({
        advanced: [{ torch: on }],
      } as unknown as MediaTrackConstraints);
      torchOnRef.current = on;
      setTorchOn(on);
      return true;
    } catch {
      setTorchAvailable(false);
      return false;
    }
  }

  function startCountdown(action: "photo" | "video") {
    if (countdown !== null || countdownRef.current !== null) return;
    if (timerMode === 0) {
      if (action === "photo") void capturePhoto();
      else startRecording();
      return;
    }
    pendingActionRef.current = action;
    let left = timerMode;
    setCountdown(left);
    countdownRef.current = window.setInterval(() => {
      left -= 1;
      if (left <= 0) {
        if (countdownRef.current) {
          window.clearInterval(countdownRef.current);
          countdownRef.current = null;
        }
        setCountdown(null);
        const pending = pendingActionRef.current;
        pendingActionRef.current = null;
        if (pending === "photo") void capturePhoto();
        else if (pending === "video") startRecording();
      } else {
        setCountdown(left);
      }
    }, 1000);
  }

  async function capturePhoto() {
    const element = videoRef.current;
    if (!element || !element.videoWidth || !element.videoHeight) {
      toast({ title: "That picture could not be taken.", tone: "error" });
      return;
    }
    if (
      capturing ||
      capturingRef.current ||
      recording ||
      uploading ||
      importing
    ) {
      return;
    }
    capturingRef.current = true;
    setCapturing(true);
    setFailure(null);
    try {
      const low = flashModeRef.current === "auto" ? isLowLight(element) : false;
      const needsLight = flashModeRef.current === "on" || low;
      let usedTorch = torchOnRef.current;
      if (needsLight && torchAvailable && !usedTorch) {
        usedTorch = await applyTorch(true);
        if (usedTorch) await sleep(180);
      }
      if (needsLight && !usedTorch) {
        setFlashBurst(true);
        await sleep(160);
      }
      if (!aliveRef.current) return;

      const preview = previewRef.current;
      const targetAspect =
        preview && preview.clientWidth && preview.clientHeight
          ? preview.clientWidth / preview.clientHeight
          : element.videoWidth / element.videoHeight;
      const crop = coverCrop(
        element.videoWidth,
        element.videoHeight,
        targetAspect,
        zoomRef.current,
      );
      const width = Math.max(1, Math.round(crop.sw));
      const height = Math.max(1, Math.round(crop.sh));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        toast({ title: "That picture could not be taken.", tone: "error" });
        return;
      }
      const filtered = canvasFilterSupported();
      context.save();
      if (filtered) context.filter = lookRef.current.css;
      if (facingRef.current === "user") {
        context.translate(width, 0);
        context.scale(-1, 1);
      }
      context.drawImage(
        element,
        crop.sx,
        crop.sy,
        crop.sw,
        crop.sh,
        0,
        0,
        width,
        height,
      );
      context.restore();
      if (!filtered) {
        applyLookPixels(context, width, height, lookRef.current);
      }
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", 0.92),
      );
      if (!blob) {
        toast({ title: "That picture could not be taken.", tone: "error" });
        return;
      }
      if (!aliveRef.current) return;
      const file = new File([blob], `shot-${Date.now()}.jpg`, {
        type: "image/jpeg",
      });
      setToolSheet(null);
      setShot({
        file,
        url: URL.createObjectURL(blob),
        kind: "image",
        aspect: shapeFor(width, height),
        look: lookRef.current.label,
        source: "camera",
      });
      if (low && usedTorch && flashModeRef.current !== "on") {
        await applyTorch(false);
      }
    } finally {
      capturingRef.current = false;
      if (aliveRef.current) {
        setFlashBurst(false);
        setCapturing(false);
      }
    }
  }

  function stopRecording() {
    if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setElapsed(0);
    const recorder = recorderRef.current;
    recorderRef.current = null;
    if (recorder && recorder.state !== "inactive") recorder.stop();
    else setRecording(false);
  }

  function startRecording() {
    const stream = streamRef.current;
    const element = videoRef.current;
    if (
      !stream ||
      !element ||
      recording ||
      capturing ||
      uploading ||
      importing ||
      Boolean(recorderRef.current)
    ) {
      return;
    }
    if (!canRecord) {
      toast({
        title: "This browser cannot record a video here.",
        tone: "error",
      });
      return;
    }

    const preview = previewRef.current;
    const targetAspect =
      preview && preview.clientWidth && preview.clientHeight
        ? preview.clientWidth / preview.clientHeight
        : element.videoWidth / element.videoHeight;
    const mime = pickMime();
    const filterSupported = canvasFilterSupported();
    const chunks: BlobPart[] = [];
    let canvas: HTMLCanvasElement | null = null;
    let canvasStream: MediaStream | null = null;
    let clonedAudio: MediaStreamTrack | null = null;
    let outputStream: MediaStream = stream;
    let recorder: MediaRecorder | null = null;

    const cleanup = () => {
      if (frameLoopRef.current !== null) {
        cancelAnimationFrame(frameLoopRef.current);
        frameLoopRef.current = null;
      }
      canvasStream?.getTracks().forEach((track) => track.stop());
      clonedAudio?.stop();
      canvasStream = null;
      clonedAudio = null;
      canvas = null;
      recordCanvasRef.current = null;
      recordStreamRef.current = null;
      recordAudioRef.current = null;
    };

    let useCanvas = false;
    try {
      useCanvas =
        typeof document.createElement("canvas").captureStream === "function";
    } catch {
      // Canvas capture is unavailable, so the raw stream is recorded instead.
    }

    let context: CanvasRenderingContext2D | null = null;
    if (useCanvas) {
      try {
        const maxEdge = filterSupported ? 960 : 480;
        const width =
          targetAspect >= 1 ? maxEdge : Math.round(maxEdge * targetAspect);
        const height =
          targetAspect >= 1 ? Math.round(maxEdge / targetAspect) : maxEdge;
        canvas = document.createElement("canvas");
        canvas.width = Math.max(2, width);
        canvas.height = Math.max(2, height);
        context = canvas.getContext("2d");
        if (!context) {
          cleanup();
          toast({
            title: "This browser cannot record a video here.",
            tone: "error",
          });
          return;
        }
        recordCanvasRef.current = canvas;
        canvasStream = canvas.captureStream(filterSupported ? 30 : 24);
        const audioTrack = stream.getAudioTracks()[0];
        if (audioTrack) {
          clonedAudio = audioTrack.clone();
          canvasStream.addTrack(clonedAudio);
        }
        outputStream = canvasStream;
      } catch {
        cleanup();
        useCanvas = false;
        canvas = null;
        context = null;
      }
    }

    try {
      recorder = new MediaRecorder(
        outputStream,
        mime ? { mimeType: mime } : undefined,
      );
    } catch {
      cleanup();
      canvas = null;
      if (useCanvas) {
        try {
          recorder = new MediaRecorder(
            stream,
            mime ? { mimeType: mime } : undefined,
          );
          outputStream = stream;
        } catch {
          toast({
            title: "This browser cannot record a video here.",
            tone: "error",
          });
          return;
        }
      } else {
        toast({
          title: "This browser cannot record a video here.",
          tone: "error",
        });
        return;
      }
    }

    if (!recorder) return;

    recordStreamRef.current = outputStream;
    recordAudioRef.current = clonedAudio;

    const autoTorch =
      flashModeRef.current === "auto" && torchAvailable && isLowLight(element);

    recorder.ondataavailable = (event) => {
      if (event.data.size) chunks.push(event.data);
    };
    recorder.onstop = () => {
      const type = recorder?.mimeType || mime || "video/webm";
      const blob = new Blob(chunks, { type });
      const extension = type.includes("mp4") ? "mp4" : "webm";
      const canvasWidth = canvas?.width ?? element.videoWidth;
      const canvasHeight = canvas?.height ?? element.videoHeight;
      cleanup();
      if (recorderRef.current === recorder) recorderRef.current = null;
      if (!aliveRef.current) return;
      setRecording(false);
      setElapsed(0);
      if (!blob.size) {
        toast({ title: "That video could not be recorded.", tone: "error" });
        return;
      }
      setFailure(null);
      setToolSheet(null);
      setShot({
        file: new File([blob], `clip-${Date.now()}.${extension}`, {
          type,
        }),
        url: URL.createObjectURL(blob),
        kind: "video",
        aspect: shapeFor(canvasWidth, canvasHeight),
        look: lookRef.current.label,
        source: "camera",
      });
      if (autoTorch && flashModeRef.current !== "on") {
        void applyTorch(false);
      }
    };

    if (canvas && context) {
      const targetCanvas = canvas;
      const targetContext = context;
      const draw = () => {
        const live = videoRef.current;
        if (
          !live ||
          recordCanvasRef.current !== targetCanvas ||
          !live.videoWidth ||
          !live.videoHeight
        ) {
          frameLoopRef.current = requestAnimationFrame(draw);
          return;
        }
        const aspect = targetCanvas.width / targetCanvas.height;
        const crop = coverCrop(
          live.videoWidth,
          live.videoHeight,
          aspect,
          zoomRef.current,
        );
        const activeLook = lookRef.current;
        targetContext.save();
        if (filterSupported) targetContext.filter = activeLook.css;
        if (facingRef.current === "user") {
          targetContext.translate(targetCanvas.width, 0);
          targetContext.scale(-1, 1);
        }
        targetContext.drawImage(
          live,
          crop.sx,
          crop.sy,
          crop.sw,
          crop.sh,
          0,
          0,
          targetCanvas.width,
          targetCanvas.height,
        );
        targetContext.restore();
        if (!filterSupported) {
          applyLookPixels(
            targetContext,
            targetCanvas.width,
            targetCanvas.height,
            activeLook,
          );
        }
        drawRecordingOverlays(
          targetContext,
          targetCanvas.width,
          targetCanvas.height,
        );
        if (recordCanvasRef.current !== targetCanvas) return;
        frameLoopRef.current = requestAnimationFrame(draw);
      };
      draw();
    }

    try {
      recorder.start(250);
    } catch {
      cleanup();
      recorderRef.current = null;
      toast({
        title: "This browser cannot record a video here.",
        tone: "error",
      });
      return;
    }

    recorderRef.current = recorder;
    startedAtRef.current = Date.now();
    setElapsed(0);
    setRecording(true);
    setFailure(null);
    if (
      (flashModeRef.current === "on" || autoTorch) &&
      torchAvailable &&
      !torchOnRef.current
    ) {
      void applyTorch(true);
    }
    timerRef.current = window.setInterval(() => {
      const ms = Date.now() - startedAtRef.current;
      setElapsed(ms);
      if (ms >= MAX_MS) stopRecording();
    }, 200);
  }

  function discard() {
    abortRef.current?.abort();
    abortRef.current = null;
    setShot(null);
    setFailure(null);
    setUploading(false);
    setElapsed(0);
    setEditorMode(null);
    setEditorDoc(null);
    editedFileRef.current = null;
    editedDocRef.current = null;
    setEditedPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
    setSendOpen(false);
  }

  function toggleTime() {
    setTimeSticker((current) =>
      current
        ? null
        : new Intl.DateTimeFormat(undefined, {
            hour: "numeric",
            minute: "2-digit",
          }).format(new Date()),
    );
  }

  function nextPrompt() {
    const choices = PROMPTS.filter(
      (item) => item !== promptDraft && item !== prompt,
    );
    const next =
      choices[Math.floor(Math.random() * choices.length)] ?? PROMPTS[0];
    setPromptDraft(next);
    setPrompt(next);
  }

  function choosePlace(choice: PlaceChoice) {
    setPlace(choice.label);
    setPlaceDraft(choice.label);
    setPlaceResults([]);
    setToolSheet(null);
  }

  function openPlaceSheet() {
    setPlaceDraft(place);
    setToolSheet("place");
    if (!place && !currentPlace && !findingPlace) void findCurrentPlace();
  }

  async function findCurrentPlace() {
    setFindingPlace(true);
    setCurrentPlace(null);
    try {
      let latitude: number | undefined;
      let longitude: number | undefined;
      if (navigator.geolocation) {
        try {
          const position = await new Promise<GeolocationPosition>(
            (resolve, reject) =>
              navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                maximumAge: 60_000,
                timeout: 10_000,
              }),
          );
          latitude = position.coords.latitude;
          longitude = position.coords.longitude;
        } catch {
          // A network-location fallback still gives a useful city when GPS is denied.
        }
      }

      let fallback: PlaceChoice | null = null;
      if (latitude === undefined || longitude === undefined) {
        const response = await fetch("https://ipapi.co/json/", {
          headers: { Accept: "application/json" },
        });
        if (!response.ok)
          throw new Error("Location permission was not available.");
        const row = (await response.json()) as {
          city?: string;
          region?: string;
          country_name?: string;
          latitude?: number;
          longitude?: number;
        };
        latitude = Number(row.latitude);
        longitude = Number(row.longitude);
        fallback = {
          label:
            [row.city, row.region].filter(Boolean).join(", ") ||
            row.country_name ||
            "Current location",
          detail: [row.city, row.region, row.country_name]
            .filter(Boolean)
            .join(", "),
          latitude,
          longitude,
        };
      }

      if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
        throw new Error("Current coordinates were not available.");
      }
      let choice = fallback;
      try {
        choice = await reversePlace(latitude!, longitude!);
      } catch {
        choice ??= {
          label: `${latitude!.toFixed(4)}, ${longitude!.toFixed(4)}`,
          latitude,
          longitude,
        };
      }
      if (!aliveRef.current || !choice) return;
      setCurrentPlace(choice);
      setPlaceDraft((current) => (current.trim() ? current : choice.label));
    } catch (cause) {
      if (!aliveRef.current) return;
      toast({
        title: "Could not find where you are",
        description: errorMessage(cause),
        tone: "error",
      });
    } finally {
      if (aliveRef.current) setFindingPlace(false);
    }
  }

  function beginOverlayDrag(
    kind: OverlayKind,
    event: ReactPointerEvent<HTMLElement>,
  ) {
    const stage = event.currentTarget.parentElement;
    if (!stage) return;
    const bounds = stage.getBoundingClientRect();
    overlayDragRef.current = {
      kind,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      point: overlayPositions[kind],
      width: bounds.width,
      height: bounds.height,
    };
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveOverlay(event: ReactPointerEvent<HTMLElement>) {
    const drag = overlayDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const box = event.currentTarget.getBoundingClientRect();
    const point = moveNormalizedPoint(
      drag.point,
      event.clientX - drag.startX,
      event.clientY - drag.startY,
      drag.width,
      drag.height,
      box.width,
      box.height,
    );
    setOverlayPositions((current) => ({ ...current, [drag.kind]: point }));
    event.preventDefault();
    event.stopPropagation();
  }

  function endOverlayDrag(event: ReactPointerEvent<HTMLElement>) {
    if (overlayDragRef.current?.pointerId !== event.pointerId) return;
    overlayDragRef.current = null;
    event.stopPropagation();
  }

  function drawRecordingOverlays(
    context: CanvasRenderingContext2D,
    width: number,
    height: number,
  ) {
    const scale = width / 420;
    const label = (
      value: string,
      point: OverlayPoint,
      size: number,
      font: string,
    ) => {
      context.save();
      context.font = `700 ${size * scale}px ${font}`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      const wide = Math.min(
        width * 0.84,
        context.measureText(value).width + 26 * scale,
      );
      const tall = (size + 18) * scale;
      context.fillStyle = "rgba(0,0,0,.6)";
      context.fillRect(
        point.x * width - wide / 2,
        point.y * height - tall / 2,
        wide,
        tall,
      );
      context.fillStyle = "#fff";
      context.fillText(
        value,
        point.x * width,
        point.y * height,
        wide - 16 * scale,
      );
      context.restore();
    };
    if (timeSticker)
      label(timeSticker, overlayPositions.time, 24, "ui-monospace, monospace");
    if (place)
      label(
        place,
        overlayPositions.place,
        16,
        "ui-sans-serif, system-ui, sans-serif",
      );
    if (text) {
      context.save();
      context.font = `${textFont === "bold" ? 900 : 700} ${30 * scale}px ${activeFont.css}`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.lineWidth = 4 * scale;
      context.strokeStyle =
        textColor === "#111111" ? "rgba(255,255,255,.65)" : "rgba(0,0,0,.45)";
      context.strokeText(
        text,
        overlayPositions.text.x * width,
        overlayPositions.text.y * height,
        width * 0.86,
      );
      context.fillStyle = textColor;
      context.fillText(
        text,
        overlayPositions.text.x * width,
        overlayPositions.text.y * height,
        width * 0.86,
      );
      context.restore();
    }
    if (prompt) {
      const style = PROMPT_STYLES[promptStyle] ?? PROMPT_STYLES[0];
      const cardWidth = Math.min(width * 0.82, 350 * scale);
      const cardHeight = 128 * scale;
      const x = overlayPositions.prompt.x * width - cardWidth / 2;
      const y = overlayPositions.prompt.y * height - cardHeight / 2;
      context.save();
      context.fillStyle = "rgba(58,45,38,.42)";
      context.fillRect(x, y, cardWidth, cardHeight);
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = "#fff";
      context.font = `${15 * scale}px Georgia, serif`;
      context.fillText("♥", overlayPositions.prompt.x * width, y + 23 * scale);
      context.fillStyle = style.color;
      context.font = `700 ${22 * scale}px ${style.font}`;
      context.fillText(
        prompt,
        overlayPositions.prompt.x * width,
        overlayPositions.prompt.y * height + 8 * scale,
        cardWidth - 34 * scale,
      );
      context.restore();
    }
  }

  function paintCaptureOverlays(
    context: CanvasRenderingContext2D,
    canvasWidth: number,
    canvasHeight: number,
  ) {
    const scale = canvasWidth / 420;
    const pill = (
      value: string,
      xRatio: number,
      yRatio: number,
      fontSize: number,
      background = "rgba(0,0,0,.55)",
      color = "#fff",
      fontFamily: string = activeFont.css,
    ) => {
      const center = xRatio * canvasWidth;
      context.font = `800 ${fontSize * scale}px ${fontFamily}`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      const width = Math.min(
        canvasWidth * 0.84,
        context.measureText(value).width + 28 * scale,
      );
      const height = (fontSize + 20) * scale;
      context.fillStyle = background;
      context.beginPath();
      const x = center - width / 2;
      const top = yRatio * canvasHeight - height / 2;
      const radius = Math.min(14 * scale, width / 2, height / 2);
      context.moveTo(x + radius, top);
      context.lineTo(x + width - radius, top);
      context.quadraticCurveTo(x + width, top, x + width, top + radius);
      context.lineTo(x + width, top + height - radius);
      context.quadraticCurveTo(
        x + width,
        top + height,
        x + width - radius,
        top + height,
      );
      context.lineTo(x + radius, top + height);
      context.quadraticCurveTo(x, top + height, x, top + height - radius);
      context.lineTo(x, top + radius);
      context.quadraticCurveTo(x, top, x + radius, top);
      context.closePath();
      context.fill();
      context.fillStyle = color;
      context.fillText(
        value,
        center,
        yRatio * canvasHeight,
        width - 18 * scale,
      );
    };

    if (timeSticker)
      pill(
        timeSticker,
        overlayPositions.time.x,
        overlayPositions.time.y,
        24,
        "rgba(0,0,0,.62)",
        "#fff",
        "ui-monospace, monospace",
      );
    if (place)
      pill(
        place,
        overlayPositions.place.x,
        overlayPositions.place.y,
        16,
        "rgba(0,0,0,.58)",
        "#fff",
        "ui-sans-serif, system-ui, sans-serif",
      );
    if (text) {
      context.font = `${textFont === "bold" ? 900 : 700} ${30 * scale}px ${activeFont.css}`;
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.lineWidth = 4 * scale;
      context.strokeStyle =
        textColor === "#111111" ? "rgba(255,255,255,.65)" : "rgba(0,0,0,.45)";
      context.strokeText(
        text,
        overlayPositions.text.x * canvasWidth,
        overlayPositions.text.y * canvasHeight,
        canvasWidth * 0.86,
      );
      context.fillStyle = textColor;
      context.fillText(
        text,
        overlayPositions.text.x * canvasWidth,
        overlayPositions.text.y * canvasHeight,
        canvasWidth * 0.86,
      );
    }
    if (prompt) {
      const style = PROMPT_STYLES[promptStyle] ?? PROMPT_STYLES[0];
      const centerX = overlayPositions.prompt.x * canvasWidth;
      const centerY = overlayPositions.prompt.y * canvasHeight;
      const width = Math.min(canvasWidth * 0.82, 350 * scale);
      const height = 128 * scale;
      const x = centerX - width / 2;
      const y = centerY - height / 2;
      const radius = 18 * scale;
      context.fillStyle = "rgba(58,45,38,.38)";
      context.beginPath();
      context.moveTo(x + radius, y);
      context.lineTo(x + width - radius, y);
      context.quadraticCurveTo(x + width, y, x + width, y + radius);
      context.lineTo(x + width, y + height - radius);
      context.quadraticCurveTo(
        x + width,
        y + height,
        x + width - radius,
        y + height,
      );
      context.lineTo(x + radius, y + height);
      context.quadraticCurveTo(x, y + height, x, y + height - radius);
      context.lineTo(x, y + radius);
      context.quadraticCurveTo(x, y, x + radius, y);
      context.closePath();
      context.fill();
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = "#fff";
      context.font = `${15 * scale}px Georgia, serif`;
      context.fillText("♥", centerX, y + 23 * scale);
      context.fillStyle = style.color;
      context.font = `700 ${22 * scale}px ${style.font}`;
      context.fillText(
        prompt,
        centerX,
        centerY + 8 * scale,
        width - 34 * scale,
      );
      context.fillStyle = style.accent;
      context.font = `300 ${24 * scale}px ui-sans-serif, system-ui, sans-serif`;
      context.fillText("+", x + 32 * scale, y + height - 22 * scale);
      context.fillText("+", x + width - 32 * scale, y + height - 22 * scale);
    }
  }

  async function bakeVideo(
    doc: EditorDoc,
    mode: "edit" | "moment" | null,
    includeAudio = true,
  ) {
    if (!shot || shot.kind !== "video") return null;
    if (typeof MediaRecorder === "undefined")
      throw new Error("This browser cannot bake a video here.");
    const source = document.createElement("video");
    source.src = shot.url;
    source.playsInline = true;
    source.preload = "auto";
    source.muted = true;
    await new Promise<void>((resolve, reject) => {
      source.onloadedmetadata = () => resolve();
      source.onerror = () => reject(new Error("That video would not load."));
      source.load();
    });
    if (!source.videoWidth || !source.videoHeight)
      throw new Error("That video would not load.");
    const stageAspect =
      mode === "moment"
        ? aspectValue(shot.aspect)
        : aspectValue(frameAspect(doc.frame));
    const longEdge = 960;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(
      2,
      Math.round(stageAspect >= 1 ? longEdge : longEdge * stageAspect),
    );
    canvas.height = Math.max(
      2,
      Math.round(stageAspect >= 1 ? longEdge / stageAspect : longEdge),
    );
    const context = canvas.getContext("2d");
    if (!context) throw new Error("This browser cannot bake a video here.");
    const layerImages = await loadLayerImages(doc.layers);
    const audioStartMs = Math.max(0, doc.audioStartMs);
    const audioEndMs = doc.audioEndMs > audioStartMs ? doc.audioEndMs : 0;
    const stream = canvas.captureStream(30);
    let audioContext: AudioContext | null = null;
    let audioElement: HTMLAudioElement | null = null;
    let audioUrl: string | null = null;
    let recorder: MediaRecorder | null = null;
    let frameHandle = 0;
    const cleanup = () => {
      if (frameHandle) cancelAnimationFrame(frameHandle);
      if (recorder && recorder.state !== "inactive") recorder.stop();
      stream.getTracks().forEach((track) => track.stop());
      source.pause();
      audioElement?.pause();
      if (audioUrl) URL.revokeObjectURL(audioUrl);
      if (audioContext) void audioContext.close().catch(() => undefined);
    };
    try {
      if (includeAudio && doc.audio) {
        const file = await fetchAudioFile(doc.audio);
        audioUrl = URL.createObjectURL(file);
        audioElement = new Audio(audioUrl);
        audioElement.loop = !audioEndMs;
        audioElement.preload = "auto";
        await new Promise<void>((resolve, reject) => {
          if (!audioElement)
            return reject(new Error("That track would not load."));
          audioElement.onloadedmetadata = () => resolve();
          audioElement.onerror = () =>
            reject(new Error("That track would not load."));
          audioElement.load();
        });
        audioElement.currentTime = audioStartMs / 1000;
        audioContext = new AudioContext();
        const node = audioContext.createMediaElementSource(audioElement);
        const destination = audioContext.createMediaStreamDestination();
        node.connect(destination);
        destination.stream
          .getAudioTracks()
          .forEach((track) => stream.addTrack(track));
        await audioContext.resume();
        await audioElement.play();
      } else if (includeAudio && !muted) {
        audioContext = new AudioContext();
        source.muted = false;
        const node = audioContext.createMediaElementSource(source);
        const destination = audioContext.createMediaStreamDestination();
        node.connect(destination);
        destination.stream
          .getAudioTracks()
          .forEach((track) => stream.addTrack(track));
        await audioContext.resume();
      }

      const mime = pickMime();
      const activeRecorder = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined,
      );
      recorder = activeRecorder;
      const chunks: Blob[] = [];
      const finished = new Promise<Blob>((resolve, reject) => {
        activeRecorder.ondataavailable = (event) => {
          if (event.data.size) chunks.push(event.data);
        };
        activeRecorder.onstop = () =>
          resolve(
            new Blob(chunks, {
              type: activeRecorder.mimeType || mime || "video/webm",
            }),
          );
        activeRecorder.onerror = () =>
          reject(new Error("That video could not be baked."));
      });
      let stopped = false;
      const stop = () => {
        if (stopped) return;
        stopped = true;
        if (activeRecorder.state !== "inactive") activeRecorder.stop();
      };
      source.onended = stop;
      activeRecorder.start(250);
      const draw = () => {
        if (source.ended) {
          stop();
          return;
        }
        if (
          audioElement &&
          audioEndMs &&
          audioElement.currentTime * 1000 >= audioEndMs
        ) {
          audioElement.currentTime = audioStartMs / 1000;
        }
        drawScene(context, {
          source,
          sourceWidth: source.videoWidth,
          sourceHeight: source.videoHeight,
          doc,
          width: canvas.width,
          height: canvas.height,
          layerImages,
          afterSource: paintCaptureOverlays,
        });
        frameHandle = requestAnimationFrame(draw);
      };
      await source.play();
      draw();
      const blob = await finished;
      const type = blob.type || "video/webm";
      const extension = type.includes("mp4") ? "mp4" : "webm";
      return new File(
        [blob],
        shot.file.name.replace(/\.[^.]+$/, `-xelvic.${extension}`),
        { type },
      );
    } finally {
      cleanup();
    }
  }

  async function composedFile(
    doc: EditorDoc | null = editorDoc,
    mode: "edit" | "moment" | null = editorMode,
  ) {
    if (!shot) return null;
    if (
      doc &&
      mode !== "moment" &&
      editedFileRef.current &&
      editedDocRef.current === doc
    )
      return editedFileRef.current;
    if (shot.kind === "video") {
      if (!doc) return shot.file;
      return bakeVideo(doc, mode, mode !== "moment" || !doc.audio);
    }
    const image = new Image();
    image.src = shot.url;
    try {
      await image.decode();
    } catch {
      return shot.file;
    }

    const working = doc ?? defaultEditorDoc();
    const stageAspect = doc
      ? mode === "moment"
        ? aspectValue(shot.aspect)
        : aspectValue(frameAspect(working.frame))
      : image.naturalWidth / Math.max(1, image.naturalHeight);
    const longEdge = 1440;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(
      1,
      Math.round(stageAspect >= 1 ? longEdge : longEdge * stageAspect),
    );
    canvas.height = Math.max(
      1,
      Math.round(stageAspect >= 1 ? longEdge / stageAspect : longEdge),
    );
    const context = canvas.getContext("2d");
    if (!context) return shot.file;

    const layerImages = await loadLayerImages(working.layers);
    drawScene(context, {
      source: image,
      sourceWidth: image.naturalWidth,
      sourceHeight: image.naturalHeight,
      doc: working,
      width: canvas.width,
      height: canvas.height,
      layerImages,
      afterSource: paintCaptureOverlays,
    });

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    return blob
      ? new File([blob], shot.file.name.replace(/\.[^.]+$/, "-xelvic.jpg"), {
          type: "image/jpeg",
        })
      : shot.file;
  }

  function openEditor(mode: "edit" | "moment") {
    if (!shot || rendering) return;
    setEditorMode(mode);
  }

  async function finishEditing(doc: EditorDoc) {
    setEditorDoc(doc);
    setEditorMode(null);
    if (!shot) return;
    setRendering(true);
    try {
      const file = await composedFile(doc, "edit");
      if (!file) return;
      editedFileRef.current = file;
      editedDocRef.current = doc;
      const url = URL.createObjectURL(file);
      setEditedPreviewUrl((current) => {
        if (current) URL.revokeObjectURL(current);
        return url;
      });
      // If there's an external consumer (e.g., moments flow), return the edited media
      if (onMediaReady && editorMode === "moment") {
        onMediaReady(file, shot.kind, doc);
        onClose();
        return;
      }
    } catch (cause) {
      editedFileRef.current = null;
      editedDocRef.current = null;
      toast({
        title: "That edit did not save",
        description: errorMessage(cause),
        tone: "error",
      });
    } finally {
      if (aliveRef.current) setRendering(false);
    }
  }

  async function downloadShot() {
    if (!shot || uploading || rendering) return;
    try {
      const file = await composedFile();
      if (!file) return;
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download =
        file.name ||
        (shot.kind === "image" ? "xelvic-photo.jpg" : "xelvic-video.webm");
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
      toast({ title: "Saved", tone: "success" });
    } catch (cause) {
      toast({
        title: "That could not be saved",
        description: errorMessage(cause),
        tone: "error",
      });
    }
  }

  async function postMoment(doc: EditorDoc | null = editorDoc) {
    if (!shot || uploadingRef.current) return;
    uploadingRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    setUploading(true);
    setPostAction("moment");
    setFailure(null);
    try {
      const file = await composedFile(doc, "moment");
      if (!file) return;
      const asset = await uploadAsset(file, {
        kind: shot.kind,
        signal: controller.signal,
      });
      let soundId: string | undefined;
      if (doc?.audio) {
        if (doc.audio.assetId) {
          soundId = doc.audio.assetId;
        } else {
          const audioFile = await fetchAudioFile(doc.audio);
          if (audioFile) {
            const sound = await uploadAsset(audioFile, {
              kind: "audio",
              signal: controller.signal,
            });
            soundId = String(sound.id);
          }
        }
      }
      const item: Record<string, unknown> = {
        kind: asset.kind,
        asset: asset.id,
        body: "",
        mentions: doc?.people.map((person) => String(person.id)) ?? [],
      };
      if (soundId) {
        item.sound = soundId;
        item.sound_start_ms = doc?.audioStartMs ?? 0;
      }
      if (shot.kind === "video") item.muted = Boolean(doc?.audio) || muted;
      await api.post("/moments/", { items: [item] });
      if (!aliveRef.current) return;
      toast({ title: "Your moment is up", tone: "success" });
      onPosted?.();
      setEditorMode(null);
      setEditorDoc(null);
      onClose();
    } catch (cause) {
      if (!aliveRef.current) return;
      const message = controller.signal.aborted
        ? "Upload canceled."
        : errorMessage(cause);
      setFailure(message);
      toast({
        title: "That moment did not post",
        description: message,
        tone: "error",
      });
    } finally {
      abortRef.current = null;
      uploadingRef.current = false;
      if (aliveRef.current) {
        setUploading(false);
        setPostAction(null);
      }
    }
  }

  async function openSendSheet() {
    if (rendering) return;
    setSendOpen(true);
    setThreadsLoading(true);
    setFailure(null);
    try {
      const response = await api.get<{ threads: ThreadCard[] }>(
        "/chat/threads/",
      );
      if (aliveRef.current) setThreads(response.threads ?? []);
    } catch (cause) {
      if (aliveRef.current) setFailure(errorMessage(cause));
    } finally {
      if (aliveRef.current) setThreadsLoading(false);
    }
  }

  function toggleThread(id: string) {
    setSelectedThreads((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function sendSpark() {
    if (
      !shot ||
      rendering ||
      selectedThreads.size === 0 ||
      uploadingRef.current
    )
      return;
    uploadingRef.current = true;
    const controller = new AbortController();
    abortRef.current = controller;
    setUploading(true);
    setPostAction("send");
    setFailure(null);
    try {
      const file = await composedFile();
      if (!file) return;
      const asset = await uploadAsset(file, {
        kind: shot.kind,
        signal: controller.signal,
      });
      const threadIds = Array.from(selectedThreads);
      const results = await Promise.allSettled(
        threadIds.map((threadId) =>
          api.post(`/chat/threads/${threadId}/messages/send/`, {
            // A Spark is not a message kind. It is an ordinary photo or clip
            // whose payload carries `view_once`, which is the whole of what
            // makes the server hand its bytes to one look and then purge them.
            // The web used to send `kind: "spark"`, which the server does not
            // know, so every Spark sent from here was refused.
            kind: shot.kind,
            body: "",
            asset: asset.id,
            payload: { view_once: true },
            client_id: crypto.randomUUID(),
          }),
        ),
      );
      if (!aliveRef.current) return;
      const count = results.filter(
        (result) => result.status === "fulfilled",
      ).length;
      const failed = results.length - count;
      if (failed) {
        setSelectedThreads(
          new Set(
            threadIds.filter(
              (_, index) => results[index]?.status === "rejected",
            ),
          ),
        );
        if (count === 0) {
          const message = `Could not send to ${failed} ${failed === 1 ? "person" : "people"}.`;
          setFailure(message);
          toast({ title: message, tone: "error" });
        } else {
          setFailure(
            `Sent to ${count} ${count === 1 ? "person" : "people"}. Some could not be reached.`,
          );
          toast({
            title: `Sent to ${count} ${count === 1 ? "person" : "people"}.`,
            description: "Some could not be reached.",
            tone: "error",
          });
        }
        return;
      }
      toast({
        title: `Sent to ${count} ${count === 1 ? "person" : "people"}.`,
        tone: "success",
      });
      onPosted?.();
      onClose();
    } catch (cause) {
      if (!aliveRef.current) return;
      const message = controller.signal.aborted
        ? "Upload canceled."
        : errorMessage(cause);
      setFailure(message);
      toast({
        title: "That spark did not send",
        description: message,
        tone: "error",
      });
    } finally {
      abortRef.current = null;
      uploadingRef.current = false;
      if (aliveRef.current) {
        setUploading(false);
        setPostAction(null);
      }
    }
  }

  function openGallery() {
    if (
      !ready ||
      cameraError ||
      recording ||
      capturing ||
      uploading ||
      importing
    ) {
      return;
    }
    galleryRef.current?.click();
  }

  async function handleGallery(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const kind = kindOf(file);
    if (kind !== "image" && kind !== "video") {
      toast({ title: "Pick a photo or a video.", tone: "error" });
      return;
    }
    setImporting(true);
    setFailure(null);
    try {
      const size = await mediaSize(file, kind);
      if (!aliveRef.current) return;
      setToolSheet(null);
      setShot({
        file,
        url: URL.createObjectURL(file),
        kind,
        aspect: shapeFor(size.width, size.height),
        look: "From gallery",
        source: "gallery",
      });
    } catch {
      if (aliveRef.current) {
        toast({ title: "That file could not be opened.", tone: "error" });
      }
    } finally {
      if (aliveRef.current) setImporting(false);
    }
  }

  function onPointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (!ready || cameraError || shot) return;
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (pointersRef.current.size === 2) {
      const [a, b] = Array.from(pointersRef.current.values());
      pinchRef.current = {
        distance: Math.hypot(a.x - b.x, a.y - b.y),
        zoom: zoomRef.current,
      };
    }
    try {
      event.currentTarget.setPointerCapture(event.pointerId);
    } catch {
      // Pointer capture is a nicety, not a requirement.
    }
  }

  function onPointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!pointersRef.current.has(event.pointerId)) return;
    pointersRef.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    });
    if (pointersRef.current.size === 2 && pinchRef.current) {
      const [a, b] = Array.from(pointersRef.current.values());
      const distance = Math.hypot(a.x - b.x, a.y - b.y);
      if (pinchRef.current.distance > 0) {
        setZoomClamped(
          pinchRef.current.zoom * (distance / pinchRef.current.distance),
        );
      }
    }
  }

  function onPointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    pointersRef.current.delete(event.pointerId);
    if (pointersRef.current.size < 2) pinchRef.current = null;
  }

  function onWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (!ready || cameraError || shot) return;
    setZoomClamped(zoomRef.current - event.deltaY * 0.0015);
  }

  const filteredThreads = threads.filter((thread) => {
    if (thread.kind === "group") return false;
    const title =
      thread.title || thread.other?.name || thread.other?.username || "Convo";
    return title.toLowerCase().includes(threadSearch.trim().toLowerCase());
  });
  const promptDesign = PROMPT_STYLES[promptStyle] ?? PROMPT_STYLES[0];
  const overlayLayer = (
    <div
      className="pointer-events-none absolute inset-0 z-20"
      data-overlay-stage
    >
      {timeSticker ? (
        <button
          type="button"
          onPointerDown={(event) => beginOverlayDrag("time", event)}
          onPointerMove={moveOverlay}
          onPointerUp={endOverlayDrag}
          onPointerCancel={endOverlayDrag}
          className="pointer-events-auto absolute z-30 touch-none select-none rounded-[10px] bg-black/60 px-3.5 py-2 font-mono text-[24px] font-medium tracking-wide text-white shadow-lg backdrop-blur-sm active:cursor-grabbing"
          style={{
            left: `${overlayPositions.time.x * 100}%`,
            top: `${overlayPositions.time.y * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
          aria-label="Drag time"
        >
          {timeSticker}
        </button>
      ) : null}
      {place ? (
        <button
          type="button"
          onPointerDown={(event) => beginOverlayDrag("place", event)}
          onPointerMove={moveOverlay}
          onPointerUp={endOverlayDrag}
          onPointerCancel={endOverlayDrag}
          onDoubleClick={openPlaceSheet}
          className="pointer-events-auto absolute z-30 inline-flex max-w-[82%] touch-none select-none items-center gap-1.5 rounded-full bg-black/60 px-3.5 py-2 text-[13px] font-extrabold text-white shadow-lg backdrop-blur-sm active:cursor-grabbing"
          style={{
            left: `${overlayPositions.place.x * 100}%`,
            top: `${overlayPositions.place.y * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
          aria-label="Drag place"
        >
          <MapPin className="size-4 shrink-0 text-accent" />
          <span className="truncate">{place}</span>
        </button>
      ) : null}
      {text ? (
        <button
          type="button"
          onPointerDown={(event) => beginOverlayDrag("text", event)}
          onPointerMove={moveOverlay}
          onPointerUp={endOverlayDrag}
          onPointerCancel={endOverlayDrag}
          onDoubleClick={() => {
            setTextDraft(text);
            setToolSheet("text");
          }}
          className={cn(
            "pointer-events-auto absolute z-30 max-w-[86%] touch-none select-none bg-transparent text-center text-[30px] leading-tight drop-shadow-[0_2px_3px_rgba(0,0,0,.8)] active:cursor-grabbing",
            textFont === "bold" ? "font-black uppercase" : "font-bold",
            (textFont === "poet" || textFont === "whisper") &&
              "italic font-normal",
            textFont === "whisper" && "tracking-[0.16em]",
          )}
          style={{
            left: `${overlayPositions.text.x * 100}%`,
            top: `${overlayPositions.text.y * 100}%`,
            transform: "translate(-50%, -50%)",
            color: textColor,
            fontFamily: activeFont.css,
          }}
          aria-label="Drag text"
        >
          {text}
        </button>
      ) : null}
      {prompt ? (
        <button
          type="button"
          onPointerDown={(event) => beginOverlayDrag("prompt", event)}
          onPointerMove={moveOverlay}
          onPointerUp={endOverlayDrag}
          onPointerCancel={endOverlayDrag}
          onDoubleClick={() => {
            setPromptDraft(prompt);
            setToolSheet("prompt");
          }}
          className="pointer-events-auto absolute w-[80%] max-w-[370px] touch-none select-none overflow-hidden rounded-[18px] border border-white/10 bg-[#4a3b32]/35 px-8 py-9 text-center shadow-xl backdrop-blur-[2px] active:cursor-grabbing"
          style={{
            left: `${overlayPositions.prompt.x * 100}%`,
            top: `${overlayPositions.prompt.y * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
          aria-label="Drag prompt"
        >
          <span className="absolute left-1/2 top-4 -translate-x-1/2 text-[17px] text-white">
            ♥
          </span>
          <span className="absolute left-5 top-5 h-px w-10 -rotate-6 bg-white/80" />
          <span className="absolute right-5 top-7 h-px w-7 rotate-12 bg-white/70" />
          <span
            className="absolute bottom-5 left-8 text-[23px] font-light"
            style={{ color: promptDesign.accent }}
          >
            +
          </span>
          <span
            className="absolute bottom-5 right-8 text-[23px] font-light"
            style={{ color: promptDesign.accent }}
          >
            +
          </span>
          <span
            className="relative block text-[25px] font-semibold leading-tight drop-shadow-md"
            style={{ color: promptDesign.color, fontFamily: promptDesign.font }}
          >
            {prompt}
          </span>
        </button>
      ) : null}
    </div>
  );

  return (
    <Modal
      open={open}
      onClose={close}
      size="full"
      hideClose
      className="!max-h-none !max-w-[420px] !overflow-hidden !rounded-none !border-0 !bg-[var(--solid)] text-white sm:h-[min(96dvh,900px)] sm:!rounded-[28px] sm:!border sm:!border-white/10"
    >
      <div
        ref={previewRef}
        className="relative h-full w-full overflow-hidden bg-[var(--solid)] text-white sm:rounded-[28px] sm:border sm:border-white/10"
      >
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={cn(
            "absolute inset-0 z-0 h-full w-full object-cover transition-[opacity,filter] duration-200",
            ready && !cameraError ? "opacity-100" : "opacity-0",
          )}
          style={{
            filter: look.css,
            transform: `${facing === "user" ? "scaleX(-1) " : ""}scale(${zoom})`,
          }}
        />

        <div
          className="absolute inset-0 z-10 touch-none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onDoubleClick={toggleZoom}
          onWheel={onWheel}
          aria-hidden
        />

        {!shot ? overlayLayer : null}

        {!shot ? (
          <header className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-start justify-between bg-gradient-to-b from-black/30 to-transparent px-2 pb-6 pt-[max(8px,env(safe-area-inset-top))]">
            <button
              type="button"
              onClick={close}
              className="pointer-events-auto flex size-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md transition hover:bg-black/60"
              aria-label="Close camera"
            >
              <X className="size-5" />
            </button>
            <span className="mt-2 rounded-full bg-black/40 px-3 py-1.5 text-[10px] font-extrabold text-white/80 backdrop-blur-md">
              {mode === "photo" ? "PHOTO" : "VIDEO"}
            </span>
          </header>
        ) : null}

        {!shot && ready && !cameraError ? (
          <>
          <aside className="absolute -right-2 top-[12%] z-30 flex flex-col gap-3">
            {[
              {
                key: "time",
                label: timeSticker ? "Time on" : "Add Time",
                icon: <Clock3 className="size-5" />,
                active: Boolean(timeSticker),
                action: toggleTime,
              },
              {
                key: "place",
                label: findingPlace
                  ? "Finding…"
                  : place
                    ? "Place on"
                    : "Add Place",
                icon: findingPlace ? (
                  <Spinner className="size-5" />
                ) : (
                  <MapPin className="size-5" />
                ),
                active: Boolean(place),
                action: openPlaceSheet,
              },
              {
                key: "flash",
                label: `Flash ${FLASH_LABELS[flashMode].toLowerCase()}`,
                icon:
                  flashMode === "off" ? (
                    <ZapOff className="size-5" />
                  ) : (
                    <Zap className="size-5" />
                  ),
                active: flashMode !== "off" || torchOn,
                action: cycleFlash,
              },
              {
                key: "text",
                label: "Text",
                icon: <Type className="size-5" />,
                active: Boolean(text),
                action: () => {
                  setTextDraft(text);
                  setToolSheet("text");
                },
              },
              {
                key: "prompt",
                label: "Prompt",
                icon: <Sparkles className="size-5" />,
                active: Boolean(prompt),
                action: () => {
                  const next = prompt || PROMPTS[0];
                  setPromptDraft(next);
                  setPrompt(next);
                  setToolSheet("prompt");
                },
              },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={item.action}
                className={cn(
                  "flex w-[66px] flex-col items-center gap-1 text-center text-[9px] font-extrabold leading-tight drop-shadow-md",
                  item.active ? "text-accent" : "text-white",
                )}
              >
                <span
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full backdrop-blur-md transition",
                    item.active
                      ? "bg-accent text-on-accent"
                      : "bg-black/40 text-white",
                  )}
                >
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </aside>

          <aside
            role="group"
            aria-label="Timer"
            className="absolute left-1 top-[12%] z-30 flex flex-col items-center gap-1 rounded-[22px] bg-black/40 p-1 backdrop-blur-md"
          >
            <span className="flex size-8 items-center justify-center text-white/60" aria-hidden>
              <Clock3 className="size-4" />
            </span>
            {([0, 3, 10] as const).map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setTimerMode(value)}
                disabled={recording || countdown !== null}
                aria-pressed={timerMode === value}
                title={value === 0 ? "Timer off" : `${value} second timer`}
                className={cn(
                  "flex size-9 items-center justify-center rounded-full text-[9.5px] font-extrabold transition disabled:opacity-40",
                  timerMode === value
                    ? "bg-white text-black"
                    : "text-white/70 hover:bg-white/10",
                )}
              >
                {value === 0 ? "Off" : `${value}s`}
              </button>
            ))}
          </aside>
          </>
        ) : null}

        {!ready && !cameraError ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/60">
            <Spinner className="size-8 text-white" />
            <p className="text-[11px] font-semibold text-white/60">
              Opening the camera...
            </p>
          </div>
        ) : null}

        {cameraError ? (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/85 px-8 text-center">
            <span className="flex size-14 items-center justify-center rounded-full bg-white/10">
              <CameraOff className="size-6 text-white/70" />
            </span>
            <p className="text-[14px] font-extrabold">
              Could not open the camera
            </p>
            <p className="max-w-[280px] text-[11px] leading-5 text-white/60">
              {cameraError}
            </p>
            <div className="mt-1 flex gap-2">
              <button
                type="button"
                onClick={close}
                className="rounded-full border border-white/20 px-4 py-2 text-[11px] font-bold text-white/80"
              >
                Go back
              </button>
              <button
                type="button"
                onClick={retry}
                className="rounded-full bg-white px-4 py-2 text-[11px] font-extrabold text-black"
              >
                Try again
              </button>
            </div>
          </div>
        ) : null}

        {recording ? (
          <div
            className="pointer-events-none absolute left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/60 px-3 py-1.5 backdrop-blur"
            style={{ top: "max(26px, calc(env(safe-area-inset-top) + 64px))" }}
          >
            <span className="size-2 animate-pulse rounded-full bg-red-500" />
            <span className="text-[10px] font-extrabold tracking-wide text-white/90">
              REC
            </span>
            <span className="text-[10px] font-bold tabular-nums text-white/70">
              {formatDuration(elapsed)} / {formatDuration(MAX_MS)}
            </span>
          </div>
        ) : null}

        {!shot && ready && !cameraError ? (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 bg-gradient-to-t from-black/70 via-black/40 to-transparent pt-16">
            <div className="pointer-events-auto px-2 pb-[max(6px,env(safe-area-inset-bottom))]">
              <div className="mb-3">
                <div className="flex gap-4 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                  {[...LOOKS]
                    .sort(
                      (a, b) =>
                        LOOK_ORDER.indexOf(a.key) - LOOK_ORDER.indexOf(b.key),
                    )
                    .map((item) => {
                      const selected = item.key === lookKey;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => chooseLook(item.key)}
                          aria-pressed={selected}
                          className="flex shrink-0 flex-col items-center gap-1.5"
                        >
                          <span
                            className={cn(
                              "relative block size-14 overflow-hidden rounded-full border-[3px] transition",
                              selected
                                ? "border-accent shadow-[0_0_0_2px_var(--accent-soft)]"
                                : "border-white/20",
                            )}
                          >
                            <img
                              src={`/looks/${item.key}.jpg`}
                              alt=""
                              className="size-full object-cover"
                              draggable={false}
                            />
                          </span>
                          <span
                            className={cn(
                              "text-[10px] font-bold transition",
                              selected ? "text-white" : "text-white/50",
                            )}
                          >
                            {item.label}
                          </span>
                        </button>
                      );
                    })}
                </div>
              </div>

              <div className="mb-3 flex justify-center">
                <div className="inline-flex items-center gap-0.5 rounded-full bg-white/10 p-0.5 backdrop-blur">
                  {(["photo", "video"] as const).map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        if (!recording && countdown === null) setMode(value);
                      }}
                      disabled={
                        recording ||
                        countdown !== null ||
                        (value === "video" && !canRecord)
                      }
                      aria-pressed={mode === value}
                      className={cn(
                        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10.5px] font-extrabold transition disabled:opacity-40",
                        mode === value
                          ? "bg-white text-black"
                          : "text-white/70",
                      )}
                    >
                      {value === "photo" ? (
                        <ImageIcon className="size-3.5" />
                      ) : (
                        <Video className="size-3.5" />
                      )}
                      {value === "photo" ? "Photo" : "Video"}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between gap-2">
                <div className="flex flex-1 justify-start">
                  <button
                    type="button"
                    onClick={openGallery}
                    disabled={
                      !ready || recording || capturing || uploading || importing
                    }
                    className="flex size-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-40"
                    aria-label="Open gallery"
                    title="Gallery"
                  >
                    <ImageIcon className="size-5" />
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    if (mode === "photo") startCountdown("photo");
                    else if (recording) stopRecording();
                    else startCountdown("video");
                  }}
                  disabled={
                    !ready ||
                    Boolean(cameraError) ||
                    uploading ||
                    importing ||
                    capturing ||
                    countdown !== null
                  }
                  className="relative flex size-[70px] items-center justify-center rounded-full border-[3px] border-white/90 transition active:scale-95 disabled:opacity-40"
                  aria-label={
                    mode === "photo"
                      ? "Take a picture"
                      : recording
                        ? "Stop recording"
                        : "Start recording"
                  }
                >
                  {recording ? (
                    <span className="pointer-events-none absolute animate-pulse" />
                  ) : null}
                  <span
                    className={cn(
                      "block transition-all",
                      mode === "photo" && "size-[56px] rounded-full bg-white",
                      mode === "video" &&
                        (recording
                          ? "size-7 rounded-[8px] bg-red-500"
                          : "size-[56px] rounded-full bg-red-500"),
                    )}
                  />
                </button>

                <div className="flex flex-1 justify-end">
                  <button
                    type="button"
                    onClick={flip}
                    disabled={
                      !ready || recording || capturing || uploading || importing
                    }
                    className="flex size-12 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white backdrop-blur transition hover:bg-white/20 disabled:opacity-40"
                    aria-label="Switch camera"
                    title="Flip"
                  >
                    <SwitchCamera className="size-5" />
                  </button>
                </div>
              </div>

              <p className="mt-2 text-center text-[9.5px] font-medium text-white/40">
                {recording
                  ? "Recording. Tap the shutter to stop."
                  : mode === "photo"
                    ? "Take a picture, or pick a look."
                    : "Record a video, up to 30 seconds."}
              </p>
            </div>
          </div>
        ) : null}

        {countdown !== null ? (
          <div
            className="absolute inset-0 z-20 flex flex-col items-center justify-center gap-4 bg-black/50 px-8 text-center backdrop-blur-[2px]"
            aria-live="polite"
          >
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-white/70">
              Get ready
            </p>
            <p className="flex size-28 items-center justify-center rounded-full border-4 border-white/30 text-[64px] font-extrabold tabular-nums text-white">
              {countdown}
            </p>
            <button
              type="button"
              onClick={cancelCountdown}
              className="rounded-full border border-white/25 px-4 py-2 text-[11px] font-bold text-white/80 transition hover:bg-white/10"
            >
              Cancel
            </button>
          </div>
        ) : null}

        {shot ? (
          <div className="absolute inset-0 z-30 bg-black">
            <div className="absolute inset-0 overflow-hidden bg-black">
              {shot.kind === "video" ? (
                <video
                  src={shot.url}
                  autoPlay
                  loop
                  playsInline
                  muted={muted}
                  className="absolute inset-0 size-full object-cover"
                  aria-label="Your video"
                />
              ) : (
                <img
                  src={editedPreviewUrl ?? shot.url}
                  alt="Your shot"
                  className={cn(
                    "absolute inset-0 size-full",
                    editedPreviewUrl ? "object-contain" : "object-cover",
                  )}
                />
              )}
              {!editedPreviewUrl ? overlayLayer : null}
            </div>

            <button
              type="button"
              onClick={discard}
              className="absolute left-4 top-[max(12px,env(safe-area-inset-top))] z-40 flex size-12 items-center justify-center rounded-full bg-black/55 text-white backdrop-blur"
              aria-label="Retake"
            >
              <ArrowLeft className="size-6" />
            </button>
            <footer className="absolute inset-x-0 bottom-0 z-40 flex h-[116px] items-center justify-between bg-gradient-to-t from-black/90 via-black/65 to-transparent px-5 pb-[max(12px,env(safe-area-inset-bottom))] pt-4">
              {[
                {
                  label: "Save",
                  icon: <Download className="size-5" />,
                  action: () => void downloadShot(),
                },
                {
                  label: "Edit",
                  icon: <Pencil className="size-5" />,
                  action: () => openEditor("edit"),
                },
                {
                  label: "Moments",
                  icon: <Sparkles className="size-5" />,
                  action: () => openEditor("moment"),
                },
              ].map((item) => (
                <button
                  key={item.label}
                  type="button"
                  onClick={item.action}
                  disabled={uploading || rendering}
                  className="flex flex-col items-center gap-1.5 text-[10px] font-extrabold text-white disabled:opacity-40"
                >
                  <span className="flex size-12 items-center justify-center rounded-full bg-white/20 backdrop-blur-md">
                    {item.icon}
                  </span>
                  {item.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => void openSendSheet()}
                disabled={uploading || rendering}
                className="flex flex-col items-center gap-1.5 text-[10px] font-extrabold text-white disabled:opacity-40"
                aria-label="Send spark"
              >
                <span className="flex size-14 items-center justify-center rounded-full bg-accent text-on-accent shadow-lg">
                  <ArrowUp className="size-7" />
                </span>
              </button>
            </footer>

            {rendering ? (
              <div className="absolute inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black/55 text-white backdrop-blur-sm">
                <Spinner className="size-8 text-white" />
                <p className="text-[12px] font-extrabold">
                  Finishing your edit
                </p>
              </div>
            ) : null}
            {failure ? (
              <p className="absolute inset-x-4 bottom-[124px] z-50 rounded-[14px] bg-red-950/90 px-3 py-2 text-[11px] leading-5 text-red-100">
                {failure}
              </p>
            ) : null}
          </div>
        ) : null}

        {editorMode && shot ? (
          <PhotoEditor
            shot={{ url: shot.url, kind: shot.kind }}
            mode={editorMode}
            shotAspect={shot.aspect}
            place={place}
            initialDoc={
              editorMode === "moment"
                ? {
                    ...(editorDoc ??
                      defaultEditorDoc(frameForMode("moment", shot.aspect))),
                    frame: frameForMode("moment", shot.aspect),
                    fit: true,
                    panX: 0,
                    panY: 0,
                    zoom: 1,
                  }
                : (editorDoc ??
                  defaultEditorDoc(frameForMode("edit", shot.aspect)))
            }
            baseOverlay={overlayLayer}
            posting={
              editorMode === "moment" && uploading && postAction === "moment"
            }
            onCancel={() => setEditorMode(null)}
            onDone={(doc) => void finishEditing(doc)}
            onPost={(doc) => void postMoment(doc)}
            onStop={() => abortRef.current?.abort()}
          />
        ) : null}

        {toolSheet ? (
          <div
            className="absolute inset-0 z-[70] flex items-end bg-black/55"
            onClick={() => setToolSheet(null)}
          >
            {toolSheet === "prompt" ? (
              <button
                type="button"
                onClick={() => {
                  setPrompt("");
                  setPromptDraft("");
                  setToolSheet(null);
                }}
                className="pointer-events-auto absolute right-4 top-[max(12px,env(safe-area-inset-top))] flex size-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur"
                aria-label="Remove prompt"
              >
                <Trash2 className="size-6" />
              </button>
            ) : null}
            {toolSheet === "place" ? (
              <section
                className="max-h-[58%] w-full overflow-y-auto rounded-t-[28px] bg-card px-5 pb-[max(22px,env(safe-area-inset-bottom))] pt-5 text-ink shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="flex items-center gap-2 text-[19px] font-black">
                    <MapPin className="size-5 text-accent" />
                    Place
                  </h2>
                  <button
                    type="button"
                    onClick={() => setToolSheet(null)}
                    className="flex size-9 items-center justify-center rounded-full text-dim hover:bg-surface-2"
                    aria-label="Close"
                  >
                    <X className="size-6" />
                  </button>
                </div>
                <div className="flex items-center gap-2 rounded-xl border-2 border-accent bg-surface-2 px-3">
                  <Search className="size-5 text-dim" />
                  <input
                    value={placeDraft}
                    onChange={(event) => setPlaceDraft(event.target.value)}
                    placeholder="Search a hotel, a street, a city…"
                    className="h-12 min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-ink outline-none placeholder:text-dim"
                    autoFocus
                  />
                </div>
                <div className="mt-3 space-y-1">
                  {findingPlace ? (
                    <p className="flex items-center gap-3 px-1 py-3 text-[14px] font-extrabold">
                      <Spinner className="size-5 text-accent" />
                      Finding where you are…
                    </p>
                  ) : null}
                  {!findingPlace && currentPlace ? (
                    <button
                      type="button"
                      onClick={() => choosePlace(currentPlace)}
                      className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left hover:bg-surface-2"
                    >
                      <span className="flex size-10 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent">
                        <MapPin className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[14px] font-extrabold">
                          {currentPlace.label}
                        </span>
                        <span className="block truncate text-[11px] text-dim">
                          Current location
                        </span>
                      </span>
                    </button>
                  ) : null}
                  {placeSearching ? (
                    <p className="flex items-center gap-3 px-2 py-3 text-[12px] font-bold text-dim">
                      <Spinner className="size-4 text-accent" />
                      Searching places…
                    </p>
                  ) : null}
                  {!placeSearching &&
                    placeResults.map((choice) => (
                      <button
                        key={`${choice.latitude}-${choice.longitude}-${choice.label}`}
                        type="button"
                        onClick={() => choosePlace(choice)}
                        className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left hover:bg-surface-2"
                      >
                        <MapPin className="size-5 shrink-0 text-accent" />
                        <span className="min-w-0">
                          <span className="block truncate text-[13px] font-extrabold">
                            {choice.label}
                          </span>
                          <span className="block truncate text-[10px] text-dim">
                            {choice.detail}
                          </span>
                        </span>
                      </button>
                    ))}
                  {!findingPlace &&
                  !placeSearching &&
                  placeDraft.trim() &&
                  placeResults.length === 0 &&
                  placeDraft.trim() !== currentPlace?.label ? (
                    <button
                      type="button"
                      onClick={() => choosePlace({ label: placeDraft.trim() })}
                      className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left font-extrabold hover:bg-surface-2"
                    >
                      <MapPin className="size-5 text-accent" />
                      Use “{placeDraft.trim()}”
                    </button>
                  ) : null}
                  {!findingPlace && !currentPlace ? (
                    <button
                      type="button"
                      onClick={() => void findCurrentPlace()}
                      className="flex w-full items-center gap-3 rounded-2xl px-2 py-3 text-left text-[13px] font-extrabold"
                    >
                      <MapPin className="size-5 text-accent" />
                      Try current location again
                    </button>
                  ) : null}
                  {place ? (
                    <button
                      type="button"
                      onClick={() => {
                        setPlace("");
                        setPlaceDraft("");
                        setToolSheet(null);
                      }}
                      className="w-full py-2.5 text-[12px] font-bold text-red-600 hover:bg-red-100 rounded-lg text-center hover:border-red-400 hover:border"
                    >
                      Remove place
                    </button>
                  ) : null}
                </div>
              </section>
            ) : (
              <section
                className="max-h-[58%] w-full overflow-y-auto rounded-t-[28px] bg-card px-4 pb-[max(18px,env(safe-area-inset-bottom))] pt-3 text-ink shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                {toolSheet === "prompt" ? (
                  <div className="mb-3 flex items-center gap-3">
                    <h2 className="text-[16px] font-black">Prompt</h2>
                    <button
                      type="button"
                      onClick={nextPrompt}
                      className="rounded-full bg-[var(--accent-soft)] px-3 py-1.5 text-[12px] font-extrabold text-accent"
                    >
                      ↻&nbsp; Another
                    </button>
                    <button
                      type="button"
                      onClick={() => setToolSheet(null)}
                      className="ml-auto flex size-9 items-center justify-center rounded-full text-dim hover:bg-surface-2"
                      aria-label="Close"
                    >
                      <X className="size-5" />
                    </button>
                  </div>
                ) : null}
                {toolSheet === "text" ? (
                  <>
                    <div className="mb-3 flex items-center gap-3">
                      <h2 className="text-[16px] font-black">Text</h2>
                      <button
                        type="button"
                        onClick={() => setToolSheet(null)}
                        className="ml-auto flex size-9 items-center justify-center rounded-full text-dim hover:bg-surface-2"
                        aria-label="Close text"
                      >
                        <X className="size-5" />
                      </button>
                    </div>
                    <textarea
                      value={textDraft}
                      onChange={(event) => {
                        setTextDraft(event.target.value);
                        setText(event.target.value.trim());
                      }}
                      placeholder="Say something on it"
                      maxLength={120}
                      rows={2}
                      className={cn(
                        "w-full resize-none rounded-xl border-2 border-accent px-5 py-2 text-[19px] font-semibold outline-none",
                        textColor === "#111111"
                          ? "placeholder:text-white/40"
                          : "placeholder:text-black/35",
                      )}
                      style={{
                        color: textColor,
                        fontFamily: activeFont.css,
                        backgroundColor:
                          textColor === "#111111" ? "#171316" : "#ffffff",
                      }}
                      autoFocus
                    />
                    <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {TEXT_FONTS.map((font) => (
                        <button
                          key={font.key}
                          type="button"
                          onClick={() => setTextFont(font.key)}
                          className={cn(
                            "shrink-0 rounded-full border px-5 py-2 text-[14px]",
                            textFont === font.key
                              ? "border-accent bg-card text-ink"
                              : "border-line text-dim",
                            font.key === "bold" && "font-black",
                            (font.key === "poet" || font.key === "whisper") &&
                              "italic",
                            font.key === "whisper" && "tracking-[0.18em]",
                          )}
                          style={{ fontFamily: font.css }}
                        >
                          {font.label}
                        </button>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-3 overflow-x-auto px-1 pb-1">
                      {TEXT_COLORS.map((color) => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setTextColor(color)}
                          aria-label={`Use ${color}`}
                          className={cn(
                            "size-9 shrink-0 rounded-full border-2",
                            textColor === color
                              ? "border-accent ring-2 ring-[var(--accent-soft)]"
                              : "border-line",
                          )}
                          style={{ backgroundColor: color }}
                        />
                      ))}
                    </div>
                  </>
                ) : (
                  <>
                    <textarea
                      value={promptDraft}
                      onChange={(event) => {
                        setPromptDraft(event.target.value);
                        setPrompt(event.target.value.trim());
                      }}
                      maxLength={140}
                      rows={2}
                      className="w-full resize-none rounded-xl border-2 border-accent bg-card px-5 py-2 text-[18px] font-semibold leading-snug text-ink outline-none placeholder:text-dim"
                      autoFocus
                    />
                    <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {PROMPT_STYLES.map((style, index) => (
                        <button
                          key={`${style.font}-${index}`}
                          type="button"
                          onClick={() => setPromptStyle(index)}
                          className={cn(
                            "flex h-11 w-[70px] shrink-0 items-center justify-center rounded-lg border text-[25px]",
                            promptStyle === index
                              ? "border-2 border-accent bg-accent-chip"
                              : "border-line bg-surface-3",
                          )}
                          style={{ color: style.color, fontFamily: style.font }}
                        >
                          Aa
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </section>
            )}
          </div>
        ) : null}

        {sendOpen ? (
          <div
            className="absolute inset-0 z-[80] flex items-end bg-black/50"
            onClick={() => setSendOpen(false)}
          >
            <section
              className="flex max-h-[62%] min-h-[42%] w-full flex-col rounded-t-[28px] bg-card pb-[max(18px,env(safe-area-inset-bottom))] text-ink shadow-2xl"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-[color-mix(in_srgb,var(--ink)_18%,transparent)]" />
              <div className="flex items-center justify-between px-5 pb-2 pt-2">
                <h2 className="text-[18px] font-extrabold">Send spark</h2>
                <button
                  type="button"
                  onClick={() => setSendOpen(false)}
                  className="flex size-9 items-center justify-center rounded-full bg-surface-2 hover:bg-[color-mix(in_srgb,var(--ink)_12%,var(--card))]"
                  aria-label="Close"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="mx-5 mb-3 flex h-11 items-center gap-2.5 rounded-full bg-surface-2 px-4 focus-within:ring-1 focus-within:ring-accent">
                <Search className="size-4 text-dim" />
                <input
                  value={threadSearch}
                  onChange={(event) => setThreadSearch(event.target.value)}
                  placeholder="Search people"
                  className="min-w-0 flex-1 bg-transparent text-[13px] font-semibold outline-none"
                  autoFocus
                />
              </div>
              {selectedThreads.size ? (
                <button
                  type="button"
                  onClick={() => void sendSpark()}
                  disabled={uploading}
                  className="mx-5 mb-4 h-11 rounded-full bg-accent text-[13px] font-extrabold text-on-accent disabled:opacity-35"
                >
                  Send to {selectedThreads.size}{" "}
                  {selectedThreads.size === 1 ? "person" : "people"}
                </button>
              ) : null}
              <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-1">
                {threadsLoading ? (
                  <div className="flex justify-center py-10">
                    <Spinner className="size-7 text-accent" />
                  </div>
                ) : null}
                {!threadsLoading && filteredThreads.length === 0 ? (
                  <p className="py-10 text-center text-[13px] font-bold text-dim">
                    No convos yet.
                  </p>
                ) : null}
                {!threadsLoading && filteredThreads.length ? (
                  <>
                    <p className="mb-3 text-[11px] font-extrabold text-dim">
                      Recents
                    </p>
                    <div className="flex gap-3 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {filteredThreads.map((thread) => {
                        const title =
                          thread.title ||
                          thread.other?.name ||
                          thread.other?.username ||
                          "Convo";
                        const selected = selectedThreads.has(thread.id);
                        return (
                          <button
                            key={thread.id}
                            type="button"
                            onClick={() => toggleThread(thread.id)}
                            className="flex w-[72px] shrink-0 flex-col items-center gap-2"
                          >
                            <span
                              className={cn(
                                "relative rounded-full p-[2px] transition",
                                selected
                                  ? "ring-2 ring-accent"
                                  : "ring-2 ring-transparent",
                              )}
                            >
                              <Avatar
                                user={thread.other}
                                name={title}
                                src={thread.avatar}
                                size={62}
                              />
                              {selected ? (
                                <span className="absolute -bottom-0.5 -right-0.5 flex size-5 items-center justify-center rounded-full border-2 border-card bg-accent text-on-accent">
                                  <FaCheck className="size-2.5" />
                                </span>
                              ) : null}
                            </span>
                            <span className="w-full truncate text-center text-[11px] font-semibold">
                              {title}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                ) : null}
              </div>
            </section>
          </div>
        ) : null}

        {flashBurst ? (
          <div className="pointer-events-none absolute inset-0 z-40 bg-white" />
        ) : null}

        {(uploading && postAction !== "moment") || importing ? (
          <div className="absolute inset-0 z-[90] flex flex-col items-center justify-center gap-3 bg-black/80 backdrop-blur-sm">
            <Spinner className="size-8 text-white" />
            <p className="text-[12px] font-bold">
              {uploading
                ? postAction === "send"
                  ? "Sending spark..."
                  : "Uploading..."
                : "Opening..."}
            </p>
            {uploading ? (
              <button
                type="button"
                onClick={() => abortRef.current?.abort()}
                className="rounded-full border border-white/25 px-4 py-1.5 text-[10.5px] font-bold text-white/80"
              >
                Cancel upload
              </button>
            ) : null}
          </div>
        ) : null}

        <input
          ref={galleryRef}
          type="file"
          accept="image/*,video/*"
          className="hidden"
          onChange={(event) => void handleGallery(event)}
        />
      </div>
    </Modal>
  );
}
