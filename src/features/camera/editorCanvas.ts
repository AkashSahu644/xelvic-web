import {
  AURA_FILTERS,
  EDIT_BACKGROUNDS,
  EDIT_OUTLINES,
  filterByKey,
  fontByKey,
  type EditorCrop,
  type EditorDoc,
  type EditorLayer,
  type EditorText,
} from "./editorTypes";

export interface SourceSize {
  width: number;
  height: number;
}

export interface SceneOptions {
  source: CanvasImageSource;
  sourceWidth: number;
  sourceHeight: number;
  doc: EditorDoc;
  width: number;
  height: number;
  cropMode?: boolean;
  layerImages?: Map<string, HTMLImageElement>;
  afterSource?: (context: CanvasRenderingContext2D, width: number, height: number) => void;
}

const FULL_CROP: EditorCrop = { x: 0, y: 0, w: 1, h: 1 };

export function combinedFilter(doc: EditorDoc) {
  const parts = [filterByKey(doc.filter).css, AURA_FILTERS.find((item) => item.key === doc.aura)?.css ?? "none"]
    .filter((part) => part && part !== "none");
  return parts.join(" ") || "none";
}

export function effectiveSourceSize(size: SourceSize | null, turns: number): SourceSize | null {
  if (!size) return null;
  return turns % 2 ? { width: size.height, height: size.width } : size;
}

export function layerSize(layer: EditorLayer, width: number, height: number) {
  const side = Math.min(width, height) * (layer.kind === "sticker" ? 0.3 : 0.45) * layer.scale;
  return { width: side, height: side * layer.ratio };
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That picture would not load."));
    image.src = src;
  });
}

export async function loadLayerImages(layers: EditorLayer[]) {
  const images = new Map<string, HTMLImageElement>();
  await Promise.all(
    layers.map(async (layer) => {
      if (images.has(layer.src)) return;
      try {
        images.set(layer.src, await loadImage(layer.src));
      } catch {
        // A missing sticker should not stop the rest of the picture.
      }
    }),
  );
  return images;
}

function resolveColor(value: string, list: readonly { key: string; value: string }[]) {
  if (value === "none") return null;
  if (/^(#|rgb|hsl)/.test(value)) return value;
  return list.find((item) => item.key === value)?.value ?? null;
}

function clipToCutout(context: CanvasRenderingContext2D, doc: EditorDoc, width: number, height: number) {
  const cutout = doc.cutout;
  if (!cutout || cutout.points.length < 3) return;
  context.beginPath();
  if (!cutout.keepInside) context.rect(0, 0, width, height);
  cutout.points.forEach((point, index) => {
    const x = point.x * width;
    const y = point.y * height;
    if (index === 0) context.moveTo(x, y);
    else context.lineTo(x, y);
  });
  context.closePath();
  context.clip(cutout.keepInside ? "nonzero" : "evenodd");
}

function drawSource(
  context: CanvasRenderingContext2D,
  source: CanvasImageSource,
  sourceWidth: number,
  sourceHeight: number,
  doc: EditorDoc,
  width: number,
  height: number,
  cropMode: boolean,
) {
  const turns = doc.turns % 4;
  const sourceSize = effectiveSourceSize({ width: sourceWidth, height: sourceHeight }, turns);
  if (!sourceSize) return;
  const crop = cropMode ? FULL_CROP : doc.crop ?? FULL_CROP;
  const safeCrop: EditorCrop = {
    x: Math.min(0.98, Math.max(0, crop.x)),
    y: Math.min(0.98, Math.max(0, crop.y)),
    w: Math.min(1 - Math.min(0.98, Math.max(0, crop.x)), Math.max(0.02, crop.w)),
    h: Math.min(1 - Math.min(0.98, Math.max(0, crop.y)), Math.max(0.02, crop.h)),
  };
  const cropWidth = sourceSize.width * safeCrop.w;
  const cropHeight = sourceSize.height * safeCrop.h;
  const fit = cropMode ? true : doc.fit;
  const zoom = cropMode ? 1 : doc.zoom;
  const panX = cropMode ? 0 : doc.panX;
  const panY = cropMode ? 0 : doc.panY;
  const base = fit
    ? Math.min(width / Math.max(1, cropWidth), height / Math.max(1, cropHeight))
    : Math.max(width / Math.max(1, cropWidth), height / Math.max(1, cropHeight));
  const scale = base * zoom;
  const left = width / 2 + panX * width - (safeCrop.x * sourceSize.width + cropWidth / 2) * scale;
  const top = height / 2 + panY * height - (safeCrop.y * sourceSize.height + cropHeight / 2) * scale;

  context.save();
  if (!cropMode) clipToCutout(context, doc, width, height);
  context.translate(left, top);
  context.scale(scale, scale);
  const filter = combinedFilter(doc);
  if (filter !== "none") context.filter = filter;
  if (turns === 0) {
    context.drawImage(source, 0, 0, sourceWidth, sourceHeight);
  } else if (turns === 1) {
    context.translate(sourceSize.width, 0);
    context.rotate(Math.PI / 2);
    context.drawImage(source, 0, 0, sourceWidth, sourceHeight);
  } else if (turns === 2) {
    context.translate(sourceSize.width, sourceSize.height);
    context.rotate(Math.PI);
    context.drawImage(source, 0, 0, sourceWidth, sourceHeight);
  } else {
    context.translate(0, sourceSize.height);
    context.rotate((Math.PI * 3) / 2);
    context.drawImage(source, 0, 0, sourceWidth, sourceHeight);
  }
  context.restore();
}

function drawText(context: CanvasRenderingContext2D, layer: EditorText, width: number, height: number) {
  const font = fontByKey(layer.font);
  const scale = width / 420;
  const size = layer.size * scale;
  const background = resolveColor(layer.background, EDIT_BACKGROUNDS);
  const outline = resolveColor(layer.outline, EDIT_OUTLINES);
  const value = layer.value || " ";
  context.save();
  context.translate(layer.x * width, layer.y * height);
  context.rotate((layer.rotation * Math.PI) / 180);
  context.font = `${font.weight} ${size}px ${font.css}`;
  context.textAlign = layer.align;
  context.textBaseline = "middle";
  const padX = size * 0.28;
  const padY = size * 0.12;
  const maxTextWidth = width * 0.86;
  const words = value.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = "";
  for (const word of words.length ? words : [" "]) {
    const candidate = current ? `${current} ${word}` : word;
    if (!current || context.measureText(candidate).width <= maxTextWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  if (!lines.length) lines.push(" ");
  const lineHeight = size * 1.18;
  const totalHeight = lineHeight * lines.length;
  const maxLineWidth = Math.max(...lines.map((line) => context.measureText(line).width));
  const left = layer.align === "center" ? -maxLineWidth / 2 : layer.align === "right" ? -maxLineWidth : 0;
  const top = -totalHeight / 2;
  if (background) {
    context.fillStyle = background;
    context.beginPath();
    const boxX = left - padX;
    const boxY = top - padY;
    const boxWidth = maxLineWidth + padX * 2;
    const boxHeight = totalHeight + padY * 2;
    const radius = Math.min(size * 0.3, boxWidth / 2, boxHeight / 2);
    context.moveTo(boxX + radius, boxY);
    context.lineTo(boxX + boxWidth - radius, boxY);
    context.quadraticCurveTo(boxX + boxWidth, boxY, boxX + boxWidth, boxY + radius);
    context.lineTo(boxX + boxWidth, boxY + boxHeight - radius);
    context.quadraticCurveTo(boxX + boxWidth, boxY + boxHeight, boxX + boxWidth - radius, boxY + boxHeight);
    context.lineTo(boxX + radius, boxY + boxHeight);
    context.quadraticCurveTo(boxX, boxY + boxHeight, boxX, boxY + boxHeight - radius);
    context.lineTo(boxX, boxY + radius);
    context.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
    context.closePath();
    context.fill();
  }
  if (outline) {
    context.lineWidth = Math.max(1, size * 0.035);
    context.strokeStyle = outline;
  }
  context.fillStyle = layer.color;
  lines.forEach((line, index) => {
    const lineY = top + lineHeight * (index + 0.5);
    if (outline) context.strokeText(line, 0, lineY, maxTextWidth);
    context.fillText(line, 0, lineY, maxTextWidth);
  });
  if (layer.box) {
    context.lineWidth = Math.max(1, size * 0.03);
    context.strokeStyle = "rgba(255,255,255,.9)";
    context.strokeRect(left - padX, top - padY, maxLineWidth + padX * 2, totalHeight + padY * 2);
  }
  context.restore();
}

function drawOverlays(
  context: CanvasRenderingContext2D,
  doc: EditorDoc,
  width: number,
  height: number,
  layerImages: Map<string, HTMLImageElement>,
) {
  for (const stroke of doc.strokes) {
    if (stroke.points.length < 2) continue;
    context.strokeStyle = stroke.color;
    context.lineWidth = Math.max(1, stroke.width * width);
    context.lineCap = "round";
    context.lineJoin = "round";
    context.beginPath();
    stroke.points.forEach((point, index) => {
      const x = point.x * width;
      const y = point.y * height;
      if (index === 0) context.moveTo(x, y);
      else context.lineTo(x, y);
    });
    context.stroke();
  }

  for (const layer of doc.texts) drawText(context, layer, width, height);

  for (const layer of doc.layers) {
    const image = layerImages.get(layer.src);
    if (!image) continue;
    const size = layerSize(layer, width, height);
    context.save();
    context.translate(layer.x * width, layer.y * height);
    context.rotate((layer.rotation * Math.PI) / 180);
    context.drawImage(image, -size.width / 2, -size.height / 2, size.width, size.height);
    context.restore();
  }
}

export function drawScene(context: CanvasRenderingContext2D, options: SceneOptions) {
  const { source, sourceWidth, sourceHeight, doc, width, height, cropMode = false, layerImages, afterSource } = options;
  context.clearRect(0, 0, width, height);
  context.fillStyle = "#000";
  context.fillRect(0, 0, width, height);
  drawSource(context, source, sourceWidth, sourceHeight, doc, width, height, cropMode);
  if (!cropMode) {
    afterSource?.(context, width, height);
    drawOverlays(context, doc, width, height, layerImages ?? new Map());
  }
}
