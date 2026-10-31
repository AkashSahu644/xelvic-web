export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export interface CropRect {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

export interface NormalizedPoint {
  x: number;
  y: number;
}

export function moveNormalizedPoint(
  point: NormalizedPoint,
  deltaX: number,
  deltaY: number,
  stageWidth: number,
  stageHeight: number,
  itemWidth: number,
  itemHeight: number,
): NormalizedPoint {
  if (stageWidth <= 0 || stageHeight <= 0) return point;
  const halfX = Math.min(0.45, itemWidth / stageWidth / 2);
  const halfY = Math.min(0.22, itemHeight / stageHeight / 2);
  return {
    x: clamp(point.x + deltaX / stageWidth, halfX, 1 - halfX),
    y: clamp(point.y + deltaY / stageHeight, halfY, 1 - halfY),
  };
}

export function coverCrop(
  frameWidth: number,
  frameHeight: number,
  targetAspect: number,
  zoom = 1,
): CropRect {
  if (
    !frameWidth ||
    !frameHeight ||
    !Number.isFinite(targetAspect) ||
    targetAspect <= 0
  ) {
    return { sx: 0, sy: 0, sw: frameWidth || 0, sh: frameHeight || 0 };
  }
  const safeZoom = clamp(zoom, 1, 4);
  const frameAspect = frameWidth / frameHeight;
  let sw = frameWidth;
  let sh = frameHeight;
  if (frameAspect > targetAspect) {
    sw = frameHeight * targetAspect;
  } else {
    sh = frameWidth / targetAspect;
  }
  sw /= safeZoom;
  sh /= safeZoom;
  return {
    sx: (frameWidth - sw) / 2,
    sy: (frameHeight - sh) / 2,
    sw,
    sh,
  };
}

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}
