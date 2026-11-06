import type { Track, UserCard } from "@/types/api";

export type EditorMode = "edit" | "moment";
export type FrameKey = "portrait" | "square" | "tall";
export type Turn = 0 | 1 | 2 | 3;

export interface EditorCrop {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface EditorCutout {
  points: { x: number; y: number }[];
  keepInside: boolean;
}

export interface EditorLayer {
  id: string;
  kind: "sticker" | "image";
  src: string;
  x: number;
  y: number;
  scale: number;
  rotation: number;
  ratio: number;
  name?: string;
}

export interface EditorText {
  id: string;
  value: string;
  x: number;
  y: number;
  font: string;
  size: number;
  color: string;
  background: string;
  outline: string;
  align: "left" | "center" | "right";
  box: boolean;
  rotation: number;
}

export interface EditorStroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

export interface EditorDoc {
  frame: FrameKey;
  fit: boolean;
  zoom: number;
  panX: number;
  panY: number;
  filter: string;
  aura: string;
  turns: Turn;
  crop: EditorCrop | null;
  cutout: EditorCutout | null;
  layers: EditorLayer[];
  texts: EditorText[];
  strokes: EditorStroke[];
  people: UserCard[];
  audio: (Track & { assetId?: string }) | null;
  audioStartMs: number;
  audioEndMs: number;
}

export const FRAMES: { key: FrameKey; label: string; aspect: string }[] = [
  { key: "portrait", label: "Portrait", aspect: "4/5" },
  { key: "square", label: "Square", aspect: "1/1" },
  { key: "tall", label: "Tall", aspect: "9/16" },
];

export const EDIT_FILTERS = [
  { key: "original", label: "Original", css: "none" },
  { key: "glow", label: "Glow", css: "brightness(1.08) contrast(0.92) saturate(1.12) sepia(0.05)" },
  { key: "mono", label: "Mono", css: "grayscale(1) contrast(1.15) brightness(1.02)" },
  { key: "noir", label: "Noir", css: "grayscale(1) contrast(1.45) brightness(0.85)" },
  { key: "fade", label: "Fade", css: "brightness(1.08) contrast(0.8) saturate(0.8) sepia(0.12)" },
  { key: "sepia", label: "Sepia", css: "sepia(0.75) contrast(1.05)" },
  { key: "cool", label: "Cool", css: "hue-rotate(190deg) saturate(1.1) brightness(1.02)" },
  { key: "vivid", label: "Vivid", css: "contrast(1.18) saturate(1.5)" },
  { key: "rose", label: "Rose", css: "sepia(0.25) hue-rotate(-20deg) saturate(1.2) brightness(1.05)" },
  { key: "forest", label: "Forest", css: "hue-rotate(60deg) saturate(1.15) brightness(0.98)" },
  { key: "punch", label: "Punch", css: "contrast(1.25) saturate(1.35)" },
  { key: "pop", label: "Pop", css: "contrast(1.1) saturate(1.7) brightness(1.05)" },
  { key: "sharp", label: "Sharp", css: "contrast(1.2) brightness(1.02)" },
  { key: "matte", label: "Matte", css: "contrast(0.9) brightness(1.05) saturate(0.85) sepia(0.08)" },
] as const;

export const AURA_FILTERS = [
  { key: "asis", label: "As it is", css: "none" },
  { key: "alive", label: "Alive", css: "saturate(1.22) contrast(1.08) brightness(1.03)" },
  { key: "bright", label: "Bright", css: "brightness(1.16) contrast(1.04) saturate(1.05)" },
  { key: "soft-haze", label: "Soft haze", css: "brightness(1.06) contrast(0.9) saturate(0.95) sepia(0.05)" },
  { key: "crisp", label: "Crisp", css: "contrast(1.22) saturate(1.08)" },
  { key: "golden-hour", label: "Golden hour", css: "sepia(0.28) saturate(1.25) hue-rotate(-12deg) brightness(1.08)" },
  { key: "blue-hour", label: "Blue hour", css: "hue-rotate(190deg) saturate(1.18) brightness(0.92)" },
  { key: "after-dark", label: "After dark", css: "brightness(0.78) contrast(1.25) saturate(1.15)" },
  { key: "warm", label: "Warm", css: "sepia(0.18) saturate(1.18) brightness(1.04)" },
  { key: "cool", label: "Cool", css: "hue-rotate(180deg) saturate(1.08) brightness(1.02)" },
  { key: "even", label: "Even", css: "contrast(1.06) brightness(1.02)" },
  { key: "low-light", label: "Low light", css: "brightness(1.24) contrast(1.12) saturate(1.06)" },
  { key: "muted", label: "Muted", css: "saturate(0.7) contrast(0.96) brightness(1.02)" },
] as const;

export const EDIT_FONTS = [
  { key: "classic", label: "Classic", css: 'Inter, ui-sans-serif, system-ui, sans-serif', weight: 700 },
  { key: "poet", label: "Poet", css: 'Georgia, "Times New Roman", serif', weight: 600 },
  { key: "bold", label: "BOLD", css: 'Impact, "Arial Black", ui-sans-serif, sans-serif', weight: 900 },
  { key: "whisper", label: "whisper", css: '"Segoe Script", "Brush Script MT", cursive', weight: 400 },
  { key: "neo", label: "Neo", css: 'ui-monospace, "SFMono-Regular", monospace', weight: 700 },
] as const;

export const EDIT_TEXT_COLORS = [
  "#ffffff",
  "#111111",
  "#ff4d8d",
  "#ffec3d",
  "#4da3ff",
  "#2ee66b",
  "#ff5a4d",
  "#b36cff",
] as const;

export const EDIT_BACKGROUNDS = [
  { key: "none", label: "None", value: "transparent" },
  { key: "black", label: "Black", value: "rgba(0,0,0,.62)" },
  { key: "white", label: "White", value: "rgba(255,255,255,.9)" },
  { key: "pink", label: "Pink", value: "#ec1670" },
  { key: "yellow", label: "Yellow", value: "#ffec3d" },
  { key: "blue", label: "Blue", value: "#4da3ff" },
  { key: "green", label: "Green", value: "#2ee66b" },
  { key: "red", label: "Red", value: "#ff5a4d" },
  { key: "purple", label: "Purple", value: "#b36cff" },
] as const;

export const EDIT_OUTLINES = EDIT_BACKGROUNDS;

export const EDIT_TEXT_STYLES = [
  { key: "plain", label: "Plain", color: "#ffffff", background: "none", outline: "none", box: false },
  { key: "shadow", label: "Shadow", color: "#ffffff", background: "none", outline: "#000000", box: false },
  { key: "neon", label: "Neon", color: "#ffffff", background: "none", outline: "#ec1670", box: false },
  { key: "block", label: "Block", color: "#ffffff", background: "black", outline: "none", box: false },
  { key: "paper", label: "Paper", color: "#111111", background: "white", outline: "none", box: false },
  { key: "box", label: "Box", color: "#ffffff", background: "none", outline: "#ffffff", box: true },
] as const;

export function defaultEditorDoc(frame: FrameKey = "portrait"): EditorDoc {
  return {
    frame,
    fit: false,
    zoom: 1,
    panX: 0,
    panY: 0,
    filter: "original",
    aura: "asis",
    turns: 0,
    crop: null,
    cutout: null,
    layers: [],
    texts: [],
    strokes: [],
    people: [],
    audio: null,
    audioStartMs: 0,
    audioEndMs: 0,
  };
}

export function frameAspect(key: FrameKey): string {
  return FRAMES.find((frame) => frame.key === key)?.aspect ?? "4/5";
}

export function aspectValue(aspect: string): number {
  const [width, height] = aspect.split("/").map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height) || height <= 0) return 4 / 5;
  return width / height;
}

export function filterByKey(key: string) {
  return EDIT_FILTERS.find((filter) => filter.key === key) ?? EDIT_FILTERS[0];
}

export function fontByKey(key: string) {
  return EDIT_FONTS.find((font) => font.key === key) ?? EDIT_FONTS[0];
}

export function auraByKey(key: string) {
  return AURA_FILTERS.find((aura) => aura.key === key) ?? AURA_FILTERS[0];
}

export function frameForMode(mode: EditorMode, shotAspect: string): FrameKey {
  if (mode === "moment") {
    const value = aspectValue(shotAspect);
    if (value < 0.8) return "tall";
    if (value < 1.05) return "square";
    return "portrait";
  }
  return "portrait";
}

/**
 * The ink for words written on one of the editor's own colours.
 *
 * The Background and Outline rows paint each pill in the colour it chooses and
 * write the colour's name on top of it, so that name is read against the pill
 * and not against the panel. The panel's own ink is right for the one pill that
 * is the panel (`none`) and wrong for the rest: "White" was a near-white pill
 * with white words on it in every theme, and once the panel itself became the
 * theme's card, every label went the same way. A fixed black or white, picked by
 * the colour's own luma, is the one pair that survives both themes and both ends
 * of the row — the near-black at one end and the near-white at the other.
 *
 * `none` and anything too transparent to hide the panel behind it answer the
 * panel's ink, because that is the ground they are actually read on.
 */
export function inkOn(value: string) {
  if (value === "transparent") return "text-ink";
  const parts = value.startsWith("#")
    ? [1, 3, 5].map((at) => parseInt(value.slice(at, at + 2), 16))
    : (value.match(/[\d.]+/g) ?? []).slice(0, 4).map(Number);
  const [red, green, blue, alpha = 1] = parts;
  if (![red, green, blue].every(Number.isFinite) || alpha < 0.5) {
    return "text-ink";
  }
  const luma = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luma > 0.5 ? "text-[#111111]" : "text-white";
}
