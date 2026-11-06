import {
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
} from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowLeft,
  AtSign,
  Check,
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
  Pencil,
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
  X,
} from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Spinner } from "@/components/ui/Button";
import { mediaUrl } from "@/config/urls";
import { cn } from "@/utils/cn";
import { errorMessage } from "@/utils/errors";
import { kindOf } from "@/utils/upload";
import { socialService } from "@/services/social.service";
import {
  siftShelf,
  stickersService,
  type ShelfSticker,
} from "@/services/stickers.service";
import { usePlayer } from "@/hooks/usePlayer";
import { useToast } from "@/hooks/useToast";
import type { UserCard } from "@/types/api";
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
  inkOn,
  type EditorCrop,
  type EditorDoc,
  type EditorLayer,
  type EditorMode,
  type EditorText,
} from "./editorTypes";
import {
  combinedFilter,
  effectiveSourceSize,
  layerSize,
  loadImage,
} from "./editorCanvas";
import { AudioArt } from "@/features/audio/soundBits";
import { PartChooser } from "@/features/audio/PartChooser";
import type { SoundWindow } from "@/features/audio/audioWindow";
import { SoundPicker, type PickedSound } from "@/features/audio/SoundPicker";

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

/**
 * How long the chosen part of a sound may be.
 *
 * The list itself lives in `partLength.ts` with the menu's placement, and the
 * chooser is a dropdown rather than the sheet the phone opens: a list of eleven
 * fits one, and the sheet's grid of six was the reason it never held the rest.
 */

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

const STICKER_TABS = [
  { key: "mention", label: "Mention", icon: <AtSign className="size-4" /> },
  { key: "link", label: "Link", icon: <Link2 className="size-4" /> },
  { key: "time", label: "Time", icon: <Clock3 className="size-4" /> },
  { key: "place", label: "Place", icon: <MapPin className="size-4" /> },
] as const;

/**
 * The surface every tool panel and sheet in this editor is drawn on, and the
 * controls that sit on it.
 *
 * The Audio sheet and "Choose a part" already sat on the theme's card with the
 * theme's ink. The Sticker sheet and every panel that floats over the picture
 * were charcoal with white words — one editor answering to two grammars, and
 * only one of them the grammar the user picked in Settings. So the audio
 * sheet's own classes are named once here rather than restated per panel. A
 * surface restated per panel is a surface that drifts: it is the same shape of
 * mistake as the drops feed's two copies of one query's options
 * (`features/drops/feedQueries.ts`), which cost the feed an error.
 *
 * Deliberately not here: the controls that sit *on* the photograph — the header
 * pills, the crop's dim and corners, the frame's zoom row. Words over a picture
 * need a scrim or a shadow to keep them legible, and the theme cannot know what
 * is behind them.
 */
const PANEL = "rounded-lg bg-card text-ink shadow-sm";
const CROP_PANEL_SPACE = 84;
/** A control on a panel: a stepper, a field, a small action. */
const CHIP = "bg-surface-2 text-ink";
/** A tab on a panel, which is not the current one — the Audio sheet's own pair. */
const CHIP_OFF = "border border-line bg-card text-dim";
/** The same, for the one that is current. */
const CHIP_ON = "bg-accent text-on-accent shadow-sm";

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
  /**
   * The sound being windowed, and the asset it is already stored as when this
   * account handed the file over a moment ago.
   *
   * `PickedSound` rather than a bare `Track` because the asset id has to
   * survive the trip: `CameraCapture.postMoment` posts a sound by asset id and
   * re-uploads the bytes of a row that has none, so a row off the shelf costs
   * one download and one upload while a file the person just chose — already
   * uploaded by the picker — must not be stored a second time under a second
   * id. That is not a type this file can afford to widen away.
   *
   * The window itself is `PartChooser`'s while the sheet is open, and so is the
   * file's length: it reads `seconds` off this row and measures the file itself
   * only when the row carries none. What comes back is the two numbers.
   */
  const [trimTrack, setTrimTrack] = useState<PickedSound | null>(null);
  const [tagQuery, setTagQuery] = useState("");
  const [tagPeople, setTagPeople] = useState<UserCard[]>([]);
  const [tagLoading, setTagLoading] = useState(false);
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
  const [stickerRows, setStickerRows] = useState<ShelfSticker[]>([]);
  const [stickerFind, setStickerFind] = useState("");
  const [stickerLoading, setStickerLoading] = useState(false);
  // What the box holds narrows the grid under it. The shelf came down in one
  // read, so a keystroke is a filter rather than a request — the app's own rule
  // (`Stickers.sift`), kept here so the two shelves narrow the same way.
  const stickerShown = useMemo(
    () => siftShelf(stickerRows, stickerFind),
    [stickerRows, stickerFind],
  );
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
    // The shelf the phone draws from: our sticker service first, our own
    // server's smaller shelf when that service refuses. Reading only the
    // server, as this sheet used to, put a different and much shorter list of
    // stickers in front of somebody than the app does. See `stickersService`.
    void stickersService
      .shelf()
      .catch(() => [] as ShelfSticker[])
      .then((rows) => {
        if (!cancelled) setStickerRows(rows);
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
      const availableHeight = Math.max(
        0,
        rect.height - (cropMode ? CROP_PANEL_SPACE : 0),
      );
      let width = Math.max(0, rect.width);
      let height = width / ratio;
      if (height > availableHeight) {
        height = availableHeight;
        width = height * ratio;
      }
      setStageBox({ width, height });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(wrap);
    return () => observer.disconnect();
  }, [stageRatio, cropMode]);

  useEffect(() => {
    if (!tagOpen) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setTagLoading(true);
      void socialService
        .mentionable(tagQuery.trim())
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

  function addSticker(row: ShelfSticker) {
    const id = crypto.randomUUID();
    addLayer({
      id,
      kind: "sticker",
      src: row.url,
      x: 0.5,
      y: 0.5,
      scale: 1,
      rotation: 0,
      // The shelf does not say how big a sticker is — the service's rows carry
      // no width and height — so the box starts square and is squared up the
      // moment the picture arrives. A wide sticker left at 1 would be drawn
      // stretched into a square, which is a sticker nobody drew.
      ratio: 1,
      name: row.name,
    });
    void loadImage(row.url)
      .then((picture) => {
        if (!picture.naturalWidth) return;
        updateLayer(
          id,
          { ratio: picture.naturalHeight / picture.naturalWidth },
          false,
        );
      })
      .catch(() => {
        // A sticker whose picture will not come down keeps its square box,
        // which is what a sticker of unknown shape gets.
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

  /**
   * The part chooser's three doors, and nothing else.
   *
   * The sheet itself is `features/audio/PartChooser` — the same one the Spark
   * card page opens — because "which part of this file plays" is one question
   * with one drag surface and one set of limits. What is left here is what a
   * *document* does with the answer: `audioStartMs`/`audioEndMs` in the editor's
   * own draft, which is what `CameraCapture.postMoment` reads when the moment
   * goes up. The sheet also stops its own audition as it closes; the editor
   * never started it and so has nothing to stop.
   */
  function closeTrim() {
    setTrimOpen(false);
    setTrimTrack(null);
  }

  function openTrim(track: PickedSound) {
    setAudioOpen(false);
    setTrimTrack(track);
    setTrimOpen(true);
  }

  function applyTrim(window: SoundWindow) {
    const track = trimTrack;
    if (!track) return;
    commit(
      (current) => ({
        ...current,
        audio: track,
        audioStartMs: window.startMs,
        audioEndMs: window.endMs,
      }),
      true,
    );
    setTrimOpen(false);
    setTrimTrack(null);
    // The chooser handed the player over rather than stopping it, so what is
    // playing now is the part that was just chosen — and this editor is what
    // closes it from here, on undo, on the sound coming off, or on unmount.
    previewingRef.current = true;
  }

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
        style={{ paddingBottom: cropMode ? CROP_PANEL_SPACE : undefined }}
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
                <div
                  className="pointer-events-none absolute inset-0"
                  aria-hidden
                >
                  <span className="absolute inset-y-0 left-1/3 w-px bg-white/25" />
                  <span className="absolute inset-y-0 left-2/3 w-px bg-white/25" />
                  <span className="absolute inset-x-0 top-1/3 h-px bg-white/25" />
                  <span className="absolute inset-x-0 top-2/3 h-px bg-white/25" />
                </div>
                {(["nw", "ne", "sw", "se"] as const).map((corner) => (
                  <button
                    key={corner}
                    type="button"
                    onPointerDown={(event) => beginCropDrag(corner, event)}
                    onPointerMove={moveCropDrag}
                    onPointerUp={endCropDrag}
                    onPointerCancel={endCropDrag}
                    className={cn(
                      "pointer-events-auto absolute size-9 touch-none",
                      corner === "nw" && "left-0 top-0 cursor-nwse-resize",
                      corner === "ne" && "right-0 top-0 cursor-nesw-resize",
                      corner === "sw" && "bottom-0 left-0 cursor-nesw-resize",
                      corner === "se" && "bottom-0 right-0 cursor-nwse-resize",
                    )}
                    aria-label={`Crop ${corner}`}
                  >
                    <span
                      className={cn(
                        "absolute size-5 border-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]",
                        corner === "nw" &&
                          "left-0 top-0 border-l-[3px] border-t-[3px]",
                        corner === "ne" &&
                          "right-0 top-0 border-r-[3px] border-t-[3px]",
                        corner === "sw" &&
                          "bottom-0 left-0 border-b-[3px] border-l-[3px]",
                        corner === "se" &&
                          "bottom-0 right-0 border-b-[3px] border-r-[3px]",
                      )}
                      aria-hidden
                    />
                  </button>
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
          <section className={cn("mx-3 px-1 py-1.5", PANEL)}>
            <div className="flex gap-3 overflow-x-auto hide-scrollbar">
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
                  className="flex w-[58px] shrink-0 flex-col items-center gap-1 text-[10px] font-bold"
                >
                  <span
                    className={cn(
                      "flex size-12 overflow-hidden rounded-full border-2",
                      doc.filter === filter.key
                        ? "border-accent"
                        : "border-line",
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
                      doc.filter === filter.key ? "text-ink" : "text-dim"
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
          <section
            className={cn(
              "scroll-area mx-3 max-h-[46dvh] overflow-y-auto overscroll-contain px-2.5 py-2.5",
              PANEL,
            )}
          >
            {selectedText ? (
              <div className="mb-2 flex items-center gap-1 rounded-lg border border-accent/40 bg-surface-2 transition focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/30">
                {/* The words are typed in the theme's ink and the chosen colour
                    is the dot at the head of the field, where the field used to
                    be the preview. It cannot be the preview any more: the
                    palette opens on white and on a light panel white words are
                    an empty-looking field. What the words will actually look
                    like is on the picture, under this panel. */}
                <span className="flex size-9 shrink-0 items-center justify-center">
                  <span
                    className="size-4 rounded-full border border-line shadow-sm"
                    style={{ backgroundColor: selectedText.color }}
                    aria-hidden
                  />
                </span>
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
                  aria-label="Text"
                  className="h-9 min-w-0 flex-1 bg-transparent text-[15px] font-semibold text-ink outline-none placeholder:text-dim"
                  style={{ fontFamily: fontByKey(selectedText.font).css }}
                />
                <span
                  className="mx-0.5 h-5 w-px shrink-0 bg-line"
                  aria-hidden
                />
                <button
                  type="button"
                  onClick={() =>
                    updateText(selectedText.id, {
                      rotation: selectedText.rotation - 15,
                    })
                  }
                  className="flex size-9 shrink-0 touch-manipulation items-center justify-center rounded-full text-dim transition hover:bg-surface-3 hover:text-ink active:scale-95"
                  aria-label="Rotate text left"
                >
                  <RotateCcw className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    updateText(selectedText.id, {
                      rotation: selectedText.rotation + 15,
                    })
                  }
                  className="flex size-9 shrink-0 touch-manipulation items-center justify-center rounded-full text-dim transition hover:bg-surface-3 hover:text-ink active:scale-95"
                  aria-label="Rotate text right"
                >
                  <RotateCw className="size-5" />
                </button>
                <button
                  type="button"
                  onClick={() => deleteText(selectedText.id)}
                  className="flex size-9 shrink-0 touch-manipulation items-center justify-center rounded-full text-bad transition hover:bg-[color-mix(in_srgb,var(--bad)_12%,transparent)] active:scale-95"
                  aria-label="Delete text"
                >
                  <Trash2 className="size-5" />
                </button>
              </div>
            ) : null}

            <div className="hide-scrollbar flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={addText}
                className="flex h-8 shrink-0 touch-manipulation items-center gap-1.5 rounded-full bg-accent px-3.5 text-[12px] font-extrabold text-on-accent transition active:scale-95"
              >
                <Plus className="size-4" /> Add text
              </button>
              {EDIT_FONTS.map((font) => (
                <button
                  key={font.key}
                  type="button"
                  aria-pressed={
                    selectedText
                      ? selectedText.font === font.key
                      : defaultFont === font.key
                  }
                  onClick={() => {
                    if (selectedText)
                      updateText(selectedText.id, { font: font.key });
                    else setDefaultFont(font.key);
                  }}
                  className={cn(
                    "h-8 shrink-0 touch-manipulation rounded-full border px-3 text-[13px] transition active:scale-95",
                    (
                      selectedText
                        ? selectedText.font === font.key
                        : defaultFont === font.key
                    )
                      ? "border-accent bg-surface-3 text-ink shadow-sm"
                      : "border-line bg-card text-dim hover:border-ink/20 hover:text-ink",
                  )}
                  style={{ fontFamily: font.css, fontWeight: font.weight }}
                >
                  {font.label}
                </button>
              ))}
            </div>

            <div className="mt-2 flex h-10 items-center gap-1.5 rounded-lg border border-line bg-surface-2 px-1.5">
              <button
                type="button"
                disabled={!selectedText}
                onClick={() =>
                  selectedText &&
                  updateText(selectedText.id, {
                    size: clamp(selectedText.size - 3, 12, 90),
                  })
                }
                className="flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-dim transition enabled:hover:bg-surface-3 enabled:hover:text-ink enabled:active:scale-95 disabled:opacity-40"
                aria-label="Smaller text"
              >
                A-
              </button>
              <input
                type="range"
                min={12}
                max={90}
                disabled={!selectedText}
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
                className="min-w-0 flex-1 accent-[var(--accent)] disabled:opacity-40"
                aria-label="Text size"
              />
              <button
                type="button"
                disabled={!selectedText}
                onClick={() =>
                  selectedText &&
                  updateText(selectedText.id, {
                    size: clamp(selectedText.size + 3, 12, 90),
                  })
                }
                className="flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-dim transition enabled:hover:bg-surface-3 enabled:hover:text-ink enabled:active:scale-95 disabled:opacity-40"
                aria-label="Larger text"
              >
                A+
              </button>
              <span className="w-6 shrink-0 text-center text-[10px] font-extrabold tabular-nums text-dim">
                {selectedText?.size ?? 34}
              </span>
            </div>

            <div className="hide-scrollbar mt-2 flex gap-1.5 overflow-x-auto pb-1">
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
                  aria-pressed={subtool === item.key}
                  onClick={() => {
                    if (!selectedText && item.key !== "font") {
                      toast({ title: "Add text first.", tone: "info" });
                      return;
                    }
                    setSubtool(item.key);
                  }}
                  className={cn(
                    "flex h-8 shrink-0 touch-manipulation items-center gap-1.5 rounded-full px-3 text-[10.5px] font-extrabold transition active:scale-95",
                    subtool === item.key ? CHIP_ON : CHIP_OFF,
                  )}
                >
                  {item.icon}
                  {item.label}
                </button>
              ))}
            </div>

            {subtool === "color" && selectedText ? (
              <div className="mt-2 flex flex-wrap gap-2 rounded-lg border border-line bg-surface-2 px-2 py-1.5">
                {EDIT_TEXT_COLORS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => updateText(selectedText.id, { color })}
                    aria-label={`Use ${color}`}
                    aria-pressed={selectedText.color === color}
                    className={cn(
                      "size-8 shrink-0 touch-manipulation rounded-full border-2 shadow-sm transition active:scale-90",
                      selectedText.color === color
                        ? "border-accent ring-2 ring-accent/35"
                        : "border-line hover:border-ink/25",
                    )}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            ) : null}

            {subtool === "background" && selectedText ? (
              <div className="mt-2 flex flex-wrap gap-1.5 rounded-lg border border-line bg-surface-2 px-2 py-1.5">
                {EDIT_BACKGROUNDS.map((background) => (
                  <button
                    key={background.key}
                    type="button"
                    aria-pressed={
                      selectedText.background === background.key
                    }
                    onClick={() =>
                      updateText(selectedText.id, {
                        background: background.key,
                      })
                    }
                    className={cn(
                      "flex h-7 shrink-0 touch-manipulation items-center justify-center rounded-full border px-3 text-[10px] font-extrabold shadow-sm transition active:scale-95",
                      selectedText.background === background.key
                        ? "border-accent ring-1 ring-accent/30"
                        : "border-line",
                      inkOn(background.value),
                    )}
                    style={{ backgroundColor: background.value }}
                  >
                    {background.label}
                  </button>
                ))}
              </div>
            ) : null}

            {subtool === "outline" && selectedText ? (
              <div className="mt-2 flex flex-wrap gap-1.5 rounded-lg border border-line bg-surface-2 px-2 py-1.5">
                {EDIT_OUTLINES.map((outline) => (
                  <button
                    key={outline.key}
                    type="button"
                    aria-pressed={selectedText.outline === outline.key}
                    onClick={() =>
                      updateText(selectedText.id, { outline: outline.key })
                    }
                    className={cn(
                      "flex h-7 shrink-0 touch-manipulation items-center justify-center rounded-full border px-3 text-[10px] font-extrabold shadow-sm transition active:scale-95",
                      selectedText.outline === outline.key
                        ? "border-accent ring-1 ring-accent/30"
                        : "border-line",
                      inkOn(outline.value),
                    )}
                    style={{ backgroundColor: outline.value }}
                  >
                    {outline.label}
                  </button>
                ))}
              </div>
            ) : null}

            {subtool === "align" && selectedText ? (
              <div className="mt-2 grid grid-cols-3 gap-1.5 rounded-lg border border-line bg-surface-2 p-1.5">
                {[
                  {
                    key: "left" as const,
                    label: "Left",
                    icon: <AlignLeft className="size-4" />,
                  },
                  {
                    key: "center" as const,
                    label: "Center",
                    icon: <AlignCenter className="size-4" />,
                  },
                  {
                    key: "right" as const,
                    label: "Right",
                    icon: <AlignRight className="size-4" />,
                  },
                ].map((align) => (
                  <button
                    key={align.key}
                    type="button"
                    aria-pressed={selectedText.align === align.key}
                    onClick={() =>
                      updateText(selectedText.id, { align: align.key })
                    }
                    className={cn(
                      "flex h-8 touch-manipulation items-center justify-center gap-1.5 rounded-md text-[11px] font-extrabold transition active:scale-95",
                      selectedText.align === align.key
                        ? "bg-accent text-on-accent shadow-sm"
                        : "text-dim hover:bg-surface-3 hover:text-ink",
                    )}
                  >
                    {align.icon}
                    {align.label}
                  </button>
                ))}
              </div>
            ) : null}

            {subtool === "box" && selectedText ? (
              <button
                type="button"
                aria-pressed={selectedText.box}
                onClick={() =>
                  updateText(selectedText.id, { box: !selectedText.box })
                }
                className={cn(
                  "mt-2 flex h-10 w-full touch-manipulation items-center justify-between rounded-lg border px-3 text-[11px] font-extrabold transition",
                  selectedText.box
                    ? "border-accent bg-[var(--accent-soft)] text-ink"
                    : "border-line bg-surface-2 text-dim hover:text-ink",
                )}
              >
                <span className="flex items-center gap-2">
                  <Square className="size-4" />
                  Text box
                </span>
                <span
                  className={cn(
                    "relative h-5 w-9 rounded-full transition",
                    selectedText.box ? "bg-accent" : "bg-line",
                  )}
                  aria-hidden
                >
                  <span
                    className={cn(
                      "absolute top-0.5 size-4 rounded-full shadow-sm transition-all",
                      selectedText.box
                        ? "left-[18px] bg-on-accent"
                        : "left-0.5 bg-card",
                    )}
                  />
                </span>
              </button>
            ) : null}

            {subtool === "style" && selectedText ? (
              <div className="mt-2 flex flex-wrap gap-1.5 rounded-lg border border-line bg-surface-2 px-2 py-1.5">
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
                    className="flex shrink-0 touch-manipulation items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1.5 text-[10.5px] font-extrabold text-ink transition hover:border-accent/40 hover:text-accent active:scale-95"
                  >
                    <span
                      className="size-2.5 rounded-full border border-line"
                      style={{ backgroundColor: style.color }}
                      aria-hidden
                    />
                    {style.label}
                  </button>
                ))}
              </div>
            ) : null}
          </section>
        ) : null}

        {tool === "audio" && !audioOpen ? (
          <section className={cn("mx-3 px-3 py-1", PANEL)}>
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
                  <span className="block truncate text-[10px] text-dim">
                    {doc.audio.artist}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => setAudioOpen(true)}
                  className={cn(
                    "rounded-full px-3 py-1.5 text-[10px] font-extrabold",
                    CHIP,
                  )}
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
                <span className="min-w-0 flex-1 text-[12px] font-bold text-dim">
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
          <section className={cn("mx-3 px-2 py-1", PANEL)}>
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-full bg-accent-chip text-accent">
                <AtSign className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-[13px] font-extrabold">
                  {doc.people.length}/5 · who you keep or chat with
                </span>
                <span className="block truncate text-[10px] text-dim">
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
                className={cn(
                  "rounded-full px-3 py-1.5 text-[10px] font-extrabold",
                  CHIP,
                )}
              >
                Edit
              </button>
            </div>
          </section>
        ) : null}

        {tool === "draw" ? (
          <section className={cn("mx-3 px-2 py-1", PANEL)}>
            <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
              {DRAW_COLORS.map((color) => (
                <button
                  key={color}
                  type="button"
                  onClick={() => setDrawColor(color)}
                  className={cn(
                    "size-8 shrink-0 rounded-full border-2",
                    drawColor === color
                      ? "border-accent ring-2 ring-ink/25"
                      : "border-line",
                  )}
                  style={{ backgroundColor: color }}
                  aria-label={`Draw with ${color}`}
                />
              ))}
            </div>
            <div className="mt-1.5 flex items-center gap-3">
              <span className="text-[11px] font-extrabold text-dim">
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
          <section className={cn("mx-3 px-2 py-1", PANEL)}>
            <div className="flex items-center gap-3">
              <span className="min-w-0 flex-1 text-[12px] font-bold text-dim">
                Keeps what you drew around
              </span>
              <button
                type="button"
                onClick={() => setKeepInside((value) => !value)}
                className={cn(
                  "shrink-0 rounded-full px-3 py-2 text-[11px] font-extrabold",
                  keepInside ? "text-accent bg-accent/10 transition" : "text-dim bg-accent/30 transition",
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
                className="mt-2 text-[11px] font-bold text-dim"
              >
                Remove cut out
              </button>
            ) : null}
          </section>
        ) : null}

        {tool === "crop" ? (
          <section
            className={cn(
              "mx-3 flex items-center gap-3 px-2 py-1",
              PANEL,
            )}
          >
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[var(--accent-soft)] text-accent">
              <Crop className="size-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-extrabold text-ink">Crop photo</p>
              <p className="truncate text-[10px] font-semibold text-dim">
                Drag a corner to resize.
              </p>
            </div>
            <button
              type="button"
              onClick={applyCrop}
              className="flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 text-[11px] font-extrabold text-on-accent transition active:scale-95"
            >
              Done
              <Check className="size-4" />
            </button>
          </section>
        ) : null}

        {tool === "aura" ? (
          <section className={cn("mx-3 px-2 py-1", PANEL)}>
            <div className="flex gap-3 overflow-x-auto hide-scrollbar">
              {AURA_FILTERS.map((aura) => (
                <button
                  key={aura.key}
                  type="button"
                  onClick={() =>
                    commit((current) => ({ ...current, aura: aura.key }), true)
                  }
                  className="flex w-[62px] shrink-0 flex-col items-center gap-1 text-[10px] font-bold"
                >
                  <span
                    className={cn(
                      "flex size-12 overflow-hidden rounded-full border-2",
                      doc.aura === aura.key
                        ? "border-accent"
                        : "border-line",
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
                      doc.aura === aura.key ? "text-ink" : "text-dim"
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
          <section className={cn("mx-3 mb-2 p-3", PANEL)}>
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
                className={cn(
                  "flex size-9 items-center justify-center rounded-full",
                  CHIP,
                )}
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
                className={cn(
                  "flex size-9 items-center justify-center rounded-full",
                  CHIP,
                )}
                aria-label="Rotate layer right"
              >
                <RotateCw className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => deleteLayer(selectedLayer.id)}
                className="flex size-9 items-center justify-center rounded-full bg-surface-2 text-accent"
                aria-label="Delete layer"
              >
                <Trash2 className="size-4" />
              </button>
            </div>
            <div className="mt-2 flex items-center gap-3">
              <span className="text-[10px] font-extrabold text-dim">
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
            className="flex max-h-[78%] min-h-[42%] w-full flex-col rounded-t-[28px] bg-card pb-[max(10px,env(safe-area-inset-bottom))] text-ink shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mt-2 h-1.5 w-12 rounded-full bg-[color-mix(in_srgb,var(--ink)_15%,transparent)]" />
            <div className="px-5 py-2">
              <div className="flex items-start justify-between">
                <div>
                  <h2 className="text-[19px] font-black">Who is in it</h2>
                  <p className="-mt-0.5 text-[11px] font-semibold text-dim">
                    {doc.people.length}/5 · who you keep or chat with
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setTagOpen(false)}
                  className="flex size-9 items-center justify-center rounded-full bg-surface-2 hover:bg-surface-3"
                  aria-label="Close"
                >
                  <X className="size-5" />
                </button>
              </div>
              <div className="mt-1 flex items-center gap-2 rounded-lg bg-surface-2 px-3 focus-within:ring-1 focus-within:ring-accent">
                <Search className="size-4 text-dim" />
                <input
                  value={tagQuery}
                  onChange={(event) => setTagQuery(event.target.value)}
                  placeholder="Search people ..."
                  className="h-10 min-w-0 flex-1 bg-transparent text-[13px] font-semibold outline-none"
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
                    className="flex w-full items-center gap-3 rounded-lg px-2 py-1.5 text-left transition hover:bg-surface-2"
                  >
                    <Avatar
                      user={person}
                      name={name}
                      src={person.avatar}
                      size={38}
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
                        "flex size-5 items-center justify-center rounded-full border-2",
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
            <div className="flex gap-2 px-5 pt-2">
              {doc.people.length ? (
                <button
                  type="button"
                  onClick={() =>
                    commit((current) => ({ ...current, people: [] }), true)
                  }
                  className="rounded-full bg-surface-2 px-4 py-2 text-[12px] font-extrabold text-dim"
                >
                  Clear
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => setTagOpen(false)}
                className="flex-1 rounded-full bg-accent py-2 text-[13px] font-extrabold text-on-accent"
              >
                {doc.people.length ? "Done" : "Nobody"}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {/* The sheet the whole app picks a sound with — `features/audio`, one
          implementation, so a song cannot wear a different face here than it
          does on a Spark card. What it answers with is a row and the length
          that row already knew; the part chooser below is the same shared one,
          because "which part of this file plays" is one question. */}
      <SoundPicker
        open={audioOpen}
        selectedId={doc.audio ? String(doc.audio.id) : null}
        onClose={closeAudio}
        onPick={openTrim}
      />

      {/* The window into the sound, and the same sheet the Spark card opens:
          one drag surface, one set of limits (`audioWindow.ts`), one place the
          length is measured when nobody knows it. The editor's own half is what
          it does with the answer — `audioStartMs`/`audioEndMs` in the draft. */}
      <PartChooser
        open={trimOpen}
        track={trimTrack}
        onApply={applyTrim}
        onClose={closeTrim}
      />

      {stickerOpen ? (
        <div
          className="absolute inset-0 z-[80] flex items-end bg-black/55 backdrop-blur-[2px]"
          onClick={() => {
            setStickerOpen(false);
            setTool(null);
          }}
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-label="Stickers"
            className="flex max-h-[78%] min-h-[48%] w-full animate-fade-up flex-col overflow-hidden rounded-t-[30px] border-t border-line bg-card pb-[max(16px,env(safe-area-inset-bottom))] text-ink shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mt-2 h-1.5 w-12 shrink-0 rounded-full bg-[color-mix(in_srgb,var(--ink)_15%,transparent)]" />
            <div className="flex shrink-0 items-center justify-between gap-3 px-5 pb-1 pt-1">
              <div className="min-w-0 flex-1">
                <h2 className="text-[22px] font-black leading-tight tracking-tight">
                  Stickers
                </h2>
                <p className="-mt-0.5 truncate text-[11px] font-semibold text-dim">
                  {stickerTab === "link"
                    ? "Add a link to your photo"
                    : "Tap a sticker to place it on your photo"}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setStickerOpen(false);
                  setTool(null);
                }}
                className="shrink-0 rounded-full bg-[var(--accent-soft)] px-4 py-1.5 text-[12px] font-extrabold text-accent transition hover:brightness-95 active:scale-95 hover:bg-[var(--accent)] hover:text-on-accent"
              >
                Done
              </button>
            </div>
            <div className="flex shrink-0 gap-2 overflow-x-auto px-5 pb-2 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {STICKER_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  aria-pressed={stickerTab === tab.key}
                  onClick={() => {
                    if (tab.key === "link") setStickerTab("link");
                    else chooseStickerTab(tab.key);
                  }}
                  className={cn(
                    "flex h-8 shrink-0 touch-manipulation items-center gap-1.5 rounded-full px-3.5 text-[11.5px] font-extrabold transition active:scale-95",
                    stickerTab === tab.key ? CHIP_ON : CHIP_OFF,
                  )}
                >
                  {tab.icon}
                  {tab.label}
                </button>
              ))}
            </div>
            {stickerTab === "link" ? (
              <div className="mx-5 mb-3 flex shrink-0 items-center gap-2 rounded-lg border border-line bg-surface-2 py-1 pl-3 pr-1.5 transition focus-within:border-accent/40 focus-within:ring-1 focus-within:ring-accent/40">
                <Link2 className="size-4 shrink-0 text-dim" aria-hidden />
                <input
                  value={linkDraft}
                  onChange={(event) => setLinkDraft(event.target.value)}
                  placeholder="Paste a link"
                  className="h-8 min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-ink outline-none placeholder:text-dim"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={addLinkSticker}
                  className="h-8 shrink-0 rounded-full bg-accent px-4 text-[11px] font-extrabold text-on-accent transition active:scale-95"
                >
                  Add
                </button>
              </div>
            ) : (
              <div className="mx-5 mb-3 flex shrink-0 items-center gap-2 rounded-lg border border-line bg-surface-2 px-3 transition focus-within:border-accent/40 focus-within:ring-1 focus-within:ring-accent/40">
                <Search className="size-4 shrink-0 text-dim" aria-hidden />
                <input
                  value={stickerFind}
                  onChange={(event) => setStickerFind(event.target.value)}
                  placeholder="Search stickers"
                  aria-label="Search stickers"
                  className="h-10 min-w-0 flex-1 bg-transparent text-[13px] font-semibold text-ink outline-none placeholder:text-dim"
                />
                {stickerFind ? (
                  <button
                    type="button"
                    onClick={() => setStickerFind("")}
                    className="flex size-7 shrink-0 items-center justify-center rounded-full text-dim transition hover:bg-surface-3 hover:text-ink active:scale-95"
                    aria-label="Clear sticker search"
                  >
                    <X className="size-4" />
                  </button>
                ) : null}
              </div>
            )}
            <div className="scroll-area min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-4">
              {stickerLoading ? (
                <div className="flex justify-center py-12">
                  <Spinner className="size-6 text-accent" />
                </div>
              ) : null}
              {!stickerLoading && stickerRows.length === 0 ? (
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <span className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-dim">
                    <Sticker className="size-5" aria-hidden />
                  </span>
                  <p className="text-[12px] font-bold text-dim">
                    No stickers on offer right now.
                  </p>
                </div>
              ) : null}
              {!stickerLoading &&
              stickerRows.length > 0 &&
              stickerShown.length === 0 ? (
                // An empty grid under a word reads as a sheet that has stopped
                // working, so the word is said back instead.
                <div className="flex flex-col items-center gap-3 py-12 text-center">
                  <span className="flex size-11 items-center justify-center rounded-full bg-surface-2 text-dim">
                    <Search className="size-5" aria-hidden />
                  </span>
                  <p className="text-[12px] font-bold text-dim">
                    {`Nothing for "${stickerFind.trim()}"`}
                  </p>
                </div>
              ) : null}
              {stickerShown.length ? (
                <div className="grid grid-cols-5 gap-1.5">
                  {stickerShown.map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => addSticker(row)}
                      className="group flex aspect-square touch-manipulation items-center justify-center rounded-lg border border-line/70 bg-surface-2 p-2 transition hover:border-accent/30 hover:bg-surface-3 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent/60"
                      aria-label={row.name || "Sticker"}
                    >
                      <img
                        src={mediaUrl(row.url) ?? row.url}
                        alt=""
                        loading="lazy"
                        decoding="async"
                        className="size-full object-contain transition duration-200 group-hover:scale-105"
                      />
                    </button>
                  ))}
                </div>
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
