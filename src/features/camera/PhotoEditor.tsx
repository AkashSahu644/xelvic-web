import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import {
  AlignCenter,
  ArrowLeft,
  AtSign,
  Bookmark,
  Check,
  ChevronDown,
  Circle,
  Clock3,
  Crop,
  Frame,
  ImagePlus,
  Lasso,
  Link2,
  MapPin,
  Minus,
  Music2,
  Palette,
  PaintBucket,
  Pause,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  RotateCw,
  Search,
  SlidersHorizontal,
  Sparkles,
  Square,
  Sticker,
  Trash2,
  Type,
  Undo2,
  User,
  X,
} from "lucide-react";
import { Avatar } from "@/components/Avatar";
import { Spinner } from "@/components/Button";
import {
  api,
  apiPathFrom,
  isBackendMediaPath,
  mediaUrl,
  refreshAccessToken,
} from "@/lib/api";
import { cn } from "@/lib/cn";
import { ApiError, errorMessage } from "@/lib/errors";
import { session } from "@/lib/session";
import { kindOf, uploadAsset } from "@/lib/upload";
import { usePlayer } from "@/providers/PlayerProvider";
import { useToast } from "@/providers/ToastProvider";
import type { AudioHome, Track, UserCard } from "@/types/api";
import {
  AURA_FILTERS,
  EDIT_BACKGROUNDS,
  EDIT_FILTERS,
  EDIT_FONTS,
  EDIT_OUTLINES,
  EDIT_TEXT_COLORS,
  EDIT_TEXT_STYLES,
  FRAMES,
  aspectValue,
  fontByKey,
  frameAspect,
  type EditorCrop,
  type EditorDoc,
  type EditorLayer,
  type EditorMode,
  type EditorText,
} from "./editorTypes";
import { combinedFilter, effectiveSourceSize, layerSize } from "./editorCanvas";
import { FaCheck } from "react-icons/fa";

type Tool =
  | "frame"
  | "audio"
  | "tag"
  | "filter"
  | "text"
  | "draw"
  | "cutout"
  | "sticker"
  | "image"
  | "crop"
  | "turn"
  | "aura"
  | null;
type Subtool =
  | "font"
  | "color"
  | "background"
  | "outline"
  | "align"
  | "box"
  | "style"
  | null;

const AUDIO_PART_WINDOWS = [10_000, 15_000, 20_000, 25_000, 30_000, 35_000];

const DRAW_COLORS = [
  "#ffffff",
  "#111111",
  "#ec1670",
  "#ffec3d",
  "#4da3ff",
  "#2ee66b",
  "#ff5a4d",
  "#b36cff",
];

interface StickerRow {
  id: string | number;
  name: string;
  url: string;
  width?: number;
  height?: number;
  pack?: string;
}

interface StickerPack {
  id: string | number;
  name: string;
  slug: string;
  count?: number;
}

type AudioPageResponse = {
  tracks?: Track[];
  results?: Track[];
  next_page?: number | null;
  next?: string | null;
  count?: number;
};

type AudioLikeResponse = {
  liked?: boolean;
  data?: { liked?: boolean };
};

type DropSaveResponse = {
  saved?: boolean;
};

function audioRows(response: AudioPageResponse) {
  const rows = response.tracks ?? response.results ?? [];
  return Array.isArray(rows) ? rows : [];
}

function trackKey(track: Track) {
  return `${track.title.trim().toLowerCase()}|${track.artist.trim().toLowerCase()}`;
}

function sameTrack(left: Track, right: Track) {
  return trackKey(left) === trackKey(right);
}

function streamTrackId(track: Track) {
  const raw = track.stream || track.stream_url || "";
  const match = raw.match(
    /\/tracks\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i,
  );
  return match?.[1] ?? null;
}

function streamDropId(track: Track) {
  const raw = track.stream || track.stream_url || "";
  const match = raw.match(
    /\/drops\/(?:drops\/)?([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\/content\//i,
  );
  return match?.[1] ?? null;
}

async function fetchAllAudioTracks(home: AudioHome | null) {
  const tracks: Track[] = [];
  const seen = new Set<string>();
  const add = (rows: Track[] | null | undefined) => {
    (rows ?? []).forEach((track) => {
      const id = String(track.id);
      if (seen.has(id)) return;
      seen.add(id);
      tracks.push(track);
    });
  };

  let catalogueLoaded = false;
  try {
    let path: string | null = "/audio/tracks/";
    let page = 1;
    for (let guard = 0; path && guard < 50; guard += 1) {
      const response: AudioPageResponse = await api.get<AudioPageResponse>(
        path,
        { query: guard === 0 ? { limit: 100, page_size: 100 } : undefined },
      );
      const batch = audioRows(response);
      if (!batch.length) break;
      add(batch);
      if (response.next) {
        path = apiPathFrom(response.next) ?? response.next;
        continue;
      }
      if (response.next_page) {
        page = response.next_page;
        path = `/audio/tracks/?page=${page}&page_size=100`;
        continue;
      }
      if (
        typeof response.count === "number" &&
        tracks.length < response.count
      ) {
        page += 1;
        path = `/audio/tracks/?page=${page}&page_size=100`;
        continue;
      }
      path = null;
    }
    catalogueLoaded = tracks.length > 0;
  } catch {
    // The home shelves below are only a fallback for an unavailable catalogue.
  }

  if (catalogueLoaded) return tracks;

  add(home?.recent);
  add(home?.podcasts);
  add(home?.hero ? [home.hero] : []);
  const shelves = (home?.playlists ?? []).slice(0, 20);
  const artists = (home?.artists ?? []).slice(0, 50);
  const details = await Promise.allSettled([
    ...shelves.map((playlist) =>
      api.get<{ tracks?: Track[] }>(`/audio/playlists/${playlist.id}/`),
    ),
    ...artists.flatMap((artist) =>
      artist.slug
        ? [
            api.get<{ tracks?: Track[] }>("/audio/tracks/", {
              query: { artist: artist.slug },
            }),
          ]
        : [],
    ),
  ]);
  details.forEach((detail) => {
    if (detail.status === "fulfilled") add(detail.value.tracks);
  });
  return tracks;
}

async function findAudioTrack(track: Track) {
  const response = await api.get<AudioPageResponse>("/audio/tracks/", {
    query: { q: track.title },
  });
  return audioRows(response).find((row) => sameTrack(row, track)) ?? null;
}

const STICKER_TABS = [
  { key: "mention", label: "Mention", icon: <AtSign className="size-4" /> },
  { key: "link", label: "Link", icon: <Link2 className="size-4" /> },
  { key: "time", label: "Time", icon: <Clock3 className="size-4" /> },
  { key: "place", label: "Place", icon: <MapPin className="size-4" /> },
] as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function colorOf(list: readonly { key: string; value: string }[], key: string) {
  return list.find((item) => item.key === key)?.value ?? "transparent";
}

function outlineColor(value: string) {
  if (value === "none") return "transparent";
  if (/^(#|rgb|hsl)/.test(value)) return value;
  return colorOf(EDIT_OUTLINES, value);
}

function trackStream(track: Track | null) {
  if (!track) return null;
  return (
    track.stream || track.stream_url || `/audio/tracks/${track.id}/stream/`
  );
}

let audioHomeCache: { at: number; home: AudioHome } | null = null;

function trackCover(track: Track | null) {
  if (!track) return null;
  const raw =
    track.cover_url ||
    track.cover?.thumbnail_url ||
    track.cover?.content_url ||
    null;
  return raw ? (mediaUrl(raw) ?? raw) : null;
}

const TRACK_TONES = [
  ["#243b80", "#7f8cff"],
  ["#0b6b63", "#5eead4"],
  ["#8e174e", "#ff7ab8"],
  ["#4c2b86", "#b794ff"],
  ["#8a4b0f", "#ffc46b"],
  ["#0d5f73", "#7dd3fc"],
  ["#5b1d1d", "#ff8b8b"],
  ["#334155", "#cbd5e1"],
] as const;

function trackSeed(track: Track | null) {
  const raw = String(track?.seed ?? track?.id ?? "xelvic");
  let hash = 0;
  for (let index = 0; index < raw.length; index += 1) {
    hash = (hash * 31 + raw.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function AudioArt({
  track,
  className,
  iconClassName,
  eager = false,
}: {
  track: Track | null;
  className?: string;
  iconClassName?: string;
  eager?: boolean;
}) {
  const rawSrc = trackCover(track);
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const src = rawSrc && rawSrc !== failedSrc ? rawSrc : null;
  const [from, to] = TRACK_TONES[trackSeed(track) % TRACK_TONES.length];
  return (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden bg-surface-2",
        className,
      )}
    >
      {src ? (
        <img
          src={src}
          alt=""
          loading={eager ? "eager" : "lazy"}
          decoding="async"
          onError={() => setFailedSrc(rawSrc)}
          className="size-full object-cover"
        />
      ) : (
        <>
          <span
            className="absolute inset-0"
            style={{ background: `linear-gradient(135deg, ${from}, ${to})` }}
          />
          <span className="absolute -right-4 -top-5 size-16 rounded-full bg-white/15" />
          <span className="absolute -bottom-5 -left-4 size-16 rounded-full bg-black/10" />
          <Music2
            className={cn("relative size-5 text-white/90", iconClassName)}
          />
        </>
      )}
    </span>
  );
}

function audioClock(seconds?: number) {
  if (seconds == null || !Number.isFinite(seconds) || seconds < 0)
    return "0:00";
  const whole = Math.round(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, "0")}`;
}

function audioPlays(track: Track) {
  const plays = track.plays ?? 0;
  return `${plays} ${plays === 1 ? "play" : "plays"}`;
}

function readAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    const fail = () => {
      URL.revokeObjectURL(url);
      reject(new Error("That audio has no length to read."));
    };
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      const duration = Number.isFinite(audio.duration)
        ? Math.round(audio.duration * 1000)
        : 0;
      URL.revokeObjectURL(url);
      if (duration > 0) resolve(duration);
      else reject(new Error("That audio has no length to read."));
    };
    audio.onerror = fail;
    audio.src = url;
  });
}

async function fetchAudioFile(track: Track): Promise<File> {
  const raw = trackStream(track);
  const url = mediaUrl(raw);
  if (!url) throw new Error("That track has no audio to upload.");
  const needsAuth = (() => {
    try {
      return isBackendMediaPath(new URL(url).pathname);
    } catch {
      return true;
    }
  })();
  const request = async () => {
    const headers: Record<string, string> = {};
    const token = session.access();
    if (needsAuth && token) headers.Authorization = `Bearer ${token}`;
    return fetch(url, { headers, credentials: needsAuth ? "include" : "omit" });
  };
  let response = await request();
  if (response.status === 401) {
    const refreshed = await refreshAccessToken();
    if (refreshed) response = await request();
  }
  if (!response.ok) throw new Error("That track could not be downloaded.");
  const blob = await response.blob();
  return new File([blob], `${track.title || "xelvic-audio"}.mp3`, {
    type: blob.type || "audio/mpeg",
  });
}

export function PhotoEditor({
  shot,
  mode,
  shotAspect,
  initialDoc,
  baseOverlay,
  place,
  posting = false,
  onCancel,
  onDone,
  onPost,
  onStop,
}: {
  shot: { url: string; kind: "image" | "video" };
  mode: EditorMode;
  shotAspect: string;
  initialDoc: EditorDoc;
  baseOverlay?: ReactNode;
  place?: string;
  posting?: boolean;
  onCancel: () => void;
  onDone: (doc: EditorDoc) => void;
  onPost?: (doc: EditorDoc) => void;
  onStop?: () => void;
}) {
  const { toast } = useToast();
  const player = usePlayer();
  const closePlayer = player.close;
  const stageRef = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const audioInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const clipId = `cutout-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;
  const [stageBox, setStageBox] = useState({ width: 0, height: 0 });
  const [sourceSize, setSourceSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [doc, setDoc] = useState<EditorDoc>(initialDoc);
  const docRef = useRef(doc);
  const historyRef = useRef<EditorDoc[]>([]);
  const [historyCount, setHistoryCount] = useState(0);
  const [tool, setTool] = useState<Tool>(mode === "moment" ? "filter" : null);
  const [subtool, setSubtool] = useState<Subtool>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tagOpen, setTagOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);
  const [trimOpen, setTrimOpen] = useState(false);
  const [trimWindowOpen, setTrimWindowOpen] = useState(false);
  const [trimTrack, setTrimTrack] = useState<Track | null>(null);
  const [trimDurationMs, setTrimDurationMs] = useState(0);
  const [trimStartMs, setTrimStartMs] = useState(0);
  const [trimEndMs, setTrimEndMs] = useState(0);
  const [trimWindowMs, setTrimWindowMs] = useState(30_000);
  const [trimLoading, setTrimLoading] = useState(false);
  const trimDragRef = useRef<"start" | "end" | "head" | "window" | null>(null);
  const trimDragOffsetRef = useRef(0);
  const trimStripRef = useRef<HTMLDivElement>(null);
  const trimScrollRef = useRef<HTMLDivElement>(null);
  const trimWaveRef = useRef<HTMLDivElement>(null);
  const trimRequestRef = useRef(0);
  const [tagQuery, setTagQuery] = useState("");
  const [tagPeople, setTagPeople] = useState<UserCard[]>([]);
  const [tagLoading, setTagLoading] = useState(false);
  const [audioHome, setAudioHome] = useState<AudioHome | null>(null);
  const [audioAll, setAudioAll] = useState<Track[]>([]);
  const [audioAllLoading, setAudioAllLoading] = useState(false);
  const [audioResults, setAudioResults] = useState<Track[]>([]);
  const [audioQuery, setAudioQuery] = useState("");
  const [audioTab, setAudioTab] = useState<"all" | "trending" | "saved">("all");
  const [audioHeroIndex, setAudioHeroIndex] = useState(0);
  const [audioLoading, setAudioLoading] = useState(false);
  const [audioUploading, setAudioUploading] = useState(false);
  const [savedTracks, setSavedTracks] = useState<Track[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [likedTracks, setLikedTracks] = useState<Record<string, boolean>>({});
  const [likeBusy, setLikeBusy] = useState<string | null>(null);
  const [drawColor, setDrawColor] = useState(DRAW_COLORS[0]);
  const [drawWidth, setDrawWidth] = useState(0.012);
  const [defaultFont, setDefaultFont] = useState("classic");
  const [cropDraft, setCropDraft] = useState<EditorCrop>({
    x: 0,
    y: 0,
    w: 1,
    h: 1,
  });
  const [keepInside, setKeepInside] = useState(true);
  const [lassoDraft, setLassoDraft] = useState<{ x: number; y: number }[]>([]);
  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(null);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [stickerTab, setStickerTab] =
    useState<(typeof STICKER_TABS)[number]["key"]>("mention");
  const [stickerRows, setStickerRows] = useState<StickerRow[]>([]);
  const [stickerPacks, setStickerPacks] = useState<StickerPack[]>([]);
  const [stickerLoading, setStickerLoading] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const panRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    panX: number;
    panY: number;
    width: number;
    height: number;
  } | null>(null);
  const textDragRef = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const drawRef = useRef<{
    pointerId: number;
    points: { x: number; y: number }[];
  } | null>(null);
  const lassoRef = useRef<{
    pointerId: number;
    points: { x: number; y: number }[];
  } | null>(null);
  const layerDragRef = useRef<{
    id: string;
    pointerId: number;
    startX: number;
    startY: number;
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);
  const cropDragRef = useRef<{
    pointerId: number;
    corner: "nw" | "ne" | "sw" | "se";
    startX: number;
    startY: number;
    crop: EditorCrop;
    width: number;
    height: number;
  } | null>(null);
  const skipFocusHistoryRef = useRef(false);
  const previewingRef = useRef(false);

  const effectiveSize = effectiveSourceSize(sourceSize, doc.turns);
  const cropMode = tool === "crop";
  const stageRatio =
    cropMode && effectiveSize
      ? effectiveSize.width / Math.max(1, effectiveSize.height)
      : aspectValue(mode === "moment" ? shotAspect : frameAspect(doc.frame));
  const selectedText = doc.texts.find((item) => item.id === selectedId) ?? null;
  const selectedLayer =
    doc.layers.find((item) => item.id === selectedLayerId) ?? null;
  const isTrackLiked = (track: Track) =>
    likedTracks[String(track.id)] ?? Boolean(track.liked);
  const previewFilter = combinedFilter(doc);
  const scale = Math.max(0.4, stageBox.width / 420);
  const previewCrop = cropMode
    ? { x: 0, y: 0, w: 1, h: 1 }
    : (doc.crop ?? { x: 0, y: 0, w: 1, h: 1 });
  const previewFit = cropMode ? true : doc.fit;
  const previewZoom = cropMode ? 1 : doc.zoom;
  const previewPanX = cropMode ? 0 : doc.panX;
  const previewPanY = cropMode ? 0 : doc.panY;
  const previewSource = effectiveSize ?? { width: 1, height: 1 };
  const previewCropWidth = Math.max(1, previewSource.width * previewCrop.w);
  const previewCropHeight = Math.max(1, previewSource.height * previewCrop.h);
  const previewBase = previewFit
    ? Math.min(
        stageBox.width / previewCropWidth,
        stageBox.height / previewCropHeight,
      )
    : Math.max(
        stageBox.width / previewCropWidth,
        stageBox.height / previewCropHeight,
      );
  const previewScale = previewBase * previewZoom;
  const previewLeft =
    stageBox.width / 2 +
    previewPanX * stageBox.width -
    (previewCrop.x * previewSource.width + previewCropWidth / 2) * previewScale;
  const previewTop =
    stageBox.height / 2 +
    previewPanY * stageBox.height -
    (previewCrop.y * previewSource.height + previewCropHeight / 2) *
      previewScale;
  const previewTransform = `translate(${previewLeft}px, ${previewTop}px) scale(${previewScale})`;
  const turnTransform =
    doc.turns === 0
      ? "none"
      : doc.turns === 1
        ? `translate(${previewSource.width}px, 0) rotate(90deg)`
        : doc.turns === 2
          ? `translate(${previewSource.width}px, ${previewSource.height}px) rotate(180deg)`
          : `translate(0, ${previewSource.height}px) rotate(270deg)`;
  const cutout = cropMode ? null : doc.cutout;
  const cutoutPath =
    cutout && cutout.points.length >= 3
      ? `${cutout.keepInside ? "" : "M0 0 H1 V1 H0 Z "}${cutout.points
          .map(
            (point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`,
          )
          .join(" ")} Z`
      : null;
  const cutoutClip = cutoutPath ? `url(#${clipId})` : undefined;

  useEffect(() => {
    docRef.current = doc;
  }, [doc]);

  useEffect(() => {
    if (tool && tool !== "sticker" && tool !== "image")
      setSelectedLayerId(null);
  }, [tool]);

  useEffect(() => {
    let cancelled = false;
    setSourceSize(null);
    if (shot.kind === "image") {
      const image = new Image();
      image.onload = () => {
        if (!cancelled)
          setSourceSize({
            width: image.naturalWidth,
            height: image.naturalHeight,
          });
      };
      image.src = shot.url;
    } else {
      const video = document.createElement("video");
      video.preload = "metadata";
      video.onloadedmetadata = () => {
        if (!cancelled)
          setSourceSize({ width: video.videoWidth, height: video.videoHeight });
      };
      video.src = shot.url;
    }
    return () => {
      cancelled = true;
    };
  }, [shot.kind, shot.url]);

  useEffect(() => {
    if (tool === "crop")
      setCropDraft(docRef.current.crop ?? { x: 0, y: 0, w: 1, h: 1 });
  }, [tool]);

  useEffect(() => {
    if (!stickerOpen) return;
    let cancelled = false;
    setStickerLoading(true);
    void Promise.all([
      api
        .get<{ stickers: StickerRow[] }>("/stickers/")
        .catch(() => ({ stickers: [] })),
      api
        .get<{ packs: StickerPack[] }>("/stickers/packs/")
        .catch(() => ({ packs: [] })),
    ])
      .then(([stickerResponse, packResponse]) => {
        if (cancelled) return;
        setStickerRows(
          Array.isArray(stickerResponse.stickers)
            ? stickerResponse.stickers.filter((row) => row.url)
            : [],
        );
        setStickerPacks(
          Array.isArray(packResponse.packs) ? packResponse.packs : [],
        );
      })
      .finally(() => {
        if (!cancelled) setStickerLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [stickerOpen]);

  useEffect(
    () => () => {
      if (previewingRef.current) {
        previewingRef.current = false;
        closePlayer();
      }
    },
    [closePlayer],
  );

  useLayoutEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;
    const update = () => {
      const rect = wrap.getBoundingClientRect();
      const ratio = stageRatio;
      let width = Math.max(0, rect.width);
      let height = width / ratio;
      if (height > rect.height) {
        height = Math.max(0, rect.height);
        width = height * ratio;
      }
      setStageBox({ width, height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [stageRatio]);

  useEffect(() => {
    if (!tagOpen) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setTagLoading(true);
      void api
        .get<UserCard[]>("/social/mentionable/", {
          query: { q: tagQuery.trim() },
          signal: controller.signal,
        })
        .then((rows) => setTagPeople(Array.isArray(rows) ? rows : []))
        .catch((cause: unknown) => {
          if ((cause as { name?: string } | null)?.name !== "AbortError")
            setTagPeople([]);
        })
        .finally(() => setTagLoading(false));
    }, 220);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [tagOpen, tagQuery]);

  useEffect(() => {
    if (!audioOpen) return;
    let cancelled = false;
    const cached = audioHomeCache;
    if (cached) {
      setAudioHome(cached.home);
      setAudioLoading(false);
    } else {
      setAudioLoading(true);
    }
    void api
      .get<AudioHome>("/audio/")
      .then((home) => {
        audioHomeCache = { at: Date.now(), home };
        if (!cancelled) setAudioHome(home);
      })
      .catch(() => {
        if (!cancelled && !cached) setAudioHome(null);
      })
      .finally(() => {
        if (!cancelled) setAudioLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [audioOpen]);

  useEffect(() => {
    if (!audioOpen || audioTab !== "all" || audioQuery.trim()) return;
    let cancelled = false;
    setAudioAllLoading(true);
    void fetchAllAudioTracks(audioHome)
      .then((tracks) => {
        if (!cancelled) setAudioAll(tracks);
      })
      .catch(() => {
        if (!cancelled) setAudioAll([]);
      })
      .finally(() => {
        if (!cancelled) setAudioAllLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [audioOpen, audioTab, audioQuery, audioHome]);

  useEffect(() => {
    if (!audioOpen || audioTab !== "saved") return;
    let cancelled = false;
    setSavedLoading(true);
    void api
      .get<AudioPageResponse>("/audio/felt/")
      .then((response) => {
        if (cancelled) return;
        setSavedTracks((current) => {
          const merged = new Map<string, Track>();
          audioRows(response).forEach((track) =>
            merged.set(String(track.id), track),
          );
          current.forEach((track) => {
            const liked =
              likedTracks[String(track.id)] ?? Boolean(track.liked);
            if (liked) merged.set(String(track.id), track);
          });
          return [...merged.values()];
        });
      })
      .catch(() => {
        // Keep what was saved in this session when the refetch fails.
      })
      .finally(() => setSavedLoading(false));
    return () => {
      cancelled = true;
    };
  }, [audioOpen, audioTab, likedTracks]);

  useEffect(() => {
    if (!audioOpen) return;
    const query = audioQuery.trim();
    if (!query) {
      setAudioResults([]);
      return;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setAudioLoading(true);
      void api
        .get<{ tracks: Track[] }>("/audio/tracks/", {
          query: { q: query },
          signal: controller.signal,
        })
        .then((response) => setAudioResults(response.tracks ?? []))
        .catch((cause: unknown) => {
          if ((cause as { name?: string } | null)?.name !== "AbortError")
            setAudioResults([]);
        })
        .finally(() => setAudioLoading(false));
    }, 260);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [audioOpen, audioQuery]);

  function pushHistory(snapshot: EditorDoc) {
    historyRef.current = [...historyRef.current.slice(-29), snapshot];
    setHistoryCount(historyRef.current.length);
  }

  function commit(
    next: EditorDoc | ((current: EditorDoc) => EditorDoc),
    snapshot = true,
  ) {
    const current = docRef.current;
    if (snapshot) pushHistory(current);
    const value =
      typeof next === "function"
        ? (next as (value: EditorDoc) => EditorDoc)(current)
        : next;
    docRef.current = value;
    setDoc(value);
  }

  function undo() {
    const previous = historyRef.current.pop();
    if (!previous) return;
    if (String(previous.audio?.id) !== String(docRef.current.audio?.id))
      stopPreview();
    docRef.current = previous;
    setDoc(previous);
    setHistoryCount(historyRef.current.length);
  }

  function updateText(id: string, patch: Partial<EditorText>, snapshot = true) {
    commit(
      (current) => ({
        ...current,
        texts: current.texts.map((item) =>
          item.id === id ? { ...item, ...patch } : item,
        ),
      }),
      snapshot,
    );
  }

  function addText() {
    const layer: EditorText = {
      id: crypto.randomUUID(),
      value: "Text",
      x: 0.5,
      y: 0.5,
      font: defaultFont,
      size: 34,
      color: "#ffffff",
      background: "none",
      outline: "none",
      align: "center",
      box: false,
      rotation: 0,
    };
    commit(
      (current) => ({ ...current, texts: [...current.texts, layer] }),
      true,
    );
    setSelectedId(layer.id);
    setTool("text");
    setSubtool("color");
    skipFocusHistoryRef.current = true;
    window.setTimeout(() => {
      textInputRef.current?.select();
      skipFocusHistoryRef.current = false;
    }, 30);
  }

  function deleteText(id: string) {
    commit(
      (current) => ({
        ...current,
        texts: current.texts.filter((item) => item.id !== id),
      }),
      true,
    );
    if (selectedId === id) setSelectedId(null);
  }

  function beginPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (tool !== "frame" || mode === "moment") return;
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    pushHistory(docRef.current);
    panRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      panX: docRef.current.panX,
      panY: docRef.current.panY,
      width: rect.width,
      height: rect.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function movePan(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = panRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const panX = clamp(
      drag.panX + (event.clientX - drag.startX) / Math.max(1, drag.width),
      -0.5,
      0.5,
    );
    const panY = clamp(
      drag.panY + (event.clientY - drag.startY) / Math.max(1, drag.height),
      -0.5,
      0.5,
    );
    commit((current) => ({ ...current, panX, panY }), false);
  }

  function endPan(event: ReactPointerEvent<HTMLDivElement>) {
    if (panRef.current?.pointerId !== event.pointerId) return;
    panRef.current = null;
  }

  function beginTextDrag(id: string, event: ReactPointerEvent<HTMLDivElement>) {
    event.stopPropagation();
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const text = docRef.current.texts.find((item) => item.id === id);
    if (!text) return;
    setSelectedId(id);
    pushHistory(docRef.current);
    textDragRef.current = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: text.x,
      y: text.y,
      width: rect.width,
      height: rect.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveTextDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = textDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const x = clamp(
      drag.x + (event.clientX - drag.startX) / Math.max(1, drag.width),
      0.04,
      0.96,
    );
    const y = clamp(
      drag.y + (event.clientY - drag.startY) / Math.max(1, drag.height),
      0.04,
      0.96,
    );
    commit(
      (current) => ({
        ...current,
        texts: current.texts.map((item) =>
          item.id === drag.id ? { ...item, x, y } : item,
        ),
      }),
      false,
    );
  }

  function endTextDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (textDragRef.current?.pointerId !== event.pointerId) return;
    textDragRef.current = null;
  }

  function stagePoint(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0.5, y: 0.5 };
    return {
      x: clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1),
      y: clamp((event.clientY - rect.top) / Math.max(1, rect.height), 0, 1),
    };
  }

  function beginDraw(event: ReactPointerEvent<HTMLDivElement>) {
    if (tool !== "draw") return;
    const point = stagePoint(event);
    pushHistory(docRef.current);
    drawRef.current = { pointerId: event.pointerId, points: [point] };
    commit(
      (current) => ({
        ...current,
        strokes: [
          ...current.strokes,
          { points: [point], color: drawColor, width: drawWidth },
        ],
      }),
      false,
    );
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveDraw(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = drawRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = stagePoint(event);
    drag.points = [...drag.points, point];
    commit(
      (current) => ({
        ...current,
        strokes: current.strokes.map((stroke, index) =>
          index === current.strokes.length - 1
            ? { ...stroke, points: drag.points }
            : stroke,
        ),
      }),
      false,
    );
  }

  function endDraw(event: ReactPointerEvent<HTMLDivElement>) {
    if (drawRef.current?.pointerId !== event.pointerId) return;
    drawRef.current = null;
  }

  function beginLasso(event: ReactPointerEvent<HTMLDivElement>) {
    if (tool !== "cutout") return;
    const point = stagePoint(event);
    lassoRef.current = { pointerId: event.pointerId, points: [point] };
    setLassoDraft([point]);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveLasso(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = lassoRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const point = stagePoint(event);
    drag.points = [...drag.points, point];
    setLassoDraft(drag.points);
  }

  function endLasso(event: ReactPointerEvent<HTMLDivElement>) {
    if (lassoRef.current?.pointerId !== event.pointerId) return;
    lassoRef.current = null;
  }

  function applyCutout() {
    if (lassoDraft.length < 3) {
      toast({ title: "Draw around something first.", tone: "info" });
      return;
    }
    commit(
      (current) => ({ ...current, cutout: { points: lassoDraft, keepInside } }),
      true,
    );
    setLassoDraft([]);
  }

  function removeCutout() {
    commit((current) => ({ ...current, cutout: null }), true);
    setLassoDraft([]);
  }

  function beginCropDrag(
    corner: "nw" | "ne" | "sw" | "se",
    event: ReactPointerEvent<HTMLButtonElement>,
  ) {
    event.stopPropagation();
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    cropDragRef.current = {
      pointerId: event.pointerId,
      corner,
      startX: event.clientX,
      startY: event.clientY,
      crop: cropDraft,
      width: rect.width,
      height: rect.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveCropDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const drag = cropDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const dx = (event.clientX - drag.startX) / Math.max(1, drag.width);
    const dy = (event.clientY - drag.startY) / Math.max(1, drag.height);
    const min = 0.08;
    let { x, y, w, h } = drag.crop;
    if (drag.corner.includes("w")) {
      const nextX = clamp(x + dx, 0, x + w - min);
      w = w + (x - nextX);
      x = nextX;
    } else {
      w = clamp(w + dx, min, 1 - x);
    }
    if (drag.corner.includes("n")) {
      const nextY = clamp(y + dy, 0, y + h - min);
      h = h + (y - nextY);
      y = nextY;
    } else {
      h = clamp(h + dy, min, 1 - y);
    }
    setCropDraft({ x, y, w, h });
  }

  function endCropDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (cropDragRef.current?.pointerId !== event.pointerId) return;
    cropDragRef.current = null;
  }

  function applyCrop() {
    const full =
      cropDraft.x <= 0.001 &&
      cropDraft.y <= 0.001 &&
      cropDraft.w >= 0.999 &&
      cropDraft.h >= 0.999;
    commit((current) => ({ ...current, crop: full ? null : cropDraft }), true);
    setTool(null);
  }

  function turnImage() {
    commit(
      (current) => ({
        ...current,
        turns: ((current.turns + 1) % 4) as EditorDoc["turns"],
      }),
      true,
    );
    setCropDraft({ x: 0, y: 0, w: 1, h: 1 });
  }

  function addLayer(layer: EditorLayer) {
    commit(
      (current) => ({ ...current, layers: [...current.layers, layer] }),
      true,
    );
    setSelectedLayerId(layer.id);
    setSelectedId(null);
  }

  function updateLayer(
    id: string,
    patch: Partial<EditorLayer>,
    snapshot = true,
  ) {
    commit(
      (current) => ({
        ...current,
        layers: current.layers.map((layer) =>
          layer.id === id ? { ...layer, ...patch } : layer,
        ),
      }),
      snapshot,
    );
  }

  function deleteLayer(id: string) {
    commit(
      (current) => ({
        ...current,
        layers: current.layers.filter((layer) => layer.id !== id),
      }),
      true,
    );
    if (selectedLayerId === id) setSelectedLayerId(null);
  }

  function addTextSticker(value: string) {
    const layer: EditorText = {
      id: crypto.randomUUID(),
      value,
      x: 0.5,
      y: 0.5,
      font: defaultFont,
      size: 30,
      color: "#ffffff",
      background: "black",
      outline: "none",
      align: "center",
      box: false,
      rotation: 0,
    };
    commit(
      (current) => ({ ...current, texts: [...current.texts, layer] }),
      true,
    );
    setSelectedId(layer.id);
    setStickerOpen(false);
    setTool("text");
    setSubtool("color");
  }

  function addSticker(row: StickerRow) {
    const ratio = row.width && row.height ? row.height / row.width : 1;
    addLayer({
      id: crypto.randomUUID(),
      kind: "sticker",
      src: row.url,
      x: 0.5,
      y: 0.5,
      scale: 1,
      rotation: 0,
      ratio,
      name: row.name,
    });
    setStickerOpen(false);
    setTool("sticker");
  }

  function chooseStickerTab(key: (typeof STICKER_TABS)[number]["key"]) {
    setStickerTab(key);
    if (key === "mention") addTextSticker("@");
    else if (key === "time")
      addTextSticker(
        new Date().toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      );
    else if (key === "place") addTextSticker(place || "Place");
  }

  function addLinkSticker() {
    const value = linkDraft.trim();
    if (!value) {
      toast({ title: "Paste a link first.", tone: "info" });
      return;
    }
    addTextSticker(value);
    setLinkDraft("");
  }

  async function addImageFile(file: File) {
    if (kindOf(file) !== "image") {
      toast({ title: "Pick a picture.", tone: "error" });
      return;
    }
    try {
      const src = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? ""));
        reader.onerror = () =>
          reject(new Error("That picture would not load."));
        reader.readAsDataURL(file);
      });
      const image = await new Promise<HTMLImageElement>((resolve, reject) => {
        const element = new Image();
        element.onload = () => resolve(element);
        element.onerror = () =>
          reject(new Error("That picture would not load."));
        element.src = src;
      });
      addLayer({
        id: crypto.randomUUID(),
        kind: "image",
        src,
        x: 0.5,
        y: 0.5,
        scale: 1,
        rotation: 0,
        ratio: image.naturalHeight / Math.max(1, image.naturalWidth),
        name: file.name,
      });
      setTool("image");
    } catch (cause) {
      toast({
        title: "That picture would not load",
        description: errorMessage(cause),
        tone: "error",
      });
    }
  }

  function beginLayerDrag(
    id: string,
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    event.stopPropagation();
    const rect = stageRef.current?.getBoundingClientRect();
    if (!rect) return;
    const layer = docRef.current.layers.find((item) => item.id === id);
    if (!layer) return;
    setSelectedLayerId(id);
    setSelectedId(null);
    pushHistory(docRef.current);
    layerDragRef.current = {
      id,
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      x: layer.x,
      y: layer.y,
      width: rect.width,
      height: rect.height,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function moveLayerDrag(event: ReactPointerEvent<HTMLDivElement>) {
    const drag = layerDragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    const x = clamp(
      drag.x + (event.clientX - drag.startX) / Math.max(1, drag.width),
      0.04,
      0.96,
    );
    const y = clamp(
      drag.y + (event.clientY - drag.startY) / Math.max(1, drag.height),
      0.04,
      0.96,
    );
    updateLayer(drag.id, { x, y }, false);
  }

  function endLayerDrag(event: ReactPointerEvent<HTMLDivElement>) {
    if (layerDragRef.current?.pointerId !== event.pointerId) return;
    layerDragRef.current = null;
  }

  function exitTool() {
    if (trimOpen) closeTrim();
    if (audioOpen) closeAudio();
    setTool(null);
    setSubtool(null);
    setTagOpen(false);
    setStickerOpen(false);
    setSelectedLayerId(null);
    setLassoDraft([]);
    setCropDraft(docRef.current.crop ?? { x: 0, y: 0, w: 1, h: 1 });
  }

  function togglePerson(person: UserCard) {
    const id = String(person.id);
    const selected = doc.people.some((item) => String(item.id) === id);
    if (!selected && doc.people.length >= 5) {
      toast({ title: "You can name up to 5 people.", tone: "info" });
      return;
    }
    commit(
      (current) => ({
        ...current,
        people: selected
          ? current.people.filter((item) => String(item.id) !== id)
          : [...current.people, person],
      }),
      true,
    );
  }

  function closeAudio() {
    setAudioOpen(false);
    stopPreview();
  }

  function closeTrim() {
    trimRequestRef.current += 1;
    setTrimOpen(false);
    setTrimWindowOpen(false);
    setTrimTrack(null);
    setTrimLoading(false);
    trimDragRef.current = null;
    stopPreview();
  }

  function previewTrack(track: Track) {
    previewingRef.current = true;
    player.play(track, [track]);
  }


  async function openTrim(track: Track, knownDurationMs = 0) {
    const request = ++trimRequestRef.current;
    const seconds =
      track.seconds && track.seconds > 0 ? Math.round(track.seconds * 1000) : 0;
    const duration = Math.max(0, knownDurationMs || seconds);
    setAudioOpen(false);
    setTrimOpen(true);
    setTrimWindowOpen(false);
    setTrimTrack(track);
    setTrimStartMs(0);
    setTrimWindowMs(Math.min(30_000, duration || 30_000));
    setTrimEndMs(Math.min(duration, 30_000));
    setTrimDurationMs(duration);
    setTrimLoading(duration === 0);
    previewTrack(track);
    if (duration > 0) return;
    try {
      const file = await fetchAudioFile(track);
      const next = await readAudioDuration(file);
      if (request !== trimRequestRef.current) return;
      setTrimDurationMs(next);
      setTrimWindowMs(Math.min(30_000, next));
      setTrimEndMs(Math.min(30_000, next));
      setTrimTrack((current) =>
        current ? { ...current, seconds: Math.round(next / 1000) } : current,
      );
    } catch {
      if (request !== trimRequestRef.current) return;
      setTrimOpen(false);
      setTrimTrack(null);
      stopPreview();
      toast({ title: "That audio has no length to read.", tone: "error" });
    } finally {
      if (request === trimRequestRef.current) setTrimLoading(false);
    }
  }

  async function uploadAudio(file: File) {
    if (kindOf(file) !== "audio") {
      toast({ title: "Pick an audio file.", tone: "error" });
      return;
    }
    setAudioUploading(true);
    try {
      const asset = await uploadAsset(file, { kind: "audio" });
      const track: Track & { assetId?: string } = {
        id: asset.id,
        title: asset.original_name || file.name,
        artist: "Your audio",
        kind: "audio",
        stream: asset.content_url ?? undefined,
        assetId: String(asset.id),
      };
      const duration = await readAudioDuration(file).catch(() => 0);
      await openTrim(track, duration);
    } catch (cause) {
      toast({
        title: "That audio did not upload",
        description: errorMessage(cause),
        tone: "error",
      });
    } finally {
      setAudioUploading(false);
    }
  }

  function pickTrack(track: Track) {
    void openTrim(track);
  }

  function applyTrim() {
    if (!trimTrack || !trimDurationMs) return;
    const start = clamp(
      Math.round(trimStartMs),
      0,
      Math.max(0, trimDurationMs - Math.min(trimWindowMs, trimDurationMs)),
    );
    const end = clamp(
      Math.round(trimEndMs || trimDurationMs),
      Math.min(trimDurationMs, start + trimWindowMs),
      trimDurationMs,
    );
    commit(
      (current) => ({
        ...current,
        audio: trimTrack,
        audioStartMs: start,
        audioEndMs: end,
      }),
      true,
    );
    setTrimOpen(false);
    setTrimWindowOpen(false);
    setTrimTrack(null);
    setTrimLoading(false);
    trimDragRef.current = null;
    previewingRef.current = true;
  }

  function chooseTrimWindow(next: number) {
    const limit = Math.max(0, trimDurationMs);
    const start = clamp(trimStartMs, 0, Math.max(0, limit - next));
    setTrimStartMs(start);
    setTrimWindowMs(next);
    setTrimEndMs(Math.min(limit, start + next));
    setTrimWindowOpen(false);
  }

  function trimPointerMs(event: ReactPointerEvent<HTMLElement>) {
    const rect =
      trimWaveRef.current?.getBoundingClientRect() ??
      trimStripRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    const limit = Math.max(0, trimDurationMs);
    return (
      clamp((event.clientX - rect.left) / Math.max(1, rect.width), 0, 1) *
      limit
    );
  }

  function updateTrim(which: "start" | "end" | "head", value: number) {
    const limit = Math.max(0, trimDurationMs);
    const minGap = Math.min(1000, limit);
    if (which === "head") {
      const next = clamp(value, trimStartMs, trimEndMs || limit);
      player.seek(next / 1000);
      return;
    }
    if (which === "start") {
      const nextStart = clamp(value, 0, Math.max(0, limit - trimWindowMs));
      setTrimStartMs(nextStart);
      setTrimEndMs(Math.min(limit, nextStart + trimWindowMs));
      return;
    }
    setTrimEndMs(
      clamp(
        value,
        Math.min(limit, trimStartMs + minGap),
        Math.min(limit, trimStartMs + trimWindowMs),
      ),
    );
  }

  function beginTrimDrag(
    which: "start" | "end" | "head" | "window",
    event: ReactPointerEvent<HTMLElement>,
  ) {
    if (!trimDurationMs) return;
    event.preventDefault();
    event.stopPropagation();
    trimDragRef.current = which;
    if (which === "window") {
      trimDragOffsetRef.current = trimPointerMs(event) - trimStartMs;
    } else {
      updateTrim(which, trimPointerMs(event));
    }
    trimStripRef.current?.setPointerCapture?.(event.pointerId);
  }

  function moveTrimDrag(event: ReactPointerEvent<HTMLElement>) {
    const which = trimDragRef.current;
    if (!which) return;
    if (which === "window") {
      const limit = Math.max(0, trimDurationMs);
      const length = Math.min(
        Math.max(1000, trimEndMs - trimStartMs || trimWindowMs),
        limit,
      );
      const start = clamp(
        trimPointerMs(event) - trimDragOffsetRef.current,
        0,
        Math.max(0, limit - length),
      );
      setTrimStartMs(start);
      setTrimEndMs(Math.min(limit, start + length));
      return;
    }
    updateTrim(which, trimPointerMs(event));
  }

  function endTrimDrag() {
    trimDragRef.current = null;
  }

  function rememberSaved(track: Track, liked: boolean) {
    const id = String(track.id);
    setSavedTracks((current) => {
      if (!liked) return current.filter((item) => String(item.id) !== id);
      if (current.some((item) => String(item.id) === id)) return current;
      return [{ ...track, liked: true }, ...current];
    });
  }

  function likeCandidates(track: Track) {
    const id = String(track.id);
    const found: Track[] = [];
    const seen = new Set<string>([id]);
    const add = (row: Track | null | undefined) => {
      if (!row) return;
      const rowId = String(row.id);
      if (seen.has(rowId)) return;
      seen.add(rowId);
      found.push(row);
    };
    [...audioAll, ...savedTracks, ...audioResults].forEach((row) => {
      if (sameTrack(row, track)) add(row);
    });
    const streamId = streamTrackId(track);
    if (streamId) add({ ...track, id: streamId });
    return found;
  }

  async function toggleTrackLike(track: Track) {
    const id = String(track.id);
    if (likeBusy === id) return;
    const wasLiked = isTrackLiked(track);
    const wantLiked = !wasLiked;
    setLikeBusy(id);
    setLikedTracks((current) => ({ ...current, [id]: wantLiked }));
    rememberSaved(track, wantLiked);
    try {
      const dropId = streamDropId(track);
      if (dropId) {
        const answer = await api.post<DropSaveResponse>(
          `/drops/${dropId}/save/`,
          { on: wantLiked },
        );
        const nowLiked =
          typeof answer?.saved === "boolean" ? answer.saved : wantLiked;
        setLikedTracks((current) => ({ ...current, [id]: nowLiked }));
        rememberSaved(track, nowLiked);
        return;
      }
      let target = track;
      let result: AudioLikeResponse | null = null;
      try {
        result = await api.post<AudioLikeResponse>(
          `/audio/tracks/${target.id}/like/`,
        );
      } catch (cause) {
        if (!(cause instanceof ApiError) || cause.status !== 404) throw cause;
        const candidates: Track[] = [];
        const candidateIds = new Set<string>([id]);
        const addCandidate = (row: Track | null | undefined) => {
          if (!row) return;
          const rowId = String(row.id);
          if (candidateIds.has(rowId)) return;
          candidateIds.add(rowId);
          candidates.push(row);
        };
        likeCandidates(track).forEach(addCandidate);
        const catalogue = await fetchAllAudioTracks(null).catch(() => []);
        catalogue.filter((row) => sameTrack(row, track)).forEach(addCandidate);
        const searched = await findAudioTrack(track).catch(() => null);
        addCandidate(searched);
        let resolved = false;
        for (const candidate of candidates) {
          if (
            typeof candidate.liked === "boolean" &&
            candidate.liked === wantLiked
          ) {
            target = candidate;
            result = null;
            resolved = true;
            break;
          }
          try {
            result = await api.post<AudioLikeResponse>(
              `/audio/tracks/${candidate.id}/like/`,
            );
            target = candidate;
            resolved = true;
            break;
          } catch (next) {
            if (!(next instanceof ApiError) || next.status !== 404) throw next;
          }
        }
        if (!resolved) throw cause;
      }
      const answer = result?.liked ?? result?.data?.liked;
      const nowLiked = typeof answer === "boolean" ? answer : wantLiked;
      const targetId = String(target.id);
      setLikedTracks((current) => ({
        ...current,
        [id]: targetId === id ? nowLiked : false,
        [targetId]: nowLiked,
      }));
      if (targetId !== id) {
        rememberSaved(track, false);
        setAudioAll((current) =>
          current.map((row) =>
            String(row.id) === id ? { ...target, liked: nowLiked } : row,
          ),
        );
        setAudioResults((current) =>
          current.map((row) =>
            String(row.id) === id ? { ...target, liked: nowLiked } : row,
          ),
        );
      }
      rememberSaved(target, nowLiked);
    } catch (cause) {
      setLikedTracks((current) => ({ ...current, [id]: wasLiked }));
      rememberSaved(track, wasLiked);
      toast({
        title: "That save did not stick",
        description: errorMessage(cause),
        tone: "error",
      });
    } finally {
      setLikeBusy(null);
    }
  }

  const homeTracks = (() => {
    const rows = [
      ...(audioHome?.recent ?? []),
      ...(audioHome?.podcasts ?? []),
      ...(audioHome?.hero ? [audioHome.hero] : []),
    ];
    const seen = new Set<string>();
    return rows.filter((track) => {
      const id = String(track.id);
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  })();
  const allTracks =
    audioAll.length || audioAllLoading ? audioAll : homeTracks;
  const hasAudioQuery = Boolean(audioQuery.trim());
  const visibleTracks = hasAudioQuery
    ? audioResults.filter(
        (track) => audioTab !== "saved" || isTrackLiked(track),
      )
    : audioTab === "saved"
      ? savedTracks.filter((track) => isTrackLiked(track))
      : audioTab === "trending"
        ? audioHome?.recent?.length
          ? audioHome.recent
          : allTracks
        : allTracks;
  const audioListLoading =
    (hasAudioQuery && audioLoading) ||
    (audioTab === "saved" && savedLoading && !savedTracks.length) ||
    (audioTab === "all" &&
      !hasAudioQuery &&
      audioAllLoading &&
      !audioAll.length);
  const heroTrack = audioHome?.hero ?? null;
  const heroTracks = (() => {
    const rows = [heroTrack, ...visibleTracks].filter((track): track is Track =>
      Boolean(track),
    );
    const seen = new Set<string>();
    return rows
      .filter((track) => {
        const id = String(track.id);
        if (seen.has(id)) return false;
        seen.add(id);
        return true;
      })
      .slice(0, 4);
  })();
  const activeHeroIndex = heroTracks[audioHeroIndex] ? audioHeroIndex : 0;
  const featuredTrack = heroTracks[activeHeroIndex] ?? null;
  const trimDurationSec = trimDurationMs / 1000;
  const trimLimitMs = Math.max(1, trimDurationMs);
  const trimTrackWidth = Math.max(320, trimDurationSec * 5);
  const trimStartPct = (trimStartMs / trimLimitMs) * 100;
  const trimEndPct = (trimEndMs / trimLimitMs) * 100;
  const trimPlaying =
    Boolean(trimTrack) &&
    player.current?.id === trimTrack?.id &&
    player.playing;
  const trimHeadMs =
    trimTrack && player.current?.id === trimTrack.id
      ? clamp(player.time * 1000, 0, trimDurationMs)
      : trimStartMs;
  const trimHeadPct = clamp((trimHeadMs / trimLimitMs) * 100, 0, 100);
  const trimSeed = Number(trimTrack?.seed ?? trimTrack?.id ?? 1) || 1;
  const trimBarCount = Math.max(
    72,
    Math.min(1600, Math.ceil(trimTrackWidth / 2.5)),
  );
  const trimWave = Array.from({ length: trimBarCount }, (_, index) => {
    const position = index / Math.max(1, trimBarCount - 1);
    const envelope = Math.pow(Math.sin(Math.PI * position), 0.35);
    const pulse =
      0.5 + 0.5 * Math.abs(Math.sin((index + 1) * 0.71 + trimSeed * 0.37));
    const detail =
      0.3 + 0.7 * Math.abs(Math.sin((index + 1) * 0.23 + trimSeed));
    return 18 + envelope * (0.38 + 0.62 * pulse) * detail * 74;
  });
  const trimLabelStepSec = trimDurationSec > 300 ? 30 : 10;
  const trimLabels = (() => {
    if (!trimDurationSec) return [0];
    const values: number[] = [];
    for (
      let second = 0;
      second <= trimDurationSec;
      second += trimLabelStepSec
    ) {
      values.push(second);
    }
    const end = Math.round(trimDurationSec);
    if (values[values.length - 1] < end) values.push(end);
    return values;
  })();

  useEffect(() => {
    if (!trimOpen || !trimTrack) return;
    const scroller = trimScrollRef.current;
    const wave = trimWaveRef.current;
    if (!scroller || !wave) return;
    const viewport = scroller.getBoundingClientRect();
    const track = wave.getBoundingClientRect();
    const focusPct =
      trimDragRef.current === "window"
        ? (trimStartPct + trimEndPct) / 2
        : !player.playing
          ? trimStartPct
          : trimHeadPct;
    const focusX = track.left - viewport.left + (focusPct / 100) * track.width;
    const edge = 44;
    if (focusX < edge) {
      scroller.scrollLeft = Math.max(0, scroller.scrollLeft + focusX - edge);
    } else if (focusX > viewport.width - edge) {
      scroller.scrollLeft += focusX - (viewport.width - edge);
    }
  }, [
    player.playing,
    trimEndPct,
    trimHeadPct,
    trimOpen,
    trimStartPct,
    trimTrack,
  ]);

  const railActions: Record<
    Exclude<Tool, null>,
    { label: string; icon: ReactNode; action: () => void }
  > = {
    frame: {
      label: "Frame",
      icon: <Frame className="size-6" />,
      action: () => setTool((value) => (value === "frame" ? null : "frame")),
    },
    audio: {
      label: "Audio",
      icon: <Music2 className="size-6" />,
      action: () => {
        setTool("audio");
        setAudioOpen(true);
      },
    },
    tag: {
      label: "Tag",
      icon: <AtSign className="size-6" />,
      action: () => {
        setTool("tag");
        setTagOpen(true);
      },
    },
    filter: {
      label: "Filter",
      icon: <SlidersHorizontal className="size-6" />,
      action: () => setTool((value) => (value === "filter" ? null : "filter")),
    },
    text: {
      label: "Text",
      icon: <Type className="size-6" />,
      action: () => {
        if (tool === "text") {
          setTool(null);
          return;
        }
        setTool("text");
        setSubtool((value) => value ?? "font");
      },
    },
    draw: {
      label: "Draw",
      icon: <Pencil className="size-6" />,
      action: () => setTool((value) => (value === "draw" ? null : "draw")),
    },
    cutout: {
      label: "Cut out",
      icon: <Lasso className="size-6" />,
      action: () => {
        setTool("cutout");
        setLassoDraft([]);
        setKeepInside(true);
      },
    },
    sticker: {
      label: "Sticker",
      icon: <Sticker className="size-6" />,
      action: () => {
        setSelectedLayerId(null);
        setTool("sticker");
        setStickerTab("mention");
        setStickerOpen(true);
      },
    },
    image: {
      label: "Image",
      icon: <ImagePlus className="size-6" />,
      action: () => {
        setSelectedLayerId(null);
        setTool("image");
        imageInputRef.current?.click();
      },
    },
    crop: {
      label: "Crop",
      icon: <Crop className="size-6" />,
      action: () => setTool("crop"),
    },
    turn: {
      label: "Turn",
      icon: <RotateCw className="size-6" />,
      action: () => {
        turnImage();
        setTool(null);
      },
    },
    aura: {
      label: "Aura",
      icon: <Sparkles className="size-6" />,
      action: () => setTool((value) => (value === "aura" ? null : "aura")),
    },
  };
  const railOrder: Exclude<Tool, null>[] =
    mode === "edit"
      ? [
          "frame",
          "audio",
          "tag",
          "filter",
          "text",
          "draw",
          "cutout",
          "sticker",
          "image",
          "crop",
          "turn",
          "aura",
        ]
      : ["filter", "audio", "tag", "text", "draw"];
  const railItems = railOrder.map((key) => ({ key, ...railActions[key] }));

  function stopPreview() {
    if (!previewingRef.current) return;
    previewingRef.current = false;
    closePlayer();
  }

  function cancelEditor() {
    stopPreview();
    onCancel();
  }

  function finishEditor() {
    stopPreview();
    if (mode === "moment") onPost?.(doc);
    else onDone(doc);
  }

  function stopPosting() {
    stopPreview();
    onStop?.();
  }

  return (
    <div className="absolute inset-0 z-[75] flex flex-col bg-page text-ink">
      <header className="flex items-center justify-between px-3 pb-1 pt-[max(10px,env(safe-area-inset-top))]">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={cancelEditor}
            className="flex size-10 items-center justify-center rounded-full bg-black/65 text-white backdrop-blur"
            aria-label="Close editor"
          >
            <X className="size-5" />
          </button>
          {tool ? (
            <button
              type="button"
              onClick={exitTool}
              className="flex size-11 items-center justify-center rounded-full bg-black/35 text-white backdrop-blur"
              aria-label="Back"
            >
              <ArrowLeft className="size-5" />
            </button>
          ) : null}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={undo}
            disabled={historyCount === 0}
            className="flex size-10 items-center justify-center rounded-full bg-black/35 text-white/80 backdrop-blur disabled:opacity-30"
            aria-label="Undo"
          >
            <Undo2 className="size-5" />
          </button>
          <button
            type="button"
            onClick={cropMode ? applyCrop : finishEditor}
            disabled={posting}
            className="rounded-full bg-accent px-4 py-2 text-[14px] font-extrabold text-on-accent disabled:opacity-40"
          >
            {cropMode ? "Use it" : mode === "moment" ? "Moment" : "Done"}{" "}
            <span aria-hidden>&rarr;</span>
          </button>
        </div>
      </header>

      <div
        ref={wrapRef}
        className="relative flex min-h-0 flex-1 items-center justify-center"
      >
        <div
          ref={stageRef}
          onPointerDown={beginPan}
          onPointerMove={movePan}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          className={cn(
            "relative overflow-hidden bg-black",
            tool === "frame" && mode === "edit" ? "cursor-move touch-none" : "",
          )}
          style={{ width: stageBox.width, height: stageBox.height }}
        >
          {cutoutPath ? (
            <svg className="pointer-events-none absolute size-0" aria-hidden>
              <defs>
                <clipPath id={clipId} clipPathUnits="objectBoundingBox">
                  <path d={cutoutPath} clipRule="evenodd" />
                </clipPath>
              </defs>
            </svg>
          ) : null}

          {sourceSize ? (
            <div className="absolute inset-0" style={{ clipPath: cutoutClip }}>
              <div
                className="absolute origin-top-left"
                style={{
                  width: previewSource.width,
                  height: previewSource.height,
                  transform: previewTransform,
                }}
              >
                {shot.kind === "video" ? (
                  <video
                    src={shot.url}
                    autoPlay
                    loop
                    playsInline
                    muted
                    className="absolute left-0 top-0 max-w-none"
                    style={{
                      width: sourceSize.width,
                      height: sourceSize.height,
                      transform: turnTransform,
                      transformOrigin: "0 0",
                      filter: previewFilter,
                    }}
                  />
                ) : (
                  <img
                    src={shot.url}
                    alt="Your shot"
                    draggable={false}
                    className="absolute left-0 top-0 max-w-none select-none"
                    style={{
                      width: sourceSize.width,
                      height: sourceSize.height,
                      transform: turnTransform,
                      transformOrigin: "0 0",
                      filter: previewFilter,
                    }}
                  />
                )}
              </div>
            </div>
          ) : shot.kind === "video" ? (
            <video
              src={shot.url}
              autoPlay
              loop
              playsInline
              muted
              className="absolute inset-0 size-full object-cover"
              style={{ filter: previewFilter }}
            />
          ) : (
            <img
              src={shot.url}
              alt="Your shot"
              draggable={false}
              className="absolute inset-0 size-full select-none object-cover"
              style={{ filter: previewFilter }}
            />
          )}

          <div className="pointer-events-none absolute inset-0 z-10 [&_*]:!pointer-events-none">
            {baseOverlay}
          </div>

          <svg
            className="pointer-events-none absolute inset-0 z-20 size-full"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            aria-hidden
          >
            {doc.strokes.map((stroke, index) => (
              <polyline
                key={index}
                points={stroke.points
                  .map((point) => `${point.x * 100},${point.y * 100}`)
                  .join(" ")}
                fill="none"
                stroke={stroke.color}
                strokeWidth={Math.max(1, stroke.width * stageBox.width)}
                strokeLinecap="round"
                strokeLinejoin="round"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>

          {doc.texts.map((text) => {
            const font = fontByKey(text.font);
            const background =
              text.background === "none"
                ? "transparent"
                : colorOf(EDIT_BACKGROUNDS, text.background);
            const outline = outlineColor(text.outline);
            return (
              <div
                key={text.id}
                onPointerDown={(event) => beginTextDrag(text.id, event)}
                onPointerMove={moveTextDrag}
                onPointerUp={endTextDrag}
                onPointerCancel={endTextDrag}
                className={cn(
                  "absolute z-30 max-w-[92%] cursor-move touch-none select-none whitespace-pre-wrap leading-tight",
                  selectedId === text.id &&
                    "outline outline-2 outline-offset-4 outline-[var(--accent)]",
                )}
                style={{
                  left: `${text.x * 100}%`,
                  top: `${text.y * 100}%`,
                  transform: `translate(${text.align === "left" ? "0" : text.align === "right" ? "-100%" : "-50%"}, -50%) rotate(${text.rotation}deg)`,
                  color: text.color,
                  fontFamily: font.css,
                  fontWeight: font.weight,
                  fontSize: `${text.size * scale}px`,
                  textAlign: text.align,
                  background,
                  padding:
                    background !== "transparent"
                      ? `${0.12 * text.size * scale}px ${0.28 * text.size * scale}px`
                      : undefined,
                  borderRadius:
                    background !== "transparent"
                      ? `${0.3 * text.size * scale}px`
                      : undefined,
                  WebkitTextStroke:
                    outline !== "transparent"
                      ? `${Math.max(1, 0.035 * text.size * scale)}px ${outline}`
                      : undefined,
                  paintOrder: "stroke fill",
                  border: text.box
                    ? `${Math.max(1, 0.03 * text.size * scale)}px solid rgba(255,255,255,.9)`
                    : undefined,
                  textShadow:
                    outline === "#000000"
                      ? "0 2px 6px rgba(0,0,0,.6)"
                      : undefined,
                }}
              >
                {text.value || " "}
              </div>
            );
          })}

          {doc.layers.map((layer) => {
            const size = layerSize(layer, stageBox.width, stageBox.height);
            return (
              <div
                key={layer.id}
                onPointerDown={(event) => beginLayerDrag(layer.id, event)}
                onPointerMove={moveLayerDrag}
                onPointerUp={endLayerDrag}
                onPointerCancel={endLayerDrag}
                className={cn(
                  "absolute z-30 cursor-move touch-none select-none",
                  selectedLayerId === layer.id &&
                    "outline outline-2 outline-offset-4 outline-[var(--accent)]",
                )}
                style={{
                  left: `${layer.x * 100}%`,
                  top: `${layer.y * 100}%`,
                  width: size.width,
                  height: size.height,
                  transform: `translate(-50%, -50%) rotate(${layer.rotation}deg)`,
                }}
              >
                <img
                  src={layer.src}
                  alt={layer.name || ""}
                  draggable={false}
                  className="size-full object-contain"
                />
              </div>
            );
          })}

          {tool === "cutout" ? (
            <div
              className="absolute inset-0 z-40 touch-none"
              onPointerDown={beginLasso}
              onPointerMove={moveLasso}
              onPointerUp={endLasso}
              onPointerCancel={endLasso}
            >
              <svg
                className="pointer-events-none absolute inset-0 size-full"
                viewBox="0 0 100 100"
                preserveAspectRatio="none"
                aria-hidden
              >
                {lassoDraft.length > 1 ? (
                  <polyline
                    points={lassoDraft
                      .map((point) => `${point.x * 100},${point.y * 100}`)
                      .join(" ")}
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth={2}
                    strokeDasharray="5 3"
                    vectorEffect="non-scaling-stroke"
                  />
                ) : null}
              </svg>
            </div>
          ) : null}

          {cropMode ? (
            <div className="pointer-events-none absolute inset-0 z-50">
              <div
                className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,.45)]"
                style={{
                  left: `${cropDraft.x * 100}%`,
                  top: `${cropDraft.y * 100}%`,
                  width: `${cropDraft.w * 100}%`,
                  height: `${cropDraft.h * 100}%`,
                }}
              >
                {(["nw", "ne", "sw", "se"] as const).map((corner) => (
                  <button
                    key={corner}
                    type="button"
                    onPointerDown={(event) => beginCropDrag(corner, event)}
                    onPointerMove={moveCropDrag}
                    onPointerUp={endCropDrag}
                    onPointerCancel={endCropDrag}
                    className={cn(
                      "pointer-events-auto absolute size-4 rounded-full border-2 border-black bg-white",
                      corner === "nw" && "left-0 top-0 cursor-nwse-resize",
                      corner === "ne" && "right-0 top-0 cursor-nesw-resize",
                      corner === "sw" && "bottom-0 left-0 cursor-nesw-resize",
                      corner === "se" && "bottom-0 right-0 cursor-nwse-resize",
                    )}
                    aria-label={`Crop ${corner}`}
                  />
                ))}
              </div>
            </div>
          ) : null}

          {tool === "draw" ? (
            <div
              className="absolute inset-0 z-40 touch-none"
              onPointerDown={beginDraw}
              onPointerMove={moveDraw}
              onPointerUp={endDraw}
              onPointerCancel={endDraw}
            />
          ) : null}

          {tool === "frame" && mode === "edit" ? (
            <div
              role="group"
              aria-label="Frame controls"
              className="absolute inset-x-3 bottom-3 z-50 flex items-center justify-between gap-2"
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div className="flex items-center gap-1">
                {FRAMES.map((frame) => {
                  const selected = doc.frame === frame.key;
                  return (
                    <button
                      key={frame.key}
                      type="button"
                      onClick={() =>
                        commit(
                          (current) => ({ ...current, frame: frame.key }),
                          true,
                        )
                      }
                      aria-pressed={selected}
                      className={cn(
                        "rounded-full px-2.5 py-1.5 text-[9px] font-extrabold",
                        selected
                          ? "bg-card text-ink"
                          : "bg-black/30 text-white/85",
                      )}
                    >
                      {frame.label}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() =>
                    commit(
                      (current) => ({
                        ...current,
                        zoom: clamp(current.zoom - 0.1, 1, 3),
                      }),
                      true,
                    )
                  }
                  className="flex h-[27px] w-[27px] items-center justify-center rounded-full bg-black/30 text-white"
                  aria-label="Zoom out"
                >
                  <Minus className="size-3.5" />
                </button>
                <span className="min-w-9 text-center text-[9px] font-extrabold tabular-nums text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.9)]">
                  {doc.zoom.toFixed(2)}x
                </span>
                <button
                  type="button"
                  onClick={() =>
                    commit(
                      (current) => ({
                        ...current,
                        zoom: clamp(current.zoom + 0.1, 1, 3),
                      }),
                      true,
                    )
                  }
                  className="flex h-[27px] w-[27px] items-center justify-center rounded-full bg-black/30 text-white backdrop-blur-sm"
                  aria-label="Zoom in"
                >
                  <Plus className="size-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    commit(
                      (current) => ({ ...current, fit: !current.fit }),
                      true,
                    )
                  }
                  className="rounded-full ml-2 bg-black/30 px-2.5 py-1.5 text-[9px] font-extrabold text-white/85 backdrop-blur-sm"
                >
                  {doc.fit ? "Fill" : "Fit"}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div
        className="absolute left-1/2 z-50 w-full -translate-x-1/2"
        style={{ bottom: 78, width: stageBox.width || undefined }}
      >
        {tool === "filter" ? (
          <section className="mx-3 mb-2 rounded-[22px] bg-[#171316]/95 px-3 py-3 text-white shadow-2xl backdrop-blur">
            <div className="flex gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {EDIT_FILTERS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  onClick={() =>
                    commit(
                      (current) => ({ ...current, filter: filter.key }),
                      true,
                    )
                  }
                  className="flex w-[58px] shrink-0 flex-col items-center gap-1 text-[9px] font-bold text-white"
                >
                  <span
                    className={cn(
                      "flex size-12 overflow-hidden rounded-full border-2",
                      doc.filter === filter.key
                        ? "border-accent"
                        : "border-white/30",
                    )}
                  >
                    {shot.kind === "video" ? (
                      <video
                        src={shot.url}
                        muted
                        playsInline
                        className="size-full object-cover"
                        style={{ filter: filter.css }}
                      />
                    ) : (
                      <img
                        src={shot.url}
                        alt=""
                        className="size-full object-cover"
                        style={{ filter: filter.css }}
                      />
                    )}
                  </span>
                  <span
                    className={
                      doc.filter === filter.key ? "text-white" : "text-white/70"
                    }
                  >
                    {filter.label}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {tool === "text" ? (
          <section className="mx-3 mb-2 max-h-[42dvh] overflow-y-auto rounded-[22px] bg-[#171316]/95 p-3 text-white shadow-2xl backdrop-blur">
            {selectedText ? (
              <div className="mb-2 flex items-center gap-2">
                <input
                  ref={textInputRef}
                  value={selectedText.value}
                  onChange={(event) =>
                    updateText(
                      selectedText.id,
                      { value: event.target.value },
                      false,
                    )
                  }
                  onFocus={() => {
                    if (skipFocusHistoryRef.current) {
                      skipFocusHistoryRef.current = false;
                      return;
                    }
                    pushHistory(docRef.current);
                  }}
                  placeholder="Type something"
                  maxLength={140}
                  className="h-11 min-w-0 flex-1 rounded-2xl border-2 border-accent bg-white/5 px-4 text-[16px] font-semibold outline-none placeholder:text-white/35"
                  style={{
                    color: selectedText.color,
                    fontFamily: fontByKey(selectedText.font).css,
                  }}
                />
                <button
                  type="button"
                  onClick={() =>
                    updateText(selectedText.id, {
                      rotation: selectedText.rotation - 15,
                    })
                  }
                  className="flex size-10 items-center justify-center rounded-full bg-white/10"
                  aria-label="Rotate text left"
                >
                  <RotateCcw className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateText(selectedText.id, {
                      rotation: selectedText.rotation + 15,
                    })
                  }
                  className="flex size-10 items-center justify-center rounded-full bg-white/10"
                  aria-label="Rotate text right"
                >
                  <RotateCw className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteText(selectedText.id)}
                  className="flex size-10 items-center justify-center rounded-full bg-white/10 text-accent"
                  aria-label="Delete text"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ) : null}

            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                onClick={addText}
                className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-[13px] font-extrabold text-on-accent"
              >
                <Plus className="size-4" /> Aa
              </button>
              {EDIT_FONTS.map((font) => (
                <button
                  key={font.key}
                  type="button"
                  onClick={() => {
                    if (selectedText)
                      updateText(selectedText.id, { font: font.key });
                    else setDefaultFont(font.key);
                  }}
                  className={cn(
                    "shrink-0 rounded-full border px-4 py-2 text-[14px]",
                    (
                      selectedText
                        ? selectedText.font === font.key
                        : defaultFont === font.key
                    )
                      ? "border-white bg-white/10 text-white"
                      : "border-white/25 text-white/80",
                  )}
                  style={{ fontFamily: font.css, fontWeight: font.weight }}
                >
                  {font.label}
                </button>
              ))}
            </div>

            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  selectedText &&
                  updateText(selectedText.id, {
                    size: clamp(selectedText.size - 3, 12, 90),
                  })
                }
                className="flex size-9 items-center justify-center rounded-full bg-white/10 text-[11px] font-black"
                aria-label="Smaller text"
              >
                Tt
              </button>
              <input
                type="range"
                min={12}
                max={90}
                value={selectedText?.size ?? 34}
                onPointerDown={() => pushHistory(docRef.current)}
                onChange={(event) =>
                  selectedText &&
                  updateText(
                    selectedText.id,
                    { size: Number(event.target.value) },
                    false,
                  )
                }
                className="min-w-0 flex-1 accent-[var(--accent)]"
                aria-label="Text size"
              />
              <button
                type="button"
                onClick={() =>
                  selectedText &&
                  updateText(selectedText.id, {
                    size: clamp(selectedText.size + 3, 12, 90),
                  })
                }
                className="flex size-9 items-center justify-center rounded-full bg-white/10 text-[11px] font-black"
                aria-label="Larger text"
              >
                A+
              </button>
            </div>

            <div className="mt-2 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {[
                {
                  key: "font" as const,
                  label: "Font",
                  icon: <Type className="size-4" />,
                },
                {
                  key: "color" as const,
                  label: "Color",
                  icon: <Palette className="size-4" />,
                },
                {
                  key: "background" as const,
                  label: "Background",
                  icon: <PaintBucket className="size-4" />,
                },
                {
                  key: "outline" as const,
                  label: "Outline",
                  icon: <Circle className="size-4" />,
                },
                {
                  key: "align" as const,
                  label: "Align",
                  icon: <AlignCenter className="size-4" />,
                },
                {
                  key: "box" as const,
                  label: "Text box",
                  icon: <Square className="size-4" />,
                },
                {
                  key: "style" as const,
                  label: "Style",
                  icon: <Sparkles className="size-4" />,
                },
              ].map((item) => (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => {
                    if (!selectedText && item.key !== "font") {
                      toast({ title: "Add text first.", tone: "info" });
                      return;
                    }
                    setSubtool(item.key);
                  }}
                  className={cn(
                    "flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-[11px] font-extrabold",
                    subtool === item.key
                      ? "bg-card text-ink"
                      : "bg-white/10 text-white/75",
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>

            {subtool === "color" && selectedText ? (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {EDIT_TEXT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => updateText(selectedText.id, { color })}
                    aria-label={`Use ${color}`}
                    className={cn(
                      "size-9 shrink-0 rounded-full border-2",
                      selectedText.color === color
                        ? "border-accent ring-2 ring-white/60"
                        : "border-white/35",
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            ) : null}

            {subtool === "background" && selectedText ? (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {EDIT_BACKGROUNDS.map((background) => (
                  <button
                    key={background.key}
                    type="button"
                    onClick={() =>
                      updateText(selectedText.id, {
                        background: background.key,
                      })
                    }
                    className={cn(
                      "flex h-9 shrink-0 items-center justify-center rounded-full border px-3 text-[10px] font-extrabold",
                      selectedText.background === background.key
                        ? "border-accent text-white"
                        : "border-white/25 text-white/70",
                    )}
                    style={{ backgroundColor: background.value }}
                  >
                    {background.label}
                  </button>
                ))}
              </div>
            ) : null}

            {subtool === "outline" && selectedText ? (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {EDIT_OUTLINES.map((outline) => (
                  <button
                    key={outline.key}
                    type="button"
                    onClick={() =>
                      updateText(selectedText.id, { outline: outline.key })
                    }
                    className={cn(
                      "flex h-9 shrink-0 items-center justify-center rounded-full border px-3 text-[10px] font-extrabold",
                      selectedText.outline === outline.key
                        ? "border-accent text-white"
                        : "border-white/25 text-white/70",
                    )}
                    style={{ backgroundColor: outline.value }}
                  >
                    {outline.label}
                  </button>
                ))}
              </div>
            ) : null}

            {subtool === "align" && selectedText ? (
              <div className="mt-3 flex gap-2">
                {(["left", "center", "right"] as const).map((align) => (
                  <button
                    key={align}
                    type="button"
                    onClick={() => updateText(selectedText.id, { align })}
                    className={cn(
                      "flex-1 rounded-full px-3 py-2 text-[11px] font-extrabold capitalize",
                      selectedText.align === align
                        ? "bg-card text-ink"
                        : "bg-white/10 text-white/75",
                    )}
                  >
                    {align}
                  </button>
                ))}
              </div>
            ) : null}

            {subtool === "box" && selectedText ? (
              <button
                type="button"
                onClick={() =>
                  updateText(selectedText.id, { box: !selectedText.box })
                }
                className={cn(
                  "mt-3 w-full rounded-full px-3 py-2 text-[11px] font-extrabold",
                  selectedText.box
                    ? "bg-card text-ink"
                    : "bg-white/10 text-white/75",
                )}
              >
                {selectedText.box ? "Text box on" : "Text box off"}
              </button>
            ) : null}

            {subtool === "style" && selectedText ? (
              <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
                {EDIT_TEXT_STYLES.map((style) => (
                  <button
                    key={style.key}
                    type="button"
                    onClick={() =>
                      updateText(selectedText.id, {
                        color: style.color,
                        background: style.background,
                        outline: style.outline,
                        box: style.box,
                      })
                    }
                    className="shrink-0 rounded-full border border-white/25 bg-white/5 px-3 py-2 text-[11px] font-extrabold text-white/80"
                  >
                    {style.label}
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {tool === "audio" && !audioOpen ? (
          <section className="mx-3 mb-2 rounded-lg bg-[#171316]/15 px-3 py-2 text-white shadow-lg backdrop-blur">
            {doc.audio ? (
              <div className="flex items-center gap-3">
                <AudioArt
                  track={doc.audio}
                  className="size-10 rounded-full"
                  iconClassName="size-4"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-extrabold">
                    {doc.audio.title}
                  </span>
                  <span className="block truncate text-[10px] text-white/50">
                    {doc.audio.artist}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setAudioOpen(true)}
                  className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-extrabold"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={() => {
                    stopPreview();
                    commit((current) => ({ ...current, audio: null }), true);
                  }}
                  className="flex size-9 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-300"
                  aria-label="Remove audio"
                >
                  <Trash2 className="size-4" />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="min-w-0 flex-1 text-[12px] font-bold text-white/70">
                  No audio on this moment yet.
                </span>
                <button
                  type="button"
                  onClick={() => setAudioOpen(true)}
                  className="rounded-full bg-accent px-4 py-2 text-[11px] font-extrabold text-on-accent"
                >
                  Add audio
                </button>
              </div>
            )}
          </section>
        ) : null}

        {tool === "tag" && !tagOpen ? (
          <section className="mx-3 mb-2 rounded-[22px] bg-[#171316]/95 p-3 text-white shadow-2xl backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-[color-mix(in_srgb,var(--accent)_20%,transparent)] text-accent">
                <AtSign className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-extrabold">
                  {doc.people.length}/5 · who you keep or chat with
                </span>
                <span className="block truncate text-[10px] text-white/50">
                  {doc.people.length
                    ? doc.people
                        .map((person) => person.name || person.username)
                        .join(", ")
                    : "Nobody tagged"}
                </span>
              </span>
              <button
                type="button"
                onClick={() => setTagOpen(true)}
                className="rounded-full bg-white/10 px-3 py-1.5 text-[10px] font-extrabold"
              >
                Edit
              </button>
            </div>
          </section>
        ) : null}

        {tool === "draw" ? (
          <section className="mx-3 mb-2 rounded-[22px] bg-[#171316]/95 p-3 text-white shadow-2xl backdrop-blur">
            <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {DRAW_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setDrawColor(color)}
                  className={cn(
                    "size-8 shrink-0 rounded-full border-2",
                    drawColor === color
                      ? "border-accent ring-2 ring-white/60"
                      : "border-white/35",
                  )}
                  style={{ backgroundColor: color }}
                  aria-label={`Draw with ${color}`}
                />
              ))}
            </div>
            <div className="mt-3 flex items-center gap-3">
              <span className="text-[11px] font-extrabold text-white/60">
                Pen
              </span>
              <input
                type="range"
                min={0.004}
                max={0.035}
                step={0.001}
                value={drawWidth}
                onChange={(event) => setDrawWidth(Number(event.target.value))}
                className="min-w-0 flex-1 accent-[var(--accent)]"
                aria-label="Pen size"
              />
              <button
                type="button"
                onClick={() =>
                  commit((current) => ({ ...current, strokes: [] }), true)
                }
                className="shrink-0 text-[12px] font-extrabold text-accent"
              >
                Clear
              </button>
            </div>
          </section>
        ) : null}

        {tool === "cutout" ? (
          <section className="mx-3 mb-2 rounded-[22px] bg-[#171316]/95 p-3 text-white shadow-2xl backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1 text-[12px] font-bold text-white/65">
                Keeps what you drew around
              </span>
              <button
                type="button"
                onClick={() => setKeepInside((value) => !value)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-2 text-[11px] font-extrabold",
                  keepInside ? "text-accent" : "text-white/50",
                )}
              >
                Keep inside
              </button>
              <button
                type="button"
                onClick={applyCutout}
                className="shrink-0 rounded-full bg-accent px-4 py-2 text-[11px] font-extrabold text-on-accent"
              >
                Cut
              </button>
            </div>
            {doc.cutout ? (
              <button
                type="button"
                onClick={removeCutout}
                className="mt-2 text-[11px] font-bold text-white/50"
              >
                Remove cut out
              </button>
            ) : null}
          </section>
        ) : null}

        {tool === "crop" ? (
          <section className="mx-3 mb-2 rounded-[22px] bg-[#171316]/95 p-3 text-white shadow-2xl backdrop-blur">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12px] font-bold text-white/65">
                Drag the corners to choose what stays.
              </span>
              <button
                type="button"
                onClick={applyCrop}
                className="shrink-0 rounded-full bg-accent px-4 py-2 text-[11px] font-extrabold text-on-accent"
              >
                Done
              </button>
            </div>
          </section>
        ) : null}

        {tool === "aura" ? (
          <section className="mx-3 mb-2 rounded-[22px] bg-[#171316]/95 px-3 py-3 text-white shadow-2xl backdrop-blur">
            <div className="flex gap-3 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {AURA_FILTERS.map((aura) => (
                <button
                  key={aura.key}
                  type="button"
                  onClick={() =>
                    commit((current) => ({ ...current, aura: aura.key }), true)
                  }
                  className="flex w-[62px] shrink-0 flex-col items-center gap-1 text-[9px] font-bold text-white"
                >
                  <span
                    className={cn(
                      "flex size-12 overflow-hidden rounded-full border-2",
                      doc.aura === aura.key
                        ? "border-accent"
                        : "border-white/30",
                    )}
                  >
                    {shot.kind === "video" ? (
                      <video
                        src={shot.url}
                        autoPlay
                        loop
                        muted
                        playsInline
                        className="size-full object-cover"
                        style={{
                          filter: combinedFilter({ ...doc, aura: aura.key }),
                        }}
                      />
                    ) : (
                      <img
                        src={shot.url}
                        alt=""
                        className="size-full object-cover"
                        style={{
                          filter: combinedFilter({ ...doc, aura: aura.key }),
                        }}
                      />
                    )}
                  </span>
                  <span
                    className={
                      doc.aura === aura.key ? "text-white" : "text-white/70"
                    }
                  >
                    {aura.label}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ) : null}

        {selectedLayer ? (
          <section className="mx-3 mb-2 rounded-[22px] bg-[#171316]/95 p-3 text-white shadow-2xl backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1 truncate text-[12px] font-extrabold">
                {selectedLayer.name ||
                  (selectedLayer.kind === "sticker" ? "Sticker" : "Picture")}
              </span>
              <button
                type="button"
                onClick={() =>
                  updateLayer(selectedLayer.id, {
                    rotation: selectedLayer.rotation - 15,
                  })
                }
                className="flex size-9 items-center justify-center rounded-full bg-white/10"
                aria-label="Rotate layer left"
              >
                <RotateCcw className="size-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  updateLayer(selectedLayer.id, {
                    rotation: selectedLayer.rotation + 15,
                  })
                }
                className="flex size-9 items-center justify-center rounded-full bg-white/10"
                aria-label="Rotate layer right"
              >
                <RotateCw className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => deleteLayer(selectedLayer.id)}
                className="flex size-9 items-center justify-center rounded-full bg-white/10 text-accent"
                aria-label="Delete layer"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-[10px] font-extrabold text-white/55">
                Size
              </span>
              <input
                type="range"
                min={0.4}
                max={3}
                step={0.05}
                value={selectedLayer.scale}
                onPointerDown={() => pushHistory(docRef.current)}
                onChange={(event) =>
                  updateLayer(
                    selectedLayer.id,
                    { scale: Number(event.target.value) },
                    false,
                  )
                }
                className="min-w-0 flex-1 accent-[var(--accent)]"
                aria-label="Layer size"
              />
            </div>
          </section>
        ) : null}
      </div>

      <footer className="z-50 flex h-[78px] shrink-0 gap-2 overflow-x-auto bg-page px-3 pb-[max(10px,env(safe-area-inset-bottom))] pt-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {railItems.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={item.action}
            className={cn(
              "flex min-w-[58px] shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-black/5 text-[10.5px] font-extrabold shadow-sm",
              tool === item.key
                ? "border-accent bg-accent text-on-accent"
                : "bg-card text-ink",
            )}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </footer>

      {tagOpen ? (
        <div
          className="absolute inset-0 z-[80] flex items-end bg-black/55"
          onClick={() => setTagOpen(false)}
        >
          <section
            className="flex max-h-[78%] min-h-[42%] w-full flex-col rounded-t-[30px] bg-card pb-[max(18px,env(safe-area-inset-bottom))] text-ink shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-[color-mix(in_srgb,var(--ink)_15%,transparent)]" />
            <div className="px-5 py-4">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-[19px] font-black">Who is in it</h2>
                  <p className="mt-0.5 text-[11px] font-semibold text-dim">
                    {doc.people.length}/5 · who you keep or chat with
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTagOpen(false)}
                  className="flex size-9 items-center justify-center rounded-full bg-surface-2"
                  aria-label="Close"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="mt-3 flex items-center gap-2 rounded-2xl bg-surface-2 px-3">
                <Search className="size-4 text-dim" />
                <input
                  value={tagQuery}
                  onChange={(event) => setTagQuery(event.target.value)}
                  placeholder="Search people"
                  className="h-11 min-w-0 flex-1 bg-transparent text-[13px] font-semibold outline-none"
                  autoFocus
                />
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3">
              {tagLoading ? (
                <div className="flex justify-center py-10">
                  <Spinner className="size-6 text-accent" />
                </div>
              ) : null}
              {!tagLoading && tagPeople.length === 0 ? (
                <p className="py-10 text-center text-[13px] font-bold text-dim">
                  Nobody to name
                </p>
              ) : null}
              {tagPeople.map((person) => {
                const selected = doc.people.some(
                  (item) => String(item.id) === String(person.id),
                );
                const name = person.name || person.username || "Person";
                return (
                  <button
                    key={String(person.id)}
                    type="button"
                    onClick={() => togglePerson(person)}
                    className="flex w-full items-center gap-3 rounded-2xl px-2 py-2.5 text-left transition hover:bg-surface-2"
                  >
                    <Avatar
                      user={person}
                      name={name}
                      src={person.avatar}
                      size={44}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-extrabold">
                        {name}
                      </span>
                      <span className="block truncate text-[10px] text-dim">
                        @{person.username}
                      </span>
                    </span>
                    <span
                      className={cn(
                        "flex size-7 items-center justify-center rounded-full border-2",
                        selected
                          ? "border-accent bg-accent text-on-accent"
                          : "border-line text-transparent",
                      )}
                    >
                      <Check className="size-4" />
                    </span>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-2 px-5 pt-3">
              {doc.people.length ? (
                <button
                  type="button"
                  onClick={() =>
                    commit((current) => ({ ...current, people: [] }), true)
                  }
                  className="rounded-full bg-surface-2 px-4 py-3 text-[12px] font-extrabold text-dim"
                >
                  Clear
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setTagOpen(false)}
                className="flex-1 rounded-full bg-accent py-3.5 text-[13px] font-extrabold text-on-accent"
              >
                {doc.people.length ? "Done" : "Nobody"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {audioOpen ? (
        <div
          className="absolute inset-0 z-[80] flex items-end bg-black/55"
          onClick={closeAudio}
        >
          <section
            className="flex max-h-[86%] min-h-[52%] w-full flex-col rounded-t-[28px] bg-card pb-[max(8px,env(safe-area-inset-bottom))] text-ink shadow-lg"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mt-1 h-1.5 w-12 rounded-full bg-[color-mix(in_srgb,var(--ink)_15%,transparent)]" />
            <div className="flex items-center justify-between px-5 pb-1">
              <h2 className="text-[24px] font-black tracking-tight">Audio</h2>
              <button
                type="button"
                onClick={() => audioInputRef.current?.click()}
                className="flex size-10 items-center justify-center rounded-full text-ink hover:bg-surface-2"
                aria-label="Upload audio"
              >
                <Plus className="size-5" />
              </button>
            </div>
            <div className="mx-5 mt-1 flex max-h-12 items-center gap-3 rounded-lg border border-line bg-card px-4 py-2 focus-within:ring-1 focus-within:ring-accent">
              <Search className="size-4 shrink-0 text-dim" />
              <input
                value={audioQuery}
                onChange={(event) => setAudioQuery(event.target.value)}
                placeholder="Search..."
                className="h-full min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none placeholder:text-dim"
              />
            </div>
            <div className="mt-2 flex gap-2 px-5">
              {[
                { key: "all" as const, label: "All audio" },
                { key: "trending" as const, label: "Trending" },
                { key: "saved" as const, label: "Saved" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => setAudioTab(tab.key)}
                  className={cn(
                    "h-8 rounded-full px-4 text-[13px] font-extrabold",
                    audioTab === tab.key
                      ? "bg-accent text-on-accent shadow-sm"
                      : "border border-line bg-card text-dim",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {!audioQuery.trim() && audioTab === "all" && featuredTrack ? (
              <>
                <div className="mx-4 mt-2 rounded-lg border border-accent/25 bg-accent-chip px-3 py-1.5">
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        const playing =
                          player.current?.id === featuredTrack.id &&
                          player.playing;
                        if (playing) player.toggle();
                        else previewTrack(featuredTrack);
                      }}
                      className="relative size-[56px] shrink-0 overflow-hidden rounded-xl bg-surface-2 text-ink"
                      aria-label={
                        player.current?.id === featuredTrack.id &&
                        player.playing
                          ? `Pause ${featuredTrack.title}`
                          : `Play ${featuredTrack.title}`
                      }
                    >
                      <AudioArt
                        track={featuredTrack}
                        eager
                        className="size-full"
                      />
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="flex size-10 items-center justify-center rounded-full bg-white/50 shadow-sm">
                          {player.current?.id === featuredTrack.id &&
                          player.playing ? (
                            <Pause className="size-4 fill-current" />
                          ) : (
                            <Play className="size-5 fill-current pl-0.5" />
                          )}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => pickTrack(featuredTrack)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-lg font-black uppercase leading-[1.05] tracking-tight">
                        {featuredTrack.title}
                      </span>
                      <span className="flex items-center gap-1.5 text-sm font-semibold text-dim">
                        <span className="flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded-sm bg-[#1c9bb5] text-white">
                          <Music2 size={9} />
                        </span>
                        <span className="truncate">{featuredTrack.artist}</span>
                      </span>
                      <span className="block text-xs font-medium text-dim">
                        {audioPlays(featuredTrack)} ·{" "}
                        {audioClock(featuredTrack.seconds)}
                      </span>
                    </button>
                  </div>
                </div>
                {heroTracks.length > 1 ? (
                  <div className="mt-2 flex justify-center gap-1.5">
                    {heroTracks.map((track, index) => (
                      <button
                        key={String(track.id)}
                        type="button"
                        onClick={() => setAudioHeroIndex(index)}
                        className={cn(
                          "h-1.5 rounded-full",
                          activeHeroIndex === index
                            ? "w-4 bg-accent"
                            : "w-1.5 bg-line",
                        )}
                        aria-label={`Featured ${index + 1}: ${track.title}`}
                      />
                    ))}
                  </div>
                ) : null}
              </>
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-2 pt-1">
              {audioListLoading ? (
                <div className="flex justify-center py-10">
                  <Spinner className="size-6 text-accent" />
                </div>
              ) : null}
              {!audioListLoading && visibleTracks.length === 0 ? (
                <p className="py-10 text-center text-[13px] font-bold text-dim">
                  {audioTab === "saved"
                    ? "No saved audio yet."
                    : "No audio yet."}
                </p>
              ) : null}
              {visibleTracks.map((track) => {
                const playing =
                  player.current?.id === track.id && player.playing;
                const selected = String(doc.audio?.id) === String(track.id);
                return (
                  <div
                    key={String(track.id)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-2 py-1 hover:bg-[var(--accent-soft)]",
                      selected && "bg-[var(--accent-soft)]",
                    )}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        playing ? player.toggle() : previewTrack(track)
                      }
                      className="relative flex size-[40px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-surface-2"
                      aria-label={
                        playing ? `Pause ${track.title}` : `Play ${track.title}`
                      }
                    >
                      <AudioArt track={track} className="size-full" />
                      <span className="absolute inset-0 flex items-center justify-center">
                        <span className="flex size-8 items-center justify-center rounded-full text-white">
                          {playing ? (
                            <Pause size={17} className="fill-current" />
                          ) : (
                            <Play size={17} className="fill-current pl-0.5" />
                          )}
                        </span>
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => pickTrack(track)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <span className="block truncate text-sm font-black leading-tight">
                        {track.title}
                      </span>
                      <span className="flex min-w-0 items-center gap-1.5 text-[12px] font-medium text-dim">
                        <span className="flex w-3 h-3 shrink-0 items-center justify-center rounded-sm bg-[#1c9bb5] text-white">
                          <Music2 size={8} />
                        </span>
                        <span className="truncate">
                          {track.artist} · {audioPlays(track)} ·{" "}
                          {audioClock(track.seconds)}
                        </span>
                      </span>
                    </button>
                    {selected ? (
                      <span className="flex size-4 items-center justify-center rounded-full bg-accent text-on-accent">
                        <FaCheck size={10} />
                      </span>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => void toggleTrackLike(track)}
                      disabled={likeBusy === String(track.id)}
                      className={cn(
                        "flex size-8 items-center justify-center rounded-full",
                        isTrackLiked(track)
                          ? "text-accent"
                          : "text-dim",
                      )}
                      aria-label={
                        isTrackLiked(track)
                          ? "Remove from saved audio"
                          : "Save audio"
                      }
                    >
                      <Bookmark
                        className={cn(
                          "size-4",
                          isTrackLiked(track) && "fill-current",
                        )}
                      />
                    </button>
                  </div>
                );
              })}
            </div>
            {audioUploading ? (
              <div className="flex items-center justify-center gap-2 py-3 text-[11px] font-bold text-dim">
                <Spinner className="size-4 text-accent" />
                Uploading audio...
              </div>
            ) : null}
          </section>
        </div>
      ) : null}

      {trimOpen ? (
        <div
          className="absolute inset-0 z-[85] flex items-end bg-black/45"
          onClick={closeTrim}
        >
          <section
            className="flex max-h-[86%] w-full flex-col overflow-y-auto overscroll-contain rounded-t-[28px] bg-card pb-[max(14px,env(safe-area-inset-bottom))] text-ink shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 pb-3 pt-2">
              <h2 className="text-[19px] font-black tracking-tight">
                Choose a part
              </h2>
              <button
                type="button"
                onClick={closeTrim}
                className="flex size-9 items-center justify-center rounded-full bg-surface-2 hover:bg-surface-3 text-dim"
                aria-label="Close choose a part"
              >
                <X className="size-5" />
              </button>
            </div>
            <div className="mx-5 flex items-center gap-3 rounded-lg border border-line bg-surface-3 px-2 py-1.5">
              <AudioArt
                track={trimTrack}
                className="size-[54px] shrink-0 rounded-lg"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-md font-black leading-tight">
                  {trimTrack?.title ?? "Audio"}
                </p>
                <p className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-semibold text-dim">
                  <User className="size-3 shrink-0" />
                  {trimTrack?.artist ?? "Your audio"}
                </p>
                <p className="text-[10px] font-semibold text-dim">
                  {audioClock(trimDurationMs / 1000)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!trimTrack) return;
                  if (player.current?.id === trimTrack.id && player.playing) {
                    player.toggle();
                  } else {
                    previewTrack(trimTrack);
                  }
                }}
                className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent-chip text-accent"
                aria-label={
                  player.current?.id === trimTrack?.id && player.playing
                    ? "Pause audio"
                    : "Play audio"
                }
              >
                {player.current?.id === trimTrack?.id && player.playing ? (
                  <Pause className="size-5 fill-current" />
                ) : (
                  <Play className="size-5 fill-current pl-0.5" />
                )}
              </button>
            </div>
            <div className="mt-2 px-5">
              <div
                ref={(node) => {
                  trimStripRef.current = node;
                  trimScrollRef.current = node;
                }}
                className="relative h-[90px] touch-none select-none overflow-x-auto overflow-y-hidden rounded-lg border border-line bg-surface-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
                onPointerDown={(event) => beginTrimDrag("head", event)}
                onPointerMove={moveTrimDrag}
                onPointerUp={endTrimDrag}
                onPointerCancel={endTrimDrag}
                onWheel={(event) => {
                  if (Math.abs(event.deltaY) > Math.abs(event.deltaX)) {
                    event.currentTarget.scrollLeft += event.deltaY;
                  }
                }}
              >
                <div
                  className="relative h-full"
                  style={{ width: `${trimTrackWidth}px`, minWidth: "100%" }}
                >
                  <div
                    ref={trimWaveRef}
                    className="absolute inset-x-4 bottom-9 top-4 flex items-end gap-[1px]"
                  >
                  {trimWave.map((height, index) => {
                    const position = ((index + 0.5) / trimWave.length) * 100;
                    const active =
                      position >= trimStartPct && position <= trimEndPct;
                    return (
                      <span
                        key={index}
                        className={cn(
                          "min-w-0 flex-1 rounded-full",
                          active ? "bg-accent" : "bg-line",
                        )}
                        style={{
                          height: `${height}%`,
                          transformOrigin: "bottom",
                          willChange:
                            trimPlaying && active ? "transform" : undefined,
                          animation:
                            trimPlaying && active
                              ? `trim-wave-bounce ${620 + (index % 7) * 90}ms ease-in-out ${(index % 11) * 45}ms infinite alternate`
                              : undefined,
                        }}
                      />
                    );
                  })}
                </div>
                {trimDurationMs ? (
                  <>
                    <div className="pointer-events-none absolute inset-x-4 bottom-9 top-3">
                      <button
                        type="button"
                        onPointerDown={(event) =>
                          beginTrimDrag("window", event)
                        }
                        className="pointer-events-auto absolute inset-y-0 cursor-grab touch-none rounded-[7px] border-[3px] border-accent active:cursor-grabbing"
                        style={{
                          left: `${trimStartPct}%`,
                          right: `${100 - trimEndPct}%`,
                        }}
                        aria-label="Move selected audio part"
                      />
                    </div>
                    <div className="pointer-events-none absolute inset-x-4 bottom-[26px] h-[2px] rounded-full bg-[color-mix(in_srgb,var(--accent)_20%,transparent)]">
                      <div
                        className="absolute inset-y-0 rounded-full bg-accent"
                        style={{
                          left: `${trimStartPct}%`,
                          right: `${100 - trimEndPct}%`,
                        }}
                      />
                    </div>
                  </>
                ) : null}
                {trimDurationMs ? (
                  <div className="pointer-events-none absolute inset-x-4 bottom-9 top-4">
                    <div
                      className="absolute inset-y-0 z-20 w-[3px] -translate-x-1/2 rounded-full bg-[var(--ink)] shadow-[0_0_6px_rgba(0,0,0,.3)] transition-[left] duration-150 ease-linear"
                      style={{ left: `${trimHeadPct}%` }}
                    >
                      <span className="absolute -top-1.5 left-1/2 size-2 -translate-x-1/2 rounded-full bg-[var(--ink)]" />
                    </div>
                  </div>
                ) : null}
                <div className="pointer-events-none absolute inset-x-4 bottom-1.5 h-4 text-[9px] font-semibold text-dim">
                  {trimLabels.map((second) => {
                    const pct = (second * 1000 * 100) / trimLimitMs;
                    return (
                      <span
                        key={second}
                        className="absolute bottom-0 flex flex-col items-center gap-1"
                        style={{
                          left: `${pct}%`,
                          transform:
                            pct <= 0
                              ? "translateX(0)"
                              : pct >= 100
                                ? "translateX(-100%)"
                                : "translateX(-50%)",
                        }}
                      >
                        <span className="h-1 w-px bg-line" />
                        {audioClock(second)}
                      </span>
                    );
                  })}
                </div>
                {trimLoading ? (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[color-mix(in_srgb,var(--card)_80%,transparent)] backdrop-blur-[2px]">
                    <Spinner className="size-5 text-accent" />
                    <span className="text-[10px] font-bold text-dim">
                      Reading audio...
                    </span>
                  </div>
                ) : null}
                </div>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-2 px-5">
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setTrimWindowOpen(true);
                }}
                className="flex h-11 flex-1 items-center justify-center rounded-full bg-accent-chip px-4 text-[13px] font-black text-accent"
              >
                {audioClock(trimStartMs / 1000)} – {audioClock(trimEndMs / 1000)}
              </button>
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setTrimWindowOpen(true);
                }}
                onPointerDown={(event) => event.stopPropagation()}
                className="flex h-11 shrink-0 items-center gap-1 rounded-full border border-[color-mix(in_srgb,var(--accent)_30%,var(--line))] bg-card px-4 text-[13px] font-black text-accent"
                aria-label="Audio part length"
              >
                {trimWindowMs / 1000} s
                <ChevronDown className="size-4" />
              </button>
              <button
                type="button"
                onClick={applyTrim}
                disabled={trimLoading || !trimDurationMs}
                className="h-11 shrink-0 rounded-full bg-accent px-6 text-[14px] font-black text-on-accent disabled:opacity-40"
              >
                Use
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {trimOpen && trimWindowOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[200] flex items-end bg-black/35"
              onClick={() => setTrimWindowOpen(false)}
            >
              <section
                className="w-full rounded-t-[24px] bg-card px-5 pb-[max(16px,env(safe-area-inset-bottom))] pt-4 text-ink shadow-2xl"
                onClick={(event) => event.stopPropagation()}
              >
                <h2 className="text-[16px] font-black">How many seconds</h2>
                <div className="mt-3 grid grid-cols-6 gap-2">
                  {AUDIO_PART_WINDOWS.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => chooseTrimWindow(value)}
                      className={cn(
                        "h-12 rounded-[10px] text-[13px] font-black transition",
                        trimWindowMs === value
                          ? "bg-accent text-on-accent"
                          : "bg-surface-2 text-dim",
                      )}
                    >
                      {value / 1000}s
                    </button>
                  ))}
                </div>
              </section>
            </div>,
            document.body,
          )
        : null}

      {stickerOpen ? (
        <div
          className="absolute inset-0 z-[80] flex items-end bg-black/55"
          onClick={() => {
            setStickerOpen(false);
            setTool(null);
          }}
        >
          <section
            className="flex max-h-[62%] min-h-[42%] w-full flex-col rounded-t-[30px] bg-[#15151d] pb-[max(18px,env(safe-area-inset-bottom))] text-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-white/20" />
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="text-[19px] font-black">Stickers</h2>
              <button
                type="button"
                onClick={() => {
                  setStickerOpen(false);
                  setTool(null);
                }}
                className="text-[13px] font-extrabold text-accent"
              >
                Done
              </button>
            </div>
            <div className="flex gap-2 overflow-x-auto px-5 pb-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {STICKER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  onClick={() => {
                    if (tab.key === "link") setStickerTab("link");
                    else chooseStickerTab(tab.key);
                  }}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-full px-4 py-3 text-[12px] font-extrabold",
                    stickerTab === tab.key
                      ? "bg-white/15 text-white"
                      : "bg-white/5 text-white/75",
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
            {stickerTab === "link" ? (
              <div className="mx-5 mb-3 flex items-center gap-2 rounded-2xl bg-white/10 px-3">
                <input
                  value={linkDraft}
                  onChange={(event) => setLinkDraft(event.target.value)}
                  placeholder="Paste a link"
                  className="h-11 min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-white outline-none placeholder:text-white/35"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={addLinkSticker}
                  className="rounded-full bg-accent px-3 py-1.5 text-[10px] font-extrabold text-on-accent"
                >
                  Add
                </button>
              </div>
            ) : null}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-4">
              {stickerLoading ? (
                <div className="flex justify-center py-10">
                  <Spinner className="size-6 text-white" />
                </div>
              ) : null}
              {!stickerLoading && stickerRows.length === 0 ? (
                <p className="py-12 text-center text-[12px] font-bold text-white/45">
                  No stickers on offer right now.
                </p>
              ) : null}
              {stickerRows.length ? (
                <div className="grid grid-cols-4 gap-3">
                  {stickerRows.map((row) => (
                    <button
                      key={String(row.id)}
                      type="button"
                      onClick={() => addSticker(row)}
                      className="flex aspect-square items-center justify-center rounded-2xl bg-white/5 p-2 transition hover:bg-white/10"
                      aria-label={row.name}
                    >
                      <img
                        src={mediaUrl(row.url) ?? row.url}
                        alt={row.name}
                        className="size-full object-contain"
                      />
                    </button>
                  ))}
                </div>
              ) : null}
              {stickerPacks.length ? (
                <p className="mt-4 text-center text-[10px] font-bold uppercase tracking-[0.12em] text-white/25">
                  {stickerPacks.map((pack) => pack.name).join(" · ")}
                </p>
              ) : null}
            </div>
          </section>
        </div>
      ) : null}

      {posting ? (
        <div className="absolute inset-0 z-[90] flex flex-col items-center justify-center gap-3 bg-black/80 text-white backdrop-blur-sm">
          <Spinner className="size-8 text-white" />
          <p className="text-[13px] font-extrabold">Putting it up</p>
          {onStop ? (
            <button
              type="button"
              onClick={stopPosting}
              className="rounded-full border border-white/25 px-4 py-1.5 text-[10.5px] font-bold text-white/80"
            >
              Stop
            </button>
          ) : null}
        </div>
      ) : null}

      <input
        ref={audioInputRef}
        type="file"
        accept="audio/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void uploadAudio(file);
        }}
      />
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void addImageFile(file);
        }}
      />
    </div>
  );
}

export { fetchAudioFile };
